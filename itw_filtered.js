#!/usr/bin/env node
/**
 * ITW V1 Decoder - Fixed with outlier filtering
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
  
  // LL4 from S16
  const ll4 = new Float32Array(l4W * l4H);
  for (let i = 0; i < streams[16].length && i < ll4.length; i++) {
    ll4[i] = streams[16][i];
  }
  console.log(`LL4: ${l4W}x${l4H}, range ${Math.min(...streams[16])}-${Math.max(...streams[16])}`);
  
  // Process S4 as L3 detail
  // Filter outliers (values > 30 are likely markers, not coefficients)
  const s4 = streams[4];
  const detail3 = new Float32Array(l3W * l3H);
  const THRESHOLD = 25;  // Values above this are outliers
  
  for (let i = 0; i < Math.min(s4.length, detail3.length); i++) {
    const v = s4[i];
    if (v > THRESHOLD) {
      // Skip outliers (markers, edge values)
      detail3[i] = 0;
    } else {
      // Small values: interpret as signed coefficients
      // 0 = 0, 1 = -1, 2 = 1, 3 = -2, 4 = 2... (zigzag)
      const signed = (v & 1) ? -((v >> 1) + 1) : (v >> 1);
      detail3[i] = signed * 2.0;  // Scale
    }
  }
  
  // Count filtered
  let filtered = 0;
  for (let i = 0; i < s4.length; i++) if (s4[i] > THRESHOLD) filtered++;
  console.log(`S4 detail: ${filtered}/${s4.length} outliers filtered`);
  
  // Reconstruct
  // LL4 → L3 (bilinear)
  let current = bilinear(ll4, l4W, l4H, l3W, l3H);
  
  // Add filtered detail
  for (let i = 0; i < current.length && i < detail3.length; i++) {
    current[i] += detail3[i];
  }
  
  // Upscale to full
  current = bilinear(current, l3W, l3H, width, height);
  
  // Normalize
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < width * height; i++) {
    if (current[i] < min) min = current[i];
    if (current[i] > max) max = current[i];
  }
  console.log(`Value range: ${min.toFixed(1)} to ${max.toFixed(1)}`);
  
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
const output = process.argv[3] || '/tmp/itw_filtered.png';
decodeITW(input, output);
