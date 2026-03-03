/**
 * ITW V2 Decoder - Correct implementation from tis.exe
 * 
 * Dictionary format (in stream):
 * - uint32 LE: entry count
 * - entries[]: 8 bytes each: [3 unused][symbol:1][frequency:4 LE]
 * - uint32 LE: max output symbols
 * - rest: Huffman-coded bit stream
 */

import * as fs from 'fs';
import sharp from 'sharp';

// ============= Huffman structures =============

interface HuffmanEntry {
  symbol: number;
  frequency: number;
}

interface HuffmanNode {
  leafFlag: number;   // non-zero = leaf
  symbol: number;     // valid if leafFlag != 0
  leftChild: number;  // node index
  rightChild: number; // node index
}

// ============= Parse dictionary =============

interface ParsedDict {
  entries: HuffmanEntry[];
  maxSymbols: number;
  dataStart: number;
}

function parseDict(stream: Buffer): ParsedDict {
  let pos = 0;
  
  // Entry count (uint32 LE)
  const entryCount = stream.readUInt32LE(pos);
  pos += 4;
  
  const entries: HuffmanEntry[] = [];
  
  // Read entries (8 bytes each)
  for (let i = 0; i < entryCount && pos + 8 <= stream.length; i++) {
    // Bytes 0-2: unused (but byte 0 is read)
    // Byte 3: symbol value
    const symbol = stream[pos + 3];
    
    // Bytes 4-7: frequency (uint32 LE)
    const frequency = stream.readUInt32LE(pos + 4);
    
    entries.push({ symbol, frequency });
    pos += 8;
  }
  
  // Max symbols (uint32 LE)
  const maxSymbols = stream.readUInt32LE(pos);
  pos += 4;
  
  console.log(`    Entries: ${entryCount}, maxSymbols: ${maxSymbols}, dataStart: ${pos}`);
  
  return { entries, maxSymbols, dataStart: pos };
}

// ============= Build Huffman tree (FUN_004b6570) =============

function buildTree(entries: HuffmanEntry[]): { nodes: HuffmanNode[]; root: number } {
  if (entries.length === 0) {
    return { nodes: [{ leafFlag: 1, symbol: 0, leftChild: -1, rightChild: -1 }], root: 0 };
  }
  
  // Create initial nodes from entries (all leaves)
  const nodes: HuffmanNode[] = [];
  
  // Priority queue: [nodeIndex, frequency]
  let queue: Array<{ idx: number; freq: number }> = [];
  
  for (const entry of entries) {
    const idx = nodes.length;
    nodes.push({
      leafFlag: 1,  // Non-zero = leaf
      symbol: entry.symbol,
      leftChild: -1,
      rightChild: -1,
    });
    queue.push({ idx, freq: entry.frequency });
  }
  
  // Sort by frequency
  queue.sort((a, b) => a.freq - b.freq);
  
  // Build tree
  while (queue.length > 1) {
    const left = queue.shift()!;
    const right = queue.shift()!;
    
    const parentIdx = nodes.length;
    nodes.push({
      leafFlag: 0,  // Internal node
      symbol: 0,
      leftChild: left.idx,
      rightChild: right.idx,
    });
    
    const parentFreq = left.freq + right.freq;
    
    // Insert sorted
    let inserted = false;
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].freq > parentFreq) {
        queue.splice(i, 0, { idx: parentIdx, freq: parentFreq });
        inserted = true;
        break;
      }
    }
    if (!inserted) queue.push({ idx: parentIdx, freq: parentFreq });
  }
  
  return { nodes, root: queue.length > 0 ? queue[0].idx : 0 };
}

// ============= Decode Huffman bitstream (FUN_004b6250) =============

function huffmanDecode(
  stream: Buffer,
  dataStart: number,
  nodes: HuffmanNode[],
  root: number,
  maxSymbols: number
): number[] {
  const output: number[] = [];
  let currentNode = root;
  let bytePos = dataStart;
  
  // Process byte-by-byte, bit-by-bit (LSB first)
  while (output.length < maxSymbols && bytePos < stream.length) {
    const byte = stream[bytePos];
    
    // Process 8 bits per byte
    for (let bitIdx = 0; bitIdx < 8 && output.length < maxSymbols; bitIdx++) {
      const bit = (byte >> bitIdx) & 1;
      
      const node = nodes[currentNode];
      if (!node) break;
      
      // Navigate: bit=0 -> left, bit=1 -> right
      const nextIdx = bit === 0 ? node.leftChild : node.rightChild;
      
      if (nextIdx < 0 || nextIdx >= nodes.length) {
        // Invalid, reset to root
        currentNode = root;
        continue;
      }
      
      const nextNode = nodes[nextIdx];
      
      if (nextNode.leafFlag !== 0) {
        // Leaf - output symbol and reset to root
        output.push(nextNode.symbol);
        currentNode = root;
      } else {
        // Internal - continue traversal
        currentNode = nextIdx;
      }
    }
    
    bytePos++;
  }
  
  return output;
}

// ============= V2 Header =============

