# ITW V1 (0x0300) Format Analysis

Based on Ghidra reverse engineering of BMW TIS wavelet decoder.

## File Structure

```
Offset  Size  Description
------  ----  -----------
0       4     Magic "ITW_"
6       2     Width (BE)
8       2     Height (BE)
12      2     Version (0x0300)
14      4     Compressed size (BE)
18      N     Payload (NOT zlib-compressed as a whole)
```

## Payload Structure

```
Offset  Size  Description
------  ----  -----------
0       1     Filter type (0=CDF 9/7, 1=custom 5/3)
1       1     Decomposition levels (3 or 4)
2       1     Additional filter parameter
3       74    Block/stream table
77+     N     Multiple zlib-compressed streams
```

## Stream Mapping (for 316×238, 4 levels)

19 zlib streams found:

| Stream | Bytes | Description |
|--------|-------|-------------|
| S0 | 2380 | L1 LH positions (RLE, 74% zeros) |
| S1 | 996 | L1 LH values (Fischer coded) |
| S2 | 2528 | L1 HL positions |
| S3 | 1470 | L1 HL values |
| S4 | 1200 | L3 LH detail (40×30, zigzag) |
| S5 | 782 | Fischer values |
| S6 | 1264 | L3 HL detail? (zigzag) |
| S7 | 1093 | Fischer values |
| S8 | 1264 | L3 HH detail? (zigzag) |
| S9-S15 | var | L2 details (Fischer coded) |
| S16 | 300 | **LL4 direct** (20×15, range 21-80) |
| S17 | 320 | L4 HL? (20×15+pad, zigzag) |
| S18 | 300 | L4 LH? (20×15, zigzag) |

## Encoding Schemes

### Direct Streams (quant step < 2)
- LL4 (S16): Raw byte values, range ~20-80
- L3/L4 details: Zigzag encoded signed integers
  - `decode(n) = (n >> 1) ^ -(n & 1)`

### Sparse Streams (quant step >= 2)
Paired RLE + Fischer probability coding:

**Position stream (even):**
- High zero percentage (50-80%)
- If `byte & 0x80`: 4 extra bits follow
- Lower 7 bits = position/skip info

**Value stream (odd):**
- Mean ~100-130
- Fischer probability coded
- Uses 9×201 cumulative probability table

## Quantization Steps

```
Index  Step  Subband
-----  ----  -------
0      8     LH1
1      8     HL1
2      4     LH2
3      4     HL2
4      4     HH2
5      2     LH3
6      2     HL3
7      2     HH3
8      1     LH4
9      1     HL4
10     1     HH4/LL4
```

## Filter Coefficients

### Filter Type 0: CDF 9/7 (JPEG 2000 lossy)
```
Analysis:  [0.053, -0.033, -0.093, 0.387, 0.387, -0.093, -0.033, 0.053]
Synthesis: [-0.087, -0.055, 0.440, 0.817, 0.440, -0.055, -0.087]
```

### Filter Type 1: Custom 5/3 (NOT standard LeGall!)
```
Analysis:  [-0.011, -0.054, 0.261, 0.607, 0.261, -0.054, -0.011]
Synthesis: [-0.05, 0.25, 0.6, 0.25, -0.05]
```

## Current Implementation Status

✅ Working:
- File header parsing
- Zlib stream extraction
- LL4 direct value decoding
- Bilinear upscale from LL4
- Zigzag decoding for L3/L4 details

❌ Not implemented:
- Fischer probability decoder
- RLE position decoder
- Full inverse wavelet reconstruction
- L1/L2 detail decoding

## References

- Ghidra decompilation: `re.c`
- Test file: `GRAFIK/1/03/95/26.ITW` (316×238)
- Key functions:
  - `FUN_004b5b30`: V1 main decoder
  - `FUN_004b7970`: Wavelet decomposition
  - `FUN_004b7770`: Filter coefficient setup
  - `FUN_004bbdf0`: Fischer decode
  - `FUN_004b8a60`: Probability table initialization
