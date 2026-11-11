/**
 * Earned Schedule (Lipke): progress measured in time instead of value.
 * ES = the date on the baseline (planned) curve at which the planned % equals today's actual %.
 *   SPI(t) = (ES - start) / (data date - start)      1.0 = on time, < 1 behind
 *   SV(t)  = (ES - start) - (data date - start)      in calendar days, negative = behind
 *   forecast finish (IEAC(t)) = start + planned duration / SPI(t)
 * The planned % uses the same straight-line baseline distribution as the S-curve and planned %.
 */
import type { CalcRow } from './engine';
import type { Day } from './dates';
import { inFilter, type Filters } from './project';

export interface EarnedSchedule {
  start: Day; plannedFinish: Day;
  /** fractional day */
  es: number;
  spiT: number;
  svT: number;
  forecast: Day;
}

function plannedAt(rows: CalcRow[], sw: number, D: number): number {
  let v = 0;
  for (const r of rows) {
    const s0 = r.blStart!, f0 = r.blFinish!;
    v += r.weight * ((D > f0 ? 1 : 0) + (D > s0 && D <= f0 ? (D - s0) / (Math.abs(f0 - s0) + 1) : 0));
  }
  return v / sw;
}

export function earnedSchedule(all: CalcRow[], f: Filters, actual: number | null, dataDate: Day): EarnedSchedule | null {
  const rows = all.filter((r) => inFilter(r, f) && r.hasBL && r.blStart != null && r.blFinish != null && r.blStart > 0);
  const sw = rows.reduce((n, r) => n + r.weight, 0);
  if (!rows.length || sw <= 0 || actual == null) return null;
  const start = Math.min(...rows.map((r) => r.blStart!));
  const plannedFinish = Math.max(...rows.map((r) => r.blFinish!)) + 1; // planned reaches 100% the day after the last baseline finish
  const at = dataDate - start;
  if (at <= 0) return null;
  let es: number;
  if (actual <= 0) es = start;
  else if (actual >= 1 - 1e-9) es = plannedFinish;
  else {
    // first day D where planned(D) >= actual, then interpolate inside that day
    let lo = start, hi = plannedFinish;
    while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (plannedAt(rows, sw, mid) >= actual) hi = mid; else lo = mid; }
    const p0 = plannedAt(rows, sw, lo), p1 = plannedAt(rows, sw, hi);
    es = p1 > p0 ? lo + (actual - p0) / (p1 - p0) : hi;
  }
  const spiT = (es - start) / at;
  const pd = plannedFinish - start;
  return { start, plannedFinish, es, spiT, svT: es - start - at, forecast: spiT > 0 ? Math.round(start + pd / spiT) : plannedFinish };
}
