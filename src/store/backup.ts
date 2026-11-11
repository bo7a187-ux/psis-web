/** Project file (JSON) backup: everything needed to restore a project and its history on another computer. */
import { db, newId, addLog, type Project, type StoredImport, type SnapshotRecord, type LogEntry } from './db';
import { sha256 } from '../core/sha256';
import { emptyBaselines } from '../core/baselines';

export const BACKUP_FORMAT = 'psis-project';
export const BACKUP_VERSION = 1;
export class BackupError extends Error {}

interface Payload { project: Project; import: StoredImport | null; snapshots: SnapshotRecord[]; log: LogEntry[] }
export interface BackupFile { format: typeof BACKUP_FORMAT; version: number; exportedAt: string; app: string; checksum: string; payload: Payload }

export async function exportProject(projectId: string): Promise<BackupFile> {
  const project = await db.projects.get(projectId);
  if (!project) throw new BackupError('Project not found.');
  const payload: Payload = {
    project, import: (await db.imports.get(projectId)) ?? null,
    snapshots: await db.snapshots.where('projectId').equals(projectId).toArray(),
    log: await db.log.where('projectId').equals(projectId).toArray(),
  };
  await addLog(projectId, 'Backup exported', `${payload.snapshots.length} snapshot(s)`);
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), app: 'Masar Schedule', checksum: sha256(JSON.stringify(payload)), payload };
}

export function parseBackup(text: string): BackupFile {
  let f: BackupFile;
  try { f = JSON.parse(text); } catch { throw new BackupError('This is not a valid project file (it could not be read as JSON).'); }
  if (f?.format !== BACKUP_FORMAT) throw new BackupError('This file is not a Masar Schedule project file.');
  if (typeof f.version !== 'number' || f.version > BACKUP_VERSION) throw new BackupError('This project file was made by a newer version of the app. Open it with the latest version.');
  if (!f.payload?.project) throw new BackupError('The project file is incomplete.');
  if (sha256(JSON.stringify(f.payload)) !== f.checksum) throw new BackupError('The project file was changed or damaged after it was saved (checksum does not match). It was not imported.');
  return f;
}

/** The project of this file that already exists in this browser (same project id), if any. */
export async function backupConflict(f: BackupFile): Promise<Project | null> {
  return (await db.projects.get(f.payload.project.id)) ?? null;
}

/** Removes a project with everything stored for it (import, snapshots, log). */
export async function removeProjectData(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.imports, db.snapshots, db.log, async () => {
    await db.projects.delete(id);
    await db.imports.delete(id);
    await db.snapshots.where('projectId').equals(id).delete();
    await db.log.where('projectId').equals(id).delete();
  });
}

/**
 * Restores a project file. A project that is not in this browser keeps its id and name (moving to a
 * new computer). If it is already here: 'replace' overwrites it, 'copy' adds a second project.
 * Returns the project id.
 */
export async function importProject(f: BackupFile, mode: 'replace' | 'copy' = 'copy'): Promise<string> {
  const p = f.payload;
  const exists = await backupConflict(f);
  const copy = exists != null && mode === 'copy';
  const id = copy ? newId() : p.project.id;
  const project: Project = { ...p.project, id, name: copy ? `${p.project.name} (copy)` : p.project.name, baselines: p.project.baselines ?? emptyBaselines(), updatedAt: new Date().toISOString() };
  // one transaction: a failed restore leaves the existing project untouched
  await db.transaction('rw', db.projects, db.imports, db.snapshots, db.log, async () => {
    if (exists && !copy) await removeProjectData(id);
    await db.projects.add(project);
    if (p.import) await db.imports.add({ ...p.import, id, projectId: id });
    for (const s of p.snapshots) await db.snapshots.add({ ...s, id: `${id}|${s.dataDate}`, projectId: id });
    for (const l of p.log) await db.log.add({ projectId: id, at: l.at, action: l.action, details: l.details, data: l.data });
    await addLog(id, 'Project restored from file', `exported ${f.exportedAt}, ${p.snapshots.length} snapshot(s)`);
  });
  return id;
}
