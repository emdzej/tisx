#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { decodeItwV1, parseItwHeader } from './decompressors/itw-v1-decoder.js';
import { encodePng } from './utils/png.js';

function printUsage() {
  console.log(`
tisx - TIS image format decoder

Usage:
  tisx decode <file.itw> [output.png] [--mode=bilinear|cdf53]
  tisx info <file.itw>
  tisx help

Modes:
  bilinear  Smooth upscale from LL4 (default, best quality)
  cdf53     CDF 5/3 wavelet reconstruction

Examples:
  tisx decode image.itw
  tisx decode image.itw out.png --mode=cdf53
`);
}

function cmdInfo(filePath: string) {
  const data = fs.readFileSync(filePath);
  const header = parseItwHeader(data);
  
  console.log(`File: ${path.basename(filePath)}`);
  console.log(`Size: ${data.length} bytes`);
  console.log(`Magic: ${header.magic}`);
  console.log(`Format: ITW V${header.formatVersion === 0x0300 ? '1' : '?'} (0x${header.formatVersion.toString(16)})`);
  console.log(`Dimensions: ${header.width}×${header.height}`);
  console.log(`Compressed: ${header.compressedSize} bytes`);
}

type DecodeMode = 'bilinear' | 'cdf53';

function cmdDecode(filePath: string, outputPath?: string, mode: DecodeMode = 'bilinear') {
  const data = fs.readFileSync(filePath);
  const header = parseItwHeader(data);
  
  if (header.formatVersion !== 0x0300) {
    console.error(`Unsupported: 0x${header.formatVersion.toString(16)} (only V1/0x0300)`);
    process.exit(1);
  }
  
  console.log(`Decoding: ${path.basename(filePath)} (${header.width}×${header.height}, mode=${mode})`);
  const result = decodeItwV1(data, { mode });
  
  const output = outputPath || filePath.replace(/\.itw$/i, '.png');
  fs.writeFileSync(output, encodePng(result.pixels, result.width, result.height));
  console.log(`Saved: ${output}`);
}

const args = process.argv.slice(2);
const cmd = args[0];

let mode: DecodeMode = 'bilinear';
const modeArg = args.find(a => a.startsWith('--mode='));
if (modeArg) {
  const modeVal = modeArg.split('=')[1];
  if (modeVal === 'bilinear' || modeVal === 'cdf53') mode = modeVal;
}

const nonFlagArgs = args.filter(a => !a.startsWith('--'));

switch (cmd) {
  case 'decode':
    if (!nonFlagArgs[1]) { console.error('Error: No input file'); process.exit(1); }
    cmdDecode(nonFlagArgs[1], nonFlagArgs[2], mode);
    break;
  case 'info':
    if (!nonFlagArgs[1]) { console.error('Error: No input file'); process.exit(1); }
    cmdInfo(nonFlagArgs[1]);
    break;
  case 'help': case '--help': case '-h': case undefined:
    printUsage();
    break;
  default:
    console.error(`Unknown: ${cmd}`);
    printUsage();
    process.exit(1);
}
