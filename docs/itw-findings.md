# ITW reverse-engineering (TIS disc) — findings

## Location scan
- Root: `/Users/emdzej/Documents/tis/`
- ITW images located in `/Users/emdzej/Documents/tis/GRAFIK/**/**/*.ITW`

## TIS app binaries (not directly present)
- `TIS.EXE` **not** found as standalone file (no `TIS.EXE` in tree).
- InstallShield archives present:
  - `/Users/emdzej/Documents/tis/WIN95/BMW/TIS/TIS.Z` (InstallShield Z archive)
  - `/Users/emdzej/Documents/tis/WIN95/BMW/TIS/SYSADM.Z` (InstallShield Z archive)
  - `/Users/emdzej/Documents/tis/DATA/DB.Z` (InstallShield Z archive)
  - `/Users/emdzej/Documents/tis/WIN95/BMW/TISCLNT/SYSADMCS/SYSADMCS.Z`
- `TIS.PKG` (from language dirs) lists `tis.exe`, `tis.ini`, `tisApp.ini`, etc. → indicates `TIS.EXE` is likely inside `TIS.Z`.
- `unshield l TIS.Z` **failed** (`Failed to open ... as InstallShield Cabinet File`).

### MZ markers inside TIS.Z
Found multiple `MZ` markers, but none have valid PE header at e_lfanew (likely compressed):
`[30220, 174369, 434657, 489259, 659105, 1101664, 1154869, 1402851, 1431779, 1539345, 1580392, 1626065, 1718844, 1748883, 1755769]`

## Relevant DLLs discovered
### `/Users/emdzej/Documents/tis/WIN95/BMW/TIS/SHARECD.DLL`
- Exports (objdump):
  - `CallMinimizedDosCmd`
  - `DecompressFile`  ← **relevant**
  - `shareCDDrive`
- Strings:
  - `DecompressFile`
  - `@(#) $Header: P:/bmw95/src/Sysadm95/Windows/sharecd/rcs/compress.cxx 1.1 1998/04/03 12:55:10 Fersch Exp $`
  - `CBitmap`, `LoadBitmapA`, `CreateBitmap`
- Suggests decompression code in `compress.cxx` inside SHARECD.DLL (BMW95 project). Algorithm unknown from strings alone.

### `/Users/emdzej/Documents/tis/WIN95/BMW/TIS/USHARECD.DLL`
- Export: `unshareCDDrive`

### `/Users/emdzej/Documents/tis/WIN95/BMW/TIS/DBINIT.DLL`
- Strings include decompression-related messages:
  - `IDS_SETUP_ETK_DECOMPRESS`
  - `IDS_SETUP_CANNOT_DECOMP_INDEX_SCRIPT`
  - `IDS_SETUP_CANNOT_DECOMP_COUNTRY_SCRIPT`
  - `IDS_SETUP_DECOMPRESS`
  - `BLOC-ERROR: DECOMPRESSION INIT`
  - `BUFFER-ERROR: DECOMPRESSION`

### `/Users/emdzej/Documents/tis/WIN95/ODBC/MSJTER32.DLL`
- Exports: `JetErrIDAForError`, `JetErrIDARawMessage`, `JetErrRawMessage`, `JetErrFormattedMessage`
- Likely unrelated (Jet error message DLL).

## Notes / next steps
- Likely need to **extract InstallShield Z** archives (TIS.Z, SYSADM.Z, DB.Z) to obtain `TIS.EXE` and other runtime DLLs.
- `unshield` doesn’t recognize `.Z`; need alternate extractor (e.g., `i5comp`/`isextract`/`7z`/Windows InstallShield).
- `SHARECD.DLL` contains `DecompressFile` and references `compress.cxx` (possible hint to algorithm). Might be worth disassembly if extraction of `TIS.EXE` proves difficult.
