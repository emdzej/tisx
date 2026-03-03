#!/usr/bin/env node
/**
 * ITW V1 Decoder - S0 as coefficient map
 * 
 * Discovery:
 * - S0: each byte indicates if there's a coefficient at that position
 *   - 0 = zero coefficient
 *   - >0 = coefficient exists, value might be bit count
 * - S1: bit stream of coefficient values
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import sharp from 'sharp';

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
 * Decode sparse subband using S0 as map and S1 as values
 */
function decodeSparse(s0, s1, width, height, quantStep) {
  const subband = new Float32Array(width * height);
  const reader = new BitReader(s1);
  
  // Count non-zeros in S0 for sizing
  let nonZeroCount = 0;
  for (const b of s0) if (b !== 0) nonZeroCount++;
  
  // S0 length should equal subband size
  const subbandSize = width * height;
  console.log(`  S0=${s0.length}, S1=${s1.length}, subband=${subbandSize}, nonzero=${nonZeroCount}`);
  
  // Try interpretation: S0[i] > 0 means coefficient at position i
  // S0[i] value could be bit count for reading from S1
  for (let i = 0; i < Math.min(s0.length, subbandSize); i++) {
    if (s0[i] > 0) {
      const bitCount = s0[i];
      if (bitCount > 0 && bitCount <= 16) {
        const raw = reader.readBits(bitCount);
        // Sign extend
        const signBit = 1 << (bitCount - 1);
        const value = (raw & signBit) ? raw - (1 << bitCount) : raw;
        subband[i] = value * quantStep;
      }
    }
  }
  
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
  
  // Level dimensions
  const l4W = Math.ceil(width / 16), l4H = Math.ceil(height / 16);
  const l3W = Math.ceil(width / 8), l3H = Math.ceil(height / 8);
  const l2W = Math.ceil(width / 4), l2H = Math.ceil(height / 4);
  const l1W = Math.ceil(width / 2), l1H = Math.ceil(height / 2);
  
  // LL4 from S16
  const ll4 = new Float32Array(l4W * l4H);
  for (let i = 0; i < streams[16].length && i < ll4.length; i++) {
    ll4[i] = streams[16][i];
  }
  console.log(`LL4: ${l4W}x${l4H}`);
  
  // Try decoding L1 sparse (S0+S1)
  console.log(`\nDecoding LH1 (S0+S1):`);
  const lh1 = decodeSparse(streams[0], streams[1], l1W, l1H, 8);
  
  // Stats
  let nonZero = 0, minV = Infinity, maxV = -Infinity;
  for (const v of lh1) {
    if (v !== 0) {
      nonZero++;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }
  console.log(`  Non-zero: ${nonZero}, range: ${minV} to ${maxV}`);
  
  // Reconstruct with bilinear + detail
  let current = bilinear(ll4, l4W, l4H, l1W, l1H);
  
  // Add detail if reasonable
  if (minV > -1000 && maxV < 1000 && nonZero > 100) {
    for (let i = 0; i < current.length; i++) {
      current[i] += lh1[i] * 0.1;  // Small scale
    }
    console.log(`Added LH1 detail (scaled 0.1)`);
  }
  
  // Upscale to full
  current = bilinear(current, l1W, l1H, width, height);
  
  // Normalize
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < width * height; i++) {
    if (current[i] < min) min = current[i];
    if (current[i] > max) max = current[i];
  }
  console.log(`\nValue range: ${min.toFixed(1)} to ${max.toFixed(1)}`);
  
  // Output (inverted)
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
const output = process.argv[3] || '/tmp/itw_sparse.png';
decodeITW(input, output);
