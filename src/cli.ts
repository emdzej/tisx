#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { decompressItwFile } from './decompressors/itw-lzw.js';
import { isItwV1, decodeItwV1 } from './decompressors/itw-wavelet.js';

type OutputFormat = 'raw' | 'pgm' | 'png';

function printHelp() {
  const help = `tisx - BMW TIS ITW tools

Usage:
  decomp-itw <input.itw> [output] --format raw|pgm|png

Supported formats:
  V1 (0x0300)  - Wavelet compression (LL-only decode, full reconstruction WIP)
  V2 (0x0400)  - LZW + RLE compression

Options:
  --format <fmt>     raw | pgm | png (default: raw)
  --force-absolute   force absolute block offsets (debug, V2 only)
  --force-relative   force relative block offsets (debug, V2 only)
  --debug            enable verbose ITW logging
  -h, --help         show help

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

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

interface DecodeResult {
  width: number;
  height: number;
  bpp: number;
  data: Buffer;
  format: 'V1' | 'V2';
  llOnly?: boolean;
}

function decodeItw(
  buffer: Buffer,
  options: { forceAbsolute?: boolean; forceRelative?: boolean; debug?: boolean }
): DecodeResult {
  // Check if V1 (wavelet) format
  if (isItwV1(buffer)) {
    const result = decodeItwV1(buffer);
    return {
      width: result.header.width,
      height: result.header.height,
      bpp: result.header.bitDepth,
      data: result.pixels,
      format: 'V1',
      llOnly: result.llOnly,
    };
  }

  // Fall back to V2 (LZW) format
  const { header, data } = decompressItwFile(buffer, options);
  return {
    width: header.width,
    height: header.height,
    bpp: header.bpp,
    data,
    format: 'V2',
  };
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
  const forceAbsolute = hasFlag(args, '--force-absolute');
  const forceRelative = hasFlag(args, '--force-relative');
  const debug = hasFlag(args, '--debug');

  if (!input || !output) {
    printHelp();
    process.exit(1);
  }

  const buffer = fs.readFileSync(input);
  const result = decodeItw(buffer, {
    forceAbsolute,
    forceRelative,
    debug,
  });

  if (format === 'pgm') {
    if (result.bpp !== 8) {
      throw new Error(`PGM output only supports 8bpp. Found ${result.bpp}bpp.`);
    }
    writePgm(result.width, result.height, result.data, output);
  } else if (format === 'png') {
    if (result.bpp !== 8) {
      throw new Error(`PNG output only supports 8bpp grayscale. Found ${result.bpp}bpp.`);
    }
    await sharp(result.data, {
      raw: { width: result.width, height: result.height, channels: 1 },
    })
      .png()
      .toFile(output);
  } else {
    fs.writeFileSync(output, result.data);
  }

  const outRel = path.relative(process.cwd(), output);
  const llNote = result.llOnly ? ' (LL-only, full wavelet WIP)' : '';
  process.stdout.write(
    `[${result.format}${llNote}] Wrote ${result.data.length} bytes (${result.width}x${result.height}, ${result.bpp}bpp) to ${outRel}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
