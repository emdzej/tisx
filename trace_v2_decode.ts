import fs from 'node:fs';
import sharp from 'sharp';
import { decompressItwFile } from './src/decompressors/itw-lzw';

// Test the full decode path for V2
const v2 = fs.readFileSync('./samples/itw_samples/34.ITW');
const result = decompressItwFile(v2);

console.log('V2 header:', result.header);
console.log('V2 decoded data:', result.data.length, 'bytes');
console.log('Expected:', result.header.width * result.header.height, 'bytes');

// Now test V1 through the same path
const v1 = fs.readFileSync('./samples/itw_samples/93.ITW');
const result1 = decompressItwFile(v1);

console.log('\nV1 header:', result1.header);
console.log('V1 decoded data:', result1.data.length, 'bytes');
console.log('Expected:', result1.header.width * result1.header.height, 'bytes');
