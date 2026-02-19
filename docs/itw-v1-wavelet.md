# ITW V1 (0x0300) Format Documentation

## File Structure

```
Offset  Size  Description
------  ----  -----------
0       4     Magic: "ITW_"
4       2     Flags (BE)
6       2     Width (BE)
8       2     Height (BE)
10      2     Unknown
12      2     Format version: 0x0300 for V1
14      4     Compressed payload size (BE)
18      N     Compressed payload (zlib streams)
```

## Wavelet Structure

4-level CDF 5/3 wavelet decomposition:
- **Level 4** (deepest): LL4 = ~(W/16)×(H/16)
- **Level 3**: ~(W/8)×(H/8)
- **Level 2**: ~(W/4)×(H/4)
- **Level 1**: ~(W/2)×(H/2)

## Zlib Streams

Typically 19 streams in the payload:
- **S0-S15**: RLE + Fischer encoded detail coefficients (L1/L2 sparse)
- **S16**: LL4 (deepest DC coefficients, direct values)
- **S17-S18**: Additional metadata/coefficients

### Finding LL4
Stream with size matching `ceil(W/16) × ceil(H/16)` contains LL4.

## Decoding

### RLE Format (even streams)
```
b >= 128: Place coefficient, skip (b & 0x7F) + 1 positions
b < 128:  Skip b + 1 positions (no coefficient)
```

### Fischer Encoding (odd streams)
```
Mode 0 (00xxxxxx): +0 to +63
Mode 1 (01xxxxxx): -0 to -63
Mode 2 (10xxxxxx): +64 to +127
Mode 3 (11xxxxxx): -64 to -127
```

## Implementation

Two decode modes:
1. **bilinear** (default): Direct bilinear upscale from LL4 - smooth, fast
2. **cdf53**: CDF 5/3 wavelet reconstruction - LL-only pyramid

Both produce recognizable output. Full detail band reconstruction requires:
- Correct stream→subband mapping
- Quantization step dequantization (8,8,4,4,4,2,2,2,1,1,1)
- Proper subband dimension handling

## Example Usage

```bash
tisx decode image.itw              # bilinear mode
tisx decode image.itw --mode=cdf53 # CDF 5/3 mode
tisx info image.itw                # show file info
```

## Test Files

BMW TIS graphics directory: `/Users/emdzej/Documents/tis/GRAFIK/`
- Small: `1/03/95/26.ITW` (316×238, 8KB)
- Large: `1/09/87/90.ITW` (632×711, 99KB)
