# Database tables

> English translations are inferred from German abbreviations used in BMW/TIS data sets.

## TBENENNUNG — Naming/Designation

| Original | English | Type | Description |
|---|---|---|---|
| KEY | key | INTEGER | Primary key |
| BENENNUNG | designation/name | varchar | Primary key |

## TDOKART — Document type

| Original | English | Type | Description |
|---|---|---|---|
| DOKART_KZ | document type code | varchar | Code |
| DOKART_ID | document type id | INTEGER | Identifier |
| DOKART_SORT | document type sort order | INTEGER | Sort order |
| DOKART_BEZ | document type description | varchar | Name/description |
| KEY_LENGTH | key length | INTEGER | Value |
| MIN_LENGTH | minimum length | INTEGER | Value |
| METHODE | method | INTEGER | Value |
| ZUGRIFF | access | INTEGER | Value |
| HGNAME | main group name | varchar | Value |
| UGNAME | subgroup name | varchar | Value |
| SECURITY | security level | INTEGER | Value |
| FZG_REQU | vehicle requirement | INTEGER | Value |
| DRUCK_TYP | print type | INTEGER | Value |
| LEITTYP | lead type | INTEGER | Value |
| LAND_ID | country id | INTEGER | Identifier |
| LAND_OK | country allowed flag | INTEGER | Value |

## TFGSTNRK — Chassis number range

| Original | English | Type | Description |
|---|---|---|---|
| BEREICH | range | INTEGER | Primary key |
| FGSTNRAB | chassis number from | INTEGER | Primary key |
| FGSTNRBIS | chassis number to | INTEGER | Primary key |
| FZGTYP | vehicle type | INTEGER | Value |
| PRODDAT | production date | INTEGER | Date value (YYYYMMDD or similar) |

## TFZGREFBR — Vehicle reference (series/model/engine/body/gearbox)

| Original | English | Type | Description |
|---|---|---|---|
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| LEITTYP | lead type | INTEGER | Value |
| BAUREIHE_ID | series id | INTEGER | Identifier |
| MODELL_ID | model id | INTEGER | Identifier |
| MOTOR_ID | engine id | INTEGER | Identifier |
| KAROSSERIE_ID | body id | INTEGER | Identifier |
| GETRIEBE_ID | transmission id | INTEGER | Identifier |
| PRODDAT_AB | production date from | INTEGER | Date value (YYYYMMDD or similar) |
| PRODDAT_BIS | production date to | INTEGER | Date value (YYYYMMDD or similar) |

## TFZGREFBR_DA — Vehicle reference for document types

| Original | English | Type | Description |
|---|---|---|---|
| DOKART_ID | document type id | INTEGER | Identifier |
| BAUREIHE_ID | series id | INTEGER | Identifier |
| MODELL_ID | model id | INTEGER | Identifier |
| MOTOR_ID | engine id | INTEGER | Identifier |
| KAROSSERIE_ID | body id | INTEGER | Identifier |
| GETRIEBE_ID | transmission id | INTEGER | Identifier |
| PRODDAT_AB | production date from | INTEGER | Date value (YYYYMMDD or similar) |
| PRODDAT_BIS | production date to | INTEGER | Date value (YYYYMMDD or similar) |

## TFZGREFFGNR — Vehicle reference by chassis number

| Original | English | Type | Description |
|---|---|---|---|
| INFOOBJ_ID | info object id | INTEGER | Primary key |
| BEREICH | range | INTEGER | Primary key |
| FGSTNRAB | chassis number from | INTEGER | Primary key |
| FGSTNRBIS | chassis number to | INTEGER | Primary key |

## TFZGTYP — Vehicle type

| Original | English | Type | Description |
|---|---|---|---|
| FZGTYP | vehicle type | INTEGER | Primary key |
| BAUREIHE_ID | series id | INTEGER | Identifier |
| MODELL_ID | model id | INTEGER | Identifier |
| MOTOR_ID | engine id | INTEGER | Identifier |
| KAROSSERIE_ID | body id | INTEGER | Identifier |
| GETRIEBE_ID | transmission id | INTEGER | Identifier |
| ANTRIEB_ID | drive id | INTEGER | Identifier |
| AUSFRG | version/variant | varchar | Value |

