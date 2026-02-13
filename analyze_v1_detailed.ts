import fs from 'node:fs';
import { decompressItwLzw, parseItwBlockTable, parseItwHeader } from './src/decompressors/itw-lzw';

const buf = fs.readFileSync('./samples/itw_samples/93.ITW');
const expected = 316 * 238; // 75208

const header = parseItwHeader(buf);
console.log('Parsed header:', header);

// The current code computes dataOffset = byte12 * 256 = 0x03 * 256 = 768
// But the file is only 8353 bytes and block table shows data much earlier

// Let me try a different interpretation
// Maybe byte12-13 is NOT the data offset, but something else
// And the actual data offset is fixed at 0x10 + block table size

console.log('\n=== Looking at block table ===');
const tableOffset = 0x10;

// First 2 bytes at 0x10: probably related to file size or something else
const meta1 = buf.readUInt16BE(tableOffset);     // 0x208f
const blockCount = buf.readUInt16BE(tableOffset + 2);  // 0x0004

console.log(`Meta at 0x10: ${meta1} (file size - 18 = ${buf.length - 18})`);
console.log(`Block count: ${blockCount}`);

if (blockCount > 0 && blockCount < 50) {
  const blockEndOffsets: number[] = [];
  for (let i = 0; i < blockCount; i++) {
    blockEndOffsets.push(buf.readUInt16BE(tableOffset + 4 + i * 2));
  }
  console.log('Block end offsets:', blockEndOffsets);
  
  // Block sizes
  const blockSizes: number[] = [];
  let prev = 0;
  for (const end of blockEndOffsets) {
    blockSizes.push(end - prev);
    prev = end;
  }
  console.log('Block sizes:', blockSizes);
  
  // Compute actual data start
  const dataStart = tableOffset + 4 + blockCount * 2;
  console.log(`Data starts at: ${dataStart} (0x${dataStart.toString(16)})`);
  
  // Try decompressing blocks
  console.log('\n=== Decompressing blocks ===');
  const chunks: Buffer[] = [];
  for (let i = 0; i < blockCount; i++) {
    const start = dataStart + (i === 0 ? 0 : blockEndOffsets[i - 1]);
    const end = dataStart + blockEndOffsets[i];
    const block = buf.subarray(start, Math.min(end, buf.length));
    
    console.log(`\nBlock ${i}: offset ${start}-${end}, size ${block.length}`);
    console.log(`  First 8 bytes: ${block.subarray(0, 8).toString('hex')}`);
    
    // The first byte might be LZW header
    const hdr = block[0];
    console.log(`  Header byte: 0x${hdr.toString(16)} → maxBits=${hdr & 0x1f}, hasClearCode=${(hdr & 0x80) !== 0}`);
    
    try {
      const result = decompressItwLzw(block, { streamHeader: true, maxOutput: expected });
      console.log(`  streamHeader=true → ${result.length} bytes`);
      chunks.push(result);
    } catch (e: any) {
      console.log(`  streamHeader=true → ERROR: ${e.message}`);
    }
  }
  
  const total = Buffer.concat(chunks);
  console.log(`\nTotal decompressed: ${total.length} bytes (expected ${expected}, ${((total.length/expected)*100).toFixed(1)}%)`);
}
