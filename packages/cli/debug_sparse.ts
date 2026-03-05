import * as fs from 'fs';
import { PNG } from 'pngjs';
import { parseFileHeader, parseFrameHeader } from './src/decompressors/itw-v1-header.js';
import { splitEvenOdd } from './src/decompressors/itw-v1-wavelet.js';
import { buildDiffTable } from './src/decompressors/itw-v1-fischer.js';
import { decodeBand } from './src/decompressors/itw-v1-band.js';

const buf = fs.readFileSync('/Users/emdzej/Documents/tis/GRAFIK/1/03/95/26.ITW');
const fileHdr = parseFileHeader(buf);
const frameHdr = parseFrameHeader(buf, fileHdr.dataOffset);
const W = fileHdr.width, H = fileHdr.height;

const dims = [{ w: W, h: H }];
for (let i = 0; i < 4; i++) dims.push({ w: splitEvenOdd(dims[i].w)[0], h: splitEvenOdd(dims[i].h)[0] });

const QUANT = [8, 8, 4, 4, 4, 2, 2, 2, 1, 1, 1];
const bandInfos = [
  { width: dims[1].w, height: splitEvenOdd(H)[1] },
  { width: splitEvenOdd(W)[1], height: dims[1].h },
  { width: dims[2].w, height: splitEvenOdd(dims[1].h)[1] },
  { width: splitEvenOdd(dims[1].w)[1], height: dims[2].h },
  { width: splitEvenOdd(dims[1].w)[1], height: splitEvenOdd(dims[1].h)[1] },
  { width: dims[3].w, height: splitEvenOdd(dims[2].h)[1] },
  { width: splitEvenOdd(dims[2].w)[1], height: dims[3].h },
  { width: splitEvenOdd(dims[2].w)[1], height: splitEvenOdd(dims[2].h)[1] },
  { width: dims[4].w, height: splitEvenOdd(dims[3].h)[1] },
  { width: splitEvenOdd(dims[3].w)[1], height: dims[4].h },
  { width: splitEvenOdd(dims[3].w)[1], height: splitEvenOdd(dims[3].h)[1] },
];

const diffTable = buildDiffTable();
const cursor = { pos: frameHdr.zlibOffset };

// Decode band 0 (L1 LH, quant=8)
const band0 = decodeBand(buf, cursor, bandInfos[0].width, bandInfos[0].height, QUANT[0],
  frameHdr.bands[0].value, frameHdr.bands[0].scale, 1, frameHdr.bands[0].offset, diffTable);

console.log('Band 0 (L1 LH):');
console.log('  Size:', band0.width, 'x', band0.height, '=', band0.data.length);

// Count nonzero
let nonzero = 0, zeros = 0;
for (const v of band0.data) {
  if (v !== 0) nonzero++; else zeros++;
}
console.log('  Nonzero:', nonzero, '/', band0.data.length, '(', (nonzero/band0.data.length*100).toFixed(1), '%)');

// Sample some values
console.log('  First 20 values:', [...band0.data.slice(0, 20)].map(v => v.toFixed(2)).join(', '));

// Distribution
const bins = new Array(10).fill(0);
for (const v of band0.data) {
  if (v === 0) bins[0]++;
  else if (Math.abs(v) < 1) bins[1]++;
  else if (Math.abs(v) < 5) bins[2]++;
  else if (Math.abs(v) < 10) bins[3]++;
  else if (Math.abs(v) < 20) bins[4]++;
  else bins[5]++;
}
console.log('  Distribution: 0:', bins[0], ', <1:', bins[1], ', <5:', bins[2], ', <10:', bins[3], ', <20:', bins[4], ', >=20:', bins[5]);

// Visualize band 0 as image
const png = new PNG({ width: band0.width, height: band0.height, colorType: 0 });
let minV = Infinity, maxV = -Infinity;
for (const v of band0.data) { minV = Math.min(minV, v); maxV = Math.max(maxV, v); }
const scale = 255 / (maxV - minV || 1);
for (let y = 0; y < band0.height; y++) {
  for (let x = 0; x < band0.width; x++) {
    const v = Math.round((band0.data[x * band0.height + y] - minV) * scale);
    const idx = (y * band0.width + x) * 4;
    png.data[idx] = v; png.data[idx+1] = v; png.data[idx+2] = v; png.data[idx+3] = 255;
  }
}
fs.writeFileSync('/Users/emdzej/Documents/itw/BAND0_L1_LH.png', PNG.sync.write(png));
console.log('  Wrote BAND0_L1_LH.png');
