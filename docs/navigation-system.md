# TIS Navigation System

This documents the navigation architecture used by the original BMW TIS application for browsing documents. There are **two entry paths** and **three navigation methods** depending on document type.

---

## Entry Paths

### 1. Document-Based (Primary)

User selects a document type, then drills down through a tree of groups to find documents:

```
Doc Type → Main Group → Sub Group → Documents
```

This is a **cascading list UI** — flat selectable lists that cascade, not an expand/collapse tree.

### 2. Symptom-Based

User selects a condition and component from a shared complaint tree, which maps to relevant documents:

```
Condition → Component → Documents
```

Uses the shared `tzuwegknoten` table with `zuweg_id = 1` (conditions) and `zuweg_id = 2` (components).

---

## Document Types (TDOKART)

All 10 document types in the system:

| DOKART_ID | Code | Name                            | ZUGRIFF | METHODE | FZG_REQU | Docs   | THGR rows |
|-----------|------|---------------------------------|---------|---------|----------|--------|-----------|
| 100       | SI   | Service information             | 100     | 6       | 0        | 1,238  | 666       |
| 200       | RA   | Repair instructions             | 101     | 2       | 0        | 19,433 | 41,126    |
| 300       | TD   | Technical data                  | 102     | 3       | 0        | 3,794  | 8,166     |
| 400       | AZD  | Tightening torques              | 103     | 3       | 0        | 1,120  | 2,678     |
| 1000      | SBS  | SI Operating fluids             | 105     | 6       | 0        | 123    | 21        |
| 1100      | SBT  | SI Techniques                   | 106     | 6       | 0        | 1,024  | 209       |
| 1200      | IDC  | SI Diagnosis Encoding           | 4       | 7       | 0        | 39     | 31        |
| 1300      | SWS  | SI Special tools/appliances     | 5       | 7       | 0        | 1,108  | 479       |
| 1600      | ISB  | Inspection sheet                | 108     | 5       | 1        | 5,341  | 0         |
| 2100      | SWZ  | Special tool                    | 112     | 9       | 0        | 2,021  | 2,021     |

Key fields:
- **ZUGRIFF** — Used as `ZUWEG_ID` when querying shared `tzuwegknoten` table
- **METHODE** — Determines which navigation pattern to use (see below)
- **FZG_REQU** — Whether vehicle selection is required before browsing (only ISB = 1)

---

## Navigation Methods (by METHODE)

### METHODE 2, 3 — Per-DocType Tree (RA, TD, AZD)

These types have **dedicated per-doctype tables** for tree navigation:

- **`TZUKN{id}`** — Tree nodes (e.g. `TZUKN000200` for RA)
- **`TKNHG{id}`** — Vehicle filtering for nodes (e.g. `TKNHG000200` for RA)

#### Root nodes query:
```sql
SELECT DISTINCT t.KNOTEN_ID, t.KNOTEN_KZ, t.KNOTEN_BEZ,
       t.VARIANT_ART, t.VARIANT_WERT
FROM TZUKN000200 t
LEFT JOIN TKNHG000200 k ON t.KNOTEN_ID = k.KNOTEN_ID
WHERE t.LAND_OK = 1
  AND t.VATER_ID = 0
  -- Vehicle filter (if vehicle selected):
  AND (k.BAUREIHE_ID = 0 OR k.BAUREIHE_ID = ?)
ORDER BY t.KNOTEN_KZ
```

#### Child nodes query:
```sql
SELECT DISTINCT t.KNOTEN_ID, t.KNOTEN_KZ, t.KNOTEN_BEZ,
       t.VARIANT_ART, t.VARIANT_WERT
FROM TZUKN000200 t
LEFT JOIN TKNHG000200 k ON t.KNOTEN_ID = k.KNOTEN_ID
WHERE t.LAND_OK = 1
  AND t.VATER_ID = ?
  -- Vehicle filter (if vehicle selected):
  AND (k.BAUREIHE_ID = 0 OR k.BAUREIHE_ID = ?)
ORDER BY t.KNOTEN_KZ
```

#### Table name format:
- Zero-padded 6-digit doc type ID: `TZUKN{nnnnnn}`, `TKNHG{nnnnnn}`
- Examples: `TZUKN000200` (RA), `TZUKN000300` (TD), `TZUKN000400` (AZD)

### METHODE 6, 7, 9 — Shared Tree (SI, SBS, SBT, IDC, SWS, SWZ)

These types use the **shared `tzuwegknoten` table** filtered by `ZUWEG_ID` (from TDOKART.ZUGRIFF):

