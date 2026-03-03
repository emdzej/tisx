/**
 * ITW V2 - Simplified Huffman with canonical codes
 * 
 * Assuming entries are sorted by frequency, generate canonical codes
 */

import * as fs from 'fs';
import sharp from 'sharp';

interface DictEntry {
  symbol: number;
  cumFreq: number;
  freq: number;
}

function parseDict(stream: Buffer): { entries: DictEntry[]; maxSym: number; dataStart: number } {
  const entryCount = stream.readUInt32LE(0);
  const entries: DictEntry[] = [];
  let prevCum = 0;
  
  for (let i = 0; i < entryCount; i++) {
    const symbol = stream.readUInt32LE(4 + i * 8);
    const cumFreq = stream.readUInt32LE(4 + i * 8 + 4);
    const freq = cumFreq - prevCum;
    entries.push({ symbol, cumFreq, freq });
    prevCum = cumFreq;
  }
  
  const maxSym = stream.readUInt32LE(4 + entryCount * 8);
  return { entries, maxSym, dataStart: 4 + entryCount * 8 + 4 };
}

// Build lookup table for bit patterns
function buildLookup(entries: DictEntry[]): Map<number, { symbol: number; bits: number }> {
  // Sort by frequency descending (most frequent = shortest code)
  const sorted = [...entries].sort((a, b) => b.freq - a.freq);
  
  const lookup = new Map<number, { symbol: number; bits: number }>();
  
  // Assign codes - canonical Huffman style
  // For n symbols, use ceil(log2(n)) bits minimum
  const n = entries.length;
  const maxBits = Math.ceil(Math.log2(n)) + 2;  // Some extra for safety
  
  // Simple assignment: first symbol = 0, second = 1, etc. with variable lengths
  // This is a simplification - real Huffman would use frequency-based lengths
  
  for (let bits = 1; bits <= maxBits; bits++) {
    const maxCode = 1 << bits;
    if (maxCode >= n) {
      // Assign codes
      for (let i = 0; i < n; i++) {
        lookup.set((i << 8) | bits, { symbol: sorted[i].symbol, bits });
      }
      break;
    }
  }
  
  return lookup;
}

// Simple bit-by-bit decode
function decode(stream: Buffer, start: number, entries: DictEntry[], maxSym: number): number[] {
  const output: number[] = [];
  
  // Build sorted symbol list by frequency
  const sorted = [...entries].sort((a, b) => b.freq - a.freq);
  const n = entries.length;
  const codeBits = Math.ceil(Math.log2(n));
  
  let pos = start;
  let bitPos = 0;
  
  while (output.length < maxSym && pos < stream.length) {
    // Read codeBits bits
    let code = 0;
    for (let i = 0; i < codeBits && pos < stream.length; i++) {
      const bit = (stream[pos] >> bitPos) & 1;
      code |= bit << i;
      bitPos++;
      if (bitPos === 8) { bitPos = 0; pos++; }
    }
    
    if (code < n) {
      output.push(sorted[code].symbol);
    }
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
  
  return {
    width: buf.readUInt16BE(6),
    height: buf.readUInt16BE(8),
    palette,
    stream1,
    stream2
  };
}

async function main() {
  const inputPath = process.argv[2] || `${process.env.HOME}/Documents/tis/GRAFIK/10/28/74.ITW`;
  const outputPath = process.argv[3] || `${process.env.HOME}/.openclaw/workspace/itw_v2_simple.png`;
  
  console.log('=== ITW V2 Simple Decoder ===');
  
  const buf = fs.readFileSync(inputPath);
  const data = parseV2(buf);
  
  console.log(`Image: ${data.width}×${data.height}`);
  console.log(`Palette: [${data.palette.join(', ')}]`);
  
  const dict1 = parseDict(data.stream1);
  const dict2 = parseDict(data.stream2);
  
  console.log(`\nDict1: ${dict1.entries.length} entries, max=${dict1.maxSym}`);
  console.log(`Dict2: ${dict2.entries.length} entries, max=${dict2.maxSym}`);
  
  console.log('\nDict1 entries (sorted by freq):');
  const sorted1 = [...dict1.entries].sort((a, b) => b.freq - a.freq);
  sorted1.forEach((e, i) => console.log(`  [${i}] sym=${e.symbol} freq=${e.freq}`));
  
  // Try simple decode
  console.log('\nDecoding with', Math.ceil(Math.log2(dict1.entries.length)), 'bits per symbol...');
  const dec1 = decode(data.stream1, dict1.dataStart, dict1.entries, dict1.maxSym);
  const dec2 = decode(data.stream2, dict2.dataStart, dict2.entries, dict2.maxSym);
  
  console.log(`Decoded1: ${dec1.length}/${dict1.maxSym}`);
  console.log(`Decoded2: ${dec2.length}/${dict2.maxSym}`);
  
  // First 20 symbols
  console.log('First 20 dec1:', dec1.slice(0, 20));
  
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
