/**
 * ITW V1 full decode pipeline — uses decodeBand module.
 *
 * Matches the Ghidra itw_decode_main flow:
 * 1. Parse file+frame header
 * 2. For each band 0..10: decodeBand (reads from sequential cursor)
 * 3. read_ll_band (reads raw bytes from sequential cursor)
 * 4. LL rescaling
 * 5. wavelet_reconstruct_all (L4→L3→L2→L1)
 */
import * as fs from 'fs';
import * as zlib from 'zlib';
import { PNG } from 'pngjs';
import { parseFileHeader, parseFrameHeader } from './src/decompressors/itw-v1-header.js';
import { reconstructLevel, splitEvenOdd } from './src/decompressors/itw-v1-wavelet.js';
import { buildDiffTable } from './src/decompressors/itw-v1-fischer.js';
import { decodeBand } from './src/decompressors/itw-v1-band.js';

const ITW_PATH = '/Users/emdzej/Documents/tis/GRAFIK/1/03/95/26.ITW';
const OUT_PATH = '/Users/emdzej/Documents/itw/ITW_V1_FULL.png';

const buf = fs.readFileSync(ITW_PATH);
const fileHdr = parseFileHeader(buf);
const frameHdr = parseFrameHeader(buf, fileHdr.dataOffset);
const W = fileHdr.width, H = fileHdr.height;

console.log(`${W}x${H}, levels=${frameHdr.numLevels}, range=${frameHdr.rangeMin}-${frameHdr.rangeMax}`);
console.log(`Bands: ${frameHdr.bandPresence.map(b => b ? '1' : '0').join('')}`);

// Build pyramid dimensions
const dims = [{ w: W, h: H }];
for (let i = 0; i < frameHdr.numLevels; i++) {
  const [lw] = splitEvenOdd(dims[i].w);
  const [lh] = splitEvenOdd(dims[i].h);
  dims.push({ w: lw, h: lh });
}
console.log('Pyramid:', dims.map(d => `${d.w}x${d.h}`).join(' → '));

// Quantization table from Ghidra (local_3c)
const QUANT = [8, 8, 4, 4, 4, 2, 2, 2, 1, 1, 1];

// Band → level/subband mapping
interface BandInfo {
  level: number;
  subband: string;
  width: number;
  height: number;
}

// Correct DWT subband dimensions:
// LH: low-pass horizontal (width=LL.w), high-pass vertical (height=outH-LL.h)
// HL: high-pass horizontal (width=outW-LL.w), low-pass vertical (height=LL.h)
// HH: high-pass both (width=outW-LL.w, height=outH-LL.h)
const bandInfos: BandInfo[] = [
  { level: 1, subband: 'LH', width: dims[1].w, height: splitEvenOdd(H)[1] },        // LL.w x (outH-LL.h)
  { level: 1, subband: 'HL', width: splitEvenOdd(W)[1], height: dims[1].h },        // (outW-LL.w) x LL.h
  { level: 2, subband: 'LH', width: dims[2].w, height: splitEvenOdd(dims[1].h)[1] },
  { level: 2, subband: 'HL', width: splitEvenOdd(dims[1].w)[1], height: dims[2].h },
  { level: 2, subband: 'HH', width: splitEvenOdd(dims[1].w)[1], height: splitEvenOdd(dims[1].h)[1] },
  { level: 3, subband: 'LH', width: dims[3].w, height: splitEvenOdd(dims[2].h)[1] },
  { level: 3, subband: 'HL', width: splitEvenOdd(dims[2].w)[1], height: dims[3].h },
  { level: 3, subband: 'HH', width: splitEvenOdd(dims[2].w)[1], height: splitEvenOdd(dims[2].h)[1] },
  { level: 4, subband: 'LH', width: dims[4].w, height: splitEvenOdd(dims[3].h)[1] },
  { level: 4, subband: 'HL', width: splitEvenOdd(dims[3].w)[1], height: dims[4].h },
  { level: 4, subband: 'HH', width: splitEvenOdd(dims[3].w)[1], height: splitEvenOdd(dims[3].h)[1] },
];

// Build diff table for Fischer decoder
const diffTable = buildDiffTable();

// Debug: print band params from header
for (let band = 0; band < 11; band++) {
  const bp = frameHdr.bands[band];
  console.log(`  Band ${band} params: value=${bp.value}, scale=${bp.scale.toFixed(6)}, offset=${bp.offset.toFixed(6)}`);
}

// Sequential cursor at zlibOffset
const cursor = { pos: frameHdr.zlibOffset };
console.log(`Starting cursor at zlibOffset=${frameHdr.zlibOffset}`);


// ============================================================
// Decode all 11 bands sequentially
// ============================================================
const bandData: Float32Array[] = [];

