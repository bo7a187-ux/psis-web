import { describe, it, expect, afterAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  REF, importP6Sample, importWorkbookSample, refSettings, refClassification, refOriginal, refRevised, refPrev, refSnapshots, ser, isSerial, cell, DATA_DATE,
} from './helpers';
import { calcActivities } from '../src/core/engine';
import { summarize, groupTable, exceptionList, topDelayed, baselineCurve, trendCompletion, snapshotActual, NO_FILTER, type Filters } from '../src/core/project';
import { fmtDate } from '../src/core/dates';
import type { Dimension } from '../src/core/classify';

type J = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const H = REF.execHelpers;
const val = (x: J) => (isSerial(x) ? ser(x) : x);
const lists = REF.lists;

function run(src: 'p6' | 'wb', f: Filters = NO_FILTER) {
  const acts = (src === 'p6' ? importP6Sample() : importWorkbookSample()).activities;
  const rows = calcActivities({ activities: acts, settings: refSettings(), classification: refClassification(), original: refOriginal(), revised: refRevised(), prev: refPrev() });
  return { rows, sum: summarize(rows, refSettings(), f) };
}

const table: { item: string; excel: string; web: string; ok: boolean }[] = [];
const pct = (x: number | null | undefined) => (x == null ? '-' : `${(x * 100).toFixed(4)}%`);
function rec(item: string, excel: J, web: J, kind: 'pct' | 'num' | 'date' | 'text' = 'num', tol = 1e-6) {
  const e = val(excel), w = web ?? null;
  const ok = typeof e === 'number' && typeof w === 'number' ? Math.abs(e - w) <= tol : (e ?? null) === w || (e === '' && w == null);
  const show = (x: J) => (x == null ? '-' : kind === 'pct' ? pct(x) : kind === 'date' ? fmtDate(x) : kind === 'num' && typeof x === 'number' ? String(+x.toFixed(6)) : String(x));
  table.push({ item, excel: show(e), web: show(w), ok });
  return ok;
}