#### Root nodes query:
```sql
SELECT DISTINCT t.KNOTEN_ID, t.KNOTEN_KZ, t.KNOTEN_BEZ,
       t.VARIANT_ART, t.VARIANT_WERT
FROM tzuwegknoten t
WHERE t.LAND_OK = 1
  AND t.ZUWEG_ID = ?    -- TDOKART.ZUGRIFF value
  AND t.VATER_ID = 0
ORDER BY t.KNOTEN_KZ
```

#### Child nodes query:
```sql
SELECT DISTINCT t.KNOTEN_ID, t.KNOTEN_KZ, t.KNOTEN_BEZ,
       t.VARIANT_ART, t.VARIANT_WERT
FROM tzuwegknoten t
WHERE t.LAND_OK = 1
  AND t.ZUWEG_ID = ?    -- TDOKART.ZUGRIFF value
  AND t.VATER_ID = ?
ORDER BY t.KNOTEN_KZ
```

**Note:** These types do NOT have per-doctype TZUKN tables. They also do NOT have TKNHG tables for vehicle filtering at the tree level.

### METHODE 5 — No Tree (ISB)

ISB (Inspection sheets) has `FZG_REQU = 1` — a vehicle must be selected first. There is **no tree navigation at all**. Documents are listed flat, filtered by vehicle:

```sql
SELECT d.DOKUMENT_ID, d.TITEL, d.DATUM, d.SPRACHE
FROM THGR000001600 g
JOIN tdokument d ON g.DOKUMENT_ID = d.DOKUMENT_ID
JOIN tfzgrefbr f ON d.DOKUMENT_ID = f.DOKUMENT_ID
WHERE d.LAND_OK = 1
  AND d.SECURITY = 0
  AND (f.BAUREIHE_ID = ? OR f.BAUREIHE_ID = 0)
```

---

## Document Mapping — THGR (not TGRR)

**Critical discovery**: Documents are mapped to tree nodes via `THGR{nnnnnn}` tables, NOT `TGRR{nnnnnn}`.

- **THGR** (Hauptgruppe) — Maps navigation tree node IDs → document IDs. The `KNOTEN_ID` values match the doc-type-specific navigation tree.
- **TGRR** (Gruppen-Reparatur) — Maps to the **shared symptom/complaint tree** (zuweg_id=1,2). This is a completely separate tree used by the symptom-based entry path.

#### Documents for a node:
```sql
SELECT DISTINCT d.DOKUMENT_ID, d.TITEL, d.DATUM, d.SPRACHE
FROM THGR000000200 g
JOIN tdokument d ON g.DOKUMENT_ID = d.DOKUMENT_ID
WHERE g.KNOTEN_ID = ?
  AND d.LAND_OK = 1
  AND d.SECURITY = 0
ORDER BY d.TITEL
```

#### With vehicle filtering:
```sql
SELECT DISTINCT d.DOKUMENT_ID, d.TITEL, d.DATUM, d.SPRACHE
FROM THGR000000200 g
JOIN tdokument d ON g.DOKUMENT_ID = d.DOKUMENT_ID
JOIN tfzgrefbr f ON d.DOKUMENT_ID = f.DOKUMENT_ID
WHERE g.KNOTEN_ID = ?
  AND d.LAND_OK = 1
  AND d.SECURITY = 0
  AND f.BAUREIHE_ID = ?
UNION
SELECT DISTINCT d.DOKUMENT_ID, d.TITEL, d.DATUM, d.SPRACHE
FROM THGR000000200 g
JOIN tdokument d ON g.DOKUMENT_ID = d.DOKUMENT_ID
JOIN tfzgrefbr f ON d.DOKUMENT_ID = f.DOKUMENT_ID
WHERE g.KNOTEN_ID = ?
  AND d.LAND_OK = 1
  AND d.SECURITY = 0
  AND f.BAUREIHE_ID = 0
ORDER BY TITEL
```

The UNION pattern ensures documents with `BAUREIHE_ID = 0` (all series) are always included alongside series-specific matches.

### THGR table name format:
- `THGR{nnnnnnnnn}` — 9-digit zero-padded doc type ID
- Examples: `THGR000000200` (RA), `THGR000000300` (TD)

---

## Variant System

Both `tzuwegknoten` and `TZUKN{id}` tables have `VARIANT_ART` and `VARIANT_WERT` columns that create engine/body/transmission-specific variants of tree nodes.

### Variant Types

| VARIANT_ART | Maps to TFZGTYP field | ID prefix | Examples              |
|-------------|------------------------|-----------|-----------------------|
| 0           | (none — generic node)  | 0         | Always shown          |
| 3000        | MOTOR_ID               | 13xxx     | M54, N46, M57TU      |
| 4000        | KAROSSERIE_ID          | 14xxx     | TOUR, SAL, COUPE      |
| 5000        | GETRIEBE_ID            | 22xxx     | MECH, AUT             |

