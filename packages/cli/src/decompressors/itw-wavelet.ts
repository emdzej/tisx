/**
 * ITW V1 Wavelet Decoder
 *
 * Decodes BMW TIS ITW images using CDF 7/5 wavelet decompression
 * with Fischer/Combinatorial coding for coefficient encoding.
 */

import * as zlib from "zlib";

// Quantization steps per wavelet level
const QUANT_STEPS = [8, 8, 4, 4, 4, 2, 2, 2, 1, 1, 1];

/**
 * Fischer/Combinatorial lookup table
 * 9 rows × 201 columns
 * Each row is cumulative sum of previous row
 */
function buildFischerTable(maxN = 201): number[][] {
  const table: number[][] = [];

  // Row 0: all ones
  table[0] = Array(maxN).fill(1);

  // Row 1: odd numbers (2n+1)
  table[1] = Array.from({ length: maxN }, (_, n) => 2 * n + 1);

  // Rows 2-8: cumulative sums
  for (let r = 2; r < 9; r++) {
    table[r] = [];
    let cumsum = 0;
    for (let j = 0; j < maxN; j++) {
      cumsum += table[r - 1][j];
      table[r][j] = cumsum;
    }
  }

  return table;
}

const FISCHER_TABLE = buildFischerTable();

/**
 * Bit reader for LSB-first bit streams
 */
class BitReader {
  private data: Uint8Array;
  private bytePos = 0;
  private bitPos = 0;
  private currentByte = 0;

  constructor(data: number[] | Uint8Array) {
    this.data = data instanceof Uint8Array ? data : new Uint8Array(data);
  }

  /**
   * Read single bit (LSB first)
   */
  readBit(): number {
    if (this.bitPos === 0) {
      this.currentByte = this.data[this.bytePos] || 0;
    }

    const bit = this.currentByte & 1;
    this.currentByte >>= 1;
    this.bitPos++;

    if (this.bitPos === 8) {
      this.bitPos = 0;
      this.bytePos++;
    }

    return bit;
  }

  /**
   * Read N bits, LSB first
   */
  readBits(n: number): number {
    let value = 0;
    for (let i = 0; i < n; i++) {
      if (this.readBit()) {
        value |= 1 << i;
      }
    }
    return value;
  }

  /**
   * Check if more data available
   */
  hasMore(): boolean {
    return this.bytePos < this.data.length;
  }
}

/**
 * Decode Fischer-encoded integer into multiple coefficients
 */
function fischerDecode(
  code: number,
  numCoeffs: number,
  signBits: number,
  tableRow: number
): number[] {
  const coeffs: number[] = [];
  let remaining = code;

  for (let i = numCoeffs - 1; i >= 0; i--) {
    // Find largest k where table[row][k] <= remaining
    let k = 0;
    for (let j = 200; j >= 0; j--) {
      if (FISCHER_TABLE[tableRow][j] <= remaining) {
        k = j;
        break;
      }
    }

    // Apply sign from signBits
    const sign = (signBits >> i) & 1 ? -1 : 1;
    coeffs.push(k * sign);

    remaining -= FISCHER_TABLE[tableRow][k];
  }

  return coeffs.reverse();
}

/**
 * Decode RLE stream with optional value stream
 */
function decodeRleCoefficients(
  rleStream: number[],
  valueStream: number[] | null,
  maxSize: number,
  quantIdx: number
): number[] {
  const coeffs = new Array(maxSize).fill(0);
  let pos = 0;
  let valIdx = 0;

  const quant = QUANT_STEPS[quantIdx] || 1;

  for (const byte of rleStream) {
    if (pos >= maxSize) break;

    if (byte === 0) {
      // Place coefficient from value stream
      if (valueStream && valIdx < valueStream.length) {
        const v = valueStream[valIdx++];
        const hasSignExt = (v & 0x80) !== 0;
        const index = v & 0x7f;

        // Simple interpretation: index is magnitude, high bit is sign
        coeffs[pos] = hasSignExt ? -index : index;
      }
      pos++;
    } else if (byte < 128) {
      // Skip N positions
      pos += byte;
    } else {
      // Embedded coefficient (byte - 192)
      coeffs[pos] = byte - 192;
      pos++;
    }
  }

  return coeffs;
}

