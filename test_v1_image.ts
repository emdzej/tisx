import fs from 'node:fs';
import sharp from 'sharp';

const v1 = fs.readFileSync('./samples/itw_samples/93.ITW');
const width = 316;
const height = 238;
const expected = width * height;

// Data starts at 0x1c
const dataStart = 0x1c;
const data = v1.subarray(dataStart);

// Decode simple RLE
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

const raw = decodeSimpleRle(data, expected);
console.log(`Decoded: ${raw.length} bytes`);

// Write raw
fs.writeFileSync('/tmp/93_v1_fixed.raw', raw);
console.log('Wrote /tmp/93_v1_fixed.raw');

// Write PNG
sharp(raw, { raw: { width, height, channels: 1 } })
  .png()
  .toFile('/tmp/93_v1_fixed.png')
  .then(() => console.log('Wrote /tmp/93_v1_fixed.png'));
