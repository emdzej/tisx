#!/bin/bash
# Extract images and/or docs from a TIS SQLite database to files on disk.
#
# Usage:
#   ./extract-data.sh <mode> <database.sqlite> <output_dir>          # bulk
#   ./extract-data.sh <mode> <database.sqlite> <output_dir> <id>     # single item
#
# Modes:
#   images  - Extract from IMAGES table
#   docs    - Extract from DOCS table
#   both    - Extract both (bulk only); creates images/ and docs/ subdirs in output_dir
#
# When mode is "images" or "docs", files are exported directly into output_dir.
# When mode is "both", output_dir/images/ and output_dir/docs/ are created.
#
# When <id> is provided, only that single item is extracted.
# The "both" mode does not support single-item extraction.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

MODE="${1:?Usage: $0 <images|docs|both> <database.sqlite> <output_dir> [id]}"
DB_FILE="${2:?Usage: $0 <images|docs|both> <database.sqlite> <output_dir> [id]}"
OUTPUT_DIR="${3:?Usage: $0 <images|docs|both> <database.sqlite> <output_dir> [id]}"
ITEM_ID="${4:-}"

if [[ ! -f "$DB_FILE" ]]; then
    echo "Error: database not found: $DB_FILE" >&2
    exit 1
fi

case "$MODE" in
    images)
        "$SCRIPT_DIR/extract-images-from-sqlite.sh" "$DB_FILE" "$OUTPUT_DIR" $ITEM_ID
        ;;
    docs)
        "$SCRIPT_DIR/extract-docs-from-sqlite.sh" "$DB_FILE" "$OUTPUT_DIR" $ITEM_ID
        ;;
    both)
        if [[ -n "$ITEM_ID" ]]; then
            echo "Error: single-item extraction not supported with 'both' mode." >&2
            echo "Use 'images' or 'docs' mode instead." >&2
            exit 1
        fi
        "$SCRIPT_DIR/extract-images-from-sqlite.sh" "$DB_FILE" "$OUTPUT_DIR/images"
        "$SCRIPT_DIR/extract-docs-from-sqlite.sh" "$DB_FILE" "$OUTPUT_DIR/docs"
        ;;
    *)
        echo "Error: unknown mode '$MODE'. Use: images, docs, or both." >&2
        exit 1
        ;;
esac
