import { describe, it, expect } from 'vitest';
import { applyProgress } from '../src/core/progress';
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
