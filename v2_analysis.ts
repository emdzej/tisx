import fs from 'node:fs';

const v2 = fs.readFileSync('./samples/itw_samples/34.ITW');

console.log('=== V2 (34.ITW) Header ===');
console.log('BE16@12 (dataOffset):', v2.readUInt16BE(12), '= 0x' + v2.readUInt16BE(12).toString(16));

console.log('\n=== V2 bytes from 0x10 to data offset ===');
console.log('This should be metadata or block table:');
for (let i = 0x10; i < 0x100; i += 16) {
  console.log('0x' + i.toString(16).padStart(2, '0') + ':', v2.subarray(i, Math.min(i + 16, 0x100)).toString('hex').match(/../g)?.join(' '));
}

console.log('\n=== V2 Data at 0x400 ===');
console.log(v2.subarray(0x400, 0x410).toString('hex'));
const firstByte = v2[0x400];
console.log('First byte:', '0x' + firstByte.toString(16), '→ maxBits=' + (firstByte & 0x1f), 'hasClear=' + ((firstByte & 0x80) !== 0));
