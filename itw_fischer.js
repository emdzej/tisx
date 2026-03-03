#!/usr/bin/env node
/**
 * ITW V1 Full Fischer Decoder
 * Based on complete analysis of tis.exe decompilation
 * 
 * Key functions mapped:
 * - FUN_004b8a60: Build probability table
 * - FUN_004b88a0: Lookup probability
 * - FUN_004bbdf0: Fischer decode
 * - FUN_004b72b0: Sparse subband decode
 * - FUN_004b6c40: Reconstruction with dequantization
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import sharp from 'sharp';

// Build cumulative probability table (from FUN_004b8a60)
// Pattern: prob(n) = 2*n² + 2*n + 1 (triangular distribution)
function buildProbTable(maxSymbol = 100) {
  const table = [];
  let cumulative = 0;
  for (let n = 0; n <= maxSymbol; n++) {
    table.push(cumulative);
    cumulative += 2 * n * n + 2 * n + 1;
  }
  table.push(cumulative); // Final value
  return table;
}

// Lookup probability P(x, budget) = table[budget][x]
// Simplified: just use 1D cumulative table
function probLookup(table, budget, symbol) {
  if (symbol >= table.length - 1) return 0;
  // Scale by budget
  const maxProb = table[table.length - 1];
  return Math.floor((table[symbol + 1] - table[symbol]) * budget / maxProb);
}

// Cumulative probability up to symbol
function cumulativeProb(table, budget, symbol) {
  if (symbol >= table.length) symbol = table.length - 1;
  const maxProb = table[table.length - 1];
  return Math.floor(table[symbol] * budget / maxProb);
}

/**
 * Fischer decoder (FUN_004bbdf0)
 * Decodes a sequence of signed integers from a code value
 * 
 * @param count - Number of values to decode
 * @param code - Encoded code value (from bit stream)
 * @param budget - Total "probability mass" (from position stream)
 * @param table - Probability table
 * @returns Array of decoded signed integers
 */
function fischerDecode(count, code, budget, table) {
  const output = new Int32Array(count);
  let remainingBudget = budget;
  let currentCode = code;
  
  for (let i = 0; i < count && remainingBudget > 0; i++) {
    // Check if this position is zero
    const zeroProb = cumulativeProb(table, remainingBudget, 0);
    
    if (currentCode < zeroProb) {
      output[i] = 0;
    } else {
      // Find the magnitude
      currentCode -= zeroProb;
      let magnitude = 1;
      let cumProb = 0;
      
      while (magnitude < 100) {
        const symbolProb = probLookup(table, remainingBudget - magnitude, magnitude);
        if (currentCode < cumProb + symbolProb * 2) {
          // Found it - determine sign
          if (currentCode < cumProb + symbolProb) {
            output[i] = magnitude;
          } else {
            output[i] = -magnitude;
            currentCode -= symbolProb;
          }
          break;
        }
        cumProb += symbolProb * 2;
        magnitude++;
      }
      
      // Update remaining budget
      const absVal = Math.abs(output[i]);
      remainingBudget -= absVal;
    }
  }
  
  return output;
}

// Bit reader class
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
  
  readByte() {
    if (this.bytePos >= this.data.length) return 0;
    return this.data[this.bytePos++];
  }
}

/**
 * Decode sparse subband (FUN_004b72b0)
 * 
 * Position stream: each byte has bit7 = extra flag, bits0-6 = position info
 * Value stream: provides bit counts for coefficient decoding
 */
function decodeSparseSubband(posStream, valStream, width, height, quantStep) {
  const subband = new Float32Array(width * height);
  const posReader = new BitReader(posStream);
  const valReader = new BitReader(valStream);
  
  // First pass: read position bytes and extra bit counts
  const positions = [];
  const extraBits = [];
  
  for (let i = 0; i < posStream.length; i++) {
    const byte = posStream[i];
    const hasExtra = (byte & 0x80) !== 0;
    const posValue = byte & 0x7f;
    positions.push(posValue);
    
    if (hasExtra) {
      // Read 4 bits from value stream for extra data
      extraBits.push(valReader.readBits(4));
    } else {
      extraBits.push(0);
    }
  }
  
  // Build probability table
  const probTable = buildProbTable(50);
  
  // Second pass: decode coefficients
  let outputPos = 0;
  
  for (let i = 0; i < positions.length && outputPos < subband.length; i++) {
    const skip = positions[i];
    const extra = extraBits[i];
    
    if (skip === 0) {
      // Single coefficient at current position
      if (extra > 0) {
        // Read coefficient value
        const bits = valReader.readBits(extra + 4);
        // Sign-extend if needed
        const signBit = 1 << (extra + 3);
        const value = (bits & signBit) ? bits - (1 << (extra + 4)) : bits;
        subband[outputPos] = value * quantStep;
      }
      outputPos++;
    } else {
      // Skip 'skip' positions
      outputPos += skip;
      
      if (extra > 0 && outputPos < subband.length) {
        // Read coefficient at new position
        const bits = valReader.readBits(extra + 4);
        const signBit = 1 << (extra + 3);
        const value = (bits & signBit) ? bits - (1 << (extra + 4)) : bits;
        subband[outputPos] = value * quantStep;
        outputPos++;
      }
    }
  }
  
  return subband;
}

