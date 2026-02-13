import fs from 'node:fs';
import { decompressItwLzw } from './src/decompressors/itw-lzw';

const v1 = fs.readFileSync('./samples/itw_samples/93.ITW');
const expected = 316 * 238; // 75208

// V1 block table parsing
const tableOffset = 0x10;
const blockCount = v1.readUInt16BE(tableOffset + 2);
const dataStart = tableOffset + 4 + blockCount * 2;

console.log('Block count:', blockCount);
console.log('Data starts at:', dataStart, '= 0x' + dataStart.toString(16));

// Parse block end offsets
const blockEndOffsets: number[] = [];
for (let i = 0; i < blockCount; i++) {
  blockEndOffsets.push(v1.readUInt16BE(tableOffset + 4 + i * 2));
}
console.log('Block end offsets:', blockEndOffsets);

// Calculate block sizes
const blockSizes: number[] = [];
let prev = 0;
for (const end of blockEndOffsets) {
  blockSizes.push(end - prev);
  prev = end;
}
console.log('Block sizes:', blockSizes);

// Decompress each block
console.log('\n=== Decompressing blocks ===');
const chunks: Buffer[] = [];

for (let i = 0; i < blockCount; i++) {
  const start = dataStart + (i === 0 ? 0 : blockEndOffsets[i - 1]);
  const end = dataStart + blockEndOffsets[i];
  const block = v1.subarray(start, Math.min(end, v1.length));
  
  console.log(`\nBlock ${i}: file offset ${start}-${end}, size ${block.length}`);
  console.log(`  First 8 bytes: ${block.subarray(0, 8).toString('hex')}`);
  
  // Try different LZW options
  const tryOpts = [
    { streamHeader: true },
    { streamHeader: false, hasClearCode: false, maxBits: 12 },
    { streamHeader: false, hasClearCode: true, maxBits: 12 },
  ];
  
  let best: Buffer = Buffer.alloc(0);
  for (const opts of tryOpts) {
    try {
      const result = decompressItwLzw(block, { ...opts, maxOutput: expected });
      if (result.length > best.length) {
        best = result;
        console.log(`  ${JSON.stringify(opts).padEnd(55)} → ${result.length} bytes ✓`);
      }
    } catch (e: any) {
      // ignore
    }
  }
  
  if (best.length > 0) {
    chunks.push(best);
  }
}

const total = Buffer.concat(chunks);
console.log('\n=== Result ===');
console.log(`Total: ${total.length} bytes (expected ${expected}, ${((total.length/expected)*100).toFixed(1)}%)`);

if (total.length === expected) {
  console.log('✅ Perfect match!');
  fs.writeFileSync('/tmp/93_v1_fixed.raw', total);
}
