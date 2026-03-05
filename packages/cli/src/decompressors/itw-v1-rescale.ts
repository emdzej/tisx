/**
 * ITW V1 LL band rescaling.
 *
 * From itw_decode_main (Ghidra):
 *   fVar3 = rangeMax - rangeMin
 *   local_44 = (fVar3 + rangeMin) * 0.5     // midpoint
 *   local_10 = (rangeMin - fVar3) * 0.5 / 127.0   // scale factor
 *   output[i] = (byte[i] - 127.0) * local_10 + local_44
 *
 * This maps raw LL bytes to the float range needed for wavelet reconstruction.
 * The reconstruction then produces output in [rangeMin..rangeMax] range
 * (before final clamp to display range).
 */

/**
 * Rescale raw LL bytes to float values for wavelet reconstruction.
 */
export function rescaleLL(
  rawBytes: Uint8Array | Buffer,
  size: number,
  rangeMin: number,
  rangeMax: number,
): Float32Array {
  const fVar3 = rangeMax - rangeMin;
  const midpoint = (fVar3 + rangeMin) * 0.5;
  const scaleFactor = (rangeMin - fVar3) * 0.5 / 127.0;

  const out = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    out[i] = (rawBytes[i] - 127.0) * scaleFactor + midpoint;
  }
  return out;
}

/**
 * Map reconstructed float values back to 0-255 display range.
 * Inverse of the LL rescaling: clamp to [rangeMin, rangeMax], then normalize.
 */
export function toDisplayRange(
  data: Float32Array,
  size: number,
  rangeMin: number,
  rangeMax: number,
): Uint8Array {
  const range = rangeMax - rangeMin;
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    const normalized = (data[i] - rangeMin) / range;
    out[i] = Math.round(Math.max(0, Math.min(255, normalized * 255)));
  }
  return out;
}
