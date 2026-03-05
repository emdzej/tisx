/**
 * placeSparseCoeffs — faithful port of FUN_004b6ba0
 *
 * Params (port-adapted):
 * - dest: destination Float32Array (column-major: data[x * H + y])
 * - destW, destH: destination matrix width & height
 * - src: source Float32Array (float table data)
 * - srcCount: number of source entries to copy
 * - srcStride: stride between consecutive source entries (in items)
 * - startX, startY: starting coordinates in destination
 * - stepX, stepY: step increments for each placement
 */
export function placeSparseCoeffs(
  dest: Float32Array,
  destW: number,
  destH: number,
  src: Float32Array,
  srcCount: number,
  srcStride: number,
  startX: number,
  startY: number,
  stepX: number,
  stepY: number,
) {
  let sx = startX | 0;
  let sy = startY | 0;
  let srcIdx = 0;

  // Bounds check: if starting position already out of bounds, nothing copied
  if (sx >= destW || sy >= destH) return;

  for (let i = 0; i < srcCount; i++) {
    if (sx < destW && sy < destH && sx >= 0 && sy >= 0) {
      const destIdx = sx * destH + sy;
      dest[destIdx] = src[srcIdx];
      // advance destination pointer by column-major stride: stepX * destH + stepY
    }
    srcIdx += srcStride;
    sx += stepX;
    sy += stepY;
  }
}
