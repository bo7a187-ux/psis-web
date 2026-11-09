import { describe, it, expect } from 'vitest';
import { writeXlsx } from '../src/core/xlsxWrite';
import { readXlsx } from '../src/core/xlsx';
import { delaySheets } from '../src/core/delayExport';
import { calcActivities } from '../src/core/engine';
import { exceptionList, NO_FILTER } from '../src/core/project';
import { importWorkbookSample, refSettings, refClassification, refOriginal, refRevised } from './helpers';
import { fmtDate } from '../src/core/dates';

describe('XLSX writer', () => {
  it('round trip: text, numbers, dates, percentages, special characters', () => {
    const bytes = writeXlsx([{ name: 'S', header: ['A', 'B', 'C', 'D', 'E'], rows: [['x & <y> "q"', 1.5, { d: 46334 }, { p: 0.835 }, { n1: -3.04 }], [null, 'ملف', { d: 46512 }, null, null]] }]);
    const wb = readXlsx(bytes);
    const r = wb.sheets[0].rows;
    expect(r[0]).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(r[1][0]).toBe('x & <y> "q"');
    expect(r[1][1]).toBe(1.5);
    expect(r[1][2]).toEqual({ d: 46334 });
    expect(r[1][3]).toBe(0.835);
    expect(r[2][1]).toBe('ملف');
    expect(r[2][2]).toEqual({ d: 46512 });
  });
});

describe('Delay report export', () => {
  const rows = calcActivities({ activities: importWorkbookSample().activities, settings: refSettings(), classification: refClassification(), original: refOriginal(), revised: refRevised() });
  const list = exceptionList(rows, refSettings(), NO_FILTER, 'Late finish forecast (days)');
  const wb = readXlsx(writeXlsx(delaySheets(list, refSettings(), 'Late finish forecast (days)', 'Whole project', 'Sample', 'DRAFT')));
  const sh = wb.sheets[0].rows;
  it('same columns as the Delay Analysis screen and one row per activity', () => {
    expect(sh[0]).toEqual(['Activity ID', 'Activity Name', 'Discipline', 'Floor', 'Planned %', 'Actual %', 'Var (pp)', 'BL Start', 'BL Finish', 'Fc: P6', 'Fc: Performance', 'Fc: Conservative', 'Selected forecast source', 'Finish delay (d)', 'Total Float (d)', 'Indicator']);
    expect(sh.length).toBe(1 + 19);
  });
  it('first row = SMP-1400, 47 days, dates as real dates', () => {
    expect(sh[1][0]).toBe('SMP-1400'); expect(sh[1][13]).toBe(47);
    expect(fmtDate((sh[1][8] as { d: number }).d)).toBe('03-Oct-26');
    expect(fmtDate((sh[1][11] as { d: number }).d)).toBe('19-Nov-26');
    expect(sh[1][6]).toBeCloseTo(-15, 9);
  });
  it('info sheet carries the report settings', () => expect(wb.sheets[1].rows.some((r) => r[0] === 'Data date' && r[1] === '08-Nov-26')).toBe(true));
});
