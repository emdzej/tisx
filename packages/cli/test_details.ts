import { decodeItwV1 } from './src/decompressors/itw-v1-idwt';
import * as fs from 'fs';
import * as zlib from 'zlib';
import { PNG } from 'pngjs';

const rows = 9;
const cols = 201;

const baseTable: number[][] = new Array(rows).fill(0).map(() => new Array(cols).fill(0));
for (let j = 0; j < cols; j++) baseTable[0][j] = 1;
for (let i = 0; i < rows; i++) baseTable[i][0] = 1;
for (let j = 1; j < cols; j++) baseTable[1][j] = j * 2 + 1;
for (let i = 2; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
        baseTable[i][j] = baseTable[i][j-1] + baseTable[i-1][j] + baseTable[i-1][j-1];
    }
}

function fischerDecode(length: number, encoded_val: number, k: number): number[] {
    const out = new Array(length).fill(0);
    if (k === 0) return out;
    
    let current_val = 0;
    let out_idx = 0;
    let current_k = k;
    let n = length;
    
    while (out_idx < length) {
        if (encoded_val === current_val) break;
        if (current_k <= 0) break;
        if (n <= 0) break;
        
        let t_val = baseTable[n - 1][current_k];
        if (encoded_val < current_val + t_val) {
            out[out_idx] = 0;
        } else {
            t_val = baseTable[n - 1][current_k];
            let v = 1;
            current_val += t_val;
            
            while (true) {
                if (current_k - v < 0) break;
                t_val = baseTable[n - 1][current_k - v];
                if (encoded_val < current_val + t_val * 2) break;
                v++;
                current_val += t_val * 2;
            }
            
            if (current_k - v >= 0) {
                t_val = baseTable[n - 1][current_k - v];
                if (current_val <= encoded_val && encoded_val < current_val + t_val) {
                    out[out_idx] = v;
                } else {
                    if (current_val + t_val <= encoded_val) {
                        out[out_idx] = -v;
                        current_val += t_val;
                    }
                }
            }
        }
        n--;
        const written_val = out[out_idx];
        out_idx++;
        current_k -= Math.abs(written_val);
    }
    
    if (current_k > 0) {
        out[length - 1] += (out[length - 1] >= 0 ? current_k : -current_k);
    }
    return out;
}

class BitReader {
    private buffer: Buffer;
    private pos = 0;
    private bitPos = 0;

    constructor(buffer: Buffer) {
        this.buffer = buffer;
    }

    readBits(count: number): number {
        if (count === 0) return 0;
        let result = 0;
        let bitsRead = 0;

        while (bitsRead < count) {
            if (this.pos >= this.buffer.length) return result;
            const currentByte = this.buffer[this.pos];
            const bitsAvailableInByte = 8 - this.bitPos;
            const bitsToRead = Math.min(count - bitsRead, bitsAvailableInByte);
            
            const shift = 8 - this.bitPos - bitsToRead;
            const mask = (1 << bitsToRead) - 1;
            const chunk = (currentByte >> shift) & mask;

            result = (result << bitsToRead) | chunk;
            bitsRead += bitsToRead;
            this.bitPos += bitsToRead;

            if (this.bitPos === 8) {
                this.bitPos = 0;
                this.pos++;
            }
        }
        return result;
    }
}

function getNumBits(n: number, k: number): number {
    const states = baseTable[n][k];
    if (states <= 1) return 0;
    let bits = 0;
    let temp = states - 1;
    while (temp > 0) {
        bits++;
        temp >>= 1;
    }
    return bits;
}

function decodeSparseStream(posBuf: Buffer, valBuf: Buffer, expectedCount: number) {
    const reader = new BitReader(valBuf);
    const n = 8;
    const result = new Float32Array(expectedCount);
    let idx = 0;
    
    for (let i = 0; i < posBuf.length; i++) {
        const k = posBuf[i] & 0x7F; 
        const hasExtraBits = (posBuf[i] & 0x80) !== 0; 
        if (hasExtraBits) reader.readBits(4); 
        
        const bits = getNumBits(n, k);
        const rank = reader.readBits(bits);
        const decoded = fischerDecode(n, rank, k);
        for(let j=0; j<decoded.length; j++) {
            if (idx < expectedCount) result[idx++] = decoded[j];
        }
        if (idx >= expectedCount) break;
    }
    return result;
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
        try {
            blocks.push(zlib.inflateSync(data.subarray(offset, nextPos === data.length ? undefined : nextPos)));
            offset = nextPos;
        } catch(e) { break; }
    }
    return blocks;
}

