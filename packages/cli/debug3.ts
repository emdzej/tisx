import * as fs from 'fs';
import { parseFileHeader, parseFrameHeader } from './src/decompressors/itw-v1-header.js';
import { reconstructLevel, splitEvenOdd } from './src/decompressors/itw-v1-wavelet.js';
import { buildDiffTable } from './src/decompressors/itw-v1-fischer.js';
import { decodeBand } from './src/decompressors/itw-v1-band.js';

const buf = fs.readFileSync('/Users/emdzej/Documents/tis/GRAFIK/1/03/95/26.ITW');
const fileHdr = parseFileHeader(buf);
const frameHdr = parseFrameHeader(buf, fileHdr.dataOffset);
const W = fileHdr.width, H = fileHdr.height;

const dims = [{ w: W, h: H }];
for (let i = 0; i < 4; i++) dims.push({ w: splitEvenOdd(dims[i].w)[0], h: splitEvenOdd(dims[i].h)[0] });

const QUANT = [8, 8, 4, 4, 4, 2, 2, 2, 1, 1, 1];
const bandInfos = [
  { width: splitEvenOdd(W)[1], height: dims[1].h },
  { width: dims[1].w, height: splitEvenOdd(H)[1] },
  { width: splitEvenOdd(dims[1].w)[1], height: dims[2].h },
  { width: dims[2].w, height: splitEvenOdd(dims[1].h)[1] },
  { width: splitEvenOdd(dims[1].w)[1], height: splitEvenOdd(dims[1].h)[1] },
  { width: splitEvenOdd(dims[2].w)[1], height: dims[3].h },
  { width: dims[3].w, height: splitEvenOdd(dims[2].h)[1] },
  { width: splitEvenOdd(dims[2].w)[1], height: splitEvenOdd(dims[2].h)[1] },
  { width: splitEvenOdd(dims[3].w)[1], height: dims[4].h },
  { width: dims[4].w, height: splitEvenOdd(dims[3].h)[1] },
  { width: splitEvenOdd(dims[3].w)[1], height: splitEvenOdd(dims[3].h)[1] },
];

const diffTable = buildDiffTable();
const cursor = { pos: frameHdr.zlibOffset };
const bandData: Float32Array[] = [];
for (let band = 0; band < 11; band++) {
  const info = bandInfos[band];
  const bp = frameHdr.bands[band];
  const decoded = decodeBand(buf, cursor, info.width, info.height, QUANT[band],
    bp.value, bp.scale, frameHdr.bandPresence[band] ? 1 : 0, bp.offset, diffTable);
  bandData.push(decoded.data);
}

// LL
const llW = dims[4].w, llH = dims[4].h, llSize = llW * llH;
const llBlock = buf.subarray(cursor.pos, cursor.pos + llSize);
const fVar3 = frameHdr.rangeMax - frameHdr.rangeMin;
const midpoint = (fVar3 + frameHdr.rangeMin) * 0.5;
const scaleFactor = (frameHdr.rangeMin - fVar3) * 0.5 / 127.0;
const LL4 = new Float32Array(llSize);
for (let i = 0; i < llSize; i++) LL4[i] = (llBlock[i] - 127.0) * scaleFactor + midpoint;

console.log('LL4:', llW, 'x', llH, 'NaN:', [...LL4].filter(v => isNaN(v)).length);

// L4 recon
let current = reconstructLevel(LL4, bandData[8], bandData[9], bandData[10],
  llW, llH, bandInfos[8].width, bandInfos[8].height, bandInfos[9].width, bandInfos[9].height,
  bandInfos[10].width, bandInfos[10].height, dims[3].w, dims[3].h);
let curW = dims[3].w, curH = dims[3].h;
console.log('After L4:', curW, 'x', curH, 'NaN:', [...current].filter(v => isNaN(v)).length);

// L3
current = reconstructLevel(current, bandData[5], bandData[6], bandData[7],
  curW, curH, bandInfos[5].width, bandInfos[5].height, bandInfos[6].width, bandInfos[6].height,
  bandInfos[7].width, bandInfos[7].height, dims[2].w, dims[2].h);
curW = dims[2].w; curH = dims[2].h;
console.log('After L3:', curW, 'x', curH, 'NaN:', [...current].filter(v => isNaN(v)).length);

// L2
current = reconstructLevel(current, bandData[2], bandData[3], bandData[4],
  curW, curH, bandInfos[2].width, bandInfos[2].height, bandInfos[3].width, bandInfos[3].height,
  bandInfos[4].width, bandInfos[4].height, dims[1].w, dims[1].h);
curW = dims[1].w; curH = dims[1].h;
console.log('After L2:', curW, 'x', curH, 'NaN:', [...current].filter(v => isNaN(v)).length);

// L1
const hhW = splitEvenOdd(W)[1], hhH = splitEvenOdd(H)[1];
current = reconstructLevel(current, bandData[0], bandData[1], new Float32Array(hhW * hhH),
  curW, curH, bandInfos[0].width, bandInfos[0].height, bandInfos[1].width, bandInfos[1].height,
  hhW, hhH, dims[0].w, dims[0].h);
curW = dims[0].w; curH = dims[0].h;
console.log('After L1:', curW, 'x', curH, 'NaN:', [...current].filter(v => isNaN(v)).length);

// Find first NaN
for (let i = 0; i < current.length; i++) {
  if (isNaN(current[i])) {
    const x = Math.floor(i / curH), y = i % curH;
    console.log('First NaN at index', i, '(x=' + x + ', y=' + y + ')');
    break;
  }
}
