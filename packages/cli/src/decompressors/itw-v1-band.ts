/**
 * ITW V1 band decoder — faithful port of itw_decode_band + coeff_reconstruct from Ghidra.
 *
 * Two paths depending on quantization:
 * - quant < 2 (L4 bands, quant=1): copy_stream_data → bitstream read_bits → coeff_reconstruct_quant1
 * - quant >= 2 (L1-L3 bands): positions + extra bits + Fischer codewords → coeff_reconstruct_quant2
 */

import * as zlib from 'zlib';
import { FISCHER_N, fischerDecode, levelScaleFactor, calcBitLengthQuant1, getRankBitLength } from './itw-v1-fischer.js';
import { placeSparseCoeffs } from './itw-v1-place.js';

/**
 * BitReader — reads bits LSB-first from a byte buffer.
 * Matches Ghidra bitstream_init / read_bits / FUN_004bc1d0.
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
      const bit = (this.buf[this.pos] >> this.bitPos) & 1;
      val |= (bit << i);
      this.bitPos++;
      if (this.bitPos >= 8) { this.bitPos = 0; this.pos++; }
    }
    return val;
  }

  consumedBytes(): number {
    return this.pos + (this.bitPos > 0 ? 1 : 0);
  }
}

export interface DecodedBand {
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
 * @param quant - Quantization level (from local_3c[band])
 * @param bandValue - piVar15 per-band value
 * @param bandScale - piVar14 per-band scale (Q15 float)
 * @param orientation - Band orientation flag (from bitstream: 0 or 1)
 * @param bandOffset - piVar13 per-band offset (Q15 float)
 * @param diffTable - Fischer diff table (5×201)
 */
