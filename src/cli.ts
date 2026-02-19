#!/usr/bin/env node
/**
 * tisx - TIS image format decoder
 */

import * as fs from 'fs';
import * as path from 'path';
import { decodeItwV1, parseItwHeader } from './decompressors/itw-v1-decoder.js';
import { encodePng } from './utils/png.js';

function printUsage() {
  console.log(`
tisx - TIS image format decoder

Usage:
  tisx decode <file.itw> [output.png]   Decode ITW file to PNG
  tisx info <file.itw>                  Show file information
  tisx help                             Show this help

Examples:
  tisx decode image.itw                 Outputs image.png
  tisx decode image.itw output.png      Outputs output.png
  tisx info image.itw                   Show ITW header info
`);
}

function cmdInfo(filePath: string) {
  const data = fs.readFileSync(filePath);
  const header = parseItwHeader(data);
  
  console.log(`File: ${path.basename(filePath)}`);
  console.log(`Size: ${data.length} bytes`);
  console.log(`Magic: ${header.magic}`);
  console.log(`Format: ITW V${header.formatVersion === 0x0300 ? '1' : header.formatVersion === 0x0400 ? '2' : '?'} (0x${header.formatVersion.toString(16)})`);
  console.log(`Dimensions: ${header.width}×${header.height}`);
  console.log(`Compressed: ${header.compressedSize} bytes`);
}

function cmdDecode(filePath: string, outputPath?: string) {
  const data = fs.readFileSync(filePath);
  const header = parseItwHeader(data);
  
  if (header.formatVersion !== 0x0300) {
    console.error(`Unsupported format: 0x${header.formatVersion.toString(16)} (only V1/0x0300 supported)`);
    process.exit(1);
  }
  
  console.log(`Decoding: ${path.basename(filePath)} (${header.width}×${header.height})`);
  
  const result = decodeItwV1(data);
  console.log(`Decoded: ${result.width}×${result.height}`);
  
  const output = outputPath || filePath.replace(/\.itw$/i, '.png');
  const png = encodePng(result.pixels, result.width, result.height);
  fs.writeFileSync(output, png);
  
  console.log(`Saved: ${output}`);
}

// Main
const args = process.argv.slice(2);
const cmd = args[0];

switch (cmd) {
  case 'decode':
    if (!args[1]) {
      console.error('Error: No input file specified');
      process.exit(1);
    }
    cmdDecode(args[1], args[2]);
    break;
    
  case 'info':
    if (!args[1]) {
      console.error('Error: No input file specified');
      process.exit(1);
    }
    cmdInfo(args[1]);
    break;
    
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    printUsage();
    break;
    
  default:
    console.error(`Unknown command: ${cmd}`);
    printUsage();
    process.exit(1);
}
