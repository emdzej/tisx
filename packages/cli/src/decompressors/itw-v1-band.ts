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
    // EXPERIMENT: treat offset as raw integer (undo Q15) — multiply back by 32768
    // Same as quant>=2 path
    const scaleFac = (bandScale / bandValue) * (bandOffset * 32768.0);

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

  // Fischer codewords are read on-demand (only for k > 0 positions)
  const fischerReader = new BitReader(fischerStream);

  // Read all Fischer codewords into array using positions[] bit lengths
  const codewords: Uint32Array = new Uint32Array(posCount);
  for (let i = 0; i < posCount; i++) {
    const bits = getRankBitLength(quant, positions[i]);
    codewords[i] = bits > 0 ? fischerReader.readBits(bits) : 0;
  }

  // 4. coeff_reconstruct_quant2 — place decoded coefficients
  //
  // Position stream layout: one entry per block of size (1 x quant) or (quant x 1)
  // For orientation=1 (vertical): iterate x outer, blockY inner
  //   - posCount ≈ W * ceil(H / quant)
  //   - Each position entry: if k > 0, decode Fischer (5 values), place in column
  // For orientation=0 (horizontal): iterate y outer, blockX inner
  //   - posCount ≈ H * ceil(W / quant)
  //
  // Fischer decodes FISCHER_N=5 values. Place them sequentially (step=1) within the block.
  // If k=0, skip (all zeros for this block).
  
  // 4. coeff_reconstruct_quant2 — place decoded coefficients
  //
  // Scale factor for dequantization (from Ghidra):
  // fVar8 = (scale / bandValue) * offset
  // Both scale and offset are Q15 floats (already converted from fixed-point)
  // but we need to treat offset as if it's still in Q15 range → multiply by 32768
  
  const scaleFac = (bandScale / bandValue) * (bandOffset * 32768.0);
  
  let posIdx = 0;

  if (orientation === 1) {
    // Vertical: orient=1
    // Outer loop: y steps by FISCHER_N * 2 (which is 10)
    // Inner loop: x steps by 1
    // Places two interleaved blocks per inner loop
    for (let y = 0; y < matrixHeight; y += FISCHER_N * 2) {
      for (let x = 0; x < matrixWidth; x++) {
        // Block 1
        let k1 = 0;
        if (posIdx < posCount) k1 = positions[posIdx];
        if (k1 > 0) {
          const extra = extraValues[posIdx];
          const codeword = codewords[posIdx];
          const decoded = fischerDecode(codeword, k1, diffTable);
          const sf = levelScaleFactor(extra);
          for (let j = 0; j < FISCHER_N; j++) {
            const placeY = y + j * 2;
            if (placeY < matrixHeight) {
              result[x * matrixHeight + placeY] = decoded[j] * (scaleFac / sf);
            }
          }
        }
        posIdx++;
        
        // Block 2
        let k2 = 0;
        if (posIdx < posCount) k2 = positions[posIdx];
        if (k2 > 0) {
          const extra = extraValues[posIdx];
          const codeword = codewords[posIdx];
          const decoded = fischerDecode(codeword, k2, diffTable);
          const sf = levelScaleFactor(extra);
          for (let j = 0; j < FISCHER_N; j++) {
            const placeY = y + 1 + j * 2;
            if (placeY < matrixHeight) {
              result[x * matrixHeight + placeY] = decoded[j] * (scaleFac / sf);
            }
          }
        }
        posIdx++;
      }
    }
  } else {
    // Horizontal: orient=0
    // Outer loop: x steps by FISCHER_N * 2 (which is 10)
    // Inner loop: y steps by 1
    // Places two interleaved blocks per inner loop
    for (let x = 0; x < matrixWidth; x += FISCHER_N * 2) {
      for (let y = 0; y < matrixHeight; y++) {
        // Block 1
        let k1 = 0;
        if (posIdx < posCount) k1 = positions[posIdx];
        if (k1 > 0) {
          const extra = extraValues[posIdx];
          const codeword = codewords[posIdx];
          const decoded = fischerDecode(codeword, k1, diffTable);
          const sf = levelScaleFactor(extra);
          for (let j = 0; j < FISCHER_N; j++) {
            const placeX = x + j * 2;
            if (placeX < matrixWidth) {
              result[placeX * matrixHeight + y] = decoded[j] * (scaleFac / sf);
            }
          }
        }
        posIdx++;
        
        // Block 2
        let k2 = 0;
        if (posIdx < posCount) k2 = positions[posIdx];
        if (k2 > 0) {
          const extra = extraValues[posIdx];
          const codeword = codewords[posIdx];
          const decoded = fischerDecode(codeword, k2, diffTable);
          const sf = levelScaleFactor(extra);
          for (let j = 0; j < FISCHER_N; j++) {
            const placeX = x + 1 + j * 2;
            if (placeX < matrixWidth) {
              result[placeX * matrixHeight + y] = decoded[j] * (scaleFac / sf);
            }
          }
        }
        posIdx++;
      }
    }
  }

  return { data: result, width: matrixWidth, height: matrixHeight };
}
