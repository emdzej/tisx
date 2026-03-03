/**
 * ITW V2 Decoder - Exact translation from tis.exe.c
 * v2 - Fixed tree building to match original index assignment
 */

import * as fs from 'fs';
import sharp from 'sharp';

interface Node {
  isLeaf: number;
  symbol: number;
  index: number;
  left: number;
  right: number;
  freq: number;
}

interface DecoderState {
  nodeMap: Map<number, Node>;  // index -> node
  rootIndex: number;
  maxSymbols: number;
}

// Priority queue (min-heap by frequency)
class MinHeap {
  items: Node[] = [];
  
  push(node: Node) {
    this.items.push(node);
    this.items.sort((a, b) => a.freq - b.freq);
  }
  
  pop(): Node | undefined {
    return this.items.shift();
  }
  
  size(): number {
    return this.items.length;
  }
}

// FUN_004b6340 + FUN_004b6570 combined
// Returns: { nodeMap, rootIndex, maxSymbols, dataStart }
function parseAndBuildTree(buf: Buffer): { state: DecoderState; dataStart: number } {
  // Parse dictionary
  const entryCount = buf.readUInt32LE(0);
  const entries: Node[] = [];
  
  let offset = 4;
  for (let i = 0; i < entryCount; i++) {
    const symbol = buf[offset];
    const freqBuf = Buffer.alloc(4);
    freqBuf.writeUInt32LE(buf.readUInt32LE(offset + 4));
    const freq = freqBuf.readFloatLE(0);
    
    entries.push({
      isLeaf: 1,
      symbol,
      index: -1,  // Will be assigned during tree build
      left: -1,
      right: -1,
      freq
    });
    offset += 8;
  }
  
  const maxSymbols = buf.readUInt32LE(offset);
  const dataStart = offset + 4;
  
  // === FUN_004b6570 - Build tree ===
  // Copy entries to priority queue
  const queue = new MinHeap();
  for (const e of entries) {
    queue.push({ ...e });
  }
  
  const nodeMap = new Map<number, Node>();
  let iVar9 = 0;  // Next index to assign
  
  // while (queue.size() != 1)
  while (queue.size() > 1) {
    // Pop first (lowest freq) - becomes "left" conceptually
    const puVar4 = queue.pop()!;
    
    // if (*(short *)*puVar4 != 0) { assign index }
    // In original: *(int *)((short *)*puVar4 + 2) = iVar9
    // This is offset 4 (2 shorts = 4 bytes)
    if (puVar4.isLeaf !== 0) {
      puVar4.index = iVar9;
      nodeMap.set(iVar9, puVar4);
      iVar9++;
    }
    
    // Pop second (next lowest) - becomes "right" conceptually
    const puVar5 = queue.pop()!;
    
    if (puVar5.isLeaf !== 0) {
      puVar5.index = iVar9;
      nodeMap.set(iVar9, puVar5);
      iVar9++;
    }
    
    // Create combined node
    // *(undefined2 *)*puVar6 = 0;  // Not a leaf
    // *(float *)(*puVar6 + 0x14) = left.freq + right.freq;
    // *(int *)(*puVar6 + 4) = iVar9;
    // *(undefined4 *)(*puVar6 + 8) = *(undefined4 *)(*puVar4 + 4);  // left.index
    // *(undefined4 *)(*puVar6 + 0xc) = *(undefined4 *)(*puVar5 + 4); // right.index
    const combined: Node = {
      isLeaf: 0,
      symbol: 0,
      index: iVar9,
      left: puVar4.index,
      right: puVar5.index,
      freq: puVar4.freq + puVar5.freq
    };
    
    nodeMap.set(iVar9, combined);
    iVar9++;
    
    // Push combined back to queue
    queue.push(combined);
  }
  
  // Root is at iVar9 - 1
  const rootIndex = iVar9 - 1;
  
  return {
    state: { nodeMap, rootIndex, maxSymbols },
    dataStart
  };
}