/**
 * 1D CDF 7/5 inverse wavelet transform
 */
function cdf75Inverse1D(
  low: number[],
  high: number[] | null,
  outLen: number
): number[] {
  const s = low.map((x) => x);
  const d = high ? high.map((x) => x) : [];

  // Update step (modify low-frequency using high-frequency)
  for (let i = 0; i < s.length; i++) {
    const left = i > 0 && d.length > 0 ? d[i - 1] : 0;
    const right =
      i < d.length ? d[i] : d.length > 0 ? d[d.length - 1] : 0;
    s[i] = s[i] - (left + right + 2) / 4;
  }

  // Interleave even samples
  const result = new Array(outLen).fill(0);
  for (let i = 0; i < s.length; i++) {
    if (2 * i < outLen) {
      result[2 * i] = s[i];
    }
  }

  // Predict step (reconstruct odd samples)
  for (let i = 0; i < d.length; i++) {
    if (2 * i + 1 < outLen) {
      const left = result[2 * i];
      const right = 2 * i + 2 < outLen ? result[2 * i + 2] : result[2 * i];
      result[2 * i + 1] = d[i] + (left + right) / 2;
    }
  }

  return result;
}

/**
 * Convert 1D array to 2D
 */
function to2D(arr: number[] | null, width: number, height: number): number[][] {
  const result: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      row.push(arr && idx < arr.length ? arr[idx] : 0);
    }
    result.push(row);
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
  const lhH = lh ? outH - llH : 0;
  const hlW = hl ? outW - llW : 0;

  const ll2d = to2D(ll, llW, llH);
  const lh2d = lh ? to2D(lh, llW, lhH) : null;
  const hl2d = hl ? to2D(hl, hlW, llH) : null;
  const hh2d = hh ? to2D(hh, hlW, lhH) : null;

  // Vertical transform on each column
  const leftCols: number[][] = [];
  for (let x = 0; x < llW; x++) {
    const lowCol = ll2d.map((row) => row[x]);
    const highCol = lh2d ? lh2d.map((row) => row[x]) : null;
    leftCols.push(cdf75Inverse1D(lowCol, highCol, outH));
  }

  const rightCols: number[][] = [];
  for (let x = 0; x < hlW; x++) {
    const lowCol = hl2d ? hl2d.map((row) => row[x]) : new Array(llH).fill(0);
    const highCol = hh2d ? hh2d.map((row) => row[x]) : null;
    rightCols.push(cdf75Inverse1D(lowCol, highCol, outH));
  }

  // Horizontal transform on each row
  const result: number[] = [];
  for (let y = 0; y < outH; y++) {
    const lowRow = leftCols.map((col) => col[y]);
    const highRow = rightCols.map((col) => col[y]);
    result.push(...cdf75Inverse1D(lowRow, highRow.length > 0 ? highRow : null, outW));
  }

  return result;
}

/**
 * Find and decompress all zlib streams in data
 */