for (let band = 0; band < 11; band++) {
  const info = bandInfos[band];
  const quant = QUANT[band];
  const bp = frameHdr.bands[band];
  const present = frameHdr.bandPresence[band];

  const orientation = present ? 1 : 0;

  const prevPos = cursor.pos;
  const decoded = decodeBand(
    buf, cursor,
    info.width, info.height,
    quant,
    bp.value, bp.scale, orientation, bp.offset,
    diffTable,
  );
  bandData.push(decoded.data);

  // Debug: stats
  let nonZero = 0;
  let bMin = Infinity, bMax = -Infinity;
  for (const v of decoded.data) {
    if (v !== 0) nonZero++;
    if (v < bMin) bMin = v;
    if (v > bMax) bMax = v;
  }
  console.log(`Band ${band.toString().padStart(2)} (L${info.level} ${info.subband}): quant=${quant}, ${info.width}x${info.height}, orient=${orientation}, consumed=${cursor.pos - prevPos}B, nonzero=${nonZero}/${decoded.data.length}, range=${bMin.toFixed(4)}..${bMax.toFixed(4)}`);
}

// ============================================================
// Read LL band (last compressed block = raw bytes)
// ============================================================
// LL is stored as RAW bytes (not size-prefixed zlib). Read llW*llH bytes.
console.log(`Reading LL raw at cursor=${cursor.pos}`);
const llW = dims[4].w, llH = dims[4].h, llSize = llW * llH;
const llBlock = buf.subarray(cursor.pos, cursor.pos + llSize);
cursor.pos += llSize;
console.log(`LL4: ${llW}x${llH}, ${llBlock.length} bytes (raw)`);


// LL rescaling (from Ghidra itw_decode_main)
const fVar3 = frameHdr.rangeMax - frameHdr.rangeMin;
const midpoint = (fVar3 + frameHdr.rangeMin) * 0.5;
const scaleFactor = (frameHdr.rangeMin - fVar3) * 0.5 / 127.0;

const LL4 = new Float32Array(llSize);
for (let i = 0; i < llSize; i++) {
  LL4[i] = (llBlock[i] - 127.0) * scaleFactor + midpoint;
}
console.log(`LL4 rescaled: ${Math.min(...LL4).toFixed(1)}..${Math.max(...LL4).toFixed(1)}`);
console.log(`Stream cursor: ${cursor.pos} / ${buf.length} (${buf.length - cursor.pos} remaining)`);

// ============================================================
// Reconstruct: L4 → L3 → L2 → L1 → L0
// ============================================================
let curW = llW, curH = llH;

// L4 reconstruction
let current = reconstructLevel(
  LL4,
  bandData[8], bandData[9], bandData[10],
  llW, llH,
  bandInfos[8].width, bandInfos[8].height,
  bandInfos[9].width, bandInfos[9].height,
  bandInfos[10].width, bandInfos[10].height,
  dims[3].w, dims[3].h,
);
curW = dims[3].w; curH = dims[3].h;
console.log(`After L4: ${curW}x${curH}`);

// L3 reconstruction
current = reconstructLevel(
  current,
  bandData[5], bandData[6], bandData[7],
  curW, curH,
  bandInfos[5].width, bandInfos[5].height,
  bandInfos[6].width, bandInfos[6].height,
  bandInfos[7].width, bandInfos[7].height,
  dims[2].w, dims[2].h,
);
curW = dims[2].w; curH = dims[2].h;
console.log(`After L3: ${curW}x${curH}`);

// L2 reconstruction
current = reconstructLevel(
  current,
  bandData[2], bandData[3], bandData[4],
  curW, curH,
  bandInfos[2].width, bandInfos[2].height,
  bandInfos[3].width, bandInfos[3].height,
  bandInfos[4].width, bandInfos[4].height,
  dims[1].w, dims[1].h,
);
curW = dims[1].w; curH = dims[1].h;
console.log(`After L2: ${curW}x${curH}`);

// L1 reconstruction (L0 HH is zeroed per itw_decode_main)
const hhW = splitEvenOdd(W)[1], hhH = splitEvenOdd(H)[1];
current = reconstructLevel(
  current,
  bandData[0], bandData[1],
  new Float32Array(hhW * hhH), // L0 HH — zeroed
  curW, curH,
  bandInfos[0].width, bandInfos[0].height,
  bandInfos[1].width, bandInfos[1].height,
  hhW, hhH,
  dims[0].w, dims[0].h,
);
curW = dims[0].w; curH = dims[0].h;
console.log(`After L1: ${curW}x${curH}`);

// ============================================================
// Output to PNG
// ============================================================
let min = Infinity, max = -Infinity;
for (const v of current) { if (v < min) min = v; if (v > max) max = v; }
console.log(`Output range: ${min.toFixed(1)}..${max.toFixed(1)}`);

const scale = 255 / (max - min);
const png = new PNG({ width: W, height: H, colorType: 0 });
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const v = Math.round(Math.max(0, Math.min(255, (current[x * curH + y] - min) * scale)));
    const idx = (y * W + x) * 4;
    png.data[idx] = v; png.data[idx + 1] = v; png.data[idx + 2] = v; png.data[idx + 3] = 255;
  }
}
png.pack().pipe(fs.createWriteStream(OUT_PATH));
console.log(`Wrote ${OUT_PATH}`);
