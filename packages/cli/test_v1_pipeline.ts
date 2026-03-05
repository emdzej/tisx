/**
 * ITW V1 pipeline test: header → blocks → rescale LL → reconstruct → normalize → PNG
 */
import * as fs from 'fs';
import { PNG } from 'pngjs';
import { parseFileHeader, parseFrameHeader } from './src/decompressors/itw-v1-header.js';
import { extractZlibBlocks } from './src/decompressors/itw-v1-blocks.js';
import { reconstructLevel, splitEvenOdd } from './src/decompressors/itw-v1-wavelet.js';

const ITW_PATH = '/Users/emdzej/Documents/tis/GRAFIK/1/03/95/26.ITW';
const OUT_PATH = '/Users/emdzej/Documents/itw/ITW_V1_PIPELINE.png';

const buf = fs.readFileSync(ITW_PATH);
const fileHdr = parseFileHeader(buf);
const frameHdr = parseFrameHeader(buf, fileHdr.dataOffset);
console.log(`${fileHdr.width}x${fileHdr.height}, levels=${frameHdr.numLevels}, range=${frameHdr.rangeMin}-${frameHdr.rangeMax}`);

// 2 mystery bytes between frame header end and first zlib block
const blocks = extractZlibBlocks(buf, frameHdr.zlibOffset + 2);
console.log(`${blocks.length} blocks`);

const W = fileHdr.width, H = fileHdr.height;
const dims = [{ w: W, h: H }];
for (let i = 0; i < frameHdr.numLevels; i++) {
  const [lw] = splitEvenOdd(dims[i].w);
  const [lh] = splitEvenOdd(dims[i].h);
  dims.push({ w: lw, h: lh });
}

const llW = dims[4].w, llH = dims[4].h, llSize = llW * llH;

// LL rescaling from Ghidra
const fVar3 = frameHdr.rangeMax - frameHdr.rangeMin;
const midpoint = (fVar3 + frameHdr.rangeMin) * 0.5;
const scaleFactor = (frameHdr.rangeMin - fVar3) * 0.5 / 127.0;

const LL4 = new Float32Array(llSize);
for (let i = 0; i < llSize; i++) {
  LL4[i] = (blocks[18][i] - 127.0) * scaleFactor + midpoint;
}
console.log(`LL4: ${Math.min(...LL4).toFixed(1)}..${Math.max(...LL4).toFixed(1)}`);

// No details for now
const zero = (n: number) => new Float32Array(n);

// Reconstruct L4→L3
let curW = llW, curH = llH;
let current = reconstructLevel(
  LL4, zero(llSize), zero(llSize), zero(llSize),
  llW, llH, llW, llH, llW, llH, llW, llH,
  dims[3].w, dims[3].h,
);
curW = dims[3].w; curH = dims[3].h;

// L3→L2→L1→L0
for (let lv = 2; lv >= 0; lv--) {
  const tW = dims[lv].w, tH = dims[lv].h;
  const [lw, hw] = splitEvenOdd(tW);
  const [lh, hh] = splitEvenOdd(tH);
  current = reconstructLevel(
    current, zero(hw * curH), zero(curW * hh), zero(hw * hh),
    curW, curH, hw, curH, curW, hh, hw, hh, tW, tH,
  );
  curW = tW; curH = tH;
}

let min = Infinity, max = -Infinity;
for (const v of current) { if (v < min) min = v; if (v > max) max = v; }
console.log(`Output: ${min.toFixed(1)}..${max.toFixed(1)}`);

// Normalize to 0-255
const scale = 255 / (max - min);
const png = new PNG({ width: W, height: H, colorType: 0 });
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const v = Math.round(Math.max(0, Math.min(255, (current[x * curH + y] - min) * scale)));
    const idx = (y * W + x) * 4;
    png.data[idx] = v; png.data[idx+1] = v; png.data[idx+2] = v; png.data[idx+3] = 255;
  }
}
png.pack().pipe(fs.createWriteStream(OUT_PATH));
console.log(`Wrote ${OUT_PATH}`);
