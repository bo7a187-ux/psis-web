import { useMemo } from 'react';
import { useApp } from '../../state';
import { pct, pp, num } from '../common';
import { fmtDate } from '../../core/dates';
import { summarize, groupTable, baselineCurve, snapshotActual, topDelayed, exceptionList, trendCompletion, NO_FILTER } from '../../core/project';

function MiniSCurve({ curve, actual, dd, fc }: { curve: { date: number; planned: number }[]; actual: [number, number][]; dd: number; fc: number | null }) {
  const W = 360, H = 150, L = 30, R = 8, T = 8, B = 20;
  if (!curve.length) return <div className="muted small">No baseline curve available.</div>;
  const x0 = curve[0].date, x1 = Math.max(curve[curve.length - 1].date, fc ?? 0);
  const X = (d: number) => L + ((d - x0) / (x1 - x0)) * (W - L - R);
  const Y = (v: number) => T + (1 - v) * (H - T - B);
  const pts = (a: [number, number][]) => a.map(([d, v]) => `${X(d).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="S-curve: baseline planned, actual and forecast" style={{ display: 'block' }}>
      {[0, 0.5, 1].map((v) => <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#d7deea" strokeWidth="0.6" /><text x={L - 4} y={Y(v) + 3} fontSize="8" textAnchor="end" fill="#475569">{v * 100}%</text></g>)}
      <polyline fill="none" stroke="#7c93c3" strokeWidth="1.6" points={pts(curve.map((c) => [c.date, c.planned]))} />
      {actual.length > 0 && <polyline fill="none" stroke="#2563eb" strokeWidth="2.2" points={pts(actual)} />}
      {fc != null && actual.length > 0 && <polyline fill="none" stroke="#15803d" strokeWidth="1.4" strokeDasharray="4 3" points={pts([actual[actual.length - 1], [fc, 1]])} />}
      <line x1={X(dd)} x2={X(dd)} y1={T} y2={H - B} stroke="#c2610c" strokeWidth="0.8" strokeDasharray="3 2" />
      <text x={L} y={H - 6} fontSize="8" fill="#475569">{fmtDate(x0)}</text>
      <text x={W - R} y={H - 6} fontSize="8" textAnchor="end" fill="#475569">{fmtDate(x1)}</text>
      <text x={X(dd)} y={T + 8} fontSize="8" textAnchor={X(dd) > W / 2 ? 'end' : 'start'} dx={X(dd) > W / 2 ? -3 : 3} fill="#c2610c">Data date</text>
      <g fontSize="8" fill="#334155"><line x1={L + 6} x2={L + 20} y1={H - 30} y2={H - 30} stroke="#7c93c3" strokeWidth="1.6" /><text x={L + 24} y={H - 27}>Planned</text>
        <line x1={L + 66} x2={L + 80} y1={H - 30} y2={H - 30} stroke="#2563eb" strokeWidth="2.2" /><text x={L + 84} y={H - 27}>Actual</text>
        <line x1={L + 120} x2={L + 134} y1={H - 30} y2={H - 30} stroke="#15803d" strokeDasharray="4 3" /><text x={L + 138} y={H - 27}>Forecast</text></g>
    </svg>
  );
}

export function ReportPage() {
  const app = useApp();
  const { project, rows, history, approval } = app;
  const st = project?.settings;
  const sum = useMemo(() => (rows && st ? summarize(rows, st, NO_FILTER) : null), [rows, st]);
  const curve = useMemo(() => (rows ? baselineCurve(rows, NO_FILTER) : []), [rows]);
  if (!project || !rows || !st || !sum) return <div className="card muted">Import and calculate a schedule first.</div>;
  const DD = st.dataDate!;
  const L = project.classification.lists;
  const disc = groupTable(rows, NO_FILTER, 'discipline', L.discipline, false);
  const top = topDelayed(rows, NO_FILTER, 10);
  const crit = exceptionList(rows, st, NO_FILTER, 'Critical path (by forecast finish)').slice(0, 6);
  const trend = trendCompletion(sum.actual, DD, history, NO_FILTER);
  const prior = history.filter((h) => h.dataDate < DD).sort((a, b) => a.dataDate - b.dataDate);
  const actual: [number, number][] = [...prior.map((h) => [h.dataDate, snapshotActual(h, NO_FILTER)] as [number, number | null]).filter((p): p is [number, number] => p[1] != null), ...(sum.actual != null ? [[DD, sum.actual] as [number, number]] : [])];
  const dd = (x: number | null) => (x == null ? '-' : fmtDate(x));
  const days = (a: number | null, b: number | null) => (a != null && b != null ? `${a - b > 0 ? '+' : ''}${a - b} d` : '');
  const ok = approval === 'APPROVED';
  const tone = sum.health === 'RED' ? 'red' : sum.health === 'AMBER' ? 'amber' : 'green';

  return (
    <>
      <div className="no-print page-head">
        <div>
          <h1>Monthly report</h1>
          <p className="muted">One A4 page for management. Click <b>Save as PDF</b>, then choose "Save as PDF" as the printer. Turn off "Headers and footers" in the print dialog for a clean page.</p>
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => window.print()}>Save as PDF / Print</button>
        </div>
      </div>
      {!ok && <div className="notice warn no-print">This report is a DRAFT because the data is not approved ({approval}). The PDF will carry a red "DRAFT - NOT APPROVED" banner.</div>}

      <article className="report" id="monthly-report">
        <header className="rp-head">
          <div><h1>{st.projectTitle || project.name}</h1><div className="rp-sub">Executive monthly report · whole project</div></div>
          <div className={`rp-status ${ok ? 'ok' : 'draft'}`}>{ok ? `DATA APPROVED · ${project.approval?.reviewer} · ${fmtDate(Math.floor(new Date(project.approval!.approvedAt).getTime() / 86400000) + 25569)}` : 'DRAFT - NOT APPROVED'}</div>
        </header>
        <div className="rp-strip">
          <span><i>Report date</i>{fmtDate(DD)}</span><span><i>Baseline</i>{st.baselineUse}{st.baselineUse === 'Revised (saved)' ? ` (${st.revisionUse || 'latest'})` : ''}</span><span><i>Weighting</i>{st.weightMethod}</span>
          <span><i>Actual % source</i>{st.actualSource}</span><span><i>Planned %</i>{st.plannedMethod.startsWith('Linear') ? 'Linear (assumption)' : 'P6 Schedule %'}</span><span><i>Forecast method</i>{st.forecastMethod.split(' (')[0]}</span>
        </div>

        <div className="rp-kpis">
          <div><i>Planned</i><b>{pct(sum.planned)}</b></div>
          <div><i>Actual</i><b>{pct(sum.actual)}</b></div>
          <div><i>Variance</i><b>{pp(sum.variance)}</b></div>
          <div><i>SPI (EV/PV)</i><b>{sum.spi != null ? sum.spi.toFixed(2) : 'N/A'}</b>{sum.spi == null && <small>{sum.spiReason}</small>}</div>
          <div className={`h-${tone}`}><i>Project health</i><b>{sum.health}</b></div>
          <div><i>Forecast finish</i><b>{dd(sum.forecastFinish)}</b><small>{sum.delayDays == null ? '' : `${sum.delayDays > 0 ? sum.delayDays + ' days late' : sum.delayDays < 0 ? -sum.delayDays + ' days early' : 'on baseline'}`}</small></div>
          <div><i>Activities</i><b>{sum.total}</b><small>{sum.completed} done · {sum.inProgress} in progress · {sum.notStarted} not started</small></div>
          <div><i>Delayed / critical</i><b>{sum.delayed} / {sum.critical}</b><small>{sum.negFloat} with negative float</small></div>
        </div>
        <p className="rp-reasons"><b>Health:</b> {sum.healthReasons.length ? sum.healthReasons.join('; ') : 'all criteria within limits'}. <b>Time elapsed</b> {pct(sum.timeElapsed)} vs <b>progress</b> {pct(sum.actual)}{sum.critPlanned != null && <> · <b>Critical path</b> planned {pct(sum.critPlanned)} / actual {pct(sum.critActual)}</>}.</p>

        <div className="rp-cols">
          <section>
            <h2>Finish dates and delay</h2>
            <table className="rp-t dates"><thead><tr><th>Date</th><th>Finish</th><th>vs baseline</th><th>Source</th></tr></thead><tbody>
              <tr><td>Baseline finish (used)</td><td>{dd(sum.blFinish)}</td><td /><td>{st.baselineUse}</td></tr>
              <tr><td>Original baseline</td><td>{sum.origFinish ? dd(sum.origFinish) : 'not saved'}</td><td>{days(sum.forecastFinish, sum.origFinish)}</td><td>forecast vs original</td></tr>
              <tr><td>Revised baseline</td><td>{sum.revFinish ? dd(sum.revFinish) : 'not saved'}</td><td>{days(sum.forecastFinish, sum.revFinish)}</td><td>forecast vs revised</td></tr>
              <tr><td>Forecast - P6 Current Finish</td><td>{dd(sum.forecastP6)}</td><td>{days(sum.forecastP6, sum.blFinish)}</td><td>P6 CPM dates</td></tr>
              <tr><td>Forecast - Performance</td><td>{dd(sum.forecastPerf)}</td><td>{days(sum.forecastPerf, sum.blFinish)}</td><td>actual progress rate</td></tr>
              <tr><td>Forecast - Conservative</td><td>{dd(sum.forecastCons)}</td><td>{days(sum.forecastCons, sum.blFinish)}</td><td>later of P6 / performance</td></tr>
              <tr className="sel"><td><b>Forecast - selected</b></td><td><b>{dd(sum.forecastFinish)}</b></td><td><b>{days(sum.forecastFinish, sum.blFinish)}</b></td><td>{st.forecastMethod.split(' (')[0]}</td></tr>
              <tr className="ind"><td>Trend completion <em>(indicative only)</em></td><td>{trend.date ? dd(trend.date) : '-'}</td><td /><td>{trend.date ? 'recent progress rate; not in health' : trend.reason}</td></tr>
            </tbody></table>
          </section>
          <section>
            <h2>S-curve</h2>
            <MiniSCurve curve={curve} actual={actual} dd={DD} fc={sum.forecastFinish != null && sum.forecastFinish > DD ? sum.forecastFinish : null} />
          </section>
        </div>

        <div className="rp-cols">
          <section>
            <h2>Progress by discipline</h2>
            <table className="rp-t"><thead><tr><th>Discipline</th><th className="n">Weight</th><th className="n">Planned</th><th className="n">Actual</th><th className="n">Var (pp)</th><th className="n">Delayed</th></tr></thead><tbody>
              {disc.map((g) => <tr key={g.name}><td>{g.name}</td><td className="n">{pct(g.weightShare, 0)}</td><td className="n">{pct(g.planned)}</td><td className="n">{pct(g.actual)}</td><td className={`n ${(g.variance ?? 0) < -0.1 ? 'neg2' : (g.variance ?? 0) < -0.05 ? 'neg1' : ''}`}>{pp(g.variance)}</td><td className="n">{g.delayed}</td></tr>)}
            </tbody></table>
          </section>
          <section>
            <h2>Next critical activities</h2>
            <table className="rp-t"><thead><tr><th>Activity</th><th>Forecast</th><th className="n">TF (d)</th><th className="n">Actual</th></tr></thead><tbody>
              {crit.length === 0 && <tr><td colSpan={4}>No open critical activities.</td></tr>}
              {crit.map((r) => <tr key={r.a.row}><td>{r.a.id} {r.a.name}</td><td>{dd(r.fcSel)}</td><td className="n">{num(r.tfDays, 0)}</td><td className="n">{pct(r.actual, 0)}</td></tr>)}
            </tbody></table>
          </section>
        </div>

        <section>
          <h2>Top 10 delayed activities</h2>
          <table className="rp-t"><thead><tr><th>Activity</th><th className="n">Planned</th><th className="n">Actual</th><th className="n">Var (pp)</th><th>BL finish</th><th>Forecast</th><th className="n">Delay (d)</th><th>Indicator</th></tr></thead><tbody>
            {top.length === 0 && <tr><td colSpan={8}>No delayed activities.</td></tr>}
            {top.map((r) => <tr key={r.a.row}><td>{r.a.id} {r.a.name}</td><td className="n">{pct(r.planned, 0)}</td><td className="n">{pct(r.actual, 0)}</td><td className="n">{pp(r.variance, 0)}</td><td>{dd(r.blFinish)}</td><td>{dd(r.fcSel)}</td><td className="n">{Math.max(0, r.finishVarUsed ?? 0)}</td><td>{r.delayIndicator}</td></tr>)}
          </tbody></table>
        </section>

        <section className="rp-comments">
          <h2>Comments</h2>
          <textarea className="no-print" rows={3} value={project.reportComment ?? ''} placeholder="Management comments (kept with the project; printed in the PDF)…" onChange={(e) => app.updateProject({ reportComment: e.target.value })} />
          <div className="print-only rp-comment-text">{project.reportComment || ' '}</div>
        </section>
        <footer className="rp-foot">Variance is in percentage points (actual − planned %); delay is in calendar days (forecast − baseline finish). Planned % is a straight-line distribution between baseline dates (an assumption). Generated {fmtDate(Math.floor(Date.now() / 86400000) + 25569)} from approved project data.</footer>
      </article>
    </>
  );
}
