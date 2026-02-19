/**
 * ITW V1 (0x0300) Wavelet Image Decoder
 *
 * Based on reverse engineering of tis.exe from BMW TIS.
 *
 * File Structure:
 * - Header (18 bytes):
 *   - 0-3: Magic "ITW_" (0x4954575F)
 *   - 4-5: Unknown
 *   - 6-7: Width (big-endian)
 *   - 8-9: Height (big-endian)
 *   - 10-11: Bit depth (big-endian, usually 8)
 *   - 12-13: Format type (0x0300 for V1 wavelet)
 *   - 14-17: Compressed data size (big-endian)
 *   - 18+: Compressed data
 *
 * Compressed Data:
 *   - Byte 0: Mode flag
 *   - Byte 1: Wavelet decomposition levels (3 or 4)
 *   - Byte 2: Filter type (0=9/7, 1=7/5 biorthogonal)
 *   - Bytes 3+: Subband metadata + zlib-compressed coefficient streams
 *
 * Wavelet Structure (4 levels):
 *   - 12 subbands: LH0, HL0, HH0, LH1, HL1, HH1, LH2, HL2, HH2, LH3, HL3, HH3
 *   - Plus LL3 (lowest frequency band)
 *   - Each subband stored as zlib-compressed data
 */

import * as zlib from 'zlib';

export interface ItwV1Header {
  magic: string;
  width: number;
  height: number;
  bitDepth: number;
  formatType: number;
  compressedSize: number;
}

export interface ItwV1Metadata {
  modeFlag: number;
  levels: number;
  filterType: number;
}

export interface ZlibStream {
  offset: number;
  data: Buffer;
  size: number;
  average: number;
}

export interface ItwV1DecodeResult {
  header: ItwV1Header;
  metadata: ItwV1Metadata;
  pixels: Buffer;
  llOnly: boolean;
}

/**
 * Parse ITW V1 header
 */
export function parseItwV1Header(buffer: Buffer): ItwV1Header | null {
  if (buffer.length < 18) return null;

  const magic = buffer.subarray(0, 4).toString('ascii');
  if (magic !== 'ITW_') return null;

  const formatType = buffer.readUInt16BE(12);
  if (formatType !== 0x0300) return null;

  return {
    magic,
    width: buffer.readUInt16BE(6),
    height: buffer.readUInt16BE(8),
    bitDepth: buffer.readUInt16BE(10),
    formatType,
    compressedSize: buffer.readUInt32BE(14),
  };
}

/**
 * Find all zlib-compressed streams in data
 */
export function findZlibStreams(data: Buffer): ZlibStream[] {
  const streams: ZlibStream[] = [];
  let pos = 0;

  while (pos < data.length - 2) {
    // zlib magic: 78 01 (no compression), 78 5E (fast), 78 9C (default), 78 DA (best)
    if (data[pos] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(data[pos + 1])) {
      let found = false;
      for (let end = pos + 2; end <= data.length; end++) {
        try {
          const decompressed = zlib.inflateSync(data.subarray(pos, end));
          const avg =
            decompressed.length > 0
              ? decompressed.reduce((a, b) => a + b, 0) / decompressed.length
              : 0;

          streams.push({
            offset: pos,
            data: decompressed,
            size: decompressed.length,
            average: avg,
          });
          pos = end;
          found = true;
          break;
        } catch {
          continue;
        }
      }
      if (!found) pos++;
    } else {
      pos++;
    }
  }

  return streams;
}

/**
 * Decode RLE-encoded coefficient stream
 *
 * RLE encoding:
 * - 0x00: Place next coefficient from value stream, advance position by 1
 * - 0x01-0x7F: Skip N positions (no coefficient)
 * - 0x80-0xFF: Embedded coefficient (value - 192), advance position by 1
 */
