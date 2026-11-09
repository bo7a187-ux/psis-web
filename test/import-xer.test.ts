import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readWorkbookFile } from '../src/core/readFile';
import { decodeXer, parseXer, xerDate } from '../src/core/xer';
import { runImport, pickSheet, findDataDate, DEFAULT_IMPORT_OPTIONS } from '../src/core/importer';
import { calcActivities } from '../src/core/engine';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { emptyClassification } from '../src/core/classify';
import { fmtDate } from '../src/core/dates';
import { FIELDS } from '../src/core/fields';
import { FIX } from './helpers';

const open = (f: string) => {
  const wb = readWorkbookFile(f, new Uint8Array(readFileSync(join(FIX, f))));
  const s = wb.sheets[pickSheet(wb.sheets, {})];
  // Import options deliberately say Hours: XER columns carry "(d)" and must not be converted again.
  const imp = runImport(s.rows, s.name, wb.date1904, {}, { ...DEFAULT_IMPORT_OPTIONS, durationUnit: 'Hours' });
  return { wb, s, imp, by: (id: string) => imp.activities.find((a) => a.id === id)! };
};

describe('XER basics', () => {
  it('parses tables, fields and rows', () => {
    const t = parseXer('ERMHDR\t19.12\n%T\tTASK\n%F\ttask_id\ttask_code\n%R\t1\tA1\n%R\t2\tA2\n%T\tPROJECT\n%F\tproj_id\n%R\t9\n%E\n');
    expect(t.TASK).toEqual([{ task_id: '1', task_code: 'A1' }, { task_id: '2', task_code: 'A2' }]);
    expect(t.PROJECT).toEqual([{ proj_id: '9' }]);
  });
  it('reads XER dates', () => {
    expect(fmtDate(xerDate('2026-01-05 07:00'))).toBe('05-Jan-26');
    expect(xerDate('')).toBeNull();
  });
});

describe('XER with a baseline project and two calendars', () => {
  const { wb, s, imp, by } = open('sample.xer');

  it('is detected as XER and reports only the schedule, not its baseline copy', () => {
    expect(wb.format).toBe('xer');
    expect(s.name).toBe('TASK (XER)');
    expect(imp.activities.map((a) => a.id)).toEqual(['A1000', 'A1010', 'A1020', 'A1030', 'A1040', 'WBS-CIV']);
    expect(wb.info[0]).toMatch(/TWR-P2/);
  });
  it('maps every field it provides with no help and no unreadable values', () => {
    for (const f of FIELDS.filter((x) => x.required)) expect(imp.matches[f.key].source, f.key).toBe('default');
    expect(imp.cellIssues).toEqual([]);
  });
  it('converts hours with each activity calendar (8 h and 10 h days)', () => {
    expect(by('A1010').origDur).toBe(20); // 200 h / 10 h
    expect(by('A1010').remDur).toBe(6);
    expect(by('A1010').totalFloat).toBe(-3);
    expect(by('A1020').origDur).toBe(15); // 120 h / 8 h
    expect(by('A1020').totalFloat).toBe(12.5);
  });
  it('takes baseline dates from the baseline project, matched by Activity ID', () => {
    expect(fmtDate(by('A1010').blFinish)).toBe('24-Jan-26'); // baseline copy, not the planned 26-Jan
    expect(fmtDate(by('A1030').blFinish)).toBe('28-Feb-26');
    expect(by('A1040').blStart).toBeNull(); // not in the baseline -> reported by validation, not guessed
  });
  it('builds Start / Finish like P6 (actual first, then remaining early dates)', () => {
    expect(fmtDate(by('A1010').start)).toBe('05-Jan-26');
    expect(fmtDate(by('A1010').finish)).toBe('21-Feb-26');
    expect(fmtDate(by('A1020').start)).toBe('22-Feb-26');
  });
  it('labels, WBS path, critical flag, percentages and costs', () => {
    expect(by('A1010').status).toBe('In Progress');
    expect(by('A1030').type).toBe('Finish Milestone');
    expect(by('A1010').wbs).toBe('TWR-P2.CIV.FDN');
    expect(by('A1010').wbsName).toBe('Foundations');
    expect(by('A1010').projectName).toBe('Riyadh Tower - Package 2');
    expect(by('A1010').critical).toBe('Yes');
    expect(by('A1010').physPct).toBeCloseTo(0.6, 12);
    expect(by('A1010').durPct).toBeCloseTo(0.7, 12);
    expect(by('A1010').unitsPct).toBeCloseTo(0.7, 12);
    expect(by('A1020').actPct).toBe(0); // CP_Drtn -> duration %
    expect(by('A1010').budgetCost).toBe(150000);
    expect(by('A1010').actualCost).toBe(85000);
    expect(by('A1010').budgetUnits).toBe(2000);
  });
  it('gives the data date from PROJECT.last_recalc_date', () => {
    expect(fmtDate(findDataDate(wb.sheets, false))).toBe('15-Feb-26');
  });
  it('runs through the engine (WBS summary rows excluded)', () => {
    const rows = calcActivities({ activities: imp.activities, settings: { ...DEFAULT_SETTINGS, dataDate: findDataDate(wb.sheets, false), baselineUse: 'Current import' }, classification: emptyClassification() });
    expect(rows.find((r) => r.a.id === 'WBS-CIV')!.included).toBe(false);
    expect(rows.find((r) => r.a.id === 'A1010')!.status).toBe('In Progress');
  });
});

describe('XER saved by Arabic Windows (Windows-1256), no baseline', () => {
  const { wb, imp, by } = open('sample_arabic_1256.xer');
  it('decodes the Arabic names', () => {
    expect(wb.info.join(' ')).toMatch(/windows-1256/);
    expect(by('H110').name).toBe('صب خرسانة القواعد');
    expect(by('H110').wbsName).toBe('الأعمال الإنشائية');
  });
  it('falls back to planned dates for the baseline and says so', () => {
    expect(imp.matches.blStart.source).toBe('fallback');
    expect(fmtDate(by('H110').blStart)).toBe('13-Jan-26');
    expect(by('H110').totalFloat).toBe(-2);
  });
  it('keeps Latin-1 text as Windows-1252', () => {
    const bytes = new Uint8Array([...new TextEncoder().encode('ERMHDR\n%T\tTASK\n%F\ttask_name\n%R\tB'), 0xe9, ...new TextEncoder().encode('ton\n')]);
    expect(decodeXer(bytes).text).toContain('Béton');
  });
});
