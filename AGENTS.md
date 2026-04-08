# Agent Guidelines

Instructions for AI coding agents working on this codebase.

## Project Structure

pnpm + Turborepo monorepo. All packages live under `packages/`.

```
packages/rtf/       @emdzej/tisx-rtf     RTF tokenizer, parser, HTML emitter
packages/core/      @emdzej/tisx-core    Business logic, DB access (depends on rtf)
packages/web/       @emdzej/tisx-web     SvelteKit frontend (static adapter)
packages/server/    @emdzej/tisx-server  Express API server (depends on core)
```

Dependency chain: `server -> core -> rtf`. The `web` package is independent.

## Build

```sh
pnpm run build    # builds all 4 packages via Turborepo
```

Build must pass with zero errors after every change.

## Docker

The main `Dockerfile` has a multi-stage build (builder + production).

**When adding or removing a workspace package, the Dockerfile MUST be updated in both stages:**

1. **Builder stage** -- add the package's `package.json` to the cache layer AND its source directory to the source copy layer.
2. **Production stage** -- if the package is a runtime dependency, copy its `package.json` and `dist/` from the builder.

This has been a recurring source of CI failures. The workspace glob in `pnpm-workspace.yaml` auto-discovers packages locally, but the Dockerfile copies packages explicitly -- there is no automatic discovery.

## Conventions

- Package names use the `@emdzej/tisx-*` namespace
- The server is a thin Express route layer -- all business logic belongs in `core`
- The RTF renderer is a standalone library in `packages/rtf/`, not part of core
- Versions are kept in sync across all packages
- All packages use ESM (`"type": "module"`) and TypeScript
- Workspace dependencies use `"workspace:*"` in `package.json`

## Architecture Rules

### Layering

- **`rtf`** -- Zero runtime dependencies. Pure RTF-to-HTML pipeline: tokenizer -> parser -> emitter. Must stay self-contained with no database or server knowledge.
- **`core`** -- All business logic and database access. Exports service functions, never Express-specific types. The only package that touches `better-sqlite3`.
- **`server`** -- Thin Express route handlers that call `core` functions and return JSON. No business logic here. Adding a new API endpoint means adding a route in `server` that delegates to a service function in `core`.
- **`web`** -- SvelteKit SPA (static adapter with `fallback: 'index.html'`). Talks to the server via fetch to `/api/*` routes. No direct database access.

### Database

- SQLite via `better-sqlite3`, opened **read-only** with `fileMustExist: true` and 256 MB mmap.
- Database path comes from `TIS_DB_PATH` env var (default `./data/tis.sqlite`).
- Dynamic table names (e.g. `TZUKN000123`) are validated by `safeDynamicTable()` against a strict regex (`/^(TZUKN|TGRR|THGR|TKNHG)\d{6}$/`) plus an existence check. Never interpolate user input into SQL without this.
- Doc IDs map to DOCS table keys like `1/08/62/62.RTF` via `TINFO_FILE.INFO_FILENAME`.

## RTF Renderer

The custom RTF renderer in `packages/rtf/` handles TIS-specific RTF conventions that standard renderers cannot:

- **`\strike` = cross-reference hotspot**, NOT strikethrough. Rendered as `<a class="tis-cross-ref">`.
- **Hidden text (`\v`) followed by plain text** = image path pattern. The `GRAFIK` keyword identifies ITW image paths.
- **Only two fonts**: `\f0` = Helvetica, `\f1` = Symbol (bullets via `\'b7`).
- **`\cellx` values are cumulative** right-edge positions in twips from the page left margin, not individual column widths. Widths are computed as deltas.
- **`\trleft`** sets table left indent.
- **Text placeholders** (`--TYP--`, `--FGSTNR--`, `--MODELL--`, `--MOTOR--`, `--KAROSS--`) are substituted at serve time in the server, not in the RTF package.

## Frontend (Web)

- **Framework**: SvelteKit 5 with Svelte 5 runes, Tailwind CSS v4, `@tailwindcss/typography`.
- **Routing**: `/` (home), `/browse` (document tree), `/doc/[id]` (document viewer), `/symptoms` (symptom-based search).
- **State persistence**:
  - `sessionStorage`: vehicle context (`tisx-vehicle`)
  - `localStorage`: theme (`tisx-theme`), favourites (`tisx-favourites`), text size (`tisx-prose-size`), magnifier lens size (`tisx-lens-size`)
- **Svelte actions**: `imageMagnify` -- attaches magnifying lens to `.tis-inline-image` elements, activated by Alt/Option key.
- **CSS classes emitted by RTF renderer**: `tis-layout-table`, `tis-img-cell`, `tis-text-cell`, `tis-inline-image`, `tis-cross-ref`. Style these in the web package using Tailwind's `[&_.tis-*]` selector syntax.

## Server

- Express with CORS. Routes are all in `packages/server/src/index.ts`.
- All API routes are under `/api/*`. Static web assets served from the web build directory.
- SPA fallback: non-API `GET` requests fall through to `index.html`.
- Environment variables: `PORT` (default `3000`), `TIS_DB_PATH`, `WEB_BUILD_PATH`.
- Images served with `Cache-Control: public, max-age=31536000, immutable`.
- Vehicle filter query params (`?series=`, `?model=`, `?engine=`, `?body=`, `?gearbox=`) are threaded through most document and group endpoints.

## Data Pipeline

The `scripts/` directory contains a multi-step pipeline for converting proprietary BMW TIS disc data into SQLite. The `Dockerfile.prepare` and `Dockerfile.extract` are standalone containers for this purpose and are separate from the main app Dockerfile.

Pipeline steps (run by `scripts/prepare-data.sh`):
1. Extract MDB from InstallShield V3 archive (`DATA/DB.Z`)
2. Convert MDB tables to SQLite (`mdb-to-sqlite.sh`)
3. Decompress RTF docs and import as blobs (`decompress-tis-docs.sh`, `create-rtf-docs-db.sh`)
4. Convert ITW images to PNG and import as blobs (`convert-grafik.sh`, `import-images-to-sqlite.sh`)