## TFZGMODELL — Vehicle model

| Original | English | Type | Description |
|---|---|---|---|
| BAUREIHE_ID | series id | INTEGER | Identifier |
| MODELL_ID | model id | INTEGER | Identifier |
| BAUREIHE_LANG | series name | varchar | Value |
| MODELL_LANG | model name | varchar | Value |
| MOTOR_ID | engine id | INTEGER | Identifier |
| KAROSSERIE_ID | body id | INTEGER | Identifier |
| PRODDAT_AB | production date from | INTEGER | Date value (YYYYMMDD or similar) |
| PRODDAT_BIS | production date to | INTEGER | Date value (YYYYMMDD or similar) |

## TFZG_AKTION — Vehicle action

| Original | English | Type | Description |
|---|---|---|---|
| INFOOBJ_ID | info object id | INTEGER | Primary key |
| INFOOBJ_SORT | info object sort order | INTEGER | Sort order |
| ERSCHDAT | release date | INTEGER | Date value (YYYYMMDD or similar) |
| AKTION_TITEL | action title | varchar | Value |
| LAND_ID | country id | INTEGER | Identifier |
| LAND_OK | country allowed flag | INTEGER | Primary key |

## TGRR000200 — Group reference 000200

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## TGRR000300 — Group reference 000300

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## TGRR000400 — Group reference 000400

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## TGRR001600 — Group reference 001600

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## TGRR000100 — Group reference 000100

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## TGRR001000 — Group reference 001000

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## TGRR001100 — Group reference 001100

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## TGRR001200 — Group reference 001200

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## TGRR001300 — Group reference 001300

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## TGRR002100 — Group reference 002100

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## TGRREFALL_DA — Group reference (all) for document types

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| DOKART_ID | document type id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |
| BAUREIHE_ID | series id | INTEGER | Identifier |
| MODELL_ID | model id | INTEGER | Identifier |
| MOTOR_ID | engine id | INTEGER | Identifier |
| KAROSSERIE_ID | body id | INTEGER | Identifier |
| GETRIEBE_ID | transmission id | INTEGER | Identifier |
| PRODDAT_AB | production date from | INTEGER | Date value (YYYYMMDD or similar) |
| PRODDAT_BIS | production date to | INTEGER | Date value (YYYYMMDD or similar) |
| LAND_ID | country id | INTEGER | Identifier |
| LAND_OK | country allowed flag | INTEGER | Value |

## THGR000200 — Main group reference 000200

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## THGR000300 — Main group reference 000300

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## THGR000400 — Main group reference 000400

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## THGR001600 — Main group reference 001600

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## THGR000100 — Main group reference 000100

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## THGR001000 — Main group reference 001000

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## THGR001100 — Main group reference 001100

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## THGR001200 — Main group reference 001200

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## THGR001300 — Main group reference 001300

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## THGR002100 — Main group reference 002100

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## THOTSPOT — Hotspot reference

| Original | English | Type | Description |
|---|---|---|---|
| INFOOBJ_ID_V | info object id (source) | INTEGER | Primary key |
| HOTSPOT_NR | hotspot number | INTEGER | Primary key |
| INFOOBJ_ID_N | info object id (target) | INTEGER | Primary key |
| LAND_ID | country id | INTEGER | Identifier |
| LAND_OK | country allowed flag | INTEGER | Primary key |

## TINFO_FILE — Info file

| Original | English | Type | Description |
|---|---|---|---|
| INFOOBJ_ID | info object id | INTEGER | Primary key |
| DEVICETYP | device type | varchar | Value |
| DEVICEKZ | device code | varchar | Value |
| INFO_FILENAME | info file name | varchar | Primary key |

