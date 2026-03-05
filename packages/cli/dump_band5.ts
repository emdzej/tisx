import * as fs from 'fs';
import * as zlib from 'zlib';
import { parseFileHeader, parseFrameHeader } from './src/decompressors/itw-v1-header.js';
import { splitEvenOdd } from './src/decompressors/itw-v1-wavelet.js';
import { buildDiffTable } from './src/decompressors/itw-v1-fischer.js';
import { decodeBand } from './src/decompressors/itw-v1-band.js';

const buf = fs.readFileSync('/Users/emdzej/Documents/tis/GRAFIK/1/03/95/26.ITW');
const fileHdr = parseFileHeader(buf);
const frameHdr = parseFrameHeader(buf, fileHdr.dataOffset);
const W = fileHdr.width, H = fileHdr.height;
const dims = [{ w: W, h: H }]; for (let i=0;i<4;i++) dims.push({ w: splitEvenOdd(dims[i].w)[0], h: splitEvenOdd(dims[i].h)[0] });
const QUANT = [8,8,4,4,4,2,2,2,1,1,1];
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
let cursor = { pos: frameHdr.zlibOffset };
for (let b=0;b<5;b++) {
  const info = bandInfos[b];
  const bp = frameHdr.bands[b];
  decodeBand(buf, cursor, info.width, info.height, QUANT[b], bp.value, bp.scale, frameHdr.bandPresence[b]?1:0, bp.offset, diffTable);
}

// Now band5
const b=5; const info=bandInfos[b]; const bp=frameHdr.bands[b];
const res = decodeBand(buf, cursor, info.width, info.height, QUANT[b], bp.value, bp.scale, frameHdr.bandPresence[b]?1:0, bp.offset, diffTable);
let nonzero=0; let nzVals=[]; let zeros=0;
for (let i=0;i<res.data.length;i++){
  const v=res.data[i];
  if (v!==0) { nonzero++; if (nzVals.length<30) nzVals.push(v); }
  else zeros++;
}
console.log('Band5 size:', info.width+'x'+info.height, 'nonzero:', nonzero, 'zeros:', zeros);
console.log('Sample nonzero values:', nzVals.map(v=>v.toFixed(3)).join(', '));

// histogram absolute magnitude
const bins=[0,0,0,0,0,0];
for (let i=0;i<res.data.length;i++){
  const a=Math.abs(res.data[i]);
  if (a===0) bins[0]++;
  else if (a<1) bins[1]++;
  else if (a<5) bins[2]++;
  else if (a<10) bins[3]++;
  else if (a<20) bins[4]++;
  else bins[5]++;
}
console.log('Bins:', bins);

// dump positions nonzero count maybe mismapped
