/**
 * ITW V2 Decoder - Huffman-based (from tis.exe decompilation)
 * 
 * V2 uses Huffman coding, not standard LZW!
 * 
 * Format:
 * - Header: ITW_ + version(1) + skip(1) + width(2) + height(2) + bpp(2)
 * - Palette size (1 byte) + palette entries
 * - Stream1 size (4 bytes) + Huffman-compressed data
 * - Stream2 size (4 bytes) + Huffman-compressed data
 * - Streams are interleaved to produce final image
 */

import * as fs from 'fs';
import sharp from 'sharp';

// ============= Huffman Tree =============

interface HuffmanNode {
  isLeaf: boolean;
  symbol: number;
  left: number;   // child index
  right: number;  // child index
}

interface HuffmanTree {
  nodes: HuffmanNode[];
  root: number;
}

// ============= Parse Huffman dictionary from stream =============

interface HuffmanDict {
  symbols: Array<{ symbol: number; frequency: number }>;
  compressedDataStart: number;
  maxSymbols: number;
}

function parseHuffmanDict(stream: Buffer): HuffmanDict {
  let pos = 0;
  
  // Read entry count (4 bytes LE)
  const entryCount = stream.readUInt32LE(pos);
  pos += 4;
  
  console.log(`    Entry count: ${entryCount}`);
  
  const symbols: Array<{ symbol: number; frequency: number }> = [];
  
  // Read dictionary entries (8 bytes each based on FUN_004b6340)
  for (let i = 0; i < entryCount && pos + 8 <= stream.length; i++) {
    // Bytes 0-2: unused/padding
    // Byte 3: symbol value
    const symbol = stream[pos + 3];
    
    // Bytes 4-7: frequency (4 bytes LE)
    const frequency = stream.readUInt32LE(pos + 4);
    
    symbols.push({ symbol, frequency });
    pos += 8;
  }
  
  // Read max symbols count (4 bytes LE)
  const maxSymbols = stream.readUInt32LE(pos);
  pos += 4;
  
  console.log(`    Max symbols: ${maxSymbols}, data starts at: ${pos}`);
  
  return { symbols, compressedDataStart: pos, maxSymbols };
}

// ============= Build Huffman tree from frequency table =============

function buildHuffmanTree(symbols: Array<{ symbol: number; frequency: number }>): HuffmanTree {
  if (symbols.length === 0) {
    return { nodes: [{ isLeaf: true, symbol: 0, left: -1, right: -1 }], root: 0 };
  }
  
  // Create leaf nodes
  const nodes: HuffmanNode[] = [];
  const queue: Array<{ nodeIndex: number; frequency: number }> = [];
  
  for (const { symbol, frequency } of symbols) {
    const nodeIndex = nodes.length;
    nodes.push({ isLeaf: true, symbol, left: -1, right: -1 });
    queue.push({ nodeIndex, frequency });
  }
  
  // Sort by frequency (ascending)
  queue.sort((a, b) => a.frequency - b.frequency);
  
  // Build tree by combining lowest frequency nodes
  while (queue.length > 1) {
    const left = queue.shift()!;
    const right = queue.shift()!;
    
    const parentIndex = nodes.length;
    nodes.push({
      isLeaf: false,
      symbol: 0,
      left: left.nodeIndex,
      right: right.nodeIndex,
    });
    
    // Insert parent back into queue (sorted)
    const parentFreq = left.frequency + right.frequency;
    let inserted = false;
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].frequency >= parentFreq) {
        queue.splice(i, 0, { nodeIndex: parentIndex, frequency: parentFreq });
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      queue.push({ nodeIndex: parentIndex, frequency: parentFreq });
    }
  }
  
  const root = queue.length > 0 ? queue[0].nodeIndex : 0;
  return { nodes, root };
}

// ============= Huffman decode =============

function huffmanDecode(stream: Buffer, startPos: number, tree: HuffmanTree, maxSymbols: number): number[] {
  const output: number[] = [];
  let pos = startPos;
  let bitPos = 0;
  let currentNode = tree.root;
  
  while (output.length < maxSymbols && pos < stream.length) {
    // Read bit
    const bit = (stream[pos] >> bitPos) & 1;
    bitPos++;
    if (bitPos === 8) {
      bitPos = 0;
      pos++;
    }
    
    // Navigate tree
    const node = tree.nodes[currentNode];
    if (!node) break;
    
    if (node.isLeaf) {
      output.push(node.symbol);
      currentNode = tree.root;
    } else {
      currentNode = bit === 0 ? node.left : node.right;
      
      // Check if we landed on a leaf
      const nextNode = tree.nodes[currentNode];
      if (nextNode && nextNode.isLeaf) {
        output.push(nextNode.symbol);
        currentNode = tree.root;
      }
    }
  }
  
  return output;
}

// ============= V2 Header =============

interface V2Header {
  magic: string;
  version: number;
  width: number;
  height: number;
  bpp: number;
}

function parseV2Header(buffer: Buffer): V2Header {
  return {
    magic: buffer.toString('ascii', 0, 4),
    version: buffer.readUInt8(4),
    width: buffer.readUInt16BE(6),
    height: buffer.readUInt16BE(8),
    bpp: buffer.readUInt16BE(10),
  };
}

