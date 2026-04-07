import Database from 'better-sqlite3';

export type { Database as DatabaseType } from 'better-sqlite3';

/**
 * Open a read-only SQLite database connection with optimised settings.
 * Memory-maps the file for faster reads (256 MB window).
 */
export const openDatabase = (dbPath: string): Database.Database => {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  db.pragma('mmap_size = 268435456');
  return db;
};

/**
 * Validate that a table name exists in the database AND matches one of the
 * known TIS dynamic-table patterns. This prevents SQL injection via table
 * names which can't be parameterized in prepared statements.
 *
 * Allowed patterns (all uppercase, 6-digit zero-padded suffix):
 *   TZUKN{nnnnnn}, TGRR{nnnnnn}, THGR{nnnnnn}, TKNHG{nnnnnn}
 */
const SAFE_DYNAMIC_TABLE_RE = /^(TZUKN|TGRR|THGR|TKNHG)\d{6}$/;

export const safeDynamicTable = (
  db: Database.Database,
  tableName: string,
): string | null => {
  if (!SAFE_DYNAMIC_TABLE_RE.test(tableName)) {
    return null;
  }
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(tableName) as { name?: string } | undefined;
  return row?.name ?? null;
};
