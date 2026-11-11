/**
 * Compare two P6 updates of the same project (e.g. last month and this month), activity by activity
 * (matched on Activity ID, not case sensitive) and relationship by relationship.
 * Pure function: the second file is only read, nothing is stored or changed.
 */
import type { Activity } from './types';
import type { Day } from './dates';
import type { Relation } from './logic';
import type { XCell, XSheet } from './xlsxWrite';

export interface CompareSide {
  label: string;
  dataDate: Day | null;
  activities: Activity[];
  relations: Relation[] | null;
  /** Activity ID (lower case) -> constraint names; null = no constraint columns */
  constraints: Map<string, string[]> | null;
}

export type ChangeKind =
  | 'name' | 'wbs' | 'type' | 'status' | 'origDur' | 'remDur' | 'start' | 'finish' | 'actStart' | 'actFinish'
  | 'blStart' | 'blFinish' | 'progress' | 'float' | 'constraint';
export const CHANGE_KINDS: ChangeKind[] = ['finish', 'start', 'origDur', 'remDur', 'progress', 'float', 'actStart', 'actFinish', 'status', 'constraint', 'blStart', 'blFinish', 'name', 'wbs', 'type'];
export const CHANGE_LABEL: Record<ChangeKind, string> = {
  name: 'Activity name', wbs: 'WBS', type: 'Activity type', status: 'Status', origDur: 'Original duration', remDur: 'Remaining duration',
  start: 'Start', finish: 'Finish', actStart: 'Actual start', actFinish: 'Actual finish', blStart: 'BL start', blFinish: 'BL finish',
  progress: 'Actual %', float: 'Total float', constraint: 'Constraint',
};
/** value kinds, for display and Excel */
export const CHANGE_UNIT: Record<ChangeKind, 'text' | 'date' | 'days' | 'pct'> = {
  name: 'text', wbs: 'text', type: 'text', status: 'text', constraint: 'text',
  origDur: 'days', remDur: 'days', float: 'days', progress: 'pct',
  start: 'date', finish: 'date', actStart: 'date', actFinish: 'date', blStart: 'date', blFinish: 'date',
};

export type RedFlag = 'actualChanged' | 'progressDown' | 'reopened';
export const RED_FLAG_LABEL: Record<RedFlag, string> = {
  actualChanged: 'Actual date changed after it was reported',
  progressDown: 'Actual % went down',
  reopened: 'Completed activity is open again',
};

export interface Change { kind: ChangeKind; from: string | number | null; to: string | number | null; /** newer - older (days or fraction) */ delta: number | null }
export interface ActivityDiff { id: string; name: string; wbs: string; critical: boolean; changes: Change[]; flags: RedFlag[] }
export interface RelationChange { pred: string; succ: string; type: string; lag: number | null; fromLag?: number | null }

export interface CompareResult {
  older: { label: string; dataDate: Day | null; count: number; finish: Day | null; float: number | null };
  newer: { label: string; dataDate: Day | null; count: number; finish: Day | null; float: number | null };
  added: Activity[];
  deleted: Activity[];
  changed: ActivityDiff[];
  counts: Record<ChangeKind, number>;
  /** finish of the changed activities moved later / earlier */
  finishLater: number; finishEarlier: number;
  flags: Record<RedFlag, ActivityDiff[]>;
  /** null when one of the files has no relationships */
  relations: { added: RelationChange[]; deleted: RelationChange[]; lagChanged: RelationChange[] } | null;
}

const isDone = (a: Activity) => /complet/i.test(a.status) || a.actFinish != null;
const isSummary = (a: Activity) => /summary/i.test(a.type);
const finishOf = (a: Activity) => a.actFinish ?? a.finish;
const maxOf = (xs: (number | null)[]) => xs.reduce<number | null>((m, x) => (x != null && (m == null || x > m) ? x : m), null);
const minOf = (xs: (number | null)[]) => xs.reduce<number | null>((m, x) => (x != null && (m == null || x < m) ? x : m), null);
const near = (a: number | null, b: number | null, eps: number) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) <= eps);

/**
 * pct: the field used for actual % (the project's "Actual % source").
 * The side with the earlier data date is treated as the older one; without data dates the order given is kept.
 */
