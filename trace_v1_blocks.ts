import fs from 'node:fs';
import { decompressItwLzw } from './src/decompressors/itw-lzw';

const buf = fs.readFileSync('./samples/itw_samples/93.ITW');
const width = 316;
const height = 238;
const expected = width * height;

// Parse block table
const blockCount = buf.readUInt16BE(0x12);
const blockEndOffsets: number[] = [];
for (let i = 0; i < blockCount; i++) {
  blockEndOffsets.push(buf.readUInt16BE(0x14 + i * 2));
}

const dataStart = 0x1c;
console.log('Block count:', blockCount);
console.log('Block end offsets:', blockEndOffsets);
console.log('Data start:', dataStart);

// Calculate block boundaries in file
const blockRanges: Array<{start: number, end: number, size: number}> = [];
for (let i = 0; i < blockCount; i++) {
  const start = dataStart + (i === 0 ? 0 : blockEndOffsets[i - 1]);
  const end = dataStart + blockEndOffsets[i];
  blockRanges.push({ start, end, size: end - start });
}

console.log('\nBlock file ranges:');
for (let i = 0; i < blockRanges.length; i++) {
  const r = blockRanges[i];
  console.log(`  Block ${i}: file offset ${r.start}-${r.end} (${r.size} bytes)`);
  console.log(`    First bytes: ${buf.subarray(r.start, Math.min(r.start + 16, r.end)).toString('hex')}`);
}

// Now try decompressing each block with various LZW options
console.log('\n=== Decompressing blocks ===');

const allChunks: Buffer[] = [];

for (let i = 0; i < blockCount; i++) {
  const r = blockRanges[i];
  const block = buf.subarray(r.start, Math.min(r.end, buf.length));
  
  console.log(`\nBlock ${i} (${block.length} bytes):`);
  
  // Try multiple decompression strategies
  const strategies = [
    { name: 'streamHeader=true', opts: { streamHeader: true } },
    { name: 'maxBits=12,clear=false', opts: { streamHeader: false, hasClearCode: false, maxBits: 12 } },
    { name: 'maxBits=12,clear=true', opts: { streamHeader: false, hasClearCode: true, maxBits: 12 } },
    { name: 'maxBits=11,clear=false', opts: { streamHeader: false, hasClearCode: false, maxBits: 11 } },
    { name: 'maxBits=10,clear=false', opts: { streamHeader: false, hasClearCode: false, maxBits: 10 } },
  ];
  
  let bestResult: Buffer | null = null;
  let bestName = '';
  
  for (const s of strategies) {
    try {
      const result = decompressItwLzw(block, { ...s.opts, maxOutput: expected });
      console.log(`  ${s.name.padEnd(30)} → ${result.length} bytes`);
      if (!bestResult || result.length > bestResult.length) {
        bestResult = result;
        bestName = s.name;
      }
    } catch (e) {
      console.log(`  ${s.name.padEnd(30)} → ERROR`);
    }
  }
  
  if (bestResult) {
    console.log(`  Best: ${bestName} (${bestResult.length} bytes)`);
    allChunks.push(bestResult);
  }
}

const total = Buffer.concat(allChunks);
console.log(`\n=== Total LZW output: ${total.length} bytes ===`);

// Now this might be RLE encoded
// Try decoding as RLE
function decodeSimpleRle(input: Buffer, maxOutput: number): Buffer {
  const output = Buffer.alloc(maxOutput);
  let outPos = 0;
  let inPos = 0;
  
  while (inPos + 1 < input.length && outPos < maxOutput) {
    const count = input[inPos++];
    const value = input[inPos++];
    const runLen = count + 1;
    
    for (let i = 0; i < runLen && outPos < maxOutput; i++) {
      output[outPos++] = value;
    }
  }
  
  return output.subarray(0, outPos);
}

const rleDecoded = decodeSimpleRle(total, expected);
console.log(`After RLE decode: ${rleDecoded.length} bytes (expected ${expected})`);

if (rleDecoded.length === expected) {
  fs.writeFileSync('/tmp/93_lzw_rle.raw', rleDecoded);
  console.log('Wrote /tmp/93_lzw_rle.raw');
}
