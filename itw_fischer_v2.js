#!/usr/bin/env node
/**
 * ITW V1 Fischer Decoder - Direct translation from tis.exe decompilation
 * 
 * FUN_004bbdf0 translated to JavaScript
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import sharp from 'sharp';

/**
 * Build probability table (from FUN_004b8a60)
 * Returns 2D array: table[level][value] = cumulative probability
 * 
 * Pattern: prob(n) = 2*n² + 2*n + 1
 * Cumulative: cum(n) = sum(prob(0..n-1))
 */
function buildProbTable(maxLevel = 16, maxValue = 200) {
  const table = [];
  
  for (let level = 0; level < maxLevel; level++) {
    const row = [0]; // cum[0] = 0
    let cumulative = 0;
    
    for (let n = 0; n < maxValue; n++) {
      // prob(n) = 2*n² + 2*n + 1
      const prob = 2 * n * n + 2 * n + 1;
      cumulative += prob;
      row.push(cumulative);
    }
    table.push(row);
  }
  
  return table;
}

/**
 * Probability lookup - simplified FUN_004b88a0
 * In original: 3D lookup with offsets
 * Simplified: table[level][value]
 */
function probLookup(table, level, value) {
  if (level < 0 || level >= table.length) return 0;
  if (value < 0 || value >= table[level].length - 1) return 0;
  return table[level][value + 1] - table[level][value];
}

/**
 * Cumulative probability lookup
 */
function cumProb(table, level, value) {
  if (level < 0 || level >= table.length) return 0;
  if (value < 0) return 0;
  if (value >= table[level].length) return table[level][table[level].length - 1];
  return table[level][value];
}

/**
 * Fischer decoder - direct translation of FUN_004bbdf0
 * 
 * @param count - Number of coefficients to decode
 * @param code - Encoded integer value
 * @param budget - Total "budget" (sum of absolute coefficient values)
 * @param table - Probability table
 * @returns Int32Array of decoded coefficients
 */
function fischerDecode(count, code, budget, table) {
  const output = new Int32Array(count);
  
  // param_1 = output array (with count at [0] in original, here just length)
  // param_2 = code
  // param_3 = budget  
  // param_4 = probability table
  
  let accumulated = 0;  // iVar4
  let remaining = budget;  // local_10
  let level = count;  // uVar5 (starts at count, decrements)
  
  if (budget === 0) {
    return output;  // All zeros
  }
  
  for (let i = 0; i < count; i++) {  // local_c = i
    level = count - i;  // uVar5 decrements each iteration
    
    // Check if we've consumed all the code
    if (code === accumulated) {
      output[i] = 0;
      break;
    }
    
    // Get probability of zero at this position
    const probZero = probLookup(table, level - 1, remaining);
    
    if (code < probZero + accumulated) {
      // Zero coefficient
      output[i] = 0;
    } else {
      // Non-zero coefficient - find magnitude
      accumulated += probZero;
      let magnitude = 1;  // local_8
      
      // Find magnitude by incrementing until code fits
      while (true) {
        const probMag = probLookup(table, level - 1, remaining - magnitude);
        if (code < accumulated + probMag * 2) {
          break;
        }
        accumulated += probMag * 2;
        magnitude++;
        
        if (magnitude > 100) break;  // Safety limit
      }
      
      // Determine sign
      const probMag = probLookup(table, level - 1, remaining - magnitude);
      if (accumulated <= code && code < accumulated + probMag) {
        // Positive
        output[i] = magnitude;
      } else {
        // Negative
        output[i] = -magnitude;
        accumulated += probMag;
      }
      
      // Update remaining budget
      remaining -= Math.abs(output[i]);
    }
  }
  
  // Handle remaining budget (last coefficient adjustment)
  if (remaining > 0 && count > 0) {
    const lastVal = output[count - 1];
    const absLast = Math.abs(lastVal);
    if (lastVal >= 0) {
      output[count - 1] = absLast + remaining;
    } else {
      output[count - 1] = -(absLast + remaining);
    }
  }
  
  return output;
}

