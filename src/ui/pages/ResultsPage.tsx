import { useMemo, useState } from 'react';
import { useApp } from '../../state';
import { PageHead, Stat, pct, pp, num, dateTime, delayText, tjoin, fd, ltr, Limited } from '../common';
import { groupTable, exceptionList, EXCEPTION_TYPES, NO_FILTER, type ExceptionType } from '../../core/project';
import { DIMENSIONS, DIM_LABEL } from '../../core/classify';
import { NoBaselineNotice } from '../NoBaselineNotice';
import { t, tr } from '../../i18n';

export function ResultsPage() {
  const app = useApp();
  const { project, summary: s, rows, report, liveFingerprint, approval } = app;
  const [reviewer, setReviewer] = useState('');
  const [note, setNote] = useState('');
  const [exc, setExc] = useState<ExceptionType>('Late finish forecast (days)');
  const exRows = useMemo(() => (rows && project ? exceptionList(rows, project.settings, NO_FILTER, exc) : []), [rows, project, exc]);
  if (!project) return null;
  if (!s || !rows || !report) return <><PageHead step={6} title={t("Approve & results")} /><div className="card muted">{t(app.calcError ?? 'Import a file first.')}</div></>;
  const st = project.settings;
  const es = s.es;
  const tone = approval === 'APPROVED' ? 'good' : approval === 'BLOCKED' ? 'bad' : 'warn';

  return (
    <>
      <PageHead step={6} title={t("Approve & results")}>
        <p>{t("Review the calculated figures, then approve the import. Approval stores a fingerprint of every value and setting used; any later change returns all reports to DRAFT. The dashboards (stage 3) are built on exactly these figures.")}</p>
      </PageHead>
      <NoBaselineNotice />

      <div className="card">
        <div className="card-head"><h2>{t("Import approval")}</h2><span className={`badge ${tone === 'good' ? 'ok' : tone === 'bad' ? 'critical' : 'draft'}`}>{t(approval)}</span></div>
        {approval === 'BLOCKED' && <div className="notice bad">{tr('{n} critical issue(s) must be fixed first - see {page}.', { n: report.criticalCount, page: <button className="link-btn" onClick={() => app.setPage('validation')}>{t('Validation')}</button> })}</div>}
        {approval === 'CHANGED SINCE APPROVAL' && <div className="notice warn">{t('The data or a setting changed after approval on {when} by {who}. Review and approve again.', { when: dateTime(project.approval!.approvedAt), who: project.approval!.reviewer })}</div>}
        {approval === 'APPROVED' && project.approval && (
          <div className="notice good">{tr('Approved by {who} on {when}{note}. The live data still matches the approved fingerprint.', { who: <b>{project.approval.reviewer}</b>, when: dateTime(project.approval.approvedAt), note: project.approval.note ? ` - "${project.approval.note}"` : '' })}</div>
        )}
        <div className="small muted" style={{ margin: '6px 0' }}>{t("Live fingerprint:")}{' '}<span className="mono">{liveFingerprint?.slice(0, 32)}…</span>{project.approval && <> · {t('approved:')} <span className="mono">{project.approval.fingerprint.slice(0, 32)}…</span></>}</div>
        {approval !== 'APPROVED' && approval !== 'BLOCKED' && (
          <form className="row" style={{ marginTop: 8, alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); if (reviewer.trim()) app.approve(reviewer.trim(), note.trim()); }}>
            <div className="field"><label htmlFor="rev">{t("Reviewed by")}</label><input id="rev" type="text" value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder={t("Your name")} /></div>
            <div className="field" style={{ flex: 1, minWidth: 220 }}><label htmlFor="note">{t("Note (optional)")}</label><input id="note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("e.g. checked against P6 layout")} /></div>
            <button className="btn primary" disabled={!reviewer.trim()}>{t("Approve this import")}</button>
          </form>
        )}
        {project.approval && <div style={{ marginTop: 8 }}><button className="btn small" onClick={() => app.revokeApproval()}>{t("Withdraw approval")}</button></div>}
      </div>

      <div className="notice info small">
        <MethodLine st={st} />
      </div>

      <div className="grid3">
        <Stat k={t("Planned progress")} v={pct(s.planned)} />
        <Stat k={t("Actual progress")} v={pct(s.actual)} />
        <Stat k={t("Schedule variance")} v={pp(s.variance)} tone={(s.variance ?? 0) < -st.amberPP ? 'warn' : undefined} sub={t("percentage points vs plan")} />
        <Stat k={t('SPI(t) - earned schedule')} v={es ? es.spiT.toFixed(2) : '-'} sub={es ? t('SV(t) {n} d', { n: ltr(`${es.svT > 0 ? '+' : ''}${es.svT.toFixed(0)}`) }) + ' · ' + t('forecast {d}', { d: fd(es.forecast) }) : ''} />
        <Stat k={t("SPI (EV / PV)")} v={s.spi != null ? s.spi.toFixed(2) : t('N/A')} sub={s.spi != null ? ltr(`EV ${num(s.ev)} · PV ${num(s.pv)}`) : t(s.spiReason)} />
        <Stat k={t("Project health")} v={t(s.health)} tone={s.health === 'RED' ? 'bad' : s.health === 'AMBER' ? 'warn' : 'good'} sub={tjoin(s.healthReasons, '؛ ') || t('All health criteria within limits')} />
        <Stat k={t("Forecast finish (selected)")} v={fd(s.forecastFinish)} sub={delayText(s.delayDays, s.blFinish)} />
      </div>
      <div className="grid3" style={{ marginTop: 12 }}>
        <Stat k={t("Activities (included)")} v={s.total} />
        <Stat k={t("Completed")} v={s.completed} />
        <Stat k={t("In progress")} v={s.inProgress} />
        <Stat k={t("Not started")} v={s.notStarted} />
        <Stat k={t("Delayed")} v={s.delayed} tone={s.delayed ? 'warn' : undefined} sub={t("behind or late")} />
        <Stat k={t("Critical (open)")} v={s.critical} sub={t('{n} with negative float', { n: s.negFloat })} />
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>{t("Finish dates")}</h2>
          <table className="t"><tbody>
            <tr><td>{t("Baseline finish (used)")}</td><td className="num">{fd(s.blFinish)}</td><td /></tr>
            <tr><td>{t("Original baseline finish")}</td><td className="num">{fd(s.origFinish) || t('not saved')}</td><td className="num">{s.delayVsOrig != null && `${ltr(String(s.delayVsOrig))} ${t('d')}`}</td></tr>
            <tr><td>{t("Revised baseline finish")}</td><td className="num">{fd(s.revFinish) || t('not saved')}</td><td className="num">{s.delayVsRev != null && `${ltr(String(s.delayVsRev))} ${t('d')}`}</td></tr>
            <tr><td>{t("Forecast - P6 Current Finish")}</td><td className="num">{fd(s.forecastP6)}</td><td className="num">{s.forecastP6 && s.blFinish ? `${ltr(String(s.forecastP6 - s.blFinish))} ${t('d')}` : ''}</td></tr>
            <tr><td>{t("Forecast - Performance-based")}</td><td className="num">{fd(s.forecastPerf)}</td><td className="num">{s.forecastPerf && s.blFinish ? `${ltr(String(s.forecastPerf - s.blFinish))} ${t('d')}` : ''}</td></tr>
            <tr><td>{t("Forecast - Conservative")}</td><td className="num">{fd(s.forecastCons)}</td><td className="num">{s.forecastCons && s.blFinish ? `${ltr(String(s.forecastCons - s.blFinish))} ${t('d')}` : ''}</td></tr>
            <tr><td><b>{t("Forecast - selected")}</b></td><td className="num"><b>{fd(s.forecastFinish)}</b></td><td className="num"><b>{s.delayDays != null && `${ltr(String(s.delayDays))} ${t('d')}`}</b></td></tr>
          </tbody></table>
          <p className="small muted">{t("Delay in calendar days (forecast − baseline finish). This is a different measure from the variance in percentage points.")}</p>
        </div>
        <div className="card">
          <h2>{t("Project-level status")}</h2>
          <table className="t"><tbody>
            <tr><td>{t("Time elapsed vs baseline")}</td><td className="num">{pct(s.timeElapsed)}</td></tr>
            <tr><td>{t("Project total float (min of open activities)")}</td><td className="num">{s.projectFloat != null ? `${ltr(String(num(s.projectFloat, 1)))} ${t('d')}` : '-'}</td></tr>
            <tr><td>{t("Critical path progress planned / actual")}</td><td className="num">{s.critPlanned == null ? t('no open critical work') : `${pct(s.critPlanned)} / ${pct(s.critActual)}`}</td></tr>
            <tr><td>{t("Behind planned progress")}</td><td className="num">{s.behind}</td></tr>
            <tr><td>{t("Open past baseline finish")}</td><td className="num">{s.openPastBLF}</td></tr>
            <tr><td>{t("Not started past baseline start")}</td><td className="num">{s.notStartedPastBLS}</td></tr>
            <tr><td>{t("Low float (open)")}</td><td className="num">{s.lowFloat}</td></tr>
            <tr><td>{t("Finished late")}</td><td className="num">{s.finishedLate}</td></tr>
          </tbody></table>
        </div>
      </div>

      <div className="card">
        <h2>{t("Progress by group")}</h2>
        <div className="grid2">
          {DIMENSIONS.filter((d) => d !== 'location').map((d) => {
            const g = groupTable(rows, NO_FILTER, d, project.classification.lists[d], false);
            return (
              <div key={d} style={{ minWidth: 0 }}>
                <h3 style={{ margin: '6px 0' }}>{t(DIM_LABEL[d])}</h3>
                <div className="table-wrap"><table className="t">
                  <thead><tr><th>{t(DIM_LABEL[d])}</th><th className="num">{t("Weight")}</th><th className="num">{t("Planned")}</th><th className="num">{t("Actual")}</th><th className="num">{t("Var (pp)")}</th><th className="num">{t("Delayed")}</th><th className="num">{t("Critical")}</th></tr></thead>
                  <tbody>{g.map((x) => (
                    <tr key={x.name}><td>{x.name}{!x.inList && <span className="badge warning" style={{ marginInlineStart: 6 }}>{t("not in list")}</span>}</td><td className="num">{pct(x.weightShare)}</td><td className="num">{pct(x.planned)}</td><td className="num">{pct(x.actual)}</td><td className="num">{pp(x.variance)}</td><td className="num">{x.delayed}</td><td className="num">{x.critical}</td></tr>
                  ))}</tbody>
                </table></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t("Exception list")}</h2>
          <select value={exc} onChange={(e) => setExc(e.target.value as ExceptionType)}>{EXCEPTION_TYPES.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select>
        </div>
        <p className="small muted">{t('{n} activities.', { n: exRows.length })} {t('"Var (pp)" is percentage points behind plan; "Delay (d)" is calendar days between forecast and baseline finish - an activity can be behind in % and still finish on time, or the reverse.')}</p>
        <Limited list={exRows} resetKey={exc}>{(shown, more) => (<div className="table-wrap tall"><table className="t">
          <thead><tr><th>{t("Activity ID")}</th><th>{t("Name")}</th><th className="num">{t("Planned")}</th><th className="num">{t("Actual")}</th><th className="num">{t("Var (pp)")}</th><th>{t("BL finish")}</th><th>{t("Fc: P6")}</th><th>{t("Fc: Perf.")}</th><th>{t("Fc: Cons.")}</th><th>{t("Source")}</th><th className="num">{t("Delay (d)")}</th><th className="num">{t("TF")}</th><th>{t("Indicator")}</th></tr></thead>
          <tbody>{shown.map((r) => (
            <tr key={r.a.row}><td className="nowrap">{r.a.id}</td><td>{r.a.name}</td><td className="num">{pct(r.planned, 0)}</td><td className="num">{pct(r.actual, 0)}</td><td className="num">{pp(r.variance, 0)}</td>
              <td className="nowrap">{fd(r.blFinish)}</td><td className="nowrap">{fd(r.fcP6)}</td><td className="nowrap">{fd(r.fcPerf)}</td><td className="nowrap">{fd(r.fcCons)}</td>
              <td className="small">{t(r.fcSource)}</td><td className="num">{r.finishVarUsed ?? ''}</td><td className="num">{num(r.tfDays, 0)}</td><td className="small">{t(r.delayIndicator)}</td></tr>
          ))}</tbody>
        </table>{more}</div>)}</Limited>
      </div>
    </>
  );
}

/** One line with every method in use (printed with the figures). */
export function MethodLine({ st }: { st: { dataDate: number | null; baselineUse: string; weightMethod: string; plannedMethod: string; actualSource: string; forecastMethod: string } }) {
  return (
    <>
      {t('Data date')} <b>{fd(st.dataDate)}</b> · {t('Baseline')} <b>{t(st.baselineUse)}</b> · {t('Weighting')} <b>{t(st.weightMethod)}</b> · {t('Planned')} <b>{t(st.plannedMethod)}</b> · {t('Actual')} <b>{t(st.actualSource)}</b> · {t('Forecast')} <b>{t(st.forecastMethod)}</b>
    </>
  );
}
