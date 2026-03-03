/**
 * ITW V2 - Variable length with symbol 13 as most common (1-bit)
 */

import * as fs from 'fs';
import sharp from 'sharp';

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

function decodeVarLen(stream: Buffer): number[] {
  const count = stream.readUInt32LE(0);
  
  // Get symbols and sort by frequency
  const entries: Array<{ symbol: number; freq: number }> = [];
  let prevCum = 0;
  for (let i = 0; i < count; i++) {
    const symbol = stream.readUInt32LE(4 + i * 8);
    const cumInt = stream.readUInt32LE(4 + i * 8 + 4);
    entries.push({ symbol, freq: cumInt - prevCum });
    prevCum = cumInt;
  }
  
  // Sort by frequency descending
  const sorted = [...entries].sort((a, b) => b.freq - a.freq);
  const symbols = sorted.map(e => e.symbol);
  
  const maxSym = stream.readUInt32LE(4 + count * 8);
  const dataStart = 4 + count * 8 + 4;
  
  const output: number[] = [];
  let pos = dataStart;
  let bitPos = 0;
  
  function readBit(): number {
    if (pos >= stream.length) return 0;
    const bit = (stream[pos] >> bitPos) & 1;
    bitPos++;
    if (bitPos === 8) { bitPos = 0; pos++; }
    return bit;
  }
  
  // Simple variable length scheme:
  // 0 → symbol[0] (most common)
  // 10 → symbol[1]
  // 110 → symbol[2]
  // 1110 → symbol[3]
  // etc.
  // Or with 4-bit suffix: 1111xxxx → symbol[4+xxxx]
  
  while (output.length < maxSym && pos < stream.length) {
    let idx = 0;
    
    // Count leading 1s
    while (readBit() === 1 && idx < 14) {
      idx++;
    }
    
    // If we hit 14 ones, read 4 more bits for extended index
    if (idx >= 14) {
      idx = 14;
      for (let i = 0; i < 4; i++) {
        idx += readBit() << i;
      }
    }
    
    if (idx < symbols.length) {
      output.push(symbols[idx]);
    }
  }
  
  return output;
}

async function main() {
  const buf = fs.readFileSync(process.argv[2] || `${process.env.HOME}/Documents/tis/GRAFIK/10/28/74.ITW`);
  const data = parseV2(buf);
  
  console.log('=== ITW V2 VarLen Decoder ===');
  console.log(`Image: ${data.width}×${data.height}`);
  
  const dec1 = decodeVarLen(data.stream1);
  const dec2 = decodeVarLen(data.stream2);
  
  console.log(`Decoded1: ${dec1.length}`);
  console.log(`Decoded2: ${dec2.length}`);
  
  // Distribution
  const dist: Record<number, number> = {};
  for (const s of dec1.slice(0, 5000)) dist[s] = (dist[s] || 0) + 1;
  console.log('Dist:', Object.entries(dist).sort((a,b) => b[1] - a[1]).slice(0, 8).map(([k,v]) => `${k}:${v}`).join(' '));
  
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
  
  const outPath = process.argv[3] || `${process.env.HOME}/.openclaw/workspace/itw_v2_varlen.png`;
  await sharp(output, { raw: { width: data.width, height: data.height, channels: 1 } })
    .png().toFile(outPath);
  
  console.log('Saved:', outPath);
}

main().catch(e => console.error(e.message));
