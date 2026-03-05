import * as fs from 'fs';
import * as zlib from 'zlib';
import { parseFileHeader, parseFrameHeader } from './src/decompressors/itw-v1-header.js';
import { splitEvenOdd } from './src/decompressors/itw-v1-wavelet.js';

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

let cursor = { pos: frameHdr.zlibOffset };
for (let b=0;b<6;b++) {
  const quant = QUANT[b];
  const info = bandInfos[b];
  const orient = frameHdr.bandPresence[b] ? 1 : 0;
  if (quant >= 2) {
    const compSizePos = buf.readUInt16BE(cursor.pos);
    cursor.pos += 2 + compSizePos;
    const posStream = zlib.inflateSync(buf.subarray(cursor.pos - compSizePos, cursor.pos));
    let extraBits = 0;
    for (const byte of posStream) if (byte & 0x80) extraBits += 4;
    cursor.pos += Math.ceil(extraBits / 8);
    const compSizeFischer = buf.readUInt16BE(cursor.pos);
    cursor.pos += 2 + compSizeFischer;
    console.log(`Band ${b}: ${info.width}x${info.height} (quant=${quant}, orient=${orient}) -> posCount=${posStream.length}`);
  } else {
    const compSize = buf.readUInt16BE(cursor.pos);
    cursor.pos += 2 + compSize;
  }
}
