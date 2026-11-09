import { useMemo, useState } from 'react';
import { useApp } from '../../state';
import { PageHead, Stat, pct, pp, num, dateTime } from '../common';
import { fmtDate } from '../../core/dates';
import { groupTable, exceptionList, EXCEPTION_TYPES, NO_FILTER, type ExceptionType } from '../../core/project';
import { DIMENSIONS, DIM_LABEL } from '../../core/classify';

export function ResultsPage() {
  const app = useApp();
  const { project, summary: s, rows, report, liveFingerprint, approval } = app;
  const [reviewer, setReviewer] = useState('');
  const [note, setNote] = useState('');
  const [exc, setExc] = useState<ExceptionType>('Late finish forecast (days)');
  const exRows = useMemo(() => (rows && project ? exceptionList(rows, project.settings, NO_FILTER, exc) : []), [rows, project, exc]);
  if (!project) return null;
  if (!s || !rows || !report) return <><PageHead title="Approve & results" /><div className="card muted">{app.calcError ?? 'Import a file first.'}</div></>;
  const st = project.settings;
  const tone = approval === 'APPROVED' ? 'good' : approval === 'BLOCKED' ? 'bad' : 'warn';

  return (
    <>
      <PageHead title="Approve & results">
        <p>Review the calculated figures, then approve the import. Approval stores a fingerprint of every value and setting used; any later change returns all reports to DRAFT. The dashboards (stage 3) are built on exactly these figures.</p>
      </PageHead>

      <div className="card">
        <div className="card-head"><h2>Import approval</h2><span className={`badge ${tone === 'good' ? 'ok' : tone === 'bad' ? 'critical' : 'draft'}`}>{approval}</span></div>
        {approval === 'BLOCKED' && <div className="notice bad">{report.criticalCount} critical issue(s) must be fixed first - see <button className="link-btn" onClick={() => app.setPage('validation')}>Validation</button>.</div>}
        {approval === 'CHANGED SINCE APPROVAL' && <div className="notice warn">The data or a setting changed after approval on {dateTime(project.approval!.approvedAt)} by {project.approval!.reviewer}. Review and approve again.</div>}
        {approval === 'APPROVED' && project.approval && (
          <div className="notice good">Approved by <b>{project.approval.reviewer}</b> on {dateTime(project.approval.approvedAt)}{project.approval.note && <> - "{project.approval.note}"</>}. The live data still matches the approved fingerprint.</div>
        )}
        <div className="small muted" style={{ margin: '6px 0' }}>Live fingerprint: <span className="mono">{liveFingerprint?.slice(0, 32)}…</span>{project.approval && <> · approved: <span className="mono">{project.approval.fingerprint.slice(0, 32)}…</span></>}</div>
        {approval !== 'APPROVED' && approval !== 'BLOCKED' && (
          <form className="row" style={{ marginTop: 8, alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); if (reviewer.trim()) app.approve(reviewer.trim(), note.trim()); }}>
            <div className="field"><label htmlFor="rev">Reviewed by</label><input id="rev" type="text" value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name" /></div>
            <div className="field" style={{ flex: 1, minWidth: 220 }}><label htmlFor="note">Note (optional)</label><input id="note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. checked against P6 layout" /></div>
            <button className="btn primary" disabled={!reviewer.trim()}>Approve this import</button>
          </form>
        )}
        {project.approval && <div style={{ marginTop: 8 }}><button className="btn small" onClick={() => app.revokeApproval()}>Withdraw approval</button></div>}
      </div>

      <div className="notice info small">
        Data date <b>{fmtDate(st.dataDate)}</b> · Baseline <b>{st.baselineUse}</b> · Weighting <b>{st.weightMethod}</b> · Planned <b>{st.plannedMethod}</b> · Actual <b>{st.actualSource}</b> · Forecast <b>{st.forecastMethod}</b>
      </div>

      <div className="grid3">
        <Stat k="Planned progress" v={pct(s.planned)} />
        <Stat k="Actual progress" v={pct(s.actual)} />
        <Stat k="Schedule variance" v={pp(s.variance)} tone={(s.variance ?? 0) < -st.amberPP ? 'warn' : undefined} sub="percentage points vs plan" />
        <Stat k="SPI (EV / PV)" v={s.spi != null ? s.spi.toFixed(2) : 'N/A'} sub={s.spi != null ? `EV ${num(s.ev)} · PV ${num(s.pv)}` : s.spiReason} />
        <Stat k="Project health" v={s.health} tone={s.health === 'RED' ? 'bad' : s.health === 'AMBER' ? 'warn' : 'good'} sub={s.healthReasons.join('; ') || 'All health criteria within limits'} />
        <Stat k="Forecast finish (selected)" v={fmtDate(s.forecastFinish)} sub={s.delayDays != null ? `${s.delayDays > 0 ? s.delayDays + ' days late' : s.delayDays < 0 ? -s.delayDays + ' days early' : 'on'} vs baseline ${fmtDate(s.blFinish)}` : ''} />
      </div>
      <div className="grid3" style={{ marginTop: 12 }}>
        <Stat k="Activities (included)" v={s.total} />
        <Stat k="Completed" v={s.completed} />
        <Stat k="In progress" v={s.inProgress} />
        <Stat k="Not started" v={s.notStarted} />
        <Stat k="Delayed" v={s.delayed} tone={s.delayed ? 'warn' : undefined} sub="behind or late" />
        <Stat k="Critical (open)" v={s.critical} sub={`${s.negFloat} with negative float`} />
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Finish dates</h2>
          <table className="t"><tbody>
            <tr><td>Baseline finish (used)</td><td className="num">{fmtDate(s.blFinish)}</td><td /></tr>
            <tr><td>Original baseline finish</td><td className="num">{fmtDate(s.origFinish) || 'not saved'}</td><td className="num">{s.delayVsOrig != null && `${s.delayVsOrig} d`}</td></tr>
            <tr><td>Revised baseline finish</td><td className="num">{fmtDate(s.revFinish) || 'not saved'}</td><td className="num">{s.delayVsRev != null && `${s.delayVsRev} d`}</td></tr>
            <tr><td>Forecast - P6 Current Finish</td><td className="num">{fmtDate(s.forecastP6)}</td><td className="num">{s.forecastP6 && s.blFinish ? `${s.forecastP6 - s.blFinish} d` : ''}</td></tr>
            <tr><td>Forecast - Performance-based</td><td className="num">{fmtDate(s.forecastPerf)}</td><td className="num">{s.forecastPerf && s.blFinish ? `${s.forecastPerf - s.blFinish} d` : ''}</td></tr>
            <tr><td>Forecast - Conservative</td><td className="num">{fmtDate(s.forecastCons)}</td><td className="num">{s.forecastCons && s.blFinish ? `${s.forecastCons - s.blFinish} d` : ''}</td></tr>
            <tr><td><b>Forecast - selected</b></td><td className="num"><b>{fmtDate(s.forecastFinish)}</b></td><td className="num"><b>{s.delayDays != null && `${s.delayDays} d`}</b></td></tr>
          </tbody></table>
          <p className="small muted">Delay in calendar days (forecast − baseline finish). This is a different measure from the variance in percentage points.</p>
        </div>
        <div className="card">
          <h2>Project-level status</h2>
          <table className="t"><tbody>
            <tr><td>Time elapsed vs baseline</td><td className="num">{pct(s.timeElapsed)}</td></tr>
            <tr><td>Project total float (min of open activities)</td><td className="num">{s.projectFloat != null ? `${num(s.projectFloat, 1)} d` : '-'}</td></tr>
            <tr><td>Critical path progress planned / actual</td><td className="num">{s.critPlanned == null ? 'no open critical work' : `${pct(s.critPlanned)} / ${pct(s.critActual)}`}</td></tr>
            <tr><td>Behind planned progress</td><td className="num">{s.behind}</td></tr>
            <tr><td>Open past baseline finish</td><td className="num">{s.openPastBLF}</td></tr>
            <tr><td>Not started past baseline start</td><td className="num">{s.notStartedPastBLS}</td></tr>
            <tr><td>Low float (open)</td><td className="num">{s.lowFloat}</td></tr>
            <tr><td>Finished late</td><td className="num">{s.finishedLate}</td></tr>
          </tbody></table>
        </div>
      </div>

      <div className="card">
        <h2>Progress by group</h2>
        <div className="grid2">
          {DIMENSIONS.filter((d) => d !== 'location').map((d) => {
            const g = groupTable(rows, NO_FILTER, d, project.classification.lists[d], false);
            return (
              <div key={d} style={{ minWidth: 0 }}>
                <h3 style={{ margin: '6px 0' }}>{DIM_LABEL[d]}</h3>
                <div className="table-wrap"><table className="t">
                  <thead><tr><th>{DIM_LABEL[d]}</th><th className="num">Weight</th><th className="num">Planned</th><th className="num">Actual</th><th className="num">Var (pp)</th><th className="num">Delayed</th><th className="num">Critical</th></tr></thead>
                  <tbody>{g.map((x) => (
                    <tr key={x.name}><td>{x.name}{!x.inList && <span className="badge warning" style={{ marginLeft: 6 }}>not in list</span>}</td><td className="num">{pct(x.weightShare)}</td><td className="num">{pct(x.planned)}</td><td className="num">{pct(x.actual)}</td><td className="num">{pp(x.variance)}</td><td className="num">{x.delayed}</td><td className="num">{x.critical}</td></tr>
                  ))}</tbody>
                </table></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Exception list</h2>
          <select value={exc} onChange={(e) => setExc(e.target.value as ExceptionType)}>{EXCEPTION_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </div>
        <p className="small muted">{exRows.length} activities. "Var (pp)" is percentage points behind plan; "Delay (d)" is calendar days between forecast and baseline finish - an activity can be behind in % and still finish on time, or the reverse.</p>
        <div className="table-wrap tall"><table className="t">
          <thead><tr><th>Activity ID</th><th>Name</th><th className="num">Planned</th><th className="num">Actual</th><th className="num">Var (pp)</th><th>BL finish</th><th>Fc: P6</th><th>Fc: Perf.</th><th>Fc: Cons.</th><th>Source</th><th className="num">Delay (d)</th><th className="num">TF</th><th>Indicator</th></tr></thead>
          <tbody>{exRows.map((r) => (
            <tr key={r.a.row}><td className="nowrap">{r.a.id}</td><td>{r.a.name}</td><td className="num">{pct(r.planned, 0)}</td><td className="num">{pct(r.actual, 0)}</td><td className="num">{pp(r.variance, 0)}</td>
              <td className="nowrap">{fmtDate(r.blFinish)}</td><td className="nowrap">{fmtDate(r.fcP6)}</td><td className="nowrap">{fmtDate(r.fcPerf)}</td><td className="nowrap">{fmtDate(r.fcCons)}</td>
              <td className="small">{r.fcSource}</td><td className="num">{r.finishVarUsed ?? ''}</td><td className="num">{num(r.tfDays, 0)}</td><td className="small">{r.delayIndicator}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}
