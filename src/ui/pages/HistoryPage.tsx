import { useMemo, useState } from 'react';
import { useApp } from '../../state';
import { Chart, C } from '../Chart';
import { BackupCard } from '../BackupCard';
import { AskText, PageHead, Stat, pct, pp, dateTime, fd } from '../common';
import { fmtDate } from '../../core/dates';
import { groupTable, NO_FILTER, summarize } from '../../core/project';
import { ApprovalBadge } from '../../App';
import { t, tr } from '../../i18n';

export function HistoryPage() {
  const app = useApp();
  const { project, rows, history, approval } = app;
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [del, setDel] = useState(false);
  const st = project?.settings;
  const sum = useMemo(() => (rows && st ? summarize(rows, st, NO_FILTER) : null), [rows, st]);
  if (!project || !st) return null;
  const DD = st.dataDate;
  const list = [...history].sort((a, b) => a.dataDate - b.dataDate);
  const prev = [...list].filter((h) => DD != null && h.dataDate < DD).pop() ?? null;
  const exists = list.some((h) => h.dataDate === DD);
  const canSave = !!rows && DD != null && approval === 'APPROVED' && !exists;
  const why = !rows ? t('Import and calculate a schedule first.') : DD == null ? t('Set the data date.') : exists ? t('A snapshot for {d} is already saved.', { d: fd(DD) }) : approval !== 'APPROVED' ? t('The data must be approved first (status: {s}).', { s: t(approval) }) : '';

  const trend = {
    backgroundColor: 'transparent', animation: false,
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => (v == null ? '' : `${(v * 100).toFixed(1)}%`) },
    legend: { bottom: 0 },
    grid: { left: 8, right: 16, top: 12, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: list.map((h) => fmtDate(h.dataDate)) },
    yAxis: { type: 'value', min: 0, max: 1, axisLabel: { formatter: (v: number) => `${Math.round(v * 100)}%` } },
    series: [
      { name: t('Planned'), type: 'line', data: list.map((h) => h.summary.planned), itemStyle: { color: C.planned }, lineStyle: { color: C.planned } },
      { name: t('Actual'), type: 'line', data: list.map((h) => h.summary.actual), itemStyle: { color: C.actual }, lineStyle: { color: C.actual, width: 3 } },
    ],
  };
  const lastDisc = prev && prev.activities.length && rows ? groupTable(rows, NO_FILTER, 'discipline', project.classification.lists.discipline, true) : [];
  const delta = (a: number | null | undefined, b: number | null | undefined) => (a != null && b != null ? a - b : null);

  return (
    <>
      <PageHead title={t("History & snapshots")} right={<ApprovalBadge />}>
        <p>{t("Each month, save a snapshot of the approved results. Saved snapshots never change, even after a new import, a setting change or a baseline revision, so the history is a true record of what was reported.")}</p>
      </PageHead>

      <div className="card">
        <h2>{t("Save this month")}</h2>
        <div className="grid3">
          <Stat k={t("Data date")} v={fd(DD)} />
          <Stat k={t("Planned / Actual")} v={sum ? `${pct(sum.planned)} / ${pct(sum.actual)}` : '-'} />
          <Stat k={t("Snapshots saved")} v={list.length} sub={list.length ? t('latest {d}', { d: fd(list[list.length - 1].dataDate) }) : t('none yet')} />
        </div>
        <div className="row" style={{ marginTop: 12, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, minWidth: 240 }}><label htmlFor="snap-note">{t("Note (optional)")}</label><input id="snap-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("e.g. Nov 2026 update")} /></div>
          <button className="btn primary" disabled={!canSave} onClick={async () => { try { await app.saveCurrentSnapshot(note.trim()); setNote(''); setMsg({ ok: true, t: t('Snapshot for {d} saved.', { d: fd(DD) }) }); } catch (e) { setMsg({ ok: false, t: (e as Error).message }); } }}>{t("Save monthly snapshot")}</button>
        </div>
        {why && <p className="small muted" style={{ marginTop: 6 }}>{why}</p>}
        {msg && <div className={`notice ${msg.ok ? 'good' : 'bad'}`}>{t(msg.t)}</div>}
      </div>

      {list.length > 0 && (
        <div className="card"><h2>{t("Trend")}</h2><Chart option={trend} height={260} label={t("Planned and actual progress by saved month")} /></div>
      )}

      {sum && prev && (
        <div className="card">
          <h2>{t('Current vs previous period ({from} → {to})', { from: fd(prev.dataDate), to: fd(DD) })}</h2>
          <div className="table-wrap"><table className="t">
            <thead><tr><th /><th className="num">{t("Previous")}</th><th className="num">{t("Current")}</th><th className="num">{t("Change")}</th></tr></thead>
            <tbody>
              <tr><td>{t("Planned %")}</td><td className="num">{pct(prev.summary.planned)}</td><td className="num">{pct(sum.planned)}</td><td className="num">{pp(delta(sum.planned, prev.summary.planned))}</td></tr>
              <tr><td>{t("Actual %")}</td><td className="num">{pct(prev.summary.actual)}</td><td className="num">{pct(sum.actual)}</td><td className="num">{pp(delta(sum.actual, prev.summary.actual))}</td></tr>
              <tr><td>{t("Variance (pp)")}</td><td className="num">{pp(prev.summary.variance)}</td><td className="num">{pp(sum.variance)}</td><td className="num">{pp(delta(sum.variance, prev.summary.variance))}</td></tr>
              <tr><td>{t("Completed")}</td><td className="num">{prev.summary.completed}</td><td className="num">{sum.completed}</td><td className="num">{sum.completed - prev.summary.completed}</td></tr>
              <tr><td>{t("Delayed activities")}</td><td className="num">{prev.summary.delayed ?? t('not saved')}</td><td className="num">{sum.delayed}</td><td className="num">{prev.summary.delayed != null ? sum.delayed - prev.summary.delayed : ''}</td></tr>
              <tr><td>{t("Critical (open)")}</td><td className="num">{prev.summary.critical ?? t('not saved')}</td><td className="num">{sum.critical}</td><td className="num">{prev.summary.critical != null ? sum.critical - prev.summary.critical : ''}</td></tr>
              <tr><td>{t("SPI")}</td><td className="num">{prev.summary.spi != null ? prev.summary.spi.toFixed(2) : t('N/A')}</td><td className="num">{sum.spi != null ? sum.spi.toFixed(2) : t('N/A')}</td><td className="num">{prev.summary.spi != null && sum.spi != null ? (sum.spi - prev.summary.spi).toFixed(2) : ''}</td></tr>
            </tbody>
          </table></div>
          {lastDisc.length > 0 && (
            <>
              <h3 style={{ margin: '14px 0 6px' }}>{t("Progress gained since the previous snapshot, by discipline")}</h3>
              <div className="table-wrap"><table className="t"><thead><tr><th>{t("Discipline")}</th><th className="num">{t("Actual now")}</th><th className="num">{t("Period +")}</th></tr></thead>
                <tbody>{lastDisc.map((g) => <tr key={g.name}><td>{g.name}</td><td className="num">{pct(g.actual)}</td><td className="num">{pp(g.period)}</td></tr>)}</tbody></table></div>
            </>
          )}
          {!prev.activities.length && <p className="small muted">{t("The previous snapshot has no activity-level rows (sample history), so progress by discipline is not available.")}</p>}
        </div>
      )}

      <div className="card">
        <div className="card-head"><h2>{t("Saved snapshots")}</h2>
          {list.length > 0 && <button className="btn small danger" onClick={() => setDel(true)}>{t("Delete latest…")}</button>}</div>
        <div className="table-wrap"><table className="t">
          <thead><tr><th>{t("Data date")}</th><th>{t("Weighting")}</th><th className="num">{t("Planned")}</th><th className="num">{t("Actual")}</th><th className="num">{t("Var (pp)")}</th><th className="num">{t("Activities")}</th><th className="num">{t("Completed")}</th><th className="num">{t("In progress")}</th><th className="num">{t("Not started")}</th><th className="num">{t("Delayed")}</th><th className="num">{t("Critical")}</th><th className="num">{t("SPI")}</th><th>{t("Note")}</th><th>{t("Saved")}</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={14} className="muted">{t("No snapshots saved yet.")}</td></tr>}
            {[...list].reverse().map((h) => <tr key={h.dataDate}><td className="nowrap"><b>{fd(h.dataDate)}</b></td><td>{t(h.summary.weighting)}</td><td className="num">{pct(h.summary.planned)}</td><td className="num">{pct(h.summary.actual)}</td><td className="num">{pp(h.summary.variance)}</td>
              <td className="num">{h.summary.activities}</td><td className="num">{h.summary.completed}</td><td className="num">{h.summary.inProgress}</td><td className="num">{h.summary.notStarted}</td><td className="num">{h.summary.delayed ?? ''}</td><td className="num">{h.summary.critical ?? ''}</td>
              <td className="num">{h.summary.spi != null ? h.summary.spi.toFixed(2) : ''}</td><td>{h.summary.note}</td><td className="small">{h.savedAt === 'sample' ? t('sample') : dateTime(h.savedAt)}</td></tr>)}
          </tbody>
        </table></div>
        <p className="small muted">{t("Snapshots cannot be edited. Only the latest one can be deleted, after typing its date; the deletion and a full copy of its data are kept in the project log.")}</p>
      </div>

      <BackupCard />
      {del && list.length > 0 && (
        <AskText title={t("Delete latest snapshot")} danger okLabel={t("Delete snapshot")} label={t('Type {d} to confirm', { d: fd(list[list.length - 1].dataDate) })} confirmWord={fmtDate(list[list.length - 1].dataDate)}
          help={tr('This removes the snapshot for {d} from the history. The deletion (date, time and the deleted data) is recorded in the log, which cannot be erased.', { d: <b>{fd(list[list.length - 1].dataDate)}</b> })}
          onOk={async () => { try { await app.deleteLatest(fmtDate(list[list.length - 1].dataDate)); setMsg({ ok: true, t: t('Latest snapshot deleted and logged.') }); } catch (e) { setMsg({ ok: false, t: (e as Error).message }); } }}
          onClose={() => setDel(false)} />
      )}
    </>
  );
}
