import { describe, it, expect } from 'vitest';
import { lookAhead, lookAheadSheet } from '../src/core/lookahead';
import { calcActivities } from '../src/core/engine';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { emptyClassification } from '../src/core/classify';
import { fmtDate } from '../src/core/dates';
import type { Activity } from '../src/core/types';

const act = (id: string, o: Partial<Activity>): Activity => ({
  row: 1, projectId: '', projectName: '', id, name: id, status: 'Not Started', wbs: 'W', wbsName: 'W', type: 'Task Dependent', critical: 'No',
  origDur: 5, remDur: 5, actDur: null, totalFloat: 3, freeFloat: 0, blStart: 1, blFinish: 5, start: null, finish: null, actStart: null, actFinish: null,
  schedPct: null, physPct: 0, durPct: null, unitsPct: null, actPct: null, budgetCost: null, actualCost: null, budgetUnits: null, actualUnits: null, invalid: {}, ...o,
});
const DD = 100;
const rows = calcActivities({
  activities: [
    act('RUN', { status: 'In Progress', actStart: 80, start: 80, finish: 110, physPct: 0.4 }), // started before, finishes in week 2
    act('NEW', { start: 107, finish: 118 }), // starts week 2, ends week 3
    act('LATE', { start: 125, finish: 140 }), // after a 3-week period (100-120)
    act('DONE', { status: 'Completed', actStart: 90, actFinish: 99, start: 90, finish: 99, physPct: 1 }),
    act('CRIT', { start: 100, finish: 101, critical: 'Yes', totalFloat: -2 }),
    act('SUM', { type: 'WBS Summary', start: 100, finish: 200 }),
  ],
  settings: { ...DEFAULT_SETTINGS, dataDate: DD }, classification: emptyClassification(),
});

describe('Look-ahead', () => {
  const la = lookAhead(rows, DD, 3);
  it('open activities working in the period, sorted by start; completed, summaries and later work left out', () => {
    expect(la.from).toBe(100); expect(la.to).toBe(120);
    expect(la.items.map((x) => x.row.a.id)).toEqual(['RUN', 'CRIT', 'NEW']);
  });
  it('marks the weeks in which each activity is active', () => {
    const w = (id: string) => la.items.find((x) => x.row.a.id === id)!.weeks;
    expect(w('RUN')).toEqual([true, true, false]); // 100-110
    expect(w('NEW')).toEqual([false, true, true]); // 107-118
    expect(w('CRIT')).toEqual([true, false, false]);
  });
  it('starting / finishing / critical filters', () => {
    expect(lookAhead(rows, DD, 3, 'starting').items.map((x) => x.row.a.id)).toEqual(['CRIT', 'NEW']);
    expect(lookAhead(rows, DD, 3, 'finishing').items.map((x) => x.row.a.id)).toEqual(['RUN', 'CRIT', 'NEW']);
    expect(lookAhead(rows, DD, 3, 'critical').items.map((x) => x.row.a.id)).toEqual(['CRIT']);
    expect(lookAhead(rows, DD, 4).items.map((x) => x.row.a.id)).toContain('LATE');
  });
  it('Excel sheet has one column per week with a mark', () => {
    const [s] = lookAheadSheet(la, (x) => x, fmtDate);
    expect(s.header.slice(-3)).toEqual([`W1 ${fmtDate(100)}`, `W2 ${fmtDate(107)}`, `W3 ${fmtDate(114)}`]);
    expect(s.rows[0].slice(-3)).toEqual(['■', '■', '']);
  });
});
