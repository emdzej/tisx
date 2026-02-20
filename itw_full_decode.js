#!/usr/bin/env node
/**
 * ITW V1 Full Decoder
 * Decodes sparse subbands using position + value streams
 * Based on FUN_004b72b0 from tis.exe
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import sharp from 'sharp';

// Find all zlib streams
function findZlibStreams(data) {
  const streams = [];
  let searchStart = 0;
  while (searchStart < data.length - 10) {
    let found = false;
    for (let i = searchStart; i < data.length - 2 && !found; i++) {
      if (data[i] === 0x78 && (data[i+1] === 0x9c || data[i+1] === 0xda || data[i+1] === 0x01)) {
        try {
          const dec = zlib.inflateSync(data.subarray(i));
          streams.push(dec);
          searchStart = i + 10;
          found = true;
        } catch {}
      }
    }
    if (!found) break;
  }
  return streams;
}

// Bit reader for value stream
class BitReader {
  constructor(data) {
    this.data = data;
    this.pos = 0;
    this.bitPos = 0;
    this.currentByte = data[0] || 0;
  }

  readBits(n) {
    let value = 0;
    for (let i = 0; i < n; i++) {
      if (this.bitPos === 0) {
        this.currentByte = this.data[this.pos++] || 0;
      }
      value |= ((this.currentByte >> this.bitPos) & 1) << i;
      this.bitPos = (this.bitPos + 1) & 7;
    }
    return value;
  }

  readByte() {
    return this.readBits(8);
  }
}

// Decode sparse subband from position + value streams
function decodeSparseSubband(posStream, valStream, width, height) {
  const subband = new Float32Array(width * height);
  
  // Position stream format:
  // - Bit 7: has extra value flag
  // - Bits 0-6: position offset or skip count
  
  const positions = [];
  const extraFlags = [];
  
  // Parse position stream
  for (let i = 0; i < posStream.length; i++) {
    const byte = posStream[i];
    const hasExtra = (byte & 0x80) !== 0;
    const posVal = byte & 0x7F;
    positions.push(posVal);
    extraFlags.push(hasExtra);
  }
  
  // Value stream is bit-packed
  // Read values based on positions
  const bitReader = new BitReader(valStream);
  
  let currentPos = 0;
  let valueIdx = 0;
  
  for (let i = 0; i < positions.length && currentPos < subband.length; i++) {
    const skip = positions[i];
    
    if (skip === 0) {
      // Skip=0 means place value at current position
      if (extraFlags[i]) {
        // Read 4 extra bits for magnitude
        const extra = bitReader.readBits(4);
        // Read value bits based on magnitude
        const valueBits = Math.max(1, extra);
        const value = bitReader.readBits(valueBits);
        // Sign extend
        const signedValue = value - (1 << (valueBits - 1));
        subband[currentPos] = signedValue;
      }
      currentPos++;
    } else {
      // Skip positions, then optionally place value
      currentPos += skip;
      if (extraFlags[i] && currentPos < subband.length) {
        const extra = bitReader.readBits(4);
        const valueBits = Math.max(1, extra);
        const value = bitReader.readBits(valueBits);
        const signedValue = value - (1 << (valueBits - 1));
        subband[currentPos] = signedValue;
        currentPos++;
      }
    }
  }
  
  return subband;
}

// Alternative: simpler interpretation
function decodeSubbandSimple(posStream, valStream, width, height) {
  const subband = new Float32Array(width * height);
  
  // Hypothesis: position bytes are RLE skip counts
  // Value bytes are direct coefficients
  
  let pos = 0;
  let valIdx = 0;
  
  for (let i = 0; i < posStream.length && pos < subband.length && valIdx < valStream.length; i++) {
    const skip = posStream[i];
    
    if (skip === 0) {
      // Zero means no skip, place value
      subband[pos] = (valStream[valIdx++] - 128); // signed
      pos++;
    } else if (skip < 128) {
      // Skip and place
      pos += skip;
      if (pos < subband.length) {
        subband[pos] = (valStream[valIdx++] - 128);
        pos++;
      }
    } else {
      // High bit = embedded value?
      subband[pos] = (skip - 128 - 64) * 2;
      pos++;
    }
  }
  
  console.log(`  Decoded: ${valIdx} values, final pos ${pos}/${subband.length}`);
  return subband;
}

// CDF 5/3 inverse wavelet (one level)
function inverseCDF53(ll, lh, hl, hh, llW, llH) {
  const outW = llW * 2;
  const outH = llH * 2;
  const out = new Float32Array(outW * outH);
  
  // Interleave subbands
  for (let y = 0; y < llH; y++) {
    for (let x = 0; x < llW; x++) {
      out[(y * 2) * outW + (x * 2)] = ll[y * llW + x];           // LL
      out[(y * 2) * outW + (x * 2 + 1)] = lh[y * llW + x];       // LH  
      out[(y * 2 + 1) * outW + (x * 2)] = hl[y * llW + x];       // HL
      out[(y * 2 + 1) * outW + (x * 2 + 1)] = hh[y * llW + x];   // HH
    }
  }
  
  // Inverse lift (horizontal then vertical)
  // Predict step
  for (let y = 0; y < outH; y++) {
    for (let x = 1; x < outW - 1; x += 2) {
      const left = out[y * outW + x - 1];
      const right = out[y * outW + x + 1];
      out[y * outW + x] += (left + right) * 0.5;
    }
  }
  
  // Update step  
  for (let y = 0; y < outH; y++) {
    for (let x = 2; x < outW - 1; x += 2) {
      const left = out[y * outW + x - 1];
      const right = out[y * outW + x + 1];
      out[y * outW + x] -= (left + right) * 0.25;
    }
  }
  
  // Vertical
  for (let x = 0; x < outW; x++) {
    for (let y = 1; y < outH - 1; y += 2) {
      const top = out[(y - 1) * outW + x];
      const bot = out[(y + 1) * outW + x];
      out[y * outW + x] += (top + bot) * 0.5;
    }
    for (let y = 2; y < outH - 1; y += 2) {
      const top = out[(y - 1) * outW + x];
      const bot = out[(y + 1) * outW + x];
      out[y * outW + x] -= (top + bot) * 0.25;
    }
  }
  
  return { data: out, w: outW, h: outH };
}

async function decodeITW(inputPath, outputPath) {
  const buf = fs.readFileSync(inputPath);
  
  const width = buf.readUInt16BE(6);
  const height = buf.readUInt16BE(8);
  const compSize = buf.readUInt32BE(14);
  const compressed = buf.subarray(18, 18 + compSize);
  
  console.log(`ITW: ${width}x${height}`);
  
  const streams = findZlibStreams(compressed);
  console.log(`Found ${streams.length} streams`);
  
  // Stream 16 = LL4 (20x15)
  const ll4 = streams[16];
  const llW = Math.ceil(width / 16);
  const llH = Math.ceil(height / 16);
  
  console.log(`LL4: ${llW}x${llH} = ${ll4.length} bytes`);
  
  // Convert LL to float
  let current = new Float32Array(llW * llH);
  for (let i = 0; i < ll4.length; i++) {
    current[i] = ll4[i];
  }
  let curW = llW, curH = llH;
  
  // Stream 17, 18 might be L4 details
  // For now, try to decode stream pairs as sparse subbands
  
  // L3: 40x30 - streams 4/5?
  const l3W = Math.ceil(width / 8);
  const l3H = Math.ceil(height / 8);
  
  console.log(`L3 expected: ${l3W}x${l3H}`);
  
  // Try to decode L4 details from streams 17, 18
  if (streams[17] && streams[18]) {
    const lh4 = new Float32Array(llW * llH);
    const hl4 = new Float32Array(llW * llH);
    const hh4 = new Float32Array(llW * llH);
    
    // Stream 17 = 320 bytes (slightly padded)
    // Stream 18 = 300 bytes = 20x15
    
    // Try using stream 18 as one detail subband
    for (let i = 0; i < Math.min(streams[18].length, llW * llH); i++) {
      lh4[i] = (streams[18][i] - 25) * 0.5; // centered, scaled
    }
    
    // Reconstruct L3 from L4 + details
    const l3 = inverseCDF53(current, lh4, hl4, hh4, llW, llH);
    current = l3.data;
    curW = l3.w;
    curH = l3.h;
    console.log(`After L4->L3: ${curW}x${curH}`);
  }
  
  // Continue upscaling to full resolution
  while (curW < width || curH < height) {
    // Simple 2x upscale
    const newW = Math.min(curW * 2, width + 10);
    const newH = Math.min(curH * 2, height + 10);
    const upscaled = new Float32Array(newW * newH);
    
    for (let y = 0; y < newH; y++) {
      for (let x = 0; x < newW; x++) {
        const srcX = x * curW / newW;
        const srcY = y * curH / newH;
        const x0 = Math.floor(srcX), y0 = Math.floor(srcY);
        const x1 = Math.min(x0 + 1, curW - 1), y1 = Math.min(y0 + 1, curH - 1);
        const xf = srcX - x0, yf = srcY - y0;
        
        upscaled[y * newW + x] = 
          (current[y0 * curW + x0] * (1-xf) + current[y0 * curW + x1] * xf) * (1-yf) +
          (current[y1 * curW + x0] * (1-xf) + current[y1 * curW + x1] * xf) * yf;
      }
    }
    
    current = upscaled;
    curW = newW;
    curH = newH;
  }
  
  // Final crop and normalize
  const pixels = Buffer.alloc(width * height);
  let min = Infinity, max = -Infinity;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = current[y * curW + x];
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = current[y * curW + x];
      const norm = (v - min) * 255 / (max - min);
      pixels[y * width + x] = 255 - Math.round(norm);
    }
  }
  
  await sharp(pixels, { raw: { width, height, channels: 1 } })
    .png()
    .toFile(outputPath);
  
  console.log(`Saved: ${outputPath}`);
}

// Main
const input = process.argv[2];
const output = process.argv[3] || input?.replace(/\.itw$/i, '_full.png');

if (!input) {
  console.log('Usage: node itw_full_decode.js <input.itw> [output.png]');
  process.exit(1);
}

decodeITW(input, output);
