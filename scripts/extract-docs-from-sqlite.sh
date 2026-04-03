#!/bin/bash
# Extract docs from a TIS SQLite database to files on disk.
# Recreates the directory structure based on the path column.
#
# Usage:
#   ./extract-docs-from-sqlite.sh <database.sqlite> <output_dir>           # all docs
#   ./extract-docs-from-sqlite.sh <database.sqlite> <output_dir> <id>      # single doc by ID

set -euo pipefail

DB_FILE="${1:?Usage: $0 <database.sqlite> <output_dir> [id]}"
OUTPUT_DIR="${2:?Usage: $0 <database.sqlite> <output_dir> [id]}"
ITEM_ID="${3:-}"

if [[ ! -f "$DB_FILE" ]]; then
    echo "Error: database not found: $DB_FILE" >&2
    exit 1
fi

if ! sqlite3 "$DB_FILE" "SELECT 1 FROM DOCS LIMIT 1;" &>/dev/null; then
    echo "Error: DOCS table not found in $DB_FILE" >&2
    exit 1
fi

# --- Single doc extraction ---
if [[ -n "$ITEM_ID" ]]; then
    # Uppercase the ID for lookup
    ITEM_ID=$(echo "$ITEM_ID" | tr '[:lower:]' '[:upper:]')

    path=$(sqlite3 "$DB_FILE" "SELECT path FROM DOCS WHERE id = '$ITEM_ID';")
    if [[ -z "$path" ]]; then
        echo "Error: doc not found: $ITEM_ID" >&2
        exit 1
    fi

    dest="$OUTPUT_DIR/$path"
    mkdir -p "$(dirname "$dest")"
    sqlite3 "$DB_FILE" "SELECT writefile('$dest', data) FROM DOCS WHERE id = '$ITEM_ID';" >/dev/null
    echo "Exported: $dest"
    exit 0
fi

# --- Bulk extraction ---
total=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM DOCS;")

echo "=========================================="
echo "  SQLite -> Docs Export"
echo "=========================================="
echo "DB     : $DB_FILE"
echo "Output : $OUTPUT_DIR"
echo "Total  : $total docs"
echo ""

mkdir -p "$OUTPUT_DIR"

# Pre-create all needed directories
echo "Creating directory structure..."
sqlite3 "$DB_FILE" "SELECT path FROM DOCS;" | while IFS= read -r p; do
    d=$(dirname "$p")
    [[ "$d" != "." ]] && mkdir -p "$OUTPUT_DIR/$d"
done

echo "Exporting files..."
# Use a single SELECT with writefile() — writes each BLOB to disk
sqlite3 "$DB_FILE" "SELECT writefile('${OUTPUT_DIR}/' || path, data) FROM DOCS;"

# Count actual exported files
exported=$(find "$OUTPUT_DIR" -type f | wc -l | tr -d ' ')

echo ""
echo "=========================================="
echo "Done. Exported $exported / $total docs."
echo "=========================================="