function parseHeader(buffer: Buffer) {
  return {
    magic: buffer.toString('ascii', 0, 4),
    version: buffer.readUInt8(4),
    width: buffer.readUInt16BE(6),
    height: buffer.readUInt16BE(8),
    bpp: buffer.readUInt16BE(10),
  };
}

// ============= Read streams from V2 =============

function readStreams(buffer: Buffer, offset: number) {
  let pos = offset;
  
  // Palette
  const paletteSize = buffer[pos++];
  const palette: number[] = [];
  for (let i = 0; i < paletteSize; i++) {
    palette.push(buffer[pos++]);
  }
  
  // Stream1 size (2x uint16 BE concatenated)
  const s1SizeHi = buffer.readUInt16BE(pos); pos += 2;
  const s1SizeLo = buffer.readUInt16BE(pos); pos += 2;
  const s1Size = (s1SizeHi << 16) | s1SizeLo;
  const stream1 = buffer.subarray(pos, pos + s1Size);
  pos += s1Size;
  
  // Stream2 size
  const s2SizeHi = buffer.readUInt16BE(pos); pos += 2;
  const s2SizeLo = buffer.readUInt16BE(pos); pos += 2;
  const s2Size = (s2SizeHi << 16) | s2SizeLo;
  const stream2 = buffer.subarray(pos, pos + s2Size);
  
  return { paletteSize, palette, stream1, stream2 };
}

// ============= Main V2 decode (FUN_004b57f0) =============

async function decodeV2(inputPath: string, outputPath: string) {
  console.log(`\n=== ITW V2 Decoder ===`);
  console.log(`Input: ${inputPath}`);
  
  const buffer = fs.readFileSync(inputPath);
  const header = parseHeader(buffer);
  
  console.log(`\nHeader: ${header.width}×${header.height}, v${header.version}`);
  
  if (header.magic !== 'ITW_') throw new Error('Not ITW file');
  if (header.version !== 2) throw new Error('Not V2');
  
  const { width, height } = header;
  const totalPixels = width * height;
  
  // Read streams
  console.log(`\nReading streams:`);
  const { paletteSize, palette, stream1, stream2 } = readStreams(buffer, 14);
  console.log(`  Palette: ${paletteSize} entries: [${palette.join(', ')}]`);
  console.log(`  Stream1: ${stream1.length} bytes`);
  console.log(`  Stream2: ${stream2.length} bytes`);
  
  // Parse dictionaries
  console.log(`\nParsing dictionaries:`);
  console.log(`  Stream1:`);
  const dict1 = parseDict(stream1);
  console.log(`  Stream2:`);
  const dict2 = parseDict(stream2);
  
  // Build trees
  console.log(`\nBuilding Huffman trees:`);
  const tree1 = buildTree(dict1.entries);
  const tree2 = buildTree(dict2.entries);
  console.log(`  Tree1: ${tree1.nodes.length} nodes, root=${tree1.root}`);
  console.log(`  Tree2: ${tree2.nodes.length} nodes, root=${tree2.root}`);
  
  // Decode
  console.log(`\nDecoding bitstreams:`);
  const decoded1 = huffmanDecode(stream1, dict1.dataStart, tree1.nodes, tree1.root, dict1.maxSymbols);
  const decoded2 = huffmanDecode(stream2, dict2.dataStart, tree2.nodes, tree2.root, dict2.maxSymbols);
  console.log(`  Decoded1: ${decoded1.length} symbols (expected ${dict1.maxSymbols})`);
  console.log(`  Decoded2: ${decoded2.length} symbols (expected ${dict2.maxSymbols})`);
  
  // Combine (from FUN_004b57f0 interleave logic)
  // threshold = paletteSize + 8
  // if decoded1[i] < threshold: output decoded2, then decoded1
  // else: output decoded1 only
  
  console.log(`\nCombining streams (threshold=${paletteSize + 8}):`);
  const output = Buffer.alloc(totalPixels);
  let outIdx = 0;
  let d1Idx = 0;
  let d2Idx = 0;
  
  const threshold = paletteSize + 8;
  
  while (outIdx < totalPixels && d1Idx < decoded1.length) {
    const val1 = decoded1[d1Idx++];
    
    if (val1 < threshold && d2Idx < decoded2.length) {
      // Output from both streams
      if (outIdx < totalPixels) output[outIdx++] = decoded2[d2Idx++];
      if (outIdx < totalPixels) output[outIdx++] = val1;
    } else {
      // Output from stream1 only
      if (outIdx < totalPixels) output[outIdx++] = val1;
    }
  }
  
  console.log(`  Output: ${outIdx}/${totalPixels} pixels`);
  
  // Save
  await sharp(output, { raw: { width, height, channels: 1 } })
    .png()
    .toFile(outputPath);
  
  console.log(`\nSaved: ${outputPath}`);
}

// CLI
const input = process.argv[2] || `${process.env.HOME}/Documents/tis/GRAFIK/10/28/74.ITW`;
const output = process.argv[3] || `${process.env.HOME}/.openclaw/workspace/itw_v2_final.png`;

decodeV2(input, output).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
