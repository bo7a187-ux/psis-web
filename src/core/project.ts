/**
 * Project-level figures: KPIs, SPI, health, group tables, exception lists,
 * S-curve and trend. Mirrors the helper formulas of EXECUTIVE DASHBOARD,
 * SCHEDULE CONTROL and DELAY ANALYSIS in the workbook.
 * Every figure is weighted: progress(group) = Σ(w·p) / Σ(w) over activities that have p.
 */
import type { CalcRow } from './engine';
import { EPS, roundUp } from './engine';
import type { Settings } from './settings';
import type { Day } from './dates';
import { fromYMD, toYMD } from './dates';
import type { Dimension } from './classify';
import type { Snapshot } from './snapshot';

export type FilterKey = 'project' | 'phase' | 'discipline' | 'building' | 'floor';
export type Filters = Record<FilterKey, string>; // 'All' = no filter
export const NO_FILTER: Filters = { project: 'All', phase: 'All', discipline: 'All', building: 'All', floor: 'All' };
export const isUnfiltered = (f: Filters) => Object.values(f).every((v) => v === 'All');

export function inFilter(r: CalcRow, f: Filters): boolean {
  if (!r.included) return false;
  return (f.project === 'All' || r.a.projectId === f.project)
    && (f.phase === 'All' || r.cls.phase === f.phase)
    && (f.discipline === 'All' || r.cls.discipline === f.discipline)
    && (f.building === 'All' || r.cls.building === f.building)
    && (f.floor === 'All' || r.cls.floor === f.floor);
}

/** Weighted planned / actual of a set of rows. null when no row carries a weight with that value. */
export function weighted(rows: CalcRow[]) {
  let wpl = 0, ple = 0, wac = 0, ace = 0, w = 0;
  for (const r of rows) {
    w += r.weight;
    if (r.planned != null) { wpl += r.weight; ple += r.plannedEarned; }
    if (r.actual != null) { wac += r.weight; ace += r.actualEarned; }
  }
  const planned = wpl > 0 ? ple / wpl : null;
  const actual = wac > 0 ? ace / wac : null;
  return { weight: w, planned, actual, variance: planned != null && actual != null ? actual - planned : null };
}

const maxOf = (xs: (number | null)[]) => { let m: number | null = null; for (const x of xs) if (x != null && x > 0 && (m == null || x > m)) m = x; return m; };
const minOf = (xs: (number | null)[]) => { let m: number | null = null; for (const x of xs) if (x != null && (m == null || x < m)) m = x; return m; };

export type Health = 'GREEN' | 'AMBER' | 'RED';

export interface ProjectSummary {
  rows: CalcRow[]; // included rows in the filter
  planned: number | null;
  actual: number | null;
  variance: number | null;
  ev: number;
  pv: number;
  costCoverage: number;
  spi: number | null;
  spiReason: string; // '' when SPI is shown
  blStart: Day | null;
  blFinish: Day | null;
  forecastFinish: Day | null; // selected method
  forecastP6: Day | null;
  forecastPerf: Day | null;
  forecastCons: Day | null;
  origFinish: Day | null;
  revFinish: Day | null;
  delayDays: number | null; // forecast - baseline finish (used)
  delayVsOrig: number | null;
  delayVsRev: number | null;
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  delayed: number;
  critical: number;
  negFloat: number;
  lowFloat: number;
  behind: number;
  openPastBLF: number;
  notStartedPastBLS: number;
  finishedLate: number;
  blFinishChanged: number;
  projectFloat: number | null;
  timeElapsed: number | null;
  critPlanned: number | null;
  critActual: number | null;
  health: Health;
  healthReasons: string[];
  redCount: number;
  amberCount: number;
}

const fmt1 = (x: number) => x.toFixed(1);
const fmt2 = (x: number) => x.toFixed(2);

