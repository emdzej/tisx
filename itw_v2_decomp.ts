/**
 * ITW V2 Decoder - Direct translation from tis.exe decompilation
 * 
 * Based on FUN_004b57f0 and related functions
 * 
 * V2 Format (0x0400):
 * - Header: ITW_ + version + dimensions
 * - 1 byte: palette/codebook size
 * - N bytes: palette entries  
 * - 4 bytes BE: stream1 size
 * - stream1 data (LZW compressed)
 * - 4 bytes BE: stream2 size
 * - stream2 data (LZW compressed)
 */

import * as fs from 'fs';
import sharp from 'sharp';

// ============= Buffer/Array helpers (FUN_004b67d0, FUN_004b6940, etc.) =============

class DynamicBuffer {
  data: number[] = [];
  
  push(value: number): void {
    this.data.push(value & 0xff);
  }
  
  get(index: number): number {
    return this.data[index] ?? 0;
  }
  
  get length(): number {
    return this.data.length;
  }
}

// ============= LZW Tree Node =============

interface LzwNode {
  isLeaf: boolean;
  value: number;
  left: number;   // index to left child
  right: number;  // index to right child
}

class LzwTree {
  nodes: LzwNode[] = [];
  root: number = 0;
  
  constructor() {
    // Initialize with root node
    this.root = this.addNode(false, 0);
  }
  
  addNode(isLeaf: boolean, value: number): number {
    const index = this.nodes.length;
    this.nodes.push({ isLeaf, value, left: -1, right: -1 });
    return index;
  }
  
  getNode(index: number): LzwNode | null {
    return this.nodes[index] ?? null;
  }
}

// ============= V2 Header Parser =============

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

// ============= Stream Reader =============

class StreamReader {
  private buffer: Buffer;
  private pos: number;
  
  constructor(buffer: Buffer, startPos: number = 0) {
    this.buffer = buffer;
    this.pos = startPos;
  }
  
  readByte(): number {
    if (this.pos >= this.buffer.length) return 0;
    return this.buffer[this.pos++];
  }
  
