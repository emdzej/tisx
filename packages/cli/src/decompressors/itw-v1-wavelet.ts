/**
 * ITW V1 polyphase wavelet reconstruction.
 *
 * Faithful port of Ghidra-decompiled functions:
 * - wavelet_reconstruct_level (vertical + horizontal 2-pass)
 * - polyphase_convolve / FUN_004bcdc0 (upsampled convolution)
 * - edge_extend_sample (symmetric reflection)
 *
 * Filter assignment (from itw_decode_main / wavelet_init_filters):
 * - puVar6 = HIGH_5TAP * sqrt(2), halfLen=2, offset=0  → synthesis low
 * - puVar7 = deriveMirror(LOW_7TAP) * sqrt(2), halfLen=3, offset=-1 → synthesis high
 */

const SQRT2 = Math.sqrt(2.0);

// Raw filter coefficients from wavelet_init_filters (type 1 = CDF 5/3)
const LOW_7TAP_RAW = [-0.010714, -0.053571, 0.260714, 0.607143, 0.260714, -0.053571, -0.010714];
const HIGH_5TAP_RAW = [-0.050000, 0.250000, 0.600000, 0.250000, -0.050000];

/**
 * Derive mirror filter (filter_derive_mirror from Ghidra).
 * Alternates sign from center outward.
 */
function deriveMirror(coeffs: number[]): number[] {
  const center = Math.floor(coeffs.length / 2);
  const result = new Array(coeffs.length);
  let s = 1;
  for (let i = center; i >= 0; i--) { result[i] = coeffs[i] * s; s = -s; }
  s = 1;
  for (let i = center + 1; i < coeffs.length; i++) { result[i] = coeffs[i] * s; s = -s; }
  return result;
}

// Synthesis filters (scaled by sqrt(2) as in filter_scale)
const SYN_LOW = HIGH_5TAP_RAW.map(v => v * SQRT2);   // 5-tap, halfLen=2, offset=0
const SYN_HIGH = deriveMirror(LOW_7TAP_RAW).map(v => v * SQRT2); // 7-tap, halfLen=3, offset=-1

/**
 * 1D polyphase reconstruction: upsample + convolve with two filters.
 *
 * Matches wavelet_filter_apply (overwrite) + wavelet_filter_add (accumulate)
 * from wavelet_reconstruct_level.
 *
 * @param low - Low subband samples
 * @param lowLen - Number of low samples
 * @param high - High subband samples
 * @param highLen - Number of high samples
 * @param outLen - Output length (= lowLen + highLen or close)
 * @param dimParity - (outLen & 1): 0=even, 1=odd dimension
 */
export function polyphaseReconstruct1D(
  low: Float32Array, lowLen: number,
  high: Float32Array, highLen: number,
  outLen: number,
  dimParity: number,
): Float32Array {
  const out = new Float32Array(outLen);

  // From wavelet_reconstruct_level:
  // if (outDim & 1) == 0: parity=2, parity2=1
  // if (outDim & 1) == 1: parity=1, parity2=2
  const parity  = dimParity === 0 ? 2 : 1;
  const parity2 = dimParity === 0 ? 1 : 2;

  // Pass 1: SYN_LOW on LOW subband (halfLen=2, offset=0)
  // edge_extension_setup: upPhase=1 → start=0
  const lowEnd = parity === 1 ? 2 * lowLen - 2 : 2 * lowLen - 1;
  for (let i = 0; i < outLen; i++) {
    let sum = 0;
    for (let t = -2; t <= 2; t++) {
      const u = i + 0 + t; // offset = 0
      if ((u & 1) === 0) {
        let idx = u >> 1;
        if (idx < 0 || idx >= lowLen) {
          idx = (idx < 0 ? 0 : lowEnd) - idx;
          idx = Math.max(0, Math.min(lowLen - 1, idx));
        }
        sum += low[idx] * SYN_LOW[2 - t]; // halfLen - tap
      }
    }
    out[i] = sum;
  }

  // Pass 2: SYN_HIGH on HIGH subband (halfLen=3, offset=-1)
  // edge_extension_setup: upPhase=2 → start=-1
  const highEnd = parity2 === 1 ? 2 * highLen - 2 : 2 * highLen - 1;
  for (let i = 0; i < outLen; i++) {
    let sum = 0;
    for (let t = -3; t <= 3; t++) {
      const u = i + (-1) + t; // offset = -1
      if ((u & 1) === 0) {
        let idx = u >> 1;
        if (idx < 0 || idx >= highLen) {
          idx = (idx < 0 ? -1 : highEnd) - idx;
          idx = Math.max(0, Math.min(highLen - 1, idx));
        }
        sum += high[idx] * SYN_HIGH[3 - t]; // halfLen - tap
      }
    }
    out[i] += sum; // ADD (not overwrite)
  }

  return out;
}

