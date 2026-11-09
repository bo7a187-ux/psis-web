import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { db, newId, addLog, requestPersistence, type Project, type StoredImport } from './store/db';
import { DEFAULT_SETTINGS } from './core/settings';
import { DEFAULT_IMPORT_OPTIONS, runImport, pickSheet, findDataDate, type ImportResult } from './core/importer';
import { emptyClassification } from './core/classify';
import { emptyBaselines, toMap, resolveRevision, itemsFromActivities, type Baselines } from './core/baselines';
import { listSnapshots, saveSnapshot, deleteLatestSnapshot, buildSnapshot } from './store/snapshots';
import { exportProject, importProject, parseBackup, type BackupFile } from './store/backup';
import { SAMPLE_ORIGINAL, SAMPLE_REV1, SAMPLE_REV1_INFO } from './sample/sampleBaselines';
import type { PrevSnapshotRow } from './core/engine';
import { calcActivities, type CalcRow } from './core/engine';
import { validate, type ValidationReport } from './core/validate';
import { fingerprint, approvalStatus, type ApprovalStatus } from './core/fingerprint';
import { summarize, NO_FILTER, type ProjectSummary, type Filters } from './core/project';
import type { Snapshot } from './core/snapshot';
import { readWorkbookFile } from './core/readFile';
import { SAMPLE_DATA_DATE, SAMPLE_FILE_NAME, SAMPLE_TITLE, sampleClassification, sampleFileBytes, sampleHistory } from './sample/sample';

export type Page =
  | 'home' | 'import' | 'mapping' | 'validation' | 'classification' | 'settings' | 'activities' | 'results'
  | 'exec' | 'control' | 'delay' | 'quality' | 'history' | 'baselines' | 'report' | 'audit';

interface Derived {
  imp: ImportResult | null;
  rows: CalcRow[] | null;
  calcError: string | null;
  report: ValidationReport | null;
  liveFingerprint: string | null;
  approval: ApprovalStatus;
  summary: ProjectSummary | null;
}

interface Ctx extends Derived {
  ready: boolean;
  projects: Project[];
  project: Project | null;
  stored: StoredImport | null;
  page: Page;
  setPage: (p: Page) => void;
  persisted: boolean;
  filters: Filters;
  setFilters: (f: Filters) => void;
  history: Snapshot[];
  selectProject: (id: string) => Promise<void>;
  createProject: (name: string) => Promise<void>;
  createSample: () => Promise<void>;
  renameProject: (name: string) => Promise<void>;
  deleteProject: () => Promise<void>;
  updateProject: (patch: Partial<Project>, logAction?: string) => Promise<void>;
  importFile: (file: File) => Promise<void>;
  setSheet: (index: number) => Promise<void>;
  approve: (reviewer: string, note: string) => Promise<void>;
  revokeApproval: () => Promise<void>;
  saveBaselines: (b: Baselines, log: string) => Promise<void>;
  saveCurrentSnapshot: (note: string) => Promise<void>;
  deleteLatest: (typed: string) => Promise<void>;
  makeBackup: () => Promise<BackupFile | null>;
  restoreBackup: (text: string) => Promise<void>;
  currentBaselineItems: () => ReturnType<typeof itemsFromActivities>;
  refreshHistory: () => Promise<void>;
}

const C = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(C);
  if (!c) throw new Error('no context');
  return c;
};

function blankProject(name: string): Project {
  const now = new Date().toISOString();
  return {
    id: newId(), name, isSample: false, createdAt: now, updatedAt: now,
    settings: { ...DEFAULT_SETTINGS }, importOptions: { ...DEFAULT_IMPORT_OPTIONS, pctScale: {} },
    mapping: {}, classification: emptyClassification(), approval: null, baselines: emptyBaselines(),
  };
}

