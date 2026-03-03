#!/usr/bin/env node
/**
 * ITW V1 Decoder - Direct from decompilation
 * 
 * Based on FUN_004b72b0 (sparse subband decode)
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import sharp from 'sharp';

// Probability value: prob(n) = 2n² + 2n + 1
function probValue(n) {
  return 2*n*n + 2*n + 1;
}

// Bit count from position value: ceil(log4(prob))
function positionToBitCount(posValue) {
  if (posValue === 0) return 0;
  const prob = probValue(posValue);
  return Math.ceil(Math.log(prob) / Math.log(4));
}

// Build bit count lookup table
const BIT_COUNT_TABLE = [];
for (let i = 0; i <= 127; i++) {
  BIT_COUNT_TABLE[i] = positionToBitCount(i);
}
console.log('Bit count table (0-10):', BIT_COUNT_TABLE.slice(0, 11));

class BitReader {
  constructor(data) {
    this.data = data;
    this.bytePos = 0;
    this.bitPos = 0;
  }
  
  readBits(n) {
    if (n <= 0) return 0;
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
  
  bitsUsed() {
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
 * Decode sparse subband - direct from FUN_004b72b0
 * 
 * @param posStream - S0: position bytes (_Count bytes)
 * @param valStream - S1: value bits
 * @param count - Number of coefficients (subband size)
 * @param quantStep - Quantization step
 * @param bitOffset - Starting bit offset in value stream
 * @returns {coeffs, bitsUsed}
 */
