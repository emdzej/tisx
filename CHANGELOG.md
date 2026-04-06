# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
