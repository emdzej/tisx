# TIS.EXE SQL Queries — Ghidra Extraction

Extracted from `tis.exe` binary via Ghidra decompilation. All queries use ODBC (Microsoft Access/Jet 3.0).

## Source Code Architecture

RCS headers embedded in the binary reveal the original source structure:

```
P:/bmw95/src/
├── tis95/
│   ├── TisApp/Windows/tis95.cpp           # Main application entry
│   ├── TisFrame/
│   │   ├── TisFrame.cxx                   # Main frame
│   │   ├── Windows/WTisframe.cxx          # Windows frame impl
│   │   ├── InspektPopup.cxx               # Inspection popup
│   │   ├── PasswordPopup.cxx              # Password dialog
│   │   ├── TisMessagePopup.cxx            # Message popup
│   │   └── Windows/WStateLine.cxx         # Status bar
│   ├── TisControl/                        # UI Controllers
│   │   ├── TStart.cxx                     # Startup
│   │   ├── TisDefaults.cxx                # Default settings
│   │   ├── TAnzeige.cxx                   # Display controller
│   │   ├── TThemen.cxx                    # Topics/themes
│   │   ├── TGrafik.cxx                    # Graphics
│   │   ├── TGraRoot.cxx                   # Graphics root
│   │   ├── TDoku.cxx                      # Document controller
│   │   ├── TFehler.cxx                    # Error handling
│   │   ├── TFzId.cxx                      # Vehicle ID
│   │   ├── TLesez.cxx                     # Reading list
│   │   ├── TAktNews.cxx                   # News
│   │   ├── TVerbund.cxx                   # Linked docs
│   │   ├── StTL.cxx                       # Topic list
│   │   ├── StHelp.cxx                     # Help
│   │   ├── StShow.cxx                     # Show/display
│   │   └── StObjects.h                    # Shared objects
│   ├── TisMasks/                          # UI Panels
│   │   ├── Stamask.cxx / WStamask.cxx     # Start mask
│   │   ├── Fidmask.cxx / WFidmask.cxx     # Vehicle ID mask
│   │   ├── Rtfmask.cxx / WRtfmask.cxx     # RTF document mask
│   │   ├── Dokartmask.cxx / WDokartmask.cxx # Doc type mask
│   │   ├── Themmask.cxx                   # Theme/topic mask
│   │   ├── Symmask.cxx / WSymmask.cxx     # Symbol mask
│   │   ├── Dokmask.cxx / WDokmask.cxx     # Document mask
│   │   ├── Lesezmask.cxx / WLesezmask.cxx # Reading list mask
│   │   ├── Aktnewsmask.cxx / WAktnewsmask.cxx # News mask
│   │   ├── Verbundmask.cxx               # Linked docs mask
│   │   └── WHelpPopup.cxx                # Help popup
│   ├── TisDBControl/                      # DB State Management
│   │   ├── DBSt.h                         # DB state header
│   │   ├── DB_fill.cxx                    # Fill operations
│   │   ├── DB_prepare.cxx                 # Prepare operations
│   │   └── DB_copy.cxx                    # Copy operations
│   └── batchtis/                          # Batch Processing
│       ├── inspekt.cxx                    # Inspection
│       ├── iload.cxx                      # Data loading
│       └── idbase.cxx                     # Database ops
├── Database/
│   ├── DB_Tis.cxx / DB_Tis.h             # TIS-specific queries
│   ├── DB_Rahmen.cxx                      # Framework queries
│   ├── DB_CO_Cursor.cxx                   # Cursor operations
│   ├── DB_Cursor.cxx                      # Cursor base
│   ├── DB_struct.h                        # DB structures
│   ├── DB_defines.h                       # DB defines
│   └── WinODBC/WinODBCFactory.cxx         # ODBC factory
├── Common/
│   ├── hs/                                # HyperSystem (doc rendering)
│   │   ├── RTFHyperDoc.cxx                # RTF renderer
│   │   ├── bmwRTFHyperDoc.cxx             # BMW RTF customization
│   │   ├── TiffHyperDoc.cxx              # TIFF renderer
│   │   ├── HyperDoc.cxx                  # Base renderer
│   │   ├── HSDoc.cxx / HSNode.cxx        # Doc/node hierarchy
│   │   ├── HSParser.cxx                  # Parser
│   │   └── ZoomImage.cxx                 # Image zoom
│   ├── rtf/                               # RTF Engine
│   │   ├── RTFLayout.cpp                  # Layout
│   │   ├── RTFParser.cpp                  # Parser
│   │   ├── RTFObjects.cpp                 # Objects
│   │   ├── RTFFormat.cpp                  # Formatting
│   │   └── RTFPrinting.cxx               # Printing
│   ├── Graphics/                          # Graphics Engine
│   │   ├── GrTypes.cxx                    # Types
│   │   ├── WGrStructs.cxx                # Structures
│   │   ├── WGrCanvas.cxx                 # Canvas
│   │   └── Raster.cxx                    # Raster ops
│   ├── ui/                                # UI Widgets
│   │   ├── Windows/WFrame.cxx             # Frame
│   │   ├── Windows/WMultiLineButton.cxx   # Buttons
│   │   ├── Windows/CEtkTable.cxx          # ETK Table widget
│   │   ├── Windows/CField.cxx            # Input fields
│   │   └── SetTimerCB.cxx                # Timer callbacks
│   └── Basics/
│       ├── BULogger.cxx                   # Logging
│       ├── EnvConfig.cxx                  # Config
│       ├── compress.cxx                   # Compression
│       └── FileMagic.cxx                  # File type detection
└── Sysadm95/Lib/Windows/
    ├── InitDataSource.cxx                 # Data source init
    ├── AccessODBCSource.cxx               # MS Access ODBC
    ├── IntersolvODBCSource.cxx            # Intersolv ODBC
    ├── OracleODBCSource.cxx               # Oracle ODBC
    └── inifile.cxx                        # INI file handler
```

