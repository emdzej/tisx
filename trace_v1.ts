import fs from 'node:fs';
import { parseItwHeader, parseItwBlockTable, decompressItwLzw } from './src/decompressors/itw-lzw';

const v1 = fs.readFileSync('./samples/itw_samples/93.ITW');

const header = parseItwHeader(v1);
console.log('Header:', header);

const blockTable = parseItwBlockTable(v1, header.dataOffset);
console.log('Block table:', blockTable);

// The block table for V1 shows dataOffset=768, which is wrong
// Let me try computing dataOffset differently
// Maybe for V1, data starts at 0x10 + block_table_size

// Block table at 0x10:
// 2 bytes: file_size - 18
// 2 bytes: block_count
// 2*block_count bytes: block end offsets
// Then data starts

const tableOffset = 0x10;
const blockCount = v1.readUInt16BE(tableOffset + 2);
console.log('\nManual block table parsing:');
console.log('Block count from 0x12:', blockCount);

// Maybe byte12 indicates something different for V1
// Let's try: data starts at 0x10 + 4 + blockCount*2

const dataStart = tableOffset + 4 + blockCount * 2;
console.log('Data start (calculated):', dataStart, '= 0x' + dataStart.toString(16));

console.log('\n=== First bytes at calculated data start ===');
console.log(v1.subarray(dataStart, dataStart + 16).toString('hex'));

// Try LZW from there
const compressed = v1.subarray(dataStart);
console.log('\nTrying LZW decompression from offset', dataStart);

const tests = [
  { streamHeader: true },
  { streamHeader: false, hasClearCode: true, maxBits: 12 },
  { streamHeader: false, hasClearCode: false, maxBits: 12 },
  { streamHeader: false, hasClearCode: true, maxBits: 11 },
];

for (const opts of tests) {
  try {
    const result = decompressItwLzw(compressed, { ...opts, maxOutput: 100000 });
    console.log(`${JSON.stringify(opts).padEnd(60)} → ${result.length} bytes`);
  } catch (e: any) {
    console.log(`${JSON.stringify(opts).padEnd(60)} → ERROR: ${e.message}`);
  }
}
