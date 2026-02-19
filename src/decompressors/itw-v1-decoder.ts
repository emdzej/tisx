/**
 * ITW V1 (0x0300) Wavelet Decoder
 * 
 * Modes:
 * - bilinear: Fast, smooth upscale from LL4 (default, best quality)
 * - cdf53: CDF 5/3 reconstruction (experimental)
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

export interface DecodeOptions {
  mode?: 'bilinear' | 'cdf53';
}

// Bilinear upscale - best quality for LL-only decode
function bilinear(src: number[], sw: number, sh: number, dw: number, dh: number): number[] {
  const result: number[] = [];
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = dw > 1 ? x * (sw - 1) / (dw - 1) : 0;
      const sy = dh > 1 ? y * (sh - 1) / (dh - 1) : 0;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, sw - 1), y1 = Math.min(y0 + 1, sh - 1);
      const fx = sx - x0, fy = sy - y0;
      const v00 = src[y0 * sw + x0], v10 = src[y0 * sw + x1];
      const v01 = src[y1 * sw + x0], v11 = src[y1 * sw + x1];
      result.push(v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy);
    }
  }
  return result;
}

// CDF 5/3 inverse 1D lifting
function cdf53Inv1D(s: number[], d: number[]): number[] {
  const nS = s.length, nD = d.length, nOut = nS + nD;
  if (nS === 0) return [];
  
  const even = new Array(nS).fill(0), odd = new Array(nD).fill(0);
  
  for (let i = 0; i < nS; i++) {
    const dLeft = nD > 0 ? d[Math.max(0, i - 1)] : 0;
    const dRight = nD > 0 ? d[Math.min(i, nD - 1)] : 0;
    even[i] = s[i] - (dLeft + dRight) / 4;
  }
  
  for (let i = 0; i < nD; i++) {
    const eLeft = even[i];
    const eRight = even[Math.min(i + 1, nS - 1)];
    odd[i] = d[i] + (eLeft + eRight) / 2;
  }
  
  const result = new Array(nOut).fill(0);
  for (let i = 0; i < nS; i++) result[2 * i] = even[i];
  for (let i = 0; i < nD; i++) result[2 * i + 1] = odd[i];
  return result;
}

// CDF 5/3 inverse 2D (LL only)
function cdf53Inv2D_LLonly(ll: number[], llW: number, llH: number, outW: number, outH: number): number[] {
  const hlW = Math.floor(outW / 2), lhH = Math.floor(outH / 2);
  
  // Inverse rows (LL → L)
  const L: number[][] = [];
  for (let y = 0; y < llH; y++) {
    const rowS = ll.slice(y * llW, (y + 1) * llW);
    const rowD = new Array(hlW).fill(0);
    const rowOut = cdf53Inv1D(rowS, rowD);
    L.push(rowOut.slice(0, outW));
  }
  
  // Inverse columns
  const result = new Array(outW * outH).fill(0);
  for (let x = 0; x < outW; x++) {
    const colS = L.map(row => row[x] ?? 0);
    const colD = new Array(lhH).fill(0);
    const colOut = cdf53Inv1D(colS, colD);
    for (let y = 0; y < outH; y++) {
      result[y * outW + x] = colOut[y] ?? 0;
    }
  }
  
  return result;
}

function extractZlibStreams(data: Buffer): Buffer[] {
  const streams: Buffer[] = [];
  let pos = 0;
  while (pos < data.length - 2) {
    if (data[pos] === 0x78 && [0x01, 0x5E, 0x9C, 0xDA].includes(data[pos + 1])) {
      for (let end = pos + 2; end <= data.length; end++) {
        try {
          streams.push(zlib.inflateSync(data.subarray(pos, end)));
          pos = end;
          break;
        } catch { continue; }
      }
    }
    pos++;
  }
  return streams;
}

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

export function decodeItwV1(data: Buffer, options: DecodeOptions = {}): ItwV1Result {
  const { mode = 'bilinear' } = options;
  const header = parseItwHeader(data);
  
  if (header.magic !== 'ITW_') throw new Error(`Not ITW: "${header.magic}"`);
  if (header.formatVersion !== 0x0300) throw new Error(`Not V1: 0x${header.formatVersion.toString(16)}`);
  
  const { width, height } = header;
  const payload = data.subarray(18, 18 + header.compressedSize);
  const streams = extractZlibStreams(payload);
  
  // Find LL4 stream (matches expected size)
  const ll4W = Math.ceil(width / 16), ll4H = Math.ceil(height / 16);
  const ll4Size = ll4W * ll4H;
  
  let ll4Stream: Buffer | undefined;
  for (const s of streams) {
    if (s.length === ll4Size) {
      ll4Stream = s;
      break;
    }
  }
  
  if (!ll4Stream) throw new Error(`LL4 stream not found (expected ${ll4Size} bytes)`);
  
  const ll4Raw = Array.from(ll4Stream);
  let minLL = Infinity, maxLL = -Infinity;
  for (const v of ll4Raw) {
    if (v < minLL) minLL = v;
    if (v > maxLL) maxLL = v;
  }
  const ll4 = ll4Raw.map(v => ((v - minLL) * 255) / (maxLL - minLL || 1));
  
  let pixels: number[];
  
  if (mode === 'bilinear') {
    pixels = bilinear(ll4, ll4W, ll4H, width, height);
  } else {
    // CDF 5/3 pyramid: L4 → L3 → L2 → L1 → Full
    const l3W = Math.ceil(width / 8), l3H = Math.ceil(height / 8);
    const l2W = Math.ceil(width / 4), l2H = Math.ceil(height / 4);
    const l1W = Math.ceil(width / 2), l1H = Math.ceil(height / 2);
    
    let ll3 = cdf53Inv2D_LLonly(ll4, ll4W, ll4H, l3W, l3H);
    let ll2 = cdf53Inv2D_LLonly(ll3, l3W, l3H, l2W, l2H);
    let ll1 = cdf53Inv2D_LLonly(ll2, l2W, l2H, l1W, l1H);
    pixels = cdf53Inv2D_LLonly(ll1, l1W, l1H, width, height);
  }
  
  // Normalize (loop to avoid stack overflow)
  let minV = Infinity, maxV = -Infinity;
  for (const p of pixels) {
    if (p < minV) minV = p;
    if (p > maxV) maxV = p;
  }
  const range = maxV - minV || 1;
  const result = new Uint8Array(width * height);
  for (let i = 0; i < pixels.length; i++) {
    result[i] = Math.max(0, Math.min(255, Math.round((pixels[i] - minV) * 255 / range)));
  }
  
  return { width, height, pixels: result };
}
