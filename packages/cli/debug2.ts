import * as fs from 'fs';
import { parseFileHeader, parseFrameHeader } from './src/decompressors/itw-v1-header.js';
import { splitEvenOdd } from './src/decompressors/itw-v1-wavelet.js';
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

// Check band 0 and 1 for NaN
for (let band = 0; band < 2; band++) {
  const info = bandInfos[band];
  const bp = frameHdr.bands[band];
  const decoded = decodeBand(buf, cursor, info.width, info.height, QUANT[band],
    bp.value, bp.scale, 1, bp.offset, diffTable);
  
  let nanCount = 0;
  for (const v of decoded.data) if (isNaN(v)) nanCount++;
  console.log(`Band ${band}: ${info.width}x${info.height}, NaN count: ${nanCount}/${decoded.data.length}`);
  
  // Check last column
  const w = info.width, h = info.height;
  console.log('  Last column (x=' + (w-1) + '):');
  for (let y = 0; y < Math.min(5, h); y++) {
    const idx = (w-1) * h + y;
    console.log('    y=' + y + ':', decoded.data[idx], isNaN(decoded.data[idx]) ? 'NaN!' : '');
  }
}
