# ITW V1 Decompiled Analysis

## Quantization Steps (per subband)
```
Index  Subband  Step
0      LH1      8
1      HL1      8
2      LH2      4
3      HL2      4
4      HH2      4
5      LH3      2
6      HL3      2
7      HH3      2
8      LH4      1
9      HL4      1
10     HH4      1
11     LL4      (special - direct storage)
```

## Stream Organization (12 subbands)
- Subbands 0-10: Detail coefficients (RLE + Fischer encoded)
- Subband 11: LL4 (direct float values, normalized to 0-255)

## Dequantization Formula
```c
fVar8 = (quant_step / max_range) * global_scale;
coeff = raw_value * (fVar8 / scale_factor) + dc_offset;

// scale_factor from FUN_004b8a40:
scale_factor = (16.0 - param) * 0.0625;  // range 0-1
```

## Fischer Decode (FUN_004bbdf0)
Uses 2D lookup table from FUN_004b8a60 with dimensions [9][201].
The table contains cumulative sums for combinatorial indexing.

Key sequences at offset 0x7c (row 2):
```
1, 5, 13, 25, 41, 61, 85, 113, 145, 181, 221, 265, 313, 365, 421, 481, ...
```
These are centered octagonal numbers: `2n² + 2n + 1`

## Wavelet Filter Selection
FUN_004b7720 selects filter based on param:
- param=0: 9/7 filter (Daubechies)
- param=1: 5/3 filter (LeGall/CDF 5/3)

ITW V1 uses param=1 (5/3 filter).

## CDF 5/3 Filter Coefficients
From FUN_004b7770:
```c
// Lowpass analysis: {-1/8, 1/4, 3/4, 1/4, -1/8} (scaled by sqrt(2))
// Highpass analysis: {-1/2, 1, -1/2}
```

## Bit Stream Reading
FUN_004bc220 reads `param_1` bits LSB-first from the current position.
FUN_004bc1d0 reads single bit, auto-advances byte on 8th bit.

## Stream Analysis (test file)

### Stream Types (19 streams)
```
Even streams (0,2,4,6,8,10,12,14): Detail coefficients (sparse, 30-80% zeros)
Odd streams (1,3,5,7,9,11,13,15): LL-like data (dense, high mean ~100-110)
Stream 16: LL4 band (20×15, mean=49.4)
Stream 17: Unknown (320 bytes)
Stream 18: L4 detail? (20×15, mean=21.2)
```

### Confirmed Mappings
- **S16** = LL4 (lowest resolution low-pass) ✓
- **S4** = LH3 or similar detail band (1200 bytes = 40×30, exact size match)

### Interleaved Pattern
Streams appear to be paired: detail + auxiliary data alternating.
This suggests RLE-compressed detail coefficients with run lengths stored separately.

### Next Steps for Full Decode
1. Understand RLE encoding in detail streams
2. Parse metadata block to get stream→subband mapping
3. Apply dequantization with correct steps per subband
4. Implement proper CDF 5/3 inverse wavelet with all bands

## Detail Coefficient Encoding

### Confirmed: Zigzag Encoding
Detail streams use zigzag encoding for signed values:
```
decode(n) = (n >> 1) ^ -(n & 1)
```
This maps: 0→0, 1→-1, 2→1, 3→-2, 4→2, ...

### Stream S4 Analysis (40×30 = 1200 bytes)
- Contains edge/detail data (not low-pass)
- 42% zeros (sparse)
- Mean 8.8, range 0-173
- Zigzag decoded: range -87 to +86
- Visualized: shows horizontal edges consistent with LH subband

### Integration Challenge
CDF 5/3 inverse wavelet produces artifacts when only LL is available.
Detail bands need to be correctly placed in the wavelet domain.

### Current Working Approach
Bilinear upscale from LL4 (stream 16) produces recognizable but blurry images.
This is the fallback for now until detail reconstruction is implemented.
