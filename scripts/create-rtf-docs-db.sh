#!/usr/bin/env bash
set -euo pipefail

# create-rtf-docs-db.sh
#
# Usage:
#   ./scripts/create-rtf-docs-db.sh /path/to/rtf/docs [database.sqlite]
#
# Imports all .rtf files found under the provided base path into a SQLite
# database.  If the database already exists, the DOCS table is added to
# it (other tables are left untouched).
#
# The second argument is optional and defaults to "docs-rtf.sqlite" in the
# current working directory.

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /path/to/rtf/docs [database.sqlite]" >&2
  exit 1
fi

BASE_PATH="$1"
DB_PATH="${2:-docs-rtf.sqlite}"

if [[ ! -d "$BASE_PATH" ]]; then
  echo "Error: base path '$BASE_PATH' is not a directory" >&2
  exit 1
fi

BASE_PATH=$(cd "$BASE_PATH" && pwd)

echo "=========================================="
echo "RTF → SQLite Import"
echo "=========================================="
echo "Source : $BASE_PATH"
echo "DB     : $DB_PATH"
echo ""

sqlite3 "$DB_PATH" <<'SQL'
CREATE TABLE IF NOT EXISTS DOCS (
  id           TEXT PRIMARY KEY,
  path         TEXT NOT NULL,
  content_type TEXT NOT NULL,
  data         BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_docs_id ON DOCS(id);
CREATE INDEX IF NOT EXISTS idx_docs_path ON DOCS(path);
SQL

count=0

find "$BASE_PATH" -type f -iname "*.rtf" -print0 | while IFS= read -r -d '' FILE_PATH; do
  REL_PATH="${FILE_PATH#"$BASE_PATH"/}"
  REL_PATH_UPPER=$(echo "$REL_PATH" | tr '[:lower:]' '[:upper:]')

  DIR_PATH=$(dirname "$REL_PATH_UPPER")
  if [[ "$DIR_PATH" == "." ]]; then
    DIR_PATH=""
  fi

  sqlite3 "$DB_PATH" <<SQL
.param init
.param set :id "$REL_PATH_UPPER"
.param set :path "$DIR_PATH"
.param set :file "$FILE_PATH"
INSERT OR IGNORE INTO DOCS (id, path, content_type, data)
VALUES (:id, :path, 'application/rtf', readfile(:file));
SQL

  (( count++ )) || true
done

db_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM DOCS;" 2>/dev/null || echo "0")

echo ""
echo "=========================================="
echo "Done."
echo "  Total rows in DOCS table : $db_count"
echo "=========================================="
