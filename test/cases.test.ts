/**
 * Hand-calculated cases (same list as the workbook's test report).
 * Expected values are worked out by hand in the comments - not taken from the code.
 * Data date for all cases: 11-Jan-26 (start of day).
 */
import { describe, it, expect } from 'vitest';
import { fromYMD, fmtDate } from '../src/core/dates';
import type { Activity } from '../src/core/types';
import { calcActivities, type BaselineMap } from '../src/core/engine';
import { summarize, groupTable, NO_FILTER, inFilter, weighted } from '../src/core/project';
import { DEFAULT_SETTINGS, type Settings } from '../src/core/settings';
import { emptyClassification, type ClassificationConfig } from '../src/core/classify';
import { fingerprint, approvalStatus } from '../src/core/fingerprint';
import { validate } from '../src/core/validate';
import { runImport, DEFAULT_IMPORT_OPTIONS } from '../src/core/importer';
import { importWorkbookSample, workbookGrid, refClassification, refOriginal, refRevised, refSettings, refSnapshots, refPrev } from './helpers';
import type { Grid } from '../src/core/xlsx';

const J = (n: number) => fromYMD(2026, 1, 1)! + n - 1; // J(1) = 01-Jan-26, J(40) = 09-Feb-26
const DD = J(11);
let rowNo = 2;
function mk(p: Partial<Activity>): Activity {
  return {
    row: rowNo++, projectId: 'P1', projectName: 'Test', id: 'X', name: 'Task', status: '', wbs: 'P1.A', wbsName: 'Area A', type: 'Task Dependent', critical: 'No',
    origDur: null, remDur: null, actDur: null, totalFloat: 5, freeFloat: null, blStart: null, blFinish: null, start: null, finish: null,
    actStart: null, actFinish: null, schedPct: null, physPct: null, durPct: null, unitsPct: null, actPct: null,
    budgetCost: null, actualCost: null, budgetUnits: null, actualUnits: null, invalid: {}, ...p,
  };
}
const S = (o: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, dataDate: DD, baselineUse: 'Current import', ...o });
const cls: ClassificationConfig = emptyClassification();
const calc = (acts: Activity[], s = S(), extra: { original?: BaselineMap; revised?: BaselineMap } = {}) => calcActivities({ activities: acts, settings: s, classification: cls, ...extra });

/** Base set used by H1-H4, S4 */
function base(): Activity[] {
  return [
    // A: 10 d, BL 01-10 Jan, finished on 10-Jan. Planned 100% (DD > BL finish), actual 100%.
    mk({ id: 'A', status: 'Completed', origDur: 10, blStart: J(1), blFinish: J(10), start: J(1), finish: J(10), actStart: J(1), actFinish: J(10), physPct: 1, budgetCost: 1000, budgetUnits: 100 }),
    // B: 20 d, BL 01-20 Jan, 25% done. Planned = (11-1)/20 = 50%. P6 finish 25-Jan.
    mk({ id: 'B', status: 'In Progress', origDur: 20, blStart: J(1), blFinish: J(20), start: J(1), finish: J(25), actStart: J(1), physPct: 0.25, budgetCost: 3000, budgetUnits: 100, critical: 'Yes', totalFloat: -3 }),
    // C: 10 d, BL 16-25 Jan, not started. Planned 0%.
    mk({ id: 'C', status: 'Not Started', origDur: 10, blStart: J(16), blFinish: J(25), start: J(16), finish: J(25), physPct: 0, budgetCost: 1000, budgetUnits: 200 }),
    // M: milestone on 05-Jan, achieved. Weight 0.
    mk({ id: 'M', status: 'Completed', type: 'Finish Milestone', origDur: 0, blStart: J(5), blFinish: J(5), actStart: J(5), actFinish: J(5), physPct: 1, budgetCost: 0 }),
    // WBS Summary and LOE: never counted (LOE excluded by default).
    mk({ id: 'S', status: 'In Progress', type: 'WBS Summary', origDur: 100, blStart: J(1), blFinish: J(100), actStart: J(1), physPct: 0.1, budgetCost: 999999 }),
    mk({ id: 'L', status: 'In Progress', type: 'Level of Effort', origDur: 50, blStart: J(1), blFinish: J(50), actStart: J(1), physPct: 0.9, budgetCost: 999999 }),
  ];
}