// Find zlib streams
function findZlibStreams(data) {
  const streams = [];
  let pos = 0;
  while (pos < data.length - 10) {
    let found = false;
    for (let i = pos; i < data.length - 2 && !found; i++) {
      if (data[i] === 0x78 && (data[i+1] === 0x9c || data[i+1] === 0xda || data[i+1] === 0x01)) {
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

// Bilinear upscale
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

// Add detail subband to low-pass
function addDetail(ll, detail, w, h) {
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    out[i] = ll[i] + detail[i];
  }
  return out;
}

async function decodeITW(inputPath, outputPath) {
  const buf = fs.readFileSync(inputPath);
  
  const magic = buf.toString('ascii', 0, 4);
  if (magic !== 'ITW_') throw new Error('Not ITW');
  
  const width = buf.readUInt16BE(6);
  const height = buf.readUInt16BE(8);
  const version = buf.readUInt16BE(12);
  
  console.log(`ITW: ${width}x${height}, version 0x${version.toString(16)}`);
  
  if (version !== 0x0300) {
    throw new Error(`Unsupported version: 0x${version.toString(16)}`);
  }
  
  const streams = findZlibStreams(buf.subarray(20));
  console.log(`Found ${streams.length} streams`);
  
  // Level dimensions
  const l4W = Math.ceil(width / 16), l4H = Math.ceil(height / 16);
  const l3W = Math.ceil(width / 8), l3H = Math.ceil(height / 8);
  const l2W = Math.ceil(width / 4), l2H = Math.ceil(height / 4);
  const l1W = Math.ceil(width / 2), l1H = Math.ceil(height / 2);
  
  console.log(`\nLevel dimensions:`);
  console.log(`  L4: ${l4W}x${l4H} = ${l4W*l4H}`);
  console.log(`  L3: ${l3W}x${l3H} = ${l3W*l3H}`);
  console.log(`  L2: ${l2W}x${l2H} = ${l2W*l2H}`);
  console.log(`  L1: ${l1W}x${l1H} = ${l1W*l1H}`);
  
  // Quantization steps per level
  const QUANT = [8, 8, 4, 4, 4, 2, 2, 2, 1, 1, 1];
  
  // LL4 from S16 (direct u8 values)
  const ll4 = new Float32Array(l4W * l4H);
  const s16 = streams[16];
  for (let i = 0; i < Math.min(s16.length, ll4.length); i++) {
    ll4[i] = s16[i];
  }
  console.log(`\nLL4 loaded: ${s16.length} bytes`);
  
  // Try to decode sparse subbands
  // Stream mapping based on analysis:
  // S0+S1: LH1 (positions + values)
  // S2+S3: HL1 (positions + values)
  // S4: L3 direct (1200 bytes = 40x30)
  
  let current = ll4;
  let curW = l4W, curH = l4H;
  
  // Level 4 → Level 3
  current = bilinear(current, curW, curH, l3W, l3H);
  curW = l3W; curH = l3H;
  
  // Try adding S4 as L3 detail
  if (streams[4] && streams[4].length >= l3W * l3H) {
    console.log(`\nDecoding S4 as L3 detail...`);
    const s4Detail = new Float32Array(l3W * l3H);
    for (let i = 0; i < s4Detail.length; i++) {
      // Zigzag decode
      const v = streams[4][i];
      s4Detail[i] = (v & 1) ? -(v >> 1) - 1 : (v >> 1);
    }
    current = addDetail(current, s4Detail, curW, curH);
    
    // Stats
    let nonZero = 0;
    for (const v of s4Detail) if (v !== 0) nonZero++;
    console.log(`  Non-zero: ${nonZero}/${s4Detail.length}`);
  }
  
  // Level 3 → Level 2
  current = bilinear(current, curW, curH, l2W, l2H);
  curW = l2W; curH = l2H;
  
  // Try sparse decode for L2 (S8+S9)
  if (streams[8] && streams[9]) {
    console.log(`\nDecoding L2 sparse subband (S8+S9)...`);
    const l2Detail = decodeSparseSubband(streams[8], streams[9], curW, curH, QUANT[3]);
    
    let nonZero = 0;
    for (const v of l2Detail) if (v !== 0) nonZero++;
    console.log(`  Non-zero: ${nonZero}/${l2Detail.length}`);
    
    // Only add if we got meaningful data
    if (nonZero > 10) {
      current = addDetail(current, l2Detail, curW, curH);
    }
  }
  
  // Level 2 → Level 1
  current = bilinear(current, curW, curH, l1W, l1H);
  curW = l1W; curH = l1H;
  
  // Try sparse decode for L1 (S0+S1 = LH1, S2+S3 = HL1)
  if (streams[0] && streams[1]) {
    console.log(`\nDecoding L1 LH subband (S0+S1)...`);
    const lh1 = decodeSparseSubband(streams[0], streams[1], curW, curH, QUANT[0]);
    
    let nonZero = 0;
    for (const v of lh1) if (v !== 0) nonZero++;
    console.log(`  Non-zero: ${nonZero}/${lh1.length}`);
    
    if (nonZero > 10) {
      current = addDetail(current, lh1, curW, curH);
    }
  }
  
  // Level 1 → Full resolution
  current = bilinear(current, curW, curH, width, height);
  
  // Normalize and save
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < width * height; i++) {
    if (current[i] < min) min = current[i];
    if (current[i] > max) max = current[i];
  }
  
  console.log(`\nValue range: ${min.toFixed(2)} to ${max.toFixed(2)}`);
  
  const pixels = Buffer.alloc(width * height);
  const range = max - min || 1;
  for (let i = 0; i < width * height; i++) {
    const norm = (current[i] - min) * 255 / range;
    pixels[i] = 255 - Math.round(Math.max(0, Math.min(255, norm)));
  }
  
  await sharp(pixels, { raw: { width, height, channels: 1 } })
    .png()
    .toFile(outputPath);
  
  console.log(`\nSaved: ${outputPath}`);
}

const input = process.argv[2];
const output = process.argv[3] || '/tmp/itw_fischer.png';
decodeITW(input, output);
