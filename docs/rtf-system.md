# TIS RTF Document System

This documents the RTF (Rich Text Format) rendering pipeline used by the original BMW TIS application, including the BMW-specific RTF extensions, the cross-reference (hotspot) system, and the image embedding mechanism.

---

## RTF Storage

Documents are stored as RTF blobs in the `DOCS` table, keyed by path (e.g. `1/09/88/56.RTF`). The mapping from a document ID (`INFOOBJ_ID`) to its RTF file is:

```
TINFO_OBJEKT.INFOOBJ_ID → TINFO_FILE.INFO_FILENAME → DOCS.id (with .RTF suffix)
```

All TIS RTF files use the same two-font table:

```rtf
{\deff0\fonttbl{\f0\fswiss Helvetica;}
{\f1\ftech Symbol;}
}
```

- `\f0` (Helvetica) — all body text
- `\f1` (Symbol) — bullet characters (`\f1\'b7\f0` = bullet point `·`)

---

## RTF Control Words Used

Survey of all RTF control words found across TIS documents:

| Control Word | Usage | Standard RTF? |
|---|---|---|
| `\plain` | Reset formatting | Yes |
| `\pard` | Reset paragraph | Yes |
| `\b` | Bold | Yes |
| `\i` | Italic | Yes |
| `\ul` | Underline | Yes |
| `\up` | Superscript | Yes |
| `\fs` | Font size (half-points) | Yes |
| `\f` | Font switch (0=Helvetica, 1=Symbol) | Yes |
| `\tab` | Tab character | Yes |
| `\par` | Paragraph break | Yes |
| `\line` | Line break (no paragraph spacing) | Yes |
| `\cell`, `\row` | Table cell/row | Yes |
| `\intbl` | Text is inside a table | Yes |
| `\trowd`, `\trleft`, `\trql`, `\trhdr` | Table row definition | Yes |
| `\clvertalt`, `\cellx`, `\clbrdr*` | Table cell definition & borders | Yes |
| `\li`, `\ri`, `\fi` | Left/right/first-line indent | Yes |
| `\sb`, `\sa`, `\sl` | Space before/after/line spacing | Yes |
| `\tx` | Tab stop position | Yes |
| `\ql` | Left-align | Yes |
| `\strike` | **BMW extension**: cross-reference hotspot link | Repurposed |
| `\v` | **BMW extension**: hidden text (GRAFIK sentinel) | Repurposed |
| `\~` | Non-breaking space | Yes |

Only two control words are repurposed by BMW: `\strike` and `\v`. All others are standard RTF.

---

## BMW Extension: Hidden Text (`\v`) and Image Embedding

### Purpose

The `\v` control word (RTF "hidden text") is used exclusively as part of the inline image embedding system. It marks a `.Z.` sentinel that precedes a `GRAFIK` image reference.

### Pattern in RTF

```rtf
\plain\v\f0\fs36 .Z.
\plain\f0\fs36 N:GRAFIK\1\03\47\65.itw;11.005cm;8.324cm;TIFF;
```

Structure:
1. `\plain\v\f0\fsNN .Z.` — Hidden text containing the literal string `.Z.` (a sentinel marker)
2. `\plain\f0\fsNN N:GRAFIK\path\to\file.itw;width;height;format;` — Visible text containing the image reference

The `.Z.` hidden text acts as a flag for the TIS rendering engine to know that the following text is an image placeholder, not literal content.

### GRAFIK Path Format

```
N:GRAFIK\1\03\47\65.itw;11.005cm;8.324cm;TIFF;
         └─ path ─────┘ └─width─┘ └height┘ └fmt┘
```

- **Path**: Backslash-separated segments with `.itw` extension (e.g. `1\03\47\65.itw`)
- **Width/Height**: Original display dimensions in cm (e.g. `11.005cm;8.324cm`)
- **Format**: Source image format, always `TIFF`
- The `.itw` files are converted to PNG and stored in the image tables

### Image Resolution

The path `1\03\47\65.itw` maps to image ID `1/03/47/65.png` (backslashes → forward slashes, `.itw` → `.png`).

### No Other Hidden Text Usage

Across the entire TIS document corpus, `\v` hidden text is **only** used for the `.Z.` + GRAFIK pattern. There are no other uses of hidden text in TIS documents.

---

## BMW Extension: Cross-Reference Hotspots (`\strike`)