export function summarize(all: CalcRow[], s: Settings, f: Filters = NO_FILTER): ProjectSummary {
  const DD = s.dataDate!;
  const rows = all.filter((r) => inFilter(r, f));
  const { planned, actual, variance } = weighted(rows);
  const ev = rows.reduce((n, r) => n + r.ev, 0);
  const pv = rows.reduce((n, r) => n + r.pv, 0);
  const nonMs = rows.filter((r) => !r.isMilestone);
  const costCoverage = nonMs.length ? nonMs.filter((r) => (r.a.budgetCost ?? 0) > 0).length / nonMs.length : 0;
  const totalCost = rows.reduce((n, r) => n + (r.a.budgetCost ?? 0), 0);
  let spiReason = '';
  if (totalCost === 0) spiReason = 'No budgeted cost in the import';
  else if (costCoverage < s.costCoverage - EPS) spiReason = `Budgeted cost missing for ${Math.round((1 - costCoverage) * 100)}% of activities`;
  else if (pv <= 0) spiReason = 'Planned Value is zero at the data date';
  const spi = spiReason ? null : ev / pv;

  const blStart = minOf(rows.map((r) => (r.blStart != null && r.blStart > 0 ? r.blStart : null)));
  const blFinish = maxOf(rows.map((r) => r.blFinish));
  const forecastFinish = maxOf(rows.map((r) => r.fcSel));
  const delayDays = blFinish != null && forecastFinish != null ? forecastFinish - blFinish : null;
  const origFinish = maxOf(rows.map((r) => r.origBL.finish));
  const revFinish = maxOf(rows.map((r) => r.revBL.finish));
  const open = rows.filter((r) => r.status !== 'Completed');
  const crit = rows.filter((r) => r.critical);
  const cw = weighted(crit);

  // Health - each crossed limit is written as a reason (EXECUTIVE DASHBOARD AD2:AD4)
  const reasons: string[] = [];
  let red = 0, amber = 0;
  const d = delayDays ?? 0;
  if (d > s.redDays) { red++; reasons.push(`Forecast ${d} days late (red limit ${s.redDays})`); }
  else if (d > s.amberDays) { amber++; reasons.push(`Forecast ${d} days late (amber limit ${s.amberDays})`); }
  if (variance != null) {
    if (variance < -s.redPP - EPS) { red++; reasons.push(`Behind ${fmt1(-variance * 100)} pp (red limit ${fmt1(s.redPP * 100)})`); }
    else if (variance < -s.amberPP - EPS) { amber++; reasons.push(`Behind ${fmt1(-variance * 100)} pp (amber limit ${fmt1(s.amberPP * 100)})`); }
  }
  if (spi != null) {
    if (spi < s.redSPI) { red++; reasons.push(`SPI ${fmt2(spi)} (red limit ${fmt2(s.redSPI)})`); }
    else if (spi < s.amberSPI) { amber++; reasons.push(`SPI ${fmt2(spi)} (amber limit ${fmt2(s.amberSPI)})`); }
  }
  const health: Health = red > 0 ? 'RED' : amber > 0 ? 'AMBER' : 'GREEN';

  const count = (p: (r: CalcRow) => boolean) => rows.filter(p).length;
  return {
    rows, planned, actual, variance, ev, pv, costCoverage, spi, spiReason,
    blStart, blFinish, forecastFinish,
    forecastP6: maxOf(rows.map((r) => r.fcP6)),
    forecastPerf: maxOf(rows.map((r) => r.fcPerf)),
    forecastCons: maxOf(rows.map((r) => r.fcCons)),
    origFinish, revFinish, delayDays,
    delayVsOrig: origFinish != null && forecastFinish != null ? forecastFinish - origFinish : null,
    delayVsRev: revFinish != null && forecastFinish != null ? forecastFinish - revFinish : null,
    total: rows.length,
    completed: count((r) => r.status === 'Completed'),
    inProgress: count((r) => r.status === 'In Progress'),
    notStarted: count((r) => r.status === 'Not Started'),
    delayed: count((r) => r.delayed),
    critical: count((r) => r.critical),
    negFloat: count((r) => r.negFloat),
    lowFloat: count((r) => r.lowFloat),
    behind: count((r) => r.behind),
    openPastBLF: count((r) => r.openPastBLF),
    notStartedPastBLS: count((r) => r.notStartedPastBLS),
    finishedLate: count((r) => r.finishedLate),
    blFinishChanged: count((r) => r.blFinishChanged),
    projectFloat: minOf(open.map((r) => r.tfDays)),
    timeElapsed: blStart != null && blFinish != null ? Math.max(0, Math.min(1, (DD - blStart) / (blFinish - blStart + 1))) : null,
    critPlanned: cw.planned,
    critActual: cw.actual,
    health, healthReasons: reasons, redCount: red, amberCount: amber,
  };
}

