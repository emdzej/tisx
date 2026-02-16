#!/usr/bin/env bash
set -euo pipefail

# create-docs-db.sh
#
# Usage:
#   ./scripts/create-docs-db.sh /path/to/markdown/docs
#
# Creates docs.sqlite with all .md files found under the provided base path.
# The database is created in the current working directory.

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/markdown/docs" >&2
  exit 1
fi

BASE_PATH="$1"

if [[ ! -d "$BASE_PATH" ]]; then
  echo "Error: base path '$BASE_PATH' is not a directory" >&2
  exit 1
fi

DB_PATH="docs.sqlite"

sqlite3 "$DB_PATH" <<'SQL'
CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  path TEXT,
  content TEXT
);
SQL

find "$BASE_PATH" -type f -name "*.md" -print0 | while IFS= read -r -d '' FILE_PATH; do
  REL_PATH=$(python3 - <<'PY' "$FILE_PATH" "$BASE_PATH"
import os
import sys
file_path = sys.argv[1]
base_path = sys.argv[2]
print(os.path.relpath(file_path, base_path))
PY
  )

  DIR_PATH=$(dirname "$REL_PATH")
  if [[ "$DIR_PATH" == "." ]]; then
    DIR_PATH=""
  fi

  sqlite3 "$DB_PATH" <<SQL
.param init
.param set :id $REL_PATH
.param set :path $DIR_PATH
.param set :file $FILE_PATH
INSERT INTO content (id, path, content)
VALUES (:id, :path, readfile(:file));
SQL

done
