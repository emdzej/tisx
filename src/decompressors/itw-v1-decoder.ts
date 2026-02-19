/**
 * ITW V1 (0x0300) Wavelet Decoder with detail bands
 */
import * as zlib from 'zlib';

export interface ItwHeader {
  magic: string; flags: number; width: number; height: number;
  formatVersion: number; compressedSize: number;
}

export interface ItwV1Result { width: number; height: number; pixels: Uint8Array; }
export interface DecodeOptions { mode?: 'bilinear' | 'cdf53' | 'full'; }

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

function fischer(b: number): number {
  const mode = b >> 6, val = b & 0x3F;
  return [val, -val, val+64, -(val+64)][mode];
}

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

function cdf53Row(s: number[], d: number[]): number[] {
  const ns = s.length, nd = d.length;
  if (ns === 0) return [];
  const even = s.map((v, i) => nd ? v - (d[Math.max(0,i-1)] + d[Math.min(i,nd-1)])/4 : v);
  const odd = nd ? d.map((v, i) => v + (even[i] + even[Math.min(i+1,ns-1)])/2) : [];
  const out = new Array(ns + nd).fill(0);
  for (let i = 0; i < ns; i++) out[2*i] = even[i];
  for (let i = 0; i < nd; i++) out[2*i+1] = odd[i];
  return out;
}

function cdf53_2d(ll: number[], lh: number[]|null, hl: number[]|null, hh: number[]|null,
                  llW: number, llH: number, outW: number, outH: number): number[] {
  const hlW = Math.floor(outW / 2), lhH = Math.floor(outH / 2);
  const L: number[][] = [];
  for (let y = 0; y < llH; y++) {
    const s = ll.slice(y*llW, (y+1)*llW);
    const d = hl ? hl.slice(y*hlW, (y+1)*hlW) : new Array(hlW).fill(0);
    L.push(cdf53Row(s, d).slice(0, outW));
  }
  const H: number[][] = [];
  for (let y = 0; y < lhH; y++) {
    const s = lh ? lh.slice(y*llW, (y+1)*llW) : new Array(llW).fill(0);
    const d = hh ? hh.slice(y*hlW, (y+1)*hlW) : new Array(hlW).fill(0);
    H.push(cdf53Row(s, d).slice(0, outW));
  }
  const out = new Array(outW * outH).fill(0);
  for (let x = 0; x < outW; x++) {
    const s = L.map(row => row[x] ?? 0);
    const d = H.map(row => row[x] ?? 0);
    const col = cdf53Row(s, d);
    for (let y = 0; y < Math.min(outH, col.length); y++) out[y*outW + x] = col[y];
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
  if (header.magic !== 'ITW_') throw new Error(`Not ITW`);
  if (header.formatVersion !== 0x0300) throw new Error(`Not V1`);

  const { width, height } = header;
  const streams = extractZlibStreams(data.subarray(18, 18 + header.compressedSize));

  // Dimension pyramid
  const dims: [number, number][] = [[width, height]];
  for (let i = 0; i < 4; i++) dims.push([Math.ceil(dims[i][0]/2), Math.ceil(dims[i][1]/2)]);
  const [l1W, l1H] = dims[1], [l2W, l2H] = dims[2], [l3W, l3H] = dims[3], [l4W, l4H] = dims[4];

  // Find LL4
  const ll4Size = l4W * l4H;
  const ll4Stream = streams.find(s => s.length === ll4Size);
  if (!ll4Stream) throw new Error(`LL4 not found`);

  const ll4 = Array.from(ll4Stream);
  let min = Infinity, max = -Infinity;
  for (const v of ll4) { if (v < min) min = v; if (v > max) max = v; }
  const ll4n = ll4.map(v => (v - min) * 255 / (max - min || 1));

  let pixels: number[];

  if (mode === 'bilinear') {
    pixels = bilinear(ll4n, l4W, l4H, width, height);
  } else if (mode === 'cdf53') {
    let ll3 = cdf53_2d(ll4n, null, null, null, l4W, l4H, l3W, l3H);
    let ll2 = cdf53_2d(ll3, null, null, null, l3W, l3H, l2W, l2H);
    let ll1 = cdf53_2d(ll2, null, null, null, l2W, l2H, l1W, l1H);
    pixels = cdf53_2d(ll1, null, null, null, l1W, l1H, width, height);
  } else {
    // Full mode with L1 details
    let ll3 = cdf53_2d(ll4n, null, null, null, l4W, l4H, l3W, l3H);
    let ll2 = cdf53_2d(ll3, null, null, null, l3W, l3H, l2W, l2H);
    let ll1 = cdf53_2d(ll2, null, null, null, l2W, l2H, l1W, l1H);
    
    // Decode L1 details from S0/S1 (LH1) and S2/S3 (HL1)
    const l1Size = l1W * l1H;
    const lh1 = decodeRle(streams[0], streams[1], l1Size).map(v => v * 8);
    const hl1 = decodeRle(streams[2], streams[3], l1Size).map(v => v * 8);
    
    pixels = cdf53_2d(ll1, lh1, hl1, null, l1W, l1H, width, height);
  }

  // Normalize output
  min = Infinity; max = -Infinity;
  for (const p of pixels) { if (p < min) min = p; if (p > max) max = p; }
  const range = max - min || 1;
  const result = new Uint8Array(width * height);
  for (let i = 0; i < pixels.length; i++) {
    result[i] = Math.max(0, Math.min(255, Math.round((pixels[i] - min) * 255 / range)));
  }

  return { width, height, pixels: result };
}
