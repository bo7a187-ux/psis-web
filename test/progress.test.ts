import { describe, it, expect } from 'vitest';
import { applyProgress, progressDates } from '../src/core/progress';
import type { Activity } from '../src/core/types';

const act = (id: string, status: string, physPct: number | null): Activity => ({
  row: 1, projectId: '', projectName: '', id, name: id, status, wbs: '', wbsName: '', type: 'Task Dependent', critical: '',
  origDur: 10, remDur: 10, actDur: null, totalFloat: 0, freeFloat: 0, blStart: 1, blFinish: 10, start: 1, finish: 10, actStart: null, actFinish: null,
  schedPct: null, physPct, durPct: null, unitsPct: null, actPct: null, budgetCost: null, actualCost: null, budgetUnits: null, actualUnits: null, invalid: {},
});

describe('Actual % entered in the app', () => {
  const acts = [act('A1', 'Not Started', 0), act('A2', 'In Progress', 0.3), act('A3', 'Not Started', 0)];
  const entries = { a1: { pct: 0.4, dataDate: 100, at: '' }, a2: { pct: 1, dataDate: 100, at: '' }, a3: { pct: 0.5, dataDate: 90, at: '' } };
  it('replaces the chosen actual field and sets the status, for the same data date only', () => {
    const r = applyProgress(acts, entries, 100, 'Physical % Complete');
    expect(r.applied).toBe(2);
    expect(r.activities[0]).toMatchObject({ physPct: 0.4, status: 'In Progress' });
    expect(r.activities[1]).toMatchObject({ physPct: 1, status: 'Completed' });
    expect(r.activities[2]).toMatchObject({ physPct: 0, status: 'Not Started' }); // entry from an older data date
  });
  it('writes into the field selected in Settings', () => {
    const r = applyProgress(acts, entries, 100, 'Duration % Complete');
    expect(r.activities[0].durPct).toBe(0.4);
    expect(r.activities[0].physPct).toBe(0);
  });
  it('does nothing without entries', () => expect(applyProgress(acts, undefined, 100, 'Physical % Complete').activities).toBe(acts));
});

describe('Actual dates for entries', () => {
  // planned start 1 (before the data date 100), no actual dates in the file
  const a = act('A1', 'Not Started', 0);
  it('estimates AS = planned start (when before the data date) and AF = day before the data date', () => {
    const r = applyProgress([a], { a1: { pct: 1, dataDate: 100, at: '' } }, 100, 'Physical % Complete').activities[0];
    expect(r).toMatchObject({ actStart: 1, actFinish: 99, status: 'Completed', estimated: ['as', 'af'] });
  });
  it('a planned start on/after the data date gives AS = day before the data date', () => {
    const d = progressDates({ ...a, start: 120 }, { pct: 0.4 }, 100);
    expect(d).toMatchObject({ as: 99, af: null, asEstimated: true, needAs: true, needAf: false });
  });
  it('typed dates win and are not marked estimated', () => {
    const r = applyProgress([a], { a1: { pct: 1, dataDate: 100, at: '', as: 40, af: 80 } }, 100, 'Physical % Complete').activities[0];
    expect(r.actStart).toBe(40); expect(r.actFinish).toBe(80); expect(r.estimated).toBeUndefined();
  });
  it('dates in the P6 file are never replaced', () => {
    const r = applyProgress([{ ...a, actStart: 30, actFinish: 70 }], { a1: { pct: 1, dataDate: 100, at: '', as: 40, af: 80 } }, 100, 'Physical % Complete').activities[0];
    expect(r.actStart).toBe(30); expect(r.actFinish).toBe(70);
  });
  it('the estimated start is never after the finish', () => {
    const d = progressDates({ ...a, start: 120 }, { pct: 1, af: 50 }, 100);
    expect(d.as).toBe(50);
  });
  it('0% needs no dates', () => expect(progressDates(a, { pct: 0 }, 100)).toMatchObject({ as: null, af: null, needAs: false, needAf: false }));
});