/** Split dimension into [ceil, floor] halves */
export function splitEvenOdd(n: number): [number, number] {
  return n % 2 === 0 ? [n / 2, n / 2] : [Math.ceil(n / 2), Math.floor(n / 2)];
}

/**
 * Reconstruct one wavelet level from 4 subbands (LL, LH, HL, HH).
 * Column-major storage: data[x * H + y].
 *
 * Vertical pass (along Y for each X):
 *   temp1[x] = polyphase(LL_col, LH_col)  → LL+LH combined
 *   temp2[x] = polyphase(HL_col, HH_col)  → HL+HH combined
 *
 * Horizontal pass (along X for each Y):
 *   out[y] = polyphase(temp1_row, temp2_row) → final
 */
export function reconstructLevel(
  ll: Float32Array, lh: Float32Array, hl: Float32Array, hh: Float32Array,
  llW: number, llH: number,
  lhW: number, lhH: number,
  hlW: number, hlH: number,
  hhW: number, hhH: number,
  outW: number, outH: number,
): Float32Array {
  const hP = outH & 1;
  const wP = outW & 1;

  // Vertical pass: combine LL+LH and HL+HH along Y
  const temp1 = new Float32Array(llW * outH);
  const temp2 = new Float32Array(hlW * outH);

  for (let x = 0; x < llW; x++) {
    const lCol = new Float32Array(llH);
    const hCol = new Float32Array(lhH);
    for (let y = 0; y < llH; y++) lCol[y] = ll[x * llH + y];
    for (let y = 0; y < lhH; y++) hCol[y] = (x < lhW ? lh[x * lhH + y] : 0);
    const col = polyphaseReconstruct1D(lCol, llH, hCol, lhH, outH, hP);
    for (let y = 0; y < outH; y++) temp1[x * outH + y] = col[y];
  }

  for (let x = 0; x < hlW; x++) {
    const lCol = new Float32Array(hlH);
    const hCol = new Float32Array(hhH);
    for (let y = 0; y < hlH; y++) lCol[y] = hl[x * hlH + y];
    for (let y = 0; y < hhH; y++) hCol[y] = (x < hhW ? hh[x * hhH + y] : 0);
    const col = polyphaseReconstruct1D(lCol, hlH, hCol, hhH, outH, hP);
    for (let y = 0; y < outH; y++) temp2[x * outH + y] = col[y];
  }

  // Horizontal pass: combine temp1+temp2 along X
  const out = new Float32Array(outW * outH);
  for (let y = 0; y < outH; y++) {
    const lRow = new Float32Array(llW);
    const hRow = new Float32Array(hlW);
    for (let x = 0; x < llW; x++) lRow[x] = temp1[x * outH + y];
    for (let x = 0; x < hlW; x++) hRow[x] = temp2[x * outH + y];
    const row = polyphaseReconstruct1D(lRow, llW, hRow, hlW, outW, wP);
    for (let x = 0; x < outW; x++) out[x * outH + y] = row[x];
  }

  return out;
}
