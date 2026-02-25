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

## Docker deployment

### Docker Compose (recommended)

```bash
mkdir -p data
# Place your databases in ./data
# - ./data/tis.sqlite
# - ./data/docs.sqlite

docker compose up --build
```

The server will be available on `http://localhost:3000`.

### Docker CLI

```bash
docker build -t tisx .

docker run --rm -p 3000:3000 \
  -e PORT=3000 \
  -e TIS_DB_PATH=/data/tis.sqlite \
  -e DOCS_DB_PATH=/data/docs.sqlite \
  -v $(pwd)/data/tis.sqlite:/data/tis.sqlite \
  -v $(pwd)/data/docs.sqlite:/data/docs.sqlite \
  tisx
```

### Environment variables

- `PORT` (default: 3000)
- `TIS_DB_PATH` (default: `/data/tis.sqlite`)
- `DOCS_DB_PATH` (default: `/data/docs.sqlite`)

## License

MIT
