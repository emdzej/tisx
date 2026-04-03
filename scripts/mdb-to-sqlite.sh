#!/bin/bash
# Convert MDB (Microsoft Access) to SQLite
# Usage: ./mdb-to-sqlite.sh /path/to/database.mdb [output.sqlite]
#
# If the output file already exists, MDB tables are added to it (existing
# tables are left untouched).  This allows other scripts to add their own
# tables to the same database.

set -e

# Check arguments
if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <database.mdb> [output.sqlite]"
    echo "Example: $0 /path/to/tis.mdb ./tis.sqlite"
    exit 1
fi

MDB_FILE="$1"
SQLITE_FILE="${2:-${MDB_FILE%.mdb}.sqlite}"

# Check if mdb-schema exists
if ! command -v mdb-schema &> /dev/null; then
    echo "Error: mdbtools not found"
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

echo "Converting: $MDB_FILE"
echo "Output:     $SQLITE_FILE"
echo ""

# Create schema (IF NOT EXISTS makes this safe for existing databases)
echo "Creating schema..."
mdb-schema "$MDB_FILE" sqlite \
    | sed 's/CREATE TABLE/CREATE TABLE IF NOT EXISTS/g' \
    | sed 's/CREATE INDEX/CREATE INDEX IF NOT EXISTS/g' \
    | sed 's/CREATE UNIQUE INDEX/CREATE UNIQUE INDEX IF NOT EXISTS/g' \
    | sqlite3 "$SQLITE_FILE"

# Get all tables
tables=$(mdb-tables -1 "$MDB_FILE")
total=$(echo "$tables" | wc -l | tr -d ' ')
count=0

echo "Exporting $total tables..."

for table in $tables; do
    (( count++ )) || true
    printf "  [%d/%d] %s... " "$count" "$total" "$table"
    
    # Export table data as INSERT statements and import to sqlite
    mdb-export -I sqlite "$MDB_FILE" "$table" | sqlite3 "$SQLITE_FILE" 2>/dev/null || true
    
    # Get row count
    rows=$(sqlite3 "$SQLITE_FILE" "SELECT COUNT(*) FROM \"$table\"" 2>/dev/null || echo "0")
    echo "$rows rows"
done

# Get final file size
size=$(ls -lh "$SQLITE_FILE" | awk '{print $5}')

echo ""
echo "Done! $SQLITE_FILE ($size)"
