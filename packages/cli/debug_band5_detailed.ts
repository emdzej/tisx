import * as fs from 'fs';
import * as zlib from 'zlib';
import { parseFileHeader, parseFrameHeader } from './src/decompressors/itw-v1-header.js';
import { splitEvenOdd } from './src/decompressors/itw-v1-wavelet.js';
import { buildDiffTable } from './src/decompressors/itw-v1-fischer.js';

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

// Skip bands 0-4
for (let b=0;b<5;b++) {
  const quant = QUANT[b];
  if (quant >= 2) {
    const compSizePos = buf.readUInt16BE(cursor.pos);
    cursor.pos += 2 + compSizePos;
    const posStream = zlib.inflateSync(buf.subarray(cursor.pos - compSizePos, cursor.pos));
    let extraBits = 0;
    for (const byte of posStream) if (byte & 0x80) extraBits += 4;
    cursor.pos += Math.ceil(extraBits / 8);
    const compSizeFischer = buf.readUInt16BE(cursor.pos);
    cursor.pos += 2 + compSizeFischer;
  } else {
    const compSize = buf.readUInt16BE(cursor.pos);
    cursor.pos += 2 + compSize;
  }
}

// Band 5
const b=5; const info=bandInfos[b]; const quant=QUANT[b];
const compSizePos = buf.readUInt16BE(cursor.pos);
cursor.pos += 2;
const posStream = zlib.inflateSync(buf.subarray(cursor.pos, cursor.pos + compSizePos));
cursor.pos += compSizePos;

console.log('Band 5:',info.width+'x'+info.height, 'quant='+quant, 'orient=0 (horizontal)');
console.log('Position stream:', posStream.length, 'entries');

// Simulate placement
const blocksPerRowBase = Math.floor(posStream.length / info.height);
const extraRows = posStream.length % info.height;
console.log('blocksPerRowBase:', blocksPerRowBase);
console.log('extraRows:', extraRows);

let placedCoeffs = 0;
let posIdx = 0;
for (let y = 0; y < info.height; y++) {
  const blocksXForRow = blocksPerRowBase + (y < extraRows ? 1 : 0);
  for (let blockX = 0; blockX < blocksXForRow && posIdx < posStream.length; blockX++) {
    const k = posStream[posIdx] & 0x7F;
    if (k > 0) {
      placedCoeffs += 5; // FISCHER_N
    }
    posIdx++;
  }
}

console.log('Placed coeffs if we decoded all:', placedCoeffs);
console.log('Actual in decoder: 73');
console.log('');

// Check first few rows to debug
posIdx = 0;
console.log('First 5 rows analysis:');
for (let y = 0; y < 5; y++) {
  const blocksXForRow = blocksPerRowBase + (y < extraRows ? 1 : 0);
  let rowNonzero = 0;
  for (let blockX = 0; blockX < blocksXForRow && posIdx < posStream.length; blockX++) {
    const k = posStream[posIdx] & 0x7F;
    if (k > 0) rowNonzero += 5;
    posIdx++;
  }
  console.log(`  y=${y}: ${blocksXForRow} blocks, would place ${rowNonzero} coeffs`);
}
