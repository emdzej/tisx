# tisx

BMW TIS image format decompressor & tools. Currently includes an ITW LZW/PackBits decompressor and a CLI to extract raw/PGM output.

**Repo:** <https://github.com/emdzej/tisx>

## Install

```bash
pnpm install
pnpm run build
```

## CLI usage

```bash
# raw output
pnpm exec decomp-itw samples/itw_samples/34.ITW out.raw

# PGM output (8bpp only)
pnpm exec decomp-itw samples/itw_samples/34.ITW out.pgm --pgm
```

## ITW format notes

- Header parsing and block table logic live in `src/decompressors/itw-lzw.ts`.
- Some ITW files contain multiple compressed blocks; the decoder auto-detects LZW parameters per-block.
- If output size doesn’t match expected, PackBits RLE post-processing is attempted.

For reverse-engineering notes and TIS disc findings, see:
- [`docs/itw-findings.md`](docs/itw-findings.md)
- Related tracking issue: <https://github.com/emdzej/marek-workspace/issues/21>

## Development

```bash
pnpm run build
```

## License

MIT
