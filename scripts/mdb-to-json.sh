#!/bin/bash
# Export all tables from MDB to JSON files
# Usage: ./mdb-to-json.sh /path/to/database.mdb /path/to/output/

set -e

# Check arguments
if [[ $# -lt 2 ]]; then
    echo "Usage: $0 <database.mdb> <output_dir>"
    echo "Example: $0 /path/to/tis.mdb ./json-output"
    exit 1
fi

MDB_FILE="$1"
OUTPUT_DIR="$2"

# Check if mdb-json exists
if ! command -v mdb-json &> /dev/null; then
    echo "Error: mdb-json not found"
    echo "Install mdbtools:"
    echo "  macOS:  brew install mdbtools"
    echo "  Ubuntu: sudo apt install mdbtools"
    echo "  Fedora: sudo dnf install mdbtools"
    exit 1
fi

# Check if input file exists
if [[ ! -f "$MDB_FILE" ]]; then
    echo "Error: File not found: $MDB_FILE"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "Exporting tables from: $MDB_FILE"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Get all tables and export each one
tables=$(mdb-tables -1 "$MDB_FILE")
total=$(echo "$tables" | wc -l | tr -d ' ')
count=0

for table in $tables; do
    ((count++))
    echo "[$count/$total] $table..."
    mdb-json "$MDB_FILE" "$table" > "$OUTPUT_DIR/$table.json"
done

echo ""
echo "Done! Exported $count tables to $OUTPUT_DIR"
