import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readWorkbookFile } from '../src/core/readFile';
import { runImport, pickSheet, findDataDate, DEFAULT_IMPORT_OPTIONS } from '../src/core/importer';
import { calcActivities } from '../src/core/engine';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { emptyClassification } from '../src/core/classify';
import { readLogic, relType } from '../src/core/logic';
import { dcma, type DcmaCheck } from '../src/core/dcma';
import { FIX } from './helpers';

function run(file: string) {
  const wb = readWorkbookFile(file, new Uint8Array(readFileSync(join(FIX, file))));
  const si = pickSheet(wb.sheets, {});
  const imp = runImport(wb.sheets[si].rows, wb.sheets[si].name, wb.date1904, {}, DEFAULT_IMPORT_OPTIONS);
  const dd = findDataDate(wb.sheets, false) ?? 0;
  const rows = calcActivities({ activities: imp.activities, settings: { ...DEFAULT_SETTINGS, dataDate: dd, baselineUse: 'Current import' }, classification: emptyClassification() });
  const logic = readLogic(wb.sheets, si, imp, 'Days', 8);
  const finish = Math.max(...rows.filter((r) => r.included).map((r) => r.a.finish ?? 0));
  const checks = dcma(rows, logic, dd, finish);
  return { imp, logic, checks, by: (id: string) => checks.find((c) => c.id === id) as DcmaCheck };
}

describe('Schedule logic from an XER file', () => {
  const { logic, imp } = run('sample.xer');
  it('reads relationships of the reported project only, lag in days of the successor calendar', () => {
    expect(logic.relationSheet).toBe('TASKPRED (XER)');
    expect(logic.relations).toEqual([
      { pred: 'A1000', succ: 'A1010', type: 'FS', lag: 0 },
      { pred: 'A1010', succ: 'A1020', type: 'SS', lag: 5 },
      { pred: 'A1020', succ: 'A1030', type: 'FS', lag: -2 },
    ]);
  });
  it('reads constraints, and does not list their columns as unused', () => {
    expect(logic.constraints?.get('a1030')).toEqual(['Finish On or Before']);
    expect(logic.constraints?.get('a1020')).toEqual(['Start On or After']);
    expect(imp.unusedColumns.map((c) => c.header1)).not.toContain('Primary Constraint');
  });
  it('normalises relationship types', () => {
    expect(['PR_FS', 'ss', 'Finish to Finish', 'Start-to-Finish'].map(relType)).toEqual(['FS', 'SS', 'FF', 'SF']);
  });
});

describe('DCMA 14-point checks', () => {
  const { checks, by } = run('sample.xer');
  it('runs all 14 checks in order', () => expect(checks.map((c) => c.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]));
  it('logic: start/finish milestones are exempt, every other open activity is linked', () => {
    expect(by('logic')).toMatchObject({ count: 0, total: 3, status: 'pass' });
  });
  it('leads, lags and relationship types', () => {
    expect(by('leads')).toMatchObject({ count: 1, status: 'fail' });
    expect(by('lags')).toMatchObject({ count: 1, total: 3, status: 'fail' });
    expect(by('reltypes')).toMatchObject({ count: 2, total: 3, status: 'fail' });
  });
  it('hard constraints count only hard types', () => {
    expect(by('hard')).toMatchObject({ count: 1, total: 3, status: 'fail' });
    expect(by('hard').items[0]).toEqual({ label: 'A1030 Handover', why: 'Finish On or Before' });
  });
  it('float, duration, dates and resources', () => {
    expect(by('highfloat')).toMatchObject({ count: 0, status: 'pass' });
    expect(by('negfloat')).toMatchObject({ count: 1, status: 'fail' });
    expect(by('highdur')).toMatchObject({ count: 0, status: 'pass' });
    expect(by('dates')).toMatchObject({ count: 0, status: 'pass' });
    expect(by('resources')).toMatchObject({ count: 0, status: 'pass' });
  });
  it('missed tasks, BEI and CPLI', () => {
    expect(by('missed')).toMatchObject({ count: 2, total: 3, status: 'fail' });
    expect(by('bei').value).toBeCloseTo(1 / 3, 9);
    expect(by('cpli').value).toBeCloseTo((33 - 3) / 33, 9);
    expect(by('cpt').status).toBe('na');
  });
});

describe('Excel export with a TASKPRED sheet, and without relationships', () => {
  it('reads the P6 Excel TASKPRED sheet (two header rows)', () => {
    const { logic } = run('p6_real_export.xlsx');
    expect(logic.relations).toEqual([{ pred: 'A1000', succ: 'A1010', type: 'FS', lag: 0 }]);
  });
  it('logic checks are marked "not available" with the reason when there are no relationships', () => {
    const { by, logic } = run('p6_no_baseline.xlsx');
    expect(logic.relations).toBeNull();
    expect(by('logic').status).toBe('na');
    expect(by('logic').reason).toMatch(/XER/);
    expect(by('hard').status).toBe('na');
    expect(by('negfloat').status).not.toBe('na');
  });
});
