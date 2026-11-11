import { describe, it, expect } from 'vitest';
import { delaySheets } from '../src/core/delayExport';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { AR } from '../src/ar';
import { writeXlsx } from '../src/core/xlsxWrite';
import { unzipSync, strFromU8 } from 'fflate';

describe('Delay report Excel in Arabic', () => {
  it('every label in the file has an Arabic translation', () => {
    const missing: string[] = [];
    const tx = (k: string) => { if (AR[k] == null) missing.push(k); return AR[k] ?? k; };
    delaySheets([], { ...DEFAULT_SETTINGS, dataDate: 46323 }, 'Delayed activities', 'x', 'P', 'ok', tx, true);
    expect(missing).toEqual([]);
  });
  it('Arabic sheets are right-to-left', () => {
    const sheets = delaySheets([], { ...DEFAULT_SETTINGS, dataDate: 46323 }, 'L', 'x', 'P', 'ok', (k) => AR[k] ?? k, true);
    const files = unzipSync(writeXlsx(sheets));
    expect(strFromU8(files['xl/worksheets/sheet1.xml'])).toContain('rightToLeft="1"');
    expect(strFromU8(files['xl/workbook.xml'])).toContain('تقرير التأخير');
  });
});
