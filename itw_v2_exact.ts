/**
 * ITW V2 Decoder - Line-by-line translation from tis.exe.c
 * 
 * FUN_004b6340 - Parse dictionary
 * FUN_004b6570 - Build Huffman tree  
 * FUN_004b6250 - Decode bitstream
 */

import * as fs from 'fs';
import sharp from 'sharp';

// Node structure (0x18 = 24 bytes):
// offset 0x00: leaf flag (short) - non-zero if leaf
// offset 0x02: symbol (short) - symbol value for leaves
// offset 0x04: node index (int)
// offset 0x08: left child index (int)
// offset 0x0c: right child index (int)
// offset 0x10: parent/tree index (int)
// offset 0x14: frequency (float)

interface Node {
  isLeaf: number;      // offset 0x00 (short)
  symbol: number;      // offset 0x02 (short)
  index: number;       // offset 0x04
  left: number;        // offset 0x08
  right: number;       // offset 0x0c
  parent: number;      // offset 0x10
  freq: number;        // offset 0x14 (float)
}

interface DecoderState {
  nodes: Node[];       // param_1[8] - node storage
  entries: Node[];     // param_1[7] - original dictionary entries
  rootIndex: number;   // param_1[2] - tree root
  maxSymbols: number;  // param_1[0x10] - max output symbols
}

// FUN_004b68f0 - Read byte from buffer at index
function readByte(buf: Buffer, index: number): number {
  return buf[index] & 0xff;
}

// FUN_004b6340 - Parse dictionary entries
// Returns: data start offset
function parseDict(state: DecoderState, buf: Buffer): number {
  // Read entry count (4 bytes LE)
  // uVar3 = byte[0], uVar4 = byte[1], uVar5 = byte[2], uVar6 = byte[3]
  // local_4 = uVar3 + uVar4*0x100 + uVar5*0x10000 + uVar6*0x1000000
  const entryCount = buf.readUInt32LE(0);
  
  let offset = 4;
  state.entries = [];
  
  // Read each entry (8 bytes each)
  for (let i = 0; i < entryCount; i++) {
    // *(char *)(*puVar2 + 2) = (char)uVar3;  // symbol at offset 2
    const symbol = buf[offset];
    
    // Read frequency as 4 bytes LE at offset 4-7, stored as float at node offset 0x14
    const freqBytes = buf.readUInt32LE(offset + 4);
    const freqBuf = Buffer.alloc(4);
    freqBuf.writeUInt32LE(freqBytes);
    const freq = freqBuf.readFloatLE(0);
    
    state.entries.push({
      isLeaf: 1,       // Leaf node
      symbol: symbol,
      index: i,
      left: -1,
      right: -1,
      parent: -1,
      freq: freq
    });
    
    offset += 8;
  }
  
  // Read maxSymbols (4 bytes LE after entries)
  state.maxSymbols = buf.readUInt32LE(offset);
  
  return offset + 4;  // Return data start
}

// Priority queue operations (simplified)
class PriorityQueue {
  items: Node[] = [];
  
  push(node: Node) {
    this.items.push(node);
    // Sort by frequency ascending (lowest first)
    this.items.sort((a, b) => a.freq - b.freq);
  }
  
  pop(): Node | undefined {
    return this.items.shift();  // Remove and return lowest
  }
  
  size(): number {
    return this.items.length;
  }
}

