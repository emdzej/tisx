#!/bin/bash
# prepare-data.sh
#
# Master entrypoint for the TIS data preparation container.
# Orchestrates the full pipeline: extract → convert → import.
#
# Produces a single SQLite database containing:
#   - All TIS tables (from the MDB database)
#   - images table  (PNG blobs converted from ITW originals)
#   - content table (RTF document blobs)
#
# Usage (inside container):
#   /scripts/prepare-data.sh /source /dest
#
# Expected source structure:
#   /source/DATA/DB.Z     - InstallShield V3 archive containing the MDB database
#   /source/GRAFIK/       - ITW image files (proprietary BMW format)
#   /source/DOCS/         - Compressed RTF documentation files

set -euo pipefail

SOURCE_DIR="${1:?Usage: $0 <source_dir> <dest_dir>}"
DEST_DIR="${2:?Usage: $0 <source_dir> <dest_dir>}"

# ── Validate source ──────────────────────────────────────────────────────────

if [[ ! -d "$SOURCE_DIR" ]]; then
    echo "Error: source directory not found: $SOURCE_DIR"
    exit 1
fi

# Case-insensitive file lookup helper
find_ci() {
    local dir="$1"
    local pattern="$2"
    find "$dir" -maxdepth 1 -iname "$pattern" -print -quit 2>/dev/null
}

# Locate key paths (case-insensitive for disc variations)
DATA_DIR=$(find_ci "$SOURCE_DIR" "DATA")
GRAFIK_DIR=$(find_ci "$SOURCE_DIR" "GRAFIK")
DOCS_DIR=$(find_ci "$SOURCE_DIR" "DOCS")

if [[ -z "$DATA_DIR" ]]; then
    echo "Error: DATA directory not found under $SOURCE_DIR"
    exit 1
fi

DB_Z=$(find_ci "$DATA_DIR" "DB.Z")
if [[ -z "$DB_Z" ]]; then
    echo "Error: DB.Z not found under $DATA_DIR"
    exit 1
fi

mkdir -p "$DEST_DIR"

# Single output database
DB_FILE="$DEST_DIR/tis.sqlite"

echo "=========================================="
echo "  TIS Data Preparation Pipeline"
echo "=========================================="
echo "Source : $SOURCE_DIR"
echo "Dest   : $DEST_DIR"
echo "DB     : $DB_FILE"
echo ""

# ── Step 1: Extract MDB from InstallShield V3 archive ───────────────────────

echo "══════════════════════════════════════════"
echo "  Step 1/6: Extract MDB from DB.Z"
echo "══════════════════════════════════════════"

EXTRACT_DIR=$(mktemp -d /tmp/db-extract-XXXXXX)
unshieldv3 extract "$DB_Z" "$EXTRACT_DIR"

# Find the extracted .mdb file (case-insensitive)
MDB_FILE=$(find "$EXTRACT_DIR" -iname "*.mdb" -print -quit)
if [[ -z "$MDB_FILE" ]]; then
    echo "Error: No .mdb file found after extracting DB.Z"
    echo "Archive contents:"
    ls -lR "$EXTRACT_DIR"
    exit 1
fi

echo "Found MDB: $MDB_FILE"
echo ""

# ── Step 2: Convert MDB to SQLite ───────────────────────────────────────────

echo "══════════════════════════════════════════"
echo "  Step 2/6: Convert MDB → SQLite"
echo "══════════════════════════════════════════"

/scripts/mdb-to-sqlite.sh "$MDB_FILE" "$DB_FILE"
echo ""

# ── Step 3: Convert ITW images to PNG ────────────────────────────────────────

if [[ -n "$GRAFIK_DIR" && -d "$GRAFIK_DIR" ]]; then
    echo "══════════════════════════════════════════"
    echo "  Step 3/6: Convert ITW images → PNG"
    echo "══════════════════════════════════════════"

    IMG_DIR=$(mktemp -d /tmp/img-XXXXXX)
    /scripts/convert-grafik.sh "$GRAFIK_DIR" "$IMG_DIR"
    echo ""
else
    echo "Warning: GRAFIK directory not found, skipping image conversion."
    IMG_DIR=""
fi

# ── Step 4: Import images into SQLite ────────────────────────────────────────

if [[ -n "$IMG_DIR" && -d "$IMG_DIR" ]]; then
    echo "══════════════════════════════════════════"
    echo "  Step 4/6: Import images → SQLite"
    echo "══════════════════════════════════════════"

    /scripts/import-images-to-sqlite.sh "$IMG_DIR" "$DB_FILE"
    echo ""
else
    echo "Warning: No images to import, skipping."
fi

# ── Step 5: Decompress RTF docs ─────────────────────────────────────────────

if [[ -n "$DOCS_DIR" && -d "$DOCS_DIR" ]]; then
    echo "══════════════════════════════════════════"
    echo "  Step 5/6: Decompress RTF documentation"
    echo "══════════════════════════════════════════"

    RTF_DIR=$(mktemp -d /tmp/rtf-XXXXXX)
    /scripts/decompress-tis-docs.sh "$DOCS_DIR" "$RTF_DIR"
    echo ""
else
    echo "Warning: DOCS directory not found, skipping RTF extraction."
    RTF_DIR=""
fi

# ── Step 6: Import RTF docs into SQLite ──────────────────────────────────────

if [[ -n "$RTF_DIR" && -d "$RTF_DIR" ]]; then
    echo "══════════════════════════════════════════"
    echo "  Step 6/6: Import RTF docs → SQLite"
    echo "══════════════════════════════════════════"

    /scripts/create-rtf-docs-db.sh "$RTF_DIR" "$DB_FILE"
    echo ""
else
    echo "Warning: No RTF docs to import, skipping."
fi

# ── Cleanup ──────────────────────────────────────────────────────────────────

rm -rf "$EXTRACT_DIR"
[[ -n "${IMG_DIR:-}" ]] && rm -rf "$IMG_DIR"
[[ -n "${RTF_DIR:-}" ]] && rm -rf "$RTF_DIR"

# ── Summary ──────────────────────────────────────────────────────────────────

DB_SIZE=$(du -sh "$DB_FILE" | cut -f1)
TABLE_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")

echo "=========================================="
echo "  Pipeline Complete"
echo "=========================================="
echo ""
echo "  Database : $DB_FILE"
echo "  Size     : $DB_SIZE"
echo "  Tables   : $TABLE_COUNT"
echo ""
echo "Tables:"
sqlite3 "$DB_FILE" ".tables"
echo ""
echo "Ready for use with the tisx server."
