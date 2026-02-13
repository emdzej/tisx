import fs from 'node:fs';
import zlib from 'node:zlib';

const buf = fs.readFileSync('./samples/itw_samples/93.ITW');

// Block 2 starts at 540, 1537 bytes
const block2 = buf.subarray(540, 540 + 1537);
console.log('Block 2 first 16 bytes:', block2.subarray(0, 16).toString('hex'));

// Try various decompression methods
try {
  const inflated = zlib.inflateSync(block2);
  console.log('zlib inflate:', inflated.length, 'bytes');
} catch (e) {
  console.log('zlib inflate: failed');
}

try {
  const inflatedRaw = zlib.inflateRawSync(block2);
  console.log('zlib inflateRaw:', inflatedRaw.length, 'bytes');
} catch (e) {
  console.log('zlib inflateRaw: failed');
}

try {
  const gunzipped = zlib.gunzipSync(block2);
  console.log('gunzip:', gunzipped.length, 'bytes');
} catch (e) {
  console.log('gunzip: failed');
}

// Check for 78 DA (zlib) or 1F 8B (gzip) signatures
console.log('\nSignature check:');
console.log('  First 2 bytes:', block2[0].toString(16), block2[1].toString(16));
console.log('  zlib (78 xx)?', block2[0] === 0x78);
console.log('  gzip (1f 8b)?', block2[0] === 0x1f && block2[1] === 0x8b);

// Block 3
const block3 = buf.subarray(2077, 2077 + 6145);
console.log('\nBlock 3 first 16 bytes:', block3.subarray(0, 16).toString('hex'));
console.log('  First 2 bytes:', block3[0].toString(16), block3[1].toString(16));

try {
  const inflated = zlib.inflateSync(block3);
  console.log('zlib inflate:', inflated.length, 'bytes');
} catch (e) {
  console.log('zlib inflate: failed');
}

try {
  const inflatedRaw = zlib.inflateRawSync(block3);
  console.log('zlib inflateRaw:', inflatedRaw.length, 'bytes');
} catch (e) {
  console.log('zlib inflateRaw: failed');
}
