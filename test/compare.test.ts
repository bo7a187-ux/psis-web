import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compareSchedules, compareSheets, type CompareSide } from '../src/core/compare';
import { readCompareSide } from '../src/core/compareFile';
import { DEFAULT_IMPORT_OPTIONS } from '../src/core/importer';
import { writeXlsx } from '../src/core/xlsxWrite';
import { readXlsx } from '../src/core/xlsx';
import type { Activity } from '../src/core/types';
import { FIX } from './helpers';

const act = (id: string, o: Partial<Activity> = {}): Activity => ({
  row: 1, projectId: '', projectName: '', id, name: id, status: 'Not Started', wbs: 'W', wbsName: 'W', type: 'Task Dependent', critical: 'No',
  origDur: 10, remDur: 10, actDur: null, totalFloat: 5, freeFloat: 0, blStart: 100, blFinish: 109, start: 100, finish: 109, actStart: null, actFinish: null,
  schedPct: null, physPct: 0, durPct: null, unitsPct: null, actPct: null, budgetCost: null, actualCost: null, budgetUnits: null, actualUnits: null, invalid: {}, ...o,
});
const side = (label: string, dataDate: number | null, activities: Activity[], relations: CompareSide['relations'] = null): CompareSide => ({ label, dataDate, activities, relations, constraints: null });

describe('Compare two updates', () => {
  const oldS = side('old.xer', 100, [
    act('A1', { status: 'Completed', actStart: 90, actFinish: 99, physPct: 1, finish: 99 }),
    act('A2', { status: 'In Progress', actStart: 95, physPct: 0.5 }),
    act('A3'), act('A4'), act('S1', { type: 'WBS Summary' }),
  ], [{ pred: 'A1', succ: 'A2', type: 'FS', lag: 0 }, { pred: 'A2', succ: 'A3', type: 'FS', lag: 0 }]);
  const newS = side('new.xer', 130, [
    act('A1', { status: 'In Progress', actStart: 92, actFinish: null, physPct: 0.9, finish: 135 }), // reopened, AS changed, progress down
    act('a2', { status: 'In Progress', actStart: 95, physPct: 0.8, remDur: 4, finish: 115, totalFloat: 1 }), // same id in other case
    act('A3', { origDur: 6, remDur: 6 }), act('A5'),
  ], [{ pred: 'A1', succ: 'A2', type: 'FS', lag: 2 }, { pred: 'A3', succ: 'A5', type: 'SS', lag: 0 }]);

  it('the file with the earlier data date is the older one, whatever the order', () => {
    const r = compareSchedules(newS, oldS);
    expect(r.older.label).toBe('old.xer');
    expect(r.newer.label).toBe('new.xer');
  });
  const r = compareSchedules(oldS, newS);
  it('added and deleted activities (summaries ignored, IDs not case sensitive)', () => {
    expect(r.added.map((a) => a.id)).toEqual(['A5']);
    expect(r.deleted.map((a) => a.id)).toEqual(['A4']);
    expect(r.older.count).toBe(4);
  });
  it('changes per field with the difference', () => {
    const a2 = r.changed.find((d) => d.id === 'a2')!;
    expect(a2.changes.find((c) => c.kind === 'finish')).toEqual({ kind: 'finish', from: 109, to: 115, delta: 6 });
    expect(a2.changes.find((c) => c.kind === 'progress')!.delta).toBeCloseTo(0.3, 9);
    expect(a2.changes.find((c) => c.kind === 'float')!.delta).toBe(-4);
    expect(r.changed.find((d) => d.id === 'A3')!.changes.map((c) => c.kind)).toEqual(['origDur', 'remDur']);
    expect(r.counts.origDur).toBe(1);
  });
  it('red flags: actual date changed, progress down, completed reopened', () => {
    expect(r.flags.actualChanged.map((d) => d.id)).toEqual(['A1']);
    expect(r.flags.progressDown.map((d) => d.id)).toEqual(['A1']);
    expect(r.flags.reopened.map((d) => d.id)).toEqual(['A1']);
    expect(r.changed[0].id).toBe('A1'); // biggest finish slip first
  });
  it('relationships added, deleted and lag changed', () => {
    expect(r.relations!.added).toEqual([{ pred: 'A3', succ: 'A5', type: 'SS', lag: 0 }]);
    expect(r.relations!.deleted).toEqual([{ pred: 'A2', succ: 'A3', type: 'FS', lag: 0 }]);
    expect(r.relations!.lagChanged).toEqual([{ pred: 'A1', succ: 'A2', type: 'FS', lag: 2, fromLag: 0 }]);
    expect(compareSchedules(side('x', 1, []), side('y', 2, [])).relations).toBeNull();
  });
  it('project finish and lowest float of open activities', () => {
    expect(r.older.finish).toBe(109);
    expect(r.newer.finish).toBe(135);
    expect(r.newer.float).toBe(1);
  });
  it('Excel export has summary, changes, added, deleted and relationships sheets', () => {
    const wb = readXlsx(writeXlsx(compareSheets(r)));
    expect(wb.sheets.map((s) => s.name)).toEqual(['Summary', 'Changes', 'Added', 'Deleted', 'Relationships']);
    expect(wb.sheets[1].rows.length - 1).toBe(r.changed.reduce((n, d) => n + d.changes.length, 0));
  });
});

