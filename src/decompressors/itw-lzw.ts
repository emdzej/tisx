export interface ItwHeader {
  version: number;
  width: number;
  height: number;
  bpp: number;
  dataOffsetBlocks: number;
  dataOffset: number;
}

export function parseItwHeader(buffer: Buffer): ItwHeader {
  const version = buffer.readUInt8(4);
  const width = buffer.readUInt16BE(6);
  const height = buffer.readUInt16BE(8);
  const bpp = buffer.readUInt16BE(10);
  const dataOffsetBlocks = buffer.readUInt8(12);
  const dataOffset =
    version >= 2 ? buffer.readUInt16BE(12) : dataOffsetBlocks * 256;

  return { version, width, height, bpp, dataOffsetBlocks, dataOffset };
}

export interface ItwBlockTable {
  fileSizeMinus18: number;
  blockCount: number;
  blockEndOffsets: number[];
  blockSizes: number[];
}

export function parseItwBlockTable(
  buffer: Buffer,
  dataOffset: number
): ItwBlockTable | null {
  const tableOffset = 0x10;
  if (buffer.length < tableOffset + 4) return null;

  const fileSizeMinus18 = buffer.readUInt16BE(tableOffset);
  const blockCount = buffer.readUInt16BE(tableOffset + 2);

  if (blockCount <= 0 || blockCount > 0x2000) return null;

  const totalValues = blockCount + 2;
  const requiredBytes = totalValues * 2;
  if (buffer.length < tableOffset + requiredBytes) return null;

  const blockEndOffsets: number[] = [];
  for (let i = 0; i < blockCount; i++) {
    blockEndOffsets.push(buffer.readUInt16BE(tableOffset + 4 + i * 2));
  }

  const blockSizes: number[] = [];
  let prevEnd = 0;
  for (const end of blockEndOffsets) {
    if (end < prevEnd) return null;
    blockSizes.push(end - prevEnd);
    prevEnd = end;
  }

  const maxDataSize = buffer.length - dataOffset;
  if (prevEnd > maxDataSize) {
    return null;
  }

  return { fileSizeMinus18, blockCount, blockEndOffsets, blockSizes };
}

export interface ItwDecompressOptions {
  maxBits?: number;
  hasClearCode?: boolean;
  streamHeader?: boolean;
  maxOutput?: number;
}

