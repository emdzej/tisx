import * as fs from 'fs';
import * as zlib from 'zlib';
import { parseFileHeader, parseFrameHeader } from './src/decompressors/itw-v1-header.js';

const buf = fs.readFileSync('/Users/emdzej/Documents/tis/GRAFIK/1/03/95/26.ITW');
const fileHdr = parseFileHeader(buf);
const frameHdr = parseFrameHeader(buf, fileHdr.dataOffset);

let cursor = frameHdr.zlibOffset;

// Band 0 (L1 LH, quant=8)
const compSizePos = buf.readUInt16BE(cursor);
cursor += 2;
const posStream = zlib.inflateSync(buf.subarray(cursor, cursor + compSizePos));

// Fischer sum interpretation:
// If position value = k = sum of absolute values
// Then k=0 means all 5 coefficients are zero
// k=1 means one coefficient is ±1
// etc.

// Count by k value
const kCounts = new Map<number, number>();
for (const b of posStream) {
  const k = b & 0x7F;
  kCounts.set(k, (kCounts.get(k) || 0) + 1);
}

console.log('Position (k) distribution:');
const sorted = [...kCounts.entries()].sort((a,b) => a[0] - b[0]);
sorted.forEach(([k, cnt]) => {
  // Number of nonzero coefficients this k contributes:
  // If k > 0, we get FISCHER_N=5 decoded values (some may be 0)
  console.log('  k=' + k + ':', cnt, k > 0 ? '(contributes to nonzero)' : '(skip block)');
});

// Total blocks with k>0
const nonzeroBlocks = sorted.filter(([k]) => k > 0).reduce((acc, [, cnt]) => acc + cnt, 0);
console.log('\nTotal nonzero blocks:', nonzeroBlocks);
console.log('Each block = FISCHER_N coefficients decoded');
console.log('Expected coefficients:', nonzeroBlocks * 5);
console.log('Actual nonzero from decoder: 1782');
