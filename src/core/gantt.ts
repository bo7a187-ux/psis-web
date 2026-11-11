/**
 * Data for the timeline (Gantt) view: activities grouped and ordered, the time span, and the
 * month / week ticks of the scale. Read-only - nothing here changes any figure.
 */
import type { CalcRow } from './engine';
import { fromYMD, toYMD, type Day } from './dates';
import { MONTHS } from './dates';
import type { Dimension } from './classify';

export type GanttGroupBy = 'wbs' | Dimension | 'none';

export interface GanttBar {
  row: CalcRow;
  start: Day | null;
  finish: Day | null;
  blStart: Day | null;
  blFinish: Day | null;
  /** 0..1, null = unknown */
  done: number | null;
  milestone: boolean;
  critical: boolean;
  completed: boolean;
}
export interface GanttGroup { key: string; label: string; bars: GanttBar[]; start: Day | null; finish: Day | null }

const min = (xs: (Day | null)[]) => xs.reduce<Day | null>((m, x) => (x != null && (m == null || x < m) ? x : m), null);
const max = (xs: (Day | null)[]) => xs.reduce<Day | null>((m, x) => (x != null && (m == null || x > m) ? x : m), null);

export function toBar(r: CalcRow): GanttBar {
  const a = r.a;
  const start = a.actStart ?? a.start ?? r.blStart;
  const finish = a.actFinish ?? a.finish ?? r.blFinish;
  return {
    row: r, start, finish: finish != null && start != null && finish < start ? start : finish,
    blStart: r.blStart, blFinish: r.blFinish, done: r.actual, milestone: r.isMilestone,
    critical: r.critical, completed: r.status === 'Completed',
  };
}

export function ganttGroups(rows: CalcRow[], by: GanttGroupBy): GanttGroup[] {
  const map = new Map<string, { label: string; bars: GanttBar[] }>();
  for (const r of rows) {
    const key = by === 'none' ? '' : by === 'wbs' ? r.a.wbs || '-' : r.cls[by];
    const label = by === 'wbs' ? (r.a.wbsName ? `${r.a.wbsName}` : r.a.wbs || '-') : key;
    if (!map.has(key)) map.set(key, { label, bars: [] });
    map.get(key)!.bars.push(toBar(r));
  }
  const groups = [...map].map(([key, g]) => {
    g.bars.sort((x, y) => (x.start ?? Infinity) - (y.start ?? Infinity) || (x.finish ?? Infinity) - (y.finish ?? Infinity) || x.row.a.id.localeCompare(y.row.a.id));
    return { key, label: g.label, bars: g.bars, start: min(g.bars.map((b) => b.start)), finish: max(g.bars.map((b) => b.finish)) };
  });
  // WBS in code order; other groupings by their first start
  return by === 'wbs'
    ? groups.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
    : groups.sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity));
}

/** First and last day shown: every bar, baseline and the data date, with a little margin. */
export function ganttSpan(groups: GanttGroup[], dataDate: Day | null, margin = 7): [Day, Day] | null {
  const all = groups.flatMap((g) => g.bars.flatMap((b) => [b.start, b.finish, b.blStart, b.blFinish]));
  const lo = min([...all, dataDate]), hi = max([...all, dataDate]);
  return lo == null || hi == null ? null : [lo - margin, hi + margin];
}

/** First day of each month inside the span, with its label (e.g. "Nov 26"). */
export function monthTicks(from: Day, to: Day): { day: Day; label: string; year: number }[] {
  const out: { day: Day; label: string; year: number }[] = [];
  let { y, m } = toYMD(from);
  for (;;) {
    const d = fromYMD(y, m, 1)!;
    if (d > to) break;
    if (d >= from) out.push({ day: d, label: `${MONTHS[m - 1]} ${String(y % 100).padStart(2, '0')}`, year: y });
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

/** Mondays inside the span (for the week grid at the largest zoom). */
export function weekTicks(from: Day, to: Day): Day[] {
  // serial 2 = Monday 02-Jan-1900 in the Excel day system used by the app
  const first = from + ((2 - (from % 7) + 7) % 7);
  const out: Day[] = [];
  for (let d = first; d <= to; d += 7) out.push(d);
  return out;
}