## UI Flow

### 1. Application Startup

```
tis95.cpp → InitInstance()
  → DBStartUp()                    # Init ODBC, SQLAllocEnv
  → TStart.cxx                     # Load startup config
    → TisDefaults.cxx              # Read defaults from tisapp.ini
    → Load labels (SELECT key, benennung FROM tbenennung)
    → Load doc types (SELECT dokart_id, dokart_kz FROM tdokart WHERE land_ok = 1)
  → TisFrame.cxx → WTisframe.cxx  # Create main window
    → StateLine                    # Status bar
    → Stamask (Start mask)         # Initial UI panel
```

### 2. Vehicle Selection (Fidmask)

User selects vehicle via series → model → engine cascade:

```
Fidmask.cxx
  ├── TISPFzgId2Br()    → Select series (Baureihe)
  ├── TISPFzgId2Mod()   → Select model by series
  ├── TISPFzgId2Jahr()  → Select production year range
  └── TISFgstNr2FzgId() → OR enter chassis number (FIN/VIN)
```

### 3. Document Type Selection (Dokartmask)

After vehicle selection, choose document type:

```
Dokartmask.cxx
  → TIS_MinDA()         → Get default (minimum sort) doc type
  → Load all doc types   → Filtered by vehicle + land_ok + security
```

### 4. Navigation Tree (Themmask / Symmask)

Browse topics within selected doc type:

```
Themmask.cxx / Symmask.cxx
  ├── TISZuWeg()              → Get navigation paths (Zuweg)
  ├── TISKnoten2Knoten()      → Get child nodes in tree
  ├── TISKnoten() (abs)       → Get absolute node details
  └── TIS_IOGrafik()          → Check if nodes have graphics
```

### 5. Document List (Dokmask)

View documents for selected node:

```
Dokmask.cxx
  ├── TISInfObj()             → Get info objects (documents)
  ├── TISHotspot2InfObj()     → Get hotspot-linked documents
  ├── Document files           → Get associated files
  └── TIS_IOvsFZG()           → Validate doc against vehicle
```

