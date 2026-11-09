/**
 * Activity-level calculations. Each function mirrors one column of the
 * ACTIVITIES ENGINE sheet of the Excel workbook (the reference).
 * Missing values stay null; they are excluded from the figure they affect
 * and flagged - never treated as zero.
 */
import type { Day } from './dates';
import type { Activity } from './types';
import { classify, indexOverrides, DIMENSIONS, UNCLASSIFIED, type Classes, type ClassificationConfig } from './classify';
import { ACTUAL_FIELD, type Settings } from './settings';

export interface BaselineDates { start: Day | null; finish: Day | null }
/** Activity ID (lower-case) -> dates */
export type BaselineMap = Map<string, BaselineDates>;

export interface PrevSnapshotRow { actual: number | null; blFinish: Day | null }

export interface EngineInputs {
  activities: Activity[];
  settings: Settings;
  classification: ClassificationConfig;
  original?: BaselineMap;
  revised?: BaselineMap;
  /** activity-level rows of the previous saved snapshot (by lower-case ID) */
  prev?: Map<string, PrevSnapshotRow>;
}

export type Status = 'Completed' | 'In Progress' | 'Not Started';
export type BaselineUsed = 'Original' | 'Revised' | 'Import' | 'Original (fallback)' | 'Import (fallback)' | 'None';

export interface CalcRow {
  a: Activity;
  cls: Classes;
  isSummary: boolean;
  isLOE: boolean;
  isMilestone: boolean;
  included: boolean;
  status: Status;
  origBL: BaselineDates;
  revBL: BaselineDates;
  baselineUsed: BaselineUsed;
  blStart: Day | null;
  blFinish: Day | null;
  hasBL: boolean;
  origDurDays: number;
  weightBasis: number;
  weight: number;
  planned: number | null;
  actualField: number | null;
  actual: number | null;
  variance: number | null;
  plannedEarned: number;
  actualEarned: number;
  ev: number;
  pv: number;
  fcP6: Day | null;
  perfRaw: Day | null;
  fcPerf: Day | null;
  fcCons: Day | null;
  fcSel: Day | null;
  fcSource: string;
  finishVarUsed: number | null;
  finishVarOrig: number | null;
  finishVarRev: number | null;
  startVar: number | null;
  daysBehind: number;
  behind: boolean;
  openPastBLF: boolean;
  finishedLate: boolean;
  notStartedPastBLS: boolean;
  critical: boolean;
  negFloat: boolean;
  lowFloat: boolean;
  tfDays: number | null;
  delayed: boolean;
  delayIndicator: string;
  performance: string;
  inPrev: boolean;
  prevActual: number | null;
  periodProgress: number | null;
  prevBLFinish: Day | null;
  blFinishChanged: boolean;
  flags: {
    missingId: boolean;
    duplicateId: boolean;
    missingBaseline: boolean;
    invalidValue: boolean;
    missingProgress: boolean;
    blFinishBeforeStart: boolean;
    unclassified: boolean;
    progressWithoutAS: boolean;
    completedWithoutAF: boolean;
    actualAfterDataDate: boolean;
    missingWeight: boolean;
    afButPctBelow100: boolean;
    baselineFallback: boolean;
  };
}

/** Excel ROUNDUP(x, 0) for positive x, ignoring floating-point noise (e.g. 3.0000000000000004 -> 3). */
export function roundUp(x: number): number {
  const r = Math.round(x);
  if (Math.abs(x - r) < 1e-9) return r;
  return x > 0 ? Math.ceil(x) : Math.floor(x);
}

/** Small tolerance for "more than" comparisons on percentages, so 0.85 - 0.90 is exactly -5 pp. */
export const EPS = 1e-9;

const pos = (d: Day | null | undefined): d is Day => d != null && d > 0;

