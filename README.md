# Project Schedule Intelligence (web)

Browser-only version of the Excel tool *Project Schedule Intelligence System*:
Primavera P6 schedule analysis and management reporting.

- Runs 100% in the browser. No server, no login. The built page forbids all
  network connections (Content-Security-Policy `connect-src 'none'`).
- Data is stored in the browser (IndexedDB) on the user's computer.
- Reference for every calculation: the ACTIVITIES ENGINE sheet of the workbook.

## Status
- Stage 1 (done): import (XLSX/CSV, 1 or 2 header rows, text/real dates, hours/days,
  % on 0-1 or 0-100), column mapping with saved names, validation, classification
  (rules + overrides), settings, cleaned activity table. The per-activity engine is
  in place and matches the Excel engine column by column on the sample.
- Stage 2 (done): project-level calculations (KPIs, SPI, health, groups, exception lists, S-curve, trend), SHA-256 approval fingerprint, 95 tests, comparison report in reports/.
- Stage 3 (done): executive dashboard (dark navy), schedule control + heatmap, delay analysis, calculation audit, filters. Stage 4: history, snapshots, baselines, backup file. Stage 5: report + PDF.

## File formats
- **.xer** (native P6 export, recommended): TASK, PROJECT, PROJWBS, CALENDAR, TASKRSRC and PROJCOST
  are read directly (`src/core/xer.ts`). Hours are converted with each activity's calendar, the WBS
  code path is rebuilt, the baseline comes from the project's baseline copy when it is in the file
  (else Planned Start/Finish, flagged), the data date from `last_recalc_date`. Text encoding:
  UTF-8, Windows-1256 (Arabic) or Windows-1252, detected automatically.
- **.xlsx / .xlsm** and **.csv**, as before.
- **.xls** (Excel 97-2003, older P6): own BIFF8 reader (`src/core/xls.ts`), no third-party parser.
- The format is detected from the file content, not the name.

## Languages
- English and Arabic (right-to-left), switch in the top bar; the choice is remembered.
  Default follows the browser language. English text is the key (`t('...')` in `src/i18n.tsx`);
  the Arabic text is in `src/ar.ts`. `test/i18n.test.ts` fails if any interface text has no
  Arabic translation. The Arabic font (IBM Plex Sans Arabic) is embedded, so the page still needs
  no network access. The delay report Excel file stays in English.

## P6 import
- Columns are matched by name after normalising the labels real P6 exports use:
  `(*)` read-only markers, units such as `Original Duration(d)` / `Total Float(h)`,
  `_` / `-` / extra spaces, any capitalisation. A `(d)` or `(h)` in the header sets the
  unit of that column, whatever the Import option says.
- P6 internal codes (`TK_Active`, `TT_Mile`, ...) are turned into the labels P6 shows.
- No baseline columns: Planned Start / Finish are used and the user is told so.
- Data date: read from the file when it states one (`Data Date` / `last_recalc_date`),
  otherwise suggested from the activities (one click to accept).
- The Import page has a built-in "How to export from P6" guide, the column list and an
  empty template.
- Fixtures shaped like a real export: `test/fixtures/p6_real_export.xlsx`,
  `p6_no_baseline.xlsx` (`tools/make_p6_fixture.py`), tested in `test/import-p6-real.test.ts`;
  XER fixtures from `tools/make_xer_fixture.py`; `.xls` fixtures converted from the `.xlsx` ones
  with LibreOffice and compared cell by cell in `test/import-xls.test.ts`.

## Developer commands
```
npm install
npm test               # automated tests
npm run dev            # local development server
npm run build          # static site in dist/ (GitHub Pages / Netlify)
npm run build:single   # one self-contained HTML file in dist-single/
```

## Test fixtures
- `test/fixtures/SAMPLE_P6_Export.xlsx` - fictional P6-style export (SAMPLE DATA).
- `test/fixtures/workbook-reference.json` - sample data and results extracted from the
  workbook after recalculation (`tools/extract_reference.py`).
- `test/fixtures/messy_export.xlsx` - awkward export for importer robustness
  (`tools/make_messy_fixture.py`).