## TINFO_OBJEKT — Info object

| Original | English | Type | Description |
|---|---|---|---|
| INFOOBJ_ID | info object id | INTEGER | Primary key |
| INFOOBJ_KZ | info object code | varchar | Code |
| INFOOBJ_SORT | info object sort order | INTEGER | Sort order |
| DOKART_ID | document type id | INTEGER | Primary key |
| DAS_DOKUART | DAS document type | varchar | Value |
| DAS_OBJEKT | DAS object | varchar | Value |
| DAS_INDEX | DAS index | INTEGER | Value |
| TITEL | title | varchar | Value |
| ERSCHDAT | release date | INTEGER | Date value (YYYYMMDD or similar) |
| SECURITY | security level | INTEGER | Primary key |
| LAND_ID | country id | INTEGER | Identifier |
| LAND_OK | country allowed flag | INTEGER | Primary key |

## TINFO_REF — Info object reference

| Original | English | Type | Description |
|---|---|---|---|
| INFOOBJ_ID_V | info object id (source) | INTEGER | Value |
| INFOOBJ_ID_N | info object id (target) | INTEGER | Value |
| DOKART_ID | document type id | INTEGER | Identifier |
| LAND_ID | country id | INTEGER | Identifier |
| LAND_OK | country allowed flag | INTEGER | Value |

## TINSTLAND — Installed country

| Original | English | Type | Description |
|---|---|---|---|
| LAND_KZ | country code | varchar | Code |

## TKNHG000200 — Node main group mapping 000200

| Original | English | Type | Description |
|---|---|---|---|
| ZUWEG_ID | path id | INTEGER | Identifier |
| KNOTEN_ID | node id | INTEGER | Identifier |
| BAUREIHE_ID | series id | INTEGER | Identifier |
| MODELL_ID | model id | INTEGER | Identifier |
| MOTOR_ID | engine id | INTEGER | Identifier |
| KAROSSERIE_ID | body id | INTEGER | Identifier |
| GETRIEBE_ID | transmission id | INTEGER | Identifier |
| PRODDAT_AB | production date from | INTEGER | Date value (YYYYMMDD or similar) |
| PRODDAT_BIS | production date to | INTEGER | Date value (YYYYMMDD or similar) |
| SECURITY | security level | INTEGER | Value |

## TKNHG000300 — Node main group mapping 000300

| Original | English | Type | Description |
|---|---|---|---|
| ZUWEG_ID | path id | INTEGER | Identifier |
| KNOTEN_ID | node id | INTEGER | Identifier |
| BAUREIHE_ID | series id | INTEGER | Identifier |
| MODELL_ID | model id | INTEGER | Identifier |
| MOTOR_ID | engine id | INTEGER | Identifier |
| KAROSSERIE_ID | body id | INTEGER | Identifier |
| GETRIEBE_ID | transmission id | INTEGER | Identifier |
| PRODDAT_AB | production date from | INTEGER | Date value (YYYYMMDD or similar) |
| PRODDAT_BIS | production date to | INTEGER | Date value (YYYYMMDD or similar) |
| SECURITY | security level | INTEGER | Value |

## TKNHG000400 — Node main group mapping 000400

| Original | English | Type | Description |
|---|---|---|---|
| ZUWEG_ID | path id | INTEGER | Identifier |
| KNOTEN_ID | node id | INTEGER | Identifier |
| BAUREIHE_ID | series id | INTEGER | Identifier |
| MODELL_ID | model id | INTEGER | Identifier |
| MOTOR_ID | engine id | INTEGER | Identifier |
| KAROSSERIE_ID | body id | INTEGER | Identifier |
| GETRIEBE_ID | transmission id | INTEGER | Identifier |
| PRODDAT_AB | production date from | INTEGER | Date value (YYYYMMDD or similar) |
| PRODDAT_BIS | production date to | INTEGER | Date value (YYYYMMDD or similar) |
| SECURITY | security level | INTEGER | Value |

