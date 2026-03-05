import * as fs from 'fs';
import * as zlib from 'zlib';

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
        for (let y = 0; y < outH; y++) {
            temp[x * outH + y] = col[y];
        }
        
        for (let y = 0; y < h; y++) {
            lowCol[y] = hl[x * h + y];
            highCol[y] = hh[x * h + y];
        }
        const col2 = idwt53_1d(lowCol, highCol);
        for (let y = 0; y < outH; y++) {
            temp[(x + w) * outH + y] = col2[y];
        }
    }
    
    for (let y = 0; y < outH; y++) {
        const lowRow = new Float32Array(w);
        const highRow = new Float32Array(w);
        for (let x = 0; x < w; x++) {
            lowRow[x] = temp[x * outH + y];
            highRow[x] = temp[(x + w) * outH + y];
        }
        const row = idwt53_1d(lowRow, highRow);
        for (let x = 0; x < outW; x++) {
            out[x * outH + y] = row[x];
        }
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
        try {
            blocks.push(zlib.inflateSync(data.subarray(offset, nextPos === data.length ? undefined : nextPos)));
            offset = nextPos;
        } catch(e) { break; }
    }
    
    return blocks;
}

export function decodeItwV1(filePath: string): { width: number; height: number; data: Uint8Array } {
    const fileData = fs.readFileSync(filePath);
    
    const magic = fileData.toString('ascii', 0, 4);
    if (magic !== 'ITW_') throw new Error('Invalid ITW magic');
    
    const width = fileData.readUInt16BE(6);
    const height = fileData.readUInt16BE(8);
    const version = fileData.readUInt16BE(12);
    
    if (version !== 0x0300) throw new Error(`Unsupported version: 0x${version.toString(16)}`);
    
    const blocks = extractBlocks(fileData);
    if (blocks.length < 19) throw new Error(`Expected 19 blocks, got ${blocks.length}`);
    
    let W = Math.ceil(width / 16);  
    let H = Math.ceil(height / 16); 
    
    const block16 = blocks[16];
    const block17 = blocks[17];
    const block18 = blocks[18];
    
    let sum16 = 0, sum17 = 0;
    const size = W * H;
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
    
    const output = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const v = (current[x * H + y] - min) * scale;
            output[y * width + x] = Math.round(v);
        }
    }
    
    return { width, height, data: output };
}
