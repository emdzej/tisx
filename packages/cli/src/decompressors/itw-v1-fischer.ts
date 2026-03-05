/**
 * ITW V1 Fischer arithmetic decoder — faithful port from Ghidra.
 *
 * Fischer block size: DAT_004ed11c = 5
 * Table dimensions: FISCHER_N × MAX_K (5 × 11)
 *
 * Key functions ported:
 * - fischer_build_diff_table (recurrence: T[i][j] = T[i][j-1] + T[i-1][j] + T[i-1][j-1])
 * - fischer_decode (sequential symbol extraction using rank table lookups)
 * - calc_rank_bit_length (3D table lookup → simplified to 2D for our case)
 * - level_scale_factor: (16.0 - extraBits) * 0.0625
 */

export const FISCHER_N = 5;
export const MAX_K = 2 * FISCHER_N + 1; // 11

/**
 * Build the diff/probability table.
 * T[0][j] = 1, T[i][0] = 1
 * T[i][j] = T[i][j-1] + T[i-1][j] + T[i-1][j-1]
 */
export function buildDiffTable(): number[][] {
  const T: number[][] = [];
  for (let i = 0; i < FISCHER_N; i++) {
    T[i] = new Array(MAX_K).fill(0);
    T[i][0] = 1;
  }
  for (let j = 0; j < MAX_K; j++) T[0][j] = 1;
  for (let i = 1; i < FISCHER_N; i++) {
    for (let j = 1; j < MAX_K; j++) {
      T[i][j] = T[i][j - 1] + T[i - 1][j] + T[i - 1][j - 1];
    }
  }
  return T;
}

/**
 * calc_rank_bit_length equivalent — just a table lookup.
 * In Ghidra: indexes into the rank table as rank[n][k].
 * We use the diff table directly since rank === diff for our use case.
 */
function rankLookup(table: number[][], n: number, k: number): number {
  if (n < 0 || n >= FISCHER_N || k < 0 || k >= MAX_K) return 0;
  return table[n][k];
}

/**
 * Fischer decode — 1:1 port of Ghidra fischer_decode.
 *
 * Decodes FISCHER_N coefficients from (codeword, magnitudeSum) using rank table.
 *
 * @param codeword - The encoded value (param_2 in Ghidra)
 * @param magnitudeSum - Sum of absolute values (param_3 in Ghidra)
 * @param rankTable - The diff/rank table (param_4 in Ghidra)
 * @returns Array of FISCHER_N decoded integer coefficients
 */
export function fischerDecode(
  codeword: number,
  magnitudeSum: number,
  rankTable: number[][],
): Int32Array {
  const N = FISCHER_N;
  const out = new Int32Array(N);

  let symbolsLeft = N; // uVar5 = uVar3 (starts at FISCHER_N)
  let code = codeword; // iVar4 tracks accumulated offset
  let remaining = magnitudeSum; // local_10

  if (magnitudeSum === 0) {
    // All zeros
    return out;
  }

  for (let pos = 0; pos < N; pos++) {
    if (code === 0) {
      // codeword exhausted — symbol is 0, remaining handled at end
      out[pos] = 0;
      break;
    }

    // Number of codewords for zero symbol: rank[symbolsLeft-2][remaining]
    const zeroCount = rankLookup(rankTable, symbolsLeft - 2, remaining);

    if (code < zeroCount) {
      // Symbol is 0
      out[pos] = 0;
    } else {
      // Find absolute value by iterating
      let absVal = 1;
      let accumulated = zeroCount;

      while (true) {
        const subRemaining = remaining - absVal;
        if (subRemaining < 0) break;
        const count = rankLookup(rankTable, symbolsLeft - 2, subRemaining);
        if (code < accumulated + count * 2) break;
        accumulated += count * 2;
        absVal++;
      }

      // Determine sign: first half = positive, second half = negative
      const subRemaining = remaining - absVal;
      const count = rankLookup(rankTable, symbolsLeft - 2, subRemaining);

      if (code < accumulated + count) {
        out[pos] = absVal;
      } else {
        out[pos] = -absVal;
        accumulated += count;
      }

      code = code - accumulated; // advance past consumed codewords
      remaining -= absVal;
    }

    symbolsLeft--;
  }

  // Ghidra: if remaining > 0 after loop, adjust last symbol
  if (remaining > 0) {
    const lastIdx = N - 1;
    const lastAbs = Math.abs(out[lastIdx]);
    if (out[lastIdx] >= 0) {
      out[lastIdx] = lastAbs + remaining;
    } else {
      out[lastIdx] = -(lastAbs + remaining);
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
