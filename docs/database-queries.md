# TIS Database Queries

SQL queries used by tisx to access the TIS MS Access database (converted to SQLite).

## Vehicle Selection

### Get all series (Baureihe)
```sql
SELECT DISTINCT m.BAUREIHE_ID as id, 
       b.BENENNUNG as code, 
       m.BAUREIHE_LANG as name 
FROM TFZGMODELL m 
LEFT JOIN TBENENNUNG b ON m.BAUREIHE_ID = b.KEY 
ORDER BY m.BAUREIHE_LANG;
```

### Get models by series
```sql
SELECT m.MODELL_ID as id, 
       b.BENENNUNG as code, 
       m.MODELL_LANG as name, 
       MIN(m.PRODDAT_AB) as productionFrom, 
       MAX(m.PRODDAT_BIS) as productionTo 
FROM TFZGMODELL m 
LEFT JOIN TBENENNUNG b ON m.MODELL_ID = b.KEY 
WHERE m.BAUREIHE_ID = ? 
GROUP BY m.MODELL_ID, b.BENENNUNG, m.MODELL_LANG 
ORDER BY m.MODELL_LANG;
```

### Get engines by model
```sql
SELECT DISTINCT t.MOTOR_ID as id, 
       b.BENENNUNG as name 
FROM TFZGTYP t 
LEFT JOIN TBENENNUNG b ON t.MOTOR_ID = b.KEY 
WHERE t.MODELL_ID = ? 
ORDER BY b.BENENNUNG;
```

## Document Types

### Get document type by ID
```sql
SELECT DOKART_ID as id, 
       DOKART_KZ as code, 
       DOKART_BEZ as name, 
       HGNAME as mainGroupLabel, 
       UGNAME as subGroupLabel 
FROM TDOKART 
WHERE DOKART_ID = ?;
```

### Get main document types (SI, RA, TD, AZD)
```sql
SELECT DOKART_ID as id, 
       DOKART_KZ as code, 
       DOKART_BEZ as name, 
       HGNAME as mainGroupLabel, 
       UGNAME as subGroupLabel 
FROM TDOKART 
WHERE DOKART_KZ IN ('SI','RA','TD','AZD') 
ORDER BY DOKART_SORT;
```

**Document type codes:**
- `SI` — Service Information
- `RA` — Repair Instructions (Reparaturanleitung)
- `TD` — Technical Data
- `AZD` — Work Time Data (Arbeitszeitdaten)

## Navigation Tree (Groups)

### Get root nodes (VATER_ID = -1)
```sql
-- For group tables: TZUKN000200, TZUKN000300, TZUKN000400, etc.
SELECT DISTINCT KNOTEN_ID as id, 
       KNOTEN_KZ as code, 
       KNOTEN_BEZ as name, 
       VATER_ID as parentId 
FROM TZUKN{DOKART_ID} 
WHERE VATER_ID = -1 
ORDER BY KNOTEN_SORT, KNOTEN_ID;
```

### Get child nodes
```sql
SELECT DISTINCT KNOTEN_ID as id, 
       KNOTEN_KZ as code, 
       KNOTEN_BEZ as name, 
       VATER_ID as parentId 
FROM TZUKN{DOKART_ID} 
WHERE VATER_ID = ? 
ORDER BY KNOTEN_SORT, KNOTEN_ID;
```

### Fallback: Get nodes from THGR table
```sql
-- When group table is empty, use main group table
SELECT DISTINCT t.KNOTEN_ID as id, 
       z.KNOTEN_KZ as code, 
       z.KNOTEN_BEZ as name, 
       -1 as parentId 
FROM THGR{DOKART_ID} t 
LEFT JOIN TZUWEGKNOTEN z ON z.KNOTEN_ID = t.KNOTEN_ID AND z.VATER_ID = -1 
ORDER BY t.KNOTEN_ID;
```

## Documents

### Get documents by group node
```sql
-- TGRR tables link nodes to info objects
SELECT o.INFOOBJ_ID as id, 
       o.INFOOBJ_KZ as code, 
       o.DOKART_ID as dokartId, 
       o.TITEL as title, 
       o.ERSCHDAT as publicationDate 
FROM TGRR{DOKART_ID} g 
JOIN TINFO_OBJEKT o ON g.INFOOBJ_ID = o.INFOOBJ_ID 
WHERE g.KNOTEN_ID = ? 
ORDER BY o.TITEL;
```

### Get document by ID
```sql
SELECT INFOOBJ_ID as id, 
       INFOOBJ_KZ as code, 
       DOKART_ID as dokartId, 
       TITEL as title, 
       ERSCHDAT as publicationDate, 
       SECURITY as security 
FROM TINFO_OBJEKT 
WHERE INFOOBJ_ID = ?;
```

### Get document files
```sql
SELECT INFO_FILENAME as filename, 
       DEVICETYP as deviceType, 
       DEVICEKZ as deviceCode 
FROM TINFO_FILE 
WHERE INFOOBJ_ID = ?;
```

## Content (docs.sqlite)

### Get document content
```sql
SELECT content FROM content WHERE id = ?;
```

## Table Naming Convention

| Prefix | Meaning | Example |
|--------|---------|---------|
| `T` | Table | `TDOKART` |
| `TZUKN` | Path node by doc type | `TZUKN000200` |
| `THGR` | Main group reference | `THGR000200` |
| `TGRR` | Group reference | `TGRR000200` |
| `TKNHG` | Node-to-main-group | `TKNHG000200` |

The numeric suffix (e.g., `000200`) corresponds to `DOKART_ID`:
- `000200` = SI (Service Information)
- `000300` = RA (Repair Instructions)
- `000400` = TD (Technical Data)
- etc.

## Dynamic Table Selection

```typescript
const groupTable = `TZUKN${String(dokartId).padStart(6, '0')}`;
const thgrTable = `THGR${String(dokartId).padStart(6, '0')}`;
const tgrrTable = `TGRR${String(dokartId).padStart(6, '0')}`;
```

## Relationships

```
TFZGMODELL (vehicles)
    ↓ BAUREIHE_ID → TBENENNUNG.KEY (series names)
    ↓ MODELL_ID → TBENENNUNG.KEY (model names)
    
TFZGTYP (vehicle types)
    ↓ MOTOR_ID → TBENENNUNG.KEY (engine names)
    
TDOKART (document types)
    ↓ DOKART_ID → TZUKN{ID} (navigation tree)
    ↓ DOKART_ID → THGR{ID} (main groups)
    ↓ DOKART_ID → TGRR{ID} (group-to-document links)
    
TINFO_OBJEKT (documents)
    ↓ INFOOBJ_ID → TINFO_FILE (files)
    ↓ INFOOBJ_ID → THOTSPOT (hotspots/links)
```
