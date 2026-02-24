# BMW TIS Database Schema

Analysis of `tis.mdb` — the Access database powering BMW TIS (Technical Information System).

## Overview

TIS uses a hierarchical structure to organize technical documentation:

```
Vehicle Selection → Document Type → Group Navigation → Document → File
```

## Core Tables

### Vehicle Configuration

| Table | Purpose |
|-------|---------|
| `TBENENNUNG` | Dictionary/lookup table for all IDs → names |
| `TFZGTYP` | Vehicle configurations (series + model + engine + body + market) |
| `TFZGMODELL` | Detailed model info with production dates |
| `TFZGREFBR` | Vehicle reference by series |
| `TFZGREFFGNR` | Vehicle reference by VIN |

#### TBENENNUNG (Dictionary)
```csv
KEY,BENENNUNG
11006,"E30"
11007,"E31"
11010,"E36"
11013,"E46"
12072,"model_name"
13019,"engine_code"
```

#### TFZGTYP (Vehicle Types)
```csv
FZGTYP,BAUREIHE_ID,MODELL_ID,MOTOR_ID,KAROSSERIE_ID,GETRIEBE_ID,ANTRIEB_ID,AUSFRG
46657,11006,12072,13019,14004,22002,19002,"EUR"
46659,11006,12072,13019,14004,22002,19002,"USA"
```

- `BAUREIHE_ID` → Series (E30, E36, E46...)
- `MODELL_ID` → Model variant
- `MOTOR_ID` → Engine type
- `KAROSSERIE_ID` → Body style
- `GETRIEBE_ID` → Transmission
- `ANTRIEB_ID` → Drive type
- `AUSFRG` → Market (EUR, USA, ECE)

#### TFZGMODELL (Model Details)
```csv
BAUREIHE_ID,MODELL_ID,BAUREIHE_LANG,MODELL_LANG,MOTOR_ID,KAROSSERIE_ID,PRODDAT_AB,PRODDAT_BIS
11029,12225,"1' E87","130i (N52) 5-door",13049,14010,200503,200702
```

- `PRODDAT_AB` / `PRODDAT_BIS` → Production date range (YYYYMM format)

### Document Types

#### TDOKART (Document Types)
```csv
DOKART_KZ,DOKART_ID,DOKART_BEZ,HGNAME,UGNAME
"SI",100,"Service information","Main Group",""
"RA",200,"Repair instructions","Main Group","Subgroup"
"TD",300,"Technical data","Main Group","Subgroup"
"AZD",400,"Tightening torques","Main Group","Subgroup"
"ISB",1600,"Inspection sheet","",""
"SBS",1000,"SI Operating fluids","Main Group",""
"SBT",1100,"SI Techniques","Main Group",""
"IDC",1200,"SI Diagnosis Encoding","Register number",""
"SWS",1300,"SI Special tools/appliances","Register number",""
"SWZ",2100,"Special tool","Main Group",""
```

- `DOKART_KZ` → Short code (RA, TD, SI...)
- `DOKART_ID` → Numeric ID used in other tables
- `HGNAME` / `UGNAME` → Labels for main/sub group navigation

#### TZUWEG (Access Paths)
```csv
ZUWEG_ID,ZUWEG_BEZ,ZUWEG_ROOT
1,"Symptome",0
2,"Graphik",0
100,"SI",-1
101,"RA",-1
102,"TD",-1
103,"AZD",-1
```

Maps navigation paths to document types.

### Navigation Structure

#### Group Tables Pattern

For each document type (DOKART_ID), there are corresponding group tables:

| DOKART_ID | Main Groups | Subgroups |
|-----------|-------------|-----------|
| 100 (SI) | `THGR000100` | `TGRR000100` |
| 200 (RA) | `THGR000200` | `TGRR000200` |
| 300 (TD) | `THGR000300` | `TGRR000300` |
| 400 (AZD) | `THGR000400` | `TGRR000400` |

#### THGR* (Main Groups)
```csv
KNOTEN_ID,INFOOBJ_ID,SECURITY
0,20472,0
0,1001101,0
```

#### TGRR* (Subgroups)
```csv
KNOTEN_ID,INFOOBJ_ID,SECURITY
1,1006774,0
1,1015448,0
```

- `KNOTEN_ID` → Node in navigation tree
- `INFOOBJ_ID` → Link to document object
- `SECURITY` → Access level (0 = public)

#### TZUWEGKNOTEN (Navigation Tree)

Hierarchical structure linking groups to subgroups to documents.

### Document Objects

#### TINFO_OBJEKT (Document Metadata)
```csv
INFOOBJ_ID,INFOOBJ_KZ,DOKART_ID,TITEL,ERSCHDAT,SECURITY
1112093,"",100,"List of parts for the electronic battery master switch",0,0
1112095,"",100,"Removing the electronic battery master switch",0,0
1143211,"001407414",100,"Modified change intervals E9x-M3-US",700,0
```

- `INFOOBJ_ID` → Unique document identifier
- `INFOOBJ_KZ` → Document code/reference number
- `DOKART_ID` → Document type (100=SI, 200=RA, etc.)
- `TITEL` → Document title
- `ERSCHDAT` → Publication date (YYMM or 0)
- `SECURITY` → Access level

#### TINFO_FILE (File Locations)
```csv
INFOOBJ_ID,DEVICETYP,DEVICEKZ,INFO_FILENAME
20351,"CD","00","2/03/51"
20354,"CD","00","2/03/54"
```

- `DEVICETYP` → Storage device ("CD")
- `INFO_FILENAME` → Relative path to file