describe('H1 Duration weighting', () => {
  const rows = calc(base());
  const s = summarize(rows, S());
  it('weighted planned = (10*1 + 20*0.5 + 10*0) / 40 = 50%', () => expect(s.planned).toBeCloseTo(0.5, 12));
  it('weighted actual = (10*1 + 20*0.25 + 0) / 40 = 37.5%', () => expect(s.actual).toBeCloseTo(0.375, 12));
  it('variance = -12.5 pp', () => expect(s.variance).toBeCloseTo(-0.125, 12));
  it('WBS Summary and LOE excluded; milestone counted with weight 0', () => {
    expect(s.total).toBe(4);
    expect(rows.find((r) => r.a.id === 'M')!.weight).toBe(0);
    expect(rows.find((r) => r.a.id === 'S')!.included).toBe(false);
    expect(rows.find((r) => r.a.id === 'L')!.included).toBe(false);
  });
  it('counts: 2 completed, 1 in progress, 1 not started, 1 delayed (B behind 25 pp)', () => {
    expect([s.completed, s.inProgress, s.notStarted, s.delayed]).toEqual([2, 1, 1, 1]);
  });
  it('B performance forecast = DD + ROUNDUP(0.75*10/0.25) - 1 = 11-Jan + 29 = 09-Feb-26; conservative = later of P6 25-Jan and 09-Feb', () => {
    const b = rows.find((r) => r.a.id === 'B')!;
    expect(fmtDate(b.fcPerf)).toBe('09-Feb-26');
    expect(fmtDate(b.fcCons)).toBe('09-Feb-26');
    expect(b.fcSource).toBe('Conservative = Performance');
    expect(b.finishVarUsed).toBe(20);
  });
  it('C not started: forecast = max(BL finish, DD + BL span) = 25-Jan (no delay)', () => {
    expect(fmtDate(rows.find((r) => r.a.id === 'C')!.fcSel)).toBe('25-Jan-26');
  });
  it('project: forecast 09-Feb-26 vs BL finish 25-Jan-26 = 15 days late; health RED with 4 written reasons', () => {
    expect(fmtDate(s.forecastFinish)).toBe('09-Feb-26');
    expect(s.delayDays).toBe(15);
    expect(s.health).toBe('RED');
    expect(s.healthReasons).toEqual(['Forecast 15 days late (amber limit 0)', 'Behind 12.5 pp (red limit 10.0)', 'SPI 0.70 (red limit 0.90)', 'SPI(t) 0.75 (red limit 0.90)']); // EV 1750 / PV 2500
    expect(s.es?.spiT).toBeCloseTo(0.75, 2);
  });
  it('SPI(t) can be left out of the health colour', () => {
    expect(summarize(rows, S({ spiTHealth: false })).healthReasons).toHaveLength(3);
  });
  it('critical and negative float (open only)', () => { expect(s.critical).toBe(1); expect(s.negFloat).toBe(1); });
});

describe('H2 Cost weighting', () => {
  const s = summarize(calc(base(), S({ weightMethod: 'Cost' })), S({ weightMethod: 'Cost' }));
  it('planned = (1000*1 + 3000*0.5) / 5000 = 50%', () => expect(s.planned).toBeCloseTo(0.5, 12));
  it('actual = (1000 + 3000*0.25) / 5000 = 35%', () => expect(s.actual).toBeCloseTo(0.35, 12));
  it('EV = 1750, PV = 2500, SPI = 0.70 (cost coverage 100%)', () => {
    expect(s.ev).toBeCloseTo(1750, 9); expect(s.pv).toBeCloseTo(2500, 9); expect(s.spi).toBeCloseTo(0.7, 12); expect(s.spiReason).toBe('');
  });
  it('SPI does not depend on the weighting method', () => expect(summarize(calc(base()), S()).spi).toBeCloseTo(0.7, 12));
  it('SPI is N/A with the reason when cost coverage is below the threshold', () => {
    const acts = base(); acts[2].budgetCost = null; // C has no cost -> 2 of 3 non-milestones = 67%
    const x = summarize(calc(acts), S());
    expect(x.spi).toBeNull();
    expect(x.spiReason).toBe('Budgeted cost missing for 33% of activities');
  });
  it('SPI is N/A when there is no cost at all', () => {
    const acts = base().map((a) => ({ ...a, budgetCost: null }));
    expect(summarize(calc(acts), S()).spiReason).toBe('No budgeted cost in the import');
  });
});

