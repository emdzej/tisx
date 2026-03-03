/**
 * ITW V2 Decoder - Final version with correct bit traversal limit
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
  nodeMap: Map<number, Node>;
  rootIndex: number;
  maxSymbols: number;  // This is actually maxBitTraversals!
}

class MinHeap {
  items: Node[] = [];
  push(node: Node) { this.items.push(node); this.items.sort((a, b) => a.freq - b.freq); }
  pop(): Node | undefined { return this.items.shift(); }
  size(): number { return this.items.length; }
}

function parseAndBuildTree(buf: Buffer): { state: DecoderState; dataStart: number } {
  const entryCount = buf.readUInt32LE(0);
  const entries: Node[] = [];
  
  let offset = 4;
  for (let i = 0; i < entryCount; i++) {
    const symbol = buf[offset];
    const fb = Buffer.alloc(4);
    fb.writeUInt32LE(buf.readUInt32LE(offset + 4));
    entries.push({ isLeaf: 1, symbol, index: -1, left: -1, right: -1, freq: fb.readFloatLE(0) });
    offset += 8;
  }
  
  const maxSymbols = buf.readUInt32LE(offset);
  const dataStart = offset + 4;
  
  // Build Huffman tree
  const queue = new MinHeap();
  for (const e of entries) queue.push({ ...e });
  
  const nodeMap = new Map<number, Node>();
  let idx = 0;
  
  while (queue.size() > 1) {
    const left = queue.pop()!;
    if (left.isLeaf) { left.index = idx; nodeMap.set(idx++, left); }
    
    const right = queue.pop()!;
    if (right.isLeaf) { right.index = idx; nodeMap.set(idx++, right); }
    
    const combined: Node = {
      isLeaf: 0, symbol: 0, index: idx,
      left: left.index, right: right.index,
      freq: left.freq + right.freq
    };
    nodeMap.set(idx++, combined);
    queue.push(combined);
  }
  
  return { state: { nodeMap, rootIndex: idx - 1, maxSymbols }, dataStart };
}

// Decode with BIT TRAVERSAL limit (not symbol count!)
function decode(state: DecoderState, buf: Buffer, dataStart: number): number[] {
  const output: number[] = [];
  let bytePos = dataStart;
  let nodeIdx = state.rootIndex;
  let local_4 = 0;  // Bit traversal counter
  
  while (bytePos < buf.length) {
    let byte = buf[bytePos];
    
    for (let bit = 0; bit < 8; bit++) {
      // Original: if (param_1[4] <= local_4) break;
      // Check BEFORE incrementing
      if (state.maxSymbols <= local_4) {
        return output;
      }
      local_4++;
      
      const node = state.nodeMap.get(nodeIdx);
      if (!node) return output;
      
      nodeIdx = (byte & 1) === 0 ? node.left : node.right;
      byte >>= 1;
      
      const next = state.nodeMap.get(nodeIdx);
      if (!next) return output;
      
      if (next.isLeaf) {
        output.push(next.symbol);
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
  const outputPath = process.argv[3] || `${process.env.HOME}/.openclaw/workspace/itw_v2_final.png`;
  
  console.log('=== ITW V2 Final Decoder ===');
  
  const buf = fs.readFileSync(inputPath);
  const data = parseV2(buf);
  
  console.log(`Image: ${data.width}×${data.height}`);
  console.log(`Palette: [${data.palette.join(', ')}]`);
  
  const { state: state1, dataStart: ds1 } = parseAndBuildTree(data.stream1);
  console.log(`\nStream1: root=${state1.rootIndex}, maxTraversals=${state1.maxSymbols}`);
  
  const dec1 = decode(state1, data.stream1, ds1);
  console.log(`Decoded1: ${dec1.length} symbols`);
  
  const { state: state2, dataStart: ds2 } = parseAndBuildTree(data.stream2);
  const dec2 = decode(state2, data.stream2, ds2);
  console.log(`Decoded2: ${dec2.length} symbols`);
  
  console.log('First 30 dec1:', dec1.slice(0, 30).join(', '));
  
  // Combine
  const totalPixels = data.width * data.height;
  const threshold = data.palette.length + 8;
  const output = Buffer.alloc(totalPixels);
  let out = 0, d1 = 0, d2 = 0;
  
  while (out < totalPixels && d1 < dec1.length) {
    const v1 = dec1[d1++];
    if (v1 < threshold && d2 < dec2.length) {
      output[out++] = dec2[d2++];
      if (out < totalPixels) output[out++] = v1;
    } else {
      output[out++] = v1;
    }
  }
  
  console.log(`Output: ${out}/${totalPixels}`);
  
  // Map to palette values
  for (let i = 0; i < output.length; i++) {
    if (output[i] < data.palette.length) {
      output[i] = data.palette[output[i]];
    }
  }
  
  await sharp(output, { raw: { width: data.width, height: data.height, channels: 1 } })
    .png().toFile(outputPath);
  
  console.log('Saved:', outputPath);
}

main().catch(e => console.error('Error:', e.message));
