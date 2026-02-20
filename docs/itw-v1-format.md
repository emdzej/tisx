# ITW File Format (V1 - 0x0300 Wavelet)

Based on reverse engineering of `tis.exe` from BMW TIS documentation system.

## Header (14 bytes)

| Offset | Size | Field | Notes |
|--------|------|-------|-------|
| 0x00 | 4 | Magic | `ITW_` |
| 0x04 | 2 | Version | Big-endian, typically 0x0100 |
| 0x06 | 2 | Width | Big-endian |
| 0x08 | 2 | Height | Big-endian |
| 0x0A | 2 | Bits | Big-endian, typically 8 |
| 0x0C | 2 | Compression | 0x0300 = V1 wavelet, 0x0400 = V2 LZW |

## V1 Wavelet Format (0x0300)

After header:

| Offset | Size | Field |
|--------|------|-------|
| 0x0E | 4 | Compressed size (BE) |
| 0x12 | N | Compressed data |

### Compressed Data Structure

First 3 bytes are metadata:
- Byte 0: Filter type (0 = CDF 9/7)
- Byte 1: Number of levels (typically 4)
- Byte 2: Quantization parameter

Following metadata: 77-byte block with subband parameters.

### Zlib Streams

The compressed data contains 19 zlib streams:

| Stream | Size | Content |
|--------|------|---------|
| 0 | 2380 | L1 positions (RLE) |
| 1 | 996 | L1 values (Fischer coded) |
| 2 | 2528 | L1 positions |
| 3 | 1470 | L1 values |
| 4 | 1200 | L3 detail (40×30) |
| 5 | 782 | L3 values |
| 6-15 | varies | L2/L3 subbands |
| **16** | **300** | **LL4 (20×15)** - lowest frequency |
| 17 | 320 | L4 detail (padded) |
| 18 | 300 | L4 detail |

### Wavelet Levels

For 316×238 image with 4 levels:

| Level | Dimensions | Pixels |
|-------|-----------|--------|
| L1 | 158×119 | 18,802 |
| L2 | 79×60 | 4,740 |
| L3 | 40×30 | 1,200 |
| L4 | 20×15 | 300 |

### Stream Types

- **Even streams (0,2,4...)**: Positions - sparse encoding with RLE
  - Low mean (~5-13)
  - Values indicate skip counts
  
- **Odd streams (1,3,5...)**: Values - entropy coded coefficients
  - High mean (~100-115)
  - Fischer/arithmetic coding
  
- **Stream 16**: LL (lowest level) - direct coefficients
  - Mean ~50
  - Narrow range (e.g., 21-80)
  - Can be upscaled for preview image

## Sparse Encoding

Details subbands use sparse encoding:
- Position stream: RLE with format TBD
- Value stream: Fischer probability coding

Fischer coding (from tis.exe):
- Bit-by-bit reading
- Probability table based on triangular distribution
- Expands compressed values to full subband

## Current Decoder Status

✅ **Working**: LL-only decoding
- Extracts stream 16 (LL4)
- Bilinear/Lanczos upscale to full resolution
- Produces recognizable but blurry image

❌ **TODO**: Full wavelet reconstruction
- Decode sparse subbands (streams 0-15)
- Apply inverse CDF 5/3 wavelet transform
- Sharp, detailed output

## Related Functions in tis.exe

| Address | Function |
|---------|----------|
| 0x004b5290 | ITWOpen |
| 0x004b5170 | ITWRead |
| 0x004b5350 | ITWClose |
| 0x004b5b30 | V1 decoder entry |
| 0x004b7970 | Wavelet reconstruction |
| 0x004b72b0 | Subband decoder |
| 0x004bc220 | Bit reader (N bits) |
| 0x004bc0f0 | Byte reader |
| 0x004bd1e0 | Inverse wavelet |

## Test Files

Sample: `/Users/emdzej/Documents/tis/GRAFIK/1/03/95/26.ITW`
- 316×238, 8bpp
- V1 format (0x0300)
- Compressed size: 8335 bytes
- 19 zlib streams