export function decodeRleCoefficients(
  rleData: Buffer,
  valueData: Buffer,
  maxSize: number
): number[] {
  const coeffs = new Array(maxSize).fill(0);
  let pos = 0;
  let valIdx = 0;

  for (const byte of rleData) {
    if (pos >= maxSize) break;

    if (byte === 0) {
      // Place coefficient from value stream
      if (valIdx < valueData.length) {
        const v = valueData[valIdx];
        coeffs[pos] = v > 127 ? v - 256 : v; // Signed int8
        valIdx++;
      }
      pos++;
    } else if (byte < 128) {
      // Skip N positions
      pos += byte;
    } else {
      // Embedded coefficient (centered at 192)
      coeffs[pos] = byte - 192;
      pos++;
    }
  }

  return coeffs;
}

/**
 * 1D CDF 7/5 inverse wavelet transform using integer lifting
 */
function cdf75Inverse1D(s: number[], d: number[] | null, outLen: number): number[] {
  const sCopy = [...s];
  const dArr = d || [];

  // Inverse Update: s[n] -= (d[n-1] + d[n] + 2) / 4
  for (let i = 0; i < sCopy.length; i++) {
    const left = i > 0 && dArr.length ? dArr[i - 1] : 0;
    const right = i < dArr.length ? dArr[i] : dArr.length ? dArr[dArr.length - 1] : 0;
    sCopy[i] = sCopy[i] - (left + right + 2) / 4;
  }

  // Interleave
  const result = new Array(outLen).fill(0);
  for (let i = 0; i < sCopy.length; i++) {
    if (2 * i < outLen) {
      result[2 * i] = sCopy[i];
    }
  }

  // Inverse Predict: d[n] += (x[2n] + x[2n+2]) / 2
  for (let i = 0; i < dArr.length; i++) {
    if (2 * i + 1 < outLen) {
      const left = result[2 * i];
      const right = 2 * i + 2 < outLen ? result[2 * i + 2] : result[2 * i];
      result[2 * i + 1] = dArr[i] + (left + right) / 2;
    }
  }

  return result;
}

/**
 * 2D CDF 7/5 inverse wavelet transform
 */
function cdf75Inverse2D(
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

  const to2D = (arr: number[] | null, w: number, h: number): number[][] =>
    Array.from({ length: h }, (_, y) =>
      Array.from({ length: w }, (_, x) => (arr && y * w + x < arr.length ? arr[y * w + x] : 0))
    );

  const ll2d = to2D(ll, llW, llH);
  const lh2d = to2D(lh, llW, lhH);
  const hl2d = to2D(hl, hlW, llH);
  const hh2d = to2D(hh, hlW, lhH);

  // Vertical reconstruction
  const leftCols = Array.from({ length: llW }, (_, x) =>
    cdf75Inverse1D(
      ll2d.map((row) => row[x]),
      lh2d.map((row) => row[x]),
      outH
    )
  );

  const rightCols = Array.from({ length: hlW }, (_, x) =>
    cdf75Inverse1D(
      hl2d.map((row) => row[x]),
      hh2d.map((row) => row[x]),
      outH
    )
  );

  // Horizontal reconstruction
  const result: number[] = [];
  for (let y = 0; y < outH; y++) {
    const rowS = leftCols.map((col) => col[y]);
    const rowD = rightCols.map((col) => col[y]);
    result.push(...cdf75Inverse1D(rowS, rowD, outW));
  }

  return result;
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
      const srcY = (y * srcH) / dstH;
      const srcX = (x * srcW) / dstW;

      const y0 = Math.floor(srcY);
      const x0 = Math.floor(srcX);
      const y1 = Math.min(y0 + 1, srcH - 1);
      const x1 = Math.min(x0 + 1, srcW - 1);

      const fy = srcY - y0;
      const fx = srcX - x0;

      const v00 = src[y0 * srcW + x0];
      const v01 = src[y0 * srcW + x1];
      const v10 = src[y1 * srcW + x0];
      const v11 = src[y1 * srcW + x1];

      const v =
        v00 * (1 - fx) * (1 - fy) +
        v01 * fx * (1 - fy) +
        v10 * (1 - fx) * fy +
        v11 * fx * fy;

      result.push(v);
    }
  }

  return result;
}

/**
 * Calculate subband dimensions for given image size and decomposition level
 */
