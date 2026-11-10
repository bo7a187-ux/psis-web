/**
 * Browser storage (IndexedDB). Nothing is sent anywhere.
 * One record per project + its current import, baselines, snapshots and an append-only log.
 */
import Dexie, { type Table } from 'dexie';
import type { Settings } from '../core/settings';
import type { ImportOptions, SavedMapping } from '../core/importer';
import type { ClassificationConfig } from '../core/classify';
import type { Grid } from '../core/xlsx';
import type { Baselines } from '../core/baselines';
import type { Snapshot } from '../core/snapshot';

export interface Approval {
  fingerprint: string;
  reviewer: string;
  approvedAt: string; // ISO timestamp
  note: string;
}

export interface Project {
  id: string;
  name: string;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
  settings: Settings;
  importOptions: ImportOptions;
  mapping: SavedMapping;
  classification: ClassificationConfig;
  approval: Approval | null;
  baselines: Baselines;
  /** free text shown in the Comments box of the monthly report (display only) */
  reportComment?: string;
  /** actual % entered in the app, by Activity ID (lower case) */
  progress?: import('../core/progress').ProgressEntries;
}

export interface StoredImport {
  id: string; // = projectId (one current import per project)
  projectId: string;
  fileName: string;
  importedAt: string;
  date1904: boolean;
  sheetIndex: number;
  sheets: { name: string; rows: Grid }[];
  /** file format and facts noted while reading (optional: older records have none) */
  format?: 'xlsx' | 'xls' | 'xer' | 'csv';
  info?: string[];
}

export interface SnapshotRecord extends Snapshot { id: string; projectId: string }

export interface LogEntry {
  seq?: number;
  projectId: string;
  at: string;
  action: string;
  details: string;
  data?: unknown;
}

class PsisDB extends Dexie {
  projects!: Table<Project, string>;
  imports!: Table<StoredImport, string>;
  log!: Table<LogEntry, number>;
  snapshots!: Table<SnapshotRecord, string>;
  constructor() {
    super('psis');
    this.version(1).stores({
      projects: 'id, name, updatedAt',
      imports: 'id, projectId',
      log: '++seq, projectId, at',
    });
    this.version(2).stores({
      projects: 'id, name, updatedAt',
      imports: 'id, projectId',
      log: '++seq, projectId, at',
      snapshots: 'id, projectId, dataDate',
    });
  }
}

export const db = new PsisDB();

export function newId(): string {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

export async function addLog(projectId: string, action: string, details: string, data?: unknown) {
  await db.log.add({ projectId, at: new Date().toISOString(), action, details, data });
}

/** Ask the browser not to clear our data automatically when disk space is low. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
