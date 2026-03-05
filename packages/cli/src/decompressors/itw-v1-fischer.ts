/**
 * ITW V1 Fischer arithmetic decoder — faithful port from Ghidra.
 *
 * Fischer block size: DAT_004ed11c = 5
 *
 * Key functions ported:
 * - fischer_build_diff_table (recurrence: T[i][j] = T[i][j-1] + T[i-1][j] + T[i-1][j-1])
 * - fischer_decode (sequential symbol extraction using diff table lookups)
 * - level_scale_factor: (16.0 - extraBits) * 0.0625
 *
 * The diff table is extended to MAX_POS (201) columns to handle position values
 * up to 200 (7-bit base + 4-bit extra).
 */

export const FISCHER_N = 5;
export const MAX_POS = 201; // rank_table is 9×201 in original

/**
 * Build the diff/probability table.
 * T[0][j] = 1, T[i][0] = 1
 * T[i][j] = T[i][j-1] + T[i-1][j] + T[i-1][j-1]
 *
 * Rows: 0..FISCHER_N-1 (5 rows)
 * Cols: 0..MAX_POS-1 (201 columns)
 */
export function buildDiffTable(): number[][] {
  const T: number[][] = [];
  for (let i = 0; i < FISCHER_N; i++) {
    T[i] = new Array(MAX_POS).fill(0);
    T[i][0] = 1;
  }
  for (let j = 0; j < MAX_POS; j++) T[0][j] = 1;
  for (let i = 1; i < FISCHER_N; i++) {
    for (let j = 1; j < MAX_POS; j++) {
      T[i][j] = T[i][j - 1] + T[i - 1][j] + T[i - 1][j - 1];
    }
  }
  return T;
}

/**
 * Build precomputed bit-length table from diff table.
 * bitLengths[k] = ceil(log2(diffTable[FISCHER_N-1][k]))
 *
 * Used in quant>=2 path: read_bits(bitLengths[position]) for Fischer codewords.
 */
export function buildBitLengthTable(diffTable: number[][]): number[] {
  const row = diffTable[FISCHER_N - 1];
  const bits: number[] = new Array(MAX_POS);
  for (let k = 0; k < MAX_POS; k++) {
    const count = row[k];
    if (count <= 1) {
      bits[k] = 0;
    } else {
      bits[k] = Math.ceil(Math.log2(count));
    }
  }
  return bits;
}

/**
 * Hardcoded rank table from Ghidra's fischer_build_rank_table.
 * 3 rows indexed by quant: [quant=2][201], [quant=4][201], [quant=8][31+padding]
 * Values are BIT LENGTHS for reading Fischer codewords from the bitstream.
 *
 * This is DIFFERENT from ceil(log2(diffTable)) — the original uses a separate
 * precomputed table that gives smaller bit lengths.
 */
