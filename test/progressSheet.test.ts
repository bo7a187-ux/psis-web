import { describe, it, expect } from 'vitest';
import { progressTemplate, readProgressSheet } from '../src/core/progressSheet';
import { writeXlsx } from '../src/core/xlsxWrite';
import { readXlsx, type Grid } from '../src/core/xlsx';

const H = { id: 'Activity ID', name: 'Activity Name', wbs: 'WBS', phase: 'Phase', building: 'Building', status: 'Status', start: 'Start', finish: 'Finish', p6: 'P6 %', actual: 'Actual % (enter)', item: 'Item', value: 'Value', project: 'Project', dataDate: 'Data date', howTo: 'How to', howToText: 'Fill the last column' };
const row = (id: string, p6: number) => ({ id, name: id, wbsName: 'W', phase: 'P', building: 'B', status: 'In Progress', start: 46300, finish: 46330, p6, current: null });

describe('Actual % Excel round trip', () => {
  it('template -> filled -> read back', () => {
    const sheets = progressTemplate([row('A1', 0.25), row('A2', 0), row('A3', 0.5)], 46323, 'SITCO', H);
    const wb = readXlsx(writeXlsx(sheets));
    const g = wb.sheets[0].rows;
    expect(g[0][9]).toBe('Actual % (enter)');
    expect(g[1][8]).toBe(25);
    g[1][9] = 60; g[3][9] = 100; // A1 60%, A3 done, A2 left empty
    const r = readProgressSheet(wb.sheets);
    expect(r.values).toEqual([{ id: 'A1', pct: 0.6, row: 2 }, { id: 'A3', pct: 1, row: 4 }]);
    expect(r.invalid).toEqual([]);
    expect(r.dataDateText).toBe('28-Oct-26');
  });
  it('reads 45%, fractions from %-formatted cells, Arabic headers and a title row; reports bad values', () => {
    const g: Grid = [
      ['تحديث الإنجاز - أكتوبر'],
      ['رمز النشاط', 'اسم النشاط', 'النسبة الفعلية (أدخلها)'],
      ['A1', 'x', '45%'], ['A2', 'x', 'abc'], ['A3', 'x', 150], ['A4', 'x', null],
    ];
    const r = readProgressSheet([{ name: 'S', rows: g }]);
    expect(r.values).toEqual([{ id: 'A1', pct: 0.45, row: 3 }]);
    expect(r.invalid.map((x) => x.id)).toEqual(['A2', 'A3']);
    const f = readProgressSheet([{ name: 'S', rows: [['Activity ID', 'Actual %'], ['A1', 0.3], ['A2', 1], ['A3', 0]] }]);
    expect(f.values.map((x) => x.pct)).toEqual([0.3, 1, 0]);
    // mixed column: numbers typed as 40 / 100 and one cell typed "55%" in Excel (stored 0.55)
    const m = readProgressSheet([{ name: 'S', rows: [['Activity ID', 'Actual %'], ['A1', 40], ['A2', 0.55], ['A3', 100], ['A4', 1]] }]);
    expect(m.values.map((x) => x.pct)).toEqual([0.4, 0.55, 1, 0.01]);
  });
  it('says so when the columns are missing', () => {
    expect(readProgressSheet([{ name: 'S', rows: [['Code', 'Pct'], ['A1', 5]] }]).error).toBe('no-columns');
  });
});
