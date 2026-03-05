/**
 * ITW V1 ZLIB block extraction.
 *
 * The data stream contains concatenated zlib-compressed blocks
 * starting at zlibOffset (from frame header).
 * Each block starts with 0x78 (zlib magic).
 */

import * as zlib from 'zlib';

/**
 * Extract consecutive zlib blocks from the buffer starting at `offset`.
 * Uses boundary scanning (look for next 0x78 zlib header) with
 * inflate validation.
 */
export function extractZlibBlocks(data: Buffer, offset: number): Buffer[] {
  const blocks: Buffer[] = [];
  let pos = offset;

  while (pos < data.length) {
    if (data[pos] !== 0x78) break;

    // Find next zlib header
    let next = pos + 2;
    while (next < data.length) {
      if (
        data[next] === 0x78 &&
        (data[next + 1] === 0x01 || data[next + 1] === 0x9c || data[next + 1] === 0xda)
      ) {
        try {
          zlib.inflateSync(data.subarray(pos, next));
          break;
        } catch {
          // not a valid boundary, continue
        }
      }
      next++;
    }

    try {
      const inflated = zlib.inflateSync(
        data.subarray(pos, next >= data.length ? undefined : next),
      );
      blocks.push(inflated);
      pos = next;
    } catch {
      break;
    }
  }

  return blocks;
}
