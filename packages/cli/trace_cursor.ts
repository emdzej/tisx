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
const dims = [{ w: W, h: H }]; 
for (let i=0;i<4;i++) dims.push({ w: splitEvenOdd(dims[i].w)[0], h: splitEvenOdd(dims[i].h)[0] });
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
const cursor = { pos: frameHdr.zlibOffset };

for (let b=0; b<6; b++) {
  const info = bandInfos[b];
  const quant = QUANT[b];
  const bp = frameHdr.bands[b];
  const orient = frameHdr.bandPresence[b] ? 1 : 0;
  const before = cursor.pos;
  
  // Manual read to check position stream
  if (quant >= 2) {
    const compSizePos = buf.readUInt16BE(cursor.pos);
    const posStream = zlib.inflateSync(buf.subarray(cursor.pos + 2, cursor.pos + 2 + compSizePos));
    let nonzeroK = 0;
    for (const byte of posStream) if ((byte & 0x7F) > 0) nonzeroK++;
    console.log(`Band ${b}: cursor=${before}, compSizePos=${compSizePos}, posCount=${posStream.length}, nonzeroK=${nonzeroK}, orient=${orient}, first5pos=[${[...posStream.slice(0,5)].map(b=>(b&0x7F).toString())}]`);
  }
  
  const decoded = decodeBand(buf, cursor, info.width, info.height, quant, bp.value, bp.scale, orient, bp.offset, diffTable);
  let nonzero = 0;
  for (const v of decoded.data) if (v !== 0) nonzero++;
  console.log(`  → consumed=${cursor.pos - before}B, nonzero=${nonzero}/${decoded.data.length}`);
}