describe('Project level vs Excel (sample, defaults, no filter)', () => {
  for (const src of ['wb', 'p6'] as const) {
    it(`KPIs - ${src === 'wb' ? 'workbook sample' : 'SAMPLE_P6_Export.xlsx'}`, () => {
      const { sum } = run(src);
      const T = (n: string) => `${n}${src === 'p6' ? ' (P6 file)' : ''}`;
      const checks = [
        rec(T('Planned %'), H['Planned %'], sum.planned, 'pct'),
        rec(T('Actual %'), H['Actual %'], sum.actual, 'pct'),
        rec(T('Variance'), H['Variance'], sum.variance, 'pct'),
        rec(T('EV'), H['EV'], sum.ev, 'num', 1e-4),
        rec(T('PV'), H['PV'], sum.pv, 'num', 1e-4),
        rec(T('SPI'), H['SPI'], sum.spi),
        rec(T('Cost coverage'), H['Cost coverage'], sum.costCoverage, 'pct'),
        rec(T('Included activities'), H['Total'], sum.total),
        rec(T('Completed'), H['Completed'], sum.completed),
        rec(T('In progress'), H['In progress'], sum.inProgress),
        rec(T('Not started'), H['Not started'], sum.notStarted),
        rec(T('Delayed'), H['Delayed'], sum.delayed),
        rec(T('Critical (open)'), H['Critical open'], sum.critical),
        rec(T('Negative float'), H['Neg float'], sum.negFloat),
        rec(T('Project BL start'), H['Proj BL start'], sum.blStart, 'date'),
        rec(T('Project BL finish'), H['Proj BL finish'], sum.blFinish, 'date'),
        rec(T('Forecast finish (selected)'), H['Forecast finish'], sum.forecastFinish, 'date'),
        rec(T('Forecast - P6'), H['P6 finish'], sum.forecastP6, 'date'),
        rec(T('Forecast - performance'), H['AD:Perf finish'], sum.forecastPerf, 'date'),
        rec(T('Forecast - conservative'), H['AD:Cons finish'], sum.forecastCons, 'date'),
        rec(T('Delay vs BL used (days)'), H['Delay days vs BL used'], sum.delayDays),
        rec(T('Delay vs original (days)'), H['Delay vs original'], sum.delayVsOrig),
        rec(T('Delay vs revised (days)'), H['Delay vs revised'], sum.delayVsRev),
        rec(T('Project float (days)'), H['Project float'], sum.projectFloat),
        rec(T('Time elapsed'), H['Time elapsed'], sum.timeElapsed, 'pct'),
        rec(T('Critical path planned'), H['Crit planned'], sum.critPlanned, 'pct'),
        rec(T('Critical path actual'), H['Crit actual'], sum.critActual, 'pct'),
        rec(T('Health'), H['Health'], sum.health, 'text'),
        rec(T('Health reasons'), H['AD:Health reasons'], sum.healthReasons.join('; '), 'text'),
      ];
      expect(table.filter((t) => !t.ok)).toEqual([]);
      expect(checks.every(Boolean)).toBe(true);
    });
  }

  it('schedule control: exception counts', () => {
    const { sum } = run('wb');
    const sc = REF.scheduleControl;
    expect([
      rec('Behind planned progress', cell(sc, 'N7'), sum.behind),
      rec('Open past baseline finish', cell(sc, 'N8'), sum.openPastBLF),
      rec('Not started past baseline start', cell(sc, 'N9'), sum.notStartedPastBLS),
      rec('Finished late', cell(sc, 'N10'), sum.finishedLate),
      rec('Low float (open)', cell(sc, 'R8'), sum.lowFloat),
      rec('Baseline finish changed vs previous', cell(sc, 'R9'), sum.blFinishChanged),
    ].every(Boolean)).toBe(true);
  });

  it('schedule control: group tables (weight %, planned, actual, variance, period +, delayed, critical)', () => {
    const { rows } = run('wb');
    const sc = REF.scheduleControl;
    const blocks: [Dimension, string, number][] = [['discipline', 'B', 19], ['phase', 'K', 19], ['building', 'B', 38], ['floor', 'K', 38]];
    const bad: string[] = [];
    for (const [dim, col, row0] of blocks) {
      const g = groupTable(rows, NO_FILTER, dim, lists[dim], true);
      const c0 = col.charCodeAt(0);
      const L = (i: number, r: number) => cell(sc, String.fromCharCode(c0 + i) + r);
      for (let r = row0; r < row0 + 16; r++) {
        const name = L(0, r);
        if (!name || L(1, r) == null || L(1, r) === '') continue;
        const ours = g.find((x) => x.name === name);
        if (!ours) { bad.push(`${dim} ${name}: missing`); continue; }
        const cols: [string, J, J, 'pct' | 'num'][] = [['weight %', L(1, r), ours.weightShare, 'pct'], ['planned', L(2, r), ours.planned, 'pct'], ['actual', L(3, r), ours.actual, 'pct'],
          ['variance', L(4, r), ours.variance, 'pct'], ['period +', L(5, r), ours.period, 'pct'], ['delayed', L(6, r), ours.delayed, 'num'], ['critical', L(7, r), ours.critical, 'num']];
        for (const [k, e, w, kind] of cols) if (!rec(`${dim[0].toUpperCase() + dim.slice(1)} ${name} - ${k}`, e, w, kind)) bad.push(`${dim} ${name} ${k}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('delay analysis: "Late finish forecast" list - same activities in the same order', () => {
    const { rows } = run('wb');
    const da = REF.delayAnalysis;
    const excelIds: string[] = [];
    for (let r = 9; r < 40; r++) { const id = cell(da, 'B' + r); if (typeof id === 'string' && /^SMP-/.test(id)) excelIds.push(id); }
    const ours = exceptionList(rows, refSettings(), NO_FILTER, 'Late finish forecast (days)').map((r) => r.a.id);
    rec('Delay analysis list (late finish) - IDs in order', excelIds.join(','), ours.slice(0, excelIds.length).join(','), 'text');
    rec('Delay analysis list - count', cell(da, 'U2'), ours.length);
    expect(ours.slice(0, excelIds.length)).toEqual(excelIds);
  });

  it('executive dashboard: top 10 delayed - same activities in the same order', () => {
    const { rows } = run('wb');
    const ex = REF.execDashboard;
    const excel: string[] = [];
    for (let r = 50; r < 70; r++) { const t = cell(ex, 'H' + r); if (typeof t === 'string' && /^SMP-\d+ /.test(t)) excel.push(t.split(' ')[0]); }
    const ours = topDelayed(rows, NO_FILTER, 10).map((r) => r.a.id);
    rec('Top 10 delayed - IDs in order', excel.join(','), ours.join(','), 'text');
    expect(ours).toEqual(excel);
  });

  it('S-curve: baseline monthly planned matches the points Excel calculates', () => {
    const { rows } = run('wb');
    const curve = baselineCurve(rows, NO_FILTER);
    const excelPts = REF.sCurve.filter((r: J[]) => isSerial(r[0]) && typeof r[1] === 'number');
    for (let i = 0; i < excelPts.length; i++) {
      expect(curve[i].date).toBe(ser(excelPts[i][0]));
      rec(`S-curve baseline ${fmtDate(curve[i].date)}`, excelPts[i][1], curve[i].planned, 'pct');
      expect(Math.abs(curve[i].planned - excelPts[i][1])).toBeLessThan(1e-9);
    }
    // the Excel chain stops after 5 months (label "rate/day" sits in T40) - the web app continues to the baseline finish
    expect(excelPts.length).toBe(5);
    expect(fmtDate(curve[curve.length - 1].date)).toBe('30-Apr-27');
    expect(curve[curve.length - 1].planned).toBeCloseTo(1, 12);
  });

  it('S-curve: actual history per snapshot and trend completion', () => {
    const { sum } = run('wb');
    const snaps = refSnapshots();
    const excelHist = REF.sCurve.filter((r: J[]) => isSerial(r[3]));
    excelHist.forEach((r: J[], i: number) => rec(`S-curve actual ${fmtDate(ser(r[3]))}`, r[4], snapshotActual(snaps[i], NO_FILTER), 'pct'));
    const t = trendCompletion(sum.actual, DATA_DATE, snaps, NO_FILTER);
    rec('Trend rate per day', REF.trendHelpers[1], t.rate, 'num', 1e-12);
    rec('Trend completion (indicative)', H['Trend completion'], t.date, 'date');
    expect(t.date).toBe(ser(H['Trend completion']));
  });

  it('filters: Mechanical / Main Building + Level 1 run without distorting totals', () => {
    const { rows } = run('wb');
    const mech = summarize(rows, refSettings(), { ...NO_FILTER, discipline: 'Mechanical' });
    const g = groupTable(rows, NO_FILTER, 'discipline', lists.discipline, true).find((x) => x.name === 'Mechanical')!;
    expect(mech.planned).toBeCloseTo(g.planned!, 12);
    expect(mech.actual).toBeCloseTo(g.actual!, 12);
  });
});

afterAll(() => {
  const lines = ['| Item | Excel | Web app | Match |', '|---|---|---|---|', ...table.map((t) => `| ${t.item} | ${t.excel} | ${t.web} | ${t.ok ? 'Yes' : '**NO**'} |`)];
  writeFileSync(join(__dirname, '..', 'reports', 'comparison-project-level.md'), `# Web app vs Excel - project level (sample, data date 08-Nov-26, defaults)\n\n${lines.join('\n')}\n`);
});
