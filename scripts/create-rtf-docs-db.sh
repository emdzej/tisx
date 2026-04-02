#!/usr/bin/env bash
set -euo pipefail

# create-docs-db.sh
#
# Usage:
#   ./scripts/create-docs-db.sh /path/to/rtf/docs
#
# Creates docs.sqlite with all .rtf files found under the provided base path.
# The database is created in the current working directory.

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/rtf/docs" >&2
  exit 1
fi

BASE_PATH="$1"

if [[ ! -d "$BASE_PATH" ]]; then
  echo "Error: base path '$BASE_PATH' is not a directory" >&2
  exit 1
fi

BASE_PATH=$(cd "$BASE_PATH" && pwd)

DB_PATH="docs-rtf.sqlite"

sqlite3 "$DB_PATH" <<'SQL'
CREATE TABLE IF NOT EXISTS content (
  id VARCHAR PRIMARY KEY,
  path VARCHAR,
  content TEXT
);
CREATE INDEX IF NOT EXISTS idx_content_id ON content(id);
CREATE INDEX IF NOT EXISTS idx_content_path ON content(path);
SQL

find "$BASE_PATH" -type f -iname "*.rtf" -print0 | while IFS= read -r -d '' FILE_PATH; do
  REL_PATH="${FILE_PATH#"$BASE_PATH"/}"
  REL_PATH_LOWER=$(echo "$REL_PATH" | tr '[:upper:]' '[:lower:]')

  DIR_PATH=$(dirname "$REL_PATH")
  if [[ "$DIR_PATH" == "." ]]; then
    DIR_PATH=""
  fi

  sqlite3 "$DB_PATH" <<SQL
.param init
.param set :id "$REL_PATH_LOWER"
.param set :path "$DIR_PATH"
.param set :file "$FILE_PATH"
INSERT INTO content (id, path, content)
VALUES (:id, :path, readfile(:file));
SQL

done
