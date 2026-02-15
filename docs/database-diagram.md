# TISX database diagram

> **Note:** This repository does not include a SQLite/MDB database file or any schema/migration files.
> The only database-related assets are helper scripts (e.g. `scripts/mdb-to-sqlite.sh`) and extraction
> helpers for the TIS data archive. Because no schema is present in-repo, a complete ER diagram
> cannot be generated yet.
>
> Once you have the source database (e.g. `tis.mdb` or a generated `tis.sqlite`), re-run the diagram
> generation based on the actual schema (`sqlite3 tis.sqlite ".schema"` or `mdb-schema`), and replace
> the placeholder diagram below with the real tables/columns/relationships.

## Mermaid ER diagram (placeholder)

```mermaid
erDiagram
    %% No schema available in-repo yet.
    %% Replace with real tables once a database file or schema is added.
```
