import { useRef, useState } from 'react';
import { useApp } from '../state';
import { downloadText, dateTime } from './common';
import { t } from '../i18n';

const KEY = 'psis:lastBackup';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

export function BackupCard() {
  const app = useApp();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [last, setLast] = useState(read());
  const file = useRef<HTMLInputElement>(null);
  const doExport = async () => {
    try {
      const f = await app.makeBackup();
      if (!f) return;
      const safe = (app.project?.name ?? 'project').replace(/[^\w\-]+/g, '_');
      downloadText(`${safe}_${f.exportedAt.slice(0, 10)}.psis.json`, JSON.stringify(f));
      const now = new Date().toISOString();
      try { localStorage.setItem(KEY, now); } catch { /* ignore */ }
      setLast(now);
      setMsg({ ok: true, t: t('Project file saved to your Downloads folder. Keep it somewhere safe (cloud drive or USB).') });
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
  };
  const doImport = async (f: File | undefined) => {
    if (!f) return;
    try { await app.restoreBackup(await f.text()); setMsg({ ok: true, t: t('Project restored as a new project.') }); }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
  };
  return (
    <div className="card">
      <h2>{t("Backup (project file)")}</h2>
      <p className="small muted">{t("Your data lives only in this browser. If the browser data is cleared you lose it, so save a project file after each month. It contains the import, settings, rules, baselines, snapshots and the change log. Restoring always creates a new project and never overwrites an existing one.")}</p>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn primary" disabled={!app.project} onClick={doExport}>{t("Export project file")}</button>
        <button className="btn" onClick={() => file.current?.click()}>{t("Import project file…")}</button>
        <input ref={file} type="file" accept=".json,.psis.json" hidden onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = ''; }} />
        <span className="small muted">{last ? t('Last backup from this browser: {when}', { when: dateTime(last) }) : t('No backup made from this browser yet.')}</span>
      </div>
      {msg && <div className={`notice ${msg.ok ? 'good' : 'bad'}`}>{t(msg.t)}</div>}
    </div>
  );
}
