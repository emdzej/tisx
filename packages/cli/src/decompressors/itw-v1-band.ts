/**
 * ITW V1 band decoder — port of itw_decode_band from Ghidra.
 *
 * Two paths depending on quantization:
 * - quant < 2 (L4 bands, quant=1): simple byte stream → Fischer decode
 * - quant >= 2 (L1-L3 bands): position stream + extra bits + Fischer codewords
 *
 * Decodes one subband from the sequential data stream.
 */

import { FISCHER_N, fischerDecode, levelScaleFactor } from './itw-v1-fischer.js';

/**
 * BitReader — reads bits MSB-first from a byte buffer.
 */
class BitReader {
  private buf: Uint8Array;
  private pos = 0;
  private bitPos = 0;

  constructor(data: Uint8Array | Buffer) {
    this.buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  }

  readBits(n: number): number {
    let val = 0;
    for (let i = 0; i < n; i++) {
      if (this.pos >= this.buf.length) return val;
      val = (val << 1) | ((this.buf[this.pos] >> (7 - this.bitPos)) & 1);
      this.bitPos++;
      if (this.bitPos >= 8) { this.bitPos = 0; this.pos++; }
    }
    return val;
  }
}

/**
 * Read a sequential byte from the data stream.
 */
function readByte(data: Buffer, cursor: { pos: number }): number {
  return data[cursor.pos++];
}

/**
 * calc_band_size from Ghidra:
 * if param_4 == 0 (horizontal): ceil(width / (quant * 2))
 * else (vertical): ceil(height / (quant * 2))
 *
 * param_6 is the band orientation flag (0 or 1).
 * For bands stored as position+Fischer, bandSize determines
 * how many position bytes to read.
 */
function calcBandSize(
  width: number, height: number,
  quant: number, orientation: number,
): number {
  const dim = orientation === 0 ? width : height;
  return Math.ceil(dim / (quant * 2));
}

/**
 * calc_bit_length: ceil(log2(rank[quant-1][value]))
 * For quant <= 1: ceil(log2(value * 2 + 1))
 */
function calcBitLength(
  value: number, quant: number, rankTable: number[][],
): number {
  let count: number;
  if (quant > 1) {
    const n = quant - 1 < rankTable.length ? quant - 1 : rankTable.length - 1;
    count = value < rankTable[n].length ? rankTable[n][value] : 1;
  } else {
    count = value * 2 + 1;
  }
  if (count <= 1) return 0;
  return Math.ceil(Math.log2(count));
}

export interface DecodedBand {
  /** Decoded float coefficients in column-major order */
  data: Float32Array;
  width: number;
  height: number;
}

/**
 * Decode a single subband from the data stream.
 *
 * @param data - Full file buffer
 * @param cursor - Read cursor (mutated)
 * @param matrixWidth - Subband matrix width
 * @param matrixHeight - Subband matrix height
 * @param quant - Quantization level (local_3c[band])
 * @param bandValue - piVar15 per-band value
 * @param bandScale - piVar14 per-band scale (Q15 float)
 * @param bandPresence - Whether this band is present (from bitstream)
 * @param bandOffset - piVar13 per-band offset (Q15 float)
 * @param rankTable - Fischer diff/rank table
 */
