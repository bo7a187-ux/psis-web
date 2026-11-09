import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readXlsx, type Grid, type RawCell } from '../src/core/xlsx';
import { runImport, DEFAULT_IMPORT_OPTIONS, type ImportOptions } from '../src/core/importer';
import { DEFAULT_SETTINGS, type Settings } from '../src/core/settings';
import type { ClassificationConfig, Rule, Dimension } from '../src/core/classify';
import type { BaselineMap, PrevSnapshotRow } from '../src/core/engine';

export const FIX = join(__dirname, 'fixtures');
type J = any; // eslint-disable-line @typescript-eslint/no-explicit-any
export const REF: J = JSON.parse(readFileSync(join(FIX, 'workbook-reference.json'), 'utf8'));

export const isSerial = (x: J): x is { serial: number } => x != null && typeof x === 'object' && 'serial' in x;
export const ser = (x: J): number | null => (isSerial(x) ? Math.floor(x.serial) : null);

export function workbookGrid(): Grid {
  return REF.raw.map((r: J[]) => r.map((c: J): RawCell => (isSerial(c) ? { d: c.serial } : c ?? null)));
}

export function importWorkbookSample(opts: Partial<ImportOptions> = {}) {
  return runImport(workbookGrid(), 'RAW PRIMAVERA DATA', false, {}, { ...DEFAULT_IMPORT_OPTIONS, ...opts });
}

export function importP6Sample(opts: Partial<ImportOptions> = {}) {
  const wb = readXlsx(new Uint8Array(readFileSync(join(FIX, 'SAMPLE_P6_Export.xlsx'))));
  const sheet = wb.sheets.find((s) => s.name === 'TASK')!;
  return runImport(sheet.rows, sheet.name, wb.date1904, {}, { ...DEFAULT_IMPORT_OPTIONS, ...opts });
}

export const DATA_DATE = ser(REF.settings['Reporting Data Date'])!;

export function refSettings(over: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, dataDate: DATA_DATE, revisionUse: 'Rev-1', ...over };
}

export function refClassification(): ClassificationConfig {
  const dims: Dimension[] = ['phase', 'discipline', 'building', 'floor', 'location'];
  const rules: Rule[] = REF.rules.map((r: J[]) => ({
    field: r[0], type: r[1], text: String(r[2] ?? ''),
    values: Object.fromEntries(dims.map((d, i) => [d, r[3 + i] ?? ''])),
  }));
  return { lists: REF.lists, rules, overrides: [] };
}

export function refOriginal(): BaselineMap {
  const m: BaselineMap = new Map();
  for (const r of REF.originalBaseline) if (isSerial(r[1]) || isSerial(r[2])) m.set(String(r[0]).toLowerCase(), { start: ser(r[1]), finish: ser(r[2]) });
  return m;
}

export function refRevised(rev = 'Rev-1'): BaselineMap {
  const m: BaselineMap = new Map();
  for (const r of REF.revisedBaselines) if (r[0] === rev) m.set(String(r[2]).toLowerCase(), { start: ser(r[3]), finish: ser(r[4]) });
  return m;
}

/** Activity rows of the latest snapshot before the data date (SNAPSHOT ACTIVITIES history). */
export function refPrev(): Map<string, PrevSnapshotRow> {
  const dates = REF.snapshotActivities.map((r: J[]) => ser(r[0])!).filter((d: number) => d < DATA_DATE);
  const prevDate = Math.max(...dates);
  const m = new Map<string, PrevSnapshotRow>();
  for (const r of REF.snapshotActivities) if (ser(r[0]) === prevDate) m.set(String(r[1]).toLowerCase(), { actual: typeof r[9] === 'number' ? r[9] : null, blFinish: ser(r[11]) });
  return m;
}

/** Excel engine rows keyed by Activity ID: header name -> value */
export function refEngine(): Map<string, Record<string, J>> {
  const hdr: string[] = REF.engineHeader;
  const m = new Map<string, Record<string, J>>();
  for (const r of REF.engine) {
    const o: Record<string, J> = {};
    // duplicate header names (e.g. "Critical") keep the first and add #2
    hdr.forEach((h, i) => { const k = h in o ? `${h}#2` : h; o[k] = r[i]; });
    m.set(String(o['Activity ID']), o);
  }
  return m;
}

import type { Snapshot } from '../src/core/snapshot';
/** HISTORICAL SNAPSHOTS + SNAPSHOT ACTIVITIES of the workbook as Snapshot objects. */
export function refSnapshots(): Snapshot[] {
  return REF.history.map((h: J[]): Snapshot => {
    const d = ser(h[0])!;
    return {
      dataDate: d, savedAt: 'workbook',
      summary: {
        dataDate: d, weighting: h[1], planned: h[2], actual: h[3], variance: h[4], activities: h[5], completed: h[6], inProgress: h[7],
        notStarted: h[8], delayed: h[9] ?? null, critical: h[10] ?? null, negFloat: h[11] ?? null, spi: h[12] ?? null, note: h[13] ?? '',
      },
      activities: REF.snapshotActivities.filter((r: J[]) => ser(r[0]) === d).map((r: J[]) => ({
        id: r[1], project: r[2], phase: r[3], discipline: r[4], building: r[5], floor: r[6], weight: r[7],
        planned: r[8], actual: r[9], actualEarned: r[10], blFinish: ser(r[11]), fcFinish: ser(r[12]),
      })),
    };
  });
}
/** cell of a dumped sheet by Excel address, e.g. cell(REF.scheduleControl, 'C19') */
export function cell(sheet: J[][], addr: string): J {
  const m = addr.match(/^([A-Z]+)(\d+)$/)!;
  let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64;
  return sheet[+m[2] - 1]?.[c - 1];
}
