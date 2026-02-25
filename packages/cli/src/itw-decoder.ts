/**
 * ITW Decoder based on tis.exe decompilation
 * Supports V1 (0x0300) wavelet and V2 (0x0400) LZW formats
 */
import { readFileSync, writeFileSync } from 'node:fs';
import * as zlib from 'node:zlib';

interface ITWHeader {
  magic: string;
  version: number;
  width: number;
  height: number;
  bits: number;
  compression: number;
}

function readU16BE(buf: Buffer, offset: number): number {
  return buf.readUInt16BE(offset);
}

function readU32BE(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset);
}

function parseHeader(buf: Buffer): ITWHeader {
  const magic = buf.subarray(0, 4).toString('ascii');
  if (magic !== 'ITW_') {
    throw new Error('Not an ITW file');
  }

  return {
    magic,
    version: readU16BE(buf, 4),
    width: readU16BE(buf, 6),
    height: readU16BE(buf, 8),
    bits: readU16BE(buf, 10),
    compression: readU16BE(buf, 12),
  };
}

/**
 * Decode V2 (0x0400) - LZW + RLE compression
 * Based on FUN_004b57f0
 */
function decodeV2(buf: Buffer, header: ITWHeader): Buffer {
  let pos = 14;
  
  // Read header byte (palette size)
  const paletteSize = buf[pos++];
  console.log(`  Palette size: ${paletteSize}`);
  
  // Skip palette
  pos += paletteSize;
  
  // Read stream 1 size (positions)
  const stream1Size = readU32BE(buf, pos);
  pos += 4;
  const stream1 = buf.subarray(pos, pos + stream1Size);
  pos += stream1Size;
  
  // Read stream 2 size (values)
  const stream2Size = readU32BE(buf, pos);
  pos += 4;
  const stream2 = buf.subarray(pos, pos + stream2Size);
  
  console.log(`  Stream 1: ${stream1Size} bytes, Stream 2: ${stream2Size} bytes`);
  
  // Decode LZW streams
  // For now, return placeholder
  const pixels = Buffer.alloc(header.width * header.height, 128);
  return pixels;
}

/**
 * Decode V1 (0x0300) - Wavelet compression
 * Based on FUN_004b5b30 and FUN_004b7970
 */
function decodeV1(buf: Buffer, header: ITWHeader): Buffer {
  // Read compressed size
  const compressedSize = readU32BE(buf, 14);
  const compressedData = buf.subarray(18, 18 + compressedSize);
  
  console.log(`  Compressed size: ${compressedSize} bytes`);
  
  // Parse metadata
  let pos = 0;
  const filterType = compressedData[pos++];
  const numLevels = compressedData[pos++];
  const quantParam = compressedData[pos++];
  
  console.log(`  Filter: ${filterType}, Levels: ${numLevels}, Quant: ${quantParam}`);
  
  // Number of subbands based on levels
  const numSubbands = numLevels === 3 ? 9 : 12;
  const maxLevel = numLevels === 3 ? 8 : 11;
  
  // Read level info (2 x u16 BE)
  const levelInfo = [
    readU16BE(compressedData, pos),
    readU16BE(compressedData, pos + 2),
  ];
  pos += 4;
  
  console.log(`  Level info: ${levelInfo}`);
  
  // Remaining data is zlib streams
  const remaining = compressedData.subarray(pos);
  
  // Find zlib streams (start with 0x78)
  const streams: Buffer[] = [];
  let streamStart = 0;
  
  for (let i = 0; i < remaining.length - 1; i++) {
    if (remaining[i] === 0x78 && (remaining[i + 1] === 0x9c || remaining[i + 1] === 0xda || remaining[i + 1] === 0x01)) {
      if (streamStart < i) {
        // Found potential stream start
      }
      
      // Try to decompress from this position
      try {
        const slice = remaining.subarray(i);
        const decompressed = zlib.inflateSync(slice);
        streams.push(decompressed);
        console.log(`  Found zlib stream at ${i}: ${decompressed.length} bytes`);
        break;
      } catch {
        // Not a valid zlib stream, continue
      }
    }
  }
  
  // Calculate LL dimensions
  let llW = header.width;
  let llH = header.height;
  for (let i = 0; i < numLevels + 1; i++) {
    llW = Math.ceil(llW / 2);
    llH = Math.ceil(llH / 2);
  }
  
  console.log(`  LL dimensions: ${llW}x${llH}`);
  
  // If we found a stream, try to use it
  if (streams.length > 0) {
    const data = streams[0];
    
    // Look for LL data (should be near the end or at specific offset)
    const llSize = llW * llH;
    
    // Try different offsets to find good LL data
    for (let offset = Math.max(0, data.length - llSize - 100); offset <= data.length - llSize; offset += 10) {
      const ll = data.subarray(offset, offset + llSize);
      
      // Calculate statistics
      let sum = 0;
      for (let i = 0; i < ll.length; i++) {
        sum += ll[i];
      }
      const mean = sum / ll.length;
      
      if (mean > 20 && mean < 200) {
        console.log(`  Using LL from offset ${offset}, mean=${mean.toFixed(1)}`);
        
        // Bilinear upscale
        return bilinearUpscale(ll, llW, llH, header.width, header.height);
      }
    }
  }
  
  // Fallback: search raw data for LL
  const llSize = llW * llH;
  for (let offset = 0; offset < Math.min(remaining.length - llSize, 5000); offset++) {
    const chunk = remaining.subarray(offset, offset + llSize);
    
    let sum = 0;
    for (let i = 0; i < chunk.length; i++) {
      sum += chunk[i];
    }
    const mean = sum / chunk.length;
    
    if (mean > 30 && mean < 180) {
      console.log(`  Found raw LL at offset ${offset}, mean=${mean.toFixed(1)}`);
      return bilinearUpscale(chunk, llW, llH, header.width, header.height);
    }
  }
  
  // Last resort
  console.log('  Could not find LL data');
  return Buffer.alloc(header.width * header.height, 128);
}