describe('H3 Man-hours weighting', () => {
  const s = summarize(calc(base(), S({ weightMethod: 'Man-hours' })), S({ weightMethod: 'Man-hours' }));
  it('planned = (100*1 + 100*0.5 + 200*0) / 400 = 37.5%', () => expect(s.planned).toBeCloseTo(0.375, 12));
  it('actual = (100 + 25) / 400 = 31.25%', () => expect(s.actual).toBeCloseTo(0.3125, 12));
});

describe('H4 Missing baseline - reported and excluded, never zero', () => {
  const acts = [...base(), mk({ id: 'D', status: 'In Progress', origDur: 10, actStart: J(5), physPct: 0.5 })];
  const rows = calc(acts);
  const s = summarize(rows, S());
  it('planned unchanged at 50% (D has no planned % and is left out of the planned figure)', () => expect(s.planned).toBeCloseTo(0.5, 12));
  it('actual includes D: (15 + 10*0.5) / 50 = 40%', () => expect(s.actual).toBeCloseTo(0.4, 12));
  it('D planned % is empty, not 0', () => expect(rows.find((r) => r.a.id === 'D')!.planned).toBeNull());
  it('validation reports it', () => {
    const imp = { activities: acts, cellIssues: [], ignoredRows: [], unusedColumns: [], sharedColumns: [], matches: Object.fromEntries(['id', 'name', 'blStart', 'blFinish'].map((k) => [k, { column: 0 }])) } as never;
    const rep = validate(imp, rows, S());
    expect(rep.checks.find((c) => c.id === 'nobl')!.items).toEqual(['D']);
  });
  it('missing progress is reported, not counted as 0%', () => {
    const a2 = [...base(), mk({ id: 'E', status: 'Not Started', origDur: 10, blStart: J(1), blFinish: J(10), physPct: null })];
    const r2 = calc(a2);
    expect(r2.find((r) => r.a.id === 'E')!.actual).toBeNull();
    expect(r2.find((r) => r.a.id === 'E')!.flags.missingProgress).toBe(true);
    expect(summarize(r2, S()).actual).toBeCloseTo(0.375, 12); // unchanged: E is excluded from actual
  });
});

describe('H5 Duplicate IDs', () => {
  it('detected and block approval', () => {
    const acts = [...base(), mk({ id: 'B', status: 'Not Started', origDur: 5, blStart: J(20), blFinish: J(24), physPct: 0 })];
    const rows = calc(acts);
    const imp = { activities: acts, cellIssues: [], ignoredRows: [], unusedColumns: [], sharedColumns: [], matches: Object.fromEntries(['id', 'name', 'blStart', 'blFinish'].map((k) => [k, { column: 0 }])) } as never;
    const rep = validate(imp, rows, S());
    expect(rep.checks.find((c) => c.id === 'dup')!.count).toBe(2);
    expect(approvalStatus(rep.criticalCount, null, fingerprint(rows, S()))).toBe('BLOCKED');
  });
});

describe('H6 Nothing started', () => {
  const acts = [
    mk({ id: 'A', status: 'Not Started', origDur: 10, blStart: J(20), blFinish: J(29), finish: J(29), physPct: 0 }),
    mk({ id: 'B', status: 'Not Started', origDur: 30, blStart: J(15), blFinish: J(44), finish: J(44), physPct: 0 }),
  ];
  const s = summarize(calc(acts), S());
  it('0% planned, 0% actual, no delays, GREEN', () => {
    expect(s.planned).toBe(0); expect(s.actual).toBe(0);
    expect([s.completed, s.inProgress, s.notStarted, s.delayed]).toEqual([0, 0, 2, 0]);
    expect(s.health).toBe('GREEN');
    expect(s.delayDays).toBe(0);
  });
});

