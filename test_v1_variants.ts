import fs from 'node:fs';
import sharp from 'sharp';

const v1 = fs.readFileSync('./samples/itw_samples/93.ITW');
const width = 316;
const height = 238;
const expected = width * height;

const dataStart = 0x1c;
const data = v1.subarray(dataStart);

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

async function main() {
  // Transpose (column-major to row-major)
  const transposed = Buffer.alloc(expected);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      transposed[y * width + x] = raw[x * height + y];
    }
  }

  await sharp(raw, { raw: { width, height, channels: 1 } }).png().toFile('/tmp/93_original.png');
  await sharp(transposed, { raw: { width, height, channels: 1 } }).png().toFile('/tmp/93_transposed.png');
  
  // Also try 238x316
  await sharp(raw, { raw: { width: height, height: width, channels: 1 } }).png().toFile('/tmp/93_swapped.png');
  
  console.log('Done');
}

main();
