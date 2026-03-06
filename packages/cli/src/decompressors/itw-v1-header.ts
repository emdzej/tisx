/**
 * ITW V1 file and frame header parsing.
 *
 * ITW file layout:
 *   [0..3]   magic "ITW_"
 *   [4..5]   format (BE16)
 *   [6..7]   width (BE16)
 *   [8..9]   height (BE16)
 *   [10..11] bpp (BE16)
 *   [12..13] version (BE16, 0x0300 = V1)
 *   [14..17] data size (2 x BE16, CONCAT22)
 *   [18..]   data stream for itw_decode_main
 *
 * Data stream layout (parsed by itw_decode_main):
 *   byte 0: flags
 *   byte 1: numLevels (typically 4)
 *   byte 2: filterType (1 = CDF 5/3)
 *   [bitstream]: 11 x 1-bit band presence flags
 *   [per band]: piVar15 (uint16BE) + scale (Q15 int16BE) + offset (Q15 int16BE)
 *   range_min (uint16BE) + range_max (uint16BE)
 *   [zlib blocks]: compressed subband data
 */

export interface ItwFileHeader {
  magic: string;
  format: number;
  width: number;
  height: number;
  bpp: number;
  version: number;
  dataSize: number;
  dataOffset: number; // byte offset where data stream begins
}

export interface ItwBandParams {
  value: number;    // piVar15 — per-band int value (center/quant param)
  scale: number;    // piVar14 — Q15 float scale
  offset: number;   // piVar13 — Q15 float offset
}

export interface ItwFrameHeader {
  flags: number;
  numLevels: number;
  filterType: number;
  bandPresence: boolean[];  // 11 booleans
  bands: ItwBandParams[];   // 11 entries
  rangeMin: number;
  rangeMax: number;
  zlibOffset: number; // absolute byte offset where zlib blocks start
}

const FILE_HEADER_SIZE = 14;
const DATA_SIZE_BYTES = 4;
const DATA_STREAM_OFFSET = FILE_HEADER_SIZE + DATA_SIZE_BYTES; // 18
// From Ghidra: DAT_004ed1f0 = 0x42000000 (float 32.0)
const Q15_DIVISOR = 32.0;
const NUM_BANDS = 11;

export function parseFileHeader(buf: Buffer): ItwFileHeader {
  const magic = buf.toString('ascii', 0, 4);
  if (magic !== 'ITW_') {
    throw new Error(`Invalid ITW magic: ${magic}`);
  }
  const format = buf.readUInt16BE(4);
  const width = buf.readUInt16BE(6);
  const height = buf.readUInt16BE(8);
  const bpp = buf.readUInt16BE(10);
  const version = buf.readUInt16BE(12);

  // Data size: 2 x BE16 concatenated (CONCAT22)
  const s1 = buf.readUInt16BE(14);
  const s2 = buf.readUInt16BE(16);
  const dataSize = (s1 << 16) | s2;

  return {
    magic, format, width, height, bpp, version,
    dataSize,
    dataOffset: DATA_STREAM_OFFSET,
  };
}

export function parseFrameHeader(buf: Buffer, dataOffset: number): ItwFrameHeader {
  let pos = dataOffset;

  const flags = buf[pos++];
  const numLevels = buf[pos++];
  const filterType = buf[pos++];

  // Bitstream: 11 orientation bits, LSB-first (per Ghidra)
  const bandPresence: boolean[] = [];
  let byteVal = buf[pos];
  let bitIdx = 0;
  for (let i = 0; i < NUM_BANDS; i++) {
    bandPresence.push(((byteVal >> bitIdx) & 1) === 1);
    bitIdx++;
    if (bitIdx >= 8) {
      bitIdx = 0;
      pos++;
      byteVal = buf[pos];
    }
  }
  // bitstream_finish: advance past partial byte
  if (bitIdx > 0) pos++;

  // Per-band: value (uint16BE) + scale (Q15 int16BE) + offset (Q15 int16BE)
  const bands: ItwBandParams[] = [];
  for (let i = 0; i < NUM_BANDS; i++) {
    const value = buf.readUInt16BE(pos); pos += 2;
    const scaleRaw = buf.readInt16BE(pos); pos += 2;
    const offsetRaw = buf.readInt16BE(pos); pos += 2;
    bands.push({
      value,
      scale: scaleRaw / Q15_DIVISOR,
      offset: offsetRaw / Q15_DIVISOR,
    });
  }

  // Range values
  const rangeMin = buf.readUInt16BE(pos); pos += 2;
  const rangeMax = buf.readUInt16BE(pos); pos += 2;

  return {
    flags, numLevels, filterType,
    bandPresence, bands,
    rangeMin, rangeMax,
    zlibOffset: pos,
  };
}
