#!/usr/bin/env node
/**
 * ITW V1 - Simple bit count interpretation
 * 
 * Hypothesis: S0 value (masked) = number of bits to read from S1
 * S0[i] = 0 means zero coefficient
 * S0[i] = N means read N bits from S1 for coefficient value
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import sharp from 'sharp';

class BitReader {
  constructor(data) {
    this.data = data;
    this.bytePos = 0;
    this.bitPos = 0;
  }
  
  readBits(n) {
    let value = 0;
    for (let i = 0; i < n; i++) {
      if (this.bytePos >= this.data.length) return value;
      const bit = (this.data[this.bytePos] >> this.bitPos) & 1;
      value |= bit << i;
      this.bitPos++;
      if (this.bitPos === 8) {
        this.bitPos = 0;
        this.bytePos++;
      }
    }
    return value;
  }
  
  bitsConsumed() {
    return this.bytePos * 8 + this.bitPos;
  }
}

function findZlibStreams(data) {
  const streams = [];
  let pos = 0;
  while (pos < data.length - 10) {
    let found = false;
    for (let i = pos; i < data.length - 2 && !found; i++) {
      if (data[i] === 0x78 && (data[i+1] === 0x9c || data[i+1] === 0xda)) {
        try {
          const dec = zlib.inflateSync(data.subarray(i));
          streams.push(dec);
          pos = i + 10;
          found = true;
        } catch {}
      }
    }
    if (!found) break;
  }
  return streams;
}

function bilinear(src, srcW, srcH, dstW, dstH) {
  const dst = new Float32Array(dstW * dstH);
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcX = (x * (srcW - 1)) / Math.max(1, dstW - 1);
      const srcY = (y * (srcH - 1)) / Math.max(1, dstH - 1);
      const x0 = Math.floor(srcX), y0 = Math.floor(srcY);
      const x1 = Math.min(x0 + 1, srcW - 1), y1 = Math.min(y0 + 1, srcH - 1);
      const xf = srcX - x0, yf = srcY - y0;
      dst[y * dstW + x] = 
        src[y0 * srcW + x0] * (1-xf) * (1-yf) +
        src[y0 * srcW + x1] * xf * (1-yf) +
        src[y1 * srcW + x0] * (1-xf) * yf +
        src[y1 * srcW + x1] * xf * yf;
    }
  }
  return dst;
}

/**
 * Decode sparse subband
 * S0: coefficient map - S0[i]=0 means zero, S0[i]=N means read N bits
 * S1: coefficient bit stream
 */
function decodeSparse(s0, s1, width, height, quantStep) {
  const subband = new Float32Array(width * height);
  const reader = new BitReader(s1);
  
  // S0 is a coefficient map: each byte maps to one subband position
  // S0[i] = 0: zero coefficient at position i
  // S0[i] = N (with bit 7 cleared): read N bits for coefficient at position i
  // If bit 7 set: read 4 extra bits first
  
  let coeffCount = 0;
  const limit = Math.min(s0.length, subband.length);
  
  for (let i = 0; i < limit; i++) {
    const byte = s0[i];
    
    if (byte === 0) {
      // Zero coefficient
      continue;
    }
    
    const hasExtra = (byte & 0x80) !== 0;
    const bitCount = byte & 0x7f;
    
    // Read extra bits if flagged
    let extraBits = 0;
    if (hasExtra) {
      extraBits = reader.readBits(4);
    }
    
    // Read coefficient bits
    if (bitCount > 0 && bitCount <= 16) {
      const raw = reader.readBits(bitCount);
      
      // Sign extend (high bit is sign)
      const signBit = 1 << (bitCount - 1);
      const value = (raw & signBit) ? raw - (1 << bitCount) : raw;
      
      // Dequantization: (16 - extra) * 0.0625 as scale factor
      const scaleFactor = (16 - extraBits) * 0.0625;  // 0.0625 to 1.0
      const dequant = value * quantStep / Math.max(scaleFactor, 0.1);
      
      subband[i] = dequant;  // Place at position i, not outputPos
      coeffCount++;
    }
  }
  
  console.log(`  Coefficients: ${coeffCount}, bits consumed: ${reader.bitsConsumed()}/${s1.length * 8}`);
  return subband;
}

async function decodeITW(inputPath, outputPath) {
  const buf = fs.readFileSync(inputPath);
  
  const magic = buf.toString('ascii', 0, 4);
  if (magic !== 'ITW_') throw new Error('Not ITW');
  
  const width = buf.readUInt16BE(6);
  const height = buf.readUInt16BE(8);
  console.log(`ITW: ${width}x${height}`);
  
  const streams = findZlibStreams(buf.subarray(20));
  console.log(`Found ${streams.length} streams`);
  
  const l4W = Math.ceil(width / 16), l4H = Math.ceil(height / 16);
  const l1W = Math.ceil(width / 2), l1H = Math.ceil(height / 2);
  
  // LL4
  const ll4 = new Float32Array(l4W * l4H);
  for (let i = 0; i < streams[16].length && i < ll4.length; i++) {
    ll4[i] = streams[16][i];
  }
  console.log(`LL4: ${l4W}x${l4H}`);
  
  // Decode at L3 level (S0 size suggests L3)
  const l3W = Math.ceil(width / 8), l3H = Math.ceil(height / 8);
  console.log(`L3: ${l3W}x${l3H} = ${l3W*l3H}`);
  
  console.log(`\nDecoding L3 detail (S0+S1):`);
  console.log(`  S0: ${streams[0].length} bytes, S1: ${streams[1].length} bytes`);
  const detail3 = decodeSparse(streams[0], streams[1], l3W, l3H, 2);  // L3 quantStep=2
  
  // Stats
  let nonZero = 0, minV = 0, maxV = 0;
  for (const v of detail3) {
    if (v !== 0) {
      nonZero++;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }
  console.log(`  Non-zero: ${nonZero}, range: ${minV} to ${maxV}`);
  
  // Reconstruct
  let current = bilinear(ll4, l4W, l4H, l3W, l3H);
  
  // Add L3 detail
  for (let i = 0; i < Math.min(current.length, detail3.length); i++) {
    current[i] += detail3[i] * 0.5;  // Scale factor
  }
  
  // Upscale to full
  current = bilinear(current, l3W, l3H, width, height);
  
  // Normalize
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < width * height; i++) {
    if (current[i] < min) min = current[i];
    if (current[i] > max) max = current[i];
  }
  console.log(`\nValue range: ${min.toFixed(1)} to ${max.toFixed(1)}`);
  
  // Output
  const pixels = Buffer.alloc(width * height);
  const range = max - min || 1;
  for (let i = 0; i < width * height; i++) {
    const norm = (current[i] - min) * 255 / range;
    pixels[i] = 255 - Math.round(Math.max(0, Math.min(255, norm)));
  }
  
  await sharp(pixels, { raw: { width, height, channels: 1 } })
    .png()
    .toFile(outputPath);
  
  console.log(`Saved: ${outputPath}`);
}

const input = process.argv[2];
const output = process.argv[3] || '/tmp/itw_simple.png';
decodeITW(input, output);
