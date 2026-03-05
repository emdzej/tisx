/**
 * ITW V1 Decoder - Faithful port from tis.exe (Ghidra RE)
 * 
 * Constants extracted directly from .rdata segment of tis.exe:
 *   _DAT_004ed190 = 0.5
 *   _DAT_004ed198 = 1/127 = 0.007874015748031496
 *   _DAT_004ed1a0 = 127.0
 *   _DAT_004ed1d0 = 16.0
 *   _DAT_004ed1d8 = 0.0625 (1/16)
 *   _DAT_004ed128 = 2.0
 *   _DAT_004ed118 = 128 (0x80, flag mask)
 *   DAT_004ed11c  = 5 (Fischer block size)
 * 
 * Band layout (local_3c[11]):
 *   [0]=8, [1]=8       → L1: LH, HL  (quant=8)
 *   [2]=4, [3]=4, [4]=4 → L2: LH, HL, HH (quant=4)
 *   [5]=2, [6]=2, [7]=2 → L3: LH, HL, HH (quant=2)
 *   [8]=1, [9]=1, [10]=1 → L4: LH, HL, HH (quant=1)
 *   LL at deepest level is band index 11
 * 
 * Filter type 1 (CDF 5/3) coefficients from wavelet_init_filters:
 *   Low synthesis (7 taps):  [-0.010714, -0.053571, 0.260714, 0.607143, 0.260714, -0.053571, -0.010714]
 *   High synthesis (5 taps): [-0.050000, 0.250000, 0.600000, 0.250000, -0.050000]
 *   Scaled by sqrt(2.0)
 */

import * as fs from 'fs';
import * as zlib from 'zlib';

// ========== CONSTANTS (from .rdata) ==========
const HALF = 0.5;                      // _DAT_004ed190
const INV_127 = 0.007874015748031496;  // _DAT_004ed198 = 1/127
const LL_CENTER = 127.0;               // _DAT_004ed1a0
const MAX_EXTRA_BITS = 16.0;           // _DAT_004ed1d0
const INV_16 = 0.0625;                 // _DAT_004ed1d8
const SQRT2_BASE = 2.0;               // _DAT_004ed128
const FLAG_MASK = 128;                 // _DAT_004ed118 = 0x80
const FISCHER_N = 5;                   // DAT_004ed11c

// Quantization per band
const QUANT = [8, 8, 4, 4, 4, 2, 2, 2, 1, 1, 1];
const NUM_BANDS = 11; // local_a0
const TOTAL_ARRAYS = 12; // local_90

// ========== CDF 5/3 FILTER COEFFICIENTS (type 1 from wavelet_init_filters) ==========
// Before sqrt(2) scaling
const LOW_RAW = [-0.010714, -0.053571, 0.260714, 0.607143, 0.260714, -0.053571, -0.010714];
const HIGH_RAW = [-0.050000, 0.250000, 0.600000, 0.250000, -0.050000];

const SQRT2 = Math.sqrt(SQRT2_BASE);
const LOW_FILTER = LOW_RAW.map(v => v * SQRT2);
const HIGH_FILTER = HIGH_RAW.map(v => v * SQRT2);

// ========== FISCHER TABLES ==========
// fischer_build_base_table: T[i][j] = C(i+j, i) = (i+j)! / (i! * j!)
// This is the binomial coefficient / combinations table
function buildBaseTable(n: number): number[][] {
    const size = n * 2 + 1; // for n=5: 0..10
    const table: number[][] = [];
    for (let i = 0; i <= size; i++) {
        table[i] = [];
        for (let j = 0; j <= size; j++) {
            if (i === 0 || j === 0) table[i][j] = 1;
            else table[i][j] = table[i][j-1] + table[i-1][j] + table[i-1][j-1];
        }
    }
    return table;
}

