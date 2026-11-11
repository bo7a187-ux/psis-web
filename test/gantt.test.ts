import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readWorkbookFile } from '../src/core/readFile';
import { runImport, pickSheet, findDataDate, DEFAULT_IMPORT_OPTIONS } from '../src/core/importer';
import { calcActivities } from '../src/core/engine';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { emptyClassification } from '../src/core/classify';
import { ganttGroups, ganttSpan, monthTicks, weekTicks } from '../src/core/gantt';
import { fmtDate, fromYMD, toYMD } from '../src/core/dates';
import { FIX } from './helpers';

const wb = readWorkbookFile('sample.xer', new Uint8Array(readFileSync(join(FIX, 'sample.xer'))));
const si = pickSheet(wb.sheets, {});
const imp = runImport(wb.sheets[si].rows, wb.sheets[si].name, wb.date1904, {}, DEFAULT_IMPORT_OPTIONS);
const dd = findDataDate(wb.sheets, false)!;
const rows = calcActivities({ activities: imp.activities, settings: { ...DEFAULT_SETTINGS, dataDate: dd, baselineUse: 'Current import' }, classification: emptyClassification() }).filter((r) => r.included);

describe('Timeline (Gantt) data', () => {
  it('groups by WBS in code order and sorts activities by start', () => {
    const g = ganttGroups(rows, 'wbs');
    expect(g.map((x) => x.key)).toEqual(['TWR-P2', 'TWR-P2.CIV.FDN']);
    expect(g[0].bars.map((b) => b.row.a.id)).toEqual(['A1000', 'A1030']);
    expect(g[1].bars.map((b) => b.row.a.id)).toEqual(['A1010', 'A1020']);
  });
  it('bars use actual dates first, then current dates; flags milestone, critical and completed', () => {
    const b = ganttGroups(rows, 'none')[0].bars;
    const by = (id: string) => b.find((x) => x.row.a.id === id)!;
    expect(fmtDate(by('A1010').start)).toBe('05-Jan-26');
    expect(fmtDate(by('A1010').finish)).toBe('21-Feb-26');
    expect(by('A1010').critical).toBe(true);
    expect(by('A1030').milestone).toBe(true);
    expect(by('A1000').completed).toBe(true);
    expect(by('A1010').done).toBeCloseTo(0.6, 9);
  });
  it('group span and full span include baselines and the data date', () => {
    const g = ganttGroups(rows, 'wbs');
    expect(fmtDate(g[1].start)).toBe('05-Jan-26');
    const [lo, hi] = ganttSpan(g, dd, 0)!;
    expect(fmtDate(lo)).toBe('04-Jan-26');
    expect(fmtDate(hi)).toBe('20-Mar-26');
  });
  it('month ticks and Monday week ticks', () => {
    expect(monthTicks(fromYMD(2026, 1, 15)!, fromYMD(2026, 4, 2)!).map((m) => m.label)).toEqual(['Feb 26', 'Mar 26', 'Apr 26']);
    const w = weekTicks(fromYMD(2026, 11, 1)!, fromYMD(2026, 11, 20)!);
    expect(w.map(fmtDate)).toEqual(['02-Nov-26', '09-Nov-26', '16-Nov-26']);
    expect(new Date(Date.UTC(toYMD(w[0]).y, toYMD(w[0]).m - 1, toYMD(w[0]).d)).getUTCDay()).toBe(1);
  });
});