export function calcActivities(inp: EngineInputs): CalcRow[] {
  const s = inp.settings;
  const DD = s.dataDate;
  if (DD == null) throw new Error('Data date is not set');
  const ovIdx = indexOverrides(inp.classification.overrides);
  const srcKey = ACTUAL_FIELD[s.actualSource];
  const idCount = new Map<string, number>();
  for (const a of inp.activities) if (a.id) idCount.set(a.id.toLowerCase(), (idCount.get(a.id.toLowerCase()) ?? 0) + 1);

  return inp.activities.map((a): CalcRow => {
    const key = a.id.toLowerCase();
    const cls = classify(a, inp.classification, ovIdx);
    const type = a.type;
    const isSummary = /summary/i.test(type);
    const isLOE = /level of effort/i.test(type) || type.trim().toUpperCase() === 'LOE';
    const isMilestone = /milestone/i.test(type);
    const included = !isSummary && !(isLOE && !s.includeLOE);
    const status: Status = /complet/i.test(a.status) || a.actFinish != null
      ? 'Completed'
      : /progress/i.test(a.status) || a.actStart != null ? 'In Progress' : 'Not Started';

    const o = a.id ? inp.original?.get(key) : undefined;
    const origBL: BaselineDates = { start: pos(o?.start) ? o!.start : null, finish: pos(o?.finish) ? o!.finish : null };
    const r = a.id ? inp.revised?.get(key) : undefined;
    const revBL: BaselineDates = { start: pos(r?.start) ? r!.start : null, finish: pos(r?.finish) ? r!.finish : null };
    const hasOrig = origBL.start != null && origBL.finish != null;
    const hasRev = revBL.start != null && revBL.finish != null;
    const hasImp = a.blStart != null && a.blFinish != null;

    let baselineUsed: BaselineUsed;
    if (s.baselineUse === 'Original (saved)') baselineUsed = hasOrig ? 'Original' : hasImp ? 'Import (fallback)' : 'None';
    else if (s.baselineUse === 'Revised (saved)') baselineUsed = hasRev ? 'Revised' : hasOrig ? 'Original (fallback)' : hasImp ? 'Import (fallback)' : 'None';
    else baselineUsed = hasImp ? 'Import' : 'None';

    let blStart: Day | null = null, blFinish: Day | null = null;
    if (baselineUsed.startsWith('Original')) { blStart = origBL.start; blFinish = origBL.finish; }
    else if (baselineUsed === 'Revised') { blStart = revBL.start; blFinish = revBL.finish; }
    else if (baselineUsed.startsWith('Import')) { blStart = a.blStart; blFinish = a.blFinish; }
    const hasBL = pos(blStart) && pos(blFinish);
    const blSpan = hasBL ? blFinish! - blStart! + 1 : 0;

    const origDurDays = a.origDur != null ? a.origDur : hasBL ? blSpan : 0;
    let weightBasis: number;
    if (isMilestone) weightBasis = 0;
    else if (s.weightMethod === 'Cost') weightBasis = a.budgetCost ?? 0;
    else if (s.weightMethod === 'Man-hours') weightBasis = a.budgetUnits ?? 0;
    else weightBasis = a.origDur != null && a.origDur > 0 ? a.origDur : hasBL ? blSpan : 0;
    const weight = included ? Math.max(0, weightBasis) : 0;

    // Planned % at the data date (data date = start of day)
    let planned: number | null;
    if (s.plannedMethod === 'P6 Schedule % Complete') planned = a.schedPct != null ? Math.min(1, a.schedPct) : null;
    else if (!hasBL) planned = null;
    else if (isMilestone) planned = DD > blFinish! ? 1 : 0;
    else if (DD > blFinish!) planned = 1;
    else if (DD <= blStart!) planned = 0;
    else planned = (DD - blStart!) / (blFinish! - blStart! + 1);

    // Actual % from the selected field - never mixed with other fields
    const actualField = (a[srcKey] as number | null) ?? null;
    let actual: number | null;
    if (s.afAsComplete && a.actFinish != null) actual = 1;
    else if (actualField != null) actual = Math.min(1, Math.max(0, actualField));
    else if (isMilestone) actual = status === 'Completed' ? 1 : 0;
    else actual = null;

    const variance = planned != null && actual != null ? actual - planned : null;
    const plannedEarned = planned != null ? weight * planned : 0;
    const actualEarned = actual != null ? weight * actual : 0;
    const cost = a.budgetCost ?? 0;
    const ev = included && actual != null ? cost * actual : 0;
    const pv = included && planned != null ? cost * planned : 0;

    // Forecast finish - three methods
    const fcP6 = a.finish;
    let perfRaw: Day | null = null;
    if (status === 'In Progress' && a.actStart != null && actual != null && actual > 0 && actual < 1)
      perfRaw = DD + Math.max(1, roundUp(((1 - actual) * Math.max(1, DD - a.actStart)) / actual)) - 1;
    else if (status === 'Not Started' && pos(blFinish)) perfRaw = Math.max(blFinish, DD + blFinish - (blStart ?? 0));
    const completedAF = status === 'Completed' && a.actFinish != null;
    const fcPerf = completedAF ? a.actFinish : perfRaw ?? fcP6 ?? (pos(blFinish) ? blFinish : null);
    const fcCons = completedAF
      ? a.actFinish
      : fcP6 != null || perfRaw != null ? Math.max(fcP6 ?? 0, perfRaw ?? 0) : pos(blFinish) ? blFinish : null;
    let fcSel: Day | null;
    if (completedAF) fcSel = a.actFinish;
    else if (s.forecastMethod === 'P6 Current Finish') fcSel = fcP6 ?? fcCons;
    else if (s.forecastMethod === 'Performance-based') fcSel = fcPerf;
    else fcSel = fcCons;

    let fcSource = '';
    if (fcSel != null) {
      if (completedAF) fcSource = 'Actual finish';
      else if (fcP6 == null && perfRaw == null) fcSource = 'Baseline (no forecast data)';
      else if (s.forecastMethod === 'P6 Current Finish') fcSource = fcP6 != null ? 'P6 Current Finish' : 'Conservative (no P6 date)';
      else if (s.forecastMethod === 'Performance-based') fcSource = perfRaw != null ? 'Performance-based' : 'P6 (no performance data)';
      else if (fcP6 != null && perfRaw != null) fcSource = perfRaw > fcP6 ? 'Conservative = Performance' : 'Conservative = P6';
      else fcSource = fcP6 != null ? 'P6 (no performance data)' : 'Performance (no P6 date)';
    }

    const finishVarUsed = fcSel != null && pos(blFinish) ? fcSel - blFinish : null;
    const finishVarOrig = fcSel != null && origBL.finish != null ? fcSel - origBL.finish : null;
    const finishVarRev = fcSel != null && revBL.finish != null ? fcSel - revBL.finish : null;
    const startVar = !pos(blStart) ? null : a.actStart != null ? a.actStart - blStart : a.start != null ? a.start - blStart : null;
    const daysBehind = variance != null && included ? Math.max(0, -variance) * origDurDays : 0;
    const behind = included && variance != null && variance < -s.tolerance - EPS;
    const open = status !== 'Completed';
    const openPastBLF = included && open && pos(blFinish) && DD > blFinish;
    const finishedLate = included && status === 'Completed' && a.actFinish != null && pos(blFinish) && a.actFinish > blFinish;
    const notStartedPastBLS = included && status === 'Not Started' && pos(blStart) && DD > blStart;
    const tfDays = a.totalFloat;
    const flag = a.critical.trim().toUpperCase();
    const critical = !included ? false
      : s.critRule === 'Total Float <= 0' ? tfDays != null && open && tfDays <= 0
      : (flag.startsWith('Y') || flag === 'TRUE' || flag === '1') && open;
    const negFloat = included && tfDays != null && open && tfDays < 0;
    const lowFloat = included && tfDays != null && open && tfDays >= 0 && tfDays <= s.lowFloat;
    const lateFc = open && (finishVarUsed ?? 0) > 0;
    const delayed = included && (behind || openPastBLF || lateFc);
    const delayIndicator = !delayed ? ''
      : behind && (openPastBLF || lateFc) ? 'Behind + late finish'
      : behind ? 'Behind progress' : openPastBLF ? 'Past baseline finish' : 'Late finish forecast';
    const performance = !included ? 'Excluded'
      : status === 'Completed' ? 'Completed'
      : delayed ? 'Delayed'
      : status === 'Not Started' && (planned ?? 0) === 0 ? 'Not Started'
      : (variance ?? 0) > s.tolerance + EPS ? 'Ahead' : 'On Track';

    const p = a.id ? inp.prev?.get(key) : undefined;
    const inPrev = p != null;
    const prevActual = p ? p.actual ?? 0 : null;
    const periodProgress = p && actual != null ? actual - (p.actual ?? 0) : null;
    const prevBLFinish = p ? p.blFinish : null;
    const blFinishChanged = inPrev && pos(blFinish) && pos(prevBLFinish) && blFinish !== prevBLFinish;

    const flags = {
      missingId: !a.id,
      duplicateId: !!a.id && (idCount.get(key) ?? 0) > 1,
      missingBaseline: included && !hasBL,
      invalidValue: Object.keys(a.invalid).length > 0,
      missingProgress: included && actual == null,
      blFinishBeforeStart: hasBL && blFinish! < blStart!,
      unclassified: included && DIMENSIONS.some((d) => cls[d] === UNCLASSIFIED),
      progressWithoutAS: included && (actualField ?? 0) > 0 && a.actStart == null && !isMilestone,
      completedWithoutAF: included && /complet/i.test(a.status) && a.actFinish == null && !isMilestone,
      actualAfterDataDate: (a.actStart != null && a.actStart >= DD) || (a.actFinish != null && a.actFinish >= DD),
      missingWeight: included && !isMilestone && weight <= 0,
      afButPctBelow100: a.actFinish != null && actualField != null && actualField < 1,
      baselineFallback: included && (baselineUsed.includes('fallback') || baselineUsed === 'None'),
    };

    return {
      a, cls, isSummary, isLOE, isMilestone, included, status, origBL, revBL, baselineUsed, blStart, blFinish, hasBL,
      origDurDays, weightBasis, weight, planned, actualField, actual, variance, plannedEarned, actualEarned, ev, pv,
      fcP6, perfRaw, fcPerf, fcCons, fcSel, fcSource, finishVarUsed, finishVarOrig, finishVarRev, startVar, daysBehind,
      behind, openPastBLF, finishedLate, notStartedPastBLS, critical, negFloat, lowFloat, tfDays, delayed, delayIndicator,
      performance, inPrev, prevActual, periodProgress, prevBLFinish, blFinishChanged, flags,
    };
  });
}
