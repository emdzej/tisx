# ITW V1 (0x0300) Wavelet Format

Reverse engineering notes for the BMW TIS ITW wavelet image format.

## Header Structure (18 bytes)

| Offset | Size | Type | Description |
|--------|------|------|-------------|
| 0x00 | 4 | char[4] | Magic: `ITW_` (0x4954575F) |
| 0x04 | 2 | u16 | Unknown (version?) |
| 0x06 | 2 | u16 BE | Width |
| 0x08 | 2 | u16 BE | Height |
| 0x0A | 2 | u16 BE | Bit depth (usually 8) |
| 0x0C | 2 | u16 BE | Format type: 0x0300 |
| 0x0E | 4 | u32 BE | Compressed data size |

## Compressed Data Structure

Starts at offset 0x12 (18).

| Offset | Size | Description |
|--------|------|-------------|
| 0x00 | 1 | Mode flag |
| 0x01 | 1 | Wavelet decomposition levels (3 or 4) |
| 0x02 | 1 | Filter type: 0=9/7, 1=7/5 |
| 0x03+ | var | Subband metadata + zlib streams |

## Wavelet Structure

Uses CDF 7/5 biorthogonal wavelet (filter_type=1) or CDF 9/7 (filter_type=0).

For 4 decomposition levels on a 316×238 image:

```
Level 0: 316×238 → LL(158×119), LH(158×119), HL(158×119), HH(158×119)
Level 1: 158×119 → LL(79×60), LH(79×59), HL(79×60), HH(79×59)
Level 2: 79×60 → LL(40×30), LH(40×30), HL(39×30), HH(39×30)
Level 3: 40×30 → LL(20×15), LH(20×15), HL(20×15), HH(20×15)
```

Final subbands (13 total):
- LL3: 20×15 = 300 coefficients (lowest frequency, actual image content)
- LH0-3, HL0-3, HH0-3: detail coefficients

## Zlib Streams

Multiple zlib-compressed streams contain the wavelet coefficients:

1. **Sparse streams** (avg ~5-15): Significance maps or run-length encoded positions
2. **Full-range streams** (avg ~100-130): Actual coefficient values

For a typical 316×238 image with 4 levels, there are ~19 zlib streams.

## Quantization

From decompiled code, quantization steps vary by subband level:

```c
// quant_steps indexed by subband
{8, 8, 4, 4, 4, 2, 2, 2, 1, 1, 1}
```

## Coefficient Encoding

Based on decompiled `FUN_004b72b0`:
- Zerotree-like significance coding
- Run-length encoding of zero runs
- Sign bits stored separately

## Current Decoder Status

✅ Implemented:
- Header parsing
- Zlib stream extraction
- LL subband identification and extraction
- Bilinear upscaling to full resolution

⏳ TODO:
- Detail coefficient decoding (LH, HL, HH)
- Dequantization
- Full inverse wavelet transform (CDF 7/5)
- Proper coefficient sign handling

## References

- Decompiled from `tis.exe` using Ghidra
- Key functions:
  - `FUN_004b5b30` — Main ITW decoder entry
  - `FUN_004b7970` — Wavelet decompression
  - `FUN_004b72b0` — Subband coefficient decoder
  - `FUN_004bd1e0` — Inverse wavelet transform
  - `FUN_004bc640` — 2D lifting scheme

## Test Files

Location: `/Users/emdzej/Documents/tis/GRAFIK/`
- ~47,660 ITW files (99% V1 format)
- Test file: `1/03/95/26.ITW` (316×238)

## Coefficient Encoding Analysis (WIP)

Based on reverse engineering of stream structure:

### Stream Pairing

Streams appear in pairs:
1. **Sparse stream** (avg ~5-15, many zeros): Position/run-length data
2. **Dense stream** (avg ~100-130): Coefficient values

### Run-Length Encoding

Stream 0 analysis (LH0 subband, 2380 bytes):
- 74% zeros (1773 bytes)
- Small values 0x02-0x08: ~524 occurrences (skip counts?)
- High values 0x86-0x88: ~82 occurrences (embedded values?)

### Observations

- First 234 bytes are zero (sparse beginning)
- Non-zero values appear in clusters
- High byte values (>= 0x80) may indicate embedded coefficients
- Total decompressed: 16,694 bytes vs 75,208 pixels = ~22% density

### Remaining Questions

1. Exact RLE encoding scheme (escape codes?)
2. How skip counts relate to value placement
3. Whether values are signed (centered at 128?)
4. Quantization step application

Needs more analysis of tis.exe decompiled code, specifically:
- `FUN_004b72b0` (subband coefficient decoder)
- `FUN_004b8500` (coefficient extraction)
