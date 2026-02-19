/**
 * ITW V1 (0x0300) Wavelet Decoder
 * 
 * Based on reverse-engineering of TIS.exe
 * 
 * Key findings:
 * - 4 levels of CDF 7/5 wavelet decomposition
 * - LL4 stored directly as u8 (stream 16)
 * - Detail bands use RLE positions + Fischer-coded values
 * - Stream pairs: (even=RLE, odd=values)
 */

import * as zlib from 'zlib';

export interface ItwV1Image {
  width: number;
  height: number;
  pixels: number[];
}

export interface StreamInfo {
  index: number;
  data: number[];
  size: number;
  mean: number;
  zeros: number;
  classification: 'LL' | 'RLE' | 'VALUES' | 'DIRECT';
}

/**
 * Extract and classify zlib streams from ITW data
 */
export function extractStreams(data: Buffer, compressedStart: number, compressedSize: number): StreamInfo[] {
  const streams: StreamInfo[] = [];
  const compressed = data.subarray(compressedStart, compressedStart + compressedSize);
  
  let pos = 0;
  let index = 0;
  
  while (pos < compressed.length - 2) {
    if (compressed[pos] === 0x78 && [0x01, 0x5E, 0x9C, 0xDA].includes(compressed[pos + 1])) {
      // Try to decompress
      for (let end = pos + 2; end <= compressed.length; end++) {
        try {
          const decoded = zlib.inflateSync(compressed.subarray(pos, end));
          const arr = Array.from(decoded);
          
          const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
          const zeros = arr.filter(v => v === 0).length;
          
          // Classify stream
          let classification: StreamInfo['classification'];
          if (mean > 40 && zeros === 0) {
            classification = 'LL';
          } else if (zeros > arr.length * 0.5) {
            classification = 'RLE';
          } else if (mean > 90) {
            classification = 'VALUES';
          } else {
            classification = 'DIRECT';
          }
          
          streams.push({
            index,
            data: arr,
            size: arr.length,
            mean,
            zeros,
            classification
          });
          
          pos = end;
          index++;
          break;
        } catch {
          continue;
        }
      }
    } else {
      pos++;
    }
  }
  
  return streams;
}

/**
 * Calculate subband dimensions for given level
 */
export function getSubbandDims(width: number, height: number, level: number): {
  ll: { w: number; h: number };
  lh: { w: number; h: number };
  hl: { w: number; h: number };
  hh: { w: number; h: number };
} {
  let w = width, h = height;
  
  for (let i = 0; i < level; i++) {
    w = Math.ceil(w / 2);
    h = Math.ceil(h / 2);
  }
  
  const ll_w = w;
  const ll_h = h;
  
  // Previous level dimensions
  let prev_w = width, prev_h = height;
  for (let i = 0; i < level - 1; i++) {
    prev_w = Math.ceil(prev_w / 2);
    prev_h = Math.ceil(prev_h / 2);
  }
  
  return {
    ll: { w: ll_w, h: ll_h },
    lh: { w: ll_w, h: prev_h - ll_h },
    hl: { w: prev_w - ll_w, h: ll_h },
    hh: { w: prev_w - ll_w, h: prev_h - ll_h }
  };
}

/**
 * CDF 7/5 inverse wavelet transform (1D)
 */
export function cdf75Inverse1D(low: number[], high: number[], outLen: number): number[] {
  const s = low.map(v => v);
  const d = high || [];
  
  // Update step: s[i] -= (d[i-1] + d[i] + 2) / 4
  for (let i = 0; i < s.length; i++) {
    const left = i > 0 && d.length > 0 ? d[i - 1] : 0;
    const right = i < d.length ? d[i] : (d.length > 0 ? d[d.length - 1] : 0);
    s[i] = s[i] - (left + right + 2) / 4;
  }
  
  // Interleave and predict
  const result = new Array(outLen).fill(0);
  
  for (let i = 0; i < s.length && 2 * i < outLen; i++) {
    result[2 * i] = s[i];
  }
  
  for (let i = 0; i < d.length && 2 * i + 1 < outLen; i++) {
    const left = result[2 * i];
    const right = 2 * i + 2 < outLen ? result[2 * i + 2] : result[2 * i];
    result[2 * i + 1] = d[i] + (left + right) / 2;
  }
  
  return result;
}