### 6. Document Display (Rtfmask)

View document content:

```
Rtfmask.cxx
  ├── Load RTF content from file system
  ├── bmwRTFHyperDoc.cxx      → Render RTF with BMW extensions
  │   ├── Placeholder substitution (--TYP--, --FGSTNR--, etc.)
  │   └── GRAFIK references → image lookup
  └── TISHotspot2InfObj()     → Resolve hyperlinks to other docs
```

### 7. Linked Documents (Verbundmask)

Navigate to related documents:

```
Verbundmask.cxx / TVerbund.cxx
  ├── TIS_VerbundVsFZG()      → Check linked docs against vehicle
  ├── Load linked doc types    → INSERT INTO temp SELECT FROM tinfo_ref
  └── Browse linked documents
```

### 8. News (Aktnewsmask)

View current news:

```
Aktnewsmask.cxx / TAktNews.cxx
  → Load news items from tnews + tinfo_objekt
```

### 9. Vehicle Actions (via chassis number)

```
TFzId.cxx
  → Vehicle actions (tfzg_aktion + tfzgreffgnr)
```

### 10. Reading List (Lesezmask)

```
Lesezmask.cxx / TLesez.cxx
  → Bookmarked documents for reading
```

---

## All Extracted SQL Queries

### Startup / Initialization

```sql
-- Load all label translations
SELECT key, benennung FROM tbenennung

-- Load available document types
SELECT dokart_id, dokart_kz FROM tdokart WHERE land_ok = 1

-- Get default (first) document type
SELECT dokart_id, dokart_bez, dokart_kz FROM tdokart
WHERE dokart_sort = (SELECT Min(dokart_sort) FROM tdokart WHERE land_ok = 1 AND security = 0)
```

### Vehicle Identification

#### TISFgstNr2FzgId — Chassis Number Lookup
```sql
-- Lookup vehicle type by chassis number range
SELECT fzgtyp, proddat FROM tfgstnrk
WHERE bereich = ? AND fgstnrab <= ? AND fgstnrbis >= ?

-- Resolve vehicle type to components
SELECT t.baureihe_id, t.modell_id, t.motor_id, t.karosserie_id, t.getriebe_id, t.ausfrg
FROM tfzgtyp t WHERE t.fzgtyp = ?

-- Without specific type (generic):
SELECT t.baureihe_id, t.modell_id, t.motor_id, t.karosserie_id, t.getriebe_id, t.ausfrg
FROM tfzgtyp t WHERE t.fzgtyp = 0

-- Get lead type for vehicle
SELECT leittyp FROM tleittyp WHERE fzgtyp = ?

-- Get vehicle type details
SELECT baureihe_id, modell_id, motor_id, karosserie_id, getriebe_id FROM tfzgtyp
WHERE t.fzgtyp = ?
```

#### TISPFzgId2Br — Series Selection
```sql
-- Basic series list:
SELECT DISTINCT t.baureihe_lang, t.baureihe_id FROM tfzgmodell t
  [, tfzgrefbr r]
  WHERE r.baureihe_id = t.baureihe_id AND r.modell_id = t.modell_id
    AND r.motor_id = t.motor_id AND t.karosserie_id = r.karosserie_id
    AND r.infoobj_id = s.infoobj_id

-- With document type filter:
SELECT DISTINCT t.baureihe_lang, t.baureihe_id FROM tfzgmodell t, tfzgrefbr_da s
  WHERE s.dokart_id = ? AND t.baureihe_id = s.baureihe_id

-- Combined with UNION for generic (baureihe_id = 0) entries:
... UNION SELECT DISTINCT t.baureihe_lang, t.baureihe_id FROM tfzgmodell t, tfzgrefbr_da s
  WHERE s.dokart_id = ? AND s.baureihe_id = 0

ORDER BY 1
```

#### TISPFzgId2Mod — Model Selection
```sql
SELECT DISTINCT t.modell_id, t.motor_id, t.karosserie_id, t.modell_lang FROM tfzgmodell t
  [... with vehicle/document type filters]
ORDER BY 4
```

