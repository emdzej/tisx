# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] - 2026-04-08

### Added

- **Custom RTF renderer** (`@emdzej/tisx-rtf`) — a purpose-built tokenizer, parser, and HTML emitter that natively handles all TIS-specific RTF extensions in a single pass, replacing the previous pandoc-based pipeline and eliminating the external pandoc dependency
- **Image lightbox viewer** — click any inline image to open a full-screen zoomable lightbox with dark overlay, close button, Escape key, and click-outside-to-close support
- **Magnifying glass** — hold Alt/Option while hovering over an inline image to see a 5x circular zoom lens that follows the cursor
- **Magnifier size control** in the document toolbar (S/M/L/XL presets, persisted to localStorage)
- **Document code search** — search documents by their TIS code (e.g. "21 51 500") across all document types
- **Active route highlighting** in the navigation sidebar
- **Symptoms page redesign** — pill-style tabs for symptom categories, full tree loading, and recursive tree search with auto-expand (matching children keep their parent nodes visible)
- **Toolbar tooltips** — text size and magnifier controls show descriptive tooltips on hover

### Changed

- **Table layout fidelity** — tables now use `\trleft` for left margin and `\cellx` boundaries for percentage-based column widths, matching the original TIS document layout
- **Extracted `@emdzej/tisx-core`** as a shared library package, moving business logic out of the server into a reusable core module
- **Updated RTF system documentation** to reflect the new custom renderer architecture (tokenizer → parser → emitter pipeline)

### Removed

- **Pandoc dependency** — the external pandoc binary and all pre/post-processing workarounds (font table stripping, nested table flattening, image sentinel replacement, `<del>` to cross-ref conversion) are no longer needed

### Fixed

- **Table alignment bugs** — non-table paragraphs between table rows no longer appear inside `<tbody>`; cell widths are no longer one row behind due to deferred `\trowd` emission
- **Docker build** — added `@emdzej/tisx-core` to build and production stages

## [0.1.0] - 2026-04-06

First public release. TISX reimplements the BMW Technical Information System (TIS) as a self-hosted web application, converting the original Windows desktop application and its Microsoft Access database into a modern SQLite-backed web stack.

### Added

- **Document browser** with cascading navigation through document types, main groups, and sub groups, matching the original TIS navigation hierarchy
- **Vehicle selection** by series, model, and engine with variant-aware filtering across engine, body, and gearbox dimensions
- **VIN lookup** to automatically resolve a chassis number to its full vehicle specification (series, model, engine, body, gearbox, drive type, production date)
- **Symptom-based navigation** through the original TIS complaint tree (condition and component paths) to find relevant documents
- **RTF document rendering** with server-side conversion of BMW-specific RTF documents to HTML, including embedded images and BMW RTF extensions
- **Cross-reference hotspot system** enabling clickable links between related documents, with disambiguation when a hotspot maps to multiple targets
- **Favourites system** for bookmarking vehicles and documents with custom labels, local storage persistence, and JSON export/import for backup and transfer
- **Dark mode** with light/dark theme toggle and automatic system preference detection
- **Data preparation pipeline** (Dockerized) that converts the original TIS disc contents into a single portable SQLite database: InstallShield V3 archive extraction, MDB-to-SQLite conversion, ITW-to-PNG image conversion, and RTF document decompression
- **Data extraction tools** to export images and/or documents from the SQLite database back to individual files on disk
- **Docker deployment** with multi-stage build, health checks, and single-command Docker Compose setup
- **Express API server** with 20+ endpoints covering vehicle data, document types, group hierarchy, document retrieval, symptom trees, VIN decoding, image serving, and RTF-to-HTML conversion
- **SvelteKit frontend** built with Svelte 5, Tailwind CSS 4, and static adapter for serving from the Express backend
- **Inline search/filtering** at every navigation level (groups, sub-groups, documents)
- **Comprehensive technical documentation** covering navigation architecture, RTF rendering pipeline, database schema, table reference, entity-relationship diagrams, and original SQL queries extracted via Ghidra decompilation
