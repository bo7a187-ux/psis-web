import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readXlsx, type Grid, type RawCell } from '../src/core/xlsx';
import { readXls } from '../src/core/xls';
import { readWorkbookFile } from '../src/core/readFile';
import { runImport, pickSheet, DEFAULT_IMPORT_OPTIONS } from '../src/core/importer';
import { fmtDate } from '../src/core/dates';
import { FIX } from './helpers';

const bytes = (f: string) => new Uint8Array(readFileSync(join(FIX, f)));

/** Same cell as Excel shows it (dates compared as day serials, numbers to 9 digits). */
const norm = (c: RawCell): unknown => {
  if (c == null || c === '') return null;
  if (typeof c === 'object') return { d: Math.floor(c.d) };
  if (typeof c === 'number') return +c.toPrecision(9);
  return c;
};
const trim = (g: Grid) => {
  const out = g.map((r) => r.map(norm));
  for (const r of out) while (r.length && r[r.length - 1] == null) r.pop();
  while (out.length && out[out.length - 1].length === 0) out.pop();
  return out;
};

describe('Old .xls (Excel 97-2003) files', () => {
  it.each([
    ['SAMPLE_P6_Export', 'TASK'],
    ['p6_real_export', 'TASK'],
    ['messy_export', 'Activities'], // small file: workbook stream lives in the OLE mini stream
    ['xls_unicode', 'TASK'], // 800 Arabic/Latin strings: shared strings span many CONTINUE records
  ])('%s.xls gives exactly the same cells as the .xlsx', (name, sheet) => {
    const src = name === 'xls_unicode' ? bytes('xls_unicode.xlsx') : bytes(`${name}.xlsx`);
    const a = readXlsx(src);
    const b = readXls(bytes(`${name}.xls`));
    const sa = a.sheets.find((s) => s.name === sheet)!;
    const sb = b.sheets.find((s) => s.name === sheet)!;
    expect(sb, `sheet ${sheet}`).toBeTruthy();
    expect(trim(sb.rows)).toEqual(trim(sa.rows));
    expect(b.sheets.map((s) => s.name)).toEqual(a.sheets.map((s) => s.name));
  });

  it('reads an xlwt-written file: Arabic text, RK numbers, booleans, formula results', () => {
    const wb = readXls(bytes('xlwt_arabic.xls'));
    const r = wb.sheets[0].rows;
    expect(r[1][1]).toBe('حفر الأساسات');
    expect(r[2][1]).toBe('Footings – Zone B');
    expect(fmtDate((r[1][2] as { d: number }).d)).toBe('05-Jan-26');
    expect(r[1][4]).toBe(0.6);
    expect(r[3][5]).toBe(-3.25);
    expect(r[1][6]).toBe(true);
    expect(r[2][6]).toBe(false);
  });

  it('goes through the whole import like an .xlsx', () => {
    const wb = readWorkbookFile('export.xls', bytes('p6_real_export.xls'));
    expect(wb.format).toBe('xls');
    const s = wb.sheets[pickSheet(wb.sheets, {})];
    const imp = runImport(s.rows, s.name, wb.date1904, {}, DEFAULT_IMPORT_OPTIONS);
    expect(imp.activities).toHaveLength(5);
    expect(imp.cellIssues.filter((c) => c.severity === 'Critical')).toEqual([]);
    expect(imp.activities.find((x) => x.id === 'A1010')!.totalFloat).toBe(-3);
  });

  it('detects the format from the content, whatever the file name', () => {
    expect(readWorkbookFile('renamed.xlsx', bytes('p6_real_export.xls')).format).toBe('xls');
    expect(readWorkbookFile('renamed.xls', bytes('p6_real_export.xlsx')).format).toBe('xlsx');
    expect(() => readWorkbookFile('page.xls', new TextEncoder().encode('<html><table>'))).toThrow(/web page/);
    expect(() => readXls(new Uint8Array(600))).toThrow();
  });
});
