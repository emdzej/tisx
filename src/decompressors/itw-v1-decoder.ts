/**
 * ITW V1 (0x0300) Wavelet Decoder
 * 
 * Based on reverse-engineering of BMW TIS application.
 * Uses CDF 5/3 wavelet with 4 decomposition levels.
 * 
 * File structure:
 * - 0x00: "ITW_" magic (4 bytes)
 * - 0x04: flags/version (2 bytes)
 * - 0x06: width (2 bytes BE)
 * - 0x08: height (2 bytes BE)
 * - 0x0A: unknown (2 bytes)
 * - 0x0C: format version (2 bytes BE) - 0x0300=V1, 0x0400=V2
 * - 0x0E: compressed size (4 bytes BE)
 * - 0x12: compressed data...
 */

import * as zlib from 'zlib';

export interface ItwHeader {
  magic: string;      // "ITW_"
  flags: number;
  width: number;
  height: number;
  formatVersion: number;  // 0x0300=V1, 0x0400=V2
  compressedSize: number;
}

export interface ItwV1Result {
  width: number;
  height: number;
  pixels: Uint8Array;  // Grayscale 0-255
}

/**
 * CDF 5/3 inverse wavelet transform (1D)
 * Lifting scheme implementation
 */
function cdf53Inverse1D(low: number[], high: number[], outLen: number): number[] {
  const s = [...low];
  const d = high.length > 0 ? [...high] : new Array(Math.floor(outLen / 2)).fill(0);
  
  // Undo update step: s[n] -= (d[n-1] + d[n] + 2) >> 2
  for (let i = 0; i < s.length; i++) {
    const left = i > 0 ? d[i - 1] : d[0];
    const right = i < d.length ? d[i] : d[d.length - 1] || 0;
    s[i] -= (left + right + 2) / 4;
  }
  
  // Interleave: even positions = s, odd positions = d
  const result = new Array(outLen).fill(0);
  for (let i = 0; i < s.length && 2 * i < outLen; i++) {
    result[2 * i] = s[i];
  }
  
  // Undo predict step: d[n] += (s[n] + s[n+1]) / 2
  for (let i = 0; i < d.length && 2 * i + 1 < outLen; i++) {
    const left = result[2 * i];
    const right = 2 * i + 2 < outLen ? result[2 * i + 2] : result[2 * i];
    result[2 * i + 1] = d[i] + (left + right) / 2;
  }
  
  return result;
}

/**
 * CDF 5/3 inverse wavelet transform (2D)
 */
function cdf53Inverse2D(
  ll: number[],
  lh: number[] | null,
  hl: number[] | null,
  hh: number[] | null,
  outW: number,
  outH: number
): number[] {
  const llW = Math.ceil(outW / 2);
  const llH = Math.ceil(outH / 2);
  const lhH = outH - llH;
  const hlW = outW - llW;
  
  // Helper to get 2D array
  const to2D = (arr: number[] | null, w: number, h: number): number[][] => {
    const result: number[][] = [];
    for (let y = 0; y < h; y++) {
      const row: number[] = [];
      for (let x = 0; x < w; x++) {
        row.push(arr && y * w + x < arr.length ? arr[y * w + x] : 0);
      }
      result.push(row);
    }
    return result;
  };
  
  const ll2D = to2D(ll, llW, llH);
  const lh2D = lh ? to2D(lh, llW, lhH) : null;
  const hl2D = hl ? to2D(hl, hlW, llH) : null;
  const hh2D = hh ? to2D(hh, hlW, lhH) : null;
  
  // Vertical inverse on left columns (LL + LH)
  const leftCols: number[][] = [];
  for (let x = 0; x < llW; x++) {
    const low = ll2D.map(row => row[x]);
    const high = lh2D ? lh2D.map(row => row[x]) : [];
    leftCols.push(cdf53Inverse1D(low, high, outH));
  }
  
  // Vertical inverse on right columns (HL + HH)
  const rightCols: number[][] = [];
  for (let x = 0; x < hlW; x++) {
    const low = hl2D ? hl2D.map(row => row[x]) : new Array(llH).fill(0);
    const high = hh2D ? hh2D.map(row => row[x]) : [];
    rightCols.push(cdf53Inverse1D(low, high, outH));
  }
  
  // Horizontal inverse on each row
  const result: number[] = [];
  for (let y = 0; y < outH; y++) {
    const low = leftCols.map(col => col[y]);
    const high = rightCols.map(col => col[y]);
    const row = cdf53Inverse1D(low, high, outW);
    result.push(...row);
  }
  
  return result;
}

