import { fischerDecode, buildDiffTable } from './src/decompressors/itw-v1-fischer.js';

const diffTable = buildDiffTable();

// Test: decode k=3, codeword=0
const decoded = fischerDecode(0, 3, diffTable);
console.log('fischerDecode(0, 3):', [...decoded]);

// All nonzero?
console.log('Nonzero count:', [...decoded].filter(v => v !== 0).length);