export function decompressItwLzw(
  compressed: Buffer | Uint8Array,
  options: ItwDecompressOptions = {}
): Buffer {
  const clearCode = 0x100;

  let maxBits = options.maxBits;
  let hasClearCode = options.hasClearCode;
  let dataStart = 0;

  if (options.streamHeader ?? true) {
    const info = compressed[0];
    dataStart = 1;
    if (maxBits === undefined) maxBits = info & 0x1f;
    if (hasClearCode === undefined) hasClearCode = (info & 0x80) !== 0;
  }

  if (maxBits === undefined) maxBits = 16;
  if (hasClearCode === undefined) hasClearCode = true;

  if (maxBits < 9) maxBits = 9;
  if (maxBits > 16) maxBits = 16;

  const maxDictSize = 1 << maxBits;

  const prefix = new Int32Array(maxDictSize);
  const suffix = new Uint8Array(maxDictSize);
  for (let i = 0; i < 256; i++) {
    prefix[i] = 0;
    suffix[i] = i;
  }

  let dictSize = hasClearCode ? 0x101 : 0x100;
  let bitWidth = 9;
  let maxCode = (1 << bitWidth) - 1;

  let bitBuffer = 0;
  let bitCount = 0;
  let pos = dataStart;
  const data = compressed;
  const out: number[] = [];

  const pushOut = (value: number) => {
    out.push(value);
    if (options.maxOutput !== undefined && out.length > options.maxOutput) {
      throw new Error('LZW output exceeded maximum size');
    }
  };

  const readCode = (): number => {
    while (bitCount < bitWidth) {
      if (pos >= data.length) return -1;
      bitBuffer |= (data[pos++] & 0xff) << bitCount;
      bitCount += 8;
    }
    const code = bitBuffer & ((1 << bitWidth) - 1);
    bitBuffer >>>= bitWidth;
    bitCount -= bitWidth;
    return code;
  };

  const emitCode = (code: number): number => {
    const stack: number[] = [];
    while (code >= 256) {
      stack.push(suffix[code]);
      if (stack.length > maxDictSize) {
        throw new Error('Invalid LZW dictionary loop');
      }
      code = prefix[code];
    }
    stack.push(code);
    const first = code;
    for (let i = stack.length - 1; i >= 0; i--) {
      pushOut(stack[i]);
    }
    return first;
  };

  let code = readCode();
  if (code < 0) return Buffer.alloc(0);
  if (hasClearCode && code === clearCode) {
    bitWidth = 9;
    maxCode = (1 << bitWidth) - 1;
    dictSize = 0x100;
    code = readCode();
    if (code < 0) return Buffer.alloc(0);
  }

  let oldCode = code;
  let firstChar = emitCode(code);

  while (true) {
    if (dictSize > maxCode && bitWidth < maxBits) {
      bitWidth++;
      maxCode = (1 << bitWidth) - 1;
    }

    code = readCode();
    if (code < 0) break;

    if (hasClearCode && code === clearCode) {
      bitWidth = 9;
      maxCode = (1 << bitWidth) - 1;
      dictSize = 0x100;
      code = readCode();
      if (code < 0) break;
      oldCode = code;
      firstChar = emitCode(code);
      continue;
    }

    const inCode = code;
    let currentFirst: number;

    if (code >= dictSize) {
      currentFirst = firstChar;
      const stack: number[] = [];
      let temp = oldCode;
      while (temp >= 256) {
        stack.push(suffix[temp]);
        temp = prefix[temp];
      }
      stack.push(temp);
      for (let i = stack.length - 1; i >= 0; i--) {
        pushOut(stack[i]);
      }
      pushOut(currentFirst);
    } else {
      currentFirst = emitCode(code);
    }

    if (dictSize < maxDictSize) {
      prefix[dictSize] = oldCode;
      suffix[dictSize] = currentFirst;
      dictSize++;
    }

    oldCode = inCode;
    firstChar = currentFirst;
  }

  return Buffer.from(out) as Buffer;
}

function decompressPackBits(input: Buffer | Uint8Array): Buffer {
  const output: number[] = [];
  let pos = 0;

  while (pos < input.length) {
    const n = input[pos++];
    if (n <= 127) {
      const count = n + 1;
      for (let i = 0; i < count && pos < input.length; i++) {
        output.push(input[pos++]);
      }
    } else if (n >= 129) {
      const count = 257 - n;
      if (pos >= input.length) break;
      const value = input[pos++];
      for (let i = 0; i < count; i++) output.push(value);
    } else {
      // n == 128: noop
    }
  }

  return Buffer.from(output) as Buffer;
}

function decompressItwSimpleRleWithStatus(
  input: Buffer | Uint8Array,
  width: number,
  height: number
): { data: Buffer; written: number; completed: boolean } {
  const output = Buffer.alloc(width * height);
  let x = 0;
  let y = 0;
  let pos = 0;
  let written = 0;
  let completed = false;

  const writePixel = (value: number) => {
    if (x >= width) {
      x = 0;
      y += 1;
    }
    if (y >= height) return;
    output[y * width + x] = value;
    x += 1;
    written += 1;
  };

  while (pos + 1 < input.length && !completed) {
    const count = input[pos++];
    const value = input[pos++];
    const runLen = count + 1;

    for (let i = 0; i < runLen; i++) {
      writePixel(value);
      if (y >= height) {
        completed = true;
        break;
      }
    }
  }

  return { data: output as Buffer, written, completed };
}

