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
