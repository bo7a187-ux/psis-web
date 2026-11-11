import { describe, it, expect } from 'vitest';
import { calcActivities } from '../src/core/engine';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { emptyClassification } from '../src/core/classify';
import { NO_FILTER } from '../src/core/project';
import { earnedSchedule } from '../src/core/earnedSchedule';
import { floatErosion } from '../src/core/floatErosion';
import type { Activity } from '../src/core/types';
import type { Snapshot } from '../src/core/snapshot';

const act = (id: string, bls: number, blf: number, phys: number, tf: number | null, status = 'In Progress'): Activity => ({
  row: 1, projectId: '', projectName: '', id, name: id, status, wbs: '', wbsName: '', type: 'Task Dependent', critical: '',
  origDur: blf - bls + 1, remDur: null, actDur: null, totalFloat: tf, freeFloat: null, blStart: bls, blFinish: blf, start: bls, finish: blf,
  actStart: phys > 0 ? bls : null, actFinish: null, schedPct: null, physPct: phys, durPct: null, unitsPct: null, actPct: null,
  budgetCost: null, actualCost: null, budgetUnits: null, actualUnits: null, invalid: {},
});
const run = (acts: Activity[], dd: number) => calcActivities({ activities: acts, settings: { ...DEFAULT_SETTINGS, dataDate: dd, baselineUse: 'Current import' }, classification: emptyClassification() });

describe('Earned Schedule', () => {
  it('SPI(t), SV(t) and the time-based forecast (hand calculation)', () => {
    const es = earnedSchedule(run([act('A', 100, 109, 0.4, 0)], 106), NO_FILTER, 0.4, 106)!;
    expect(es.es).toBeCloseTo(104, 9);
    expect(es.spiT).toBeCloseTo(4 / 6, 9);
    expect(es.svT).toBeCloseTo(-2, 9);
    expect(es.forecast).toBe(115);
  });
  it('ahead of plan gives SPI(t) above 1; complete gives the planned finish', () => {
    expect(earnedSchedule(run([act('A', 100, 109, 0.8, 0)], 106), NO_FILTER, 0.8, 106)!.spiT).toBeCloseTo(8 / 6, 9);
    expect(earnedSchedule(run([act('A', 100, 109, 1, 0)], 106), NO_FILTER, 1, 106)!.es).toBe(110);
  });
  it('not available before the start or without progress data', () => {
    expect(earnedSchedule(run([act('A', 100, 109, 0, 0)], 99), NO_FILTER, 0, 99)).toBeNull();
    expect(earnedSchedule(run([act('A', 100, 109, 0, 0)], 106), NO_FILTER, null, 106)).toBeNull();
  });
});

describe('Float erosion', () => {
  const snap = (tf: Record<string, number | undefined>, pf?: number): Snapshot => ({
    dataDate: 90, savedAt: '', activities: Object.entries(tf).map(([id, t]) => ({ id, project: '', phase: '', discipline: '', building: '', floor: '', weight: 1, planned: 0, actual: 0, actualEarned: 0, blFinish: null, fcFinish: null, ...(t === undefined ? {} : { tf: t }) })),
    summary: { dataDate: 90, weighting: '', planned: 0, actual: 0, variance: 0, activities: 0, completed: 0, inProgress: 0, notStarted: 0, delayed: 0, critical: 0, negFloat: 0, spi: null, projectFloat: pf, note: '' },
  });
  it('lists open activities whose float went down, worst first', () => {
    const rows = run([act('A', 100, 109, 0.4, 2), act('B', 100, 109, 0.4, 10), act('C', 100, 109, 0.4, 5)], 106);
    const e = floatErosion(rows, snap({ A: 12, B: 10, C: 6 }, 6))!;
    expect(e.eroded.map((x) => [x.id, x.change])).toEqual([['A', -10], ['C', -1]]);
    expect(e.projectFloatPrev).toBe(6);
    expect(e.projectFloatNow).toBe(2);
    expect(e.compared).toBe(3);
  });
  it('not available when the previous snapshot has no float recorded', () => {
    expect(floatErosion(run([act('A', 100, 109, 0.4, 2)], 106), snap({ A: undefined }))).toBeNull();
    expect(floatErosion([], null)).toBeNull();
  });
});
