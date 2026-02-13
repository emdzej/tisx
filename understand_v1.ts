import fs from 'node:fs';

// Compare multiple V1 files to find pattern
const files = [
  '/Users/emdzej/Documents/tis/GRAFIK/1/03/95/00.ITW',
  '/Users/emdzej/Documents/tis/GRAFIK/1/03/95/06.ITW', // smallest
  './samples/itw_samples/93.ITW', // our test file (26.ITW copy)
];

for (const f of files) {
  const buf = fs.readFileSync(f);
  const width = buf.readUInt16BE(6);
  const height = buf.readUInt16BE(8);
  const expected = width * height;
  
  console.log(`\n=== ${f} ===`);
  console.log(`Size: ${buf.length}, Dims: ${width}x${height}, Expected: ${expected}`);
  
  // Block table at 0x10
  const fileSizeMinus18 = buf.readUInt16BE(0x10);
  const blockCount = buf.readUInt16BE(0x12);
  console.log(`Block table: fileSizeMinus18=${fileSizeMinus18} (actual=${buf.length-18}), blockCount=${blockCount}`);
  
  const blockEndOffsets: number[] = [];
  for (let i = 0; i < blockCount; i++) {
    blockEndOffsets.push(buf.readUInt16BE(0x14 + i * 2));
  }
  console.log('Block end offsets:', blockEndOffsets);
  
  // Data starts after block table
  const dataStart = 0x14 + blockCount * 2;
  console.log(`Data starts at: 0x${dataStart.toString(16)} (${dataStart})`);
  
  // Look at data
  console.log(`First 16 bytes of data: ${buf.subarray(dataStart, dataStart + 16).toString('hex')}`);
  
  // The block offsets are relative to dataStart
  // Last block should end at fileSize - dataStart
  const dataAreaSize = buf.length - dataStart;
  console.log(`Data area size: ${dataAreaSize}, last block end: ${blockEndOffsets[blockEndOffsets.length - 1]}`);
  
  // Check if offsets make sense
  if (blockEndOffsets[blockEndOffsets.length - 1] <= dataAreaSize) {
    console.log('✓ Block offsets valid');
  } else {
    console.log('✗ Block offsets INVALID - last offset exceeds data area');
  }
}