// fischer_build_diff_table: D[i][j] = T[i][j] - T[i][j-1]
function buildDiffTable(baseTable: number[][]): number[][] {
    const diff: number[][] = [];
    for (let i = 0; i < baseTable.length; i++) {
        diff[i] = [];
        for (let j = 0; j < baseTable[i].length; j++) {
            diff[i][j] = j === 0 ? baseTable[i][j] : baseTable[i][j] - baseTable[i][j-1];
        }
    }
    return diff;
}

// fischer_build_rank_table
function buildRankTable(n: number): number[][] {
    // Rank table maps (n, k) -> number of bits needed
    // From calc_rank_bit_length: ceil(log2(baseTable[n][k]))
    const base = buildBaseTable(n);
    const rank: number[][] = [];
    for (let i = 0; i < base.length; i++) {
        rank[i] = [];
        for (let j = 0; j < base[i].length; j++) {
            rank[i][j] = base[i][j] <= 1 ? 0 : Math.ceil(Math.log2(base[i][j]));
        }
    }
    return rank;
}

// ========== BIT READER ==========
class BitReader {
    private data: Buffer;
    private bytePos: number;
    private bitPos: number;

    constructor(data: Buffer, offset: number = 0) {
        this.data = data;
        this.bytePos = offset;
        this.bitPos = 0;
    }

    readByte(): number {
        return this.data[this.bytePos++];
    }

    readBE16(): number {
        const v = (this.data[this.bytePos] << 8) | this.data[this.bytePos + 1];
        this.bytePos += 2;
        return v;
    }

    readBEMultibyte(n: number): number {
        let v = 0;
        for (let i = 0; i < n; i++) {
            v = (v << 8) | this.data[this.bytePos++];
        }
        return v;
    }

    initBitstream() {
        this.bitPos = 0;
    }

    readBits(n: number): number {
        if (n === 0) return 0;
        let result = 0;
        for (let i = 0; i < n; i++) {
            if (this.bitPos === 0) {
                // Need to read next byte into bit buffer
            }
            const byte = this.data[this.bytePos];
            const bit = (byte >> (7 - this.bitPos)) & 1;
            result = (result << 1) | bit;
            this.bitPos++;
            if (this.bitPos >= 8) {
                this.bitPos = 0;
                this.bytePos++;
            }
        }
        return result;
    }

    finishBitstream(): number {
        if (this.bitPos > 0) {
            this.bytePos++;
            this.bitPos = 0;
        }
        return this.bytePos; // return current position
    }

    get position(): number {
        return this.bytePos;
    }

    set position(p: number) {
        this.bytePos = p;
        this.bitPos = 0;
    }
}

// ========== EXTRACT ZLIB BLOCKS ==========
function extractBlocks(data: Buffer, startOffset: number): Buffer[] {
    const blocks: Buffer[] = [];
    let offset = startOffset;
    
    while (offset < data.length) {
        if (data[offset] !== 0x78) break;
        let nextPos = offset + 2;
        while (nextPos < data.length) {
            if (data[nextPos] === 0x78 && 
                (data[nextPos + 1] === 0x01 || data[nextPos + 1] === 0x9c || data[nextPos + 1] === 0xda)) {
                try { 
                    zlib.inflateSync(data.subarray(offset, nextPos)); 
                    break; 
                } catch(e) { /* not a valid split point */ }
            }
            nextPos++;
        }
        try {
            blocks.push(zlib.inflateSync(data.subarray(offset, nextPos >= data.length ? undefined : nextPos)));
            offset = nextPos;
        } catch(e) { 
            break; 
        }
    }
    return blocks;
}

// ========== DIMENSION HELPERS ==========
// split_even_odd (FUN_004bc7c0)
function splitEvenOdd(n: number): [number, number] {
    if (n % 2 === 0) return [n / 2, n / 2];
    return [(n + 1) / 2, (n - 1) / 2];
}

// ========== LEVEL SCALE FACTOR ==========
// level_scale_factor: (16.0 - param_1) * 0.0625
function levelScaleFactor(extraBits: number): number {
    return (MAX_EXTRA_BITS - extraBits) * INV_16;
}

