import { describe, it, expect } from 'vitest';
import { importP6Sample, importWorkbookSample } from './helpers';
import { FIELDS } from '../src/core/fields';
import { parseDateText, fromYMD, fmtDate } from '../src/core/dates';
import { parseDuration, scalePct, runImport, DEFAULT_IMPORT_OPTIONS } from '../src/core/importer';

describe('Date parsing', () => {
  const d = (y: number, m: number, dd: number) => fromYMD(y, m, dd);
  it.each([
    ['08-Nov-26', d(2026, 11, 8)], ['8-Nov-2026', d(2026, 11, 8)], ['01-Mar-26 A', d(2026, 3, 1)], ['01-Mar-26*', d(2026, 3, 1)],
    ['01-Mar-26 08:00 A', d(2026, 3, 1)], ['2026-11-08', d(2026, 11, 8)], ['2026-11-08T00:00:00', d(2026, 11, 8)],
    ['08/11/2026', d(2026, 11, 8)], ['Nov 8, 2026', d(2026, 11, 8)], ['08 November 2026', d(2026, 11, 8)],
  ])('%s', (t, exp) => expect(parseDateText(t).value).toBe(exp));
  it('reports instead of guessing', () => {
    expect(parseDateText('31-Feb-26').error).toBeTruthy();
    expect(parseDateText('13/25/2026').error).toBeTruthy();
    expect(parseDateText('next week').error).toBeTruthy();
  });
  it('MDY order when chosen', () => expect(parseDateText('11/08/2026', 'MDY').value).toBe(d(2026, 11, 8)));
  it('formats dd-Mmm-yy', () => expect(fmtDate(d(2026, 11, 8))).toBe('08-Nov-26'));
});

describe('Durations and percentages', () => {
  it('reads units', () => {
    expect(parseDuration('14d', 'Days', 8).value).toBe(14);
    expect(parseDuration('112h', 'Days', 8).value).toBe(14);
    expect(parseDuration(112, 'Hours', 8).value).toBe(14);
    expect(parseDuration('1,200', 'Days', 8).value).toBe(1200);
    expect(parseDuration('3w', 'Days', 8).error).toBeTruthy();
  });
  it('detects % scale', () => {
    expect(scalePct([0, 45, 100]).scale).toBe(100);
    expect(scalePct([0, 0.45, 1]).scale).toBe(1);
    expect(scalePct([0, 1]).note).toBeTruthy();
  });
});

describe('Sample P6 export (2 header rows, text dates, "d" durations)', () => {
  const imp = importP6Sample();
  it('detects 2 header rows on sheet TASK', () => {
    expect(imp.headerRows).toBe(2);
    expect(imp.headerStart).toBe(0);
  });
  it('maps every standard field', () => {
    const missing = FIELDS.filter((f) => imp.matches[f.key].column == null).map((f) => f.label);
    expect(missing).toEqual([]);
  });
  it('reads 84 activities with no unreadable values', () => {
    expect(imp.activities.length).toBe(84);
    expect(imp.cellIssues.filter((c) => c.severity === 'Critical')).toEqual([]);
  });
  it('reads actual dates with " A" and % on 0-100 scale', () => {
    const a = imp.activities.find((x) => x.id === 'SMP-1030')!;
    expect(fmtDate(a.actStart)).toBe('01-Mar-26');
    expect(fmtDate(a.actFinish)).toBe('30-Mar-26');
    expect(a.origDur).toBe(30);
    expect(a.physPct).toBe(1);
    expect(imp.matches.physPct.scale).toBe(100);
  });
});

describe('Both samples give identical activities', () => {
  const p6 = importP6Sample();
  const wb = importWorkbookSample();
  it('workbook raw data has 1 header row', () => expect(wb.headerRows).toBe(1));
  it('same values field by field', () => {
    expect(wb.activities.length).toBe(p6.activities.length);
    const byId = new Map(wb.activities.map((a) => [a.id, a]));
    const diffs: string[] = [];
    for (const a of p6.activities) {
      const b = byId.get(a.id)!;
      for (const f of FIELDS) {
        const x = (a as any)[f.key], y = (b as any)[f.key]; // eslint-disable-line @typescript-eslint/no-explicit-any
        const same = typeof x === 'number' && typeof y === 'number' ? Math.abs(x - y) < 1e-9 : x === y;
        if (!same) diffs.push(`${a.id} ${f.key}: P6=${x} WB=${y}`);
      }
    }
    expect(diffs).toEqual([]);
  });
});

describe('Shuffled and renamed columns (S9)', () => {
  it('maps by name regardless of order, and saved names are used', () => {
    const base = importWorkbookSample();
    const grid = [
      ['Name of activity', 'Code', 'BL Project Finish', 'BL Project Start', 'Physical % Complete'],
      ['Task A', 'A1', '30-Jan-26', '01-Jan-26', '50%'],
    ];
    const r1 = runImport(grid, 'x', false, {}, DEFAULT_IMPORT_OPTIONS);
    expect(r1.matches.id.column).toBeNull(); // "Code" is not a known name...
    const r2 = runImport(grid, 'x', false, { id: { headers: ['Code'] }, name: { headers: ['Name of activity'] } }, DEFAULT_IMPORT_OPTIONS);
    expect(r2.matches.id.column).toBe(1); // ...until the user maps it once
    expect(r2.activities[0].id).toBe('A1');
    expect(r2.activities[0].physPct).toBe(0.5);
    expect(fmtDate(r2.activities[0].blStart)).toBe('01-Jan-26');
    expect(base.activities.length).toBe(84);
  });
});
