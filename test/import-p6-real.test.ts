import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readXlsx, type Grid } from '../src/core/xlsx';
import { runImport, pickSheet, findDataDate, guessDataDate, DEFAULT_IMPORT_OPTIONS } from '../src/core/importer';
import { normHeader, headerUnit, FIELDS } from '../src/core/fields';
import { fmtDate, fromYMD } from '../src/core/dates';
import { FIX } from './helpers';

const load = (f: string) => {
  const wb = readXlsx(new Uint8Array(readFileSync(join(FIX, f))));
  const sheet = wb.sheets[pickSheet(wb.sheets, {})];
  return { wb, sheet, imp: runImport(sheet.rows, sheet.name, wb.date1904, {}, DEFAULT_IMPORT_OPTIONS) };
};

describe('Header normalisation (real P6 label decorations)', () => {
  it.each([
    ['(*)Total Float(d)', 'Total Float'],
    ['(*) BL Project Start', 'BL Project Start'],
    ['Original Duration(h)', 'Original Duration'],
    ['Physical % Complete(%)', 'Physical % Complete'],
    ['Physical %Complete', 'Physical % Complete'],
    ['Budgeted Total Cost (SAR)', 'Budgeted Total Cost'],
    ['ACTIVITY  ID', 'Activity ID'],
    ['Activity_ID', 'Activity ID'],
    ['Activity Name', 'Activity Name'],
    ['Activity\nStatus', 'Activity Status'],
  ])('%s matches %s', (a, b) => expect(normHeader(a)).toBe(normHeader(b)));

  it('reads the unit from the label', () => {
    expect(headerUnit('Original Duration(d)')).toBe('Days');
    expect(headerUnit('(*)Total Float (h)')).toBe('Hours');
    expect(headerUnit('Original Duration')).toBeNull();
    expect(headerUnit('', 'Remaining Duration[days]')).toBe('Days');
  });

  it('no two fields share an alias after normalisation', () => {
    const seen = new Map<string, string>();
    for (const f of FIELDS) for (const h of [...f.headers, ...(f.fallback?.headers ?? [])]) {
      const n = normHeader(h);
      expect(seen.get(n) ?? f.key, `"${h}" is used by ${seen.get(n)} and ${f.key}`).toBe(f.key);
      seen.set(n, f.key);
    }
  });
});

describe('Real-shaped P6 XLSX export', () => {
  const { sheet, imp } = load('p6_real_export.xlsx');
  const by = (id: string) => imp.activities.find((a) => a.id === id)!;

  it('picks TASK even when USERDATA comes first, and finds both header rows', () => {
    expect(sheet.name).toBe('TASK');
    expect(imp.headerStart).toBe(0);
    expect(imp.headerRows).toBe(2);
    expect(imp.activities).toHaveLength(5);
  });
  it('maps every required field and the "(*)"-marked columns without help', () => {
    for (const f of FIELDS.filter((x) => x.required)) expect(imp.matches[f.key].column, f.key).not.toBeNull();
    for (const k of ['totalFloat', 'critical', 'start', 'finish', 'actPct', 'budgetCost', 'physPct', 'origDur', 'remDur'] as const)
      expect(imp.matches[k].column, k).not.toBeNull();
    expect(imp.cellIssues.filter((c) => c.severity === 'Critical')).toEqual([]);
  });
  it('reads values correctly', () => {
    expect(by('A1010').origDur).toBe(20);
    expect(by('A1010').totalFloat).toBe(-3);
    expect(by('A1010').physPct).toBeCloseTo(0.6, 12);
    expect(by('A1010').budgetCost).toBe(125000);
    expect(fmtDate(by('A1010').start)).toBe('05-Jan-26');
    expect(fmtDate(by('A1010').blFinish)).toBe('30-Jan-26');
    expect(by('A1020').totalFloat).toBe(12.5);
    expect(imp.matches.origDur.unit).toBe('Days');
    expect(imp.matches.origDur.unitFromHeader).toBe(true);
  });
  it('suggests the data date from the activities', () => {
    const g = guessDataDate(imp.activities)!;
    expect(fmtDate(g.latestActual)).toBe('05-Jan-26');
    expect(fmtDate(g.value)).toBe('15-Feb-26');
  });
});

describe('P6 export in hours, with internal codes and no baseline columns', () => {
  const { imp } = load('p6_no_baseline.xlsx');
  const by = (id: string) => imp.activities.find((a) => a.id === id)!;

  it('converts "(h)" columns to days even when Import options say Days', () => {
    expect(imp.matches.origDur.unit).toBe('Hours');
    expect(by('B1').origDur).toBe(10);
    expect(by('B2').totalFloat).toBe(-2);
  });
  it('turns TK_/TT_ codes into P6 labels', () => {
    expect(by('B1').status).toBe('Completed');
    expect(by('B2').status).toBe('In Progress');
    expect(by('B3').status).toBe('Not Started');
    expect(by('B3').type).toBe('Finish Milestone');
  });
  it('falls back to Planned Start / Finish for the baseline and says so', () => {
    expect(imp.matches.blStart.source).toBe('fallback');
    expect(imp.matches.blFinish.source).toBe('fallback');
    expect(imp.matches.blStart.note).toMatch(/Planned Start/);
    expect(fmtDate(by('B2').blStart)).toBe('15-Jan-26');
    expect(imp.matches.start.matchedHeader).toBe('Start');
  });
  it('a saved mapping still beats the fallback', () => {
    const wb = readXlsx(new Uint8Array(readFileSync(join(FIX, 'p6_no_baseline.xlsx'))));
    const s = wb.sheets[pickSheet(wb.sheets, {})];
    const r = runImport(s.rows, s.name, wb.date1904, { blStart: { headers: ['Start'] } }, DEFAULT_IMPORT_OPTIONS);
    expect(r.matches.blStart.source).toBe('saved');
  });
});

describe('Data date written in the workbook', () => {
  it('finds a "Data Date" cell next to or below its label', () => {
    const right: Grid = [['Project', 'X'], ['Data Date', '08-Nov-26 08:00']];
    const below: Grid = [['proj_short_name', 'last_recalc_date'], ['Project', 'Data Date'], ['X', { d: fromYMD(2026, 10, 31)! }]];
    expect(fmtDate(findDataDate([{ name: 'a', rows: right }], false))).toBe('08-Nov-26');
    expect(fmtDate(findDataDate([{ name: 'b', rows: below }], false))).toBe('31-Oct-26');
    expect(findDataDate([{ name: 'c', rows: [['Activity ID', 'Start']] }], false)).toBeNull();
  });
});
