/**
 * ITW V1 Decoder - Wavelet decompression
 * Based on tis.exe decompilation analysis
 */
import { readFileSync, writeFileSync } from 'node:fs';
import * as zlib from 'node:zlib';

interface Stream {
  offset: number;
  data: Buffer;
  mean: number;
}

function readU16BE(buf: Buffer, offset: number): number {
  return buf.readUInt16BE(offset);
}

function readU32BE(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset);
}

/**
 * Find all zlib streams in data
 */
function findZlibStreams(data: Buffer): Stream[] {
  const streams: Stream[] = [];
  let searchStart = 0;

  while (searchStart < data.length - 10) {
    let found = false;
    for (let i = searchStart; i < data.length - 2 && !found; i++) {
      if (data[i] === 0x78 && (data[i + 1] === 0x9c || data[i + 1] === 0xda || data[i + 1] === 0x01)) {
        try {
          const dec = zlib.inflateSync(data.subarray(i));
          let sum = 0;
          for (const b of dec) sum += b;
          streams.push({ offset: i, data: dec, mean: sum / dec.length });
          searchStart = i + 10;
          found = true;
        } catch {
          // Not valid
        }
      }
    }
    if (!found) break;
  }

  return streams;
}

/**
 * Bilinear upscale
 */
function bilinearUpscale(src: Float32Array, srcW: number, srcH: number, dstW: number, dstH: number): Float32Array {
  const dst = new Float32Array(dstW * dstH);

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcX = (x * (srcW - 1)) / (dstW - 1);
      const srcY = (y * (srcH - 1)) / (dstH - 1);

      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const y1 = Math.min(y0 + 1, srcH - 1);

      const xf = srcX - x0;
      const yf = srcY - y0;

      const v00 = src[y0 * srcW + x0];
      const v10 = src[y0 * srcW + x1];
      const v01 = src[y1 * srcW + x0];
      const v11 = src[y1 * srcW + x1];

      const v = (v00 * (1 - xf) + v10 * xf) * (1 - yf) +
                (v01 * (1 - xf) + v11 * xf) * yf;

      dst[y * dstW + x] = v;
    }
  }

  return dst;
}

/**
 * Apply inverse CDF 5/3 wavelet transform (one level)
 */
function inverseCDF53(ll: Float32Array, lh: Float32Array, hl: Float32Array, hh: Float32Array,
                      llW: number, llH: number): Float32Array {
  const outW = llW * 2;
  const outH = llH * 2;
  const out = new Float32Array(outW * outH);

  // Place subbands
  for (let y = 0; y < llH; y++) {
    for (let x = 0; x < llW; x++) {
      out[(y * 2) * outW + (x * 2)] = ll[y * llW + x];
      out[(y * 2) * outW + (x * 2 + 1)] = lh[y * llW + x];
      out[(y * 2 + 1) * outW + (x * 2)] = hl[y * llW + x];
      out[(y * 2 + 1) * outW + (x * 2 + 1)] = hh[y * llW + x];
    }
  }

  // Horizontal inverse lift
  for (let y = 0; y < outH; y++) {
    // Update odd samples
    for (let x = 1; x < outW - 1; x += 2) {
      const left = out[y * outW + x - 1];
      const right = out[y * outW + x + 1];
      out[y * outW + x] += (left + right) * 0.5;
    }
    // Update even samples
    for (let x = 2; x < outW - 1; x += 2) {
      const left = out[y * outW + x - 1];
      const right = out[y * outW + x + 1];
      out[y * outW + x] -= (left + right) * 0.25;
    }
  }

  // Vertical inverse lift
  for (let x = 0; x < outW; x++) {
    // Update odd samples
    for (let y = 1; y < outH - 1; y += 2) {
      const top = out[(y - 1) * outW + x];
      const bot = out[(y + 1) * outW + x];
      out[y * outW + x] += (top + bot) * 0.5;
    }
    // Update even samples
    for (let y = 2; y < outH - 1; y += 2) {
      const top = out[(y - 1) * outW + x];
      const bot = out[(y + 1) * outW + x];
      out[y * outW + x] -= (top + bot) * 0.25;
    }
  }

  return out;
}

/**
 * Decode ITW V1 (wavelet) format
 */
export function decodeITWv1(filePath: string): { pixels: Buffer; width: number; height: number } {
  const buf = readFileSync(filePath);

  // Parse header
  const magic = buf.subarray(0, 4).toString('ascii');
  if (magic !== 'ITW_') throw new Error('Not an ITW file');

  const width = readU16BE(buf, 6);
  const height = readU16BE(buf, 8);
  const bits = readU16BE(buf, 10);
  const compression = readU16BE(buf, 12);

  if (compression !== 0x0300) {
    throw new Error(`Not V1 format: 0x${compression.toString(16)}`);
  }

  console.log(`ITW V1: ${width}x${height}, ${bits}bpp`);

  // Read compressed data
  const compressedSize = readU32BE(buf, 14);
  const compressed = buf.subarray(18, 18 + compressedSize);

  console.log(`Compressed: ${compressedSize} bytes`);

  // Find zlib streams
  const streams = findZlibStreams(compressed);
  console.log(`Found ${streams.length} zlib streams`);

  // Calculate LL dimensions (4 levels of wavelet)
  const numLevels = 4;
  let llW = width;
  let llH = height;
  for (let i = 0; i < numLevels; i++) {
    llW = Math.ceil(llW / 2);
    llH = Math.ceil(llH / 2);
  }
  console.log(`LL size: ${llW}x${llH} = ${llW * llH}`);

  // Stream 16 is LL (based on analysis: 300 bytes = 20x15)
  const llStream = streams[16];
  if (!llStream || llStream.data.length !== llW * llH) {
    console.log(`Warning: LL stream size mismatch. Expected ${llW * llH}, got ${llStream?.data.length}`);
  }

  // Convert LL to float
  let current = new Float32Array(llW * llH);
  for (let i = 0; i < llW * llH; i++) {
    current[i] = llStream.data[i];
  }

  // For now, just upscale LL (full wavelet reconstruction would need detail subbands)
  const result = bilinearUpscale(current, llW, llH, width, height);

  // Convert to output buffer
  const pixels = Buffer.alloc(width * height);
  for (let i = 0; i < pixels.length; i++) {
    // Map LL range (21-80) to full range
    const v = result[i];
    const scaled = (v - 21) * 255 / 59;
    pixels[i] = 255 - Math.max(0, Math.min(255, Math.round(scaled)));
  }

  return { pixels, width, height };
}

// CLI
const input = process.argv[2];
const output = process.argv[3] || input?.replace(/\.itw$/i, '.png');

if (!input) {
  console.log('Usage: node itw-v1-decoder.js <input.itw> [output.png]');
  process.exit(1);
}

const { pixels, width, height } = decodeITWv1(input);

// Write PGM (will convert to PNG in shell)
const pgm = Buffer.concat([
  Buffer.from(`P5\n${width} ${height}\n255\n`),
  pixels
]);
writeFileSync(output.replace('.png', '.pgm'), pgm);
console.log(`Saved: ${output.replace('.png', '.pgm')}`);
