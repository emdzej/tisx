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
  private bitPos = 0; // bit index 0..7, LSB-first

  constructor(data: Uint8Array | Buffer) {
    this.buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  }

  // LSB-first reader: first call returns bit 0 of byte 0
  readBits(n: number): number {
    let val = 0;
    for (let i = 0; i < n; i++) {
      if (this.pos >= this.buf.length) return val;
      const bit = (this.buf[this.pos] >> this.bitPos) & 1;
      val |= (bit << i);
      this.bitPos++;
      if (this.bitPos >= 8) { this.bitPos = 0; this.pos++; }
    }
    return val;
  }

  // return how many bytes consumed (including partial byte)
  consumedBytes(): number {
    return this.pos + (this.bitPos > 0 ? 1 : 0);
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
import { placeSparseCoeffs } from './itw-v1-place.js';

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

  // Note: frame header 'bandPresence' field carries orientation flag (0/1) in original.
  // Treat the boolean as orientation: true->1, false->0. We do NOT skip decoding — all 11 bands are read sequentially.
  const orientation = bandPresence ? 1 : 0;

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

  // 4. coeff_reconstruct_quant2 — orientation-dependent pair processing
  const scaleFac = (bandScale / quant) * bandOffset;
  let posIdx = 0;

  if (orientation === 1) {
    // vertical stepping: outer over Y blocks (step = FISCHER_N * 2), inner over X
    const yStepBlock = FISCHER_N * 2;
    for (let baseY = 0; baseY < matrixHeight; baseY += yStepBlock) {
      for (let x = 0; x < matrixWidth; x++) {
        if (posIdx >= posStream.length) break;
        // first block -> start at (x, baseY), step (0,2)
        const cw1 = codewords[posIdx];
        const mag1 = magnitudes[posIdx];
        const sf1 = levelScaleFactor(extraValues[posIdx]);
        const dec1 = fischerDecode(cw1, mag1, rankTable);
        const src1 = new Float32Array(dec1.length);
        for (let j = 0; j < dec1.length; j++) src1[j] = dec1[j] * (scaleFac / sf1) + bandOffset;
        placeSparseCoeffs(result, matrixWidth, matrixHeight, src1, src1.length, 1, x, baseY, 0, 2);
        posIdx++;

        if (posIdx >= posStream.length) break;
        // second block -> start at (x, baseY+1), step (0,2)
        const cw2 = codewords[posIdx];
        const mag2 = magnitudes[posIdx];
        const sf2 = levelScaleFactor(extraValues[posIdx]);
        const dec2 = fischerDecode(cw2, mag2, rankTable);
        const src2 = new Float32Array(dec2.length);
        for (let j = 0; j < dec2.length; j++) src2[j] = dec2[j] * (scaleFac / sf2) + bandOffset;
        placeSparseCoeffs(result, matrixWidth, matrixHeight, src2, src2.length, 1, x, baseY + 1, 0, 2);
        posIdx++;
      }
      if (posIdx >= posStream.length) break;
    }
  } else {
    // horizontal stepping: outer over X blocks (step = FISCHER_N * 2), inner over Y
    const xStepBlock = FISCHER_N * 2;
    for (let baseX = 0; baseX < matrixWidth; baseX += xStepBlock) {
      for (let y = 0; y < matrixHeight; y++) {
        if (posIdx >= posStream.length) break;
        // first block -> start at (baseX, y), step (2,0)
        const cw1 = codewords[posIdx];
        const mag1 = magnitudes[posIdx];
        const sf1 = levelScaleFactor(extraValues[posIdx]);
        const dec1 = fischerDecode(cw1, mag1, rankTable);
        const src1 = new Float32Array(dec1.length);
        for (let j = 0; j < dec1.length; j++) src1[j] = dec1[j] * (scaleFac / sf1) + bandOffset;
        placeSparseCoeffs(result, matrixWidth, matrixHeight, src1, src1.length, 1, baseX, y, 2, 0);
        posIdx++;

        if (posIdx >= posStream.length) break;
        // second block -> start at (baseX+1, y), step (2,0)
        const cw2 = codewords[posIdx];
        const mag2 = magnitudes[posIdx];
        const sf2 = levelScaleFactor(extraValues[posIdx]);
        const dec2 = fischerDecode(cw2, mag2, rankTable);
        const src2 = new Float32Array(dec2.length);
        for (let j = 0; j < dec2.length; j++) src2[j] = dec2[j] * (scaleFac / sf2) + bandOffset;
        placeSparseCoeffs(result, matrixWidth, matrixHeight, src2, src2.length, 1, baseX + 1, y, 2, 0);
        posIdx++;
      }
      if (posIdx >= posStream.length) break;
    }
  }

  return { data: result, width: matrixWidth, height: matrixHeight };
}