export function compareSchedules(a: CompareSide, b: CompareSide, pct: keyof Activity = 'physPct'): CompareResult {
  const swap = a.dataDate != null && b.dataDate != null && a.dataDate > b.dataDate;
  const older = swap ? b : a, newer = swap ? a : b;
  const key = (x: Activity) => x.id.trim().toLowerCase();
  const olds = new Map(older.activities.filter((x) => x.id && !isSummary(x)).map((x) => [key(x), x]));
  const news = new Map(newer.activities.filter((x) => x.id && !isSummary(x)).map((x) => [key(x), x]));

  const counts = Object.fromEntries(CHANGE_KINDS.map((k) => [k, 0])) as Record<ChangeKind, number>;
  const flags: Record<RedFlag, ActivityDiff[]> = { actualChanged: [], progressDown: [], reopened: [] };
  const changed: ActivityDiff[] = [];
  let finishLater = 0, finishEarlier = 0;
  const cons = (s: CompareSide, k: string) => (s.constraints?.get(k) ?? []).join(', ');

  for (const [k, n] of news) {
    const o = olds.get(k);
    if (!o) continue;
    const ch: Change[] = [];
    const add = (kind: ChangeKind, from: string | number | null, to: string | number | null, delta: number | null = null) => { ch.push({ kind, from, to, delta }); counts[kind]++; };
    const date = (kind: ChangeKind, x: Day | null, y: Day | null) => { if (x !== y) add(kind, x, y, x != null && y != null ? y - x : null); };
    const days = (kind: ChangeKind, x: number | null, y: number | null) => { if (!near(x, y, 0.01)) add(kind, x, y, x != null && y != null ? Math.round((y - x) * 100) / 100 : null); };
    if (o.name.trim() !== n.name.trim()) add('name', o.name, n.name);
    if (o.wbs !== n.wbs) add('wbs', o.wbs, n.wbs);
    if (o.type !== n.type) add('type', o.type, n.type);
    if (o.status !== n.status) add('status', o.status, n.status);
    days('origDur', o.origDur, n.origDur);
    days('remDur', o.remDur, n.remDur);
    date('start', o.actStart ?? o.start, n.actStart ?? n.start);
    date('finish', finishOf(o), finishOf(n));
    date('actStart', o.actStart, n.actStart);
    date('actFinish', o.actFinish, n.actFinish);
    date('blStart', o.blStart, n.blStart);
    date('blFinish', o.blFinish, n.blFinish);
    const po = o[pct] as number | null, pn = n[pct] as number | null;
    if (!near(po, pn, 0.0005)) add('progress', po, pn, po != null && pn != null ? pn - po : null);
    if (!isDone(n)) days('float', o.totalFloat, n.totalFloat);
    if (older.constraints && newer.constraints && cons(older, k) !== cons(newer, k)) add('constraint', cons(older, k) || null, cons(newer, k) || null);
    if (!ch.length) continue;
    const d: ActivityDiff = { id: n.id, name: n.name, wbs: n.wbsName || n.wbs, critical: /^(y|yes|true|1)$/i.test(n.critical), changes: ch, flags: [] };
    const fin = ch.find((c) => c.kind === 'finish');
    if (fin?.delta != null) { if (fin.delta > 0) finishLater++; else finishEarlier++; }
    // red flags: history that should not change between updates
    if ((o.actStart != null && o.actStart !== n.actStart) || (o.actFinish != null && o.actFinish !== n.actFinish)) d.flags.push('actualChanged');
    if (po != null && pn != null && pn < po - 0.0005) d.flags.push('progressDown');
    if (isDone(o) && !isDone(n)) d.flags.push('reopened');
    for (const f of d.flags) flags[f].push(d);
    changed.push(d);
  }
  const added = [...news].filter(([k]) => !olds.has(k)).map(([, x]) => x);
  const deleted = [...olds].filter(([k]) => !news.has(k)).map(([, x]) => x);
  // biggest finish slip first, then by ID
  const slip = (d: ActivityDiff) => d.changes.find((c) => c.kind === 'finish')?.delta ?? 0;
  changed.sort((x, y) => slip(y) - slip(x) || x.id.localeCompare(y.id, undefined, { numeric: true }));

  let relations: CompareResult['relations'] = null;
  if (older.relations && newer.relations) {
    const rk = (r: Relation) => `${r.pred.toLowerCase()}|${r.succ.toLowerCase()}|${r.type}`;
    const ro = new Map(older.relations.map((r) => [rk(r), r]));
    const rn = new Map(newer.relations.map((r) => [rk(r), r]));
    const out = (r: Relation, fromLag?: number | null): RelationChange => ({ pred: r.pred, succ: r.succ, type: String(r.type), lag: r.lag, ...(fromLag !== undefined ? { fromLag } : {}) });
    relations = {
      added: [...rn].filter(([k]) => !ro.has(k)).map(([, r]) => out(r)),
      deleted: [...ro].filter(([k]) => !rn.has(k)).map(([, r]) => out(r)),
      lagChanged: [...rn].filter(([k, r]) => ro.has(k) && !near(ro.get(k)!.lag, r.lag, 0.01)).map(([k, r]) => out(r, ro.get(k)!.lag)),
    };
  }
  const side = (s: CompareSide, m: Map<string, Activity>) => {
    const acts = [...m.values()];
    return { label: s.label, dataDate: s.dataDate, count: acts.length, finish: maxOf(acts.map(finishOf)), float: minOf(acts.filter((x) => !isDone(x)).map((x) => x.totalFloat)) };
  };
  return { older: side(older, olds), newer: side(newer, news), added, deleted, changed, counts, finishLater, finishEarlier, flags, relations };
}

