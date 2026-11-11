import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, newId, type Project } from '../src/store/db';
import { saveSnapshot, listSnapshots, deleteLatestSnapshot, buildSnapshot, SnapshotError } from '../src/store/snapshots';
import { exportProject, importProject, parseBackup, BackupError, backupConflict, removeProjectData } from '../src/store/backup';
import { emptyBaselines, saveOriginal, addRevision, resolveRevision, itemsFromActivities, toMap, compareBaselines, BaselineError } from '../src/core/baselines';
import { calcActivities } from '../src/core/engine';
import { summarize, NO_FILTER } from '../src/core/project';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { emptyClassification } from '../src/core/classify';
import { DEFAULT_IMPORT_OPTIONS } from '../src/core/importer';
import { fromYMD, fmtDateLong } from '../src/core/dates';
import { importWorkbookSample, refSettings, refClassification, refOriginal, refRevised, refSnapshots, REF, ser } from './helpers';
import { SAMPLE_ORIGINAL, SAMPLE_REV1 } from '../src/sample/sampleBaselines';

const rowsOf = () => calcActivities({ activities: importWorkbookSample().activities, settings: refSettings(), classification: refClassification(), original: refOriginal(), revised: refRevised() });
const mkProject = (): Project => ({
  id: newId(), name: 'T', isSample: false, createdAt: '', updatedAt: '', settings: { ...DEFAULT_SETTINGS }, importOptions: DEFAULT_IMPORT_OPTIONS,
  mapping: {}, classification: emptyClassification(), approval: null, baselines: emptyBaselines(),
});
beforeEach(async () => { await db.delete(); await db.open(); });

describe('Baseline register', () => {
  const acts = importWorkbookSample().activities;
  const { items } = itemsFromActivities(acts);
  const set = { savedAt: 'x', reference: 'orig', items };
  it('original is saved once and can never be replaced', () => {
    const b = saveOriginal(emptyBaselines(), set);
    expect(() => saveOriginal(b, set)).toThrow(BaselineError);
  });
  it('activities without both baseline dates are skipped and listed, not saved as zero', () => {
    const a2 = [...acts.slice(0, 3), { ...acts[3], blFinish: null }];
    const r = itemsFromActivities(a2);
    expect(r.items.length).toBe(3);
    expect(r.skipped[0]).toContain('baseline start or finish missing');
  });
  it('unlimited revisions, unique numbers, never overwritten; blank = latest', () => {
    let b = saveOriginal(emptyBaselines(), set);
    for (const n of ['Rev-1', 'Rev-2', 'Rev-3']) b = addRevision(b, { ...set, rev: n, approvedOn: 46249, description: n });
    expect(b.revisions.length).toBe(3);
    expect(() => addRevision(b, { ...set, rev: 'rev-2', approvedOn: 1, description: '' })).toThrow(/already exists/);
    expect(resolveRevision(b, '')!.rev).toBe('Rev-3');
    expect(resolveRevision(b, 'Rev-1')!.rev).toBe('Rev-1');
    expect(resolveRevision(b, 'Rev-9')).toBeNull();
  });
  it('sample baselines equal the workbook values; Original vs Revised vs Current comparison finds the re-sequenced activities', () => {
    const o = toMap(SAMPLE_ORIGINAL.map((r) => ({ id: r[0], start: r[1]!, finish: r[2]! })));
    const r1 = toMap(SAMPLE_REV1.map((r) => ({ id: r[0], start: r[1]!, finish: r[2]! })));
    expect(o.size).toBe(84); expect(r1.size).toBe(84);
    const d = compareBaselines(acts, o, r1);
    expect(d.length).toBeGreaterThan(0);
    expect(d.every((x) => x.revVsOrig !== 0 || x.curVsOrig !== 0 || x.curVsRev !== 0)).toBe(true);
    const direct = REF.revisedBaselines.filter((r: any) => r[0] === 'Rev-1' && ser(r[4]) !== ser(REF.originalBaseline.find((q: any) => q[0] === r[2])?.[2])).length; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(d.filter((x) => x.revVsOrig).length).toBe(direct);
  });
  it('the saved baseline is used for planned % even when the import has different dates (re-baselined import)', () => {
    const changed = acts.map((a) => (a.id === 'SMP-1400' ? { ...a, blFinish: a.blFinish! + 30 } : a));
    const mk = (a: typeof acts) => calcActivities({ activities: a, settings: refSettings({ baselineUse: 'Original (saved)' }), classification: refClassification(), original: refOriginal(), revised: refRevised() });
    expect(summarize(mk(changed), refSettings()).planned).toBe(summarize(mk(acts), refSettings()).planned);
  });
});

