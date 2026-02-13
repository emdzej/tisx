import fs from 'node:fs';

const v1 = fs.readFileSync('./samples/itw_samples/93.ITW');

const dataOffset = 768; // from current header parse
const tableOffset = 0x10;

console.log('File length:', v1.length);
console.log('tableOffset:', tableOffset);
console.log('dataOffset:', dataOffset);

// From parseItwBlockTable:
if (v1.length < tableOffset + 4) {
  console.log('FAIL: buffer too small for header');
} else {
  const fileSizeMinus18 = v1.readUInt16BE(tableOffset);
  const blockCount = v1.readUInt16BE(tableOffset + 2);
  
  console.log('fileSizeMinus18:', fileSizeMinus18, '(actual:', v1.length - 18, ')');
  console.log('blockCount:', blockCount);
  
  if (blockCount <= 0 || blockCount > 0x2000) {
    console.log('FAIL: invalid block count');
  } else {
    const totalValues = blockCount + 2;
    const requiredBytes = totalValues * 2;
    console.log('Required bytes for block table:', requiredBytes);
    
    if (v1.length < tableOffset + requiredBytes) {
      console.log('FAIL: buffer too small for block table');
    } else {
      const blockEndOffsets: number[] = [];
      for (let i = 0; i < blockCount; i++) {
        blockEndOffsets.push(v1.readUInt16BE(tableOffset + 4 + i * 2));
      }
      console.log('Block end offsets:', blockEndOffsets);
      
      // Validation: check if last offset is <= buffer.length - dataOffset
      const maxDataSize = v1.length - dataOffset;
      const lastOffset = blockEndOffsets[blockEndOffsets.length - 1];
      console.log('maxDataSize (buffer.length - dataOffset):', maxDataSize);
      console.log('Last block end offset:', lastOffset);
      
      if (lastOffset > maxDataSize) {
        console.log('FAIL: last offset exceeds maxDataSize');
        console.log('This is why parseItwBlockTable returns null!');
      }
    }
  }
}

// The problem: dataOffset = 768 but file is only 8353 bytes
// So maxDataSize = 8353 - 768 = 7585
// But block end offsets include 8194 which is > 7585
// So the block table validation fails

console.log('\n=== The Fix ===');
console.log('For V1, the block table offsets are relative to data area AFTER block table');
console.log('Data area starts at: 0x10 + 4 + blockCount*2 = 28');
console.log('So maxDataSize should be: file.length - 28 =', v1.length - 28);
console.log('Last offset 8194 <=', v1.length - 28, '?', 8194 <= v1.length - 28);
