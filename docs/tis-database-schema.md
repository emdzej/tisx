# TIS Database Schema

TIS uses **Microsoft Access (MDB)** database via ODBC (Microsoft Jet 3.0).

## Data Source

- **ODBC Driver:** Microsoft Access Driver (*.mdb)
- **DLL:** MSJT3032.DLL (Jet Engine), MSRD2X32.DLL (DAO)
- **Database file:** Created from compressed DATA/DB.Z + DATA/TIS.DMP

## Tables (from DBINIT.DLL)

### User/Config Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| `konfig` | mwst1, mwst2, atmwst, nachkomma, rechnr, haendler_pkw, haendler_mot, zusatz, firma, plz, ort, strasse, telefon, barkunde, mwst3, mwst4, warnhinweis, bildschirm, haendlersys, abwicklung, filiale, landeswaehrung, landescode | Main configuration |
| `usretk` | u_name, nr, pw, gruppe, pid, loginname, display | User accounts |
| `stdwerte_tb` | katalog, katalogausf, lenkung, sprachetyp, spracheben, username, userid, haendlersys_nr, waehrung | Standard values |
| `rechte` | grp_num, bestelliste, neuteileliste, zugriffrechte, teileliste_andre, mehrwertsteuer, produktiondatum, notiz, teileliste_loesche, an_handlersys, anlage_stammsatz, kopieren, teilnr_loeschen, zusammenfassen, liste_loeschen, preis_rabatt, betriebsys | User permissions |
| `maske` | sbl, szr, sntl | UI masks |

### Parts/Pricing Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| `teile_tb` | nr, menge, teilenummer, benennung, zusatz, upe, handlerpreis, atst, mwst, rabatt, bestand, bedarf, aume, dc, s, splitt, rechnungstrans, lagerort, status, snp, rabattcode, teileart, produktklasse, ord_nummer | Parts list |
| `preis_tb` | teilenummer, ep, nbpausch, rabattcode, prkz, prpro100, snp, mwst, mwstcode, zolltarifnr, np, spkz, reserve | Pricing |
| `Teilestamm_tb` | teilenummer, benennung, mwstcode, zolltarifnr, prpro100, fremdteile_kz, ep, datum | Parts master |
| `Teile_tb` | paketnr, teilenummer, benennung, menge, ep, mwst, kz, mwstcode | Package parts |

### Vehicle Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| `fzgid_tb` | nr, fgstnummer, bauart, typkey, baureihe, modell, baujahr, monat, getriebe, tueren, lenkung, la, katalog, katalogausf | Vehicle identification |
| `fuellmengen` | FUELLMENGEN_GETRIEBE, ... | Fuel quantities |

### Order/List Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| `auftrag_tb` | nr, datum, auftrag, kunde, fzgnr, name_kunde, bemerkung, status, ord_nummer | Orders |
| `bestelliste` | auftrag, kunde, teilenummer, benennung, menge, status, bemerkung | Order list |
| `neuteileliste` | teilenummer, menge, status, benennung, bemerkung | New parts list |
| `Listenverz_tb` | paketnr, benennung, datum | List directory |
| `Tagesabschluss_tb` | arbeitswert, bmw_teile, nicht_bmw_teile, mwst1-5 | Daily close |
| `Konfig_tb` | arbeitseinheit, teilepreisfaktor, waehrung, rechnr, thema | Config |
| `tlnotiz_tb` | datum, teilenummer, notiz | Part notes |

### Language Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| `spr_raw` / `spr_raw2` | SPR_ISO, SPR_REGISO, SPR_TEXTCODE, SPR_TEXT | Translations |

### SA (Service Action) Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| `bed_sala` | salapa_nr, ... | Service action links |
| `bed_anz` | ... | Service action counts |
| `sa_ben` | ... | Service action names |
| `code_nr` | ... | Code numbers |

## SQL Queries Found

### SELECT Queries

