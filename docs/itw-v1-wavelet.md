# ITW V1 (0x0300) Wavelet Format

## Overview
ITW V1 uses biorthogonal CDF 7/5 wavelet compression with 4 decomposition levels.

## File Structure
```
Offset  Size  Description
0-3     4     Magic "ITW_" (0x4954575F)
4-5     2     Unknown
6-7     2     Width (big-endian)
8-9     2     Height (big-endian)
10-11   2     Bit depth (big-endian, usually 8)
12-13   2     Format type (0x0300 for V1)
14-17   4     Compressed data size (big-endian)
18+     var   Compressed data (zlib streams)
```

## Compressed Data
- Byte 0: Mode flag
- Byte 1: Wavelet decomposition levels (typically 4)
- Byte 2: Filter type (0=9/7, 1=7/5 biorthogonal)
- Bytes 3+: Multiple zlib-compressed coefficient streams

## Wavelet Decomposition (316×238 example)
```
Level 0: full=316×238 → LL=158×119, details=158×119 each
Level 1: full=158×119 → LL=79×60,   details vary
Level 2: full=79×60   → LL=40×30,   LH=40×30, HL=39×30, HH=39×30
Level 3: full=40×30   → LL=20×15,   details=20×15 each
```

## Stream Encoding Types

### Direct Storage (WORKING ✅)
Streams with size exactly matching subband size contain direct coefficients:
- **LL band**: Unsigned pixel values (typical range 20-80)
- **Detail bands**: Signed coefficients (int8, centered at 0)

Example (26.ITW):
| Stream | Size | Avg | Content |
|--------|------|-----|---------|
| 4 | 1200 | 8.8 | LH2 - 40×30 signed coefficients |
| 16 | 300 | 49.4 | LL3 - 20×15 pixel values |
| 18 | 300 | 21.2 | Detail L3 |

### RLE Encoding (PARTIAL)
Larger subbands use RLE encoding in stream pairs:
- **Low-avg stream** (~5-15): Position/skip data  
- **High-avg stream** (~100-130): Value stream (encoding unclear)

#### RLE Position Stream (S0, S2, etc.)
Byte interpretation:
- `0x00`: Read coefficient from value stream, advance position by 1
- `0x01-0x7F`: Skip N positions (no coefficient)
- `0x80-0xFF`: Embedded coefficient (value - 192), advance position by 1

#### Value Stream Padding
Value streams contain trailing padding patterns that must be stripped:
- **S1**: Pattern `[192, 4, 160]` repeats 80× from position 616
- **S3**: Pattern `[154, 18, 179, 166, 196, 172, 41, 49, 107, 74, 204]` repeats 31× from position 988

#### Value Stream Issue (UNSOLVED)
After removing padding, value streams still don't behave like wavelet coefficients:
- **S1 trimmed (616 bytes)**: Mean absolute 55.9, uniform distribution 0-128
- **S4 direct (1200 bytes)**: Mean absolute 12.5, 79% values in 0-9 range

S1 has many power-of-2 values (0, 32, 64, 128, 160, 192) suggesting it may be:
- Bitfield data
- Indices into a lookup table
- Differently encoded (not simple signed bytes)

## CDF 7/5 Inverse Wavelet Transform (IMPLEMENTED ✅)

### 1D Lifting Scheme
```
Inverse Update: s[n] -= (d[n-1] + d[n] + 2) / 4
Inverse Predict: d[n] += (x[2n] + x[2n+2]) / 2
```

### 2D Transform
1. Vertical: Reconstruct columns from (LL + LH) and (HL + HH)
2. Horizontal: Reconstruct rows from left and right column results

## Coefficient Characteristics
- Detail coefficients are sparse (most near zero)
- Example: LH2 has 894/1200 values in range -5 to +5
- Large values mark edges/high-frequency content
- Embedded RLE coefficients: only -58, -57, -56 observed

## Current Implementation Status
- ✅ CDF 7/5 inverse wavelet transform (1D and 2D)
- ✅ LL3 + LH2 reconstruction (clean output)
- ✅ Direct storage stream identification
- ✅ RLE position stream decoding
- ✅ Padding pattern detection and removal
- ⚠️ RLE value stream interpretation (produces noise)
- ⏳ Complete multi-level reconstruction with all subbands

## Test Results

### Working Reconstruction
LL3 + LH2 only produces clean output with horizontal edge detail.

### Issues with Level 1 Bands
Adding LH1/HL1 from RLE decoding introduces significant noise, suggesting:
1. Value stream encoding is different than expected
2. Position stream interpretation may be partially wrong
3. Streams may be mapped to different subbands

## References
- CDF 7/5: Cohen-Daubechies-Feauveau biorthogonal wavelet
- Used in JPEG 2000 lossy compression
- Lifting scheme from Sweldens 1996