export function decodeBand(
  data: Buffer,
  cursor: { pos: number },
  matrixWidth: number,
  matrixHeight: number,
  quant: number,
  bandValue: number,
  bandScale: number,
  bandPresence: boolean,
  bandOffset: number,
  rankTable: number[][],
): DecodedBand {
  const result = new Float32Array(matrixWidth * matrixHeight);

  if (!bandPresence) {
    // Band not present — all zeros (with offset)
    result.fill(bandOffset);
    return { data: result, width: matrixWidth, height: matrixHeight };
  }

  if (quant < 2) {
    // === Quant 1 path ===
    // Read FISCHER_N * bandSize bytes of Fischer-coded data
    const bandSize = matrixWidth * matrixHeight;
    const bitsPerCodeword = calcBitLength(bandValue, quant, rankTable);

    // copy_stream_data: read compSize(u16BE), inflate
    const compSize = data.readUInt16BE(cursor.pos);
    cursor.pos += 2;
    const zlib = require('zlib');
    const decompressed = zlib.inflateSync(data.subarray(cursor.pos, cursor.pos + compSize));
    cursor.pos += compSize;

    // Read codewords from decompressed data
    const reader = new BitReader(decompressed);
    const coeffs = new Int32Array(bandSize);
    for (let i = 0; i < bandSize; i++) {
      coeffs[i] = reader.readBits(bitsPerCodeword);
    }

    // coeff_reconstruct_quant1:
    // result = (coeff % (quant*2+1) - quant) * (scale/quant) * bandOffset_param + bandOffset
    // For quant=1: (coeff % 3 - 1) * scale * bandOffset_param + offset
    const quantRange = quant * 2 + 1;
    const scaleFactor = (bandScale / quant) * bandOffset;
    for (let x = 0; x < matrixWidth; x++) {
      for (let y = 0; y < matrixHeight; y++) {
        const idx = x * matrixHeight + y;
        result[idx] = (coeffs[idx] % quantRange - quant) * scaleFactor + bandOffset;
      }
    }

    return { data: result, width: matrixWidth, height: matrixHeight };
  }

  // === Quant >= 2 path ===
  // 1. Read position stream (bandSize bytes)
  const bandSize = calcBandSize(matrixWidth, matrixHeight, quant, 1);
  const compSizePos = data.readUInt16BE(cursor.pos);
  cursor.pos += 2;
  const zlib = require('zlib');
  const posStream = zlib.inflateSync(data.subarray(cursor.pos, cursor.pos + compSizePos));
  cursor.pos += compSizePos;

  // 2. Read extra bits (4-bit per position byte that has 0x80 flag)
  // First check DAT_00516c78 (flags byte from frame header) — if 0, read extra bits
  // For our case flags=0, so we read extra bits
  const positions = new Uint8Array(posStream.length);
  const extraBits = new Uint8Array(posStream.length);

  // Parse position bytes: bit 7 = has extra bits, bits 0-6 = position value
  for (let i = 0; i < posStream.length; i++) {
    positions[i] = posStream[i] & 0x7F;
    extraBits[i] = (posStream[i] & 0x80) ? 1 : 0;
  }

  // Read 4-bit extra values from bitstream (embedded in the main stream)
  // bitstream_init(*param_2) → reads from current cursor position
  const extraValues = new Uint8Array(posStream.length);
  const bitReader = new BitReader(data.subarray(cursor.pos));
  let bitsConsumed = 0;
  for (let i = 0; i < posStream.length; i++) {
    if (extraBits[i]) {
      extraValues[i] = bitReader.readBits(4);
      bitsConsumed += 4;
    }
  }
  // Advance cursor past consumed bits (round up to byte)
  cursor.pos += Math.ceil(bitsConsumed / 8);

  // 3. Read Fischer codeword stream (bandSize * FISCHER_N bytes)
  const compSizeFischer = data.readUInt16BE(cursor.pos);
  cursor.pos += 2;
  const fischerStream = zlib.inflateSync(data.subarray(cursor.pos, cursor.pos + compSizeFischer));
  cursor.pos += compSizeFischer;

  // Read Fischer codewords — each uses variable bits based on extra value
  const fischerReader = new BitReader(fischerStream);
  const codewords = new Int32Array(posStream.length);
  const magnitudes = new Uint32Array(posStream.length);

  for (let i = 0; i < posStream.length; i++) {
    magnitudes[i] = positions[i]; // base magnitude from position stream
    const bits = calcBitLength(positions[i], quant, rankTable);
    codewords[i] = fischerReader.readBits(bits);
  }

  // 4. coeff_reconstruct_quant2:
  // For each (position, codeword): Fischer decode → N coefficients
  // Then place into matrix with dequantization
  const scaleFac = (bandScale / quant) * bandOffset;
  let outIdx = 0;

  for (let i = 0; i < posStream.length; i++) {
    const decoded = fischerDecode(codewords[i], magnitudes[i], rankTable);
    const sf = levelScaleFactor(extraValues[i]);

    for (let j = 0; j < FISCHER_N; j++) {
      if (outIdx < result.length) {
        result[outIdx] = decoded[j] * (scaleFac / sf) + bandOffset;
        outIdx++;
      }
    }
  }

  return { data: result, width: matrixWidth, height: matrixHeight };
}