// FUN_004b6570 - Build Huffman tree
function buildTree(state: DecoderState): void {
  // Copy entries to priority queue
  const queue = new PriorityQueue();
  
  // if (0 < *(int *)param_1[7]) { ... FUN_004b5f90(piVar2,puVar3) }
  for (const entry of state.entries) {
    queue.push({ ...entry });
  }
  
  state.nodes = [];
  let nodeIndex = 0;
  
  // Assign indices to leaf nodes
  // The original code assigns indices as it pops from queue
  // Let's first add all leaves with their indices
  for (const entry of state.entries) {
    entry.index = nodeIndex++;
    state.nodes.push({ ...entry });
  }
  
  // Now build tree: while (iVar8 != 1) { ... }
  // Actually, we need to rebuild the queue with indexed entries
  const buildQueue = new PriorityQueue();
  for (const node of state.nodes) {
    buildQueue.push(node);
  }
  
  // iVar9 = 0; (next index to assign)
  // Note: original code assigns indices during pop, we pre-assigned above
  let nextIndex = state.nodes.length;
  
  while (buildQueue.size() > 1) {
    // Pop two lowest frequency nodes
    // FUN_004b6000(piVar2,0); - pops from queue
    const left = buildQueue.pop()!;
    const right = buildQueue.pop()!;
    
    // Create combined node
    // *(undefined2 *)*puVar6 = 0;  // Not a leaf
    // *(float *)(*puVar6 + 0x14) = *(float *)(*puVar5 + 0x14) + *(float *)(*puVar4 + 0x14);
    // *(int *)(*puVar6 + 4) = iVar9;
    // *(undefined4 *)(*puVar6 + 8) = *(undefined4 *)(*puVar4 + 4);   // left child
    // *(undefined4 *)(*puVar6 + 0xc) = *(undefined4 *)(*puVar5 + 4); // right child
    const combined: Node = {
      isLeaf: 0,
      symbol: 0,
      index: nextIndex,
      left: left.index,
      right: right.index,
      parent: -1,
      freq: left.freq + right.freq
    };
    
    // Update parent pointers
    // *(int *)(*piVar7 + 0x10) = iVar9;
    if (left.index < state.nodes.length) {
      state.nodes[left.index].parent = nextIndex;
    }
    if (right.index < state.nodes.length) {
      state.nodes[right.index].parent = nextIndex;
    }
    
    state.nodes.push(combined);
    buildQueue.push(combined);
    nextIndex++;
  }
  
  // param_1[2] = iVar9 + -1;  // Root is last node
  state.rootIndex = nextIndex - 1;
  
  console.log(`Built tree with ${state.nodes.length} nodes, root at index ${state.rootIndex}`);
}

// FUN_004b6250 - Decode bitstream
function decode(state: DecoderState, buf: Buffer, dataStart: number): number[] {
  const output: number[] = [];
  let bytePos = dataStart;
  let bitPos = 0;
  
  // local_4 = 0; (output count)
  // if (local_8 < *param_2) { do { ... } while (local_8 < *param_2); }
  
  while (output.length < state.maxSymbols && bytePos < buf.length) {
    // param_1[3] = 8;
    // uVar2 = FUN_004b68f0(param_2,local_8); - read byte
    let currentByte = buf[bytePos];
    let bitsLeft = 8;
    
    // while (iVar1 != 0) { ... }
    while (bitsLeft > 0 && output.length < state.maxSymbols) {
      let nodeIdx = state.rootIndex;
      
      // Traverse tree until leaf
      while (state.nodes[nodeIdx] && state.nodes[nodeIdx].isLeaf === 0) {
        // Read bit
        const bit = (currentByte >> (8 - bitsLeft)) & 1;
        bitsLeft--;
        
        if (bitsLeft === 0 && bytePos + 1 < buf.length) {
          bytePos++;
          currentByte = buf[bytePos];
          bitsLeft = 8;
        }
        
        // if ((uVar2 & 1) == 0) { iVar5 = *(int *)(*piVar3 + 8); }
        // else { iVar5 = *(int *)(*piVar3 + 0xc); }
        if (bit === 0) {
          nodeIdx = state.nodes[nodeIdx].left;
        } else {
          nodeIdx = state.nodes[nodeIdx].right;
        }
        
        if (nodeIdx < 0 || nodeIdx >= state.nodes.length) {
          console.error(`Invalid node index ${nodeIdx}`);
          break;
        }
      }
      
      // if (*(short *)*puVar4 != 0) { FUN_004b6890(param_3,(char)((short *)*puVar4)[1]); }
      if (state.nodes[nodeIdx] && state.nodes[nodeIdx].isLeaf !== 0) {
        output.push(state.nodes[nodeIdx].symbol);
      }
    }
    
    bytePos++;
  }
  
  return output;
}

