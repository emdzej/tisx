#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { decompressItwFile } from './decompressors/itw-lzw';

function printHelp() {
  const help = `tisx - BMW TIS ITW tools

Usage:
  decomp-itw <input.itw> <output>

Options:
  --raw           write raw output only (default)
  --pgm           write PGM (8bpp only)
  -h, --help      show help

Examples:
  decomp-itw samples/itw_samples/34.ITW out.raw
  decomp-itw samples/itw_samples/34.ITW out.pgm --pgm
`;
  process.stdout.write(help);
}

function writePgm(width: number, height: number, data: Buffer, outPath: string) {
  const header = `P5\n${width} ${height}\n255\n`;
  const out = Buffer.concat([Buffer.from(header, 'ascii'), data]);
  fs.writeFileSync(outPath, out);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp();
    return;
  }

  const input = args[0];
  const output = args[1];
  const writePgmFlag = args.includes('--pgm');

  if (!input || !output) {
    printHelp();
    process.exit(1);
  }

  const buffer = fs.readFileSync(input);
  const { header, data } = decompressItwFile(buffer);

  if (writePgmFlag || output.toLowerCase().endsWith('.pgm')) {
    if (header.bpp !== 8) {
      throw new Error(`PGM output only supports 8bpp. Found ${header.bpp}bpp.`);
    }
    writePgm(header.width, header.height, data, output);
  } else {
    fs.writeFileSync(output, data);
  }

  const outRel = path.relative(process.cwd(), output);
  process.stdout.write(
    `Wrote ${data.length} bytes (${header.width}x${header.height}, ${header.bpp}bpp) to ${outRel}\n`
  );
}

main();
