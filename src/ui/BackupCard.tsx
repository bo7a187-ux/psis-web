import { useRef, useState } from 'react';
import { useApp } from '../state';
import { downloadText, dateTime, ConfirmButton } from './common';
import { t } from '../i18n';
import { parseBackup, backupConflict, type BackupFile } from '../store/backup';
import type { Project } from '../store/db';

const KEY = 'psis:lastBackup';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

/** Save the project file and remember when; returns an error message or ''. */
export async function saveBackupFile(app: ReturnType<typeof useApp>): Promise<string> {
  try {
    const f = await app.makeBackup();
    if (!f) return '';
    const safe = (app.project?.name ?? 'project').replace(/[^\w\-]+/g, '_');
    downloadText(`${safe}_${f.exportedAt.slice(0, 10)}.psis.json`, JSON.stringify(f));
    try { localStorage.setItem(KEY, new Date().toISOString()); } catch { /* ignore */ }
    return '';
  } catch (e) { return (e as Error).message; }
}
export const lastBackup = read;

/** Slim banner: work worth keeping and no backup from this browser in the last 30 days. */
export function BackupReminder() {
  const app = useApp();
  const [hidden, setHidden] = useState(false);
  const [, force] = useState(0);
  const last = read();
  const old = !last || Date.now() - new Date(last).getTime() > 30 * 86400000;
  const worth = !!app.stored && (app.approval === 'APPROVED' || app.history.length > 0 || !!app.project?.approval);
  if (hidden || !old || !worth || app.project?.isSample) return null;
  return (
    <div className="notice warn row no-print" style={{ marginTop: 0 }}>
      <span className="grow">{last ? t('Your last backup from this browser is more than 30 days old.') : t('This project has no backup yet. If the browser data is cleared, the work is lost.')}</span>
      <button className="btn small primary" onClick={async () => { await saveBackupFile(app); force((x) => x + 1); }}>{t('Save backup now')}</button>
      <button className="btn small" onClick={() => setHidden(true)}>{t('Later')}</button>
    </div>
  );
}

export function BackupCard() {
  const app = useApp();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [last, setLast] = useState(read());
  const file = useRef<HTMLInputElement>(null);
  const doExport = async () => {
    const err = await saveBackupFile(app);
    setLast(read());
    setMsg(err ? { ok: false, t: err } : { ok: true, t: t('Project file saved to your Downloads folder. Keep it somewhere safe (cloud drive or USB).') });
  };
  const [pending, setPending] = useState<{ f: BackupFile; existing: Project } | null>(null);
  const restore = async (f: BackupFile, mode: 'replace' | 'copy', existed: boolean) => {
    setPending(null);
    try {
      await app.restoreBackup(f, mode);
      setMsg({ ok: true, t: !existed ? t('Project "{name}" restored.', { name: f.payload.project.name }) : mode === 'replace' ? t('Project "{name}" replaced with the file.', { name: f.payload.project.name }) : t('Project restored as a copy.') });
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
  };
  const doImport = async (file: File | undefined) => {
    if (!file) return;
    setMsg(null);
    try {
      const f = parseBackup(await file.text());
      const existing = await backupConflict(f);
      if (existing) setPending({ f, existing }); else await restore(f, 'copy', false);
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
  };
  return (
    <div className="card">
      <h2>{t("Backup (project file)")}</h2>
      <p className="small muted">{t("Your data lives only in this browser. If the browser data is cleared you lose it, so save a project file after each month. It contains the import, settings, rules, baselines, snapshots and the change log. On another computer the project opens with its name; if it is already in this browser you choose to replace it or keep both.")}</p>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn primary" disabled={!app.project} onClick={doExport}>{t("Export project file")}</button>
        <button className="btn" onClick={() => file.current?.click()}>{t("Import project file…")}</button>
        <input ref={file} type="file" accept=".json,.psis.json" hidden onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = ''; }} />
        <span className="small muted">{last ? t('Last backup from this browser: {when}', { when: dateTime(last) }) : t('No backup made from this browser yet.')}</span>
      </div>
      {pending && (
        <div className="notice warn">
          <b>{t('"{name}" is already in this browser.', { name: pending.existing.name })}</b>{' '}
          {t('Here it was last changed {here}; the file was saved {file}.', { here: dateTime(pending.existing.updatedAt), file: dateTime(pending.f.exportedAt) })}
          <div className="row" style={{ marginTop: 8 }}>
            <ConfirmButton className="btn small primary" confirmText={t('Click again: the project here is replaced')} onConfirm={() => restore(pending.f, 'replace', true)}>{t('Replace it with the file')}</ConfirmButton>
            <button className="btn small" onClick={() => restore(pending.f, 'copy', true)}>{t('Keep both (open the file as a copy)')}</button>
            <button className="btn small" onClick={() => setPending(null)}>{t('Cancel')}</button>
          </div>
        </div>
      )}
      {msg && <div className={`notice ${msg.ok ? 'good' : 'bad'}`}>{t(msg.t)}</div>}
    </div>
  );
}