const LAST = 'psis:lastProject';
const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [stored, setStored] = useState<StoredImport | null>(null);
  const [page, setPage] = useState<Page>('home');
  const [persisted, setPersisted] = useState(false);
  const [filters, setFilters] = useState<Filters>(NO_FILTER);
  const [history, setHistory] = useState<Snapshot[]>([]);

  const reloadList = useCallback(async () => {
    const list = await db.projects.orderBy('updatedAt').reverse().toArray();
    setProjects(list);
    return list;
  }, []);

  const selectProject = useCallback(async (id: string) => {
    const p0 = (await db.projects.get(id)) ?? null;
    const p = p0 ? { ...p0, baselines: p0.baselines ?? emptyBaselines() } : null;
    setHistory(p ? await listSnapshots(p.id) : []);
    setProject(p);
    setFilters(NO_FILTER);
    setStored(p ? (await db.imports.get(p.id)) ?? null : null);
    if (p) safeSet(LAST, p.id);
  }, []);

  useEffect(() => {
    (async () => {
      const list = await reloadList();
      const last = safeGet(LAST);
      const pick = list.find((p) => p.id === last) ?? list[0];
      if (pick) await selectProject(pick.id);
      setPersisted(await requestPersistence());
      setReady(true);
    })();
  }, [reloadList, selectProject]);

  const saveProject = useCallback(async (p: Project) => {
    p.updatedAt = new Date().toISOString();
    await db.projects.put(p);
    setProject({ ...p });
    await reloadList();
  }, [reloadList]);

  const updateProject = useCallback(async (patch: Partial<Project>, logAction?: string) => {
    if (!project) return;
    const next = { ...project, ...patch };
    await saveProject(next);
    if (logAction) await addLog(project.id, logAction, JSON.stringify(Object.keys(patch)));
  }, [project, saveProject]);

  const createProject = useCallback(async (name: string) => {
    const p = blankProject(name || 'New project');
    await saveProject(p);
    await addLog(p.id, 'Project created', p.name);
    setStored(null);
    safeSet(LAST, p.id);
    setPage('import');
  }, [saveProject]);

  const storeImport = useCallback(async (p: Project, fileName: string, bytes: Uint8Array) => {
    const wb = readWorkbookFile(fileName, bytes);
    if (!wb.sheets.length) throw new Error('The file contains no worksheets.');
    const rec: StoredImport = {
      id: p.id, projectId: p.id, fileName, importedAt: new Date().toISOString(), date1904: wb.date1904,
      sheetIndex: pickSheet(wb.sheets, p.mapping), sheets: wb.sheets, format: wb.format, info: wb.info,
    };
    await db.imports.put(rec);
    setStored(rec);
    await addLog(p.id, 'File imported', `${fileName} (sheet "${rec.sheets[rec.sheetIndex].name}")`);
    // The data date is set automatically only when the file states it; otherwise the Import page suggests one.
    if (p.settings.dataDate == null) {
      const dd = findDataDate(wb.sheets, wb.date1904);
      if (dd != null) {
        await saveProject({ ...p, settings: { ...p.settings, dataDate: dd } });
        await addLog(p.id, 'Data date set from file', String(dd));
      }
    }
  }, [saveProject]);

  const createSample = useCallback(async () => {
    const p = blankProject(SAMPLE_TITLE);
    p.isSample = true;
    p.settings = { ...p.settings, dataDate: SAMPLE_DATA_DATE, projectTitle: SAMPLE_TITLE };
    p.classification = sampleClassification();
    const mk = (rows: [string, number | null, number | null][]) => rows.filter((r) => r[1] != null && r[2] != null).map((r) => ({ id: r[0], start: r[1]!, finish: r[2]! }));
    const savedAt = new Date().toISOString();
    p.baselines = {
      original: { savedAt, reference: 'Original baseline (SAMPLE)', items: mk(SAMPLE_ORIGINAL) },
      revisions: [{ ...SAMPLE_REV1_INFO, savedAt, reference: 'Rev-1 (SAMPLE)', items: mk(SAMPLE_REV1) }],
    };
    p.settings = { ...p.settings, baselineUse: 'Original (saved)', revisionUse: 'Rev-1' };
    await saveProject(p);
    await addLog(p.id, 'Project created', 'Sample project (SAMPLE DATA)');
    for (const h of sampleHistory()) await saveSnapshot(p.id, h);
    setHistory(await listSnapshots(p.id));
    await storeImport(p, SAMPLE_FILE_NAME, sampleFileBytes());
    safeSet(LAST, p.id);
    setPage('import');
  }, [saveProject, storeImport]);

  const importFile = useCallback(async (file: File) => {
    if (!project) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await storeImport(project, file.name, bytes);
  }, [project, storeImport]);

  const setSheet = useCallback(async (index: number) => {
    if (!stored) return;
    const rec = { ...stored, sheetIndex: index };
    await db.imports.put(rec);
    setStored(rec);
  }, [stored]);

  const renameProject = useCallback(async (name: string) => {
    if (project && name.trim()) await updateProject({ name: name.trim() }, 'Project renamed');
  }, [project, updateProject]);

  const deleteProject = useCallback(async () => {
    if (!project) return;
    await db.transaction('rw', db.projects, db.imports, db.log, async () => {
      await db.projects.delete(project.id);
      await db.imports.delete(project.id);
      await db.log.where('projectId').equals(project.id).delete();
    });
    const list = await reloadList();
    setProject(null);
    setStored(null);
    if (list[0]) await selectProject(list[0].id);
    setPage('home');
  }, [project, reloadList, selectProject]);

  const derived = useMemo<Derived>(() => {
    if (!project || !stored) return { imp: null, rows: null, calcError: null, report: null, liveFingerprint: null, approval: 'BLOCKED', summary: null };
    const sheet = stored.sheets[stored.sheetIndex] ?? stored.sheets[0];
    const dd = project.settings.dataDate;
    const prevSnap = dd == null ? null : [...history].filter((h) => h.dataDate < dd && h.activities.length).sort((a, b) => b.dataDate - a.dataDate)[0] ?? null;
    const prev = prevSnap ? new Map<string, PrevSnapshotRow>(prevSnap.activities.map((a) => [a.id.toLowerCase(), { actual: a.actual, blFinish: a.blFinish }])) : undefined;
    const imp = runImport(sheet.rows, sheet.name, stored.date1904, project.mapping, project.importOptions);
    let rows: CalcRow[] | null = null;
    let calcError: string | null = null;
    if (project.settings.dataDate == null) calcError = 'Set the data date to run the calculations.';
    else {
      try {
        const b = project.baselines;
        const rev = resolveRevision(b, project.settings.revisionUse);
        rows = calcActivities({
          activities: imp.activities, settings: project.settings, classification: project.classification,
          original: b.original ? toMap(b.original.items) : undefined, revised: rev ? toMap(rev.items) : undefined, prev,
        });
      } catch (e) {
        calcError = (e as Error).message;
      }
    }
    const report = validate(imp, rows, project.settings, prevSnap ? { ids: prevSnap.activities.map((a) => a.id) } : undefined, project.classification.lists);
    const liveFingerprint = rows ? fingerprint(rows, project.settings) : null;
    const approval = approvalStatus(report.criticalCount, project.approval?.fingerprint, liveFingerprint);
    const summary = rows ? summarize(rows, project.settings) : null;
    return { imp, rows, calcError, report, liveFingerprint, approval, summary };
  }, [project, stored, history]);

  const approve = useCallback(async (reviewer: string, note: string) => {
    if (!project || !derived.liveFingerprint || derived.report?.criticalCount) return;
    const approval = { fingerprint: derived.liveFingerprint, reviewer, note, approvedAt: new Date().toISOString() };
    await saveProject({ ...project, approval });
    await addLog(project.id, 'Import approved', `${reviewer}: fingerprint ${derived.liveFingerprint.slice(0, 16)}…`, approval);
  }, [project, derived, saveProject]);

  const revokeApproval = useCallback(async () => {
    if (!project?.approval) return;
    await addLog(project.id, 'Approval withdrawn', project.approval.reviewer, project.approval);
    await saveProject({ ...project, approval: null });
  }, [project, saveProject]);

  const refreshHistory = useCallback(async () => { if (project) setHistory(await listSnapshots(project.id)); }, [project]);
  const saveBaselines = useCallback(async (b: Baselines, log: string) => {
    if (!project) return;
    await saveProject({ ...project, baselines: b });
    await addLog(project.id, 'Baseline register changed', log);
  }, [project, saveProject]);
  const saveCurrentSnapshot = useCallback(async (note: string) => {
    if (!project || !derived.rows) return;
    await saveSnapshot(project.id, buildSnapshot(derived.rows, project.settings, note));
    await refreshHistory();
  }, [project, derived, refreshHistory]);
  const deleteLatest = useCallback(async (typed: string) => {
    if (!project) return;
    await deleteLatestSnapshot(project.id, typed);
    await refreshHistory();
  }, [project, refreshHistory]);
  const makeBackup = useCallback(async (): Promise<BackupFile | null> => (project ? exportProject(project.id) : null), [project]);
  const restoreBackup = useCallback(async (text: string) => {
    const id = await importProject(parseBackup(text));
    await reloadList();
    await selectProject(id);
    setPage('home');
  }, [reloadList, selectProject]);
  const currentBaselineItems = useCallback(() => itemsFromActivities(derived.imp?.activities ?? []), [derived.imp]);

  const value: Ctx = {
    ready, projects, project, stored, page, setPage, persisted, filters, setFilters, history, ...derived,
    selectProject, createProject, createSample, renameProject, deleteProject, updateProject, importFile, setSheet, approve, revokeApproval,
    saveBaselines, saveCurrentSnapshot, deleteLatest, makeBackup, restoreBackup, currentBaselineItems, refreshHistory,
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
