import * as zlib from 'zlib';

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

// Fallback extractor: scan for 0x78 zlib headers and attempt inflate
export function extractZlibBlocks(data: Buffer, offset: number): Buffer[] {
  const blocks: Buffer[] = [];
  let pos = offset;
  while (pos < data.length) {
    // find zlib header 0x78
    while (pos < data.length && data[pos] !== 0x78) pos++;
    if (pos >= data.length) break;

    // try to find next valid boundary by scanning and validating inflate
    let next = pos + 2;
    while (next < data.length) {
      if (data[next] === 0x78 && (data[next + 1] === 0x01 || data[next + 1] === 0x9c || data[next + 1] === 0xda)) {
        try {
          zlib.inflateSync(data.subarray(pos, next));
          break;
        } catch (e) {
          // not a valid separation, keep scanning
        }
      }
      next++;
    }

    try {
      const dec = zlib.inflateSync(data.subarray(pos, next >= data.length ? undefined : next));
      blocks.push(dec);
      pos = next;
    } catch (e) {
      // failed to inflate at pos - skip this 0x78 and continue
      pos++;
    }
  }
  return blocks;
}

// Helper that tries size-pref parse first, then fallback to scan if result seems wrong
export function extractBlocksAuto(data: Buffer, offset: number): Buffer[] {
  const a = extractSizePrefixedZlibBlocks(data, offset);
  if (a.length >= 2) return a;
  // fallback
  return extractZlibBlocks(data, offset);
}
