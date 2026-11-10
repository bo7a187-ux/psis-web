import { useMemo, useState } from 'react';
import { useApp } from '../../state';
import { PageHead, Stat, pct, fd } from '../common';
import { t, tr } from '../../i18n';
import { ACTUAL_FIELD } from '../../core/settings';
import type { ProgressEntries } from '../../core/progress';
import type { Activity } from '../../core/types';

type Show = 'open' | 'all' | 'entered';

/** Actual % typed by the engineer for this data date; replaces the P6 value of the "Actual % source" field. */
export function ProgressPage() {
  const app = useApp();
  const { project, stored, imp } = app;
  const [q, setQ] = useState('');
  const [show, setShow] = useState<Show>('open');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const dd = project?.settings.dataDate ?? null;
  const entries: ProgressEntries = project?.progress ?? {};
  // P6 values: the import before manual entries (activities in `imp` already include them)
  const p6 = useMemo(() => {
    if (!project || !stored) return new Map<string, Activity>();
    return new Map((imp?.activities ?? []).map((a) => [a.id.toLowerCase(), a]));
  }, [project, stored, imp]);
  if (!project || !imp) return <div className="card muted">{t('Import a file first.')}</div>;
  if (dd == null) return <div className="card muted">{t('Set the data date to run the calculations.')}</div>;
  const field = ACTUAL_FIELD[project.settings.actualSource] as keyof Activity;
  const current = (id: string) => { const e = entries[id.toLowerCase()]; return e && e.dataDate === dd ? e : null; };
  const list = imp.activities
    .filter((a) => a.id && !/summary/i.test(a.type) && !/level of effort/i.test(a.type))
    .filter((a) => show === 'all' || (show === 'entered' ? current(a.id) : !/complet/i.test(a.status) || current(a.id)))
    .filter((a) => !q || `${a.id} ${a.name} ${a.wbs} ${a.wbsName}`.toLowerCase().includes(q.toLowerCase()));
  const entered = Object.values(entries).filter((e) => e.dataDate === dd).length;
  const save = async (next: ProgressEntries, log: string) => app.updateProject({ progress: next }, log);
  const commit = (id: string) => {
    const k = id.toLowerCase();
    const raw = (draft[k] ?? '').trim();
    if (raw === '') return;
    const n = Number(raw.replace('%', ''));
    if (!Number.isFinite(n) || n < 0 || n > 100) return;
    const next = { ...entries, [k]: { pct: n / 100, dataDate: dd, at: new Date().toISOString() } };
    setDraft((d) => { const c = { ...d }; delete c[k]; return c; });
    save(next, 'Actual % entered');
  };
  const clear = (id: string) => { const next = { ...entries }; delete next[id.toLowerCase()]; save(next, 'Actual % entry removed'); };
  const clearAll = () => { const next: ProgressEntries = {}; for (const [k, e] of Object.entries(entries)) if (e.dataDate !== dd) next[k] = e; save(next, 'Actual % entries cleared'); };

  return (
    <>
      <PageHead title={t('Enter actual progress')}>
        <p>{tr('Type the actual % agreed on site for each activity. Your value replaces the {field} value from the P6 file for this data date ({dd}) only, and it is kept when you import the file again. A new data date starts clean.', { field: <b>{t(project.settings.actualSource)}</b>, dd: <b>{fd(dd)}</b> })}</p>
      </PageHead>
      <div className="grid3" style={{ marginBottom: 14 }}>
        <Stat k={t('Entered for this data date')} v={entered} />
        <Stat k={t('Activities shown')} v={list.length} />
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <input type="search" placeholder={t('Search ID, name or WBS…')} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 280 }} />
        <select value={show} onChange={(e) => setShow(e.target.value as Show)}>
          <option value="open">{t('Open activities')}</option><option value="entered">{t('Entered by me')}</option><option value="all">{t('All')}</option>
        </select>
        <span className="grow" />
        {entered > 0 && <button className="btn small danger" onClick={clearAll}>{t('Remove all my entries for this data date')}</button>}
      </div>
      <div className="table-wrap tall">
        <table className="t">
          <thead><tr><th>{t('Activity ID')}</th><th>{t('Activity Name')}</th><th>{t('WBS')}</th><th>{t('Status')}</th><th className="num">{t('P6 value')}</th><th style={{ width: 150 }}>{t('Actual % (yours)')}</th><th /></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={7} className="muted">{t('None.')}</td></tr>}
            {list.map((a) => {
              const k = a.id.toLowerCase();
              const e = current(a.id);
              const p6v = e ? null : (p6.get(k)?.[field] as number | null);
              return (
                <tr key={a.row} className={e ? 'sel' : ''}>
                  <td className="nowrap mono">{a.id}</td><td>{a.name}</td><td className="small muted">{a.wbsName}</td><td className="small">{t(a.status)}</td>
                  <td className="num">{e ? <span className="muted small">{t('replaced')}</span> : pct(p6v, 0)}</td>
                  <td>
                    <input type="number" min={0} max={100} step={1} style={{ width: 90 }} placeholder={e ? String(+(e.pct * 100).toFixed(2)) : '%'}
                      value={draft[k] ?? (e ? String(+(e.pct * 100).toFixed(2)) : '')}
                      onChange={(ev) => setDraft({ ...draft, [k]: ev.target.value })} onBlur={() => commit(a.id)}
                      onKeyDown={(ev) => { if (ev.key === 'Enter') { commit(a.id); (ev.target as HTMLInputElement).blur(); } }} /> %
                  </td>
                  <td>{e && <button className="btn small" onClick={() => clear(a.id)}>{t('Use P6 value')}</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>{t('Values save when you leave the box or press Enter. 100% marks the activity completed; above 0% marks it in progress. Entries change the data, so an approval must be given again.')}</p>
    </>
  );
}