function decodeSparseSubband(posStream, valStream, count, quantStep, bitOffset = 0) {
  const coeffs = new Float32Array(count);
  const reader = new BitReader(valStream);
  
  // Skip to bit offset
  reader.bytePos = Math.floor(bitOffset / 8);
  reader.bitPos = bitOffset % 8;
  
  // Arrays for position, masked position, and extra bits
  const posArray = new Uint8Array(count);      // puVar3 - original position bytes
  const extraArray = new Uint8Array(count);    // puVar4 - extra 4-bit values
  const valueArray = new Int32Array(count);    // puVar2 - decoded values
  
  // Step 1: Read position bytes (masked) and extract extra bits
  // From decompilation: first pass reads position bytes, second reads extra bits
  
  const limit = Math.min(posStream.length, count);
  for (let i = 0; i < limit; i++) {
    posArray[i] = posStream[i];
  }
  
  // Step 2: Extract extra bits where flag is set
  for (let i = 0; i < limit; i++) {
    if ((posArray[i] & 0x80) !== 0) {
      extraArray[i] = reader.readBits(4);
    }
    posArray[i] &= 0x7f;  // Clear flag bit
  }
  
  console.log(`  After extra bits extraction: ${reader.bitsUsed() - bitOffset} bits used`);
  
  // Step 3: Read coefficient values
  // From decompilation: read _Count*5 bytes, then bit-read based on position value
  // But we only have the bit stream, so we read directly
  
  // The value stream after extra bits contains: coefficient magnitude for each non-zero position
  for (let i = 0; i < limit; i++) {
    const posValue = posArray[i];
    
    if (posValue === 0) {
      valueArray[i] = 0;
      continue;
    }
    
    // Get bit count from position value
    const bitCount = BIT_COUNT_TABLE[posValue];
    
    if (bitCount > 0) {
      const raw = reader.readBits(bitCount);
      
      // Sign extend (high bit is sign)
      const signBit = 1 << (bitCount - 1);
      const signed = (raw & signBit) ? raw - (1 << bitCount) : raw;
      
      // Dequantize with extra bits scaling
      const scaleFactor = (16 - extraArray[i]) * 0.0625;
      valueArray[i] = signed * quantStep / Math.max(scaleFactor, 0.1);
    }
  }
  
  const totalBitsUsed = reader.bitsUsed();
  console.log(`  Total bits used: ${totalBitsUsed - bitOffset} (offset ${bitOffset} → ${totalBitsUsed})`);
  
  // Copy to output
  for (let i = 0; i < limit; i++) {
    coeffs[i] = valueArray[i];
  }
  
  // Stats
  let nonZero = 0, minV = 0, maxV = 0;
  for (const v of coeffs) {
    if (v !== 0) {
      nonZero++;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }
  console.log(`  Non-zero: ${nonZero}, range: ${minV.toFixed(1)} to ${maxV.toFixed(1)}`);
  
  return { coeffs, bitsUsed: totalBitsUsed };
}

async function decodeITW(inputPath, outputPath) {
  const buf = fs.readFileSync(inputPath);
  
  const magic = buf.toString('ascii', 0, 4);
  if (magic !== 'ITW_') throw new Error('Not ITW');
  
  const width = buf.readUInt16BE(6);
  const height = buf.readUInt16BE(8);
  console.log(`ITW: ${width}x${height}`);
  
  const streams = findZlibStreams(buf.subarray(20));
  console.log(`Found ${streams.length} streams\n`);
  
  const l4W = Math.ceil(width / 16), l4H = Math.ceil(height / 16);
  const l3W = Math.ceil(width / 8), l3H = Math.ceil(height / 8);
  const l2W = Math.ceil(width / 4), l2H = Math.ceil(height / 4);
  const l1W = Math.ceil(width / 2), l1H = Math.ceil(height / 2);
  
  console.log(`Level dimensions:`);
  console.log(`  L4: ${l4W}×${l4H} = ${l4W * l4H}`);
  console.log(`  L3: ${l3W}×${l3H} = ${l3W * l3H}`);
  console.log(`  L2: ${l2W}×${l2H} = ${l2W * l2H}`);
  console.log(`  L1: ${l1W}×${l1H} = ${l1W * l1H}\n`);
  
  // LL4 from S16
  const ll4 = new Float32Array(l4W * l4H);
  for (let i = 0; i < streams[16].length && i < ll4.length; i++) {
    ll4[i] = streams[16][i];
  }
  console.log(`LL4 loaded from S16`);
  
  // Decode LH3 from S0 (first half) + S1
  console.log(`\nDecoding LH3 (S0[0:1200] + S1):`);
  const s0_lh3 = streams[0].slice(0, l3W * l3H);
  const { coeffs: lh3, bitsUsed: lh3Bits } = decodeSparseSubband(s0_lh3, streams[1], l3W * l3H, 2, 0);
  
  // Decode HL3 from S0 (second half) + rest of S1
  console.log(`\nDecoding HL3 (S0[1200:] + S1 continuing):`);
  const s0_hl3 = streams[0].slice(l3W * l3H);
  const { coeffs: hl3 } = decodeSparseSubband(s0_hl3, streams[1], Math.min(s0_hl3.length, l3W * l3H), 2, lh3Bits);
  
  // Try S2+S3 as L2 or HH3
  console.log(`\nDecoding from S2+S3:`);
  console.log(`  S2: ${streams[2].length} bytes, S3: ${streams[3].length} bytes`);
  const s2_first = streams[2].slice(0, l3W * l3H);
  const { coeffs: extra1, bitsUsed: extra1Bits } = decodeSparseSubband(s2_first, streams[3], l3W * l3H, 2, 0);
  
  const s2_second = streams[2].slice(l3W * l3H);
  const { coeffs: extra2 } = decodeSparseSubband(s2_second, streams[3], Math.min(s2_second.length, l3W * l3H), 2, extra1Bits);
  
  // Reconstruct
  let current = bilinear(ll4, l4W, l4H, l3W, l3H);
  
  // Add L3 details
  for (let i = 0; i < current.length; i++) {
    if (i < lh3.length) current[i] += lh3[i] * 0.3;
    if (i < hl3.length) current[i] += hl3[i] * 0.3;
    if (i < extra1.length) current[i] += extra1[i] * 0.2;
    if (i < extra2.length) current[i] += extra2[i] * 0.2;
  }
  
  // Add S4 direct (zigzag)
  const s4 = streams[4];
  const zigzag = v => (v & 1) ? -((v >> 1) + 1) : (v >> 1);
  for (let i = 0; i < Math.min(s4.length, current.length); i++) {
    if (s4[i] > 0 && s4[i] <= 20) {
      current[i] += zigzag(s4[i]) * 1.0;
    }
  }
  
  // Upscale
  current = bilinear(current, l3W, l3H, width, height);
  
  // Normalize
  let min = Infinity, max = -Infinity;
  for (const v of current) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  console.log(`\nOutput range: ${min.toFixed(1)} to ${max.toFixed(1)}`);
  
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

const input = process.argv[2] || `${process.env.HOME}/Documents/tis/GRAFIK/1/03/95/26.ITW`;
const output = process.argv[3] || '/tmp/itw_decompiled.png';
decodeITW(input, output);
