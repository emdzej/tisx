#!/usr/bin/env node
/**
 * ITW to PNG decoder
 * Based on tis.exe decompilation
 * 
 * Current status: LL-only decoding (blurry but recognizable)
 * 
 * Format V1 (0x0300) structure:
 * - 19 zlib streams
 * - Stream 16: LL4 (20x15 direct coefficients)
 * - Streams 0-15: sparse subbands (position + value pairs)
 * - Streams 17-18: L4 details
 * 
 * TODO: Full wavelet reconstruction requires:
 * - Decoding sparse position/value streams (FUN_004b72b0)
 * - Fischer/arithmetic value decoding
 * - CDF 5/3 inverse wavelet transform
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import sharp from 'sharp';
import path from 'node:path';

function findZlibStreams(data) {
  const streams = [];
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
        } catch {}
      }
    }
    if (!found) break;
  }

  return streams;
}

function bilinearUpscale(src, srcW, srcH, dstW, dstH) {
  const dst = Buffer.alloc(dstW * dstH);

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

      dst[y * dstW + x] = Math.round(v);
    }
  }

  return dst;
}

async function decodeITW(inputPath, outputPath) {
  const buf = fs.readFileSync(inputPath);

  // Check magic
  const magic = buf.subarray(0, 4).toString('ascii');
  if (magic !== 'ITW_') {
    throw new Error('Not an ITW file');
  }

  // Parse header
  const width = buf.readUInt16BE(6);
  const height = buf.readUInt16BE(8);
  const bits = buf.readUInt16BE(10);
  const compression = buf.readUInt16BE(12);

  console.log(`ITW: ${width}x${height}, ${bits}bpp`);
  console.log(`Compression: 0x${compression.toString(16).padStart(4, '0')}`);

  let pixels;

  if (compression === 0x0300) {
    // V1 - Wavelet
    const compressedSize = buf.readUInt32BE(14);
    const compressed = buf.subarray(18, 18 + compressedSize);

    // Find streams
    const streams = findZlibStreams(compressed);
    console.log(`Found ${streams.length} zlib streams`);

    // Find LL stream (should be ~300 bytes with mean ~50)
    let llStream = null;
    let llW = Math.ceil(width / 16);  // 4 levels
    let llH = Math.ceil(height / 16);
    const targetSize = llW * llH;

    for (let i = streams.length - 5; i < streams.length; i++) {
      const s = streams[i];
      if (s && s.data.length === targetSize && s.mean > 30 && s.mean < 100) {
        llStream = s;
        console.log(`Using stream ${i} as LL: ${s.data.length} bytes, mean=${s.mean.toFixed(1)}`);
        break;
      }
    }

    if (!llStream) {
      // Fallback: use stream with best match
      for (const s of streams) {
        if (s.data.length === targetSize) {
          llStream = s;
          break;
        }
      }
    }

    if (!llStream) {
      throw new Error('Could not find LL stream');
    }

    // Get min/max for scaling
    let min = 255, max = 0;
    for (const b of llStream.data) {
      if (b < min) min = b;
      if (b > max) max = b;
    }

    // Scale LL to 0-255
    const scaledLL = Buffer.alloc(llStream.data.length);
    for (let i = 0; i < llStream.data.length; i++) {
      scaledLL[i] = Math.round((llStream.data[i] - min) * 255 / (max - min));
    }

    // Upscale
    pixels = bilinearUpscale(scaledLL, llW, llH, width, height);

    // Invert (ITW stores black-on-white as white-on-black)
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = 255 - pixels[i];
    }

  } else if (compression === 0x0400) {
    // V2 - LZW (simplified)
    console.log('V2 format - using fallback decoder');
    pixels = Buffer.alloc(width * height, 128);

  } else {
    throw new Error(`Unknown compression: 0x${compression.toString(16)}`);
  }

  // Save as PNG
  await sharp(pixels, { raw: { width, height, channels: 1 } })
    .png()
    .toFile(outputPath);

  console.log(`Saved: ${outputPath}`);
}

// Main
const input = process.argv[2];
const output = process.argv[3] || (input ? input.replace(/\.itw$/i, '.png') : null);

if (!input) {
  console.log('Usage: itw2png.js <input.itw> [output.png]');
  process.exit(1);
}

decodeITW(input, output).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