/**
 * Simple bilinear upscale (fallback)
 */
function bilinearUpscale(src: number[], srcW: number, srcH: number, dstW: number, dstH: number): number[] {
  const result: number[] = [];
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcX = x * (srcW - 1) / (dstW - 1 || 1);
      const srcY = y * (srcH - 1) / (dstH - 1 || 1);
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
      result.push(v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy);
    }
  }
  return result;
}

/**
 * Extract zlib streams from data
 */
function extractZlibStreams(data: Buffer): Buffer[] {
  const streams: Buffer[] = [];
  let pos = 0;
  
  while (pos < data.length - 2) {
    // Look for zlib header
    if (data[pos] === 0x78 && [0x01, 0x5E, 0x9C, 0xDA].includes(data[pos + 1])) {
      // Try to decompress
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
  const magic = data.subarray(0, 4).toString('ascii');
  return {
    magic,
    flags: data.readUInt16BE(4),
    width: data.readUInt16BE(6),
    height: data.readUInt16BE(8),
    formatVersion: data.readUInt16BE(12),
    compressedSize: data.readUInt32BE(14),
  };
}

/**
 * Decode ITW V1 file
 */
export function decodeItwV1(data: Buffer, useBilinear = true): ItwV1Result {
  const header = parseItwHeader(data);
  
  if (header.magic !== 'ITW_') {
    throw new Error(`Not ITW file: magic="${header.magic}"`);
  }
  
  if (header.formatVersion !== 0x0300) {
    throw new Error(`Not ITW V1: version=0x${header.formatVersion.toString(16)} (expected 0x0300)`);
  }
  
  const { width, height } = header;
  
  // Extract compressed payload (starts at offset 18)
  const payload = data.subarray(18, 18 + header.compressedSize);
  const streams = extractZlibStreams(payload);
  
  if (streams.length < 17) {
    throw new Error(`Expected 17+ streams, got ${streams.length}`);
  }
  
  // Stream 16 = LL4 (lowest resolution LL band)
  const ll4Raw = Array.from(streams[16]);
  
  // LL4 dimensions: ~width/16 x height/16
  const ll4W = Math.ceil(width / 16);
  const ll4H = Math.ceil(height / 16);
  
  // Rescale LL4 from [min,max] to [0,255]
  const minLL = Math.min(...ll4Raw);
  const maxLL = Math.max(...ll4Raw);
  const ll4 = ll4Raw.map(v => ((v - minLL) * 255) / (maxLL - minLL || 1));
  
  let pixels: number[];
  
  if (useBilinear) {
    // Simple bilinear upscale (reliable fallback)
    pixels = bilinearUpscale(ll4, ll4W, ll4H, width, height);
  } else {
    // CDF 5/3 wavelet reconstruction (no detail bands yet)
    const dims = [
      { w: width, h: height },
      { w: Math.ceil(width / 2), h: Math.ceil(height / 2) },
      { w: Math.ceil(width / 4), h: Math.ceil(height / 4) },
      { w: Math.ceil(width / 8), h: Math.ceil(height / 8) },
      { w: ll4W, h: ll4H },
    ];
    
    let current = ll4;
    for (let level = 4; level > 0; level--) {
      const target = dims[level - 1];
      current = cdf53Inverse2D(current, null, null, null, target.w, target.h);
    }
    pixels = current;
  }
  
  // Clamp to 0-255
  const result = new Uint8Array(width * height);
  for (let i = 0; i < pixels.length; i++) {
    result[i] = Math.max(0, Math.min(255, Math.round(pixels[i])));
  }
  
  return { width, height, pixels: result };
}

// Re-export for CLI compatibility
export { parseItwHeader as parseItwV1Header };
