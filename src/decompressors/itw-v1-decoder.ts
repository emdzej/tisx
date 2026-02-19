/**
 * ITW V1 (0x0300) Wavelet Decoder
 * 
 * Based on reverse-engineering of BMW TIS application.
 * Uses bilinear upscale from LL4 band (lowest resolution).
 * 
 * File structure:
 * - 0x00: "ITW_" magic (4 bytes)
 * - 0x04: flags (2 bytes)
 * - 0x06: width (2 bytes BE)
 * - 0x08: height (2 bytes BE)
 * - 0x0A: unknown (2 bytes)
 * - 0x0C: format version (2 bytes BE) - 0x0300=V1, 0x0400=V2
 * - 0x0E: compressed size (4 bytes BE)
 * - 0x12: compressed data (metadata + zlib streams)
 * 
 * Stream 16 contains LL4 (lowest resolution low-pass band).
 */

import * as zlib from 'zlib';

export interface ItwHeader {
  magic: string;
  flags: number;
  width: number;
  height: number;
  formatVersion: number;
  compressedSize: number;
}

export interface ItwV1Result {
  width: number;
  height: number;
  pixels: Uint8Array;
}

/**
 * Bilinear upscale
 */
function bilinearUpscale(
  src: number[],
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): number[] {
  const result: number[] = [];
  
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcX = dstW > 1 ? x * (srcW - 1) / (dstW - 1) : 0;
      const srcY = dstH > 1 ? y * (srcH - 1) / (dstH - 1) : 0;
      
      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const y1 = Math.min(y0 + 1, srcH - 1);
      
      const fx = srcX - x0;
      const fy = srcY - y0;
      
      const v00 = src[y0 * srcW + x0];
      const v10 = src[y0 * srcW + x1];
      const v01 = src[y1 * srcW + x0];
      const v11 = src[y1 * srcW + x1];
      
      result.push(
        v00 * (1 - fx) * (1 - fy) +
        v10 * fx * (1 - fy) +
        v01 * (1 - fx) * fy +
        v11 * fx * fy
      );
    }
  }
  
  return result;
}

/**
 * Extract zlib streams from compressed data
 */
function extractZlibStreams(data: Buffer): Buffer[] {
  const streams: Buffer[] = [];
  let pos = 0;
  
  while (pos < data.length - 2) {
    if (data[pos] === 0x78 && [0x01, 0x5E, 0x9C, 0xDA].includes(data[pos + 1])) {
      for (let end = pos + 2; end <= data.length; end++) {
        try {
          const decompressed = zlib.inflateSync(data.subarray(pos, end));
          streams.push(decompressed);
          pos = end;
          break;
        } catch {
          continue;
        }
      }
    }
    pos++;
  }
  
  return streams;
}

/**
 * Parse ITW header
 */
export function parseItwHeader(data: Buffer): ItwHeader {
  return {
    magic: data.subarray(0, 4).toString('ascii'),
    flags: data.readUInt16BE(4),
    width: data.readUInt16BE(6),
    height: data.readUInt16BE(8),
    formatVersion: data.readUInt16BE(12),
    compressedSize: data.readUInt32BE(14),
  };
}

/**
 * Decode ITW V1 file to grayscale pixels
 */
export function decodeItwV1(data: Buffer): ItwV1Result {
  const header = parseItwHeader(data);
  
  if (header.magic !== 'ITW_') {
    throw new Error(`Not ITW file: magic="${header.magic}"`);
  }
  
  if (header.formatVersion !== 0x0300) {
    throw new Error(
      `Not ITW V1: version=0x${header.formatVersion.toString(16)} (expected 0x0300)`
    );
  }
  
  const { width, height } = header;
  
  // Extract zlib streams from compressed payload
  const payload = data.subarray(18, 18 + header.compressedSize);
  const streams = extractZlibStreams(payload);
  
  if (streams.length < 17) {
    throw new Error(`Expected 17+ streams, got ${streams.length}`);
  }
  
  // Stream 16 = LL4 (lowest resolution low-pass band)
  // Size is approximately ceil(width/16) × ceil(height/16)
  const ll4Raw = Array.from(streams[16]);
  const ll4W = Math.ceil(width / 16);
  const ll4H = Math.ceil(height / 16);
  
  // Rescale LL4 from stored range to 0-255
  const minLL = Math.min(...ll4Raw);
  const maxLL = Math.max(...ll4Raw);
  const range = maxLL - minLL || 1;
  const ll4 = ll4Raw.map(v => ((v - minLL) * 255) / range);
  
  // Bilinear upscale to full resolution
  const pixels = bilinearUpscale(ll4, ll4W, ll4H, width, height);
  
  // Clamp to 0-255
  const result = new Uint8Array(width * height);
  for (let i = 0; i < pixels.length; i++) {
    result[i] = Math.max(0, Math.min(255, Math.round(pixels[i])));
  }
  
  return { width, height, pixels: result };
}
