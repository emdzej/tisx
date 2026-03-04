/**
 * ITW V1 Decoder using CDF 5/3 Inverse DWT (Lifting Scheme)
 * 
 * Working implementation based on Ghidra reverse-engineering of tis.exe.
 * Currently decodes LL4 + L4 detail bands only (blurry but correct shape).
 * 
 * Block mapping (for 316x238 test file):
 * - Block 18: LL4 (20x15, raw bytes range 7-42)
 * - Block 17: LH4 (20x15, centered around mean ~78)
 * - Block 16: HL4 (20x15, centered around mean ~49)
 * - HH4: assumed zeros
 * 
 * L3/L2/L1 detail bands require Fischer decoder (sparse RLE + arithmetic coding).
 */

import * as fs from 'fs';
import * as zlib from 'zlib';

/**
 * CDF 5/3 Inverse Lifting - 1D
 * Undo update: s[n] -= 0.25*(d[n-1] + d[n])
 * Undo predict: d[n] += 0.5*(s[n] + s[n+1])
 */
function idwt53_1d(low: Float32Array, high: Float32Array): Float32Array {
    const N = low.length;
    const out = new Float32Array(N * 2);
    
    // Interleave: even positions = low (s), odd positions = high (d)
    for (let i = 0; i < N; i++) {
        out[i * 2] = low[i];
        out[i * 2 + 1] = high[i];
    }
    
    // Undo update step
    for (let i = 0; i < N; i++) {
        const d_left = i > 0 ? out[i * 2 - 1] : out[1]; // symmetric extension
        out[i * 2] -= 0.25 * (d_left + out[i * 2 + 1]);
    }
    
    // Undo predict step
    for (let i = 0; i < N; i++) {
        const s_right = i < N - 1 ? out[i * 2 + 2] : out[(N - 1) * 2]; // symmetric extension
        out[i * 2 + 1] += 0.5 * (out[i * 2] + s_right);
    }
    
    return out;
}

/**
 * 2D Inverse DWT using separable 1D transforms
 * Column-major storage: data[x * H + y]
 */
function idwt2d(
    ll: Float32Array, 
    lh: Float32Array, 
    hl: Float32Array, 
    hh: Float32Array,
    w: number, 
    h: number
): Float32Array {
    const outW = w * 2;
    const outH = h * 2;
    const temp = new Float32Array(outW * outH);
    const out = new Float32Array(outW * outH);
    
    // Vertical reconstruction (columns)
    for (let x = 0; x < w; x++) {
        // Left half: LL + LH
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
        
        // Right half: HL + HH
        for (let y = 0; y < h; y++) {
            lowCol[y] = hl[x * h + y];
            highCol[y] = hh[x * h + y];
        }
        const col2 = idwt53_1d(lowCol, highCol);
        for (let y = 0; y < outH; y++) {
            temp[(x + w) * outH + y] = col2[y];
        }
    }
    
    // Horizontal reconstruction (rows)
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

/**
 * Extract ZLIB blocks from ITW V1 file
 */
function extractBlocks(data: Buffer): Buffer[] {
    const blocks: Buffer[] = [];
    let offset = 77; // Skip header + metadata
    
    while (offset < data.length - 2) {
        const blockSize = data.readUInt16BE(offset);
        offset += 2;
        
        if (blockSize === 0 || offset + blockSize > data.length) break;
        
        const compressed = data.subarray(offset, offset + blockSize);
        offset += blockSize;
        
        try {
            const decompressed = zlib.inflateSync(compressed);
            blocks.push(decompressed);
        } catch {
            break;
        }
    }
    
    return blocks;
}

/**
 * Decode ITW V1 image (currently L4 only)
 */
export function decodeItwV1(filePath: string): { width: number; height: number; data: Uint8Array } {
    const fileData = fs.readFileSync(filePath);
    
    // Parse header
    const magic = fileData.toString('ascii', 0, 4);
    if (magic !== 'ITW_') {
        throw new Error('Invalid ITW magic');
    }
    
    const width = fileData.readUInt16BE(4);
    const height = fileData.readUInt16BE(6);
    const version = fileData.readUInt16BE(10);
    
    if (version !== 0x0300) {
        throw new Error(`Unsupported version: 0x${version.toString(16)}`);
    }
    
    // Extract blocks
    const blocks = extractBlocks(fileData);
    if (blocks.length < 19) {
        throw new Error(`Expected 19 blocks, got ${blocks.length}`);
    }
    
    // L4 dimensions
    let W = Math.ceil(width / 16);  // 20 for 316
    let H = Math.ceil(height / 16); // 15 for 238
    
    // Load L4 bands
    const block16 = blocks[16];
    const block17 = blocks[17];
    const block18 = blocks[18];
    
    // Calculate means for centering detail bands
    let sum16 = 0, sum17 = 0;
    const size = W * H;
    for (let i = 0; i < size; i++) {
        sum16 += block16[i];
        sum17 += block17[i];
    }
    const mean16 = sum16 / size;
    const mean17 = sum17 / size;
    
    // Initialize L4 subbands
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
    
    // Run 4 levels of IDWT
    let current = idwt2d(LL4, LH4, HL4, HH4, W, H);
    W *= 2; H *= 2;
    
    // L3, L2, L1 with zero details (blurry)
    for (let level = 0; level < 3; level++) {
        const zeros = new Float32Array(W * H);
        current = idwt2d(current, zeros, zeros, zeros, W, H);
        W *= 2; H *= 2;
    }
    
    // Scale to 0-255 and crop
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
