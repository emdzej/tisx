#!/bin/bash
# Extract and preview TIS data files
# Usage: ./extract-tis-all.sh /path/to/tis [output_dir]

set -e

TIS_DIR="${1:?Usage: $0 /path/to/tis [output_dir]}"
OUTPUT_DIR="${2:-./tis-extracted}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "TIS Data Extraction"
echo "=========================================="
echo "TIS directory: $TIS_DIR"
echo "Output directory: $OUTPUT_DIR"
echo ""

mkdir -p "$OUTPUT_DIR"

# 1. Database
if [[ -f "$TIS_DIR/DATA/TIS.DMP" ]]; then
    echo "[1/3] Extracting database..."
    "$SCRIPT_DIR/decompress-tis-database.sh" "$TIS_DIR/DATA" "$OUTPUT_DIR/database"
    echo ""
else
    echo "[1/3] Skipping database (TIS.DMP not found)"
fi

# 2. Documentation
if [[ -d "$TIS_DIR/DOCS" ]]; then
    echo "[2/3] Extracting documentation..."
    "$SCRIPT_DIR/decompress-tis-docs.sh" "$TIS_DIR/DOCS" "$OUTPUT_DIR/docs"
    echo ""
else
    echo "[2/3] Skipping docs (DOCS directory not found)"
fi

# 3. Summary
echo "[3/3] Summary"
echo ""
echo "Directory structure:"
echo "  $OUTPUT_DIR/"
if [[ -d "$OUTPUT_DIR/database" ]]; then
    echo "  ├── database/"
    echo "  │   └── TIS.dmp (Oracle Export dump, $(du -h "$OUTPUT_DIR/database/TIS.dmp" 2>/dev/null | cut -f1 || echo '?'))"
fi
if [[ -d "$OUTPUT_DIR/docs" ]]; then
    doc_count=$(find "$OUTPUT_DIR/docs" -name "*.RTF" 2>/dev/null | wc -l | tr -d ' ')
    echo "  └── docs/"
    echo "      └── ($doc_count RTF files)"
fi
echo ""
echo "=========================================="
echo "GRAFIK (ITW images) not extracted."
echo "Use tisx CLI to convert ITW files to PNG:"
echo "  npx tisx convert /path/to/file.ITW -o output.png"
echo "=========================================="
