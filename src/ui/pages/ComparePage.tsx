import { useMemo, useRef, useState } from 'react';
import { useApp } from '../../state';
import { PageHead, Stat, Limited, pct, num, fd, ltr, downloadBytes } from '../common';
import { Icon } from '../icons';
import { t, getLang } from '../../i18n';
import { readLogic } from '../../core/logic';
import { ACTUAL_FIELD } from '../../core/settings';
import { fmtDate } from '../../core/dates';
import { writeXlsx } from '../../core/xlsxWrite';
import {
  compareSchedules, compareSheets, CHANGE_LABEL, CHANGE_UNIT, RED_FLAG_LABEL,
  type ActivityDiff, type Change, type ChangeKind, type CompareSide, type RedFlag, type RelationChange,
} from '../../core/compare';
import { readCompareSide } from '../../core/compareFile';
import type { Activity } from '../../core/types';

type View = 'all' | 'warnings' | 'finish' | 'dur' | 'actual' | 'progress' | 'float' | 'status' | 'other' | 'added' | 'deleted' | 'relations';
const VIEWS: { v: View; label: string }[] = [
  { v: 'all', label: 'All changes' }, { v: 'warnings', label: 'Warnings' }, { v: 'finish', label: 'Start / finish moved' },
  { v: 'dur', label: 'Durations' }, { v: 'actual', label: 'Actual dates' }, { v: 'progress', label: 'Progress' }, { v: 'float', label: 'Float' },
  { v: 'status', label: 'Status' }, { v: 'other', label: 'Name, WBS, type, constraint, baseline' },
  { v: 'added', label: 'Added activities' }, { v: 'deleted', label: 'Deleted activities' }, { v: 'relations', label: 'Relationships' },
];
const KINDS: Partial<Record<View, ChangeKind[]>> = {
  finish: ['start', 'finish'], dur: ['origDur', 'remDur'], actual: ['actStart', 'actFinish'], progress: ['progress'], float: ['float'],
  status: ['status'], other: ['name', 'wbs', 'type', 'constraint', 'blStart', 'blFinish'],
};

/** the other file stays while you move between pages (not after a reload) */
let cache: { projectId: string; side: CompareSide } | null = null;

const signed = (x: number, digits = 0) => ltr(`${x > 0 ? '+' : ''}${x.toFixed(digits)}`);

function showValue(c: Change, v: string | number | null): string {
  if (v == null || v === '') return '-';
  switch (CHANGE_UNIT[c.kind]) {
    case 'date': return fd(v as number);
    case 'days': return `${num(v as number, 1)} ${t('d')}`;
    case 'pct': return pct(v as number, 0);
    default: return c.kind === 'status' || c.kind === 'type' ? t(String(v)) : String(v);
  }
}
function showDelta(c: Change): { text: string; tone: string } {
  if (c.delta == null) return { text: '', tone: '' };
  const u = CHANGE_UNIT[c.kind];
  if (u === 'pct') return { text: `${signed(c.delta * 100, 0)} ${t('pp')}`, tone: c.delta < 0 ? 'bad' : '' };
  const text = `${signed(c.delta, u === 'days' ? 1 : 0)} ${t('d')}`;
  // later finish / less float / longer remaining duration = worse
  const worse = c.kind === 'float' ? c.delta < 0 : ['finish', 'start', 'remDur', 'origDur'].includes(c.kind) ? c.delta > 0 : false;
  return { text, tone: worse ? (c.kind === 'finish' || c.kind === 'float' ? 'bad' : 'warn') : '' };
}

