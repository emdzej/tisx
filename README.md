# TISX

A self-deployable web application that reimplements the BMW Technical Information System (TIS). Browse service manuals, repair instructions, wiring diagrams, and technical documents by vehicle series, model, and engine -- all from a modern web interface you can host yourself.

The original TIS was a Windows desktop application distributed on CD/DVD, backed by a Microsoft Access database. TISX converts that data into a single SQLite file and serves it through an Express API and SvelteKit frontend, preserving the full document hierarchy, cross-reference system, and image assets from the original.

## Features

- **Document browser** -- cascading navigation through document types, main groups, and sub groups with inline search/filtering at every level
- **Vehicle selection** -- choose series, model, and engine to filter documents to your specific vehicle; variant-aware filtering across engine, body, and gearbox dimensions
- **VIN lookup** -- decode a chassis number to automatically resolve series, model, engine, body, gearbox, drive type, and production date
- **Symptom-based navigation** -- browse documents by condition and component through the original TIS complaint tree
- **RTF document rendering** -- server-side conversion of original TIS RTF documents (with BMW-specific extensions) to HTML, including embedded images and cross-reference hotspot links
- **Cross-reference hotspots** -- clickable links within documents that navigate to related documents, with disambiguation when multiple targets exist
- **Favourites** -- bookmark vehicles and documents with optional labels; persisted to local storage with JSON export/import
- **Dark mode** -- light and dark themes with system preference detection
- **Docker deployment** -- multi-stage Docker build with health checks; single `docker compose up` to run
- **Data pipeline** -- automated conversion of original TIS disc contents (InstallShield archive, MDB database, ITW images, compressed RTF docs) into a single portable SQLite database
- **Data extraction** -- extract images and/or documents back out of the database to files on disk

## Documentation

Detailed technical documentation is available in the [`docs/`](docs/) directory:

| Document | Description |
|----------|-------------|
| [Navigation System](docs/navigation-system.md) | Architecture of the document and symptom-based navigation, entry paths, and group hierarchy |
| [RTF System](docs/rtf-system.md) | RTF rendering pipeline, BMW-specific RTF extensions, hotspot cross-references, and image embedding |
| [Database Schema](docs/tis-database-schema.md) | Original TIS database schema (tables, columns, relationships) |
| [Database Tables](docs/database-tables.md) | Detailed column-level reference for every table with English translations |
| [Database Diagram](docs/database-diagram.md) | Entity-relationship diagram (Mermaid) |
| [Database Queries](docs/database-queries.md) | SQL queries extracted from the original `tis.exe` binary via Ghidra decompilation |

## Prerequisites

- The original TIS disc or a copy of its contents (containing `DATA/DB.Z`, `GRAFIK/`, and `DOCS/` directories)
- Docker

## Data preparation

Before running the web app you need to convert the original TIS disc data into a SQLite database. A dedicated Docker image handles the entire pipeline:

1. Extracts the MDB database from the InstallShield V3 archive (`DATA/DB.Z`)
2. Converts the MDB database to SQLite
3. Converts ITW images to PNG and imports them into the database
4. Decompresses RTF documentation and imports it into the database

### Build the preparation image

```bash
docker build -f Dockerfile.prepare -t tisx-prepare .
```

### Run the preparation pipeline

```bash
docker run --rm \
  -v /path/to/tis-disc:/source:ro \
  -v /path/to/output:/dest \
  tisx-prepare /source /dest
```

- `/path/to/tis-disc` -- root of the original TIS disc (must contain `DATA/`, `GRAFIK/`, `DOCS/`)
- `/path/to/output` -- directory where `tis.sqlite` will be written

This produces a single `tis.sqlite` database containing all TIS tables, images (`IMAGES` table), and documents (`DOCS` table).

Images and docs are stored as BLOBs in the database rather than as individual files -- copying one database file is significantly faster than transferring tens of thousands of small files, and eliminates filesystem overhead when deploying.

## Data extraction

If you need to extract images or documents back out of the database to files on disk, use the extraction container:

