import { buildDiffTable, fischerDecode, FISCHER_N, MAX_K } from './src/decompressors/itw-v1-fischer.js';

const diff = buildDiffTable();

console.log('Diff table (FISCHER_N=5, MAX_K=11):');
for (let i = 0; i < FISCHER_N; i++) {
  console.log(`  n=${i}:`, diff[i].map(v => v.toString().padStart(6)));
}

// Test: decode known simple cases
// For magnitudeSum=0, all outputs should be 0
const r0 = fischerDecode(0, 0, diff);
console.log('\nDecode(0, 0):', [...r0]);

// For magnitudeSum=1, codeword=0 should give [0,0,0,0,1] or similar
const r1 = fischerDecode(0, 1, diff);
console.log('Decode(0, 1):', [...r1]);

// Check total codewords for various (n, k) combos
console.log('\nRank table verification:');
console.log('rank[4][0] =', diff[4][0], '(expected 1 — all zeros)');
console.log('rank[4][1] =', diff[4][1], '(expected 11 — 5 positions × 2 signs + 1 all-zero)');
console.log('rank[4][5] =', diff[4][5]);
console.log('rank[4][10] =', diff[4][10]);

// Exhaustive test for n=5, k=1: enumerate all valid codewords
console.log('\nAll codewords for (n=5, k=1):');
const total = diff[4][1]; // rank[n-1=4][k=1]
for (let cw = 0; cw < total; cw++) {
  const r = fischerDecode(cw, 1, diff);
  const absSum = [...r].reduce((a, v) => a + Math.abs(v), 0);
  console.log(`  cw=${cw}: [${[...r]}] absSum=${absSum}`);
}