function idwt53_1d(low: Float32Array, high: Float32Array): Float32Array {
    const N = low.length;
    const out = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
        out[i * 2] = low[i];
        out[i * 2 + 1] = high[i];
    }
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
    const outW = w * 2;
    const outH = h * 2;
    const temp = new Float32Array(outW * outH);
    const out = new Float32Array(outW * outH);
    
    for (let x = 0; x < w; x++) {
        const lowCol = new Float32Array(h);
        const highCol = new Float32Array(h);
        for (let y = 0; y < h; y++) {
            lowCol[y] = ll[x * h + y];
            highCol[y] = lh[x * h + y];
        }
        const col = idwt53_1d(lowCol, highCol);
        for (let y = 0; y < outH; y++) temp[x * outH + y] = col[y];
        
        for (let y = 0; y < h; y++) {
            lowCol[y] = hl[x * h + y];
            highCol[y] = hh[x * h + y];
        }
        const col2 = idwt53_1d(lowCol, highCol);
        for (let y = 0; y < outH; y++) temp[(x + w) * outH + y] = col2[y];
    }
    
    for (let y = 0; y < outH; y++) {
        const lowRow = new Float32Array(w);
        const highRow = new Float32Array(w);
        for (let x = 0; x < w; x++) {
            lowRow[x] = temp[x * outH + y];
            highRow[x] = temp[(x + w) * outH + y];
        }
        const row = idwt53_1d(lowRow, highRow);
        for (let x = 0; x < outW; x++) out[x * outH + y] = row[x];
    }
    
    return out;
}

const fileData = fs.readFileSync('/Users/emdzej/Documents/tis/GRAFIK/1/03/95/26.ITW');
const blocks = extractBlocks(fileData);

const width = 316, height = 238;
let W = Math.ceil(width / 16);  
let H = Math.ceil(height / 16); 
const size = W * H;

const block16 = blocks[16];
const block17 = blocks[17];
const block18 = blocks[18];

let sum16 = 0, sum17 = 0;
for (let i = 0; i < size; i++) {
    sum16 += block16[i];
    sum17 += block17[i];
}
const mean16 = sum16 / size;
const mean17 = sum17 / size;

const LL4 = new Float32Array(size);
const LH4 = new Float32Array(size);
const HL4 = new Float32Array(size);
const HH4 = new Float32Array(size);

for (let i = 0; i < size; i++) {
    LL4[i] = block18[i];
    LH4[i] = block17[i] - mean17;
    HL4[i] = block16[i] - mean16;
    HH4[i] = 0;
}

let l3_base = idwt2d(LL4, LH4, HL4, HH4, W, H);
W *= 2; H *= 2;

// DECODE L3 DETAILS
const L3_HL_D = new Float32Array(W * H);
for(let i=0; i<W*H; i++) {
    const v = blocks[4][i];
    L3_HL_D[i] = (v & 1) ? -((v >> 1) + 1) : (v >> 1);
}

const L3_LH_D = decodeSparseStream(blocks[6], blocks[7], W * H);
const L3_HH_D = decodeSparseStream(blocks[8], blocks[9], W * H);

const quantL3 = 2.0;
for(let i=0; i<W*H; i++) {
    L3_HL_D[i] *= quantL3;
    L3_LH_D[i] *= quantL3;
    L3_HH_D[i] *= quantL3;
}

let current = idwt2d(l3_base, L3_LH_D, L3_HL_D, L3_HH_D, W, H);
W *= 2; H *= 2;

for (let level = 0; level < 2; level++) {
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
        png.data[idx + 1] = v;
        png.data[idx + 2] = v;
        png.data[idx + 3] = 255;
    }
}
png.pack().pipe(fs.createWriteStream('/Users/emdzej/Documents/itw/ITW_L3_SAFELY_ADDED.png'));
console.log("Written detailed version safely to ITW_L3_SAFELY_ADDED.png");