// ---------------------------------------------------------------- group tables
export interface GroupRow {
  name: string;
  inList: boolean;
  weightShare: number | null;
  planned: number | null;
  actual: number | null;
  variance: number | null;
  /** progress since the previous snapshot, weighted over activities that were in it */
  period: number | null;
  delayed: number;
  critical: number;
}

/** One row per list value (in list order); values found but not in the list are added after, flagged. */
export function groupTable(all: CalcRow[], f: Filters, dim: Dimension, list: string[], hasPrev: boolean): GroupRow[] {
  const rows = all.filter((r) => inFilter(r, f));
  const total = rows.reduce((n, r) => n + r.weight, 0);
  const names = [...list];
  for (const r of rows) if (!names.some((n) => n.toLowerCase() === r.cls[dim].toLowerCase())) names.push(r.cls[dim]);
  const out: GroupRow[] = [];
  for (const name of names) {
    const g = rows.filter((r) => r.cls[dim].toLowerCase() === name.toLowerCase());
    const gw = g.reduce((n, r) => n + r.weight, 0);
    if (!g.length || gw === 0) continue;
    const w = weighted(g);
    let period: number | null = null;
    const gp = g.filter((r) => r.inPrev);
    const wp = gp.reduce((n, r) => n + r.weight, 0);
    if (hasPrev && w.planned != null && wp > 0) period = (gp.reduce((n, r) => n + r.actualEarned, 0) - gp.reduce((n, r) => n + r.weight * (r.prevActual ?? 0), 0)) / wp;
    out.push({
      name, inList: list.some((l) => l.toLowerCase() === name.toLowerCase()),
      weightShare: total > 0 ? gw / total : null, planned: w.planned, actual: w.actual,
      variance: w.planned != null && w.actual != null ? w.actual - w.planned : null, period,
      delayed: g.filter((r) => r.delayed).length, critical: g.filter((r) => r.critical).length,
    });
  }
  return out;
}

export interface WbsRow { name: string; weightShare: number | null; planned: number | null; actual: number | null; variance: number | null; blFinish: Day | null; forecast: Day | null; delay: number | null }

/** WBS performance: by WBS Name in order of first appearance. */
export function wbsTable(all: CalcRow[], f: Filters): WbsRow[] {
  const rows = all.filter((r) => inFilter(r, f));
  const total = rows.reduce((n, r) => n + r.weight, 0);
  const order: string[] = [];
  for (const r of all) if (r.included && r.a.wbsName && !order.includes(r.a.wbsName)) order.push(r.a.wbsName);
  const out: WbsRow[] = [];
  for (const name of order) {
    const g = rows.filter((r) => r.a.wbsName === name);
    const gw = g.reduce((n, r) => n + r.weight, 0);
    if (!g.length || gw === 0) continue;
    const w = weighted(g);
    const blFinish = maxOf(g.map((r) => r.blFinish));
    const forecast = maxOf(g.map((r) => r.fcSel));
    out.push({ name, weightShare: total ? gw / total : null, planned: w.planned, actual: w.actual,
      variance: w.planned != null && w.actual != null ? w.actual - w.planned : null,
      blFinish, forecast, delay: blFinish != null && forecast != null ? forecast - blFinish : null });
  }
  return out;
}

