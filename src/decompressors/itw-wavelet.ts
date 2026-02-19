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
 * Currently extracts LL band and upscales to full resolution.
 * Full wavelet reconstruction not yet implemented.
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

  // Calculate final LL subband size
  let llW = header.width;
  let llH = header.height;
  for (let i = 0; i < metadata.levels; i++) {
    llW = Math.ceil(llW / 2);
    llH = Math.ceil(llH / 2);
  }
  const llSize = llW * llH;

  // Find zlib streams
  const streams = findZlibStreams(compressedData);

  // Find LL stream: matches size and has highest average (actual pixel values)
  const candidates = streams.filter((s) => s.size === llSize);
  if (candidates.length === 0) {
    throw new Error(`Could not find LL stream (expected size ${llSize})`);
  }

  const llStream = candidates.reduce((a, b) => (a.average > b.average ? a : b));

  // Normalize LL values to 0-255
  const llData = Array.from(llStream.data);
  const minV = Math.min(...llData);
  const maxV = Math.max(...llData);
  const rangeV = maxV - minV || 1;
  const normalized = llData.map((v) => ((v - minV) * 255) / rangeV);

  // Upscale to full resolution
  const upscaled = bilinearUpscale(normalized, llW, llH, header.width, header.height);

  // Convert to Buffer
  const pixels = Buffer.from(upscaled.map((v) => Math.max(0, Math.min(255, Math.round(v)))));

  return {
    header,
    metadata,
    pixels,
    llOnly: true,
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
