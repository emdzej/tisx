# ITW V1 Wavelet Format

## File Structure
```
Offset  Size  Description
0x00    4     Magic "ITW_"
0x04    2     Flags (0x0100)
0x06    2     Width (BE)
0x08    2     Height (BE)
0x0A    2     Unknown
0x0C    2     Format version (0x0300 = V1, 0x0400 = V2)
0x0E    4     Compressed size (BE)
0x12    N     Compressed payload (metadata + zlib streams)
```

## Compressed Payload
1. **Metadata block** (~77 bytes) - stream references and params
2. **Zlib streams** (19 streams for test file)

## Stream Organization
- **Stream 16**: LL4 band (lowest resolution, 20×15 for 316×238 image)
- **Streams 0-15, 17-18**: Detail bands (Fischer + RLE encoded)

## LL4 Band
- Dimensions: ceil(width/16) × ceil(height/16)
- Values: Raw bytes, needs rescaling from [min, max] to [0, 255]
- Test file range: 21-80 (mean: 49.4)

## Wavelet Transform
- **Type**: CDF 5/3 (biorthogonal, used in JPEG 2000 lossless)
- **Levels**: 4 decomposition levels
- **Lifting scheme**:
  - Predict: `d[n] = x[2n+1] - floor((x[2n] + x[2n+2])/2)`
  - Update: `s[n] = x[2n] + floor((d[n-1] + d[n] + 2)/4)`

## Quantization Steps (per subband)
```
Level  LH   HL   HH
1      8    8    8
2      4    4    4
3      2    2    2
4      1    1    1
```

## Current Decoder Status

### Working ✅
- File structure parsing
- Zlib stream extraction
- LL4 extraction and rescaling
- Bilinear upscale (produces recognizable but blurry image)

### TODO
- CDF 5/3 inverse wavelet (has artifacts without detail bands)
- Fischer decode for detail coefficients
- RLE decode for sparse coefficients
- Full reconstruction with all subbands

## Test Results
- **Bilinear upscale**: Recognizable image, blurry (best for LL-only)
- **Haar wavelet**: Blocky/pixelated
- **CDF 5/3 wavelet**: Produces lines/artifacts without detail bands