function findZlibStreams(data: Buffer): number[][] {
  const streams: number[][] = [];
  let pos = 0;

  while (pos < data.length - 2) {
    // Check for zlib header
    if (
      data[pos] === 0x78 &&
      [0x01, 0x5e, 0x9c, 0xda].includes(data[pos + 1])
    ) {
      // Try to decompress
      for (let end = pos + 2; end <= data.length; end++) {
        try {
          const decompressed = zlib.inflateSync(data.subarray(pos, end));
          streams.push(Array.from(decompressed));
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
 * Trim padding from value stream
 * Detects repeating patterns at end of stream
 */
function trimPadding(stream: number[], minPatternLen = 3): number[] {
  if (stream.length < minPatternLen * 2) return stream;

  // Look for repeating pattern at end
  for (let patLen = minPatternLen; patLen <= 20; patLen++) {
    const pattern = stream.slice(-patLen);
    let repeats = 0;
    let checkPos = stream.length - patLen;

    while (checkPos >= patLen) {
      const segment = stream.slice(checkPos - patLen, checkPos);
      if (segment.every((v, i) => v === pattern[i])) {
        repeats++;
        checkPos -= patLen;
      } else {
        break;
      }
    }

    if (repeats >= 10) {
      // Found padding pattern
      return stream.slice(0, checkPos);
    }
  }

  return stream;
}

export interface DecodedImage {
  width: number;
  height: number;
  pixels: number[];
}

/**
 * Decode ITW V1 image
 */
export function decodeItwV1(data: Buffer): DecodedImage {
  // Parse header
  const magic = data.toString("ascii", 0, 4);
  if (magic !== "ITW_") {
    throw new Error(`Invalid magic: ${magic}`);
  }

  const type = data.readUInt16BE(4);
  if (type !== 0x0300) {
    throw new Error(`Not a V1 file: type=${type.toString(16)}`);
  }

  const width = data.readUInt16BE(6);
  const height = data.readUInt16BE(8);
  const compressedSize = data.readUInt32BE(14);

  // Extract zlib streams
  const compressedData = data.subarray(18, 18 + compressedSize);
  const streams = findZlibStreams(compressedData);

  if (streams.length < 17) {
    throw new Error(`Expected at least 17 streams, got ${streams.length}`);
  }

  // Direct streams (these work!)
  const ll3 = streams[16].map((v) => v); // LL3: direct unsigned bytes
  const lh2 = streams[4].map((v) => (v > 127 ? v - 256 : v)); // LH2: direct signed bytes

  // RLE streams with value streams
  const s1Trimmed = trimPadding(streams[1]);
  const s3Trimmed = trimPadding(streams[3]);

  // Calculate subband sizes
  const w0 = width;
  const h0 = height;
  const w1 = Math.ceil(w0 / 2); // 158
  const h1 = Math.ceil(h0 / 2); // 119
  const w2 = Math.ceil(w1 / 2); // 79
  const h2 = Math.ceil(h1 / 2); // 60
  const w3 = Math.ceil(w2 / 2); // 40
  const h3 = Math.ceil(h2 / 2); // 30

  const lh1Size = w1 * (h1 - Math.ceil(h1 / 2)); // ~4661
  const hl1Size = (w1 - Math.ceil(w1 / 2)) * h1; // ~4740

  // Decode LH1 and HL1 from RLE + values
  const lh1 = decodeRleCoefficients(streams[0], s1Trimmed, lh1Size, 3);
  const hl1 = decodeRleCoefficients(streams[2], s3Trimmed, hl1Size, 4);

  // Wavelet reconstruction
  // Level 3 → Level 2
  let level2 = cdf75Inverse2D(ll3, null, null, null, w3, h3);

  // Level 2 → Level 1 (add LH2)
  let level1 = cdf75Inverse2D(level2, lh2, null, null, w2, h2);

  // Level 1 → Level 0 (add LH1, HL1)
  let level0 = cdf75Inverse2D(level1, lh1, hl1, null, w1, h1);

  // Level 0 → Full resolution
  const full = cdf75Inverse2D(level0, null, null, null, w0, h0);

  // Normalize to 0-255
  const minV = Math.min(...full);
  const maxV = Math.max(...full);
  const range = maxV - minV || 1;
  const pixels = full.map((v) =>
    Math.max(0, Math.min(255, Math.round(((v - minV) * 255) / range)))
  );

  return { width, height, pixels };
}

// Export utilities for testing
export {
  buildFischerTable,
  fischerDecode,
  BitReader,
  decodeRleCoefficients,
  cdf75Inverse1D,
  cdf75Inverse2D,
  findZlibStreams,
  trimPadding,
  FISCHER_TABLE,
  QUANT_STEPS,
};