/** Excel workbook of the comparison (labels through tx, so it can be Arabic). */
export function compareSheets(r: CompareResult, tx: (s: string) => string = (x) => x, rtl = false): XSheet[] {
  const val = (kind: ChangeKind, v: string | number | null): XCell => {
    if (v == null) return null;
    const u = CHANGE_UNIT[kind];
    if (u === 'date') return { d: v as number };
    if (u === 'pct') return { p: v as number };
    if (u === 'days') return { n1: v as number };
    return kind === 'status' || kind === 'type' ? tx(String(v)) : String(v);
  };
  const summary: XCell[][] = [
    [tx('Older file'), r.older.label, r.older.dataDate != null ? { d: r.older.dataDate } : null],
    [tx('Newer file'), r.newer.label, r.newer.dataDate != null ? { d: r.newer.dataDate } : null],
    [tx('Project finish (older)'), r.older.finish != null ? { d: r.older.finish } : null, null],
    [tx('Project finish (newer)'), r.newer.finish != null ? { d: r.newer.finish } : null, r.older.finish != null && r.newer.finish != null ? r.newer.finish - r.older.finish : null],
    [tx('Activities added'), r.added.length, null], [tx('Activities deleted'), r.deleted.length, null], [tx('Activities changed'), r.changed.length, null],
    ...CHANGE_KINDS.map((k): XCell[] => [tx(CHANGE_LABEL[k]), r.counts[k], null]),
    ...(r.relations ? [[tx('Relationships added'), r.relations.added.length, null], [tx('Relationships deleted'), r.relations.deleted.length, null], [tx('Relationship lag changed'), r.relations.lagChanged.length, null]] as XCell[][] : []),
    ...(Object.keys(RED_FLAG_LABEL) as RedFlag[]).map((f): XCell[] => [tx(RED_FLAG_LABEL[f]), r.flags[f].length, null]),
  ];
  const changes: XCell[][] = r.changed.flatMap((d) => d.changes.map((c): XCell[] => [
    d.id, d.name, d.wbs, tx(CHANGE_LABEL[c.kind]), val(c.kind, c.from), val(c.kind, c.to),
    c.delta == null ? null : CHANGE_UNIT[c.kind] === 'pct' ? { p: c.delta } : c.delta, d.flags.map((f) => tx(RED_FLAG_LABEL[f])).join('; '),
  ]));
  const actRow = (a: Activity): XCell[] => [a.id, a.name, a.wbsName || a.wbs, tx(a.status), a.start != null ? { d: a.start } : null, finishOf(a) != null ? { d: finishOf(a)! } : null, a.origDur];
  const actHead = ['Activity ID', 'Activity Name', 'WBS', 'Status', 'Start', 'Finish', 'Original duration'].map(tx);
  const rel = (list: RelationChange[], what: string): XCell[][] => list.map((x) => [tx(what), x.pred, x.succ, x.type, x.fromLag ?? null, x.lag]);
  const out: XSheet[] = [
    { name: tx('Summary'), header: [tx('Item'), tx('Value'), ''], rows: summary, widths: [40, 30, 14], rtl },
    { name: tx('Changes'), header: ['Activity ID', 'Activity Name', 'WBS', 'Change', 'Older', 'Newer', 'Difference', 'Warning'].map(tx), rows: changes, widths: [14, 40, 24, 20, 14, 14, 12, 34], rtl },
    { name: tx('Added'), header: actHead, rows: r.added.map(actRow), widths: [14, 40, 24, 14, 12, 12, 12], rtl },
    { name: tx('Deleted'), header: actHead, rows: r.deleted.map(actRow), widths: [14, 40, 24, 14, 12, 12, 12], rtl },
  ];
  if (r.relations) out.push({ name: tx('Relationships'), header: ['Change', 'Predecessor', 'Successor', 'Type', 'Lag before (d)', 'Lag (d)'].map(tx),
    rows: [...rel(r.relations.added, 'Added'), ...rel(r.relations.deleted, 'Deleted'), ...rel(r.relations.lagChanged, 'Lag changed')], widths: [16, 16, 16, 8, 14, 10], rtl });
  return out;
}