#### TISPFzgId2Jahr — Production Year Range
```sql
SELECT DISTINCT t.proddat_ab, t.proddat_bis FROM tfzgmodell t
  [... with filters]
```

### Document Types

#### Full Document Type Details
```sql
SELECT DISTINCT r.dokart_id, r.dokart_kz, r.dokart_bez, r.hgname, r.ugname, r.zugriff,
  r.methode, r.key_length, r.min_length, r.security, r.fzg_requ, r.druck_typ, r.leittyp,
  r.dokart_sort
FROM tdokart r
  [, tfzgrefbr_da t WHERE r.dokart_id = t.dokart_id AND (t.baureihe_id = 0 OR (...))]
  [, tgrrefall_da s WHERE s.dokart_id = r.dokart_id AND s.knoten_id = ?]
  [, tgrrefall_da s, tfzgrefbr_da t WHERE s.dokart_id = r.dokart_id
      AND s.dokart_id = t.dokart_id AND s.knoten_id = ? AND (s.baureihe_id = 0 OR (...))]
  [AND s.security = 0 AND r.security = 0]
ORDER BY 14
```

#### Document Type by ID
```sql
SELECT dokart_kz, dokart_bez, hgname, ugname, zugriff, methode,
  key_length, min_length, security, fzg_requ, druck_typ, leittyp
FROM tdokart WHERE dokart_id = ?
```

#### Simple Lookups
```sql
SELECT dokart_kz, dokart_bez FROM tdokart WHERE dokart_id = ?

SELECT dokart_id, dokart_kz FROM tdokart WHERE land_ok = 1
```

#### Available Types for Node
```sql
SELECT DISTINCT t.dokart_id, s.dokart_kz, s.dokart_bez, s.dokart_sort
FROM [dynamic_table] t, tdokart s
WHERE t.dokart_id = s.dokart_id AND s.land_ok = 1
```

### Navigation

#### TISZuWeg — Navigation Paths
```sql
-- All paths:
SELECT zuweg_id, zuweg_bez, zuweg_root, zuweg_sort
FROM tzuweg WHERE land_ok = 1 ORDER BY zuweg_sort

-- Specific path:
SELECT DISTINCT zuweg_bez, zuweg_root FROM tzuweg WHERE zuweg_id = ?
```

#### TISKnoten2Knoten — Tree Nodes
```sql
-- Get child nodes for a parent in navigation tree:
SELECT DISTINCT t.knoten_id, t.knoten_bez, t.zuweg_id, t.knoten_help,
  t.knoten_graph, t.vater_id, t.variant_art, t.variant_wert, t.knoten_kz, t.knoten_sort
FROM tzuwegknoten t
  [, TKNHG{dokart_id} k]
WHERE t.land_ok = 1 AND t.zuweg_id = ? AND t.vater_id = ?
  [AND k.zuweg_id = ? AND t.knoten_id = k.knoten_id AND k.baureihe_id = 0]
  [AND t.variant_wert = 0]

-- UNION with variant for broader results:
UNION SELECT DISTINCT t.knoten_id, t.knoten_bez, t.zuweg_id, t.knoten_help, t.knoten_graph,
  t.vater_id, t.variant_art, t.variant_wert, t.knoten_kz, t.knoten_sort
FROM tzuwegknoten t
  [, TKNHG{dokart_id} k]
WHERE t.land_ok = 1 AND t.zuweg_id = ? AND k.zuweg_id = ? AND t.vater_id = ?
  AND t.knoten_id = k.knoten_id AND k.baureihe_id = 0
ORDER BY 10
```

#### TISKnoten (absolute) — Node Details
```sql
SELECT knoten_bez, knoten_help, knoten_graph, variant_art, knoten_kz, knoten_sort
FROM tzuwegknoten
WHERE zuweg_id = ? AND knoten_id = ? AND vater_id = ? AND variant_wert = ?
```

