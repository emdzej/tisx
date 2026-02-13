import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { decompressItwFile } from '../src/decompressors/itw-lzw';

const samplesDir = path.join(__dirname, '../samples/itw_samples');
const files = ['34.ITW', '35.ITW', '36.ITW'];

async function generatePng(itwFile: string) {
  const itwPath = path.join(samplesDir, itwFile);
  const pngPath = path.join(samplesDir, itwFile.replace('.ITW', '.png'));
  
  console.log(`Processing ${itwFile}...`);
  
  const buffer = fs.readFileSync(itwPath);
  const result = decompressItwFile(buffer);
  
  const { width, height } = result.header;
  const data = result.data;
  
  console.log(`  Header: ${width}x${height}, bpp=${result.header.bpp}, version=${result.header.version}`);
  console.log(`  Data size: ${data.length} bytes (expected: ${width * height})`);
  
  // Convert grayscale to RGBA for sharp
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const gray = data[i] ?? 0;
    rgba[i * 4 + 0] = gray; // R
    rgba[i * 4 + 1] = gray; // G
    rgba[i * 4 + 2] = gray; // B
    rgba[i * 4 + 3] = 255;  // A
  }
  
  await sharp(rgba, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .png()
    .toFile(pngPath);
  
  console.log(`  Saved: ${pngPath}`);
}

async function main() {
  for (const file of files) {
    try {
      await generatePng(file);
    } catch (err) {
      console.error(`Error processing ${file}:`, err);
    }
  }
  console.log('Done!');
}

main();