**File path mapping:**
```
INFO_FILENAME = "2/03/51"
→ Graphics: GRAFIK/2/03/51.ITW
→ Text:     TEXT/2/03/51.xml
```

#### TINFO_REF (Document References)
```csv
INFOOBJ_ID_V,INFOOBJ_ID_N,DOKART_ID
1036426,20351,200
22109,20360,200
```

- `INFOOBJ_ID_V` → Source document
- `INFOOBJ_ID_N` → Target document
- Links between related documents

#### THOTSPOT (Clickable Regions)
```csv
INFOOBJ_ID_V,HOTSPOT_NR,INFOOBJ_ID_N
1135048,1,20614
20848,1,20620
```

- `INFOOBJ_ID_V` → Image document containing hotspot
- `HOTSPOT_NR` → Hotspot number within image
- `INFOOBJ_ID_N` → Target document when clicked

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     1. VEHICLE SELECTION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User selects: Series → Model → Engine → Market                 │
│                                                                  │
│  TFZGMODELL: "1' E87" → "130i (N52) 5-door" (2005-2007)        │
│  TFZGTYP: BAUREIHE=11029, MODELL=12225, MOTOR=13049            │
│  TBENENNUNG: 11029 → "E87", 13049 → "N52"                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  2. DOCUMENT TYPE SELECTION                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TDOKART options:                                                │
│  ├─ SI (100)  → Service Information                             │
│  ├─ RA (200)  → Repair Instructions                             │
│  ├─ TD (300)  → Technical Data                                  │
│  └─ AZD (400) → Tightening Torques                              │
│                                                                  │
│  User selects: RA (Repair Instructions)                         │
│  → Uses THGR000200 / TGRR000200 tables                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    3. GROUP NAVIGATION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  THGR000200 (Main Groups):                                      │
│  ├─ 00 - Maintenance                                            │
│  ├─ 11 - Engine                                                 │
│  ├─ 12 - Engine Electrical                                      │
│  ├─ 13 - Fuel System                                            │
│  └─ ...                                                         │
│                                                                  │
│  User selects: 12 - Engine Electrical                           │
│                                                                  │
│  TGRR000200 (Subgroups for group 12):                           │
│  ├─ 12 00 - General                                             │
│  ├─ 12 11 - Battery                                             │
│  ├─ 12 41 - Starter                                             │
│  └─ ...                                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    4. DOCUMENT LIST                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TINFO_OBJEKT filtered by KNOTEN_ID from navigation:            │
│                                                                  │
│  INFOOBJ_ID | TITEL                                             │
│  1112093    | List of parts for battery master switch           │
│  1112095    | Removing the battery master switch                │
│  1112094    | Switching battery master switch on/off            │
│                                                                  │
│  User selects: 1112095                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    5. FILE RETRIEVAL                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TINFO_FILE lookup:                                              │
│  INFOOBJ_ID=1112095 → INFO_FILENAME="11/12/95"                  │
│                                                                  │
│  File paths:                                                     │
│  ├─ GRAFIK/11/12/95.ITW  (compressed image)                     │
│  └─ TEXT/11/12/95.xml    (document text/structure)              │
│                                                                  │
│  ITW decompression → display image                              │
│  XML parsing → display text with formatting                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    6. HOTSPOT NAVIGATION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  THOTSPOT lookup for INFOOBJ_ID_V=1112095:                      │
│  HOTSPOT_NR=1 → INFOOBJ_ID_N=20614                              │
│  HOTSPOT_NR=2 → INFOOBJ_ID_N=20615                              │
│                                                                  │
│  User clicks hotspot 1 → load document 20614                    │
│  → Back to step 5 with new INFOOBJ_ID                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure on Disk

```
TIS_DVD/
├── DATABASE/
│   └── tis.mdb              # Main database
├── GRAFIK/                  # ITW compressed images
│   ├── 0/
│   │   └── 00/
│   │       ├── 01.ITW
│   │       └── 02.ITW
│   ├── 1/
│   │   └── 03/
│   │       └── 51.ITW       # INFO_FILENAME="1/03/51"
│   └── 2/
│       └── 03/
│           └── 51.ITW       # INFO_FILENAME="2/03/51"
└── TEXT/                    # XML documents
    └── (same structure)
```

## Query Examples

### Get all documents for E46 Repair Instructions
```sql
SELECT o.INFOOBJ_ID, o.TITEL, f.INFO_FILENAME
FROM TINFO_OBJEKT o
JOIN TINFO_FILE f ON o.INFOOBJ_ID = f.INFOOBJ_ID
JOIN TGRR000200 g ON o.INFOOBJ_ID = g.INFOOBJ_ID
WHERE o.DOKART_ID = 200  -- RA (Repair Instructions)
```

### Get file path for document
```sql
SELECT 
  'GRAFIK/' || REPLACE(INFO_FILENAME, '/', '/') || '.ITW' as image_path,
  'TEXT/' || REPLACE(INFO_FILENAME, '/', '/') || '.xml' as text_path
FROM TINFO_FILE
WHERE INFOOBJ_ID = 20351
```

### Get hotspots for an image
```sql
SELECT HOTSPOT_NR, INFOOBJ_ID_N, o.TITEL
FROM THOTSPOT h
JOIN TINFO_OBJEKT o ON h.INFOOBJ_ID_N = o.INFOOBJ_ID
WHERE h.INFOOBJ_ID_V = 1135048
ORDER BY HOTSPOT_NR
```

## Related Documentation

- [ITW V1 Format](./itw-v1-format.md) — Wavelet-compressed image format
- [ITW V2 Format](./itw-v2-format.md) — LZW + RLE compressed format

## Source

Reverse engineered from `tis.mdb` (BMW TIS DVD, version ~2007-2008).
