#!/usr/bin/env node
/**
 * ITW V1 Test Decoder with Direct Detail Streams
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

// Simple bilinear upscale
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

// Add detail to low-pass
function addDetail(ll, detail, w, h, scale = 1.0) {
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    // Detail is centered around ~10 with zigzag encoding
    const d = (detail[i] - 10) * scale;
    out[i] = ll[i] + d;
  }
  return out;
}

async function decodeITW(inputPath, outputPath) {
  const buf = fs.readFileSync(inputPath);
  
  const magic = buf.toString('ascii', 0, 4);
  if (magic !== 'ITW_') throw new Error('Not ITW');
  
  const width = buf.readUInt16BE(6);
  const height = buf.readUInt16BE(8);
  console.log(`ITW: ${width}x${height}`);
  
  const streams = findZlibStreams(buf.subarray(20));
  console.log(`Streams: ${streams.length}`);
  
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
  
  // Try S4 as L3 detail (size matches exactly)
  const s4 = streams[4];
  console.log(`S4: ${s4.length} bytes (expected L3: ${l3W * l3H})`);
  
  // Upscale LL4 to L3 size
  let current = bilinear(ll4, l4W, l4H, l3W, l3H);
  
  // Add S4 as detail if size matches
  if (s4.length >= l3W * l3H) {
    const detail = new Float32Array(l3W * l3H);
    for (let i = 0; i < detail.length; i++) {
      // S4 values are sparse, mean ~9
      detail[i] = s4[i];
    }
    // Try different interpretation
    const detailSigned = new Float32Array(l3W * l3H);
    for (let i = 0; i < detail.length; i++) {
      // Zigzag decode: 0->0, 1->-1, 2->1, 3->-2...
      const v = detail[i];
      detailSigned[i] = (v & 1) ? -(v >> 1) - 1 : (v >> 1);
    }
    // Add detail with small scale
    for (let i = 0; i < current.length; i++) {
      current[i] += detailSigned[i] * 2.0; // Adjust scale
    }
    console.log(`Added S4 as L3 detail`);
  }
  
  // Continue upscaling to full resolution
  current = bilinear(current, l3W, l3H, l2W, l2H);
  current = bilinear(current, l2W, l2H, l1W, l1H);
  current = bilinear(current, l1W, l1H, width, height);
  
  // Normalize and save
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < width * height; i++) {
    if (current[i] < min) min = current[i];
    if (current[i] > max) max = current[i];
  }
  
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
const output = process.argv[3] || '/tmp/test_detail.png';
decodeITW(input, output);