### Purpose

The RTF `\strike` control word (normally strikethrough text) is repurposed by TIS as a **hyperlink indicator**. Text marked with `\strike` is rendered as a clickable cross-reference link in the original TIS viewer.

### THOTSPOT Table

Cross-reference targets are **not** encoded in the RTF text itself. Instead, they are stored in the `THOTSPOT` database table and resolved by **position** (occurrence order within the document).

```sql
THOTSPOT
├── INFOOBJ_ID_V  INTEGER  -- Source document ID (the doc containing the \strike text)
├── HOTSPOT_NR    INTEGER  -- 1-based index matching the Nth \strike in the RTF
├── INFOOBJ_ID_N  INTEGER  -- Target document ID (where the link points)
├── LAND_ID       INTEGER  -- Country filter
└── LAND_OK       INTEGER  -- Country availability flag (1 = available)
```

**Total rows: ~115,000**

### Positional Mapping

The Nth `\strike` block in a document corresponds to `HOTSPOT_NR = N` in the THOTSPOT table:

| \strike occurrence | HOTSPOT_NR | Target |
|---|---|---|
| 1st `\strike` block | 1 | `THOTSPOT WHERE INFOOBJ_ID_V = ? AND HOTSPOT_NR = 1` |
| 2nd `\strike` block | 2 | `THOTSPOT WHERE INFOOBJ_ID_V = ? AND HOTSPOT_NR = 2` |
| 3rd `\strike` block | 3 | `THOTSPOT WHERE INFOOBJ_ID_V = ? AND HOTSPOT_NR = 3` |

### Multiple Targets Per Hotspot

A single hotspot number can map to **multiple target documents** (multiple rows with the same `HOTSPOT_NR`). This happens when:
- The same document code exists for different vehicle series/models
- The target varies by vehicle context (series, model, engine)

The original TIS app used vehicle context to filter to the most relevant target.

### Query to Resolve Hotspots

```sql
-- Get all targets for a hotspot:
SELECT DISTINCT t.INFOOBJ_ID, t.TITEL, t.DOKART_ID, t.INFOOBJ_KZ, t.SECURITY
FROM TINFO_OBJEKT t
JOIN THOTSPOT s ON t.INFOOBJ_ID = s.INFOOBJ_ID_N
WHERE s.INFOOBJ_ID_V = :sourceDocId
  AND s.HOTSPOT_NR = :hotspotNumber
  AND s.LAND_OK = 1
  AND t.SECURITY <= :securityLevel

-- With vehicle filter:
-- Add: JOIN TFZGREFBR f ON f.INFOOBJ_ID = t.INFOOBJ_ID
--      AND f.BAUREIHE_ID = :seriesId [AND f.MODELL_ID = :modelId ...]
-- UNION with f.BAUREIHE_ID = 0 fallback
```

### Cross-Reference Text Patterns

The `\strike` text itself is purely display text — it does NOT encode the link target. Observed patterns:

| Pattern | Example | Target Type |
|---|---|---|
| Numeric document code | `54 12 265` | Direct doc reference (RA) |
| Code with letter suffix | `61 21 1AZ` | Tightening torque doc (AZD) |
| Prefixed doc reference | `refer to Technical Data 24 11 13AZ` | TD/AZD doc |
| Job item reference | `job item 64 22 135` | RA repair instruction |
| Doc type + code | `RA 36 11 520` | Explicit doc type reference |
| SI bulletin reference | `Service Information bulletin 23 03 98 (347)` | SI doc |
| Section title | `Safety instructions for handling vehicle battery` | Related RA doc |
| Component name | `rear seat`, `engine bonnet/hood in service position` | RA doc for that component |
| Instruction reference | `Remove carbon canister with DMTL` | RA procedure doc |
| Enclosure reference | `Enclosure 1`, `Please refer to Enclosure 2.` | Section within a compound doc |
| Generic phrase | `refer to BMW Service Operating Fluids` | SBS doc type |

### Multiple Codes in One Strike Block

Sometimes a single `\strike` block contains multiple comma-separated references:

```rtf
\strike job item\~64\~22\~135,job item\~64\~22\~136,job item\~64\~22\~161.
```

This renders as one visually linked block but maps to a **single** `HOTSPOT_NR`. The THOTSPOT table may have multiple rows for that hotspot number (one per referenced document).

