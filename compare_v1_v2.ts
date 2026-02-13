import fs from 'node:fs';

const v1 = fs.readFileSync('./samples/itw_samples/93.ITW'); // V1
const v2 = fs.readFileSync('./samples/itw_samples/34.ITW'); // V2

console.log('=== V1 (93.ITW) ===');
console.log('File size:', v1.length);
console.log('Dimensions:', v1.readUInt16BE(6), 'x', v1.readUInt16BE(8));
console.log('BPP:', v1.readUInt16BE(10));
console.log('Byte[12]:', v1[12], '(0x' + v1[12].toString(16) + ')');
console.log('Byte[13]:', v1[13], '(0x' + v1[13].toString(16) + ')');
console.log('BE16@12:', v1.readUInt16BE(12));
console.log('Bytes 14-15:', v1[14], v1[15]);

console.log('\n=== V2 (34.ITW) ===');
console.log('File size:', v2.length);
console.log('Dimensions:', v2.readUInt16BE(6), 'x', v2.readUInt16BE(8));
console.log('BPP:', v2.readUInt16BE(10));
console.log('Byte[12]:', v2[12], '(0x' + v2[12].toString(16) + ')');
console.log('Byte[13]:', v2[13], '(0x' + v2[13].toString(16) + ')');
console.log('BE16@12:', v2.readUInt16BE(12));
console.log('Bytes 14-15:', v2[14], v2[15]);

// In V2, bytes 12-13 = 0x0400 = 1024, which is the data offset (compressed stream starts there)
// Let's test decompression from offset 0x0400 for V2
console.log('\n=== V2 Data Offset ===');
console.log('V2 dataOffset from BE16@12:', v2.readUInt16BE(12), '(0x' + v2.readUInt16BE(12).toString(16) + ')');
console.log('V2 first 8 bytes at offset 0x400:', v2.subarray(0x400, 0x408).toString('hex'));

// For V1, the block table is at 0x10, but byte12 = 0x03
// Maybe 0x03 means "3 blocks" or something else?
console.log('\n=== V1 Analysis ===');
console.log('If byte12=block count:', v1[12], 'blocks');

// Let's look at what's actually at offset 0x10 in V1
console.log('V1 bytes at 0x10-0x30:');
for (let i = 0x10; i < 0x30; i += 2) {
  const be = v1.readUInt16BE(i);
  const le = v1.readUInt16LE(i);
  console.log(`  0x${i.toString(16)}: BE=${be.toString().padStart(5)} LE=${le.toString().padStart(5)}  ${v1.subarray(i, i+2).toString('hex')}`);
}
