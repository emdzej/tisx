import * as fs from 'fs';
import * as zlib from 'zlib';
import { PNG } from 'pngjs';

// REPRODUKCJA WCZORAJSZEGO KODU - ręcznie

function idwt53_1d(low: Float32Array, high: Float32Array): Float32Array {
    const N = low.length;
    const out = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { out[i * 2] = low[i]; out[i * 2 + 1] = high[i]; }
    for (let i = 0; i < N; i++) {
        const d_left = i > 0 ? out[i * 2 - 1] : out[1];
        out[i * 2] -= 0.25 * (d_left + out[i * 2 + 1]);
    }
    for (let i = 0; i < N; i++) {
        const s_right = i < N - 1 ? out[i * 2 + 2] : out[(N - 1) * 2];
        out[i * 2 + 1] += 0.5 * (out[i * 2] + s_right);
    }
    return out;
}

function idwt2d(ll: Float32Array, lh: Float32Array, hl: Float32Array, hh: Float32Array, w: number, h: number): Float32Array {
    const outW = w * 2; const outH = h * 2;
    const temp = new Float32Array(outW * outH); const out = new Float32Array(outW * outH);
    for (let x = 0; x < w; x++) {
        const lowCol = new Float32Array(h); const highCol = new Float32Array(h);
        for (let y = 0; y < h; y++) { lowCol[y] = ll[x * h + y]; highCol[y] = lh[x * h + y]; }
        const col = idwt53_1d(lowCol, highCol);
        for (let y = 0; y < outH; y++) temp[x * outH + y] = col[y];
        for (let y = 0; y < h; y++) { lowCol[y] = hl[x * h + y]; highCol[y] = hh[x * h + y]; }
        const col2 = idwt53_1d(lowCol, highCol);
        for (let y = 0; y < outH; y++) temp[(x + w) * outH + y] = col2[y];
    }
    for (let y = 0; y < outH; y++) {
        const lowRow = new Float32Array(w); const highRow = new Float32Array(w);
        for (let x = 0; x < w; x++) { lowRow[x] = temp[x * outH + y]; highRow[x] = temp[(x + w) * outH + y]; }
        const row = idwt53_1d(lowRow, highRow);
        for (let x = 0; x < outW; x++) out[x * outH + y] = row[x];
    }
    return out;
}

function extractBlocks(data: Buffer): Buffer[] {
    const blocks: Buffer[] = [];
    let offset = 95; 
    while (offset < data.length) {
        if (data[offset] !== 0x78) break;
        let nextPos = offset + 2;
        while (nextPos < data.length) {
            if (data[nextPos] === 0x78 && (data[nextPos+1] === 0x01 || data[nextPos+1] === 0x9c || data[nextPos+1] === 0xda)) {
                try { zlib.inflateSync(data.subarray(offset, nextPos)); break; } catch(e) {}
            }
            nextPos++;
        }
        try { blocks.push(zlib.inflateSync(data.subarray(offset, nextPos === data.length ? undefined : nextPos))); offset = nextPos;
        } catch(e) { break; }
    }
    return blocks;
}

const fileData = fs.readFileSync('/Users/emdzej/Documents/tis/GRAFIK/1/03/95/26.ITW');
// Header: offset 6 = width (0x013c = 316), offset 8 = height (0x00ee = 238)
const width = fileData.readUInt16BE(6);
const height = fileData.readUInt16BE(8);
console.log(`Dimensions: ${width}x${height}`);

const blocks = extractBlocks(fileData);
console.log(`Extracted ${blocks.length} blocks`);

let W = Math.ceil(width / 16);
let H = Math.ceil(height / 16);
const size = W * H;

let sum16 = 0, sum17 = 0;
for (let i = 0; i < size; i++) { sum16 += blocks[16][i]; sum17 += blocks[17][i]; }
const mean16 = sum16 / size; const mean17 = sum17 / size;

const LL4 = new Float32Array(size);
const LH4 = new Float32Array(size);
const HL4 = new Float32Array(size);
const HH4 = new Float32Array(size);

for (let i = 0; i < size; i++) {
    LL4[i] = blocks[18][i];
    LH4[i] = blocks[17][i] - mean17;
    HL4[i] = blocks[16][i] - mean16;
    HH4[i] = 0;
}

let current = idwt2d(LL4, LH4, HL4, HH4, W, H);
W *= 2; H *= 2;

for (let level = 0; level < 3; level++) {
    const zeros = new Float32Array(W * H);
    current = idwt2d(current, zeros, zeros, zeros, W, H);
    W *= 2; H *= 2;
}

let min = Infinity, max = -Infinity;
for (let i = 0; i < current.length; i++) {
    if (current[i] < min) min = current[i];
    if (current[i] > max) max = current[i];
}
const scale = 255 / (max - min);

const png = new PNG({ width, height, colorType: 0 });
for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const v = Math.round((current[x * H + y] - min) * scale);
        const idx = (y * width + x) * 4;
        png.data[idx] = v;
        png.data[idx+1] = v;
        png.data[idx+2] = v;
        png.data[idx+3] = 255;
    }
}

png.pack().pipe(fs.createWriteStream('/Users/emdzej/Documents/itw/ITW_REPO_VERIFIED.png'));
console.log("Wrote ITW_REPO_VERIFIED.png");