function decompressItwRle8WithStatus(
  input: Buffer | Uint8Array,
  width: number,
  height: number
): { data: Buffer; written: number; completed: boolean } {
  const output = Buffer.alloc(width * height);
  let x = 0;
  let y = 0;
  let pos = 0;
  let written = 0;
  let completed = false;

  const writePixel = (value: number) => {
    if (x >= width) {
      x = 0;
      y += 1;
    }
    if (y >= height) return;
    output[y * width + x] = value;
    x += 1;
    written += 1;
  };

  while (pos + 1 < input.length && !completed) {
    const count = input[pos++];
    const value = input[pos++];

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        writePixel(value);
        if (y >= height) {
          completed = true;
          break;
        }
      }
      continue;
    }

    if (value === 0x00) {
      x = 0;
      y += 1;
      if (y >= height) completed = true;
    } else if (value === 0x01) {
      completed = true;
      break;
    } else if (value === 0x02) {
      if (pos + 1 >= input.length) break;
      const dx = input[pos++];
      const dy = input[pos++];
      x += dx;
      y += dy;
      if (y >= height) completed = true;
    } else {
      const countAbs = value;
      for (let i = 0; i < countAbs && pos < input.length; i++) {
        writePixel(input[pos++]);
        if (y >= height) {
          completed = true;
          break;
        }
      }
      if (countAbs % 2 === 1) pos += 1;
    }
  }

  return { data: output as Buffer, written, completed };
}

function decompressItwRle8(
  input: Buffer | Uint8Array,
  width: number,
  height: number
): Buffer {
  return decompressItwRle8WithStatus(input, width, height).data as Buffer;
}

function decompressItwBlockAuto(
  block: Buffer,
  options: ItwDecompressOptions,
  maxOutput?: number
): Buffer {
  if (block.length === 0) return Buffer.alloc(0);

  if (
    options.maxBits !== undefined ||
    options.hasClearCode !== undefined ||
    options.streamHeader !== undefined
  ) {
    return decompressItwLzw(block, options);
  }

  const headerByte = block[0];
  const tries: ItwDecompressOptions[] = [];
  const maxBitsCandidates = [12, 11, 10, 9, 16];

  const pushTry = (entry: ItwDecompressOptions) => {
    if (
      !tries.some(
        (t) =>
          t.streamHeader === entry.streamHeader &&
          t.hasClearCode === entry.hasClearCode &&
          t.maxBits === entry.maxBits
      )
    ) {
      tries.push(entry);
    }
  };

  pushTry({ streamHeader: true });

  for (const maxBits of maxBitsCandidates) {
    pushTry({ streamHeader: false, hasClearCode: true, maxBits });
    pushTry({ streamHeader: false, hasClearCode: false, maxBits });
  }

  if (headerByte > 0x7f) {
    for (const maxBits of maxBitsCandidates) {
      pushTry({ streamHeader: true, hasClearCode: false, maxBits });
      pushTry({ streamHeader: true, hasClearCode: true, maxBits });
    }
  }

  let best: Buffer = Buffer.alloc(0) as Buffer;
  for (const attempt of tries) {
    try {
      const attemptOptions =
        maxOutput !== undefined ? { ...attempt, maxOutput } : attempt;
      const result = decompressItwLzw(block, attemptOptions) as Buffer;
      if (result.length > best.length) best = result;
    } catch {
      // Ignore invalid attempts
    }
  }

  return best;
}