export function ComparePage() {
  const app = useApp();
  const { project, stored, imp, fileActivities } = app;
  const [other, setOther] = useState<CompareSide | null>(cache && cache.projectId === project?.id ? cache.side : null);
  const [flip, setFlip] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>('all');
  const [q, setQ] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const current = useMemo<CompareSide | null>(() => {
    if (!project || !stored || !imp || !fileActivities) return null;
    const o = project.importOptions;
    const logic = readLogic(stored.sheets, stored.sheetIndex, imp, o.durationUnit, o.hoursPerDay);
    return { label: stored.fileName, dataDate: project.settings.dataDate, activities: fileActivities, relations: logic.relations, constraints: logic.constraints };
  }, [project, stored, imp, fileActivities]);
  const field = project ? ACTUAL_FIELD[project.settings.actualSource] as keyof Activity : 'physPct';
  const res = useMemo(() => (current && other ? compareSchedules(flip ? current : other, flip ? other : current, field) : null), [current, other, flip, field]);

  if (!project || !current) return <div className="card muted">{t('Import a file first.')}</div>;

  const load = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true); setErr('');
    try {
      const side = readCompareSide(f.name, new Uint8Array(await f.arrayBuffer()), project.mapping, project.importOptions);
      cache = { projectId: project.id, side };
      setOther(side); setFlip(false); setView('all');
    } catch (e) { setErr(t((e as Error).message)); } finally { setBusy(false); }
  };
  const exportXlsx = () => {
    if (!res) return;
    const ar = getLang() === 'ar';
    const bytes = writeXlsx(compareSheets(res, (x) => t(x), ar));
    downloadBytes(`Schedule_comparison_${fmtDate(res.older.dataDate).replace(/-/g, '')}_${fmtDate(res.newer.dataDate).replace(/-/g, '')}.xlsx`, bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  const s = q.trim().toLowerCase();
  const match = (id: string, name: string) => !s || `${id} ${name}`.toLowerCase().includes(s);
  const rows: { d: ActivityDiff; c: Change }[] = !res ? [] : res.changed
    .filter((d) => match(d.id, d.name) && (view !== 'warnings' || d.flags.length > 0))
    .flatMap((d) => d.changes.filter((c) => view === 'all' || view === 'warnings' || (KINDS[view] ?? []).includes(c.kind)).map((c) => ({ d, c })));
  const acts = !res ? [] : (view === 'added' ? res.added : view === 'deleted' ? res.deleted : []).filter((a) => match(a.id, a.name));
  const rels: (RelationChange & { what: string })[] = !res?.relations ? [] : [
    ...res.relations.added.map((r) => ({ ...r, what: 'Added' })), ...res.relations.deleted.map((r) => ({ ...r, what: 'Deleted' })),
    ...res.relations.lagChanged.map((r) => ({ ...r, what: 'Lag changed' })),
  ].filter((r) => !s || `${r.pred} ${r.succ}`.toLowerCase().includes(s));
  const finishDelta = res && res.older.finish != null && res.newer.finish != null ? res.newer.finish - res.older.finish : null;
  const flagged = res ? (Object.keys(RED_FLAG_LABEL) as RedFlag[]).filter((f) => res.flags[f].length > 0) : [];
  const sameOrder = res && (res.older.dataDate == null || res.newer.dataDate == null || res.older.dataDate === res.newer.dataDate);

  return (
    <>
      <PageHead title={t('Compare two updates')}>
        <p>{t('Choose another P6 file of the same project (for example last month\'s XER) to see what changed: activities added or deleted, durations, dates, actual dates, progress, float and relationships. The file is only read in this browser - nothing is saved or changed.')}</p>
      </PageHead>

      <div className="card excel-card">
        <span className="phase-ico"><Icon name="compare" size={18} /></span>
        <div className="grow">
          <h2>{t('The other file')}</h2>
          <p className="small muted">{t('Imported now: {file}', { file: current.label })}{other && <> · {t('Compared with: {file}', { file: other.label })}</>}</p>
        </div>
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()}><Icon name="upload" size={16} />{busy ? t('Reading…') : other ? t('Choose another file…') : t('Choose the other file…')}</button>
          {res && <button className="btn" onClick={exportXlsx}><Icon name="download" size={16} />{t('Export to Excel')}</button>}
          <input ref={fileRef} type="file" accept=".xer,.xlsx,.xls,.xlsm" hidden onChange={(e) => { load(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </div>
      {err && <div className="notice bad">{err}</div>}

      {res && (
        <>
          <div className="grid3" style={{ marginBottom: 16 }}>
            <Stat k={t('Older: {file}', { file: res.older.label })} v={fd(res.older.dataDate) || '-'} sub={t('{n} activities · finish {d}', { n: res.older.count, d: fd(res.older.finish) })} />
            <Stat k={t('Newer: {file}', { file: res.newer.label })} v={fd(res.newer.dataDate) || '-'} sub={t('{n} activities · finish {d}', { n: res.newer.count, d: fd(res.newer.finish) })} />
            <Stat k={t('Project finish moved')} v={finishDelta == null ? '-' : `${signed(finishDelta)} ${t('d')}`} tone={finishDelta == null ? undefined : finishDelta > 0 ? 'bad' : 'good'}
              sub={res.older.float != null && res.newer.float != null ? t('Lowest float {a} → {b} d', { a: num(res.older.float, 1), b: num(res.newer.float, 1) }) : undefined} />
          </div>
          {sameOrder && (
            <div className="notice small">{t('The two files have no different data dates, so the file you chose is treated as the older one.')}{' '}
              <button className="link-btn" onClick={() => setFlip((x) => !x)}>{t('Swap older / newer')}</button></div>
          )}
          <div className="grid3" style={{ marginBottom: 16 }}>
            <Stat k={t('Activities added')} v={res.added.length} tone={res.added.length ? 'warn' : undefined} />
            <Stat k={t('Activities deleted')} v={res.deleted.length} tone={res.deleted.length ? 'warn' : undefined} />
            <Stat k={t('Finish later / earlier')} v={ltr(`${res.finishLater} / ${res.finishEarlier}`)} tone={res.finishLater ? 'bad' : undefined} />
            <Stat k={t('Original duration changed')} v={res.counts.origDur} tone={res.counts.origDur ? 'warn' : undefined} />
            <Stat k={t('Relationships added / deleted')} v={res.relations ? ltr(`${res.relations.added.length} / ${res.relations.deleted.length}`) : '-'} sub={res.relations ? t('{n} lags changed', { n: res.relations.lagChanged.length }) : t('One of the files has no relationships')} />
            <Stat k={t('Float went down')} v={res.changed.filter((d) => d.changes.some((c) => c.kind === 'float' && (c.delta ?? 0) < 0)).length} />
            <Stat k={t('Progress went up')} v={res.changed.filter((d) => d.changes.some((c) => c.kind === 'progress' && (c.delta ?? 0) > 0)).length} tone="good" />
            <Stat k={t('Warnings')} v={flagged.reduce((n, f) => n + res.flags[f].length, 0)} tone={flagged.length ? 'bad' : 'good'} sub={t('history that should not change')} />
          </div>
          {flagged.map((f) => (
            <div key={f} className="notice bad small">
              <b>{t(RED_FLAG_LABEL[f])}: {res.flags[f].length}</b> · <span className="mono">{res.flags[f].slice(0, 8).map((d) => d.id).join(', ')}{res.flags[f].length > 8 ? '…' : ''}</span>{' '}
              <button className="link-btn" onClick={() => setView('warnings')}>{t('Show')}</button>
            </div>
          ))}

          <div className="card">
            <div className="row" style={{ marginBottom: 10 }}>
              <select value={view} onChange={(e) => setView(e.target.value as View)}>
                {VIEWS.map((x) => <option key={x.v} value={x.v}>{t(x.label)}</option>)}
              </select>
              <input type="search" placeholder={t('Search ID or name…')} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
              <span className="grow" />
              <span className="small muted">{view === 'relations' ? t('{n} relationships', { n: rels.length }) : view === 'added' || view === 'deleted' ? t('{n} activities.', { n: acts.length }) : t('{n} changes', { n: rows.length })}</span>
            </div>
            {view === 'relations' ? (
              !res.relations ? <p className="muted">{t('One of the files has no relationships. Use XER files, or tick Relationships when exporting to Excel from P6.')}</p> : (
                <Limited list={rels} resetKey={q}>{(shown, more) => (
                  <div className="table-wrap tall"><table className="t">
                    <thead><tr><th>{t('Change')}</th><th>{t('Predecessor')}</th><th>{t('Successor')}</th><th>{t('Type')}</th><th className="num">{t('Lag before (d)')}</th><th className="num">{t('Lag (d)')}</th></tr></thead>
                    <tbody>{shown.length === 0 && <tr><td colSpan={6} className="muted">{t('None.')}</td></tr>}
                      {shown.map((r, i) => <tr key={i}><td>{t(r.what)}</td><td className="mono">{r.pred}</td><td className="mono">{r.succ}</td><td>{r.type}</td><td className="num">{r.fromLag != null ? num(r.fromLag, 1) : ''}</td><td className="num">{num(r.lag, 1)}</td></tr>)}</tbody>
                  </table>{more}</div>)}</Limited>)
            ) : view === 'added' || view === 'deleted' ? (
              <Limited list={acts} resetKey={view + q}>{(shown, more) => (
                <div className="table-wrap tall"><table className="t">
                  <thead><tr><th>{t('Activity ID')}</th><th>{t('Activity Name')}</th><th>{t('WBS')}</th><th>{t('Status')}</th><th>{t('Start')}</th><th>{t('Finish')}</th><th className="num">{t('Original duration')}</th></tr></thead>
                  <tbody>{shown.length === 0 && <tr><td colSpan={7} className="muted">{t('None.')}</td></tr>}
                    {shown.map((a) => <tr key={a.id}><td className="mono nowrap">{a.id}</td><td>{a.name}</td><td className="small muted">{a.wbsName || a.wbs}</td><td className="small">{t(a.status)}</td><td className="nowrap">{fd(a.actStart ?? a.start)}</td><td className="nowrap">{fd(a.actFinish ?? a.finish)}</td><td className="num">{num(a.origDur, 1)}</td></tr>)}</tbody>
                </table>{more}</div>)}</Limited>
            ) : (
              <Limited list={rows} resetKey={view + q}>{(shown, more) => (
                <div className="table-wrap tall"><table className="t">
                  <thead><tr><th>{t('Activity ID')}</th><th>{t('Activity Name')}</th><th>{t('Change')}</th><th>{t('Older')}</th><th>{t('Newer')}</th><th className="num">{t('Difference')}</th><th>{t('Warning')}</th></tr></thead>
                  <tbody>{shown.length === 0 && <tr><td colSpan={7} className="muted">{t('No changes.')}</td></tr>}
                    {shown.map(({ d, c }, i) => {
                      const dl = showDelta(c);
                      return (
                        <tr key={d.id + c.kind + i} className={d.flags.length ? 'warn-row' : ''}>
                          <td className="mono nowrap">{d.id}{d.critical && <span className="badge critical" style={{ marginInlineStart: 6 }}>{t('Critical')}</span>}</td>
                          <td>{d.name}</td><td className="nowrap">{t(CHANGE_LABEL[c.kind])}</td>
                          <td className="nowrap">{showValue(c, c.from)}</td><td className="nowrap"><b>{showValue(c, c.to)}</b></td>
                          <td className={`num nowrap ${dl.tone}`}>{dl.text}</td>
                          <td className="small">{d.flags.map((f) => t(RED_FLAG_LABEL[f])).join(' · ')}</td>
                        </tr>
                      );
                    })}</tbody>
                </table>{more}</div>)}</Limited>
            )}
          </div>
        </>
      )}
      {!res && !err && <div className="card muted small">{t('Tip: keep last month\'s XER (or Excel export) next to this month\'s. Comparing them before the report shows durations shortened to hide a delay, logic removed, or actual dates changed after they were reported.')}</div>}
    </>
  );
}