export function calculateSubbandDimensions(
  width: number,
  height: number,
  levels: number
): { name: string; width: number; height: number; size: number }[] {
  const subbands: { name: string; width: number; height: number; size: number }[] = [];
  let w = width;
  let h = height;

  for (let level = 0; level < levels; level++) {
    const llW = Math.ceil(w / 2);
    const llH = Math.ceil(h / 2);
    const hW = w - llW;
    const hH = h - llH;

    subbands.push({ name: `LH${level}`, width: llW, height: hH, size: llW * hH });
    subbands.push({ name: `HL${level}`, width: hW, height: llH, size: hW * llH });
    subbands.push({ name: `HH${level}`, width: hW, height: hH, size: hW * hH });

    w = llW;
    h = llH;
  }

  // Final LL band
  subbands.push({ name: `LL${levels - 1}`, width: w, height: h, size: w * h });

  return subbands;
}

/**
 * Decode ITW V1 (0x0300) format image
 *
 * Uses CDF 7/5 inverse wavelet transform with available subbands.
 * Currently extracts LL3 and LH2 (direct storage) for partial reconstruction.
 */
export function decodeItwV1(buffer: Buffer): ItwV1DecodeResult {
  const header = parseItwV1Header(buffer);
  if (!header) {
    throw new Error('Invalid ITW V1 header');
  }

  const compressedData = buffer.subarray(18, 18 + header.compressedSize);

  const metadata: ItwV1Metadata = {
    modeFlag: compressedData[0],
    levels: compressedData[1],
    filterType: compressedData[2],
  };

  // Calculate dimensions for each level
  const dims: { full: [number, number]; ll: [number, number] }[] = [];
  let w = header.width;
  let h = header.height;
  for (let i = 0; i < metadata.levels; i++) {
    const llW = Math.ceil(w / 2);
    const llH = Math.ceil(h / 2);
    dims.push({ full: [w, h], ll: [llW, llH] });
    w = llW;
    h = llH;
  }

  const llW = w;
  const llH = h;
  const llSize = llW * llH;

  // Calculate LH2 size (Level 2)
  const lh2Size = dims[2] ? dims[2].ll[0] * (dims[2].full[1] - dims[2].ll[1]) : 0;

  // Find zlib streams
  const streams = findZlibStreams(compressedData);

  // Find LL stream: matches size and has highest average
  const llCandidates = streams.filter((s) => s.size === llSize);
  if (llCandidates.length === 0) {
    throw new Error(`Could not find LL stream (expected size ${llSize})`);
  }
  const llStream = llCandidates.reduce((a, b) => (a.average > b.average ? a : b));
  const ll3 = Array.from(llStream.data).map(Number);

  // Find LH2 stream: matches size and has low average (detail coefficients)
  let lh2: number[] | null = null;
  if (lh2Size > 0) {
    const lh2Candidates = streams.filter((s) => s.size === lh2Size && s.average < 50);
    if (lh2Candidates.length > 0) {
      const lh2Stream = lh2Candidates[0];
      lh2 = Array.from(lh2Stream.data).map((v) => (v > 127 ? v - 256 : v));
    }
  }

  // Reconstruct using CDF 7/5 inverse transform
  let current = ll3;

  for (let lvl = metadata.levels - 1; lvl >= 0; lvl--) {
    const [outW, outH] = dims[lvl].full;
    const lh = lvl === 2 ? lh2 : null;

    current = cdf75Inverse2D(current, lh, null, null, outW, outH);
  }

  // Normalize to 0-255
  const minV = Math.min(...current);
  const maxV = Math.max(...current);
  const rangeV = maxV - minV || 1;
  const normalized = current.map((v) => ((v - minV) * 255) / rangeV);

  // Convert to Buffer
  const pixels = Buffer.from(normalized.map((v) => Math.max(0, Math.min(255, Math.round(v)))));

  return {
    header,
    metadata,
    pixels,
    llOnly: !lh2,
  };
}

/**
 * Check if buffer is ITW V1 format
 */
export function isItwV1(buffer: Buffer): boolean {
  if (buffer.length < 14) return false;
  if (buffer.subarray(0, 4).toString('ascii') !== 'ITW_') return false;
  return buffer.readUInt16BE(12) === 0x0300;
}
