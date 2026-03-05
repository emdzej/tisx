import * as zlib from 'zlib';

/**
 * ITW V1 compressed-block extraction.
 * The stream after the frame header is a sequence of blocks:
 *   [compSize: uint16BE][compData: compSize bytes]
 * Each block decompresses (zlib) to a band payload.
 *
 * This function reads consecutive size-prefixed compressed blocks starting
 * at `offset` until `offset` reaches the end of buffer or a compSize of 0.
 */
export function extractSizePrefixedZlibBlocks(data: Buffer, offset: number): Buffer[] {
  const blocks: Buffer[] = [];
  let pos = offset;
  while (pos + 2 <= data.length) {
    const compSize = data.readUInt16BE(pos);
    pos += 2;
    if (compSize === 0) break;
    if (pos + compSize > data.length) {
      // malformed or truncated - stop
      break;
    }
    const comp = data.subarray(pos, pos + compSize);
    try {
      const dec = zlib.inflateSync(comp);
      blocks.push(dec);
    } catch (e) {
      // decompression error - stop
      break;
    }
    pos += compSize;
  }
  return blocks;
}