describe('H7 All completed', () => {
  const acts = [
    mk({ id: 'A', status: 'Completed', origDur: 5, blStart: J(1), blFinish: J(5), actStart: J(1), actFinish: J(5), physPct: 1 }),
    mk({ id: 'B', status: 'Completed', origDur: 5, blStart: J(3), blFinish: J(7), actStart: J(3), actFinish: J(8), physPct: 0.9 }),
  ];
  const rows = calc(acts);
  const s = summarize(rows, S());
  it('100% actual (Actual Finish counts as 100%), all completed', () => {
    expect(s.actual).toBe(1); expect(s.completed).toBe(2);
    expect(rows[1].flags.afButPctBelow100).toBe(true);
  });
  it('finished late is counted, forecast = latest actual finish', () => {
    expect(s.finishedLate).toBe(1);
    expect(fmtDate(s.forecastFinish)).toBe('08-Jan-26');
  });
});

describe('H8 On schedule', () => {
  const acts = [
    mk({ id: 'A', status: 'Completed', origDur: 10, blStart: J(1), blFinish: J(10), finish: J(10), actStart: J(1), actFinish: J(10), physPct: 1, budgetCost: 100 }),
    // planned (11-1)/20 = 50%, actual 50%; performance = 11 + 0.5*10/0.5 - 1 = 20-Jan = BL finish
    mk({ id: 'B', status: 'In Progress', origDur: 20, blStart: J(1), blFinish: J(20), finish: J(20), actStart: J(1), physPct: 0.5, budgetCost: 100 }),
  ];
  const s = summarize(calc(acts), S());
  it('no delays, variance 0, SPI 1, GREEN with no reasons', () => {
    expect(s.variance).toBeCloseTo(0, 12); expect(s.delayed).toBe(0); expect(s.delayDays).toBe(0);
    expect(s.spi).toBeCloseTo(1, 12); expect(s.health).toBe('GREEN'); expect(s.healthReasons).toEqual([]);
  });
});

