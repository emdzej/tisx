# tisx - BMW TIS Web App

A self-deployable web application that reimplements the BMW Technical Information System (TIS) — allowing you to browse service manuals, repair instructions, and technical documents by vehicle series, model, and engine.

## Overview

The original TIS was a Windows desktop application distributed on CD/DVD. This project provides the same functionality as a modern web app you can host yourself, backed by the original TIS SQLite databases.

## Prerequisites

- The original TIS data exported to two SQLite databases:
  - `tis.sqlite` — vehicle and document index
  - `docs.sqlite` — document content (Markdown)

## Docker deployment

### Docker Compose (recommended)

```bash
mkdir -p data
# Place your databases in ./data:
#   ./data/tis.sqlite
#   ./data/docs.sqlite

docker compose up --build
```

The app will be available at `http://localhost:3000`.

### Docker CLI

```bash
docker build -t tisx .

docker run --rm -p 3000:3000 \
  -v $(pwd)/data/tis.sqlite:/data/tis.sqlite \
  -v $(pwd)/data/docs.sqlite:/data/docs.sqlite \
  tisx
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port to listen on |
| `TIS_DB_PATH` | `/data/tis.sqlite` | Path to the TIS index database |
| `DOCS_DB_PATH` | `/data/docs.sqlite` | Path to the document content database |

## Development

```bash
pnpm install
pnpm dev
```

The monorepo contains three packages:

| Package | Description |
|---------|-------------|
| `packages/web` | SvelteKit frontend |
| `packages/server` | Express API server |
| `packages/cli` | CLI utilities |

## Related

ITW image format decoding (used internally by TIS for graphics) is handled by a separate project: [itw-decoder](https://github.com/emdzej/itw-decoder).

## Right to Repair

The [Right to Repair](https://repair.eu) movement advocates for consumers' ability to fix the products they own — from electronics to vehicles — without being locked out by manufacturers through proprietary tools, paywalled documentation, or artificial restrictions.

**I build these tools because I believe repair is a fundamental right, not a privilege.**

Too often, service manuals, diagnostic software, and technical documentation are kept behind closed doors — unavailable to individuals even when they're willing to pay. This wasn't always the case. Products once shipped with schematics and repair guides as standard. The increasing complexity of modern technology doesn't change the fact that capable people exist who can — and should be allowed to — use that information.

These projects exist to preserve access to technical knowledge and ensure that owners aren't left at the mercy of vendors who may discontinue support, charge prohibitive fees, or simply refuse service.

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/)