describe('Compare: reading the other file', () => {
  const opts = { ...DEFAULT_IMPORT_OPTIONS, durationUnit: 'Hours' as const };
  const text = readFileSync(join(FIX, 'sample.xer'), 'utf8');
  /** set one TASK field of the activity with this code */
  const setTask = (xer: string, code: string, field: string, value: string) => {
    const lines = xer.split('\r\n');
    let fields: string[] = [], inTask = false;
    return lines.map((l) => {
      if (l.startsWith('%T\t')) inTask = l === '%T\tTASK';
      if (inTask && l.startsWith('%F\t')) fields = l.split('\t').slice(1);
      if (inTask && l.startsWith('%R\t')) {
        const v = l.split('\t').slice(1);
        if (v[fields.indexOf('task_code')] === code && v[fields.indexOf('proj_id')] === '4521') { v[fields.indexOf(field)] = value; return ['%R', ...v].join('\t'); }
      }
      return l;
    }).join('\r\n');
  };
  it('reads an XER with the project mapping, including data date and relationships', () => {
    const a = readCompareSide('a.xer', new TextEncoder().encode(text), {}, opts);
    expect(a.activities.filter((x) => !/summary/i.test(x.type)).length).toBeGreaterThan(3);
    expect(a.relations?.length).toBeGreaterThan(0);
    expect(a.dataDate).not.toBeNull();
    expect(compareSchedules(a, a).changed).toEqual([]);
  });
  it('finds a changed duration and finish between two XER files', () => {
    let b = setTask(text, 'A1020', 'target_drtn_hr_cnt', '160');
    b = setTask(b, 'A1020', 'reend_date', '2026-03-17 17:00'); // P6 remaining finish
    const r = compareSchedules(readCompareSide('a.xer', new TextEncoder().encode(text), {}, opts), readCompareSide('b.xer', new TextEncoder().encode(b), {}, opts));
    const d = r.changed.find((x) => x.id === 'A1020')!;
    expect(d.changes.find((c) => c.kind === 'origDur')).toMatchObject({ from: 15, to: 20, delta: 5 });
    expect(d.changes.find((c) => c.kind === 'finish')!.delta).toBe(6);
  });
  it('a file without Activity IDs is refused with a clear message', () => {
    expect(() => readCompareSide('x.xer', new TextEncoder().encode('ERMHDR\t19\n%T\tX\n%F\ta\n%R\t1\n%E\n'), {}, opts)).toThrow();
  });
});