const RANK_QUANT2: readonly number[] = [0, 2, 3, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
const RANK_QUANT4: readonly number[] = [0, 0, 3, 5, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 13, 14, 14, 14, 14, 15, 15, 15, 15, 15, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25];
const RANK_QUANT8: readonly number[] = [0, 0, 0, 4, 7, 10, 12, 14, 15, 17, 18, 19, 20, 21, 22, 22, 23, 24, 24, 25, 26, 26, 27, 27, 27, 28, 28, 29, 29, 30, 30];

/**
 * Get bit length from the hardcoded rank table for a given quant and position.
 * This is used in itw_decode_band's quant>=2 path for reading Fischer codewords.
 *
 * In Ghidra: calc_rank_bit_length(rank_table, quant, position, 0)
 * The rank_table is indexed as: row = quant (2, 4, or 8), col = position (0..200)
 */
export function getRankBitLength(quant: number, position: number): number {
  let table: readonly number[];
  switch (quant) {
    case 2: table = RANK_QUANT2; break;
    case 4: table = RANK_QUANT4; break;
    case 8: table = RANK_QUANT8; break;
    default: return 0;
  }
  if (position < 0 || position >= table.length) return 0;
  return table[position];
}

/**
 * calc_bit_length for quant<=1 path.
 * Chain from Ghidra:
 *   FUN_004b6ae0: count = value * 2 + 1
 *   FUN_004b6b10: bits = ceil(log2(count))
 *   calc_bit_length: bytes = ceil(bits * DAT_004ed130)
 * Then itw_decode_band uses: read_bits(bytes << 3) = read whole-byte-aligned bits.
 *
 * Returns the number of BITS to read (bytes << 3).
 */
export function calcBitLengthQuant1(value: number): number {
  const count = value * 2 + 1;
  if (count <= 1) return 0;
  const rawBits = Math.ceil(Math.log2(count));
  const bytes = Math.ceil(rawBits / 8);
  return bytes << 3; // convert back to bits (byte-aligned)
}

/**
 * Diff table lookup — same as calc_rank_bit_length in Ghidra.
 * Just indexes into the table: table[n][k].
 */
function diffLookup(table: number[][], n: number, k: number): number {
  if (n < 0 || n >= FISCHER_N || k < 0 || k >= MAX_POS) return 0;
  return table[n][k];
}

/**
 * Fischer decode — 1:1 port of Ghidra fischer_decode.
 *
 * Decodes FISCHER_N coefficients from (codeword, magnitudeSum) using diff table.
 *
 * @param codeword - The encoded value (param_2 in Ghidra)
 * @param magnitudeSum - Sum of absolute values (param_3 in Ghidra)
 * @param diffTable - The diff/probability table (param_4 in Ghidra)
 * @returns Array of FISCHER_N decoded integer coefficients
 */
export function fischerDecode(
  codeword: number,
  magnitudeSum: number,
  diffTable: number[][],
): Int32Array {
  const N = FISCHER_N;
  const out = new Int32Array(N);

  if (magnitudeSum === 0) {
    return out; // all zeros
  }

  let symbolsLeft = N;
  let code = codeword;
  let remaining = magnitudeSum;
  let outPos = 0;

  for (let pos = 0; pos < N; pos++) {
    if (code === 0 && pos < N) {
      // codeword exhausted — symbol is 0
      out[pos] = 0;
      outPos = pos + 1;
      break;
    }

    // Number of codewords for zero symbol: diff[symbolsLeft-2][remaining]
    const zeroCount = diffLookup(diffTable, symbolsLeft - 2, remaining);

    if (code < zeroCount) {
      out[pos] = 0;
    } else {
      let absVal = 1;
      let accumulated = zeroCount;

      while (true) {
        const subRemaining = remaining - absVal;
        if (subRemaining < 0) break;
        const count = diffLookup(diffTable, symbolsLeft - 2, subRemaining);
        if (code < accumulated + count * 2) break;
        accumulated += count * 2;
        absVal++;
      }

      const subRemaining = remaining - absVal;
      const count = diffLookup(diffTable, symbolsLeft - 2, subRemaining);

      if (code < accumulated + count) {
        out[pos] = absVal;
      } else {
        out[pos] = -absVal;
        accumulated += count;
      }

      code = code - accumulated;
      remaining -= absVal;
    }

    symbolsLeft--;
    outPos = pos + 1;
  }

  // Ghidra: if remaining > 0 after loop, adjust last symbol
  if (remaining > 0 && outPos > 0) {
    const lastIdx = outPos - 1;
    if (out[lastIdx] >= 0) {
      out[lastIdx] = out[lastIdx] + remaining;
    } else {
      out[lastIdx] = out[lastIdx] - remaining;
    }
  }

  return out;
}

/**
 * level_scale_factor from Ghidra:
 * (16.0 - extraBits) * 0.0625 = (16 - extraBits) / 16
 */
export function levelScaleFactor(extraBits: number): number {
  return (16.0 - extraBits) * 0.0625;
}
