/**
 * ITW V1 (0x0300) CDF 5/3 Wavelet Decoder
 * Full multi-level reconstruction with detail bands
 */
import * as zlib from 'zlib';

export interface ItwHeader {
  magic: string; flags: number; width: number; height: number;
  formatVersion: number; compressedSize: number;
}
export interface ItwV1Result { width: number; height: number; pixels: Uint8Array; }
export interface DecodeOptions { mode?: 'bilinear' | 'cdf53' | 'full'; }

// Fischer decode: 2-bit mode + 6-bit value
function fischer(b: number): number {
  const mode = b >> 6, val = b & 0x3F;
  return [val, -val, val + 64, -(val + 64)][mode];
}

// RLE decode: high bit = place + skip, low = skip only
function decodeRle(rle: Buffer, vals: Buffer, size: number): number[] {
  const coeffs = new Array(size).fill(0);
  let pos = 0, vi = 0;
  for (const b of rle) {
    if (pos >= size) break;
    if (b >= 128) {
      if (vi < vals.length) coeffs[pos] = fischer(vals[vi++]);
      pos += (b & 0x7F) + 1;
    } else {
      pos += b + 1;
    }
  }
  return coeffs;
}

// Bilinear upscale
function bilinear(src: number[], sw: number, sh: number, dw: number, dh: number): number[] {
  const result: number[] = [];
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = dw > 1 ? x * (sw - 1) / (dw - 1) : 0;
      const sy = dh > 1 ? y * (sh - 1) / (dh - 1) : 0;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, sw - 1), y1 = Math.min(y0 + 1, sh - 1);
      const fx = sx - x0, fy = sy - y0;
      result.push(src[y0*sw+x0]*(1-fx)*(1-fy) + src[y0*sw+x1]*fx*(1-fy) + 
                  src[y1*sw+x0]*(1-fx)*fy + src[y1*sw+x1]*fx*fy);
    }
  }
  return result;
}

// CDF 5/3 1D synthesis (inverse lifting)
function synth1D(low: number[], high: number[]): number[] {
  const nLow = low.length, nHigh = high.length;
  if (nLow === 0) return [];
  if (nHigh === 0) return [...low];
  
  // Update step
  const even = low.map((v, i) => {
    const hL = high[Math.max(0, i - 1)];
    const hR = high[Math.min(i, nHigh - 1)];
    return v - (hL + hR) / 4;
  });
  
  // Predict step
  const odd = high.map((v, i) => {
    const eL = even[i];
    const eR = even[Math.min(i + 1, nLow - 1)];
    return v + (eL + eR) / 2;
  });
  
  // Interleave
  const out = new Array(nLow + nHigh).fill(0);
  for (let i = 0; i < nLow; i++) out[2 * i] = even[i];
  for (let i = 0; i < nHigh; i++) out[2 * i + 1] = odd[i];
  return out;
}

// Synthesize one wavelet level
function synthLevel(ll: number[], lh: number[] | null, hl: number[] | null, hh: number[] | null,
                    llW: number, llH: number, outW: number, outH: number): number[] {
  const hlW = outW - llW, lhH = outH - llH;
  
  // Pad arrays
  const pad = (arr: number[] | null, len: number) => {
    if (!arr) return new Array(len).fill(0);
    const r = [...arr];
    while (r.length < len) r.push(0);
    return r.slice(0, len);
  };
  
  const llPad = pad(ll, llW * llH);
  const lhPad = pad(lh, llW * lhH);
  const hlPad = pad(hl, hlW * llH);
  const hhPad = pad(hh, hlW * lhH);
  
  // Rows: [LL|HL] -> L, [LH|HH] -> H
  const L: number[][] = [];
  for (let y = 0; y < llH; y++) {
    const rowLL = llPad.slice(y * llW, (y + 1) * llW);
    const rowHL = hlPad.slice(y * hlW, (y + 1) * hlW);
    const row = synth1D(rowLL, rowHL);
    L.push(row.slice(0, outW).concat(new Array(Math.max(0, outW - row.length)).fill(0)));
  }
  
  const H: number[][] = [];
  for (let y = 0; y < lhH; y++) {
    const rowLH = lhPad.slice(y * llW, (y + 1) * llW);
    const rowHH = hhPad.slice(y * hlW, (y + 1) * hlW);
    const row = synth1D(rowLH, rowHH);
    H.push(row.slice(0, outW).concat(new Array(Math.max(0, outW - row.length)).fill(0)));
  }
  
  // Columns
  const out = new Array(outW * outH).fill(0);
  for (let x = 0; x < outW; x++) {
    const colL = L.map(row => row[x] ?? 0);
    const colH = H.map(row => row[x] ?? 0);
    const col = synth1D(colL, colH);
    for (let y = 0; y < Math.min(outH, col.length); y++) {
      out[y * outW + x] = col[y];
    }
  }
  return out;
}