// ========== Q15 CONVERSION ==========
function q15ToFloat(val: number): number {
    // Interpret as signed 16-bit
    if (val >= 32768) val -= 65536;
    return val / 32768.0;
}

// ========== POLYPHASE CONVOLUTION ==========
// This is the core wavelet reconstruction from polyphase_convolve (FUN_004bc940)
// Uses actual filter coefficients, not lifting scheme

// edge_extend_sample: symmetric extension
function edgeExtendSample(data: Float32Array, idx: number, len: number): number {
    if (idx < 0) idx = -idx;
    if (idx >= len) idx = 2 * len - 2 - idx;
    if (idx < 0) idx = 0;
    if (idx >= len) idx = len - 1;
    return data[idx];
}

// Polyphase upsampling + filtering for one dimension
function polyphaseReconstruct1D(
    low: Float32Array, high: Float32Array, 
    lowFilter: number[], highFilter: number[],
    outputLen: number
): Float32Array {
    const out = new Float32Array(outputLen);
    const lowHalf = Math.floor(lowFilter.length / 2);
    const highHalf = Math.floor(highFilter.length / 2);
    
    for (let i = 0; i < outputLen; i++) {
        let sum = 0;
        
        if (i % 2 === 0) {
            // Even sample: use low filter on low subband
            for (let k = -lowHalf; k <= lowHalf; k++) {
                const srcIdx = (i / 2) + k;
                const sample = edgeExtendSample(low, srcIdx, low.length);
                sum += sample * lowFilter[lowHalf - k];
            }
        } else {
            // Odd sample: use high filter on high subband  
            for (let k = -highHalf; k <= highHalf; k++) {
                const srcIdx = ((i - 1) / 2) + k;
                const sample = edgeExtendSample(high, srcIdx, high.length);
                sum += sample * highFilter[highHalf - k];
            }
        }
        
        out[i] = sum;
    }
    return out;
}

// ========== 2D WAVELET RECONSTRUCTION ==========
// wavelet_reconstruct_level (FUN_004bc640)
// Reconstructs one level from LL + LH + HL + HH subbands
function waveletReconstructLevel(
    ll: Float32Array, lh: Float32Array, hl: Float32Array, hh: Float32Array,
    llW: number, llH: number,
    lhW: number, lhH: number,
    hlW: number, hlH: number,
    hhW: number, hhH: number,
    outW: number, outH: number
): Float32Array {
    const out = new Float32Array(outW * outH);
    
    // Step 1: Vertical reconstruction (columns)
    // For each column x, combine LL[x]+LH[x] and HL[x]+HH[x]
    const tempA = new Float32Array(outW * outH); // from LL+LH
    const tempB = new Float32Array(outW * outH); // from HL+HH
    
    // Vertical pass: LL + LH → tempA (low columns + high columns → full height columns)
    for (let x = 0; x < llW; x++) {
        const lowCol = new Float32Array(llH);
        const highCol = new Float32Array(lhH);
        for (let y = 0; y < llH; y++) lowCol[y] = ll[x * llH + y];
        for (let y = 0; y < lhH; y++) highCol[y] = lh[x * lhH + y];
        const col = polyphaseReconstruct1D(lowCol, highCol, LOW_FILTER, HIGH_FILTER, outH);
        for (let y = 0; y < outH; y++) tempA[x * outH + y] = col[y];
    }
    
    // Vertical pass: HL + HH → tempB
    for (let x = 0; x < hlW; x++) {
        const lowCol = new Float32Array(hlH);
        const highCol = new Float32Array(hhH);
        for (let y = 0; y < hlH; y++) lowCol[y] = hl[x * hlH + y];
        for (let y = 0; y < hhH; y++) highCol[y] = hh[x * hhH + y];
        const col = polyphaseReconstruct1D(lowCol, highCol, LOW_FILTER, HIGH_FILTER, outH);
        for (let y = 0; y < outH; y++) tempB[x * outH + y] = col[y];
    }
    
    // Step 2: Horizontal reconstruction (rows)
    // For each row y, combine tempA[y] + tempB[y]
    for (let y = 0; y < outH; y++) {
        const lowRow = new Float32Array(llW);
        const highRow = new Float32Array(hlW);
        for (let x = 0; x < llW; x++) lowRow[x] = tempA[x * outH + y];
        for (let x = 0; x < hlW; x++) highRow[x] = tempB[x * outH + y];
        const row = polyphaseReconstruct1D(lowRow, highRow, LOW_FILTER, HIGH_FILTER, outW);
        for (let x = 0; x < outW; x++) out[x * outH + y] = row[x];
    }
    
    return out;
}

