/**
 * Look-ahead list: the open activities that work in the next weeks after the data date, with the
 * weeks in which each one is active. Uses the current P6 dates (actual start / remaining finish).
 */
import type { CalcRow } from './engine';
import type { Day } from './dates';
import type { XCell, XSheet } from './xlsxWrite';

export type LookShow = 'active' | 'starting' | 'finishing' | 'critical';
export const LOOK_SHOW: { v: LookShow; label: string }[] = [
  { v: 'active', label: 'All work in the period' }, { v: 'starting', label: 'Starting in the period' },
  { v: 'finishing', label: 'Finishing in the period' }, { v: 'critical', label: 'Critical work in the period' },
];

export interface LookItem {
  row: CalcRow;
  start: Day; finish: Day;
  /** starts / finishes inside the period */
  starts: boolean; finishes: boolean;
  /** active in week i of the period */
  weeks: boolean[];
}
export interface LookAhead { from: Day; to: Day; weekStarts: Day[]; items: LookItem[] }

export function lookAhead(rows: CalcRow[], dataDate: Day, weeks: number, show: LookShow = 'active'): LookAhead {
  const from = dataDate, to = dataDate + weeks * 7 - 1;
  const weekStarts = Array.from({ length: weeks }, (_, i) => from + i * 7);
  const items: LookItem[] = [];
  for (const r of rows) {
    if (!r.included || r.status === 'Completed') continue;
    const start = r.a.actStart ?? r.a.start, finish0 = r.a.finish ?? r.a.start;
    if (start == null || finish0 == null) continue;
    const finish = Math.max(start, finish0);
    // open work before the data date still runs from the data date
    const s = Math.max(start, from);
    if (s > to || finish < from) continue;
    const starts = start >= from && start <= to, finishes = finish >= from && finish <= to;
    if (show === 'starting' && !starts) continue;
    if (show === 'finishing' && !finishes) continue;
    if (show === 'critical' && !r.critical) continue;
    items.push({ row: r, start, finish, starts, finishes, weeks: weekStarts.map((w) => s <= w + 6 && finish >= w) });
  }
  items.sort((x, y) => x.start - y.start || x.finish - y.finish || x.row.a.id.localeCompare(y.row.a.id, undefined, { numeric: true }));
  return { from, to, weekStarts, items };
}

/** Excel sheet for the site: one row per activity, an "■" in each week it is active. */
export function lookAheadSheet(la: LookAhead, tx: (s: string) => string, fmt: (d: Day) => string, rtl = false): XSheet[] {
  const head = ['Activity ID', 'Activity Name', 'WBS', 'Discipline', 'Building', 'Floor', 'Status', 'Start', 'Finish', 'Rem. dur (d)', 'TF (d)', 'Critical'].map(tx);
  const weeks = la.weekStarts.map((w, i) => `${tx('W')}${i + 1} ${fmt(w)}`);
  const rows: XCell[][] = la.items.map((x) => [
    x.row.a.id, x.row.a.name, x.row.a.wbsName || x.row.a.wbs, x.row.cls.discipline, x.row.cls.building, x.row.cls.floor, tx(x.row.status),
    { d: x.start }, { d: x.finish }, x.row.a.remDur, x.row.tfDays, x.row.critical ? tx('Yes') : '',
    ...x.weeks.map((on) => (on ? '■' : '')),
  ]);
  return [{ name: tx('Look-ahead'), header: [...head, ...weeks], rows, widths: [14, 42, 24, 14, 14, 10, 12, 11, 11, 10, 8, 8, ...weeks.map(() => 12)], rtl }];
}
