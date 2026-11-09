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
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), app: 'Project Schedule Intelligence', checksum: sha256(JSON.stringify(payload)), payload };
}

export function parseBackup(text: string): BackupFile {
  let f: BackupFile;
  try { f = JSON.parse(text); } catch { throw new BackupError('This is not a valid project file (it could not be read as JSON).'); }
  if (f?.format !== BACKUP_FORMAT) throw new BackupError('This file is not a Project Schedule Intelligence project file.');
  if (typeof f.version !== 'number' || f.version > BACKUP_VERSION) throw new BackupError('This project file was made by a newer version of the app. Open it with the latest version.');
  if (!f.payload?.project) throw new BackupError('The project file is incomplete.');
  if (sha256(JSON.stringify(f.payload)) !== f.checksum) throw new BackupError('The project file was changed or damaged after it was saved (checksum does not match). It was not imported.');
  return f;
}

/** Restores as a NEW project (never overwrites an existing one). Returns the new project id. */
export async function importProject(f: BackupFile): Promise<string> {
  const id = newId();
  const p = f.payload;
  const project: Project = { ...p.project, id, name: `${p.project.name} (restored)`, baselines: p.project.baselines ?? emptyBaselines(), updatedAt: new Date().toISOString() };
  await db.transaction('rw', db.projects, db.imports, db.snapshots, db.log, async () => {
    await db.projects.add(project);
    if (p.import) await db.imports.add({ ...p.import, id, projectId: id });
    for (const s of p.snapshots) await db.snapshots.add({ ...s, id: `${id}|${s.dataDate}`, projectId: id });
    for (const l of p.log) await db.log.add({ projectId: id, at: l.at, action: l.action, details: l.details, data: l.data });
    await addLog(id, 'Project restored from file', `exported ${f.exportedAt}, ${p.snapshots.length} snapshot(s)`);
  });
  return id;
}