describe('S1 Sample - history never changes', () => {
  it('saved snapshots are untouched by recalculation', () => {
    const snaps = refSnapshots();
    const before = JSON.stringify(snaps);
    const freeze = (o: unknown): unknown => { if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
    freeze(snaps);
    calcActivities({ activities: importWorkbookSample().activities, settings: refSettings(), classification: refClassification(), original: refOriginal(), revised: refRevised(), prev: refPrev() });
    expect(JSON.stringify(snaps)).toBe(before);
  });
});

describe('S2/S3 Filters do not distort calculations', () => {
  const rows = calcActivities({ activities: importWorkbookSample().activities, settings: refSettings(), classification: refClassification(), original: refOriginal(), revised: refRevised(), prev: refPrev() });
  it('Mechanical filter = weighted figure of exactly the Mechanical activities', () => {
    const f = { ...NO_FILTER, discipline: 'Mechanical' };
    const s = summarize(rows, refSettings(), f);
    const direct = weighted(rows.filter((r) => r.included && r.cls.discipline === 'Mechanical'));
    expect(s.planned).toBeCloseTo(direct.planned!, 14);
    expect(s.actual).toBeCloseTo(direct.actual!, 14);
    expect(s.total).toBe(rows.filter((r) => r.included && r.cls.discipline === 'Mechanical').length);
  });
  it('Main Building + Level 1 combined', () => {
    const f = { ...NO_FILTER, building: 'Main Building', floor: 'Level 1' };
    const sub = rows.filter((r) => inFilter(r, f));
    expect(sub.length).toBeGreaterThan(0);
    expect(sub.every((r) => r.cls.building === 'Main Building' && r.cls.floor === 'Level 1')).toBe(true);
    expect(summarize(rows, refSettings(), f).planned).toBeCloseTo(weighted(sub).planned!, 14);
  });
  it('group weights add up to 100% and the weighted mean of groups equals the total', () => {
    const g = groupTable(rows, NO_FILTER, 'discipline', ['Architectural', 'Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire Fighting', 'General'], true);
    expect(g.reduce((n, x) => n + x.weightShare!, 0)).toBeCloseTo(1, 12);
    const tot = summarize(rows, refSettings());
    expect(g.reduce((n, x) => n + x.weightShare! * x.actual!, 0)).toBeCloseTo(tot.actual!, 12);
  });
});

describe('S4 Forecast methods', () => {
  const pf = (m: Settings['forecastMethod']) => summarize(calc(base(), S({ forecastMethod: m })), S({ forecastMethod: m }));
  it('P6 Current Finish: project 25-Jan (B uses P6 date), 0 days late', () => { const s = pf('P6 Current Finish'); expect(fmtDate(s.forecastFinish)).toBe('25-Jan-26'); expect(s.delayDays).toBe(0); });
  it('Performance-based: 09-Feb, 15 days late', () => { const s = pf('Performance-based'); expect(fmtDate(s.forecastFinish)).toBe('09-Feb-26'); expect(s.delayDays).toBe(15); });
  it('Conservative: later of the two', () => expect(fmtDate(pf('Conservative (later of P6 and performance)').forecastFinish)).toBe('09-Feb-26'));
  it('sources are named', () => {
    const b = (m: Settings['forecastMethod']) => calc(base(), S({ forecastMethod: m })).find((r) => r.a.id === 'B')!.fcSource;
    expect([b('P6 Current Finish'), b('Performance-based')]).toEqual(['P6 Current Finish', 'Performance-based']);
  });
});

describe('S5 Duration % actual and P6 Schedule % planned', () => {
  const acts = [
    mk({ id: 'A', status: 'In Progress', origDur: 10, blStart: J(1), blFinish: J(10), actStart: J(1), physPct: 0.2, durPct: 0.6, schedPct: 0.7 }),
    mk({ id: 'B', status: 'In Progress', origDur: 30, blStart: J(1), blFinish: J(30), actStart: J(1), physPct: 0.4, durPct: 0.3, schedPct: 0.5 }),
  ];
  it('actual uses Duration % only: (10*0.6 + 30*0.3)/40 = 37.5%', () => {
    expect(summarize(calc(acts, S({ actualSource: 'Duration % Complete' })), S()).actual).toBeCloseTo(0.375, 12);
  });
  it('planned uses P6 Schedule %: (10*0.7 + 30*0.5)/40 = 55%', () => {
    expect(summarize(calc(acts, S({ plannedMethod: 'P6 Schedule % Complete' })), S()).planned).toBeCloseTo(0.55, 12);
  });
});

describe('S6 Approval fingerprint', () => {
  const rows = calc(base());
  const fp = fingerprint(rows, S());
  it('same data and settings -> same fingerprint (approved)', () => {
    expect(fingerprint(calc(base()), S())).toBe(fp);
    expect(approvalStatus(0, fp, fingerprint(calc(base()), S()))).toBe('APPROVED');
  });
  it('one WBS character changed -> changed since approval', () => {
    const a = base(); a[0].wbs = 'P1.B';
    expect(approvalStatus(0, fp, fingerprint(calc(a), S()))).toBe('CHANGED SINCE APPROVAL');
  });
  it('+1% progress -> changed', () => { const a = base(); a[1].physPct = 0.26; expect(fingerprint(calc(a), S())).not.toBe(fp); });
  it('one setting changed -> changed', () => expect(fingerprint(rows, S({ tolerance: 0.06 }))).not.toBe(fp));
  it('classification change -> changed', () => {
    const c2: ClassificationConfig = { ...cls, overrides: [{ id: 'A', values: { discipline: 'Civil' } }] };
    expect(fingerprint(calcActivities({ activities: base(), settings: S(), classification: c2 }), S())).not.toBe(fp);
  });
  it('project title is display-only and does not void approval', () => expect(fingerprint(rows, S({ projectTitle: 'New title' }))).toBe(fp));
  it('not approved yet -> pending', () => expect(approvalStatus(0, null, fp)).toBe('PENDING REVIEW'));
});

describe('S7 Monthly update: new, removed and re-baselined activities', () => {
  const prev = new Map([['a', { actual: 1, blFinish: J(10) }], ['b', { actual: 0.1, blFinish: J(18) }], ['z', { actual: 0, blFinish: J(30) }]]);
  const acts = base();
  const rows = calcActivities({ activities: acts, settings: S(), classification: cls, prev });
  const imp = { activities: acts, cellIssues: [], ignoredRows: [], unusedColumns: [], sharedColumns: [], matches: Object.fromEntries(['id', 'name', 'blStart', 'blFinish'].map((k) => [k, { column: 0 }])) } as never;
  const rep = validate(imp, rows, S(), { ids: ['A', 'B', 'Z'] });
  const c = (id: string) => rep.checks.find((x) => x.id === id)!.items;
  it('new: C and M (included, not in previous)', () => expect(c('new')).toEqual(['C', 'M']));
  it('removed: Z', () => expect(c('removed')).toEqual(['Z']));
  it('re-baselined: B (BL finish 18-Jan -> 20-Jan)', () => expect(c('blchg')).toEqual(['B']));
  it('period progress of B = 25% - 10% = 15 pp', () => expect(rows.find((r) => r.a.id === 'B')!.periodProgress).toBeCloseTo(0.15, 12));
});

describe('S8 Revised baseline', () => {
  const original: BaselineMap = new Map([['a', { start: J(1), finish: J(10) }], ['b', { start: J(1), finish: J(20) }], ['c', { start: J(16), finish: J(25) }], ['m', { start: J(5), finish: J(5) }]]);
  const revised: BaselineMap = new Map([['b', { start: J(1), finish: J(40) }], ['c', { start: J(30), finish: J(39) }]]);
  const s = S({ baselineUse: 'Revised (saved)' });
  const rows = calc(base(), s, { original, revised });
  const sum = summarize(rows, s);
  it('B planned on Rev: (11-1)/40 = 25%', () => expect(rows.find((r) => r.a.id === 'B')!.planned).toBeCloseTo(0.25, 12));
  it('A not in revision -> original used, flagged as fallback', () => {
    const a = rows.find((r) => r.a.id === 'A')!;
    expect(a.baselineUsed).toBe('Original (fallback)'); expect(a.flags.baselineFallback).toBe(true);
  });
  it('overall planned on Rev: (10*1 + 20*0.25 + 10*0)/40 = 37.5%', () => expect(sum.planned).toBeCloseTo(0.375, 12));
  it('delays vs revised and vs original are kept separate', () => {
    // forecast 09-Feb (J40); revised finish = J40 -> 0; original finish = J25 -> 15
    expect(fmtDate(sum.forecastFinish)).toBe('09-Feb-26');
    expect(sum.delayVsRev).toBe(0); expect(sum.delayVsOrig).toBe(15);
  });
});

describe('S9 Shuffled and renamed columns - full sample', () => {
  it('reversed column order + alternative header names give identical results', () => {
    const g = workbookGrid();
    const rename: Record<string, string> = { 'Activity ID': 'task_code', 'Activity Name': 'task_name', 'BL Project Start': 'Baseline Start', 'BL Project Finish': 'Baseline Finish', 'Physical % Complete': 'phys_complete_pct', 'Original Duration': 'Orig Dur', 'Total Float': 'TF' };
    const width = g[0].length;
    const shuffled: Grid = g.map((r, i) => Array.from({ length: width }, (_, j) => { const c = r[width - 1 - j] ?? null; return i === 0 && typeof c === 'string' && rename[c] ? rename[c] : c; }));
    const a = runImport(g, 'x', false, {}, DEFAULT_IMPORT_OPTIONS);
    const b = runImport(shuffled, 'x', false, {}, DEFAULT_IMPORT_OPTIONS);
    const run = (acts: Activity[]) => summarize(calcActivities({ activities: acts, settings: refSettings(), classification: refClassification(), original: refOriginal(), revised: refRevised() }), refSettings());
    const sa = run(a.activities), sb = run(b.activities);
    expect(sb.planned).toBe(sa.planned); expect(sb.actual).toBe(sa.actual); expect(sb.delayed).toBe(sa.delayed); expect(sb.forecastFinish).toBe(sa.forecastFinish);
    expect(sa.planned).toBeCloseTo(0.865479723046489, 12);
  });
});
