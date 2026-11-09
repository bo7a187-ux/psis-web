/**
 * Approval fingerprint: SHA-256 of every value that affects any figure -
 * all imported fields of every activity (dates, durations, float, progress,
 * cost, units, status, type, WBS, critical flag), its classification, the
 * baseline actually used (and the saved original / revised dates), unreadable
 * values, and every calculation setting. Any change gives a different fingerprint.
 * The project title (display only) is not included.
 */
import type { CalcRow } from './engine';
import type { Settings } from './settings';
import { sha256 } from './sha256';
import { DIMENSIONS } from './classify';

export function fingerprintPayload(rows: CalcRow[], s: Settings): string {
  const { projectTitle: _ignored, ...calc } = s; // eslint-disable-line @typescript-eslint/no-unused-vars
  void _ignored;
  const settings = Object.keys(calc).sort().map((k) => [k, (calc as Record<string, unknown>)[k]]);
  const acts = rows.map((r) => {
    const a = r.a;
    return [
      a.id, a.name, a.projectId, a.projectName, a.status, a.wbs, a.wbsName, a.type, a.critical,
      a.origDur, a.remDur, a.actDur, a.totalFloat, a.freeFloat,
      a.blStart, a.blFinish, a.start, a.finish, a.actStart, a.actFinish,
      a.schedPct, a.physPct, a.durPct, a.unitsPct, a.actPct,
      a.budgetCost, a.actualCost, a.budgetUnits, a.actualUnits,
      Object.keys(a.invalid).sort(),
      DIMENSIONS.map((d) => r.cls[d]),
      r.baselineUsed, r.blStart, r.blFinish, r.origBL.start, r.origBL.finish, r.revBL.start, r.revBL.finish,
    ];
  });
  return JSON.stringify({ v: 1, settings, activities: acts });
}

export function fingerprint(rows: CalcRow[], s: Settings): string {
  return sha256(fingerprintPayload(rows, s));
}

export type ApprovalStatus = 'BLOCKED' | 'PENDING REVIEW' | 'APPROVED' | 'CHANGED SINCE APPROVAL';

export function approvalStatus(criticalCount: number, approved: string | null | undefined, live: string | null): ApprovalStatus {
  if (criticalCount > 0 || live == null) return 'BLOCKED';
  if (!approved) return 'PENDING REVIEW';
  return approved === live ? 'APPROVED' : 'CHANGED SINCE APPROVAL';
}
