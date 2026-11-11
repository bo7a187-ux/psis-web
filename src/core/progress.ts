/**
 * Actual % entered by the engineer in the app (instead of, or on top of, the P6 export).
 * Each value belongs to a data date: it is used only while the project data date is the same,
 * so last month's entries never leak into this month. The entered value replaces the field
 * chosen as "Actual % source" and sets the status (0 < % < 100: In Progress, 100%: Completed).
 *
 * Actual dates: P6 needs an actual start for any progress and an actual finish at 100%. When the
 * file has none, the date typed by the user is used, otherwise an estimate: actual finish = the day
 * before the data date, actual start = the planned start if it is before the data date, else the day
 * before the data date (never after the actual finish). Estimated dates are listed in Validation.
 */
import type { Activity } from './types';
import type { Day } from './dates';
import { ACTUAL_FIELD, type ActualSource } from './settings';

export interface ProgressEntry {
  pct: number; dataDate: Day; at: string;
  /** actual start / finish typed by the user (used only when the P6 file has none) */
  as?: Day | null; af?: Day | null;
}
/** Activity ID (lower case) -> entry */
export type ProgressEntries = Record<string, ProgressEntry>;

export function applyProgress(acts: Activity[], entries: ProgressEntries | undefined, dataDate: Day | null, source: ActualSource): { activities: Activity[]; applied: number } {
  if (!entries || dataDate == null) return { activities: acts, applied: 0 };
  const field = ACTUAL_FIELD[source] as keyof Activity;
  let applied = 0;
  const out = acts.map((a) => {
    const e = a.id ? entries[a.id.toLowerCase()] : undefined;
    if (!e || e.dataDate !== dataDate) return a;
    applied++;
    const pct = Math.max(0, Math.min(1, e.pct));
    const status = pct >= 1 ? 'Completed' : pct > 0 && !/complet/i.test(a.status) ? 'In Progress' : a.status;
    const d = progressDates(a, e, dataDate);
    const estimated: ('as' | 'af')[] = [];
    if (d.asEstimated) estimated.push('as');
    if (d.afEstimated) estimated.push('af');
    return { ...a, [field]: pct, status, actStart: d.as, actFinish: d.af, ...(estimated.length ? { estimated } : {}) } as Activity;
  });
  return { activities: out, applied };
}

/** The actual dates an entry gives an activity (see the note at the top). */
export function progressDates(a: Pick<Activity, 'actStart' | 'actFinish' | 'start'>, e: Pick<ProgressEntry, 'pct' | 'as' | 'af'>, dataDate: Day):
  { as: Day | null; af: Day | null; asEstimated: boolean; afEstimated: boolean; needAs: boolean; needAf: boolean } {
  const pct = Math.max(0, Math.min(1, e.pct));
  const needAf = pct >= 1 && a.actFinish == null;
  const needAs = pct > 0 && a.actStart == null;
  let af = a.actFinish, afEstimated = false;
  if (needAf) { af = e.af ?? dataDate - 1; afEstimated = e.af == null; }
  let as = a.actStart, asEstimated = false;
  if (needAs) {
    as = e.as ?? (a.start != null && a.start < dataDate ? a.start : dataDate - 1);
    asEstimated = e.as == null;
    if (af != null && as > af) as = af;
  }
  return { as, af, asEstimated, afEstimated, needAs, needAf };
}