export type HeatValue = 'Actual %' | 'Planned %' | 'Variance (pp)';
export interface Heatmap { rows: string[]; cols: string[]; cells: (number | null | undefined)[][] } // undefined = no weight (·)

export function heatmap(all: CalcRow[], f: Filters, rowDim: Dimension, rowList: string[], colDim: Dimension, colList: string[], value: HeatValue): Heatmap {
  const rows = all.filter((r) => inFilter(r, f));
  const cells = rowList.map((rv) => colList.map((cv) => {
    const g = rows.filter((r) => r.cls[rowDim] === rv && r.cls[colDim] === cv);
    if (g.reduce((n, r) => n + r.weight, 0) === 0) return undefined;
    const w = weighted(g);
    return value === 'Actual %' ? w.actual : value === 'Planned %' ? w.planned : w.variance;
  }));
  return { rows: rowList, cols: colList, cells };
}

// ---------------------------------------------------------------- exception lists
export const EXCEPTION_TYPES = [
  'Critical path (by forecast finish)', 'Late finish forecast (days)', 'Behind planned progress', 'Open past baseline finish',
  'Not started past baseline start', 'Negative float', 'Critical (open)', 'Low float (open)', 'Finished late',
] as const;
export type ExceptionType = (typeof EXCEPTION_TYPES)[number];

/**
 * Same membership and order as the workbook's ranking keys
 * (ties are broken by row position exactly as Excel's key + ROW()/10^7 does).
 */
export function exceptionList(all: CalcRow[], s: Settings, f: Filters, type: ExceptionType): CalcRow[] {
  const DD = s.dataDate!;
  const idx = new Map(all.map((r, i) => [r, i]));
  const tie = (r: CalcRow) => idx.get(r)! / 1e7;
  const rows = all.filter((r) => inFilter(r, f));
  let keyed: [CalcRow, number][];
  let ascending = false;
  switch (type) {
    case 'Critical path (by forecast finish)': keyed = rows.filter((r) => r.critical && r.fcSel != null).map((r) => [r, r.fcSel! + tie(r)]); ascending = true; break;
    case 'Late finish forecast (days)': keyed = rows.filter((r) => r.status !== 'Completed' && (r.finishVarUsed ?? 0) > 0).map((r) => [r, r.finishVarUsed! + tie(r)]); break;
    case 'Behind planned progress': keyed = rows.filter((r) => r.behind).map((r) => [r, r.daysBehind + tie(r)]); break;
    case 'Open past baseline finish': keyed = rows.filter((r) => r.openPastBLF).map((r) => [r, DD - r.blFinish! + tie(r)]); break;
    case 'Not started past baseline start': keyed = rows.filter((r) => r.notStartedPastBLS).map((r) => [r, DD - r.blStart! + tie(r)]); break;
    case 'Negative float': keyed = rows.filter((r) => r.negFloat).map((r) => [r, -r.tfDays! + tie(r)]); break;
    case 'Critical (open)': keyed = rows.filter((r) => r.critical).map((r) => [r, 100000 - (r.tfDays ?? 0) + tie(r)]); break;
    case 'Low float (open)': keyed = rows.filter((r) => r.lowFloat).map((r) => [r, 100000 - r.tfDays! + tie(r)]); break;
    case 'Finished late': keyed = rows.filter((r) => r.finishedLate).map((r) => [r, r.a.actFinish! - r.blFinish! + tie(r)]); break;
  }
  keyed.sort((a, b) => (ascending ? a[1] - b[1] : b[1] - a[1]));
  return keyed.map(([r]) => r);
}

/** Top delayed activities for the executive dashboard: forecast delay (days), then days behind plan. */
export function topDelayed(all: CalcRow[], f: Filters, n = 10): CalcRow[] {
  const idx = new Map(all.map((r, i) => [r, i]));
  return all.filter((r) => inFilter(r, f) && r.delayed)
    .map((r) => [r, Math.max(0, r.finishVarUsed ?? 0) + r.daysBehind / 1000 + idx.get(r)! / 1e7] as const)
    .sort((a, b) => b[1] - a[1]).slice(0, n).map(([r]) => r);
}