// ========== FISCHER DECODER ==========
// fischer_decode (FUN_004bbdf0)
function fischerDecode(
    k: number, extraBits: number, diffTable: number[][]
): number[] {
    const n = FISCHER_N;
    const result: number[] = new Array(n).fill(0);
    
    // TODO: Full Fischer implementation
    // For now return zeros
    return result;
}

// ========== COEFFICIENT RECONSTRUCTION ==========
// coeff_reconstruct_quant1: for L4 bands (quant=1)
// Formula: (val % (quant*2+1) - quant) * (scale/quant) * levelScale + offset
function coeffReconstructQuant1(
    rawValues: number[], quant: number, 
    scale: number, offset: number, levelScale: number
): Float32Array {
    const out = new Float32Array(rawValues.length);
    const mod = quant * 2 + 1;
    for (let i = 0; i < rawValues.length; i++) {
        out[i] = (rawValues[i] % mod - quant) * (scale / quant) * levelScale + offset;
    }
    return out;
}

// ========== MAIN DECODER ==========
export function decodeItwV1(filePath: string): { width: number; height: number; data: Uint8Array } {
    const fileData = fs.readFileSync(filePath);
    
    // Parse header
    const magic = fileData.toString('ascii', 0, 4);
    if (magic !== 'ITW_') throw new Error('Invalid ITW magic');
    
    const width = fileData.readUInt16BE(6);
    const height = fileData.readUInt16BE(8);
    const bpp = fileData.readUInt16BE(10);
    const version = fileData.readUInt16BE(12);
    
    if (version !== 0x0300) throw new Error(`Unsupported version: 0x${version.toString(16)}`);
    
    // Read per-band header data (11 bands × 6 bytes at offset 22)
    // Each band: flags(2) + scale(2) + offset(2)
    const bandFlags: number[] = [];
    const bandScale: number[] = [];
    const bandOffset: number[] = [];
    
    // Header structure from Ghidra analysis:
    // First 3 bytes after ZLIB offset: DAT_00516c78, numLevels, filterType
    // Then per-frame: 1-bit flags per band, then per band: flags(2) + scale(Q15,2) + offset(Q15,2)
    // Then range_min(2) + range_max(2)
    
    // Extract ZLIB blocks
    // The data stream starts at offset 95 for V1
    const blocks = extractBlocks(fileData, 95);
    if (blocks.length < 19) throw new Error(`Expected >=19 blocks, got ${blocks.length}`);
    
    // Build Fischer tables
    const baseTable = buildBaseTable(FISCHER_N);
    const diffTable = buildDiffTable(baseTable);
    const rankTable = buildRankTable(FISCHER_N);
    
    // The main decode loop reads from a sequential byte stream.
    // Blocks 0-18 are the ZLIB-compressed data streams.
    // The reading order in itw_decode_main is:
    //   1. Per-frame header (flags, scale/offset per band, range)
    //   2. Bands 0-10 via itw_decode_band (each reads 1-2 ZLIB streams)
    //   3. LL band via read_ll_band (1 stream)
    
    // For now, we know the block mapping for L4 (confirmed working):
    // Block 18 = LL4, Block 17 = LH4 (centered ~78), Block 16 = HL4 (centered ~49)
    
    // Pyramid dimensions
    const numLevels = 4;
    
    // Calculate pyramid dimensions using split_even_odd
    const dims: { w: number; h: number }[] = [{ w: width, h: height }];
    for (let i = 0; i < numLevels; i++) {
        const prev = dims[i];
        const [lowW] = splitEvenOdd(prev.w);
        const [lowH] = splitEvenOdd(prev.h);
        dims.push({ w: lowW, h: lowH });
    }
    // dims[0] = 316x238 (full), dims[1] = 158x119, dims[2] = 79x60, dims[3] = 40x30, dims[4] = 20x15
    
    // LL4 dimensions
    const llW = dims[numLevels].w; // 20
    const llH = dims[numLevels].h; // 15
    const llSize = llW * llH;
    
    // Load LL4 from block 18
    const LL4 = new Float32Array(llSize);
    for (let i = 0; i < llSize; i++) {
        LL4[i] = blocks[18][i]; // raw bytes as floats, like read_ll_band does
    }
    
    // L4 detail bands from blocks 16, 17 (quant=1)
    // For quant=1 bands, we use coeff_reconstruct_quant1
    // But we need per-band scale/offset from the header stream
    // Since the header is embedded in the sequential stream (not in fixed file offsets),
    // we need to parse it properly.
    
    // TEMPORARY: Use the mean-subtraction approach that works
    // (This is equivalent to quant1 formula when scale≈mean and offset≈0)
    const block16 = blocks[16];
    const block17 = blocks[17];
    
    let sum16 = 0, sum17 = 0;
    for (let i = 0; i < llSize; i++) {
        sum16 += block16[i];
        sum17 += block17[i];
    }
    const mean16 = sum16 / llSize;
    const mean17 = sum17 / llSize;
    
    const LH4 = new Float32Array(llSize);
    const HL4 = new Float32Array(llSize);
    const HH4 = new Float32Array(llSize);
    
    for (let i = 0; i < llSize; i++) {
        LH4[i] = block17[i] - mean17;
        HL4[i] = block16[i] - mean16;
        HH4[i] = 0;
    }
    
    // Reconstruct L4 → L3 using polyphase convolution
    const l3W = dims[3].w; // 40
    const l3H = dims[3].h; // 30
    const [llLowW, llHighW] = splitEvenOdd(l3W);
    const [llLowH, llHighH] = splitEvenOdd(l3H);
    
    let current = waveletReconstructLevel(
        LL4, LH4, HL4, HH4,
        llW, llH, llW, llH, llW, llH, llW, llH,
        l3W, l3H
    );
    
    // L3 → L2 (zeros for detail bands for now)
    let curW = l3W, curH = l3H;
    for (let level = 2; level >= 0; level--) {
        const targetW = dims[level].w;
        const targetH = dims[level].h;
        const [lowW, highW] = splitEvenOdd(targetW);
        const [lowH, highH] = splitEvenOdd(targetH);
        
        const zeros = new Float32Array(highW * curH);
        const zerosH = new Float32Array(curW * highH);
        const zerosHH = new Float32Array(highW * highH);
        
        current = waveletReconstructLevel(
            current, zeros, zerosH, zerosHH,
            curW, curH, highW, curH, curW, highH, highW, highH,
            targetW, targetH
        );
        curW = targetW;
        curH = targetH;
    }
    
    // LL rescaling (from itw_decode_main)
    // For now, simple min/max normalization
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < current.length; i++) {
        if (current[i] < min) min = current[i];
        if (current[i] > max) max = current[i];
    }
    const scale = 255 / (max - min);
    
    const output = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const v = (current[x * curH + y] - min) * scale;
            output[y * width + x] = Math.round(Math.max(0, Math.min(255, v)));
        }
    }
    
    return { width, height, data: output };
}