## TKN_GR_REF — Node group reference

| Original | English | Type | Description |
|---|---|---|---|
| ZUWEG_ID | path id | INTEGER | Identifier |
| KNOTEN_ID | node id | INTEGER | Identifier |
| BAUREIHE_ID | series id | INTEGER | Identifier |
| MODELL_ID | model id | INTEGER | Identifier |
| MOTOR_ID | engine id | INTEGER | Identifier |
| KAROSSERIE_ID | body id | INTEGER | Identifier |
| GETRIEBE_ID | transmission id | INTEGER | Identifier |
| PRODDAT_AB | production date from | INTEGER | Date value (YYYYMMDD or similar) |
| PRODDAT_BIS | production date to | INTEGER | Date value (YYYYMMDD or similar) |
| SECURITY | security level | INTEGER | Value |

## TKN_HG_REF — Node main group reference

| Original | English | Type | Description |
|---|---|---|---|
| ZUWEG_ID | path id | INTEGER | Identifier |
| KNOTEN_ID | node id | INTEGER | Identifier |
| BAUREIHE_ID | series id | INTEGER | Identifier |
| MODELL_ID | model id | INTEGER | Identifier |
| MOTOR_ID | engine id | INTEGER | Identifier |
| KAROSSERIE_ID | body id | INTEGER | Identifier |
| GETRIEBE_ID | transmission id | INTEGER | Identifier |
| PRODDAT_AB | production date from | INTEGER | Date value (YYYYMMDD or similar) |
| PRODDAT_BIS | production date to | INTEGER | Date value (YYYYMMDD or similar) |
| SECURITY | security level | INTEGER | Value |

## TKN_SY_REF — Node system reference

| Original | English | Type | Description |
|---|---|---|---|
| ZUWEG_ID | path id | INTEGER | Identifier |
| KNOTEN_ID | node id | INTEGER | Identifier |
| BAUREIHE_ID | series id | INTEGER | Identifier |
| MODELL_ID | model id | INTEGER | Identifier |
| MOTOR_ID | engine id | INTEGER | Identifier |
| KAROSSERIE_ID | body id | INTEGER | Identifier |
| GETRIEBE_ID | transmission id | INTEGER | Identifier |
| PRODDAT_AB | production date from | INTEGER | Date value (YYYYMMDD or similar) |
| PRODDAT_BIS | production date to | INTEGER | Date value (YYYYMMDD or similar) |
| SECURITY | security level | INTEGER | Value |

## TLANDCODE — Country code

| Original | English | Type | Description |
|---|---|---|---|
| LAND_KZ | country code | varchar | Code |
| LAND_ID | country id | INTEGER | Identifier |

## TNEWS — News

| Original | English | Type | Description |
|---|---|---|---|
| NEWS_ID | news id | INTEGER | Primary key |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| DOKART_ID | document type id | INTEGER | Identifier |
| ERSCH_DATUM | release date | INTEGER | Date value (YYYYMMDD or similar) |
| NEWS_TITEL | news title | varchar | Value |
| NEWS_SORT | news sort order | INTEGER | Sort order |
| LAND_ID | country id | INTEGER | Identifier |
| LAND_OK | country allowed flag | INTEGER | Primary key |

## TLEITTYP — Lead type mapping

| Original | English | Type | Description |
|---|---|---|---|
| FZGTYP | vehicle type | INTEGER | Primary key |
| LEITTYP | lead type | INTEGER | Value |

## TMPINSTLANDID — Temporary installed country id

| Original | English | Type | Description |
|---|---|---|---|
| LAND_ID | country id | INTEGER | Identifier |

## TSYREFALL — System reference (all)

| Original | English | Type | Description |
|---|---|---|---|
| KNOTEN_ID | node id | INTEGER | Identifier |
| INFOOBJ_ID | info object id | INTEGER | Identifier |
| SECURITY | security level | INTEGER | Value |

## TZUKN000200 — Path node 000200