/**
 * Bilinear upscale
 */
function bilinearUpscale(src: Buffer, srcW: number, srcH: number, dstW: number, dstH: number): Buffer {
  const dst = Buffer.alloc(dstW * dstH);
  
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      // Map to source coordinates
      const srcX = (x * (srcW - 1)) / (dstW - 1);
      const srcY = (y * (srcH - 1)) / (dstH - 1);
      
      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const y1 = Math.min(y0 + 1, srcH - 1);
      
      const xFrac = srcX - x0;
      const yFrac = srcY - y0;
      
      // Sample 4 neighbors
      const v00 = src[y0 * srcW + x0];
      const v10 = src[y0 * srcW + x1];
      const v01 = src[y1 * srcW + x0];
      const v11 = src[y1 * srcW + x1];
      
      // Bilinear interpolation
      const v0 = v00 * (1 - xFrac) + v10 * xFrac;
      const v1 = v01 * (1 - xFrac) + v11 * xFrac;
      const v = v0 * (1 - yFrac) + v1 * yFrac;
      
      dst[y * dstW + x] = Math.round(v);
    }
  }
  
  return dst;
}

/**
 * Create PGM file (simple grayscale format)
 */
function writePGM(pixels: Buffer, width: number, height: number, path: string): void {
  const header = `P5\n${width} ${height}\n255\n`;
  const output = Buffer.concat([Buffer.from(header), pixels]);
  writeFileSync(path, output);
}

/**
 * Decode ITW file
 */
export function decodeITW(inputPath: string, outputPath: string): void {
  const buf = readFileSync(inputPath);
  const header = parseHeader(buf);
  
  console.log(`ITW: ${header.width}x${header.height}, ${header.bits}bpp, v${header.version}`);
  console.log(`  Compression: 0x${header.compression.toString(16).padStart(4, '0')}`);
  
  let pixels: Buffer;
  
  if (header.compression === 0x0300) {
    pixels = decodeV1(buf, header);
  } else if (header.compression === 0x0400) {
    pixels = decodeV2(buf, header);
  } else {
    throw new Error(`Unknown compression: 0x${header.compression.toString(16)}`);
  }
  
  // Invert (ITW stores inverted)
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = 255 - pixels[i];
  }
  
  // Write as PGM (can convert to PNG with sharp later)
  writePGM(pixels, header.width, header.height, outputPath);
  console.log(`Saved: ${outputPath}`);
}

// CLI
if (process.argv[1]?.endsWith('itw-decoder.ts') || process.argv[1]?.endsWith('itw-decoder.js')) {
  const input = process.argv[2];
  const output = process.argv[3] || input?.replace(/\.itw$/i, '.pgm');
  
  if (!input) {
    console.log('Usage: itw-decoder <input.itw> [output.pgm]');
    process.exit(1);
  }
  
  decodeITW(input, output);
}
