import fs from 'node:fs';
import sharp from 'sharp';
import { decompressItwLzw } from './src/decompressors/itw-lzw';

// Look at a working V2 file to understand the data format
const v2 = fs.readFileSync('./samples/itw_samples/34.ITW');
const v2Width = 316;
const v2Height = 235;
const v2Expected = v2Width * v2Height;

// V2 data starts at offset from BE16@12
const v2DataOffset = v2.readUInt16BE(12);
console.log('V2 data offset:', v2DataOffset);

const v2Compressed = v2.subarray(v2DataOffset);
console.log('V2 compressed first 16 bytes:', v2Compressed.subarray(0, 16).toString('hex'));

// Now let's look at V1 more carefully
const v1 = fs.readFileSync('./samples/itw_samples/93.ITW');

// What if V1 ALSO uses LZW, but the data offset is wrong?
// Let's try decompressing from different offsets

console.log('\n=== Testing LZW from various V1 offsets ===');

const v1Expected = 316 * 238;
const offsets = [0x10, 0x14, 0x1c, 0x20, 0x58];

for (const offset of offsets) {
  const compressed = v1.subarray(offset);
  console.log(`\nOffset 0x${offset.toString(16)}: first 8 bytes = ${compressed.subarray(0, 8).toString('hex')}`);
  
  // Try with streamHeader
  try {
    const result = decompressItwLzw(compressed, { streamHeader: true, maxOutput: v1Expected * 2 });
    console.log(`  streamHeader=true → ${result.length} bytes`);
  } catch (e: any) {
    console.log(`  streamHeader=true → ERROR`);
  }
}

// Check what value distribution looks like for decoded V2
console.log('\n=== Looking at what V2 LZW output looks like ===');

// V2 uses LZW then RLE
// First decompress LZW, then check if output is RLE
try {
  const lzwOut = decompressItwLzw(v2Compressed, { streamHeader: true, maxOutput: v2Expected * 2 });
  console.log('V2 LZW output:', lzwOut.length, 'bytes');
  console.log('First 32 bytes of V2 LZW output:', lzwOut.subarray(0, 32).toString('hex'));
  
  // This looks like RLE pairs
  // Let's decode it
  function decodeSimpleRle(input: Buffer, expected: number): Buffer {
    const output = Buffer.alloc(expected);
    let outPos = 0;
    let inPos = 0;
    
    while (inPos + 1 < input.length && outPos < expected) {
      const count = input[inPos++];
      const value = input[inPos++];
      const runLen = count + 1;
      
      for (let i = 0; i < runLen && outPos < expected; i++) {
        output[outPos++] = value;
      }
    }
    
    return output.subarray(0, outPos);
  }
  
  const v2Decoded = decodeSimpleRle(lzwOut, v2Expected);
  console.log('V2 after RLE decode:', v2Decoded.length, 'bytes (expected', v2Expected, ')');
} catch (e: any) {
  console.log('V2 LZW error:', e.message);
}
