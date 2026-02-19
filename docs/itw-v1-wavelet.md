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

### Direct Storage
Streams with size exactly matching subband size contain direct coefficients:
- **LL band**: Unsigned pixel values (typical range 20-80)
- **Detail bands**: Signed coefficients (int8, centered at 0)

Example (26.ITW):
| Stream | Size | Avg | Content |
|--------|------|-----|---------|
| 4 | 1200 | 8.8 | LH2 - 40×30 signed coefficients |
| 16 | 300 | 49.4 | LL3 - 20×15 pixel values |
| 18 | 300 | 21.2 | Detail L3 |

### RLE Encoding
Larger subbands use RLE encoding in stream pairs:
- **Low-avg stream** (~5-15): Position/skip data
- **High-avg stream** (~100-130): Coefficient values

RLE byte interpretation:
- `0x00`: Place next coefficient from value stream, advance position by 1
- `0x01-0x7F`: Skip N positions (no coefficient)
- `0x80-0xFF`: Embedded coefficient (value - 192), advance position by 1

## Coefficient Characteristics
- Detail coefficients are sparse (most near zero)
- Example: LH2 has 894/1200 values in range -5 to +5
- Large values mark edges/high-frequency content

## Current Implementation Status
- ✅ LL-only decoder (bilinear upscale)
- ✅ Direct storage stream identification
- ✅ RLE decoding for detail streams
- ⏳ Full CDF 7/5 inverse transform
- ⏳ Complete multi-level reconstruction

## Known Issues
- Streams 16-18 (Level 3) have only positive values - may use offset encoding
- Full inverse wavelet requires proper lifting scheme implementation
