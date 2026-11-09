import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readXlsx } from '../src/core/xlsx';
import { runImport, pickSheet, DEFAULT_IMPORT_OPTIONS } from '../src/core/importer';
import { fmtDate } from '../src/core/dates';
import { calcActivities } from '../src/core/engine';
import { validate } from '../src/core/validate';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { emptyClassification } from '../src/core/classify';
import { FIX } from './helpers';

const wb = readXlsx(new Uint8Array(readFileSync(join(FIX, 'messy_export.xlsx'))));
const sheet = wb.sheets[pickSheet(wb.sheets, {})];
const imp = runImport(sheet.rows, sheet.name, wb.date1904, {}, { ...DEFAULT_IMPORT_OPTIONS, durationUnit: 'Hours', hoursPerDay: 8 });
const by = (id: string) => imp.activities.find((a) => a.id === id)!;

describe('Messy export', () => {
  it('picks the activity sheet and skips the title row', () => {
    expect(sheet.name).toBe('Activities');
    expect(imp.headerStart).toBe(1);
    expect(imp.headerRows).toBe(1);
  });
  it('maps alternative names in any order', () => {
    expect(imp.matches.id.matchedHeader).toBe('Activity Code');
    expect(imp.matches.blStart.matchedHeader).toBe('BL1 Start');
    expect(imp.matches.totalFloat.matchedHeader).toBe('TF');
    expect(imp.unusedColumns.map((c) => c.header1)).toEqual(['Unknown Column']);
  });
  it('converts hours to days and reads mixed % formats on the 0-1 scale', () => {
    expect(by('A100').origDur).toBe(10);
    expect(by('A100').totalFloat).toBe(-2);
    expect(imp.matches.physPct.scale).toBe(1);
    expect(by('A100').physPct).toBe(0.5);
    expect(by('A110').physPct).toBeCloseTo(0.45, 12);
    expect(by('A130').physPct).toBeNull(); // blank stays blank, not 0
  });
  it('reads text dates with time and " A" markers, and numeric d/m/y', () => {
    expect(fmtDate(by('A100').actStart)).toBe('05-Jan-26');
    expect(fmtDate(by('A110').blFinish)).toBe('28-Feb-26');
  });
  it('reads currency text amounts', () => {
    expect(by('A100').budgetCost).toBe(1200.5);
    expect(by('A110').budgetCost).toBe(3000);
  });
  it('reports what it cannot read instead of guessing', () => {
    const probs = imp.cellIssues.filter((c) => c.severity === 'Critical').map((c) => `${c.activityId}:${c.field}`);
    expect(probs).toContain('A120:blFinish'); // 31/02/2026
    expect(probs).toContain('A130:origDur'); // "ten"
    expect(by('A120').blFinish).toBeNull();
    expect(imp.ignoredRows.length).toBe(1); // stray note row
  });
  it('validation: duplicate ID, missing ID, invalid values, missing baseline are reported', () => {
    const rows = calcActivities({ activities: imp.activities, settings: { ...DEFAULT_SETTINGS, dataDate: 46080, baselineUse: 'Current import' }, classification: emptyClassification() });
    const rep = validate(imp, rows, { ...DEFAULT_SETTINGS, dataDate: 46080 });
    const c = (id: string) => rep.checks.find((x) => x.id === id)!.count;
    expect(c('dup')).toBe(2);
    expect(c('noid')).toBe(1);
    expect(c('invalid')).toBe(2);
    expect(c('nobl')).toBe(2); // A120 (bad finish) + A130 (blank)
    expect(c('noprog')).toBe(2); // A130 + the row without ID: blank physical %
    expect(c('reqcols')).toBe(0);
    expect(rep.criticalCount).toBe(5);
  });
});
