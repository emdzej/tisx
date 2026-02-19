# tisx - TIS Image Format Decoder

Decoder for BMW TIS (Technical Information System) image formats.

## Supported Formats

| Format | Magic | Status |
|--------|-------|--------|
| ITW V1 | 0x0300 | ✅ Working (LL-only, blurry) |
| ITW V2 | 0x0400 | 🔄 Planned |

## Installation

```bash
npm install -g tisx
```

## Usage

```bash
# Show file info
tisx info image.itw

# Decode to PNG
tisx decode image.itw
tisx decode image.itw output.png
```

## ITW V1 Format

The ITW V1 format uses wavelet compression with CDF 5/3 transform:
- 4 decomposition levels
- Stream 16 contains LL4 (lowest resolution low-pass band)
- Detail streams use zigzag encoding
- Current decoder uses bilinear upscale from LL4

### Output Quality

The current decoder produces **blurry but recognizable** images.
Full quality requires decoding detail bands (work in progress).

## Documentation

See `docs/` for detailed format documentation:
- `itw-v1-wavelet.md` - File structure and wavelet format
- `itw-v1-decompiled.md` - Reverse engineering notes

## License

MIT
