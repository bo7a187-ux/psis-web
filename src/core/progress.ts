/**
 * Actual % entered by the engineer in the app (instead of, or on top of, the P6 export).
 * Each value belongs to a data date: it is used only while the project data date is the same,
 * so last month's entries never leak into this month. The entered value replaces the field
 * chosen as "Actual % source" and sets the status (0 < % < 100: In Progress, 100%: Completed).
 */
import type { Activity } from './types';
import type { Day } from './dates';
import { ACTUAL_FIELD, type ActualSource } from './settings';

export interface ProgressEntry { pct: number; dataDate: Day; at: string }
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
    return { ...a, [field]: pct, status } as Activity;
  });
  return { activities: out, applied };
}