describe('Snapshots', () => {
  it('save, list; the saved values never change when the data is recalculated later', async () => {
    const p = mkProject(); await db.projects.add(p);
    const snap = buildSnapshot(rowsOf(), refSettings(), 'Nov');
    await saveSnapshot(p.id, snap);
    const before = JSON.stringify((await listSnapshots(p.id))[0]);
    rowsOf(); // recalculation / new import
    await saveSnapshot(p.id, { ...snap, dataDate: snap.dataDate + 30, summary: { ...snap.summary, dataDate: snap.dataDate + 30 } });
    expect(JSON.stringify((await listSnapshots(p.id))[0])).toBe(before);
    expect((await listSnapshots(p.id)).length).toBe(2);
  });
  it('snapshot summary equals the workbook live row (planned, actual, counts)', () => {
    const s = buildSnapshot(rowsOf(), refSettings(), '');
    const live = REF.historyLive; // [date, weighting, planned, actual, var, activities, completed, inProgress, notStarted, delayed, critical, negFloat, spi]
    expect(s.summary.planned).toBeCloseTo(live[2], 12); expect(s.summary.actual).toBeCloseTo(live[3], 12);
    expect([s.summary.activities, s.summary.completed, s.summary.inProgress, s.summary.notStarted, s.summary.delayed, s.summary.critical, s.summary.negFloat]).toEqual(live.slice(5, 12));
    expect(s.summary.spi).toBeCloseTo(live[12], 12);
    expect(s.activities.length).toBe(82);
  });
  it('a second snapshot for the same data date is refused', async () => {
    const p = mkProject(); await db.projects.add(p);
    const snap = buildSnapshot(rowsOf(), refSettings(), '');
    await saveSnapshot(p.id, snap);
    await expect(saveSnapshot(p.id, snap)).rejects.toThrow(SnapshotError);
    expect((await listSnapshots(p.id)).length).toBe(1);
  });
  it('only the latest can be deleted, only after typing its date, and the deletion is logged with the data', async () => {
    const p = mkProject(); await db.projects.add(p);
    const a = buildSnapshot(rowsOf(), refSettings(), 'a');
    const b = { ...a, dataDate: a.dataDate + 31, summary: { ...a.summary, dataDate: a.dataDate + 31 } };
    await saveSnapshot(p.id, a); await saveSnapshot(p.id, b);
    await expect(deleteLatestSnapshot(p.id, fmtDateLong(a.dataDate))).rejects.toThrow(/Type the date/); // an older date is not accepted
    await expect(deleteLatestSnapshot(p.id, 'yes')).rejects.toThrow(SnapshotError);
    await deleteLatestSnapshot(p.id, fmtDateLong(b.dataDate));
    expect((await listSnapshots(p.id)).map((s) => s.dataDate)).toEqual([a.dataDate]);
    const log = await db.log.where('projectId').equals(p.id).toArray();
    const del = log.find((l) => l.action === 'Snapshot deleted')!;
    expect(del.at).toBeTruthy();
    expect((del.data as { dataDate: number; activities: unknown[] }).dataDate).toBe(b.dataDate);
    expect((del.data as { activities: unknown[] }).activities.length).toBe(82);
  });
  it('the S-curve actual history of the workbook (5 months) loads as snapshots', () => expect(refSnapshots().length).toBe(5));
});

describe('Backup file', () => {
  it('export then import restores project, import, baselines, snapshots and log into a NEW project', async () => {
    const p = mkProject(); p.baselines = saveOriginal(emptyBaselines(), { savedAt: 'x', reference: 'o', items: itemsFromActivities(importWorkbookSample().activities).items });
    await db.projects.add(p);
    await db.imports.add({ id: p.id, projectId: p.id, fileName: 'f.xlsx', importedAt: '', date1904: false, sheetIndex: 0, sheets: [{ name: 'A', rows: [['x', 1]] }] });
    await saveSnapshot(p.id, buildSnapshot(rowsOf(), refSettings(), 'n'));
    const file = await exportProject(p.id);
    const text = JSON.stringify(file);
    const newId2 = await importProject(parseBackup(text));
    expect(newId2).not.toBe(p.id);
    const q = (await db.projects.get(newId2))!;
    expect(q.baselines.original!.items.length).toBe(84);
    expect((await listSnapshots(newId2)).length).toBe(1);
    expect((await db.imports.get(newId2))!.sheets[0].rows[0]).toEqual(['x', 1]);
    expect((await db.projects.get(p.id))!.name).toBe('T'); // original untouched
  });
  it('a damaged or foreign file is refused with a clear message', async () => {
    const p = mkProject(); await db.projects.add(p);
    const text = JSON.stringify(await exportProject(p.id));
    expect(() => parseBackup(text.replace('"name":"T"', '"name":"Tampered"'))).toThrow(/checksum/);
    expect(() => parseBackup('not json')).toThrow(BackupError);
    expect(() => parseBackup('{"format":"other"}')).toThrow(/not a Masar Schedule/);
  });
  it('on another computer the project keeps its id and name; here you choose replace or copy', async () => {
    const p = mkProject(); await db.projects.add(p);
    await saveSnapshot(p.id, buildSnapshot(rowsOf(), refSettings(), 'n'));
    const f = parseBackup(JSON.stringify(await exportProject(p.id)));
    expect((await backupConflict(f))!.id).toBe(p.id);
    // "another computer": the project is not there
    await removeProjectData(p.id);
    expect(await listSnapshots(p.id)).toHaveLength(0);
    expect(await backupConflict(f)).toBeNull();
    expect(await importProject(f)).toBe(p.id);
    expect((await db.projects.get(p.id))!.name).toBe('T');
    // already here: replace keeps one project, copy adds a second one
    await db.projects.update(p.id, { name: 'Changed here' });
    expect(await importProject(f, 'replace')).toBe(p.id);
    expect((await db.projects.get(p.id))!.name).toBe('T');
    expect(await listSnapshots(p.id)).toHaveLength(1);
    const c = await importProject(f, 'copy');
    expect(c).not.toBe(p.id);
    expect((await db.projects.get(c))!.name).toBe('T (copy)');
  });
  it('dates round trip', () => expect(fromYMD(2026, 11, 8)).toBe(46334));
});

describe('Settings used by the monthly cycle', () => {
  it('NO_FILTER exists', () => expect(Object.keys(NO_FILTER).length).toBe(5));
});
