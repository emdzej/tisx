import * as fs from 'fs';
import * as zlib from 'zlib';
import { parseFileHeader, parseFrameHeader } from './src/decompressors/itw-v1-header.js';
import { splitEvenOdd } from './src/decompressors/itw-v1-wavelet.js';

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

let cursor = frameHdr.zlibOffset;

// Skip bands 0-4
for (let b = 0; b < 5; b++) {
  const quant = QUANT[b];
  if (quant >= 2) {
    // Position stream
    const compSizePos = buf.readUInt16BE(cursor);
    cursor += 2 + compSizePos;
    // Skip bits
    const posStream = zlib.inflateSync(buf.subarray(cursor - compSizePos, cursor));
    let extraBits = 0;
    for (const byte of posStream) if (byte & 0x80) extraBits += 4;
    cursor += Math.ceil(extraBits / 8);
    // Fischer stream
    const compSizeFischer = buf.readUInt16BE(cursor);
    cursor += 2 + compSizeFischer;
  } else {
    // Quant < 2: simple zlib
    const compSize = buf.readUInt16BE(cursor);
    cursor += 2 + compSize;
  }
  console.log(`Skipped band ${b}, cursor now at ${cursor}`);
}

// Band 5
console.log('\n=== Band 5 (L3 LH) ===');
const b5Info = bandInfos[5];
const b5Quant = QUANT[5];
console.log(`Size: ${b5Info.width}x${b5Info.height}, quant=${b5Quant}`);

const compSizePos5 = buf.readUInt16BE(cursor);
cursor += 2;
const posStream5 = zlib.inflateSync(buf.subarray(cursor, cursor + compSizePos5));
cursor += compSizePos5;

console.log(`Position stream: ${posStream5.length} entries`);
console.log(`Expected (W * ceil(H/quant)): ${b5Info.width} * ${Math.ceil(b5Info.height/b5Quant)} = ${b5Info.width * Math.ceil(b5Info.height/b5Quant)}`);
console.log(`Expected (H * ceil(W/quant)): ${b5Info.height} * ${Math.ceil(b5Info.width/b5Quant)} = ${b5Info.height * Math.ceil(b5Info.width/b5Quant)}`);

// K distribution
const kCounts = new Map<number, number>();
for (const b of posStream5) {
  const k = b & 0x7F;
  kCounts.set(k, (kCounts.get(k) || 0) + 1);
}
console.log('\nK distribution:');
const sorted = [...kCounts.entries()].sort((a,b) => a[0] - b[0]);
sorted.forEach(([k, cnt]) => console.log(`  k=${k}: ${cnt}`));

const nonzeroBlocks = sorted.filter(([k]) => k > 0).reduce((acc, [, cnt]) => acc + cnt, 0);
console.log(`\nNonzero blocks: ${nonzeroBlocks}`);
console.log(`Expected nonzero pixels: ${nonzeroBlocks * 5}`);
