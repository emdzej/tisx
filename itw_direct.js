#!/usr/bin/env node
/**
 * ITW V1 Direct Streams Decoder
 * Uses only direct coefficient streams (S4, S6, S10, S12, S16, S17, S18)
 * Skips problematic sparse/Fischer encoded streams for now
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

// Zigzag decode: 0->0, 1->-1, 2->1, 3->-2, 4->2...
function zigzagDecode(v) {
  return (v & 1) ? -((v >> 1) + 1) : (v >> 1);
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

// Simple CDF 5/3 inverse (one level, ll + detail bands)
function inverseCDF53(ll, lh, hl, hh, w, h) {
  const outW = w * 2;
  const outH = h * 2;
  const out = new Float32Array(outW * outH);
  
  // Interleave
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      out[(y * 2) * outW + (x * 2)] = ll[i];           // LL
      out[(y * 2) * outW + (x * 2 + 1)] = lh ? lh[i] : 0; // LH
      out[(y * 2 + 1) * outW + (x * 2)] = hl ? hl[i] : 0; // HL
      out[(y * 2 + 1) * outW + (x * 2 + 1)] = hh ? hh[i] : 0; // HH
    }
  }
  
  // Vertical synthesis (update even, then odd)
  for (let x = 0; x < outW; x++) {
    // Update even rows
    for (let y = 0; y < outH; y += 2) {
      const top = y > 0 ? out[(y - 1) * outW + x] : out[(y + 1) * outW + x];
      const bot = y + 1 < outH ? out[(y + 1) * outW + x] : top;
      out[y * outW + x] -= (top + bot) / 4;
    }
    // Update odd rows
    for (let y = 1; y < outH; y += 2) {
      const top = out[(y - 1) * outW + x];
      const bot = y + 1 < outH ? out[(y + 1) * outW + x] : top;
      out[y * outW + x] += (top + bot) / 2;
    }
  }
  
  // Horizontal synthesis
  for (let y = 0; y < outH; y++) {
    // Update even cols
    for (let x = 0; x < outW; x += 2) {
      const left = x > 0 ? out[y * outW + x - 1] : out[y * outW + x + 1];
      const right = x + 1 < outW ? out[y * outW + x + 1] : left;
      out[y * outW + x] -= (left + right) / 4;
    }
    // Update odd cols
    for (let x = 1; x < outW; x += 2) {
      const left = out[y * outW + x - 1];
      const right = x + 1 < outW ? out[y * outW + x + 1] : left;
      out[y * outW + x] += (left + right) / 2;
    }
  }
  
  return { data: out, w: outW, h: outH };
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
  
  // Level dimensions
  const l4W = Math.ceil(width / 16), l4H = Math.ceil(height / 16);
  const l3W = Math.ceil(width / 8), l3H = Math.ceil(height / 8);
  
  // Print stream info
  console.log('Stream analysis:');
  for (let i = 0; i < streams.length; i++) {
    const s = streams[i];
    let zeros = 0;
    for (const b of s) if (b === 0) zeros++;
    const pct = (100 * zeros / s.length).toFixed(0);
    const isL4 = s.length === l4W * l4H;
    const isL3 = s.length === l3W * l3H;
    const marker = isL4 ? ' ← L4 size!' : isL3 ? ' ← L3 size!' : '';
    console.log(`  S${i.toString().padStart(2)}: ${s.length.toString().padStart(5)} bytes, ${pct.padStart(2)}% zeros${marker}`);
  }
  
  // LL4 from S16
  const ll4 = new Float32Array(l4W * l4H);
  for (let i = 0; i < streams[16].length && i < ll4.length; i++) {
    ll4[i] = streams[16][i];
  }
  
  // S17, S18 might be L4 detail bands (HH4, etc.)
  let hh4 = null, detail4 = null;
  if (streams[17] && streams[17].length >= l4W * l4H) {
    hh4 = new Float32Array(l4W * l4H);
    for (let i = 0; i < hh4.length; i++) {
      hh4[i] = zigzagDecode(streams[17][i]) * 0.5;  // Scale down
    }
  }
  if (streams[18] && streams[18].length >= l4W * l4H) {
    detail4 = new Float32Array(l4W * l4H);
    for (let i = 0; i < detail4.length; i++) {
      detail4[i] = zigzagDecode(streams[18][i]) * 0.5;
    }
  }
  
  // S4 is L3 size - likely a detail band
  let detail3 = null;
  if (streams[4] && streams[4].length >= l3W * l3H) {
    detail3 = new Float32Array(l3W * l3H);
    for (let i = 0; i < detail3.length; i++) {
      detail3[i] = zigzagDecode(streams[4][i]) * 2.0;  // Scale factor
    }
    console.log(`\nUsing S4 as L3 detail (zigzag decoded)`);
  }
  
  // Reconstruct
  console.log('\nReconstruction:');
  
  // L4 → L3 using wavelet
  let current, curW, curH;
  if (hh4) {
    console.log(`  L4 wavelet with detail...`);
    const result = inverseCDF53(ll4, hh4, detail4, null, l4W, l4H);
    current = result.data;
    curW = result.w;
    curH = result.h;
  } else {
    console.log(`  L4 bilinear upscale...`);
    current = bilinear(ll4, l4W, l4H, l3W, l3H);
    curW = l3W;
    curH = l3H;
  }
  
  // Add L3 detail
  if (detail3) {
    console.log(`  Adding L3 detail...`);
    for (let i = 0; i < Math.min(current.length, detail3.length); i++) {
      current[i] += detail3[i];
    }
  }
  
  // Upscale to full resolution
  console.log(`  Upscaling to ${width}x${height}...`);
  current = bilinear(current, curW, curH, width, height);
  
  // Normalize
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < width * height; i++) {
    if (current[i] < min) min = current[i];
    if (current[i] > max) max = current[i];
  }
  console.log(`  Value range: ${min.toFixed(1)} to ${max.toFixed(1)}`);
  
  // Output (inverted for diagram style)
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
const output = process.argv[3] || '/tmp/itw_direct.png';
decodeITW(input, output);