#### TISKnoten — Node with Cross-Reference
```sql
SELECT knoten_bez, knoten_help, knoten_graph, variant_art, knoten_kz
FROM tzuwegknoten t
  [, TKNHG{dokart_id} k]
WHERE t.zuweg_id = ? AND k.zuweg_id = ? AND t.knoten_id = ? AND k.knoten_id = ?
  [WHERE t.land_ok = 1 AND t.zuweg_id = ? AND t.knoten_id = ?]
ORDER BY 8
```

### Documents / Info Objects

#### TISInfObj — Document List
```sql
-- Documents for a node, filtered by vehicle:
SELECT DISTINCT t.infoobj_id, t.titel, t.dokart_id, t.infoobj_kz,
  t.infoobj_sort, t.erschdat, t.security
FROM tinfo_objekt t
  [, tfzgrefbr s]
WHERE t.land_ok = 1
  [AND t.infoobj_id = s.infoobj_id AND s.baureihe_id = 0]
  [AND t.das_index = ?]
  [AND t.das_objekt = ?]
  [AND t.das_dokuart = ?]
  [AND t.security = 0]
  [AND t.dokart_id = ?]
  [AND s.leittyp = ?]
  AND t.infoobj_id = s.infoobj_id

-- UNION for generic (baureihe_id = 0) fallback:
UNION SELECT t.infoobj_id, t.titel, t.dokart_id,
  t.infoobj_kz, t.infoobj_sort, t.erschdat, t.security
FROM tinfo_objekt t, tfzgrefbr s
  WHERE t.land_ok = 1 AND t.infoobj_id = s.infoobj_id AND s.baureihe_id = 0
ORDER BY 5
```

#### TISInfObj (absolute) — Document by ID
```sql
SELECT DISTINCT titel, dokart_id, infoobj_kz, erschdat, security
FROM tinfo_objekt WHERE infoobj_id = ?
```

#### Document Files
```sql
SELECT DISTINCT info_filename, devicetyp FROM tinfo_file WHERE infoobj_id = ?
```

### Vehicle-Document Validation

#### TIS_IOvsFZG — Does Document Apply to Vehicle?
```sql
-- Without specific vehicle (generic check):
SELECT infoobj_id FROM tfzgrefbr WHERE baureihe_id = 0 AND infoobj_id = ?

-- With vehicle filters (dynamically appended):
SELECT infoobj_id FROM tfzgrefbr WHERE infoobj_id = ?
  [AND baureihe_id = ?]
  [AND modell_id = ?]
  [AND motor_id = ?]
  [AND karosserie_id = ?]
  [AND (getriebe_id = ? OR getriebe_id = 0)]
  [AND (proddat_ab <= ? AND proddat_bis >= ?)]
```

#### TIS_IOGrafik — Count Documents with Graphics
```sql
-- Count matching info objects across group tables:
SELECT COUNT(t.infoobj_id) FROM tinfo_objekt t
  [, tsyrefall r]              -- system reference
  [, tgrr%06d r]               -- group reference (dynamic by dokart_id)
  [, thgr%06d r]               -- main group reference (dynamic by dokart_id)
  [, tfzgrefbr s]              -- vehicle reference
WHERE t.infoobj_id = s.infoobj_id
  [AND r.infoobj_id = t.infoobj_id]
  AND s.baureihe_id = 0
  [AND s.baureihe_id = ?]
  [AND s.modell_id = ?]
  [AND s.motor_id = ?]
  [AND s.karosserie_id = ?]
  [AND (s.getriebe_id = ? OR s.getriebe_id = 0)]
  [AND (s.proddat_ab <= ? AND s.proddat_bis >= ?)]
  [AND r.knoten_id = ?]
  AND r.security = 0 AND t.security = 0
```

### Production Date Ranges
```sql
SELECT MIN(proddat_ab), MAX(proddat_bis) FROM TFZGREFBR t,
  [dynamic_table] s WHERE t.baureihe_id = 0 AND t.infoobj_id = s.infoobj_id

SELECT Count(s.infoobj_id) FROM tfzgrefbr t,
  [dynamic_table] s WHERE t.infoobj_id = s.infoobj_id

SELECT Count(infoobj_id) FROM [dynamic_table]
```