// ============= Read V2 streams =============

interface V2Streams {
  paletteSize: number;
  palette: number[];
  stream1: Buffer;
  stream2: Buffer;
}

function readV2Streams(buffer: Buffer, dataOffset: number): V2Streams {
  let pos = dataOffset;
  
  // Palette size (1 byte)
  const paletteSize = buffer[pos++];
  
  // Palette entries
  const palette: number[] = [];
  for (let i = 0; i < paletteSize; i++) {
    palette.push(buffer[pos++]);
  }
  
  // Stream1 size (2x uint16 BE = uint32)
  const s1Hi = buffer.readUInt16BE(pos); pos += 2;
  const s1Lo = buffer.readUInt16BE(pos); pos += 2;
  const stream1Size = (s1Hi << 16) | s1Lo;
  
  // Stream1 data
  const stream1 = buffer.subarray(pos, pos + stream1Size);
  pos += stream1Size;
  
  // Stream2 size
  const s2Hi = buffer.readUInt16BE(pos); pos += 2;
  const s2Lo = buffer.readUInt16BE(pos); pos += 2;
  const stream2Size = (s2Hi << 16) | s2Lo;
  
  // Stream2 data  
  const stream2 = buffer.subarray(pos, pos + stream2Size);
  
  return { paletteSize, palette, stream1, stream2 };
}

// ============= Main decoder based on FUN_004b57f0 =============

async function decodeV2(inputPath: string, outputPath: string): Promise<void> {
  console.log(`Decoding V2: ${inputPath}`);
  
  const buffer = fs.readFileSync(inputPath);
  const header = parseV2Header(buffer);
  
  console.log(`Header: ${header.width}×${header.height}, v${header.version}, ${header.bpp}bpp`);
  
  if (header.magic !== 'ITW_' || header.version !== 2) {
    throw new Error('Not V2 ITW file');
  }
  
  const { width, height } = header;
  const totalPixels = width * height;
  
  // Read streams
  console.log(`\nReading streams:`);
  const streams = readV2Streams(buffer, 14);
  console.log(`  Palette: ${streams.paletteSize} entries`);
  console.log(`  Stream1: ${streams.stream1.length} bytes`);
  console.log(`  Stream2: ${streams.stream2.length} bytes`);
  
  // Parse Huffman dictionaries
  console.log(`\nParsing stream1 dictionary:`);
  const dict1 = parseHuffmanDict(streams.stream1);
  
  console.log(`\nParsing stream2 dictionary:`);
  const dict2 = parseHuffmanDict(streams.stream2);
  
  // Build Huffman trees
  console.log(`\nBuilding Huffman trees:`);
  const tree1 = buildHuffmanTree(dict1.symbols);
  const tree2 = buildHuffmanTree(dict2.symbols);
  console.log(`  Tree1: ${tree1.nodes.length} nodes, root=${tree1.root}`);
  console.log(`  Tree2: ${tree2.nodes.length} nodes, root=${tree2.root}`);
  
  // Decode streams
  console.log(`\nDecoding:`);
  const decoded1 = huffmanDecode(streams.stream1, dict1.compressedDataStart, tree1, dict1.maxSymbols);
  const decoded2 = huffmanDecode(streams.stream2, dict2.compressedDataStart, tree2, dict2.maxSymbols);
  console.log(`  Stream1 decoded: ${decoded1.length} symbols`);
  console.log(`  Stream2 decoded: ${decoded2.length} symbols`);
  
  // Combine streams based on FUN_004b57f0 logic
  // The interleave logic from decompilation:
  // if (stream1[i] < paletteSize + 8) { use both streams } else { use stream1 only }
  
  const output = Buffer.alloc(totalPixels);
  let outIdx = 0;
  let s1Idx = 0;
  let s2Idx = 0;
  
  const threshold = streams.paletteSize + 8;
  
  while (outIdx < totalPixels && (s1Idx < decoded1.length || s2Idx < decoded2.length)) {
    if (s1Idx < decoded1.length) {
      const val1 = decoded1[s1Idx++];
      
      if (val1 < threshold && s2Idx < decoded2.length) {
        // Use value from stream2, then stream1
        output[outIdx++] = decoded2[s2Idx++];
        if (outIdx < totalPixels) {
          output[outIdx++] = val1;
        }
      } else {
        // Use only stream1
        output[outIdx++] = val1;
      }
    }
  }
  
  console.log(`  Output: ${outIdx} pixels`);
  
  // Apply palette if present
  if (streams.paletteSize > 0) {
    for (let i = 0; i < output.length; i++) {
      const val = output[i];
      if (val < streams.paletteSize) {
        output[i] = streams.palette[val];
      }
    }
  }
  
  // Save
  await sharp(output, { raw: { width, height, channels: 1 } })
    .png()
    .toFile(outputPath);
  
  console.log(`\nSaved: ${outputPath}`);
}

// CLI
const inputPath = process.argv[2] || `${process.env.HOME}/Documents/tis/GRAFIK/10/28/74.ITW`;
const outputPath = process.argv[3] || `${process.env.HOME}/.openclaw/workspace/itw_v2_huff.png`;

decodeV2(inputPath, outputPath).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
