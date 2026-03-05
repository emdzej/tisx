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
cursor += compSizePos;

console.log('Band 0 position stream:');
console.log('  Compressed size:', compSizePos);
console.log('  Decompressed size:', posStream.length);

// Analyze position values
const pos7bit = new Uint8Array(posStream.length);
const has80 = new Array<number>();
for (let i = 0; i < posStream.length; i++) {
  pos7bit[i] = posStream[i] & 0x7F;
  if (posStream[i] & 0x80) has80.push(i);
}

console.log('  Positions with 0x80 flag:', has80.length);

// Value distribution
const hist = new Map<number, number>();
for (const v of pos7bit) hist.set(v, (hist.get(v) || 0) + 1);
const sorted = [...hist.entries()].sort((a,b) => b[1] - a[1]);
console.log('  Top 10 position values:');
sorted.slice(0, 10).forEach(([val, cnt]) => console.log('    ', val, ':', cnt));

// Sum of positions (if positions are skip counts)
const totalSkip = Array.from(pos7bit).reduce((a,b) => a+b, 0);
console.log('  Sum of position values:', totalSkip);
console.log('  Matrix size:', 158 * 119, '=', 158*119);

// First 50 raw bytes
console.log('  First 50 bytes:', [...posStream.slice(0,50)].map(b => b.toString(16).padStart(2,'0')).join(' '));