```sql
-- Config
select mwst1, mwst2, atmwst from konfig
select nachkomma, rechnr, haendler_pkw, haendler_mot,
       zusatz, firma, plz, ort, strasse, telefon, barkunde, mwst1,
       mwst2, atmwst, mwst3, mwst4, warnhinweis, bildschirm,
       haendlersys, abwicklung, filiale, landeswaehrung, landescode
       from konfig

-- Users
select u_name, nr, pw, gruppe, pid, loginname, display from usretk
select nr FROM usretk

-- Standard values
select katalog, katalogausf, lenkung, sprachetyp, spracheben,
       username, userid, haendlersys_nr, waehrung from stdwerte_tb

-- Rights
select grp_num, bestelliste, neuteileliste, zugriffrechte,
       teileliste_andre, mehrwertsteuer, produktiondatum, notiz,
       teileliste_loesche, an_handlersys, anlage_stammsatz, kopieren,
       teilnr_loeschen, zusammenfassen, liste_loeschen, preis_rabatt,
       betriebsys from rechte

-- Parts
select nr, teilenummer FROM teile_tb ORDER BY teilenummer
select nr, menge, teilenummer, benennung, zusatz, upe,
       handlerpreis, atst, mwst, rabatt, bestand, bedarf, aume, dc, s,
       splitt, rechnungstrans, lagerort, status, snp, rabattcode, teileart,
       produktklasse, ord_nummer from teile_tb
select teilenummer, benennung, mwstcode, zolltarifnr, prpro100,
       fremdteile_kz, ep, datum from Teilestamm_tb
select teilenummer, ep, nbpausch, rabattcode, prkz, prpro100,
       snp, mwst, mwstcode, zolltarifnr, np, spkz, reserve from preis_tb

-- Vehicles
select nr, fgstnummer, bauart, typkey, baureihe,
       modell, baujahr, monat, getriebe, tueren, lenkung, la,
       katalog, katalogausf from fzgid_tb

-- Orders
select nr, datum, auftrag, kunde, fzgnr,
       name_kunde, bemerkung, status, ord_nummer from auftrag_tb
select auftrag, kunde, teilenummer, benennung,
       menge, status, bemerkung from bestelliste
select teilenummer, menge, status, benennung, bemerkung
       from neuteileliste

-- Lists/Reports
select paketnr, benennung, datum from Listenverz_tb
select paketnr, teilenummer, benennung, menge, ep,
       mwst, kz, mwstcode from Teile_tb
select arbeitswert, bmw_teile, nicht_bmw_teile,
       mwst1, mwst2, mwst3, mwst4, mwst5 from Tagesabschluss_tb
select arbeitseinheit, teilepreisfaktor, waehrung, rechnr, thema
       from Konfig_tb
select datum, teilenummer, notiz from tlnotiz_tb

-- Masks
select sbl, szr, sntl from maske

-- SA (Service Actions)
select count( salapa_nr ) from bed_sala
```

### UPDATE Queries

```sql
update teile_tb set upe=?, handlerpreis=?, atst=?, mwst=? 
       where nr=? and teilenummer=?
UPDATE stdwerte_tb SET username='%s' WHERE userid=%d
UPDATE usretk SET loginname='%s' WHERE nr=%d
update fuellmengen set FUELLMENGEN_GETRIEBE='M' 
       where FUELLMENGEN_GETRIEBE='S'
update konfig SET landescode='  ', landeswaehrung='   '
update stdwerte_tb set waehrung='Land'
update usretk SET display=' '
```

### CREATE/ALTER Queries

```sql
-- Schema migrations
ALTER TABLE konfig ADD COLUMN landescode TEXT(2)
ALTER TABLE konfig ADD COLUMN landeswaehrung TEXT(3)
ALTER TABLE stdwerte_tb ADD COLUMN waehrung TEXT(4)
ALTER TABLE usretk ADD COLUMN display TEXT(20)
ALTER TABLE usretk ADD COLUMN loginname TEXT(20)

-- Language table recreation
CREATE TABLE spr_raw2 (
  SPR_ISO TEXT(2), 
  SPR_REGISO TEXT(2), 
  SPR_TEXTCODE INTEGER, 
  SPR_TEXT TEXT(142)
)
INSERT INTO spr_raw2 SELECT * FROM [spr_raw]
DROP TABLE spr_raw

-- Indexes
CREATE INDEX sprr_pk ON spr_raw2 (spr_iso, spr_regiso, spr_textcode) with primary
CREATE INDEX sprr_spr_iso ON spr_raw2 (spr_iso)
CREATE INDEX sprr_spr_regiso ON spr_raw2 (spr_regiso)
CREATE INDEX sprr_textcode ON spr_raw2 (spr_textcode)
CREATE INDEX sprr_text_iso ON spr_raw2 (spr_text, spr_iso)

-- SA tables (created during setup)
create table bed_anz ( ... )
create table bed_sala ( ... )
create table code_nr ( ... )
create table sa_ben ( ... )
```

### DELETE Queries

```sql
DELETE FROM bed_anz
DELETE FROM bed_sala
DELETE FROM code_nr
DELETE FROM sa_ben
```

## Database Initialization

From `DBINIT.DLL`:

1. `SetupTISDataBase()` - Creates main TIS database
2. `SetupETKDataBase()` - Creates ETK (parts catalog) database
3. `UpdateETKDataBase()` - Updates ETK schema/data
4. `UpdateEtkRelDB()` - Updates related database

## Data Files

| File | Description |
|------|-------------|
| `DATA/DB.Z` | InstallShield archive with database files (91MB) |
| `DATA/TIS.DMP` | Compressed database dump (31MB) |
| `DATA/COUNTRY.SQL` | Country-specific SQL (compressed) |
| `DATA/INDEX.SQL` | Index creation SQL (compressed) |
| `DATA/ISO.LST` | ISO language/country list |

## Notes

- TIS uses German column naming conventions
- VAT (MwSt) fields: mwst1-5 for different tax rates
- Parts pricing: upe (UPE), handlerpreis (dealer price), ep (Einzelpreis)
- The database stores both parts catalog data and workshop order management