### Hotspots / Hyperlinks

#### TISHotspot2InfObj — Hotspot Target Documents
```sql
-- Get documents linked via hotspot:
SELECT DISTINCT t.infoobj_id, t.titel, t.dokart_id,
  t.infoobj_kz, t.infoobj_sort, t.security, t.erschdat
FROM tinfo_objekt t, thotspot s
WHERE t.infoobj_id = s.infoobj_id_n AND s.infoobj_id_v = ? AND t.security <= ?
  [AND s.hotspot_nr = ?]

-- With vehicle filter (baureihe_id = 0):
UNION ALL SELECT t.infoobj_id, t.titel, t.dokart_id, t.infoobj_kz, t.infoobj_sort, t.security,
  t.erschdat FROM tinfo_objekt t, thotspot s, tfzgrefbr r
WHERE r.baureihe_id = 0 AND t.infoobj_id = s.infoobj_id_n AND r.infoobj_id = s.infoobj_id_n
  AND s.infoobj_id_v = ? AND s.land_ok = 1 AND t.land_ok = 1
```

### Linked Documents (Verbund)

#### TIS_VerbundVsFZG — Check Cross-References Against Vehicle
```sql
-- Simple count (no vehicle filter):
SELECT COUNT(*) FROM tinfo_ref WHERE land_ok = 1 AND infoobj_id_v = ?

-- With vehicle filter:
SELECT COUNT(*) FROM tinfo_ref t, tfzgrefbr u
WHERE u.baureihe_id = 0
  AND t.infoobj_id_v = ? AND t.infoobj_id_n = u.infoobj_id AND t.land_ok = 1

-- Fetch linked refs with full vehicle filter:
SELECT t.infoobj_id_n FROM tinfo_ref t, tfzgrefbr f
WHERE t.land_ok = 1 AND f.infoobj_id = t.infoobj_id_n AND t.infoobj_id_v = ?
  [AND f.baureihe_id = ?]
  [AND f.modell_id = ?]
  [AND f.motor_id = ?]
  [AND f.karosserie_id = ?]
  [AND (f.getriebe_id = ? OR f.getriebe_id = 0)]
  [AND (f.proddat_ab <= ? AND f.proddat_bis >= ?)]
```

#### Linked Document Type Collection (temp table)
```sql
-- Populate temp table with linked document types:
INSERT INTO [temp_table] (infoobj_id, dokart_id)
SELECT DISTINCT t.infoobj_id_n, t.dokart_id FROM tinfo_ref t
WHERE t.land_ok = 1 AND t.infoobj_id_v = ?

-- With vehicle filter:
INSERT INTO [temp_table] (infoobj_id, dokart_id)
SELECT DISTINCT t.infoobj_id_n, t.dokart_id
FROM tinfo_ref t, tfzgrefbr u
WHERE t.land_ok = 1 AND t.infoobj_id_n = u.infoobj_id
  AND t.infoobj_id_v = ? AND u.baureihe_id = 0
```

#### Browse All Documents by Type
```sql
SELECT DISTINCT t.infoobj_id, t.titel, t.dokart_id,
  t.infoobj_kz, t.infoobj_sort, t.erschdat, t.security
FROM tinfo_objekt t
WHERE t.dokart_id = ? AND t.land_ok = 1 AND t.security <= ?
  [AND t.infoobj_id = u.infoobj_id]  -- from temp table
  [AND t.infoobj_kz ...]
  AND t.land_ok = 1 ORDER BY 5

-- With generic vehicle fallback:
UNION ALL SELECT DISTINCT t.infoobj_id, t.titel, t.dokart_id,
  t.infoobj_kz, t.infoobj_sort, t.erschdat, t.security
FROM tinfo_objekt t, tfzgrefbr r
WHERE r.baureihe_id = 0 AND t.infoobj_id = r.infoobj_id
  AND t.dokart_id = ? AND t.security <= ?
```

