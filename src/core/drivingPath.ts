/**
 * Driving path to one activity (usually a milestone): walk back through the predecessors whose
 * relationship leaves the smallest gap, i.e. the ones that set the activity's dates.
 * P6 does not export which relationships drive, so this is worked out from the current dates, the
 * relationship type and the lag, in calendar days: a gap up to TOLERANCE days (a weekend or a
 * holiday) still counts as driving. Approximate by nature - P6's own driving flag uses calendars.
 */
import type { CalcRow } from './engine';
import type { Day } from './dates';
import type { Relation } from './logic';

export const TOLERANCE = 3;

export interface PathLink { pred: string; succ: string; type: string; lag: number; gap: number }
export type PathEnd = 'started' | 'no-predecessor' | 'constraint' | null;
export interface DrivingPath {
  target: string;
  /** activities on the path, earliest first */
  rows: CalcRow[];
  links: PathLink[];
  /** why the walk stopped at each first activity of the path (by activity ID) */
  ends: Map<string, PathEnd>;
}

const startOf = (r: CalcRow) => r.a.actStart ?? r.a.start;
const finishOf = (r: CalcRow) => r.a.actFinish ?? r.a.finish;

/** calendar days between what the relationship asks for and the successor's date (0 = drives exactly) */
export function relationGap(type: string, lag: number, pred: CalcRow, succ: CalcRow): number | null {
  const ps = startOf(pred), pf = finishOf(pred), ss = startOf(succ), sf = finishOf(succ);
  switch (type) {
    case 'SS': return ps == null || ss == null ? null : ss - ps - lag;
    case 'FF': return pf == null || sf == null ? null : sf - pf - lag;
    case 'SF': return ps == null || sf == null ? null : sf - ps - lag;
    default: return pf == null || ss == null ? null : ss - pf - 1 - lag; // FS: next day after the finish
  }
}

export function drivingPath(rows: CalcRow[], relations: Relation[], targetId: string, dataDate: Day, tolerance = TOLERANCE): DrivingPath | null {
  const byId = new Map(rows.filter((r) => r.a.id).map((r) => [r.a.id.toLowerCase(), r]));
  const target = byId.get(targetId.trim().toLowerCase());
  if (!target) return null;
  const preds = new Map<string, Relation[]>();
  for (const rel of relations) {
    const k = rel.succ.toLowerCase();
    if (!preds.has(k)) preds.set(k, []);
    preds.get(k)!.push(rel);
  }
  const seen = new Set<string>([target.a.id.toLowerCase()]);
  const links: PathLink[] = [];
  const ends = new Map<string, PathEnd>();
  const queue: CalcRow[] = [target];
  while (queue.length) {
    const x = queue.shift()!;
    const k = x.a.id.toLowerCase();
    // work already started is driven by the progress and the data date, not by its predecessors
    if (x !== target && (x.a.actStart != null || (startOf(x) ?? Infinity) <= dataDate)) { ends.set(x.a.id, 'started'); continue; }
    const cands = (preds.get(k) ?? [])
      .map((rel) => ({ rel, p: byId.get(rel.pred.toLowerCase()) }))
      .filter((c): c is { rel: Relation; p: CalcRow } => !!c.p && c.p.status !== 'Completed')
      .map((c) => ({ ...c, gap: relationGap(String(c.rel.type), c.rel.lag ?? 0, c.p, x) }))
      .filter((c): c is { rel: Relation; p: CalcRow; gap: number } => c.gap != null);
    if (!cands.length) { ends.set(x.a.id, x.a.actStart != null ? 'started' : 'no-predecessor'); continue; }
    const min = Math.min(...cands.map((c) => c.gap));
    if (min > tolerance) { ends.set(x.a.id, 'constraint'); continue; }
    for (const c of cands.filter((y) => y.gap <= Math.max(min, 0) + 0.5)) {
      links.push({ pred: c.p.a.id, succ: x.a.id, type: String(c.rel.type), lag: c.rel.lag ?? 0, gap: Math.round(c.gap * 10) / 10 });
      const pk = c.p.a.id.toLowerCase();
      if (!seen.has(pk)) { seen.add(pk); queue.push(c.p); }
    }
  }
  const onPath = [...seen].map((k) => byId.get(k)!).sort((a, b) => (startOf(a) ?? 0) - (startOf(b) ?? 0) || (finishOf(a) ?? 0) - (finishOf(b) ?? 0));
  return { target: target.a.id, rows: onPath, links, ends };
}
