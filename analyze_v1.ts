import fs from 'node:fs';

const buf = fs.readFileSync('./samples/itw_samples/93.ITW');
const expected = 316 * 238; // 75208

console.log('=== V1 FILE STRUCTURE ANALYSIS ===');
console.log('File size:', buf.length);

// Header bytes
console.log('\nHeader (0x00-0x0F):');
console.log(buf.subarray(0, 16).toString('hex').match(/../g)?.join(' '));

// What's at 0x10? (block table location in V1)
console.log('\nAt 0x10 (block table start?):');
console.log(buf.subarray(0x10, 0x20).toString('hex').match(/../g)?.join(' '));

// Parse block table at 0x10
const tableOffset = 0x10;
const val1 = buf.readUInt16BE(tableOffset);      // 0x208f = 8335 
const val2 = buf.readUInt16BE(tableOffset + 2);  // 0x0004 = 4 (block count?)

console.log('\nBlock table parsing:');
console.log(`  [0x10] BE16 = ${val1} (0x${val1.toString(16)})`);
console.log(`  [0x12] BE16 = ${val2} (0x${val2.toString(16)}) - possible block count`);

if (val2 > 0 && val2 < 100) {
  console.log(`\n  Block end offsets (${val2} blocks):`);
  for (let i = 0; i < val2; i++) {
    const endOffset = buf.readUInt16BE(tableOffset + 4 + i * 2);
    console.log(`    Block ${i}: end at ${endOffset} (0x${endOffset.toString(16)})`);
  }
  
  // Calculate where data starts after block table
  const blockTableEnd = tableOffset + 4 + val2 * 2;
  console.log(`\n  Block table ends at: ${blockTableEnd} (0x${blockTableEnd.toString(16)})`);
  console.log(`  Data at block table end: ${buf.subarray(blockTableEnd, blockTableEnd + 16).toString('hex')}`);
}

// Try to understand where compressed data really starts
console.log('\n=== Searching for LZW stream header byte ===');
for (let offset = 0x10; offset < 0x100; offset++) {
  const byte = buf[offset];
  // LZW stream header: bit 7 = hasClearCode, bits 0-4 = maxBits
  // Typical values: 0x8c (12-bit with clear), 0x0c (12-bit no clear)
  if ((byte & 0x1f) >= 9 && (byte & 0x1f) <= 16) {
    const maxBits = byte & 0x1f;
    const hasClear = (byte & 0x80) !== 0;
    console.log(`  0x${offset.toString(16)}: 0x${byte.toString(16)} → maxBits=${maxBits}, hasClearCode=${hasClear}`);
  }
}