### Non-Breaking Spaces

Codes in strike text use `\~` (RTF non-breaking space) between number groups:

```rtf
\strike 61\~21\~1AZ          → displays as "61 21 1AZ"
\strike job item\~54\~12\~265  → displays as "job item 54 12 265"
```

Pandoc converts `\~` to `\xC2\xA0` (UTF-8 non-breaking space, U+00A0), which appears as `Â ` in some contexts.

---

## Font Table Leak (Pandoc Bug)

### Problem

Pandoc sometimes leaks the RTF `\fonttbl` group as literal text in the HTML output. This produces visible "Helvetica;Symbol;" text in the rendered document.

### Cause

The RTF font table is:

```rtf
{\deff0\fonttbl{\f0\fswiss Helvetica;}
{\f1\ftech Symbol;}
}
```

Pandoc parses the font names as literal text and inserts them into the HTML output. This occurs in two positions:

1. **At the start** of the HTML: `<p>Helvetica;Symbol;<strong>title</strong></p>`
2. **Mid-document**: When the RTF starts with a table, the font text appears after the initial table as `<p>Helvetica;Symbol;</p>`

### Fix

Two-layer defense:

1. **`preprocessRtf`**: Strip the entire `\fonttbl` group from the RTF before passing to pandoc:
   ```js
   rtf.replace(/\{[^{}]*\\fonttbl\s*(?:\{[^}]*\}\s*)*\}/g, '')
   ```

2. **`postprocessHtml`** (fallback): Remove any remaining font name text from the HTML output:
   ```js
   // Standalone: <p>Helvetica;Symbol;</p> → remove entirely
   // Mixed: <p>Helvetica;Symbol;<strong>title</strong></p> → strip prefix
   ```

---

## Rendering Pipeline

The full RTF → HTML pipeline in TISX:

```
RTF blob from DOCS table
  │
  ├─ preprocessRtf()
  │   ├─ Strip \fonttbl group (prevent pandoc font leak)
  │   ├─ Replace \v .Z. + N:GRAFIK blocks with __IMG_sentinel__ tokens
  │   └─ Replace text placeholders (--TYP--, --FGSTNR--, etc.)
  │
  ├─ pandoc -f rtf -t html
  │   ├─ Converts standard RTF formatting → HTML
  │   ├─ Converts \strike → <del> tags
  │   └─ Converts \~ → non-breaking space (U+00A0)
  │
  └─ postprocessHtml()
      ├─ Strip any remaining font name leaks
      ├─ Replace __IMG_sentinel__ → <img src="/api/images/..."> tags
      └─ Convert <del> → <a class="tis-cross-ref"> / <span class="tis-cross-ref">
```

### Text Placeholders

Some documents contain placeholder tokens that are substituted with vehicle context at render time:

| Placeholder | Value Source |
|---|---|
| `--TYP--` | Vehicle type designation |
| `--FGSTNR--` | Chassis/VIN number |
| `--MODELL--` | Model designation |
| `--MOTOR--` | Engine designation |
| `--KAROSS--` | Body type designation |

---

## Database Tables Involved

| Table | Role |
|---|---|
| `DOCS` | RTF document blobs (keyed by path like `1/09/88/56.RTF`) |
| `TINFO_OBJEKT` | Document metadata (ID, code, title, doc type, date) |
| `TINFO_FILE` | Maps INFOOBJ_ID → filename (without extension) |
| `THOTSPOT` | Cross-reference hotspot links (source doc → target doc by position) |
| `TFZGREFBR` | Vehicle applicability filter for documents |
| `TINFO_REF` | Related documents (Verbund/compound docs) |

---

## Verified Facts

- `\v` hidden text is used **only** for `.Z.` + GRAFIK image sentinels — no other hidden text usage exists
- `\strike` is used **only** for cross-reference hotspot links — there is no real strikethrough text in TIS
- All documents use the same two-font table (Helvetica + Symbol)
- Cross-reference targets are stored in `THOTSPOT` by positional index, not encoded in the RTF text
- A single hotspot can have multiple target documents (vehicle-dependent)
- The RTF text within `\strike` is purely display text — it can be a document code, section title, component name, or descriptive phrase
- Non-breaking spaces (`\~`) are used within document codes in strike text
- Besides `\strike` and `\v`, no other RTF control words are repurposed by BMW — all others are standard RTF