  readUInt32BE(): number {
    const b0 = this.readByte();
    const b1 = this.readByte();
    const b2 = this.readByte();
    const b3 = this.readByte();
    return (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;
  }
  
  readUInt16BE(): number {
    const b0 = this.readByte();
    const b1 = this.readByte();
    return (b0 << 8) | b1;
  }
  
  readBytes(count: number): Buffer {
    const result = this.buffer.subarray(this.pos, this.pos + count);
    this.pos += count;
    return result;
  }
  
  get position(): number {
    return this.pos;
  }
  
  get remaining(): number {
    return this.buffer.length - this.pos;
  }
}

// ============= FUN_004b5a40: Read V2 data streams =============

interface V2Streams {
  paletteSize: number;
  palette: number[];
  stream1: Buffer;
  stream2: Buffer;
}

function readV2Streams(buffer: Buffer, dataOffset: number): V2Streams {
  const reader = new StreamReader(buffer, dataOffset);
  
  // Read palette size (1 byte)
  const paletteSize = reader.readByte();
  console.log(`  Palette size: ${paletteSize}`);
  
  // Read palette entries
  const palette: number[] = [paletteSize];
  for (let i = 0; i < paletteSize; i++) {
    palette.push(reader.readByte());
  }
  
  // Read stream1 size (4 bytes) - FUN_004b5750 reads as two shorts concatenated
  const stream1SizeHi = reader.readUInt16BE();
  const stream1SizeLo = reader.readUInt16BE();
  const stream1Size = (stream1SizeHi << 16) | stream1SizeLo;
  console.log(`  Stream1 size: ${stream1Size} (hi=${stream1SizeHi}, lo=${stream1SizeLo})`);
  
  // Read stream1 data
  const stream1 = reader.readBytes(stream1Size);
  
  // Read stream2 size
  const stream2SizeHi = reader.readUInt16BE();
  const stream2SizeLo = reader.readUInt16BE();
  const stream2Size = (stream2SizeHi << 16) | stream2SizeLo;
  console.log(`  Stream2 size: ${stream2Size}`);
  
  // Read stream2 data
  const stream2 = reader.readBytes(stream2Size);
  
  console.log(`  Data consumed: ${reader.position - dataOffset} bytes`);
  
  return { paletteSize, palette, stream1, stream2 };
}

// ============= FUN_004b6340: Build LZW dictionary from stream =============

interface LzwDict {
  entries: Array<{ char: number; nextOffset: number }>;
  maxCode: number;
  dataStart: number;
}

function buildLzwDict(stream: Buffer): LzwDict {
  const reader = new StreamReader(stream);
  
  // Read entry count (4 bytes LE)
  const b0 = reader.readByte();
  const b1 = reader.readByte();
  const b2 = reader.readByte();
  const b3 = reader.readByte();
  const entryCount = b0 + (b1 << 8) + (b2 << 16) + (b3 << 24);
  
  console.log(`    Dict entry count: ${entryCount}`);
  
  const entries: Array<{ char: number; nextOffset: number }> = [];
  
  // Read dictionary entries (8 bytes each)
  for (let i = 0; i < entryCount; i++) {
    // Skip 4 bytes (unused in our simple implementation)
    reader.readByte();
    reader.readByte();
    reader.readByte();
    const char = reader.readByte();
    
    // Read next offset (4 bytes LE)
    const o0 = reader.readByte();
    const o1 = reader.readByte();
    const o2 = reader.readByte();
    const o3 = reader.readByte();
    const nextOffset = o0 + (o1 << 8) + (o2 << 16) + (o3 << 24);
    
    entries.push({ char, nextOffset });
  }
  
  // Read max code (4 bytes LE)
  const m0 = reader.readByte();
  const m1 = reader.readByte();
  const m2 = reader.readByte();
  const m3 = reader.readByte();
  const maxCode = m0 + (m1 << 8) + (m2 << 16) + (m3 << 24);
  
  console.log(`    Max code: ${maxCode}, data starts at: ${reader.position}`);
  
  return { entries, maxCode, dataStart: reader.position };
}

// ============= FUN_004b6250: LZW decode =============

function lzwDecode(stream: Buffer, dict: LzwDict): number[] {
  const output: number[] = [];
  const reader = new StreamReader(stream, dict.dataStart);
  
  // Simple bit-by-bit LZW decode based on FUN_004b6250
  // This is a tree traversal where each bit chooses left/right
  
  let codeIndex = 0;  // Start at root of tree
  
  while (reader.remaining > 0 && output.length < dict.maxCode) {
    const byte = reader.readByte();
    
    // Process 8 bits
    for (let bit = 0; bit < 8 && output.length < dict.maxCode; bit++) {
      const direction = (byte >> bit) & 1;
      
      if (codeIndex < dict.entries.length) {
        const entry = dict.entries[codeIndex];
        
        // Output character and follow next pointer
        if (entry.char !== 0 || entry.nextOffset === 0) {
          output.push(entry.char);
          codeIndex = 0;  // Reset to root
        } else {
          // Navigate tree based on bit
          codeIndex = direction === 0 ? codeIndex * 2 + 1 : codeIndex * 2 + 2;
          if (codeIndex >= dict.entries.length) {
            codeIndex = 0;
          }
        }
      }
    }
  }
  
  return output;
}

// ============= Simple RLE decode (alternative interpretation) =============

function simpleRleDecode(stream: Buffer, expectedSize: number): number[] {
  const output: number[] = [];
  let i = 0;
  
  while (i < stream.length && output.length < expectedSize) {
    const byte = stream[i++];
    
    if (byte === 0 && i < stream.length) {
      // RLE: 0x00 followed by count and value
      const count = stream[i++] || 1;
      const value = stream[i++] || 0;
      for (let j = 0; j < count && output.length < expectedSize; j++) {
        output.push(value);
      }
    } else {
      output.push(byte);
    }
  }
  
  return output;
}

// ============= Direct copy (simplest interpretation) =============

function directDecode(stream1: Buffer, stream2: Buffer, width: number, height: number, palette: number[]): Buffer {
  const output = Buffer.alloc(width * height);
  const paletteSize = palette[0];
  
  // Try direct interleave of stream1 and stream2
  let outIdx = 0;
  let s1Idx = 0;
  let s2Idx = 0;
  
  while (outIdx < output.length) {
    if (s1Idx < stream1.length) {
      const val = stream1[s1Idx++];
      // Apply palette lookup if within range
      if (paletteSize > 0 && val < paletteSize) {
        output[outIdx++] = palette[val + 1] || val;
      } else {
        output[outIdx++] = val;
      }
    }
    
    if (outIdx < output.length && s2Idx < stream2.length) {
      const val = stream2[s2Idx++];
      if (paletteSize > 0 && val < paletteSize) {
        output[outIdx++] = palette[val + 1] || val;
      } else {
        output[outIdx++] = val;
      }
    }
    
    // Prevent infinite loop
    if (s1Idx >= stream1.length && s2Idx >= stream2.length) break;
  }
  
  return output;
}

// ============= Main V2 decoder =============

async function decodeV2(inputPath: string, outputPath: string): Promise<void> {
  console.log(`Decoding V2: ${inputPath}`);
  
  const buffer = fs.readFileSync(inputPath);
  const header = parseV2Header(buffer);
  
  console.log(`Header: ${header.width}×${header.height}, version=${header.version}, bpp=${header.bpp}`);
  
  if (header.magic !== 'ITW_') {
    throw new Error('Not an ITW file');
  }
  
  if (header.version !== 2) {
    throw new Error(`Not V2 format (got version ${header.version})`);
  }
  
  // Data starts after header (offset 0x10 or calculated)
  const dataOffset = 14;  // After magic(4) + version(1) + skip(1) + width(2) + height(2) + bpp(2) + extra(2)
  
  console.log(`\nReading streams from offset ${dataOffset}:`);
  const streams = readV2Streams(buffer, dataOffset);
  
  console.log(`\nStream1 first 20 bytes:`, [...streams.stream1.subarray(0, 20)]);
  console.log(`Stream2 first 20 bytes:`, [...streams.stream2.subarray(0, 20)]);
  
  // Try different decode strategies
  const { width, height } = header;
  const totalPixels = width * height;
  
  console.log(`\nTarget size: ${totalPixels} pixels`);
  
  // Strategy 1: Direct copy with interleave
  console.log(`\nTrying direct decode...`);
  const pixels = directDecode(streams.stream1, streams.stream2, width, height, streams.palette);
  
  // Save
  await sharp(pixels, { raw: { width, height, channels: 1 } })
    .png()
    .toFile(outputPath);
  
  console.log(`\nSaved: ${outputPath}`);
}

// ============= CLI =============

const inputPath = process.argv[2] || `${process.env.HOME}/Documents/tis/GRAFIK/10/28/74.ITW`;
const outputPath = process.argv[3] || `${process.env.HOME}/.openclaw/workspace/itw_v2_test.png`;

decodeV2(inputPath, outputPath).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
