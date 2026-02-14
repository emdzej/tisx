#!/bin/bash
# Decompress TIS Oracle Database Export dump
# Usage: ./decompress-tis-database.sh /path/to/tis/DATA [output_dir]

set -e

TIS_DATA_DIR="${1:?Usage: $0 /path/to/tis/DATA [output_dir]}"
OUTPUT_DIR="${2:-./tis-extracted}"

DMP_FILE="$TIS_DATA_DIR/TIS.DMP"

if [[ ! -f "$DMP_FILE" ]]; then
    echo "Error: TIS.DMP not found at $DMP_FILE"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "Decompressing TIS.DMP..."
echo "  Input:  $DMP_FILE ($(du -h "$DMP_FILE" | cut -f1))"

# TIS.DMP uses Unix compress (LZW 16-bit)
# gzip can decompress it
gzip -d < "$DMP_FILE" > "$OUTPUT_DIR/TIS.dmp"

echo "  Output: $OUTPUT_DIR/TIS.dmp ($(du -h "$OUTPUT_DIR/TIS.dmp" | cut -f1))"
echo ""
echo "Oracle Export dump info:"
head -c 200 "$OUTPUT_DIR/TIS.dmp" | strings | head -5
echo ""
echo "Done! The dump can be imported to Oracle Database using:"
echo "  imp username/password@database file=$OUTPUT_DIR/TIS.dmp full=y"
