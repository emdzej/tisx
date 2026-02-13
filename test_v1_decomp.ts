import fs from 'node:fs';
import { decompressItwLzw } from './src/decompressors/itw-lzw';

const buf = fs.readFileSync('./samples/itw_samples/93.ITW');
const expected = 316 * 238; // 75208
const dataOffset = 768;  // 0x300

console.log(`Testing decompression from offset ${dataOffset} (0x${dataOffset.toString(16)})`);
console.log(`Data available: ${buf.length - dataOffset} bytes`);
console.log(`Expected output: ${expected} bytes\n`);

// Show first bytes of compressed data
const compressed = buf.subarray(dataOffset);
console.log('First 16 bytes of compressed data:');
console.log(compressed.subarray(0, 16).toString('hex'));
console.log('');

const tests = [
  { streamHeader: true },
  { streamHeader: false, hasClearCode: true, maxBits: 12 },
  { streamHeader: false, hasClearCode: false, maxBits: 12 },
  { streamHeader: false, hasClearCode: true, maxBits: 11 },
  { streamHeader: false, hasClearCode: false, maxBits: 11 },
  { streamHeader: false, hasClearCode: true, maxBits: 10 },
  { streamHeader: false, hasClearCode: false, maxBits: 10 },
  { streamHeader: false, hasClearCode: true, maxBits: 9 },
  { streamHeader: false, hasClearCode: false, maxBits: 9 },
];

for (const opts of tests) {
  try {
    const result = decompressItwLzw(compressed, { ...opts, maxOutput: expected * 2 });
    const pct = ((result.length / expected) * 100).toFixed(1);
    console.log(`${JSON.stringify(opts).padEnd(60)} → ${result.length} bytes (${pct}%)`);
    if (result.length === expected) {
      console.log('  ✅ MATCH!');
    }
  } catch (e: any) {
    console.log(`${JSON.stringify(opts).padEnd(60)} → ERROR: ${e.message}`);
  }
}