// ---------------------------------------------------------------- S-curve and trend
function eomonth(d: Day, months: number): Day {
  const { y, m } = toYMD(d);
  const t = new Date(Date.UTC(y, m - 1 + months + 1, 1));
  return fromYMD(t.getUTCFullYear(), t.getUTCMonth() + 1, 1)! - 1;
}

/** Baseline planned curve at each month end (planned at the start of the next day), linear on the baseline used. */
export function baselineCurve(all: CalcRow[], f: Filters): { date: Day; planned: number }[] {
  const rows = all.filter((r) => inFilter(r, f) && r.hasBL);
  const sw = rows.reduce((n, r) => n + r.weight, 0);
  const bls = minOf(all.filter((r) => inFilter(r, f)).map((r) => (r.blStart != null && r.blStart > 0 ? r.blStart : null)));
  const blf = maxOf(all.filter((r) => inFilter(r, f)).map((r) => r.blFinish));
  if (bls == null || blf == null) return [];
  const out: { date: Day; planned: number }[] = [];
  const end = eomonth(blf, 0);
  let t = eomonth(bls, -1);
  for (let i = 0; i < 600; i++) {
    const D = t + 1;
    let v = 0;
    if (sw > 0) {
      for (const r of rows) {
        const s0 = r.blStart!, f0 = r.blFinish!;
        const p = (D > f0 ? 1 : 0) + (D > s0 && D <= f0 ? (D - s0) / (Math.abs(f0 - s0) + 1) : 0);
        v += r.weight * p;
      }
      v /= sw;
    }
    out.push({ date: t, planned: v });
    if (t >= end) break;
    t = eomonth(t, 1);
  }
  return out;
}

/** Actual % of a saved snapshot for the same filter. Falls back to the saved overall value only when unfiltered. */
export function snapshotActual(snap: Snapshot, f: Filters): number | null {
  const m = snap.activities.filter((a) =>
    (f.project === 'All' || a.project === f.project) && (f.phase === 'All' || a.phase === f.phase)
    && (f.discipline === 'All' || a.discipline === f.discipline) && (f.building === 'All' || a.building === f.building)
    && (f.floor === 'All' || a.floor === f.floor));
  const w = m.reduce((n, a) => n + a.weight, 0);
  if (w > 0) return m.reduce((n, a) => n + a.actualEarned, 0) / w;
  return isUnfiltered(f) ? snap.summary.actual : null;
}

export interface Trend { date: Day | null; rate: number | null; fromDate: Day | null; fromActual: number | null; reason: string }

/**
 * Indicative trend completion: straight line at the progress rate between the
 * 3rd-last saved snapshot (before the data date) and the current actual %.
 * Never used for health.
 */
export function trendCompletion(actualNow: number | null, dataDate: Day, history: Snapshot[], f: Filters): Trend {
  const prior = history.filter((h) => h.dataDate < dataDate).sort((a, b) => a.dataDate - b.dataDate);
  if (!prior.length || actualNow == null) return { date: null, rate: null, fromDate: null, fromActual: null, reason: 'insufficient history' };
  const base = prior[Math.max(0, prior.length - 3)];
  const fromActual = snapshotActual(base, f);
  if (fromActual == null) return { date: null, rate: null, fromDate: base.dataDate, fromActual: null, reason: 'no matching history for this filter' };
  const rate = dataDate > base.dataDate ? (actualNow - fromActual) / (dataDate - base.dataDate) : 0;
  if (!(rate > 0)) return { date: null, rate, fromDate: base.dataDate, fromActual, reason: 'no progress in recent periods' };
  return { date: dataDate + roundUp((1 - actualNow) / rate), rate, fromDate: base.dataDate, fromActual, reason: '' };
}
