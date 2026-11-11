import { useMemo, useRef, useState } from 'react';
import { useApp } from '../../state';
import { PageHead, Stat, pct, fd, downloadBytes, Limited } from '../common';
import { t, tr } from '../../i18n';
import { ACTUAL_FIELD } from '../../core/settings';
import { fmtDate } from '../../core/dates';
import type { ProgressEntries } from '../../core/progress';
import type { Activity } from '../../core/types';
import { readWorkbookFile } from '../../core/readFile';
import { writeXlsx } from '../../core/xlsxWrite';
import { progressTemplate, readProgressSheet, type ReadProgress } from '../../core/progressSheet';
import { Icon } from '../icons';

type Show = 'open' | 'all' | 'entered';
const QUICK = [0, 25, 50, 75, 100];
const BIG_CHANGE = 0.3;

interface Preview {
  file: string;
  read: ReadProgress;
  apply: { id: string; name: string; from: number | null; to: number }[];
  unknown: string[];
  unchanged: number;
}

/** Actual % entered by the engineer for this data date; replaces the P6 value of the "Actual % source" field. */
export function ProgressPage() {
  const app = useApp();
  const { project, imp, rows, fileActivities } = app;
  const [q, setQ] = useState('');
  const [show, setShow] = useState<Show>('open');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const dd = project?.settings.dataDate ?? null;
  const entries: ProgressEntries = project?.progress ?? {};
  const fileById = useMemo(() => new Map((fileActivities ?? []).map((a) => [a.id.toLowerCase(), a])), [fileActivities]);
  const clsByRow = useMemo(() => new Map((rows ?? []).map((r) => [r.a.row, r.cls])), [rows]);
  if (!project || !imp) return <div className="card muted">{t('Import a file first.')}</div>;
  if (dd == null) return <div className="card muted">{t('Set the data date to run the calculations.')}</div>;

  const field = ACTUAL_FIELD[project.settings.actualSource] as keyof Activity;
  const p6Of = (id: string) => (fileById.get(id.toLowerCase())?.[field] as number | null | undefined) ?? null;
  const current = (id: string) => { const e = entries[id.toLowerCase()]; return e && e.dataDate === dd ? e : null; };
  const value = (id: string) => current(id)?.pct ?? p6Of(id);
  const list = imp.activities
    .filter((a) => a.id && !/summary/i.test(a.type) && !/level of effort/i.test(a.type))
    .filter((a) => show === 'all' || (show === 'entered' ? current(a.id) : !/complet/i.test(fileById.get(a.id.toLowerCase())?.status ?? a.status) || current(a.id)))
    .filter((a) => !q || `${a.id} ${a.name} ${a.wbs} ${a.wbsName}`.toLowerCase().includes(q.toLowerCase()));
  const entered = Object.values(entries).filter((e) => e.dataDate === dd).length;

  /** one save for any number of changes (fraction, or null = back to the P6 value) */
  const saveMany = async (changes: { id: string; pct: number | null }[], log: string) => {
    if (!changes.length) return;
    const next = { ...entries };
    const at = new Date().toISOString();
    for (const c of changes) {
      const k = c.id.toLowerCase();
      if (c.pct == null) delete next[k]; else next[k] = { pct: Math.max(0, Math.min(1, c.pct)), dataDate: dd, at };
    }
    await app.updateProject({ progress: next }, log);
  };
  const parse = (raw: string): number | null => {
    const n = Number(raw.trim().replace('%', '').replace(',', '.'));
    return raw.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 100 ? n / 100 : null;
  };
  const commit = (id: string) => {
    const k = id.toLowerCase();
    if (!(k in draft)) return;
    const v = parse(draft[k]);
    setDraft((d) => { const c = { ...d }; delete c[k]; return c; });
    if (v != null && v !== current(id)?.pct) saveMany([{ id, pct: v }], 'Actual % entered');
  };
  const focus = (i: number) => { const el = inputs.current[i]; if (el) { el.focus(); el.select(); } };
  /** a column pasted from Excel fills this activity and the ones below it */
  const paste = (i: number, text: string): boolean => {
    const cells = text.replace(/\r/g, '').split('\n').map((l) => l.split('\t')[0]).filter((x, j, arr) => x !== '' || j < arr.length - 1);
    if (cells.length < 2) return false;
    const changes: { id: string; pct: number | null }[] = [];
    let bad = 0;
    cells.forEach((c, j) => {
      const a = list[i + j];
      if (!a || c.trim() === '') return;
      const v = parse(c);
      if (v == null) bad++; else changes.push({ id: a.id, pct: v });
    });
    saveMany(changes, 'Actual % pasted');
    setMsg({ ok: bad === 0, t: t('{n} values pasted.', { n: changes.length }) + (bad ? ' ' + t('{n} could not be read.', { n: bad }) : '') });
    return true;
  };
  const clearAll = () => { const next: ProgressEntries = {}; for (const [k, e] of Object.entries(entries)) if (e.dataDate !== dd) next[k] = e; app.updateProject({ progress: next }, 'Actual % entries cleared'); };

  // ---------- Excel round trip
  const downloadTemplate = () => {
    const h = {
      id: t('Activity ID'), name: t('Activity Name'), wbs: t('WBS'), phase: t('Phase'), building: t('Building'), status: t('Status'),
      start: t('Start'), finish: t('Finish'), p6: t('P6 value'), actual: t('Actual % (enter)'), item: t('Item'), value: t('Value'),
      project: t('Project'), dataDate: t('Data date'),
      howTo: t('How to fill'), howToText: t('Write the actual % (0-100) in the last column only for activities that changed, save, and upload the file on the Enter actual progress page. Empty cells keep their value.'),
    };
    const tr = list.map((a) => {
      const f = fileById.get(a.id.toLowerCase());
      const cls = clsByRow.get(a.row);
      return { id: a.id, name: a.name, wbsName: a.wbsName, phase: cls?.phase ?? '', building: cls?.building ?? '', status: t(f?.status ?? a.status),
        start: f?.actStart ?? f?.start ?? null, finish: f?.actFinish ?? f?.finish ?? null, p6: p6Of(a.id), current: current(a.id)?.pct ?? null };
    });
    const bytes = writeXlsx(progressTemplate(tr, dd, project.settings.projectTitle || project.name, h));
    downloadBytes(`Progress_update_${fmtDate(dd).replace(/-/g, '')}.xlsx`, bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setMsg(null);
    try {
      const wb = readWorkbookFile(f.name, new Uint8Array(await f.arrayBuffer()));
      const read = readProgressSheet(wb.sheets);
      if (read.error) { setMsg({ ok: false, t: t('The file has no "Activity ID" and "Actual %" columns. Use the template from this page.') }); return; }
      const byId = new Map(imp.activities.filter((a) => a.id).map((a) => [a.id.toLowerCase(), a]));
      const apply: Preview['apply'] = [], unknown: string[] = [];
      let unchanged = 0;
      for (const v of read.values) {
        const a = byId.get(v.id.toLowerCase());
        if (!a) { unknown.push(v.id); continue; }
        const from = value(a.id);
        if (from != null && Math.abs(from - v.pct) < 1e-9) { unchanged++; continue; }
        apply.push({ id: a.id, name: a.name, from, to: v.pct });
      }
      setPreview({ file: f.name, read, apply, unknown, unchanged });
    } catch (e) { setMsg({ ok: false, t: t((e as Error).message) }); }
  };
  const confirm = async () => {
    if (!preview) return;
    await saveMany(preview.apply.map((x) => ({ id: x.id, pct: x.to })), `Actual % uploaded from ${preview.file}`);
    setMsg({ ok: true, t: t('{n} activities updated from the file.', { n: preview.apply.length }) });
    setPreview(null);
  };
  const big = preview?.apply.filter((x) => x.from != null && Math.abs(x.to - x.from) > BIG_CHANGE) ?? [];

  return (
    <>
      <PageHead title={t('Enter actual progress')}>
        <p>{tr('Type the actual % agreed on site for each activity. Your value replaces the {field} value from the P6 file for this data date ({dd}) only, and it is kept when you import the file again. A new data date starts clean.', { field: <b>{t(project.settings.actualSource)}</b>, dd: <b>{fd(dd)}</b> })}</p>
      </PageHead>

      <div className="card excel-card">
        <span className="phase-ico"><Icon name="table" size={18} /></span>
        <div className="grow">
          <h2>{t('Update from Excel')}</h2>
          <p className="small muted">{t('Download the list, fill the Actual % column in Excel (or send it to the site engineers), then upload it. You see every change before it is applied.')}</p>
        </div>
        <div className="row">
          <button className="btn" onClick={downloadTemplate}><Icon name="download" size={16} />{t('Download template ({n} activities)', { n: list.length })}</button>
          <button className="btn primary" onClick={() => fileRef.current?.click()}><Icon name="upload" size={16} />{t('Upload filled file')}</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </div>

      {preview && (
        <div className="card" style={{ borderColor: 'var(--blue)' }}>
          <div className="card-head"><h2>{t('Check before applying')}</h2><span className="small muted">{preview.file}</span></div>
          <ul className="checklist">
            <li className={preview.apply.length ? 'ok' : 'warn'}><span className="cl-ico"><Icon name={preview.apply.length ? 'check' : 'alert'} size={14} stroke={2.4} /></span>
              <span>{t('{n} activities will be updated', { n: preview.apply.length })}{preview.unchanged ? ` · ${t('{n} unchanged', { n: preview.unchanged })}` : ''}</span></li>
            {big.length > 0 && <li className="warn"><span className="cl-ico"><Icon name="alert" size={14} stroke={2.4} /></span><span>{t('{n} change by more than 30 points - please check them (marked below)', { n: big.length })}</span></li>}
            {preview.unknown.length > 0 && <li className="warn"><span className="cl-ico"><Icon name="alert" size={14} stroke={2.4} /></span><span>{t('{n} Activity IDs are not in this schedule and are skipped:', { n: preview.unknown.length })} <span className="mono">{preview.unknown.slice(0, 8).join(', ')}{preview.unknown.length > 8 ? '…' : ''}</span></span></li>}
            {preview.read.invalid.length > 0 && <li className="bad"><span className="cl-ico"><Icon name="alert" size={14} stroke={2.4} /></span><span>{t('{n} values could not be read and are skipped:', { n: preview.read.invalid.length })} <span className="mono">{preview.read.invalid.slice(0, 6).map((x) => `${x.id} "${x.value}"`).join(', ')}</span></span></li>}
            {preview.read.dataDateText && preview.read.dataDateText !== fmtDate(dd) && <li className="warn"><span className="cl-ico"><Icon name="alert" size={14} stroke={2.4} /></span><span>{t('The file was made for data date {a}, the project is on {b}.', { a: preview.read.dataDateText, b: fmtDate(dd) })}</span></li>}
          </ul>
          {preview.apply.length > 0 && (
            <div className="table-wrap" style={{ maxHeight: 260, marginTop: 10 }}><table className="t">
              <thead><tr><th>{t('Activity ID')}</th><th>{t('Activity Name')}</th><th className="num">{t('Now')}</th><th className="num">{t('New')}</th></tr></thead>
              <tbody>{preview.apply.map((x) => <tr key={x.id} className={big.includes(x) ? 'warn-row' : ''}><td className="mono nowrap">{x.id}</td><td>{x.name}</td><td className="num">{pct(x.from, 0)}</td><td className="num"><b>{pct(x.to, 0)}</b></td></tr>)}</tbody>
            </table></div>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" disabled={!preview.apply.length} onClick={confirm}>{t('Apply {n} changes', { n: preview.apply.length })}</button>
            <button className="btn" onClick={() => setPreview(null)}>{t('Cancel')}</button>
          </div>
        </div>
      )}
      {msg && <div className={`notice ${msg.ok ? 'good' : 'bad'}`}>{msg.t}</div>}

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
      <p className="small muted" style={{ margin: '0 0 8px' }}>{t('Tip: press Enter to jump to the next activity, or paste a whole column copied from Excel into the first box.')}</p>
      <Limited list={list} resetKey={q + show}>{(shown, more) => (<div className="table-wrap tall">
        <table className="t progress-t">
          <thead><tr><th>{t('Activity ID')}</th><th>{t('Activity Name')}</th><th>{t('WBS')}</th><th>{t('Status')}</th><th className="num">{t('P6 value')}</th><th>{t('Quick')}</th><th style={{ width: 130 }}>{t('Actual % (yours)')}</th><th /></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={8} className="muted">{t('None.')}</td></tr>}
            {shown.map((a, i) => {
              const k = a.id.toLowerCase();
              const e = current(a.id);
              const now = value(a.id);
              return (
                <tr key={a.row} className={e ? 'sel' : ''}>
                  <td className="nowrap mono">{a.id}</td><td>{a.name}</td><td className="small muted">{a.wbsName}</td><td className="small">{t(a.status)}</td>
                  <td className="num">{pct(p6Of(a.id), 0)}</td>
                  <td className="nowrap">
                    <div className="quick">
                      {QUICK.map((v) => (
                        <button key={v} className={`qbtn ${now != null && Math.abs(now * 100 - v) < 1e-6 ? 'on' : ''} ${v === 100 ? 'done' : ''}`} title={`${v}%`}
                          onClick={() => saveMany([{ id: a.id, pct: v / 100 }], 'Actual % entered')}>{v === 100 ? '✓' : v}</button>
                      ))}
                    </div>
                  </td>
                  <td>
                    <input ref={(el) => { inputs.current[i] = el; }} type="text" inputMode="decimal" style={{ width: 72 }}
                      placeholder={now != null ? String(+(now * 100).toFixed(1)) : '%'}
                      value={draft[k] ?? (e ? String(+(e.pct * 100).toFixed(2)) : '')}
                      onChange={(ev) => setDraft({ ...draft, [k]: ev.target.value })} onBlur={() => commit(a.id)}
                      onPaste={(ev) => { if (paste(i, ev.clipboardData.getData('text'))) { ev.preventDefault(); setDraft({}); } }}
                      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === 'ArrowDown') { ev.preventDefault(); commit(a.id); focus(i + 1); } if (ev.key === 'ArrowUp') { ev.preventDefault(); commit(a.id); focus(i - 1); } }} /> %
                  </td>
                  <td>{e && <button className="btn small" onClick={() => saveMany([{ id: a.id, pct: null }], 'Actual % entry removed')}>{t('Use P6 value')}</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>{more}
      </div>)}</Limited>
      <p className="small muted" style={{ marginTop: 8 }}>{t('Values save when you leave the box or press Enter. 100% marks the activity completed; above 0% marks it in progress. Entries change the data, so an approval must be given again.')}</p>
    </>
  );
}
