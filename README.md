# tisx

BMW TIS image format decompressor & tools. Supports both ITW format variants:

- **V1 (0x0300)** — Wavelet compression (CDF 7/5 biorthogonal)
- **V2 (0x0400)** — LZW + PackBits RLE compression

**Repo:** <https://github.com/emdzej/tisx>

## Install

```bash
pnpm install
pnpm run build
```

## CLI usage

```bash
# Decode ITW to raw grayscale
pnpm exec decomp-itw samples/itw_samples/34.ITW out.raw --format raw

# Decode to PGM (8bpp only)
pnpm exec decomp-itw samples/itw_samples/34.ITW out.pgm --format pgm

# Decode to PNG (8bpp only)
pnpm exec decomp-itw samples/itw_samples/34.ITW out.png --format png
```

The CLI auto-detects the format variant (V1 vs V2) and uses the appropriate decoder.

## Format support status

| Format | Type | Status |
|--------|------|--------|
| V1 (0x0300) | Wavelet | ⚠️ LL-only (low-frequency, blurry) |
| V2 (0x0400) | LZW+RLE | ✅ Full support |

V1 wavelet decoder currently extracts only the LL subband and upscales. Full wavelet reconstruction is WIP.

## ITW format notes

### V1 (0x0300) — Wavelet

- Header: 18 bytes (magic, dimensions BE, bit depth, format type, compressed size)
- Compression: 4-level CDF 7/5 biorthogonal wavelet transform
- Subbands: 13 total (LL, LH×4, HL×4, HH×4)
- Coefficient encoding: zlib-compressed streams with significance coding

See [`docs/itw-v1-wavelet.md`](docs/itw-v1-wavelet.md) for reverse engineering notes.

### V2 (0x0400) — LZW

- Header parsing and block table logic in `src/decompressors/itw-lzw.ts`
- Multi-block support with auto-detection of LZW parameters
- PackBits RLE post-processing when needed

See [`docs/itw-findings.md`](docs/itw-findings.md) for details.

## Development

```bash
pnpm run build
```

## Related

- Tracking issue: <https://github.com/emdzej/marek-workspace/issues/21>

## License

MIT
