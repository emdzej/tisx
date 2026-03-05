import * as fs from 'fs';
import * as zlib from 'zlib';
import { parseFileHeader, parseFrameHeader } from './src/decompressors/itw-v1-header.js';
import { splitEvenOdd } from './src/decompressors/itw-v1-wavelet.js';
import { getRankBitLength, fischerDecode, levelScaleFactor, buildDiffTable, FISCHER_N } from './src/decompressors/itw-v1-fischer.js';

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

const buf = fs.readFileSync('/Users/emdzej/Documents/tis/GRAFIK/1/03/95/26.ITW');
const fileHdr = parseFileHeader(buf);
const frameHdr = parseFrameHeader(buf, fileHdr.dataOffset);
const W = fileHdr.width, H = fileHdr.height;
const dims = [{ w: W, h: H }]; for (let i=0;i<4;i++) dims.push({ w: splitEvenOdd(dims[i].w)[0], h: splitEvenOdd(dims[i].h)[0] });
const QUANT = [8,8,4,4,4,2,2,2,1,1,1];
const bandInfos = [
  { width: dims[1].w, height: splitEvenOdd(H)[1] },
  { width: splitEvenOdd(W)[1], height: dims[1].h },
  { width: dims[2].w, height: splitEvenOdd(dims[1].h)[1] },
  { width: splitEvenOdd(dims[1].w)[1], height: dims[2].h },
  { width: splitEvenOdd(dims[1].w)[1], height: splitEvenOdd(dims[1].h)[1] },
  { width: dims[3].w, height: splitEvenOdd(dims[2].h)[1] },
  { width: splitEvenOdd(dims[2].w)[1], height: dims[3].h },
  { width: splitEvenOdd(dims[2].w)[1], height: splitEvenOdd(dims[2].h)[1] },
  { width: dims[4].w, height: splitEvenOdd(dims[3].h)[1] },
  { width: splitEvenOdd(dims[3].w)[1], height: dims[4].h },
  { width: splitEvenOdd(dims[3].w)[1], height: splitEvenOdd(dims[3].h)[1] },
];

let cursor = { pos: frameHdr.zlibOffset };
for (let b=0;b<5;b++) {
  const quant = QUANT[b];
  if (quant >= 2) {
    const compSizePos = buf.readUInt16BE(cursor.pos);
    cursor.pos += 2 + compSizePos;
    const posStream = zlib.inflateSync(buf.subarray(cursor.pos - compSizePos, cursor.pos));
    let extraBits = 0;
    for (const byte of posStream) if (byte & 0x80) extraBits += 4;
    cursor.pos += Math.ceil(extraBits / 8);
    const compSizeFischer = buf.readUInt16BE(cursor.pos);
    cursor.pos += 2 + compSizeFischer;
  } else {
    const compSize = buf.readUInt16BE(cursor.pos);
    cursor.pos += 2 + compSize;
  }
}

// Band 5
const b = 5;
const info = bandInfos[b];
const quant = QUANT[b];
const bp = frameHdr.bands[b];
const compSizePos = buf.readUInt16BE(cursor.pos);
cursor.pos += 2;
const posStream = zlib.inflateSync(buf.subarray(cursor.pos, cursor.pos + compSizePos));
cursor.pos += compSizePos;

const positions = new Uint8Array(posStream.length);
const extraValues = new Uint8Array(posStream.length);
for (let i = 0; i < posStream.length; i++) {
  positions[i] = posStream[i] & 0x7F;
}

const mainReader = new BitReader(buf.subarray(cursor.pos));
for (let i = 0; i < posStream.length; i++) {
  if (posStream[i] & 0x80) extraValues[i] = mainReader.readBits(4);
}
cursor.pos += mainReader.consumedBytes();

const compSizeFischer = buf.readUInt16BE(cursor.pos);
cursor.pos += 2;
const fischerStream = zlib.inflateSync(buf.subarray(cursor.pos, cursor.pos + compSizeFischer));

const fischerReader = new BitReader(fischerStream);
const codewords = new Uint32Array(posStream.length);
for (let i = 0; i < posStream.length; i++) {
  const bits = getRankBitLength(quant, positions[i]);
  codewords[i] = bits > 0 ? fischerReader.readBits(bits) : 0;
}

// Simulate placement with tracing
const diffTable = buildDiffTable();
const scaleFac = (bp.scale / bp.value) * (bp.offset * 32768.0);

const result = new Float32Array(info.width * info.height);
const matrixWidth = info.width, matrixHeight = info.height, orientation = 0;
const posCount = posStream.length;

const blocksPerRowBase = Math.floor(posCount / matrixHeight);
const extraRows = posCount % matrixHeight;

let posIdx = 0;
let placedCount = 0;

for (let y = 0; y < matrixHeight && posIdx < posCount; y++) {
  const blocksXForRow = blocksPerRowBase + (y < extraRows ? 1 : 0);
  for (let blockX = 0; blockX < blocksXForRow && posIdx < posCount; blockX++) {
    const k = positions[posIdx];
    const extra = extraValues[posIdx];

    if (y === 0 && blockX < 5) {
      console.log(`posIdx=${posIdx}, y=${y}, blockX=${blockX}, k=${k}, extra=${extra}`);
    }

    if (k === 0) {
      posIdx++;
      continue;
    }

    const codeword = codewords[posIdx];
    posIdx++;

    const decoded = fischerDecode(codeword, k, diffTable);
    const sf = levelScaleFactor(extra);
    const baseX = blockX * quant;

    for (let j = 0; j < FISCHER_N && baseX + j < matrixWidth; j++) {
      const val = decoded[j] * (scaleFac / sf);
      result[(baseX + j) * matrixHeight + y] = val;
      if (val !== 0) placedCount++;
    }
  }
}

console.log('\nTotal placed nonzero:', placedCount);