export function decodeBand(
  data: Buffer,
  cursor: { pos: number },
  matrixWidth: number,
  matrixHeight: number,
  quant: number,
  bandValue: number,
  bandScale: number,
  orientation: number,
  bandOffset: number,
  diffTable: number[][],
): DecodedBand {
  const result = new Float32Array(matrixWidth * matrixHeight);

  if (quant < 2) {
    // === Quant 1 path (coeff_reconstruct_quant1) ===
    // calc_bit_length chain: returns BYTES, itw_decode_band does read_bits(bytes << 3)
    const bitsPerCodeword = calcBitLengthQuant1(bandValue);

    // copy_stream_data: read u16BE compSize, inflate
    const compSize = data.readUInt16BE(cursor.pos);
    cursor.pos += 2;
    const decompressed = zlib.inflateSync(data.subarray(cursor.pos, cursor.pos + compSize));
    cursor.pos += compSize;

    const reader = new BitReader(decompressed);

    // coeff_reconstruct_quant1 from Ghidra:
    // outer loop x (0..width-1), inner loop y (0..height-1)
    // pointer advances: pfVar6 += width (column-major: stepping by width means next row)
    // then pfVar6 -= (height * width - 1) to go to next column
    //
    // Ghidra: result = (cw % (quant*2+1) - quant) * (scale/quant) * offset + param_5
    // param_5 = bandOffset (passed as param_5=0.0 in dispatch... wait)
    //
    // Actually from coeff_reconstruct_dispatch: 
    //   quant1(param_1, param_2, param_6=bandValue, param_7=scale, param_9=0.0, param_10=offset)
    // So formula: (cw % (bandValue*2+1) - bandValue) * (scale/bandValue) * offset + 0.0
    const quantRange = bandValue * 2 + 1;
    const scaleFac = (bandScale / bandValue) * bandOffset;

    // Read codewords in column-major order: outer=x, inner=y
    // (source stride iVar3 = *(param_2+0x24) = 1 for simple int_table)
    for (let x = 0; x < matrixWidth; x++) {
      for (let y = 0; y < matrixHeight; y++) {
        const cw = reader.readBits(bitsPerCodeword);
        result[x * matrixHeight + y] = (cw % quantRange - bandValue) * scaleFac;
      }
    }

    return { data: result, width: matrixWidth, height: matrixHeight };
  }

  // === Quant >= 2 path ===

  // 1. Read position stream (copy_stream_data: u16BE compSize + inflate)
  const compSizePos = data.readUInt16BE(cursor.pos);
  cursor.pos += 2;
  const posStream = zlib.inflateSync(data.subarray(cursor.pos, cursor.pos + compSizePos));
  cursor.pos += compSizePos;

  // Parse position bytes: bit 7 = has extra bits, bits 0-6 = position value
  const posCount = posStream.length;
  const positions = new Uint8Array(posCount);
  const extraValues = new Uint8Array(posCount);

  for (let i = 0; i < posCount; i++) {
    positions[i] = posStream[i] & 0x7F;
  }

  // 2. Read extra bits (4-bit per position with 0x80 set) from inline bitstream
  // bitstream_init(*param_2) → reads from current cursor position in main stream
  const mainReader = new BitReader(data.subarray(cursor.pos));
  let bitsConsumed = 0;
  for (let i = 0; i < posCount; i++) {
    if (posStream[i] & 0x80) {
      extraValues[i] = mainReader.readBits(4);
      bitsConsumed += 4;
    }
  }
  // bitstream_finish: advance cursor past consumed bits
  cursor.pos += mainReader.consumedBytes();

  // 3. Read Fischer codeword stream (copy_stream_data)
  const compSizeFischer = data.readUInt16BE(cursor.pos);
  cursor.pos += 2;
  const fischerStream = zlib.inflateSync(data.subarray(cursor.pos, cursor.pos + compSizeFischer));
  cursor.pos += compSizeFischer;

  // Read Fischer codewords: bits per codeword from hardcoded rank table
  const fischerReader = new BitReader(fischerStream);
  const codewords = new Uint32Array(posCount);
  for (let i = 0; i < posCount; i++) {
    const bits = getRankBitLength(quant, positions[i]);
    codewords[i] = fischerReader.readBits(bits);
  }

  // 4. coeff_reconstruct_quant2 — place decoded coefficients with strided placement
  // From Ghidra coeff_reconstruct_quant2:
  //   fVar8 = (param_7 / (float)param_6) * param_10
  //         = (scale / bandValue) * offset
  //   result = decoded[j] * (fVar8 / levelScaleFactor(extra)) + param_9
  //   param_9 = 0.0 (passed from dispatch)
  // EXPERIMENT: treat offset as raw integer (undo Q15) — multiply back by 32768
  const scaleFac = (bandScale / bandValue) * (bandOffset * 32768.0);
  let posIdx = 0;

  if (orientation === 1) {
    // Vertical stepping: outer Y (step = FISCHER_N * 2), inner X
    // FUN_004b6ba0 calls: (matrix, decoded, x, baseY, 0, 2) and (matrix, decoded, x, baseY+1, 0, 2)
    for (let baseY = 0; baseY < matrixHeight && posIdx < posCount; baseY += FISCHER_N * 2) {
      for (let x = 0; x < matrixWidth && posIdx < posCount; x++) {
        // First of pair
        const dec1 = fischerDecode(codewords[posIdx], positions[posIdx], diffTable);
        const sf1 = levelScaleFactor(extraValues[posIdx]);
        const src1 = new Float32Array(FISCHER_N);
        for (let j = 0; j < FISCHER_N; j++) src1[j] = dec1[j] * (scaleFac / sf1);
        placeSparseCoeffs(result, matrixWidth, matrixHeight, src1, FISCHER_N, 1, x, baseY, 0, 2);
        posIdx++;

        if (posIdx >= posCount) break;

        // Second of pair
        const dec2 = fischerDecode(codewords[posIdx], positions[posIdx], diffTable);
        const sf2 = levelScaleFactor(extraValues[posIdx]);
        const src2 = new Float32Array(FISCHER_N);
        for (let j = 0; j < FISCHER_N; j++) src2[j] = dec2[j] * (scaleFac / sf2);
        placeSparseCoeffs(result, matrixWidth, matrixHeight, src2, FISCHER_N, 1, x, baseY + 1, 0, 2);
        posIdx++;
      }
    }
  } else {
    // Horizontal stepping: outer X (step = FISCHER_N * 2), inner Y
    // FUN_004b6ba0 calls: (matrix, decoded, baseX, y, 2, 0) and (matrix, decoded, baseX+1, y, 2, 0)
    for (let baseX = 0; baseX < matrixWidth && posIdx < posCount; baseX += FISCHER_N * 2) {
      for (let y = 0; y < matrixHeight && posIdx < posCount; y++) {
        // First of pair
        const dec1 = fischerDecode(codewords[posIdx], positions[posIdx], diffTable);
        const sf1 = levelScaleFactor(extraValues[posIdx]);
        const src1 = new Float32Array(FISCHER_N);
        for (let j = 0; j < FISCHER_N; j++) src1[j] = dec1[j] * (scaleFac / sf1);
        placeSparseCoeffs(result, matrixWidth, matrixHeight, src1, FISCHER_N, 1, baseX, y, 2, 0);
        posIdx++;

        if (posIdx >= posCount) break;

        // Second of pair
        const dec2 = fischerDecode(codewords[posIdx], positions[posIdx], diffTable);
        const sf2 = levelScaleFactor(extraValues[posIdx]);
        const src2 = new Float32Array(FISCHER_N);
        for (let j = 0; j < FISCHER_N; j++) src2[j] = dec2[j] * (scaleFac / sf2);
        placeSparseCoeffs(result, matrixWidth, matrixHeight, src2, FISCHER_N, 1, baseX + 1, y, 2, 0);
        posIdx++;
      }
    }
  }

  return { data: result, width: matrixWidth, height: matrixHeight };
}