// FUN_004b6250 - Decode
function decode(state: DecoderState, buf: Buffer, dataStart: number): number[] {
  const output: number[] = [];
  let bytePos = dataStart;
  let nodeIdx = state.rootIndex;
  
  while (bytePos < buf.length && output.length < state.maxSymbols) {
    let byte = buf[bytePos];
    
    for (let bit = 0; bit < 8 && output.length < state.maxSymbols; bit++) {
      const node = state.nodeMap.get(nodeIdx);
      if (!node) {
        console.error(`Missing node ${nodeIdx}`);
        return output;
      }
      
      // if ((uVar2 & 1) == 0) { left } else { right }
      if ((byte & 1) === 0) {
        nodeIdx = node.left;
      } else {
        nodeIdx = node.right;
      }
      byte >>= 1;
      
      const nextNode = state.nodeMap.get(nodeIdx);
      if (!nextNode) {
        console.error(`Missing next node ${nodeIdx}`);
        return output;
      }
      
      // if leaf, output and reset
      if (nextNode.isLeaf !== 0) {
        output.push(nextNode.symbol);
        nodeIdx = state.rootIndex;
      }
    }
    bytePos++;
  }
  
  return output;
}

function parseV2(buf: Buffer) {
  let pos = 14;
  const paletteSize = buf[pos++];
  const palette: number[] = [];
  for (let i = 0; i < paletteSize; i++) palette.push(buf[pos++]);
  
  const s1Size = (buf.readUInt16BE(pos) << 16) | buf.readUInt16BE(pos + 2); pos += 4;
  const stream1 = buf.subarray(pos, pos + s1Size); pos += s1Size;
  
  const s2Size = (buf.readUInt16BE(pos) << 16) | buf.readUInt16BE(pos + 2); pos += 4;
  const stream2 = buf.subarray(pos, pos + s2Size);
  
  return { width: buf.readUInt16BE(6), height: buf.readUInt16BE(8), palette, stream1, stream2 };
}

async function main() {
  const inputPath = process.argv[2] || `${process.env.HOME}/Documents/tis/GRAFIK/10/28/74.ITW`;
  const outputPath = process.argv[3] || `${process.env.HOME}/.openclaw/workspace/itw_v2_exact2.png`;
  
  console.log('=== ITW V2 Exact Decoder v2 ===');
  
  const buf = fs.readFileSync(inputPath);
  const data = parseV2(buf);
  
  console.log(`Image: ${data.width}×${data.height}`);
  console.log(`Palette: [${data.palette.join(', ')}]`);
  
  // Build and decode stream 1
  const { state: state1, dataStart: ds1 } = parseAndBuildTree(data.stream1);
  console.log(`\nStream1: root=${state1.rootIndex}, max=${state1.maxSymbols}, dataStart=${ds1}`);
  
  // Show tree
  console.log('Tree nodes:');
  for (const [idx, node] of state1.nodeMap) {
    if (idx < 20 || idx === state1.rootIndex) {
      console.log(`  [${idx}] leaf=${node.isLeaf} sym=${node.symbol} L=${node.left} R=${node.right} freq=${node.freq.toExponential(2)}`);
    }
  }
  
  const dec1 = decode(state1, data.stream1, ds1);
  console.log(`Decoded1: ${dec1.length}/${state1.maxSymbols}`);
  
  // Decode stream 2
  const { state: state2, dataStart: ds2 } = parseAndBuildTree(data.stream2);
  const dec2 = decode(state2, data.stream2, ds2);
  console.log(`Decoded2: ${dec2.length}/${state2.maxSymbols}`);
  
  console.log('First 30:', dec1.slice(0, 30).join(', '));
  
  // Combine
  const totalPixels = data.width * data.height;
  const threshold = data.palette.length + 8;
  const output = Buffer.alloc(totalPixels);
  let out = 0, d1 = 0, d2 = 0;
  
  while (out < totalPixels && d1 < dec1.length) {
    const v1 = dec1[d1++];
    if (v1 < threshold && d2 < dec2.length) {
      if (out < totalPixels) output[out++] = dec2[d2++];
      if (out < totalPixels) output[out++] = v1;
    } else {
      if (out < totalPixels) output[out++] = v1;
    }
  }
  
  console.log(`Output: ${out}/${totalPixels}`);
  
  for (let i = 0; i < output.length; i++) {
    if (output[i] < data.palette.length) output[i] = data.palette[output[i]];
  }
  
  await sharp(output, { raw: { width: data.width, height: data.height, channels: 1 } })
    .png().toFile(outputPath);
  
  console.log('Saved:', outputPath);
}

main().catch(e => console.error('Error:', e.message));