function extractZlibStreams(data: Buffer): Buffer[] {
  const streams: Buffer[] = [];
  let pos = 0;
  while (pos < data.length - 2) {
    if (data[pos] === 0x78 && [0x01, 0x5E, 0x9C, 0xDA].includes(data[pos + 1])) {
      for (let end = pos + 2; end <= data.length; end++) {
        try { streams.push(zlib.inflateSync(data.subarray(pos, end))); pos = end; break; }
        catch { continue; }
      }
    }
    pos++;
  }
  return streams;
}

export function parseItwHeader(data: Buffer): ItwHeader {
  return {
    magic: data.subarray(0, 4).toString('ascii'), flags: data.readUInt16BE(4),
    width: data.readUInt16BE(6), height: data.readUInt16BE(8),
    formatVersion: data.readUInt16BE(12), compressedSize: data.readUInt32BE(14),
  };
}

export function decodeItwV1(data: Buffer, options: DecodeOptions = {}): ItwV1Result {
  const { mode = 'bilinear' } = options;
  const header = parseItwHeader(data);
  if (header.magic !== 'ITW_') throw new Error('Not ITW');
  if (header.formatVersion !== 0x0300) throw new Error('Not V1');

  const { width: w, height: h } = header;
  const streams = extractZlibStreams(data.subarray(18, 18 + header.compressedSize));

  // Dimension pyramid: [full, L1, L2, L3, L4]
  const dims: [number, number][] = [[w, h]];
  for (let i = 0; i < 4; i++) dims.push([Math.ceil(dims[i][0] / 2), Math.ceil(dims[i][1] / 2)]);
  const [l1W, l1H] = dims[1], [l2W, l2H] = dims[2], [l3W, l3H] = dims[3], [l4W, l4H] = dims[4];

  // Find and normalize LL4
  const ll4Stream = streams.find(s => s.length === l4W * l4H);
  if (!ll4Stream) throw new Error('LL4 not found');
  const ll4 = Array.from(ll4Stream);
  let min = Math.min(...ll4), max = Math.max(...ll4);
  const ll4n = ll4.map(v => (v - min) * 255 / (max - min || 1));

  let pixels: number[];

  if (mode === 'bilinear') {
    pixels = bilinear(ll4n, l4W, l4H, w, h);
  } else if (mode === 'cdf53') {
    let ll3 = synthLevel(ll4n, null, null, null, l4W, l4H, l3W, l3H);
    let ll2 = synthLevel(ll3, null, null, null, l3W, l3H, l2W, l2H);
    let ll1 = synthLevel(ll2, null, null, null, l2W, l2H, l1W, l1H);
    pixels = synthLevel(ll1, null, null, null, l1W, l1H, w, h);
  } else {
    // Full mode with L1 and L2 details
    let ll3 = synthLevel(ll4n, null, null, null, l4W, l4H, l3W, l3H);
    let ll2 = synthLevel(ll3, null, null, null, l3W, l3H, l2W, l2H);
    
    // L2 details (Q=4)
    const lh2 = decodeRle(streams[6], streams[7], l2W * (l1H - l2H)).map(v => v * 4);
    const hl2 = decodeRle(streams[8], streams[9], (l1W - l2W) * l2H).map(v => v * 4);
    let ll1 = synthLevel(ll2, lh2, hl2, null, l2W, l2H, l1W, l1H);
    
    // L1 details (Q=8)
    const lh1 = decodeRle(streams[0], streams[1], l1W * (h - l1H)).map(v => v * 8);
    const hl1 = decodeRle(streams[2], streams[3], (w - l1W) * l1H).map(v => v * 8);
    const hh1 = decodeRle(streams[4], streams[5], (w - l1W) * (h - l1H)).map(v => v * 8);
    pixels = synthLevel(ll1, lh1, hl1, hh1, l1W, l1H, w, h);
  }

  // Normalize output
  min = Infinity; max = -Infinity;
  for (const p of pixels) { if (p < min) min = p; if (p > max) max = p; }
  const range = max - min || 1;
  const result = new Uint8Array(w * h);
  for (let i = 0; i < pixels.length; i++) {
    result[i] = Math.max(0, Math.min(255, Math.round((pixels[i] - min) * 255 / range)));
  }

  return { width: w, height: h, pixels: result };
}