/**
 * CDF 7/5 inverse wavelet transform (2D)
 */
export function cdf75Inverse2D(
  ll: number[],
  lh: number[] | null,
  hl: number[] | null,
  hh: number[] | null,
  outW: number,
  outH: number
): number[] {
  const llW = Math.ceil(outW / 2);
  const llH = Math.ceil(outH / 2);
  const lhH = lh ? outH - llH : 0;
  const hlW = hl ? outW - llW : 0;
  
  // Convert to 2D arrays
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
  
  const ll2d = to2D(ll, llW, llH);
  const lh2d = lh ? to2D(lh, llW, lhH) : null;
  const hl2d = hl ? to2D(hl, hlW, llH) : null;
  const hh2d = hh ? to2D(hh, hlW, lhH) : null;
  
  // Vertical transform on left half
  const leftCols: number[][] = [];
  for (let x = 0; x < llW; x++) {
    const lowCol = ll2d.map(row => row[x]);
    const highCol = lh2d ? lh2d.map(row => row[x]) : [];
    leftCols.push(cdf75Inverse1D(lowCol, highCol, outH));
  }
  
  // Vertical transform on right half
  const rightCols: number[][] = [];
  for (let x = 0; x < hlW; x++) {
    const lowCol = hl2d ? hl2d.map(row => row[x]) : new Array(llH).fill(0);
    const highCol = hh2d ? hh2d.map(row => row[x]) : [];
    rightCols.push(cdf75Inverse1D(lowCol, highCol, outH));
  }
  
  // Horizontal transform
  const result: number[] = [];
  for (let y = 0; y < outH; y++) {
    const lowRow = leftCols.map(col => col[y]);
    const highRow = rightCols.length > 0 ? rightCols.map(col => col[y]) : [];
    result.push(...cdf75Inverse1D(lowRow, highRow, outW));
  }
  
  return result;
}

/**
 * Bilinear upscale (fallback when detail bands unavailable)
 */
export function bilinearUpscale(
  img: number[],
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): number[] {
  const result: number[] = [];
  
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const sx = x * (srcW - 1) / Math.max(1, dstW - 1);
      const sy = y * (srcH - 1) / Math.max(1, dstH - 1);
      
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const y1 = Math.min(y0 + 1, srcH - 1);
      
      const fx = sx - x0;
      const fy = sy - y0;
      
      const v00 = img[y0 * srcW + x0];
      const v01 = img[y0 * srcW + x1];
      const v10 = img[y1 * srcW + x0];
      const v11 = img[y1 * srcW + x1];
      
      result.push(
        v00 * (1 - fx) * (1 - fy) +
        v01 * fx * (1 - fy) +
        v10 * (1 - fx) * fy +
        v11 * fx * fy
      );
    }
  }
  
  return result;
}

/**
 * Decode ITW V1 image (LL-only fallback)
 */
export function decodeItwV1(data: Buffer): ItwV1Image {
  // Parse header
  const type = data.readUInt16BE(0);
  if (type !== 0x0300) {
    throw new Error(`Not ITW V1 format: type=0x${type.toString(16)}`);
  }
  
  const width = data.readUInt16BE(6);
  const height = data.readUInt16BE(8);
  const compressedSize = data.readUInt32BE(14);
  
  // Extract streams
  const streams = extractStreams(data, 18, compressedSize);
  
  // Find LL4 (stream 16 typically)
  const ll4Stream = streams.find(s => s.classification === 'LL');
  if (!ll4Stream) {
    throw new Error('Could not find LL band');
  }
  
  // Normalize LL4 to 0-255
  const ll4 = ll4Stream.data;
  const min = Math.min(...ll4);
  const max = Math.max(...ll4);
  const range = max - min || 1;
  const ll4Normalized = ll4.map(v => (v - min) * 255 / range);
  
  // Calculate LL4 dimensions (4 levels of halving)
  const ll4W = Math.ceil(Math.ceil(Math.ceil(Math.ceil(width / 2) / 2) / 2) / 2);
  const ll4H = Math.ceil(Math.ceil(Math.ceil(Math.ceil(height / 2) / 2) / 2) / 2);
  
  // Bilinear upscale to full size
  const pixels = bilinearUpscale(ll4Normalized, ll4W, ll4H, width, height);
  
  return { width, height, pixels };
}
