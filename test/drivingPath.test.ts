import { describe, it, expect } from 'vitest';
import { drivingPath, relationGap } from '../src/core/drivingPath';
import { calcActivities } from '../src/core/engine';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { emptyClassification } from '../src/core/classify';
import type { Activity } from '../src/core/types';
import type { Relation } from '../src/core/logic';

const act = (id: string, start: number, finish: number, o: Partial<Activity> = {}): Activity => ({
  row: 1, projectId: '', projectName: '', id, name: id, status: 'Not Started', wbs: 'W', wbsName: 'W', type: 'Task Dependent', critical: 'No',
  origDur: finish - start + 1, remDur: finish - start + 1, actDur: null, totalFloat: 0, freeFloat: 0, blStart: start, blFinish: finish, start, finish,
  actStart: null, actFinish: null, schedPct: null, physPct: 0, durPct: null, unitsPct: null, actPct: null, budgetCost: null, actualCost: null,
  budgetUnits: null, actualUnits: null, invalid: {}, ...o,
});
const DD = 100;
const rows = calcActivities({
  activities: [
    act('RUN', 90, 104, { status: 'In Progress', actStart: 90, physPct: 0.5 }),
    act('A', 105, 109), // FS from RUN, starts next day
    act('B', 103, 106), // also before M, but finishes early: not driving
    act('C', 112, 115), // FS from A over a weekend (gap 2)
    act('D', 108, 118), // SS +3 from A (105 + 3 = 108)
    act('M', 119, 119, { type: 'Finish Milestone' }), // FS from C, D (drives: D, gap 0) and B (gap 12)
    act('X', 140, 150), act('CON', 130, 131), // CON -> X with a big gap: X is held by a constraint
  ],
  settings: { ...DEFAULT_SETTINGS, dataDate: DD }, classification: emptyClassification(),
});
const rel = (pred: string, succ: string, type = 'FS', lag = 0): Relation => ({ pred, succ, type, lag });
const rels = [rel('RUN', 'A'), rel('A', 'C'), rel('A', 'D', 'SS', 3), rel('C', 'M'), rel('D', 'M'), rel('B', 'M'), rel('CON', 'X')];

describe('Driving path', () => {
  it('relationship gaps by type', () => {
    const by = (id: string) => rows.find((r) => r.a.id === id)!;
    expect(relationGap('FS', 0, by('RUN'), by('A'))).toBe(0);
    expect(relationGap('FS', 0, by('A'), by('C'))).toBe(2);
    expect(relationGap('SS', 3, by('A'), by('D'))).toBe(0);
    expect(relationGap('FS', 0, by('B'), by('M'))).toBe(12);
  });
  it('walks back through the driving predecessors and stops at work already started', () => {
    const p = drivingPath(rows, rels, 'm', DD)!;
    expect(p.target).toBe('M');
    expect(p.rows.map((r) => r.a.id)).toEqual(['RUN', 'A', 'D', 'M']);
    expect(p.links.map((l) => `${l.pred}>${l.succ}`)).toEqual(['D>M', 'A>D', 'RUN>A']);
    expect(p.ends.get('RUN')).toBe('started');
  });
  it('a big gap means the activity is held by a constraint, not by logic', () => {
    const p = drivingPath(rows, rels, 'X', DD)!;
    expect(p.rows.map((r) => r.a.id)).toEqual(['X']);
    expect(p.ends.get('X')).toBe('constraint');
  });
  it('unknown activity', () => expect(drivingPath(rows, rels, 'nope', DD)).toBeNull());
});
