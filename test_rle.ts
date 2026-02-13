import fs from 'node:fs';

const v1 = fs.readFileSync('./samples/itw_samples/93.ITW');
const expected = 316 * 238; // 75208

// Data at 0x1c looks like: 41 00 0c 01 20 02 be 00 ...
// This could be RLE: count value count value ...
// Or: value count value count...

const dataStart = 0x1c;
const data = v1.subarray(dataStart);

console.log('First 32 bytes of data:');
for (let i = 0; i < 32; i += 2) {
  console.log(`  [${i}] ${data[i].toString(16).padStart(2, '0')} ${data[i+1].toString(16).padStart(2, '0')} → count=${data[i]} value=${data[i+1]} OR value=${data[i]} count=${data[i+1]}`);
}

// Try "simple RLE": pairs of (count, value)
function decodeSimpleRle(input: Buffer, expected: number): Buffer {
  const output = Buffer.alloc(expected);
  let outPos = 0;
  let inPos = 0;
  
  while (inPos + 1 < input.length && outPos < expected) {
    const count = input[inPos++];
    const value = input[inPos++];
    const runLen = count + 1;  // or just count
    
    for (let i = 0; i < runLen && outPos < expected; i++) {
      output[outPos++] = value;
    }
  }
  
  return output.subarray(0, outPos);
}

// Try "value first RLE": pairs of (value, count)  
function decodeValueFirstRle(input: Buffer, expected: number): Buffer {
  const output = Buffer.alloc(expected);
  let outPos = 0;
  let inPos = 0;
  
  while (inPos + 1 < input.length && outPos < expected) {
    const value = input[inPos++];
    const count = input[inPos++];
    const runLen = count + 1;
    
    for (let i = 0; i < runLen && outPos < expected; i++) {
      output[outPos++] = value;
    }
  }
  
  return output.subarray(0, outPos);
}

// Test
console.log('\n=== Testing RLE decoding ===');
const simple = decodeSimpleRle(data, expected);
console.log(`Simple RLE (count+1, value): ${simple.length} bytes (${((simple.length/expected)*100).toFixed(1)}%)`);

const valueFirst = decodeValueFirstRle(data, expected);
console.log(`Value-first RLE (value, count+1): ${valueFirst.length} bytes (${((valueFirst.length/expected)*100).toFixed(1)}%)`);

// Check unique values
const uniqueSimple = new Set(simple).size;
const uniqueValueFirst = new Set(valueFirst).size;
console.log(`Simple RLE unique values: ${uniqueSimple}`);
console.log(`Value-first RLE unique values: ${uniqueValueFirst}`);