function decompressItwV2LzwSimpleRle(
  block: Buffer,
  width: number,
  height: number,
  options: ItwDecompressOptions = {}
): Buffer {
  const expected = width * height;

  if (
    options.maxBits !== undefined ||
    options.hasClearCode !== undefined ||
    options.streamHeader !== undefined
  ) {
    const lzw = decompressItwLzw(block, options);
    return decompressItwSimpleRleWithStatus(lzw, width, height).data;
  }

  const tries: ItwDecompressOptions[] = [];
  const maxBitsCandidates = [12, 11, 10, 9, 16, 15, 14, 13];

  const pushTry = (entry: ItwDecompressOptions) => {
    if (
      !tries.some(
        (t) =>
          t.streamHeader === entry.streamHeader &&
          t.hasClearCode === entry.hasClearCode &&
          t.maxBits === entry.maxBits
      )
    ) {
      tries.push(entry);
    }
  };

  for (const maxBits of maxBitsCandidates) {
    pushTry({ streamHeader: false, hasClearCode: false, maxBits });
    pushTry({ streamHeader: false, hasClearCode: true, maxBits });
  }

  pushTry({ streamHeader: true });
  for (const maxBits of maxBitsCandidates) {
    pushTry({ streamHeader: true, hasClearCode: false, maxBits });
    pushTry({ streamHeader: true, hasClearCode: true, maxBits });
  }

  let best: { data: Buffer; written: number; completed: boolean } | null = null;

  for (const attempt of tries) {
    try {
      const lzw = decompressItwLzw(block, attempt);
      const result = decompressItwSimpleRleWithStatus(lzw, width, height);
      if (result.completed && result.written === expected) {
        return result.data;
      }
      if (!best || result.written > best.written) {
        best = result;
      }
    } catch {
      // ignore
    }
  }

  return best ? best.data : Buffer.alloc(0);
}

export function decompressItwMultiBlock(
  buffer: Buffer,
  options: ItwDecompressOptions = {}
) {
  const header = parseItwHeader(buffer);
  const blockTable =
    header.version >= 2 ? null : parseItwBlockTable(buffer, header.dataOffset);
  if (!blockTable) {
    const compressed = buffer.subarray(header.dataOffset);
    if (header.version >= 2) {
      const data = decompressItwV2LzwSimpleRle(
        compressed,
        header.width,
        header.height,
        options
      );
      return { header, data, blockTable: null };
    }
    const expected = Math.floor(
      header.width * header.height * (header.bpp / 8)
    );
    const data = decompressItwBlockAuto(
      compressed,
      options,
      expected > 0 ? expected : undefined
    );
    if (expected > 0 && data.length !== expected) {
      const rle = decompressPackBits(data) as Buffer;
      if (rle.length === expected || rle.length > data.length) {
        return { header, data: rle, blockTable: null };
      }
    }
    return { header, data, blockTable: null };
  }

  const expected = Math.floor(header.width * header.height * (header.bpp / 8));
  const chunks: Buffer[] = [];
  for (let i = 0; i < blockTable.blockCount; i++) {
    const start =
      header.dataOffset + (i === 0 ? 0 : blockTable.blockEndOffsets[i - 1]);
    const end = header.dataOffset + blockTable.blockEndOffsets[i];
    if (start >= buffer.length) break;
    const compressed = buffer.slice(start, Math.min(end, buffer.length));
    const decompressed = decompressItwBlockAuto(
      compressed,
      options,
      expected > 0 ? expected : undefined
    );
    chunks.push(decompressed);
  }

  let data: Buffer = Buffer.concat(chunks) as Buffer;
  if (expected > 0 && data.length !== expected) {
    const rle = decompressPackBits(data) as Buffer;
    if (rle.length === expected || rle.length > data.length) {
      data = rle;
    }
  }

  return { header, data, blockTable };
}

export function decompressItwFile(
  buffer: Buffer,
  options: ItwDecompressOptions = {}
) {
  const header = parseItwHeader(buffer);
  const blockTable =
    header.version >= 2 ? null : parseItwBlockTable(buffer, header.dataOffset);
  if (blockTable) {
    return decompressItwMultiBlock(buffer, options);
  }

  const compressed = buffer.subarray(header.dataOffset);
  if (header.version >= 2) {
    const data = decompressItwV2LzwSimpleRle(
      compressed,
      header.width,
      header.height,
      options
    );
    return { header, data };
  }
  const expected = Math.floor(header.width * header.height * (header.bpp / 8));
  let data = decompressItwBlockAuto(
    compressed,
    options,
    expected > 0 ? expected : undefined
  );
  if (expected > 0 && data.length !== expected) {
    const rle = decompressPackBits(data) as Buffer;
    if (rle.length === expected || rle.length > data.length) {
      data = rle;
    }
  }
  return { header, data };
}
