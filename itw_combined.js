#!/usr/bin/env node
/**
 * ITW V1 - Combined S4 (direct) + S0+S1 (sparse) at L3
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

// Zigzag decode
function zigzag(v) {
  return (v & 1) ? -((v >> 1) + 1) : (v >> 1);
}

// Decode sparse subband
function decodeSparse(s0, s1, width, height, quantStep) {
  const subband = new Float32Array(width * height);
  const reader = new BitReader(s1);
  
  const limit = Math.min(s0.length, subband.length);
  let coeffCount = 0;
  
  for (let i = 0; i < limit; i++) {
    const byte = s0[i];
    if (byte === 0) continue;
    
    const hasExtra = (byte & 0x80) !== 0;
    const bitCount = byte & 0x7f;
    
    let extraBits = 0;
    if (hasExtra) {
      extraBits = reader.readBits(4);
    }
    
    if (bitCount > 0 && bitCount <= 16) {
      const raw = reader.readBits(bitCount);
      const signBit = 1 << (bitCount - 1);
      const value = (raw & signBit) ? raw - (1 << bitCount) : raw;
      const scaleFactor = (16 - extraBits) * 0.0625;
      subband[i] = value * quantStep / Math.max(scaleFactor, 0.1);
      coeffCount++;
    }
  }
  
  return { subband, count: coeffCount };
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
  const l3W = Math.ceil(width / 8), l3H = Math.ceil(height / 8);
  
  // LL4 from S16
  const ll4 = new Float32Array(l4W * l4H);
  for (let i = 0; i < streams[16].length && i < ll4.length; i++) {
    ll4[i] = streams[16][i];
  }
  console.log(`LL4: ${l4W}x${l4H}`);
  
  // S4 direct L3 detail (zigzag encoded)
  const s4 = streams[4];
  const directL3 = new Float32Array(l3W * l3H);
  for (let i = 0; i < Math.min(s4.length, directL3.length); i++) {
    if (s4[i] > 0 && s4[i] < 30) {  // Filter outliers
      directL3[i] = zigzag(s4[i]) * 2;
    }
  }
  console.log(`S4 direct L3: ${s4.length} bytes`);
  
  // S0+S1 sparse L3 detail
  const { subband: sparseL3, count } = decodeSparse(streams[0], streams[1], l3W, l3H, 2);
  console.log(`S0+S1 sparse L3: ${count} coefficients`);
  
  // Reconstruct
  let current = bilinear(ll4, l4W, l4H, l3W, l3H);
  
  // Add both L3 details
  for (let i = 0; i < current.length; i++) {
    current[i] += directL3[i] * 0.5;
    current[i] += sparseL3[i] * 0.3;
  }
  
  // Upscale
  current = bilinear(current, l3W, l3H, width, height);
  
  // Normalize
  let min = Infinity, max = -Infinity;
  for (const v of current) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  console.log(`Value range: ${min.toFixed(1)} to ${max.toFixed(1)}`);
  
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
const output = process.argv[3] || '/tmp/itw_combined.png';
decodeITW(input, output);
