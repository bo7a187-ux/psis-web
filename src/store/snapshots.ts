/**
 * Monthly snapshots. Once saved they are never changed: there is no update function.
 * A duplicate data date is refused. Only the LATEST snapshot can be deleted, after the
 * user types its date, and the deleted data is copied into the append-only log first.
 */
import { db, addLog, type SnapshotRecord } from './db';
import type { Snapshot, SnapshotActivity } from '../core/snapshot';
import type { CalcRow } from '../core/engine';
import type { Settings } from '../core/settings';
import { summarize, NO_FILTER } from '../core/project';
import { fmtDate, fmtDateLong } from '../core/dates';

export class SnapshotError extends Error {}
const key = (projectId: string, d: number) => `${projectId}|${d}`;

export function buildSnapshot(rows: CalcRow[], s: Settings, note: string): Snapshot {
  const sum = summarize(rows, s, NO_FILTER);
  const activities: SnapshotActivity[] = rows.filter((r) => r.included && r.a.id).map((r) => ({
    id: r.a.id, project: r.a.projectId, phase: r.cls.phase, discipline: r.cls.discipline, building: r.cls.building, floor: r.cls.floor,
    weight: r.weight, planned: r.planned, actual: r.actual, actualEarned: r.actualEarned, blFinish: r.blFinish, fcFinish: r.fcSel, tf: r.tfDays,
  }));
  return {
    dataDate: s.dataDate!, savedAt: new Date().toISOString(), activities,
    summary: {
      dataDate: s.dataDate!, weighting: s.weightMethod, planned: sum.planned, actual: sum.actual, variance: sum.variance,
      activities: sum.total, completed: sum.completed, inProgress: sum.inProgress, notStarted: sum.notStarted,
      delayed: sum.delayed, critical: sum.critical, negFloat: sum.negFloat, spi: sum.spi, projectFloat: sum.projectFloat, note,
    },
  };
}

export async function listSnapshots(projectId: string): Promise<SnapshotRecord[]> {
  const all = await db.snapshots.where('projectId').equals(projectId).toArray();
  return all.sort((a, b) => a.dataDate - b.dataDate);
}

export async function saveSnapshot(projectId: string, snap: Snapshot): Promise<void> {
  const id = key(projectId, snap.dataDate);
  await db.transaction('rw', db.snapshots, db.log, async () => {
    if (await db.snapshots.get(id)) throw new SnapshotError(`A snapshot for ${fmtDate(snap.dataDate)} is already saved. Saved snapshots are never changed or overwritten.`);
    await db.snapshots.add({ ...snap, id, projectId });
    await addLog(projectId, 'Snapshot saved', `${fmtDate(snap.dataDate)} - ${snap.activities.length} activities`);
  });
}

export async function deleteLatestSnapshot(projectId: string, typedDate: string): Promise<void> {
  await db.transaction('rw', db.snapshots, db.log, async () => {
    const all = await listSnapshots(projectId);
    const last = all[all.length - 1];
    if (!last) throw new SnapshotError('There is no snapshot to delete.');
    const want = fmtDateLong(last.dataDate);
    if (typedDate.trim().toLowerCase() !== want.toLowerCase() && typedDate.trim().toLowerCase() !== fmtDate(last.dataDate).toLowerCase())
      throw new SnapshotError(`Type the date of the latest snapshot (${want}) to confirm.`);
    await addLog(projectId, 'Snapshot deleted', `${want} (latest snapshot) - full copy kept in this log`, last);
    await db.snapshots.delete(last.id);
  });
}