- `VARIANT_WERT` is a numeric ID that resolves to a human-readable name via the `TBENENNUNG` table (`KEY` → `BENENNUNG`)
- Display format: `"{knoten_kz} {knoten_bez} ({BENENNUNG})"` when variant exists, or `"{knoten_kz} {knoten_bez}"` for generic

### Variant Filtering Logic

When a vehicle is selected, for each unique `knoten_kz` (node code):

1. **VARIANT_ART = 0** nodes always show (no variant dimension)
2. If a node has specific variant rows (VARIANT_ART > 0):
   - Check if any variant rows match the selected vehicle's MOTOR_ID / KAROSSERIE_ID / GETRIEBE_ID
   - **If matches exist** → show matching variant rows, **drop the generic** (VARIANT_WERT = 0) row
   - **If no matches exist** → show only the generic (VARIANT_WERT = 0) row
3. Variants exist at **both** main group and sub-group levels

### Vehicle → Variant ID Resolution

To perform variant filtering, the vehicle's full identity must be resolved from `TFZGTYP`:

```sql
SELECT MOTOR_ID, KAROSSERIE_ID, GETRIEBE_ID
FROM TFZGTYP
WHERE BAUREIHE_ID = ? AND MODELL_ID = ? AND MOTOR_ID = ?
```

VIN lookup already resolves the full FZGTYP record (all fields). Manual vehicle selection (series → model → engine cascade) gives us MOTOR_ID directly; KAROSSERIE_ID and GETRIEBE_ID need to be resolved from TFZGTYP.

### Variant Impact on Document Listing

When a variant-specific node is selected (e.g. "11 Engine (M54)" with VARIANT_ART=3000, VARIANT_WERT=13037):

- Query THGR for `KNOTEN_ID = 11` (the base node ID, shared across variants)
- Apply additional vehicle filtering via TFZGREFBR with `MOTOR_ID = 13037`

The variant info determines which TFZGREFBR column to filter on:
- VARIANT_ART 3000 → filter TFZGREFBR by MOTOR_ID
- VARIANT_ART 4000 → filter TFZGREFBR by KAROSSERIE_ID
- VARIANT_ART 5000 → filter TFZGREFBR by GETRIEBE_ID

---

## Dynamic Table Names

The database uses dynamically-named tables with zero-padded numeric suffixes:

| Pattern           | Padding | Example             | Purpose                              |
|-------------------|---------|---------------------|--------------------------------------|
| `TZUKN{nnnnnn}`   | 6 digit | `TZUKN000200`       | Per-doctype tree nodes               |
| `TKNHG{nnnnnn}`   | 6 digit | `TKNHG000200`       | Per-doctype vehicle filter for nodes |
| `THGR{nnnnnnnnn}` | 9 digit | `THGR000000200`     | Per-doctype node → document mapping  |
| `TGRR{nnnnnnnnn}` | 9 digit | `TGRR000000200`     | Symptom tree → document mapping      |

**Security note**: Dynamic table names cannot be parameterized in prepared statements. Use `safeDynamicTable()` — strict regex allowlist + `sqlite_master` existence check before string interpolation.

---

## Original TIS SQL Patterns (from Ghidra reverse-engineering)

The original TIS application uses this query pattern for the shared `tzuwegknoten` navigation:

```sql
SELECT DISTINCT t.knoten_id, t.knoten_bez, t.zuweg_id,
       t.vater_id, t.knoten_kz, t.land_ok,
       t.variant_art, t.variant_wert
FROM tzuwegknoten t [, TKNHG{dokart_id} k]
WHERE t.land_ok = 1
  AND t.zuweg_id = ?
  AND t.vater_id = ?
  [AND k.zuweg_id = ? AND t.knoten_id = k.knoten_id AND k.baureihe_id = 0]
```

For per-doctype tables, the pattern is similar but queries `TZUKN{id}` instead.

---

## VIN Decoding

BMW VINs are 17 characters. The last 7 characters encode the production sequence:

```
VIN[10:12] → BEREICH = base36_decode(2 chars)
VIN[12:17] → FGSTNR  = base36_decode(5 chars)
```

Lookup: `TFGSTNRK WHERE BEREICH = ? AND FGSTNR = ?` → returns `FZGTYP_ID` → join to `TFZGTYP` for full vehicle identity (BAUREIHE_ID, MODELL_ID, MOTOR_ID, KAROSSERIE_ID, GETRIEBE_ID, ANTRIEB_ID).

---

## RTF Document Rendering

See [rtf-system.md](./rtf-system.md) for comprehensive documentation of the RTF rendering pipeline, BMW-specific RTF extensions (`\v` hidden text for images, `\strike` for cross-reference hotspots), the `THOTSPOT` positional link system, and the font table leak fix.