// Bit reader
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

/**
 * Decode sparse subband using position + value streams
 */
function decodeSparseSubband(posStream, valStream, width, height, quantStep, probTable) {
  const subband = new Float32Array(width * height);
  const valReader = new BitReader(valStream);
  
  // First pass: extract position info and flags
  const positions = [];
  const flags = [];
  
  for (const byte of posStream) {
    flags.push((byte & 0x80) !== 0);
    positions.push(byte & 0x7f);
  }
  
  // Second pass: for flagged positions, read 4 bits of extra data
  const extraBits = [];
  for (let i = 0; i < flags.length; i++) {
    if (flags[i]) {
      extraBits.push(valReader.readBits(4));
    } else {
      extraBits.push(0);
    }
  }
  
  // Third pass: decode coefficients using Fischer
  let outputPos = 0;
  
  for (let i = 0; i < positions.length && outputPos < subband.length; i++) {
    const skip = positions[i];
    const extra = extraBits[i];
    
    if (skip === 0 && !flags[i]) {
      // Zero coefficient at this position
      outputPos++;
      continue;
    }
    
    // Skip positions
    outputPos += skip;
    
    if (outputPos >= subband.length) break;
    
    // Decode coefficient(s) using Fischer
    if (extra > 0) {
      // Read 'extra' bits for code, 'extra' bits for budget
      const code = valReader.readBits(extra * 2);
      const budget = valReader.readBits(extra * 2);
      
      // Fischer decode single coefficient
      if (budget > 0) {
        const decoded = fischerDecode(1, code % (budget + 1), budget, probTable);
        subband[outputPos] = decoded[0] * quantStep;
      }
    }
    
    outputPos++;
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
  
  // Build probability table
  const probTable = buildProbTable(20, 100);
  console.log(`Probability table built: ${probTable.length} levels`);
  
  // Level dimensions
  const l4W = Math.ceil(width / 16), l4H = Math.ceil(height / 16);
  const l1W = Math.ceil(width / 2), l1H = Math.ceil(height / 2);
  
  // LL4 from S16
  const ll4 = new Float32Array(l4W * l4H);
  for (let i = 0; i < streams[16].length && i < ll4.length; i++) {
    ll4[i] = streams[16][i];
  }
  console.log(`LL4: ${l4W}x${l4H}`);
  
  // Decode LH1 (S0+S1)
  console.log(`\nDecoding LH1 with Fischer...`);
  const lh1 = decodeSparseSubband(streams[0], streams[1], l1W, l1H, 8, probTable);
  
  let nonZero = 0;
  for (const v of lh1) if (v !== 0) nonZero++;
  console.log(`  Non-zero coefficients: ${nonZero}`);
  
  // Reconstruct
  let current = bilinear(ll4, l4W, l4H, l1W, l1H);
  
  // Add detail
  for (let i = 0; i < current.length; i++) {
    current[i] += lh1[i] * 0.1;
  }
  
  // Upscale
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

// Test Fischer decoder
function testFischer() {
  const table = buildProbTable(10, 50);
  
  console.log('Fischer decoder test:');
  
  // Test: decode coefficients from code=0, budget=5
  const result1 = fischerDecode(3, 0, 5, table);
  console.log(`  code=0, budget=5, count=3 → [${result1}]`);
  
  // Test: decode with non-zero code
  const result2 = fischerDecode(3, 10, 5, table);
  console.log(`  code=10, budget=5, count=3 → [${result2}]`);
  
  const result3 = fischerDecode(2, 3, 3, table);
  console.log(`  code=3, budget=3, count=2 → [${result3}]`);
}

const input = process.argv[2];
if (input === '--test') {
  testFischer();
} else if (input) {
  const output = process.argv[3] || '/tmp/itw_fischer2.png';
  decodeITW(input, output);
} else {
  console.log('Usage: node itw_fischer_v2.js <input.itw> [output.png]');
  console.log('       node itw_fischer_v2.js --test');
}
