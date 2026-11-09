import { describe, it, expect, afterAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { importP6Sample, importWorkbookSample, refSettings, refClassification, refOriginal, refRevised, refPrev, refEngine, ser, isSerial } from './helpers';
import { calcActivities, type CalcRow } from '../src/core/engine';
import { DIMENSIONS } from '../src/core/classify';

type J = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const num = (x: J) => (x === '' || x == null ? null : isSerial(x) ? ser(x) : x);

/** our value -> comparable value; Excel blank "" == null */
const COLS: [string, (r: CalcRow) => J][] = [
  ['Status', (r) => r.status],
  ['Included', (r) => (r.included ? 1 : 0)],
  ['WBS Summary', (r) => (r.isSummary ? 1 : 0)],
  ['LOE', (r) => (r.isLOE ? 1 : 0)],
  ['Milestone', (r) => (r.isMilestone ? 1 : 0)],
  ['Phase', (r) => r.cls.phase], ['Discipline', (r) => r.cls.discipline], ['Building', (r) => r.cls.building],
  ['Floor', (r) => r.cls.floor], ['Location', (r) => r.cls.location],
  ['Baseline Used', (r) => r.baselineUsed],
  ['BL Start (used)', (r) => r.blStart ?? 0], ['BL Finish (used)', (r) => r.blFinish ?? 0],
  ['Orig Dur (days)', (r) => r.origDurDays],
  ['Weight', (r) => r.weight],
  ['Planned %', (r) => r.planned], ['Actual %', (r) => r.actual], ['Variance (pp)', (r) => r.variance],
  ['EV (cost)', (r) => r.ev], ['PV (cost)', (r) => r.pv],
  ['Forecast: P6 Current Finish', (r) => r.fcP6], ['Forecast: Performance', (r) => r.fcPerf],
  ['Forecast: Conservative', (r) => r.fcCons], ['Forecast Finish (selected)', (r) => r.fcSel], ['Forecast Source', (r) => r.fcSource],
  ['Finish Var vs BL used (days)', (r) => r.finishVarUsed], ['Finish Var vs Original (days)', (r) => r.finishVarOrig],
  ['Finish Var vs Revised (days)', (r) => r.finishVarRev], ['Start Var (days)', (r) => r.startVar],
  ['Days Behind (equiv.)', (r) => r.daysBehind],
  ['Behind', (r) => +r.behind], ['Open Past BL Finish', (r) => +r.openPastBLF], ['Finished Late', (r) => +r.finishedLate],
  ['Not Started Past BL Start', (r) => +r.notStartedPastBLS], ['Critical#2', (r) => +r.critical], ['Negative Float', (r) => +r.negFloat],
  ['Low Float', (r) => +r.lowFloat], ['Total Float (days)', (r) => r.tfDays], ['Delayed', (r) => +r.delayed],
  ['Delay Indicator', (r) => r.delayIndicator], ['Performance', (r) => r.performance],
  ['In Prev Snapshot', (r) => +r.inPrev], ['Prev Actual %', (r) => r.prevActual], ['Period Progress', (r) => r.periodProgress],
  ['BL Finish Changed', (r) => +r.blFinishChanged],
  ['Missing Baseline', (r) => +r.flags.missingBaseline], ['Missing Progress', (r) => +r.flags.missingProgress],
  ['Unclassified', (r) => +r.flags.unclassified], ['Missing Weight', (r) => +r.flags.missingWeight],
  ['Baseline Fallback', (r) => +r.flags.baselineFallback], ['Duplicate ID', (r) => +r.flags.duplicateId],
];

function compare(rows: CalcRow[]) {
  const ref = refEngine();
  const diffs: string[] = [];
  let checks = 0;
  for (const r of rows) {
    const e = ref.get(r.a.id);
    if (!e) { diffs.push(`${r.a.id}: not in Excel`); continue; }
    for (const [col, f] of COLS) {
      if (!(col in e)) { diffs.push(`column ${col} missing in reference`); continue; }
      const o0 = f(r); const ours = o0 === '' ? null : o0 ?? null;
      const theirs = num(e[col]);
      checks++;
      const same = typeof ours === 'number' && typeof theirs === 'number' ? Math.abs(ours - theirs) < 1e-6 : ours === theirs;
      if (!same) diffs.push(`${r.a.id} ${col}: web=${ours} excel=${theirs}`);
    }
  }
  return { diffs, checks };
}

const inputs = (acts: J) => ({ activities: acts, settings: refSettings(), classification: refClassification(), original: refOriginal(), revised: refRevised(), prev: refPrev() });

const results: string[] = [];
describe('Activity engine matches the Excel ACTIVITIES ENGINE (sample, defaults)', () => {
  it('workbook sample: every column, every activity', () => {
    const { diffs, checks } = compare(calcActivities(inputs(importWorkbookSample().activities)));
    results.push(`| Workbook sample (RAW PRIMAVERA DATA) | 84 | ${COLS.length} | ${checks} | ${diffs.length} |`);
    expect(diffs.slice(0, 40)).toEqual([]);
    expect(checks).toBeGreaterThan(84 * 40);
  });
  it('SAMPLE_P6_Export.xlsx: every column, every activity', () => {
    const { diffs, checks } = compare(calcActivities(inputs(importP6Sample().activities)));
    results.push(`| SAMPLE_P6_Export.xlsx | 84 | ${COLS.length} | ${checks} | ${diffs.length} |`);
    expect(diffs.slice(0, 40)).toEqual([]);
  });
  it('dims', () => expect(DIMENSIONS.length).toBe(5));
});

afterAll(() => {
  mkdirSync(join(__dirname, '..', 'reports'), { recursive: true });
  writeFileSync(join(__dirname, '..', 'reports', 'comparison-activity-level.md'),
    `# Web app vs Excel ACTIVITIES ENGINE - every activity, every column\n\nColumns compared: ${COLS.map((c) => c[0].replace('#2', '')).join(', ')}.\n\n| Source | Activities | Columns | Values compared | Differences |\n|---|---|---|---|---|\n${results.join('\n')}\n`);
});
