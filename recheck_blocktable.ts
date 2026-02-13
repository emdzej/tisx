import fs from 'node:fs';

const buf = fs.readFileSync('./samples/itw_samples/93.ITW');

console.log('Bytes 0x10-0x1c:');
for (let i = 0x10; i < 0x1c; i += 2) {
  const val = buf.readUInt16BE(i);
  console.log(`  0x${i.toString(16)}: ${val.toString().padStart(5)} (0x${val.toString(16).padStart(4, '0')})`);
}

// Block table interpretation:
// 0x10: fileSizeMinus18 = 8335
// 0x12: blockCount = 4
// 0x14-0x1b: 4 x BE16 block end offsets

const blockEndOffsets = [
  buf.readUInt16BE(0x14),
  buf.readUInt16BE(0x16),
  buf.readUInt16BE(0x18),
  buf.readUInt16BE(0x1a),
];

console.log('\nBlock end offsets:', blockEndOffsets);

// These are 506, 512, 2049, 8194
// But 512 = 0x200, 2049 = 0x801
// And 8194 = 0x2002

// Wait - maybe these are pairs of (offset, something)?
// Let me read as pairs
console.log('\nAlternative: maybe 2 blocks with 2 values each?');
const pairs = [
  [buf.readUInt16BE(0x14), buf.readUInt16BE(0x16)],
  [buf.readUInt16BE(0x18), buf.readUInt16BE(0x1a)],
];
console.log('Pairs:', pairs);

// Or maybe blockCount is at 0x10 and metadata at 0x12?
console.log('\nAlternative 2: blockCount at 0x10?');
console.log('BE16@0x10:', buf.readUInt16BE(0x10));
console.log('This would be', buf.readUInt16BE(0x10), 'blocks - too many');

// Look at actual V2 block table for comparison
const v2 = fs.readFileSync('./samples/itw_samples/34.ITW');
console.log('\n=== V2 at 0x10-0x20 ===');
for (let i = 0x10; i < 0x20; i += 2) {
  const val = v2.readUInt16BE(i);
  console.log(`  0x${i.toString(16)}: ${val.toString().padStart(5)} (0x${val.toString(16).padStart(4, '0')})`);
}
