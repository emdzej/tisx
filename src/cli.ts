#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { decompressItwFile } from './decompressors/itw-lzw';

type OutputFormat = 'raw' | 'pgm' | 'png';

function printHelp() {
  const help = `tisx - BMW TIS ITW tools

Usage:
  decomp-itw <input.itw> [output] --format raw|pgm|png

Options:
  --format <fmt>   raw | pgm | png (default: raw)
  -h, --help       show help

Examples:
  decomp-itw samples/itw_samples/34.ITW out.raw --format raw
  decomp-itw samples/itw_samples/34.ITW out.pgm --format pgm
  decomp-itw samples/itw_samples/34.ITW out.png --format png
`;
  process.stdout.write(help);
}

function buildPgmBuffer(width: number, height: number, data: Buffer) {
  const header = `P5\n${width} ${height}\n255\n`;
  return Buffer.concat([Buffer.from(header, 'ascii'), data]);
}

function writePgm(width: number, height: number, data: Buffer, outPath: string) {
  const out = buildPgmBuffer(width, height, data);
  fs.writeFileSync(outPath, out);
}

function parseFormat(args: string[]): OutputFormat {
  const idx = args.indexOf('--format');
  if (idx === -1) return 'raw';
  const value = args[idx + 1];
  if (!value) throw new Error('Missing value for --format');
  if (value !== 'raw' && value !== 'pgm' && value !== 'png') {
    throw new Error(`Unknown format: ${value}`);
  }
  return value;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp();
    return;
  }

  const input = args[0];
  const output = args[1];
  const format = parseFormat(args);

  if (!input || !output) {
    printHelp();
    process.exit(1);
  }

  const buffer = fs.readFileSync(input);
  const { header, data } = decompressItwFile(buffer);

  if (format === 'pgm') {
    if (header.bpp !== 8) {
      throw new Error(`PGM output only supports 8bpp. Found ${header.bpp}bpp.`);
    }
    writePgm(header.width, header.height, data, output);
  } else if (format === 'png') {
    if (header.bpp !== 8) {
      throw new Error(`PNG output only supports 8bpp grayscale. Found ${header.bpp}bpp.`);
    }
    await sharp(data, {
      raw: { width: header.width, height: header.height, channels: 1 },
    })
      .png()
      .toFile(output);
  } else {
    fs.writeFileSync(output, data);
  }

  const outRel = path.relative(process.cwd(), output);
  process.stdout.write(
    `Wrote ${data.length} bytes (${header.width}x${header.height}, ${header.bpp}bpp) to ${outRel}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
