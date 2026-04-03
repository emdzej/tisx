#!/bin/bash
# Import images into a SQLite database, preserving relative paths as IDs.
# Usage: ./import-images-to-sqlite.sh <image_dir> <db_file>
#
# Table schema:
#   CREATE TABLE IMAGES (
#     id           TEXT PRIMARY KEY,   -- relative path uppercased, e.g. "1/03/95/26.PNG"
#     path         TEXT NOT NULL,      -- directory portion, e.g. "1/03/95"
#     content_type TEXT NOT NULL,      -- MIME type, e.g. "image/png"
#     data         BLOB NOT NULL       -- raw image bytes
#   );

set -euo pipefail

IMAGE_DIR="${1:?Usage: $0 <image_dir> <db_file>}"
DB_FILE="${2:?Usage: $0 <image_dir> <db_file>}"

# ── Validate ──────────────────────────────────────────────────────────────────

if [[ ! -d "$IMAGE_DIR" ]]; then
    echo "Error: image directory not found: $IMAGE_DIR"
    exit 1
fi

IMAGE_DIR="$(cd "$IMAGE_DIR" && pwd)"

# ── Init database ─────────────────────────────────────────────────────────────

echo "=========================================="
echo "PNG → SQLite Import"
echo "=========================================="
echo "Source : $IMAGE_DIR"
echo "DB     : $DB_FILE"
echo ""

sqlite3 "$DB_FILE" <<'SQL'
CREATE TABLE IF NOT EXISTS IMAGES (
    id           TEXT PRIMARY KEY,
    path         TEXT NOT NULL,
    content_type TEXT NOT NULL,
    data         BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_images_path ON IMAGES(path);
SQL

# ── Count total for progress indicator ───────────────────────────────────────

total=$(find "$IMAGE_DIR" -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.gif" -o -iname "*.webp" \) | wc -l | tr -d ' ')
echo "Found  : $total image files"
echo ""

# ── MIME type helper ──────────────────────────────────────────────────────────

mime_type() {
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        *.png)        echo "image/png" ;;
        *.jpg|*.jpeg) echo "image/jpeg" ;;
        *.gif)        echo "image/gif" ;;
        *.webp)       echo "image/webp" ;;
        *.bmp)        echo "image/bmp" ;;
        *.tiff|*.tif) echo "image/tiff" ;;
        *)            echo "application/octet-stream" ;;
    esac
}

# ── Build and execute batched INSERT statements ───────────────────────────────
# INSERT OR IGNORE skips rows whose id already exists (idempotent re-runs).
# readfile() reads binary data directly — no base64/escaping needed.
# Batching into transactions of BATCH_SIZE rows avoids per-row transaction overhead.

BATCH_SIZE=500
tmp_sql=$(mktemp /tmp/import-images-XXXXXX.sql)
trap 'rm -f "$tmp_sql"' EXIT

batch_count=0
total_written=0

flush_batch() {
    if [[ "$batch_count" -gt 0 ]]; then
        {
            printf 'BEGIN;\n'
            cat "$tmp_sql"
            printf 'COMMIT;\n'
        } | sqlite3 "$DB_FILE"
        total_written=$(( total_written + batch_count ))
        batch_count=0
        : > "$tmp_sql"
    fi
}

while IFS= read -r -d '' img_file; do
    rel_id="${img_file#$IMAGE_DIR/}"
    rel_id_upper=$(echo "$rel_id" | tr '[:lower:]' '[:upper:]')

    dir_path=$(dirname "$rel_id_upper")
    if [[ "$dir_path" == "." ]]; then
        dir_path=""
    fi

    # Escape single quotes in path (e.g. apostrophes in filenames)
    safe_id="${rel_id_upper//"'"/"''"}"
    safe_dir="${dir_path//"'"/"''"}"
    safe_path="${img_file//"'"/"''"}"
    ctype="$(mime_type "$img_file")"

    printf "INSERT OR IGNORE INTO IMAGES(id, path, content_type, data) VALUES('%s', '%s', '%s', readfile('%s'));\n" \
        "$safe_id" "$safe_dir" "$ctype" "$safe_path" >> "$tmp_sql"

    (( batch_count++ )) || true

    if (( batch_count % BATCH_SIZE == 0 )); then
        flush_batch
        echo "  Progress: $total_written / $total"
    fi
done < <(find "$IMAGE_DIR" -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.gif" -o -iname "*.webp" \) -print0)

flush_batch
echo "  Progress: $total_written / $total"

# ── Final stats ───────────────────────────────────────────────────────────────

db_count=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM IMAGES;")
db_size=$(du -sh "$DB_FILE" | cut -f1)

echo ""
echo "=========================================="
echo "Done."
echo "  Rows written this run : $total_written"
echo "  Total rows in DB      : $db_count"
echo "  DB size               : $db_size"
echo "=========================================="
