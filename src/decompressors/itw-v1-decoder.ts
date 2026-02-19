/**
 * ITW V1 (0x0300) Wavelet Decoder
 * 
 * Supports two modes:
 * - Bilinear: Fast, blurry output from LL4 only
 * - Wavelet: Uses detail bands for sharper output (WIP)
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
  mode?: 'bilinear' | 'wavelet';
  detailScale?: number;
}

// Fischer decode: 2-bit sign/range + 6-bit value
function fischerDecode(b: number): number {
  const mode = b >> 6;
  const val = b & 0x3F;
  switch (mode) {
    case 0: return val;
    case 1: return -val;
    case 2: return val + 64;
    case 3: return -(val + 64);
    default: return 0;
  }
}

// RLE decode: high bit = place coeff + skip, low = skip only
function decodeRle(rle: number[], values: number[], targetSize: number): number[] {
  const output = new Array(targetSize).fill(0);
  let pos = 0;
  let valIdx = 0;
  
  for (const b of rle) {
    if (pos >= targetSize) break;
    
    if (b >= 128) {
      if (valIdx < values.length) {
        output[pos] = values[valIdx++];
      }
      pos += (b & 0x7F) + 1;
    } else {
      pos += b + 1;
    }
  }
  
  return output;
}

function bilinearUpscale(
  src: number[], srcW: number, srcH: number,
  dstW: number, dstH: number
): number[] {
  const result: number[] = [];
  
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcX = dstW > 1 ? x * (srcW - 1) / (dstW - 1) : 0;
      const srcY = dstH > 1 ? y * (srcH - 1) / (dstH - 1) : 0;
      
      const x0 = Math.floor(srcX), y0 = Math.floor(srcY);
      const x1 = Math.min(x0 + 1, srcW - 1), y1 = Math.min(y0 + 1, srcH - 1);
      const fx = srcX - x0, fy = srcY - y0;
      
      const v00 = src[y0 * srcW + x0], v10 = src[y0 * srcW + x1];
      const v01 = src[y1 * srcW + x0], v11 = src[y1 * srcW + x1];
      
      result.push(
        v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) +
        v01 * (1 - fx) * fy + v11 * fx * fy
      );
    }
  }
  
  return result;
}

// 2D Haar inverse wavelet
function haarInverse2D(
  ll: number[], lh: number[] | null, hl: number[] | null, hh: number[] | null,
  outW: number, outH: number
): number[] {
  const llW = Math.ceil(outW / 2), llH = Math.ceil(outH / 2);
  const result = new Array(outW * outH).fill(0);
  
  const get = (arr: number[] | null, idx: number) => 
    arr && idx < arr.length ? arr[idx] : 0;
  
  for (let y = 0; y < llH; y++) {
    for (let x = 0; x < llW; x++) {
      const idx = y * llW + x;
      const a = get(ll, idx), b = get(lh, idx), c = get(hl, idx), d = get(hh, idx);
      const ox = 2 * x, oy = 2 * y;
      
      if (oy < outH && ox < outW) result[oy * outW + ox] = a + b + c + d;
      if (oy < outH && ox + 1 < outW) result[oy * outW + ox + 1] = a + b - c - d;
      if (oy + 1 < outH && ox < outW) result[(oy + 1) * outW + ox] = a - b + c - d;
      if (oy + 1 < outH && ox + 1 < outW) result[(oy + 1) * outW + ox + 1] = a - b - c + d;
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
  const { mode = 'bilinear', detailScale = 0.5 } = options;
  const header = parseItwHeader(data);
  
  if (header.magic !== 'ITW_') throw new Error(`Not ITW file: "${header.magic}"`);
  if (header.formatVersion !== 0x0300) throw new Error(`Not V1: 0x${header.formatVersion.toString(16)}`);
  
  const { width, height } = header;
  const payload = data.subarray(18, 18 + header.compressedSize);
  const streams = extractZlibStreams(payload);
  
  if (streams.length < 17) throw new Error(`Need 17+ streams, got ${streams.length}`);
  
  // LL4 from stream 16
  const ll4Raw = Array.from(streams[16]);
  const minLL = Math.min(...ll4Raw), maxLL = Math.max(...ll4Raw);
  const ll4 = ll4Raw.map(v => ((v - minLL) * 255) / (maxLL - minLL || 1));
  
  const ll4W = Math.ceil(width / 16), ll4H = Math.ceil(height / 16);
  
  let pixels: number[];
  
  if (mode === 'bilinear') {
    pixels = bilinearUpscale(ll4, ll4W, ll4H, width, height);
  } else {
    // Wavelet mode with detail bands
    const l1W = Math.ceil(width / 2), l1H = Math.ceil(height / 2);
    const l1Size = l1W * l1H;
    
    // Decode detail bands (S0+S1=LH1, S2+S3=HL1, S6+S7=HH1)
    const lh1 = decodeRle(
      Array.from(streams[0]),
      Array.from(streams[1]).map(fischerDecode),
      l1Size
    ).map(v => v * detailScale);
    
    const hl1 = decodeRle(
      Array.from(streams[2]),
      Array.from(streams[3]).map(fischerDecode),
      l1Size
    ).map(v => v * detailScale);
    
    const hh1 = streams.length > 7 ? decodeRle(
      Array.from(streams[6]),
      Array.from(streams[7]).map(fischerDecode),
      l1Size
    ).map(v => v * detailScale) : null;
    
    // Build pyramid
    let ll3 = haarInverse2D(ll4, null, null, null, 40, 30);
    let ll2 = haarInverse2D(ll3, null, null, null, 79, 60);
    let ll1 = haarInverse2D(ll2, null, null, null, l1W, l1H);
    pixels = haarInverse2D(ll1, lh1, hl1, hh1, width, height);
  }
  
  // Normalize and clamp
  const minV = Math.min(...pixels), maxV = Math.max(...pixels);
  const range = maxV - minV || 1;
  const result = new Uint8Array(width * height);
  for (let i = 0; i < pixels.length; i++) {
    result[i] = Math.max(0, Math.min(255, Math.round((pixels[i] - minV) * 255 / range)));
  }
  
  return { width, height, pixels: result };
}