### Build the extraction image

```bash
docker build -f Dockerfile.extract -t tisx-extract .
```

### Extract images only

```bash
docker run --rm \
  -v /path/to/tis.sqlite:/data/tis.sqlite:ro \
  -v /path/to/output:/output \
  tisx-extract images
```

### Extract docs only

```bash
docker run --rm \
  -v /path/to/tis.sqlite:/data/tis.sqlite:ro \
  -v /path/to/output:/output \
  tisx-extract docs
```

### Extract both images and docs

```bash
docker run --rm \
  -v /path/to/tis.sqlite:/data/tis.sqlite:ro \
  -v /path/to/output:/output \
  tisx-extract both
```

When extracting both, the output directory will contain `images/` and `docs/` subdirectories. When extracting a single type, files are written directly to the output directory, preserving the original directory structure.

### Extract a single item by ID

```bash
# Single image
docker run --rm \
  -v /path/to/tis.sqlite:/data/tis.sqlite:ro \
  -v /path/to/output:/output \
  tisx-extract images /data/tis.sqlite /output 26.PNG

# Single doc
docker run --rm \
  -v /path/to/tis.sqlite:/data/tis.sqlite:ro \
  -v /path/to/output:/output \
  tisx-extract docs /data/tis.sqlite /output 15.RTF
```

The ID is case-insensitive. The file is written to `<output_dir>/<path>`, preserving the original directory structure.

## Docker deployment

### Docker Compose (recommended)

```bash
mkdir -p data
# Place your tis.sqlite (from the preparation step) in ./data/

docker compose up --build
```

The app will be available at `http://localhost:3000`.

### Docker CLI

```bash
docker build -t tisx .

docker run --rm -p 3000:3000 \
  -v $(pwd)/data/tis.sqlite:/data/tis.sqlite \
  tisx
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port to listen on |
| `TIS_DB_PATH` | `/data/tis.sqlite` | Path to the TIS SQLite database |

## Development

```bash
pnpm install
pnpm dev
```

The monorepo contains two packages:

| Package | Description |
|---------|-------------|
| `packages/web` | SvelteKit frontend |
| `packages/server` | Express API server |

## Tech stack

- **Frontend** -- SvelteKit 2, Svelte 5, Tailwind CSS 4
- **Backend** -- Express, better-sqlite3
- **Build** -- Turborepo, pnpm workspaces, Vite
- **Infrastructure** -- Docker (multi-stage), Docker Compose

## Related

ITW image format decoding (used internally by TIS for graphics) is handled by a separate project: [itw-decoder](https://github.com/emdzej/itw-decoder).

## Legal Notice

**This project does not include any BMW copyrighted data.**

The original TIS (Technical Information System) contents — including service manuals, repair instructions, wiring diagrams, technical documents, and images — are the intellectual property of BMW AG and are protected by copyright.

To use this application, you must obtain your own legitimate copy of the original TIS data. This project provides only the tools to convert, serve, and browse that data — it does not distribute the data itself.

## Right to Repair

The [Right to Repair](https://repair.eu) movement advocates for consumers' ability to fix the products they own -- from electronics to vehicles -- without being locked out by manufacturers through proprietary tools, paywalled documentation, or artificial restrictions.

**I build these tools because I believe repair is a fundamental right, not a privilege.**

Too often, service manuals, diagnostic software, and technical documentation are kept behind closed doors -- unavailable to individuals even when they're willing to pay. This wasn't always the case. Products once shipped with schematics and repair guides as standard. The increasing complexity of modern technology doesn't change the fact that capable people exist who can -- and should be allowed to -- use that information.

These projects exist to preserve access to technical knowledge and ensure that owners aren't left at the mercy of vendors who may discontinue support, charge prohibitive fees, or simply refuse service.

## Support

If you find this project useful, consider [buying me a coffee](https://buymeacoffee.com/emdzej) ☕ or [sponsoring on GitHub](https://github.com/sponsors/emdzej).

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/)