// Exact decode matching FUN_004b6250
function decodeExact(state: DecoderState, buf: Buffer, dataStart: number): number[] {
  const output: number[] = [];
  
  // local_8 = dataStart (from FUN_004b6340)
  // *param_2 = buf.length (stream size)
  // if (local_8 < *param_2) { do { ... } while (local_8 < *param_2); }
  
  let local_8 = dataStart;
  let iVar5 = state.rootIndex;  // iVar5 = param_1[2] - current node
  let local_4 = 0;  // Traversal counter
  
  // Process all bytes from dataStart to end
  while (local_8 < buf.length) {
    // param_1[3] = 8
    // uVar2 = FUN_004b68f0(param_2, local_8) - read byte
    let uVar2 = buf[local_8];
    let bitsLeft = 8;  // param_1[3]
    
    // while (iVar1 != 0) { ... }
    while (bitsLeft > 0) {
      bitsLeft--;  // param_1[3] = param_1[3] + -1
      
      // if (param_1[4] <= local_4) break;
      if (output.length >= state.maxSymbols) break;
      
      local_4++;
      
      // piVar3 = FUN_004b6080(param_1[8], iVar5) - get node
      const node = state.nodes[iVar5];
      if (!node) {
        console.error(`Invalid node index ${iVar5} at byte ${local_8}`);
        break;
      }
      
      // if ((uVar2 & 1) == 0) { iVar5 = left } else { iVar5 = right }
      if ((uVar2 & 1) === 0) {
        iVar5 = node.left;
      } else {
        iVar5 = node.right;
      }
      
      // puVar4 = FUN_004b6080(param_1[8], iVar5)
      const nextNode = state.nodes[iVar5];
      if (!nextNode) {
        console.error(`Invalid next node ${iVar5}`);
        break;
      }
      
      // if (*(short *)*puVar4 != 0) { output symbol; reset to root }
      if (nextNode.isLeaf !== 0) {
        output.push(nextNode.symbol);
        iVar5 = state.rootIndex;  // iVar5 = param_1[2]
      }
      
      // uVar2 = (int)uVar2 >> 1
      uVar2 = uVar2 >> 1;
    }
    
    if (output.length >= state.maxSymbols) break;
    local_8++;  // local_8 = local_8 + 1
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
  const outputPath = process.argv[3] || `${process.env.HOME}/.openclaw/workspace/itw_v2_exact.png`;
  
  console.log('=== ITW V2 Exact Decoder (from decompilation) ===');
  
  const buf = fs.readFileSync(inputPath);
  const data = parseV2(buf);
  
  console.log(`Image: ${data.width}×${data.height}`);
  console.log(`Palette: [${data.palette.join(', ')}]`);
  
  // Decode stream 1
  const state1: DecoderState = { nodes: [], entries: [], rootIndex: 0, maxSymbols: 0 };
  const dataStart1 = parseDict(state1, data.stream1);
  
  console.log(`\nStream1: ${state1.entries.length} entries, max=${state1.maxSymbols}`);
  console.log('Entries:');
  state1.entries.forEach((e, i) => {
    console.log(`  [${i}] sym=${e.symbol.toString().padStart(2)} freq=${e.freq.toExponential(4)}`);
  });
  
  buildTree(state1);
  
  // Show tree structure
  console.log('\nTree structure (first 10 nodes):');
  state1.nodes.slice(0, Math.min(20, state1.nodes.length)).forEach((n, i) => {
    console.log(`  [${i}] leaf=${n.isLeaf} sym=${n.symbol} L=${n.left} R=${n.right} freq=${n.freq.toExponential(2)}`);
  });
  
  console.log('\nDecoding...');
  const dec1 = decodeExact(state1, data.stream1, dataStart1);
  console.log(`Decoded1: ${dec1.length}/${state1.maxSymbols}`);
  
  // Decode stream 2
  const state2: DecoderState = { nodes: [], entries: [], rootIndex: 0, maxSymbols: 0 };
  const dataStart2 = parseDict(state2, data.stream2);
  buildTree(state2);
  const dec2 = decodeExact(state2, data.stream2, dataStart2);
  console.log(`Decoded2: ${dec2.length}/${state2.maxSymbols}`);
  
  // Show first 30 decoded symbols
  console.log('\nFirst 30 dec1:', dec1.slice(0, 30).join(', '));
  
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
