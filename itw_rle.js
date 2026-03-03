#!/usr/bin/env node
/**
 * ITW V1 - RLE position stream interpretation
 * 
 * S0 encodes positions via run-length:
 * - byte=0: zero coefficient at next position, advance by 1
 * - byte>0: coefficient exists, skip (byte & 0x7f) positions, place coeff
 * - bit 7: extra data flag (read 4 bits from S1 for precision)
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
 * Decode sparse subband with RLE positions
 */
function decodeRLE(s0, s1, width, height, quantStep) {
  const subband = new Float32Array(width * height);
  const reader = new BitReader(s1);
  
  let outputPos = 0;
  let coeffCount = 0;
  
  for (let i = 0; i < s0.length && outputPos < subband.length; i++) {
    const byte = s0[i];
    
    if (byte === 0) {
      // Zero coefficient, advance by 1
      outputPos++;
    } else {
      // Non-zero: skip (value & 0x7f), then place coefficient
      const hasExtra = (byte & 0x80) !== 0;
      const skip = byte & 0x7f;
      
      // Skip positions
      outputPos += skip;
      
      if (outputPos < subband.length) {
        // Read coefficient
        let bitCount = 4;  // Default
        if (hasExtra) {
          bitCount = reader.readBits(4) + 4;  // Extra precision
        }
        
        const raw = reader.readBits(bitCount);
        // Sign extend
        const signBit = 1 << (bitCount - 1);
        const value = (raw & signBit) ? raw - (1 << bitCount) : raw;
        
        subband[outputPos] = value * quantStep;
        coeffCount++;
        outputPos++;
      }
    }
  }
  
  console.log(`  Decoded ${coeffCount} coefficients, final pos=${outputPos}/${subband.length}`);
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
  const l1W = Math.ceil(width / 2), l1H = Math.ceil(height / 2);
  
  // LL4 from S16
  const ll4 = new Float32Array(l4W * l4H);
  for (let i = 0; i < streams[16].length && i < ll4.length; i++) {
    ll4[i] = streams[16][i];
  }
  console.log(`LL4: ${l4W}x${l4H}`);
  
  // Decode L1 subbands
  console.log(`\nDecoding LH1 (S0+S1):`);
  const lh1 = decodeRLE(streams[0], streams[1], l1W, l1H, 8);
  
  console.log(`\nDecoding HL1 (S2+S3):`);
  const hl1 = decodeRLE(streams[2], streams[3], l1W, l1H, 8);
  
  // Stats
  let nonZeroLH = 0, nonZeroHL = 0;
  for (const v of lh1) if (v !== 0) nonZeroLH++;
  for (const v of hl1) if (v !== 0) nonZeroHL++;
  console.log(`\nNon-zero: LH1=${nonZeroLH}, HL1=${nonZeroHL}`);
  
  // Reconstruct
  let current = bilinear(ll4, l4W, l4H, l1W, l1H);
  
  // Add details (conservative scale)
  for (let i = 0; i < current.length; i++) {
    current[i] += (lh1[i] + hl1[i]) * 0.02;
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
const output = process.argv[3] || '/tmp/itw_rle.png';
decodeITW(input, output);
