/**
 * ITW V2 Decoder - Range/Arithmetic Coding
 * 
 * Based on decompiled tis.exe - FUN_004b57f0
 * Uses cumulative frequency table for range decoding
 */

import * as fs from 'fs';
import sharp from 'sharp';

interface RangeEntry {
  symbol: number;
  cumFreq: number;
}

interface RangeDict {
  entries: RangeEntry[];
  totalRange: number;
  maxSymbols: number;
  dataStart: number;
}

function parseRangeDict(stream: Buffer): RangeDict {
  let pos = 0;
  const entryCount = stream.readUInt32LE(pos); pos += 4;
  
  const entries: RangeEntry[] = [];
  for (let i = 0; i < entryCount && pos + 8 <= stream.length; i++) {
    const symbol = stream.readUInt32LE(pos);
    const cumFreq = stream.readUInt32LE(pos + 4);
    entries.push({ symbol, cumFreq });
    pos += 8;
  }
  
  const totalRange = entries.length > 0 ? entries[entries.length - 1].cumFreq : 0;
  const maxSymbols = stream.readUInt32LE(pos); pos += 4;
  
  return { entries, totalRange, maxSymbols, dataStart: pos };
}

// Range decode - find symbol for a given value in range
function findSymbol(entries: RangeEntry[], value: number): { symbol: number; low: number; high: number } | null {
  let low = 0;
  for (const entry of entries) {
    if (value < entry.cumFreq) {
      return { symbol: entry.symbol, low, high: entry.cumFreq };
    }
    low = entry.cumFreq;
  }
  return null;
}

// Simple range decoder
function rangeDecode(stream: Buffer, start: number, dict: RangeDict): number[] {
  const output: number[] = [];
  let pos = start;
  
  // Read initial code value (32-bit)
  if (pos + 4 > stream.length) return output;
  let code = stream.readUInt32LE(pos); pos += 4;
  
  let low = 0;
  let high = 0xFFFFFFFF;
  const total = dict.totalRange;
  
  while (output.length < dict.maxSymbols && pos < stream.length) {
    // Scale code to range
    const range = high - low;
    const scaled = Math.floor(((code - low) * total) / range);
    
    // Find symbol
    const result = findSymbol(dict.entries, scaled);
    if (!result) break;
    
    output.push(result.symbol);
    
    // Update range
    high = low + Math.floor((range * result.high) / total);
    low = low + Math.floor((range * result.low) / total);
    
    // Renormalize
    while (true) {
      if ((high ^ low) < 0x01000000) {
        // Top byte matches, shift out
        code = ((code << 8) | stream[pos++]) >>> 0;
        low = (low << 8) >>> 0;
        high = ((high << 8) | 0xFF) >>> 0;
      } else if ((low & 0xFF000000) >= 0x01000000 && (high & 0xFF000000) < 0xFF000000) {
        // Underflow
        code = ((code ^ 0x80000000) << 8 | stream[pos++]) >>> 0;
        low = ((low ^ 0x80000000) << 8) >>> 0;
        high = (((high ^ 0x80000000) << 8) | 0xFF) >>> 0;
      } else {
        break;
      }
      
      if (pos >= stream.length) break;
    }
  }
  
  return output;
}

// Parse V2 file
function parseV2(buffer: Buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'ITW_' || buffer[4] !== 2) {
    throw new Error('Not V2 ITW');
  }
  
  const width = buffer.readUInt16BE(6);
  const height = buffer.readUInt16BE(8);
  
  let pos = 14;
  const paletteSize = buffer[pos++];
  const palette: number[] = [];
  for (let i = 0; i < paletteSize; i++) palette.push(buffer[pos++]);
  
  const s1Size = (buffer.readUInt16BE(pos) << 16) | buffer.readUInt16BE(pos + 2);
  pos += 4;
  const stream1 = buffer.subarray(pos, pos + s1Size);
  pos += s1Size;
  
  const s2Size = (buffer.readUInt16BE(pos) << 16) | buffer.readUInt16BE(pos + 2);
  pos += 4;
  const stream2 = buffer.subarray(pos, pos + s2Size);
  
  return { width, height, palette, stream1, stream2 };
}

async function decodeV2(inputPath: string, outputPath: string) {
  console.log('=== ITW V2 Range Decoder ===');
  
  const buffer = fs.readFileSync(inputPath);
  const data = parseV2(buffer);
  
  console.log(`Image: ${data.width}×${data.height}`);
  console.log(`Palette: [${data.palette.join(', ')}]`);
  
  const dict1 = parseRangeDict(data.stream1);
  const dict2 = parseRangeDict(data.stream2);
  
  console.log(`\nDict1: ${dict1.entries.length} entries, total=${dict1.totalRange}, max=${dict1.maxSymbols}`);
  console.log(`Dict2: ${dict2.entries.length} entries, total=${dict2.totalRange}, max=${dict2.maxSymbols}`);
  
  // Try range decode
  console.log('\nRange decoding...');
  const dec1 = rangeDecode(data.stream1, dict1.dataStart, dict1);
  const dec2 = rangeDecode(data.stream2, dict2.dataStart, dict2);
  
  console.log(`Decoded1: ${dec1.length}/${dict1.maxSymbols}`);
  console.log(`Decoded2: ${dec2.length}/${dict2.maxSymbols}`);
  
  // Symbol distribution
  const symCount: Record<number, number> = {};
  for (const s of dec1) symCount[s] = (symCount[s] || 0) + 1;
  console.log('\nSymbol distribution:', Object.entries(symCount).slice(0, 10).map(([k,v]) => `${k}:${v}`).join(', '));
  
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
  
  console.log(`\nOutput: ${out}/${totalPixels}`);
  
  // Palette
  for (let i = 0; i < output.length; i++) {
    if (output[i] < data.palette.length) output[i] = data.palette[output[i]];
  }
  
  await sharp(output, { raw: { width: data.width, height: data.height, channels: 1 } })
    .png().toFile(outputPath);
  
  console.log('Saved:', outputPath);
}

decodeV2(
  process.argv[2] || `${process.env.HOME}/Documents/tis/GRAFIK/10/28/74.ITW`,
  process.argv[3] || `${process.env.HOME}/.openclaw/workspace/itw_v2_range.png`
).catch(e => console.error('Error:', e.message));