#### Document by Group Node with Vehicle
```sql
SELECT DISTINCT t.infoobj_id, t.titel, t.dokart_id, t.infoobj_kz, t.infoobj_sort,
  t.erschdat FROM tinfo_objekt t,
  [dynamic_group_table] r
WHERE t.infoobj_id = s.infoobj_id AND s.dokart_id = t.dokart_id AND t.dokart_id = ?
  AND t.land_ok = 1 ORDER BY 5
```

### News

```sql
-- All news with info object details:
SELECT s.news_id, s.news_titel, s.infoobj_id, s.dokart_id, s.ersch_datum, r.infoobj_kz,
  r.security, r.titel, s.news_sort
FROM tnews s, tinfo_objekt r
WHERE r.infoobj_id = s.infoobj_id AND s.land_ok = 1 AND r.land_ok = 1

-- With generic vehicle fallback:
UNION SELECT s.news_id, s.news_titel, s.infoobj_id,
  s.dokart_id, s.ersch_datum, r.infoobj_kz, r.security, r.titel, s.news_sort
FROM tnews s, tinfo_objekt r, tfzgrefbr f
WHERE r.land_ok = 1 AND r.infoobj_id = s.infoobj_id
  AND f.baureihe_id = 0 AND s.infoobj_id = f.infoobj_id
  [AND s.infoobj_id = f.infoobj_id]
ORDER BY 9

-- News by ID:
SELECT DISTINCT news_titel, infoobj_id, dokart_id, ersch_datum FROM tnews WHERE news_id = ?
```

### Vehicle Actions (by Chassis Number)

```sql
-- Actions for a chassis number range:
SELECT t.infoobj_id, t.aktion_titel, t.erschdat, t.infoobj_sort, r.titel,
  r.dokart_id, r.infoobj_kz, r.security
FROM tfzg_aktion t, tfzgreffgnr s, tinfo_objekt r
WHERE s.bereich = ? AND s.fgstnrab <= ? AND s.fgstnrbis >= ?
  AND t.infoobj_id = s.infoobj_id
  AND t.infoobj_id = r.infoobj_id AND t.land_ok = 1

-- Action detail:
SELECT t.aktion_titel, t.erschdat, r.dokart_id, r.infoobj_kz,
  r.security FROM tfzg_aktion t, tinfo_objekt r
WHERE t.infoobj_id = ? AND r.infoobj_id = ?
```

### Schema / Temp Table Management

```sql
CREATE SEQUENCE tisuserseq
CREATE TABLE [temp_table_name] ...
DELETE FROM [temp_table_name]
DROP TABLE [temp_table_name]
INSERT INTO [temp_table_name] ...
```

---

## Dynamic Table Pattern

Many queries use dynamically constructed table names based on `dokart_id`:

| Pattern | Format | Example |
|---------|--------|---------|
| `tgrr%06d` | Group reference | `tgrr000200` (SI) |
| `thgr%06d` | Main group reference | `thgr000300` (RA) |
| `TKNHG{dokart_id}` | Node-to-main-group | Used in JOINs with `tzuwegknoten` |

The `%06d` format string is used in `sprintf()` calls found in the decompiled code, confirming the zero-padded 6-digit suffix convention.

## Tables Referenced in tis.exe

