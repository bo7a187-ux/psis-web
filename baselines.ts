/**
 * Baseline register. The Original baseline is saved once and never replaced; every
 * approved re-baseline is added as a new revision (unlimited) with its revision
 * number, approval date and description. Saved values never change on a new import.
 */
import type { Day } from './dates';
import type { Activity } from './types';
import type { BaselineMap } from './engine';

export interface BaselineItem { id: string; start: Day; finish: Day }
export interface BaselineSet { savedAt: string; reference: string; items: BaselineItem[] }
export interface Revision extends BaselineSet { rev: string; approvedOn: Day; description: string }
export interface Baselines { original: BaselineSet | null; revisions: Revision[] }

export const emptyBaselines = (): Baselines => ({ original: null, revisions: [] });

/** Activities of the current import that have both baseline dates. Others are listed, never saved as zero. */
export function itemsFromActivities(acts: Activity[]): { items: BaselineItem[]; skipped: string[] } {
  const items: BaselineItem[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (const a of acts) {
    const k = a.id.toLowerCase();
    if (!a.id) { skipped.push(`(row ${a.row}) no Activity ID`); continue; }
    if (seen.has(k)) { skipped.push(`${a.id}: duplicate ID`); continue; }
    seen.add(k);
    if (a.blStart == null || a.blFinish == null) { skipped.push(`${a.id}: baseline start or finish missing`); continue; }
    items.push({ id: a.id, start: a.blStart, finish: a.blFinish });
  }
  return { items, skipped };
}

export function toMap(items: BaselineItem[]): BaselineMap {
  const m: BaselineMap = new Map();
  for (const i of items) m.set(i.id.toLowerCase(), { start: i.start, finish: i.finish });
  return m;
}

export class BaselineError extends Error {}

export function saveOriginal(b: Baselines, set: BaselineSet): Baselines {
  if (b.original) throw new BaselineError('The Original baseline is already saved and can never be replaced. Add a Revised baseline instead.');
  if (!set.items.length) throw new BaselineError('There are no activities with baseline dates to save.');
  return { ...b, original: set };
}

export function addRevision(b: Baselines, rev: Revision): Baselines {
  const no = rev.rev.trim();
  if (!no) throw new BaselineError('Enter a revision number, e.g. Rev-2.');
  if (b.revisions.some((r) => r.rev.toLowerCase() === no.toLowerCase())) throw new BaselineError(`Revision "${no}" already exists. Saved revisions are never overwritten - use a new number.`);
  if (!rev.items.length) throw new BaselineError('There are no activities with baseline dates to save.');
  return { ...b, revisions: [...b.revisions, { ...rev, rev: no }] };
}

/** '' = the latest saved revision. */
export function resolveRevision(b: Baselines, use: string): Revision | null {
  if (!b.revisions.length) return null;
  if (!use.trim()) return b.revisions[b.revisions.length - 1];
  return b.revisions.find((r) => r.rev.toLowerCase() === use.trim().toLowerCase()) ?? null;
}

export interface BaselineDiff { id: string; name: string; origFinish: Day | null; revFinish: Day | null; curFinish: Day | null; revVsOrig: number | null; curVsOrig: number | null; curVsRev: number | null }

/** Original vs Revised vs Current-import finish dates per activity (only activities that differ unless all=true). */
export function compareBaselines(acts: Activity[], orig: BaselineMap | undefined, rev: BaselineMap | undefined, all = false): BaselineDiff[] {
  const out: BaselineDiff[] = [];
  for (const a of acts) {
    const k = a.id.toLowerCase();
    const o = orig?.get(k)?.finish ?? null, r = rev?.get(k)?.finish ?? null, c = a.blFinish;
    const d = (x: number | null, y: number | null) => (x != null && y != null ? x - y : null);
    const row = { id: a.id, name: a.name, origFinish: o, revFinish: r, curFinish: c, revVsOrig: d(r, o), curVsOrig: d(c, o), curVsRev: d(c, r) };
    if (all || [row.revVsOrig, row.curVsOrig, row.curVsRev].some((x) => x != null && x !== 0)) out.push(row);
  }
  return out;
}
