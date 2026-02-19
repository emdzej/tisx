#!/usr/bin/env node
/**
 * tisx CLI - ITW Image Decoder
 */

import { readFileSync, writeFileSync } from 'fs';
import { inflateSync, deflateSync } from 'zlib';

interface DecodedImage {
  width: number;
  height: number;
  pixels: number[];
  format: 'V1' | 'V2';
}

function writePng(filename: string, pixels: number[], width: number, height: number): void {
  const crc32Table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crc32Table[i] = c;
  }
  
  function crc32(buf: Buffer): number {
    let crc = 0xFFFFFFFF;
    for (const byte of buf) {
      crc = crc32Table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  
  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBytes = Buffer.from(type, 'ascii');
    const combined = Buffer.concat([typeBytes, data]);
    const crcVal = crc32(combined);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, combined, crcBuf]);
  }
  
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  
  const rawData: number[] = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0);
    for (let x = 0; x < width; x++) {
      rawData.push(Math.max(0, Math.min(255, Math.round(pixels[y * width + x]))));
    }
  }
  
  const compressed = deflateSync(Buffer.from(rawData));
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))
  ]);
  writeFileSync(filename, png);
}

function findZlibStreams(data: Buffer): Buffer[] {
  const streams: Buffer[] = [];
  let pos = 0;
  while (pos < data.length - 2) {
    if (data[pos] === 0x78 && [0x01, 0x5E, 0x9C, 0xDA].includes(data[pos + 1])) {
      for (let end = pos + 2; end <= data.length; end++) {
        try {
          streams.push(inflateSync(data.subarray(pos, end)));
          pos = end;
          break;
        } catch { continue; }
      }
    } else { pos++; }
  }
  return streams;
}

function bilinearUpscale(img: number[], srcW: number, srcH: number, dstW: number, dstH: number): number[] {
  const result: number[] = [];
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const sx = x * (srcW - 1) / Math.max(1, dstW - 1);
      const sy = y * (srcH - 1) / Math.max(1, dstH - 1);
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, srcW - 1), y1 = Math.min(y0 + 1, srcH - 1);
      const fx = sx - x0, fy = sy - y0;
      result.push(
        img[y0*srcW+x0]*(1-fx)*(1-fy) + img[y0*srcW+x1]*fx*(1-fy) +
        img[y1*srcW+x0]*(1-fx)*fy + img[y1*srcW+x1]*fx*fy
      );
    }
  }
  return result;
}

function decodeItwV1(data: Buffer): DecodedImage {
  const width = data.readUInt16BE(6), height = data.readUInt16BE(8);
  const compressedSize = data.readUInt32BE(14);
  const streams = findZlibStreams(data.subarray(18, 18 + compressedSize));
  
  const llW = Math.ceil(Math.ceil(Math.ceil(Math.ceil(width/2)/2)/2)/2);
  const llH = Math.ceil(Math.ceil(Math.ceil(Math.ceil(height/2)/2)/2)/2);
  const ll4Size = llW * llH;
  
  let llStream: Buffer | null = null;
  for (const stream of streams) {
    if (stream.length !== ll4Size) continue;
    const mean = [...stream].reduce((a,b) => a+b, 0) / stream.length;
    const zeros = [...stream].filter(v => v === 0).length;
    if (mean > 40 && zeros === 0) { llStream = stream; break; }
  }
  if (!llStream) throw new Error('Could not find LL band');
  
  const ll = [...llStream];
  const min = Math.min(...ll), max = Math.max(...ll);
  const llNorm = ll.map(v => (v - min) * 255 / (max - min || 1));
  const pixels = bilinearUpscale(llNorm, llW, llH, width, height);
  return { width, height, pixels, format: 'V1' };
}

const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage: tisx <input.itw> [output.png]');
  process.exit(1);
}

const inputFile = args[0];
const outputFile = args[1] || inputFile.replace(/\.itw$/i, '.png');

try {
  const data = readFileSync(inputFile);
  if (data.subarray(0, 4).toString('ascii') !== 'ITW_') throw new Error('Not ITW');
  const typeCode = data.readUInt16BE(12);
  
  if (typeCode === 0x0300) {
    console.log(`Decoding V1: ${inputFile}`);
    const image = decodeItwV1(data);
    console.log(`${image.width}x${image.height}`);
    writePng(outputFile, image.pixels, image.width, image.height);
    console.log(`Saved: ${outputFile}`);
  } else {
    throw new Error(`Type 0x${typeCode.toString(16)} not supported`);
  }
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