| Table | Purpose | Used By |
|-------|---------|---------|
| `tbenennung` | Label translations (key → name) | Startup init |
| `tdokart` | Document types | Startup, Dokartmask, multiple queries |
| `tfgstnrk` | Chassis number ranges | TISFgstNr2FzgId |
| `tfzgtyp` | Vehicle type components | TISFgstNr2FzgId |
| `tleittyp` | Lead type by vehicle type | TISFgstNr2FzgId |
| `tfzgmodell` | Vehicle models (series/model/year) | TISPFzgId2Br/Mod/Jahr |
| `tfzgrefbr` | Vehicle↔document reference | TIS_IOvsFZG, TIS_IOGrafik, etc. |
| `tfzgrefbr_da` | Vehicle↔doc type reference | TISPFzgId2Br, Dokart queries |
| `tgrrefall_da` | Group reference (all) for doc types | Dokart filtering |
| `tzuweg` | Navigation paths | TISZuWeg |
| `tzuwegknoten` | Navigation tree nodes | TISKnoten2Knoten, TISKnoten |
| `tinfo_objekt` | Documents (info objects) | TISInfObj, multiple queries |
| `tinfo_file` | Document file references | File lookup |
| `tinfo_ref` | Document cross-references | TIS_VerbundVsFZG |
| `thotspot` | Hotspot links | TISHotspot2InfObj |
| `tnews` | News items | TAktNews |
| `tfzg_aktion` | Vehicle actions (recalls etc.) | Vehicle actions |
| `tfzgreffgnr` | Vehicle ref by chassis number | Vehicle actions |
| `tsyrefall` | System reference (all) | TIS_IOGrafik |
| `tgrr{dokart_id}` | Group reference (dynamic) | TIS_IOGrafik, TISInfObj |
| `thgr{dokart_id}` | Main group reference (dynamic) | TIS_IOGrafik |
| `TKNHG{dokart_id}` | Node-to-main-group (dynamic) | TISKnoten2Knoten |

## Comparison with Existing Documentation

### Already Documented (database-queries.md)
- Vehicle selection (series/model/engine) — **partially matches** but our reimplementation uses simpler JOINs with TBENENNUNG; the original doesn't use TBENENNUNG for vehicle selection
- Document types — **documented**
- Navigation tree (TZUKN/THGR/TGRR) — **documented** but the original uses `tzuwegknoten` (shared) not per-dokart `TZUKN{id}` tables for the main navigation
- Document list and files — **documented**

### NOT Previously Documented (new from Ghidra)
1. **`TIS_IOvsFZG`** — Vehicle applicability check with dynamic WHERE clause building
2. **`TIS_IOGrafik`** — Graphics availability check counting across multiple reference tables
3. **`TIS_VerbundVsFZG`** — Cross-reference validation against vehicle (with fallback strategy)
4. **`TIS_MinDA`** — Default document type selection (MIN sort order)
5. **`TISFgstNr2FzgId`** — Full chassis number → vehicle decomposition flow (tfgstnrk → tfzgtyp → tleittyp)
6. **Vehicle action queries** — tfzg_aktion + tfzgreffgnr for recalls/service actions
7. **News queries** — tnews with UNION for generic (baureihe_id=0) entries
8. **Temp table management** — CREATE/INSERT/DELETE/DROP for intermediate result sets
9. **Dynamic WHERE clause building** — Vehicle filters are appended conditionally (baureihe, modell, motor, karosserie, getriebe, proddat range)
10. **Security filtering** — `security = 0` and `security <= ?` used throughout
11. **`land_ok = 1`** — Country filtering present in nearly every query
12. **`baureihe_id = 0`** pattern — Used as "generic/all vehicles" fallback
13. **UNION pattern** — Many queries UNION specific vehicle results with baureihe_id=0 fallback
14. **`tzuwegknoten`** vs `TZUKN{id}` — The original uses the shared `tzuwegknoten` table with `zuweg_id` filter for main navigation, not the per-dokart TZUKN tables
15. **`TKNHG{dokart_id}`** tables — Used to filter navigation nodes by vehicle for specific doc types
16. **`tgrrefall_da`** and **`tfzgrefbr_da`** — Document-type-scoped vehicle references used for doc type filtering

### Key Architectural Insight
The original TIS builds queries **dynamically at runtime** using string concatenation. Vehicle filter clauses (`AND baureihe_id = ?`, `AND modell_id = ?`, etc.) are **appended conditionally** based on which vehicle attributes are set. This explains the many small string fragments in the binary. Our reimplementation can simplify this with parameterized queries since we don't need to support all the ODBC prepared statement gymnastics.