| Original | English | Type | Description |
|---|---|---|---|
| ZUWEG_ID | path id | INTEGER | Identifier |
| KNOTEN_ID | node id | INTEGER | Identifier |
| KNOTEN_KZ | node code | varchar | Code |
| KNOTEN_SORT | node sort order | INTEGER | Sort order |
| KNOTEN_BEZ | node name | varchar | Name/description |
| KNOTEN_HELP | node help text | varchar | Help text |
| KNOTEN_GRAPH | node graphic | varchar | Graphic reference |
| VARIANT_ART | variant type | INTEGER | Value |
| VARIANT_WERT | variant value | INTEGER | Value |
| VATER_ID | parent node id | INTEGER | Identifier |
| LAND_ID | country id | INTEGER | Identifier |
| LAND_OK | country allowed flag | INTEGER | Value |

## TZUKN000300 — Path node 000300

| Original | English | Type | Description |
|---|---|---|---|
| ZUWEG_ID | path id | INTEGER | Identifier |
| KNOTEN_ID | node id | INTEGER | Identifier |
| KNOTEN_KZ | node code | varchar | Code |
| KNOTEN_SORT | node sort order | INTEGER | Sort order |
| KNOTEN_BEZ | node name | varchar | Name/description |
| KNOTEN_HELP | node help text | varchar | Help text |
| KNOTEN_GRAPH | node graphic | varchar | Graphic reference |
| VARIANT_ART | variant type | INTEGER | Value |
| VARIANT_WERT | variant value | INTEGER | Value |
| VATER_ID | parent node id | INTEGER | Identifier |
| LAND_ID | country id | INTEGER | Identifier |
| LAND_OK | country allowed flag | INTEGER | Value |

## TZUKN000400 — Path node 000400

| Original | English | Type | Description |
|---|---|---|---|
| ZUWEG_ID | path id | INTEGER | Identifier |
| KNOTEN_ID | node id | INTEGER | Identifier |
| KNOTEN_KZ | node code | varchar | Code |
| KNOTEN_SORT | node sort order | INTEGER | Sort order |
| KNOTEN_BEZ | node name | varchar | Name/description |
| KNOTEN_HELP | node help text | varchar | Help text |
| KNOTEN_GRAPH | node graphic | varchar | Graphic reference |
| VARIANT_ART | variant type | INTEGER | Value |
| VARIANT_WERT | variant value | INTEGER | Value |
| VATER_ID | parent node id | INTEGER | Identifier |
| LAND_ID | country id | INTEGER | Identifier |
| LAND_OK | country allowed flag | INTEGER | Value |

## TZUWEG — Path

| Original | English | Type | Description |
|---|---|---|---|
| ZUWEG_ID | path id | INTEGER | Identifier |
| ZUWEG_SORT | path sort order | INTEGER | Sort order |
| ZUWEG_BEZ | path description | varchar | Name/description |
| ZUWEG_ROOT | path root flag | INTEGER | Value |
| LAND_ID | country id | INTEGER | Identifier |
| LAND_OK | country allowed flag | INTEGER | Value |

## TZUWEGKNOTEN — Path node

| Original | English | Type | Description |
|---|---|---|---|
| ZUWEG_ID | path id | INTEGER | Identifier |
| KNOTEN_ID | node id | INTEGER | Identifier |
| KNOTEN_KZ | node code | varchar | Code |
| KNOTEN_SORT | node sort order | INTEGER | Sort order |
| KNOTEN_BEZ | node name | varchar | Name/description |
| KNOTEN_HELP | node help text | varchar | Help text |
| KNOTEN_GRAPH | node graphic | varchar | Graphic reference |
| VARIANT_ART | variant type | INTEGER | Value |
| VARIANT_WERT | variant value | INTEGER | Value |
| VATER_ID | parent node id | INTEGER | Identifier |
| LAND_ID | country id | INTEGER | Identifier |
| LAND_OK | country allowed flag | INTEGER | Value |
