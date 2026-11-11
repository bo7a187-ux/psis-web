import { useMemo } from 'react';
import { useApp } from '../../state';
import { pct, pp, num, tjoin, fd, ltr } from '../common';
import { fmtDate } from '../../core/dates';
import type { CalcRow } from '../../core/engine';
import { summarize, groupTable, baselineCurve, snapshotActual, topDelayed, exceptionList, trendCompletion, NO_FILTER } from '../../core/project';
import { t, tr, getLang } from '../../i18n';

function MiniSCurve({ curve, actual, dd, fc }: { curve: { date: number; planned: number }[]; actual: [number, number][]; dd: number; fc: number | null }) {
  const W = 360, H = 150, L = 30, R = 8, T = 8, B = 20;
  if (!curve.length) return <div className="muted small">{t("No baseline curve available.")}</div>;
  const x0 = curve[0].date, x1 = Math.max(curve[curve.length - 1].date, fc ?? 0);
  const X = (d: number) => L + ((d - x0) / (x1 - x0)) * (W - L - R);
  const Y = (v: number) => T + (1 - v) * (H - T - B);
  const pts = (a: [number, number][]) => a.map(([d, v]) => `${X(d).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t("S-curve: baseline planned, actual and forecast")} style={{ display: 'block', direction: 'ltr' }}>
      {[0, 0.5, 1].map((v) => <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#d7deea" strokeWidth="0.6" /><text x={L - 4} y={Y(v) + 3} fontSize="8" textAnchor="end" fill="#475569">{v * 100}%</text></g>)}
      <polyline fill="none" stroke="#7c93c3" strokeWidth="1.6" points={pts(curve.map((c) => [c.date, c.planned]))} />
      {actual.length > 0 && <polyline fill="none" stroke="#2563eb" strokeWidth="2.2" points={pts(actual)} />}
      {fc != null && actual.length > 0 && <polyline fill="none" stroke="#15803d" strokeWidth="1.4" strokeDasharray="4 3" points={pts([actual[actual.length - 1], [fc, 1]])} />}
      <line x1={X(dd)} x2={X(dd)} y1={T} y2={H - B} stroke="#c2610c" strokeWidth="0.8" strokeDasharray="3 2" />
      <text x={L} y={H - 6} fontSize="8" fill="#475569">{fmtDate(x0)}</text>
      <text x={W - R} y={H - 6} fontSize="8" textAnchor="end" fill="#475569">{fmtDate(x1)}</text>
      <text x={X(dd)} y={T + 8} fontSize="8" textAnchor={X(dd) > W / 2 ? 'end' : 'start'} dx={X(dd) > W / 2 ? -3 : 3} fill="#c2610c">{t("Data date")}</text>
      <g fontSize="8" fill="#334155"><line x1={L + 6} x2={L + 20} y1={H - 30} y2={H - 30} stroke="#7c93c3" strokeWidth="1.6" /><text x={L + 24} y={H - 27}>{t("Planned")}</text>
        <line x1={L + 66} x2={L + 80} y1={H - 30} y2={H - 30} stroke="#2563eb" strokeWidth="2.2" /><text x={L + 84} y={H - 27}>{t("Actual")}</text>
        <line x1={L + 120} x2={L + 134} y1={H - 30} y2={H - 30} stroke="#15803d" strokeDasharray="4 3" /><text x={L + 138} y={H - 27}>{t("Forecast")}</text></g>
    </svg>
  );
}

/** One activity of the critical list as a bar between the data date and the end of the list. */
function CritBar({ r, span }: { r: CalcRow; span: [number, number] }) {
  const [lo, hi] = span, W = 100, len = hi - lo + 1;
  const s = Math.max(lo, r.a.actStart ?? r.a.start ?? lo), f = Math.min(hi, r.fcSel ?? r.a.finish ?? s);
  const x = ((s - lo) / len) * W, w = Math.max(2, ((f - s + 1) / len) * W);
  return (
    <svg viewBox={`0 0 ${W} 8`} width="100%" height="8" preserveAspectRatio="none" style={{ display: 'block', direction: 'ltr' }} aria-hidden="true">
      <rect x="0" y="3.5" width={W} height="1" fill="#e5eaf2" />
      <rect x={x} y="1" width={w} height="6" rx="1.5" fill={r.isMilestone ? '#0b1730' : '#c42b2b'} />
    </svg>
  );
}

export function ReportPage() {
  const app = useApp();
  const { project, rows, history, approval } = app;
  const st = project?.settings;
  const sum = useMemo(() => (rows && st ? summarize(rows, st, NO_FILTER) : null), [rows, st]);
  const curve = useMemo(() => (rows ? baselineCurve(rows, NO_FILTER) : []), [rows]);
  if (!project || !rows || !st || !sum) return <div className="card muted">{t("Import and calculate a schedule first.")}</div>;
  const DD = st.dataDate!;
  const L = project.classification.lists;
  const disc = groupTable(rows, NO_FILTER, 'discipline', L.discipline, false);
  const top = topDelayed(rows, NO_FILTER, 10);
  const crit = exceptionList(rows, st, NO_FILTER, 'Critical path (by forecast finish)').slice(0, 6);
  // time window of the small bars: data date to the last forecast finish of the listed activities
  const critEnd = crit.reduce<number | null>((m, r) => { const f = r.fcSel ?? r.a.finish; return f != null && (m == null || f > m) ? f : m; }, null);
  const critSpan: [number, number] | null = critEnd != null && critEnd > DD ? [DD, critEnd] : null;
  const trend = trendCompletion(sum.actual, DD, history, NO_FILTER);
  const es = sum.es;
  const prior = history.filter((h) => h.dataDate < DD).sort((a, b) => a.dataDate - b.dataDate);
  const actual: [number, number][] = [...prior.map((h) => [h.dataDate, snapshotActual(h, NO_FILTER)] as [number, number | null]).filter((p): p is [number, number] => p[1] != null), ...(sum.actual != null ? [[DD, sum.actual] as [number, number]] : [])];
  const dd = (x: number | null) => (x == null ? '-' : fd(x));
  const days = (a: number | null, b: number | null) => (a != null && b != null ? `${a - b > 0 ? '+' : ''}${ltr(String(a - b))} ${t('d')}` : '');
  const ok = approval === 'APPROVED';
  const tone = sum.health === 'RED' ? 'red' : sum.health === 'AMBER' ? 'amber' : 'green';

  return (
    <>
      <div className="no-print page-head">
        <div>
          <h1>{t("Monthly report")}</h1>
          <p className="muted">{tr('One A4 page for management. Click {btn}, then choose "Save as PDF" as the printer. Turn off "Headers and footers" in the print dialog for a clean page.', { btn: <b>{t('Save as PDF')}</b> })}</p>
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => window.print()}>{t("Save as PDF / Print")}</button>
        </div>
      </div>
      {!ok && <div className="notice warn no-print">{t('This report is a DRAFT because the data is not approved ({s}). The PDF will carry a red "DRAFT - NOT APPROVED" banner.', { s: t(approval) })}</div>}

      <article className="report" id="monthly-report">
        <header className="rp-head">
          <div><h1>{st.projectTitle || project.name}</h1><div className="rp-sub">{t("Executive monthly report · whole project")}</div></div>
          <div className={`rp-status ${ok ? 'ok' : 'draft'}`}>{ok ? `${t('DATA APPROVED')} · ${project.approval?.reviewer} · ${fd(Math.floor(new Date(project.approval!.approvedAt).getTime() / 86400000) + 25569)}` : t('DRAFT - NOT APPROVED')}</div>
        </header>
        <div className="rp-strip">
          <span><i>{t("Report date")}</i>{fd(DD)}</span><span><i>{t("Baseline")}</i>{t(st.baselineUse)}{st.baselineUse === 'Revised (saved)' ? ` (${st.revisionUse || t('latest')})` : ''}</span><span><i>{t("Weighting")}</i>{t(st.weightMethod)}</span>
          <span><i>{t("Actual % source")}</i>{t(st.actualSource)}</span><span><i>{t("Planned %")}</i>{t(st.plannedMethod.startsWith('Linear') ? 'Linear (assumption)' : 'P6 Schedule %')}</span><span><i>{t("Forecast method")}</i>{t(st.forecastMethod.split(' (')[0])}</span>
        </div>

        <div className="rp-kpis">
          <div><i>{t("Planned")}</i><b>{pct(sum.planned)}</b></div>
          <div><i>{t("Actual")}</i><b>{pct(sum.actual)}</b></div>
          <div><i>{t("Variance")}</i><b>{pp(sum.variance)}</b></div>
          <div><i>{t("SPI (EV/PV)")}</i><b>{sum.spi != null ? sum.spi.toFixed(2) : t('N/A')}</b>{sum.spi == null && <small>{t(sum.spiReason)}</small>}{es && <small>{ltr(`SPI(t) ${es.spiT.toFixed(2)}`)}</small>}</div>
          <div className={`h-${tone}`}><i>{t("Project health")}</i><b>{t(sum.health)}</b></div>
          <div><i>{t("Forecast finish")}</i><b>{dd(sum.forecastFinish)}</b><small>{sum.delayDays == null ? '' : sum.delayDays > 0 ? t('{n} days late', { n: sum.delayDays }) : sum.delayDays < 0 ? t('{n} days early', { n: -sum.delayDays }) : t('on baseline')}</small></div>
          <div><i>{t("Activities")}</i><b>{sum.total}</b><small>{t('{a} done · {b} in progress · {c} not started', { a: sum.completed, b: sum.inProgress, c: sum.notStarted })}</small></div>
          <div><i>{t("Delayed / critical")}</i><b>{sum.delayed} / {sum.critical}</b><small>{t('{n} with negative float', { n: sum.negFloat })}</small></div>
        </div>
        <p className="rp-reasons"><b>{t('Health:')}</b> {sum.healthReasons.length ? tjoin(sum.healthReasons, '؛ ') : t('all criteria within limits')}. {tr('{te} {a} vs {pr} {b}', { te: <b>{t('Time elapsed')}</b>, a: pct(sum.timeElapsed), pr: <b>{t('progress')}</b>, b: pct(sum.actual) })}{sum.critPlanned != null && <> · {tr('{cp} planned {a} / actual {b}', { cp: <b>{t('Critical path')}</b>, a: pct(sum.critPlanned), b: pct(sum.critActual) })}</>}.</p>

        <div className="rp-cols">
          <section>
            <h2>{t("Finish dates and delay")}</h2>
            <table className="rp-t dates"><thead><tr><th>{t("Date")}</th><th>{t("Finish")}</th><th>{t("vs baseline")}</th><th>{t("Source")}</th></tr></thead><tbody>
              <tr><td>{t("Baseline finish (used)")}</td><td>{dd(sum.blFinish)}</td><td /><td>{t(st.baselineUse)}</td></tr>
              <tr><td>{t("Original baseline")}</td><td>{sum.origFinish ? dd(sum.origFinish) : t('not saved')}</td><td>{days(sum.forecastFinish, sum.origFinish)}</td><td>{t("forecast vs original")}</td></tr>
              <tr><td>{t("Revised baseline")}</td><td>{sum.revFinish ? dd(sum.revFinish) : t('not saved')}</td><td>{days(sum.forecastFinish, sum.revFinish)}</td><td>{t("forecast vs revised")}</td></tr>
              <tr><td>{t("Forecast - P6 Current Finish")}</td><td>{dd(sum.forecastP6)}</td><td>{days(sum.forecastP6, sum.blFinish)}</td><td>{t("P6 CPM dates")}</td></tr>
              <tr><td>{t("Forecast - Performance")}</td><td>{dd(sum.forecastPerf)}</td><td>{days(sum.forecastPerf, sum.blFinish)}</td><td>{t("actual progress rate")}</td></tr>
              <tr><td>{t("Forecast - Conservative")}</td><td>{dd(sum.forecastCons)}</td><td>{days(sum.forecastCons, sum.blFinish)}</td><td>{t("later of P6 / performance")}</td></tr>
              <tr className="sel"><td><b>{t("Forecast - selected")}</b></td><td><b>{dd(sum.forecastFinish)}</b></td><td><b>{days(sum.forecastFinish, sum.blFinish)}</b></td><td>{t(st.forecastMethod.split(' (')[0])}</td></tr>
              <tr className="ind"><td>{t("Trend completion")}{' '}<em>{t("(indicative only)")}</em></td><td>{trend.date ? dd(trend.date) : '-'}</td><td /><td>{trend.date ? t('recent progress rate; not in health') : t(trend.reason)}</td></tr>
            </tbody></table>
          </section>
          <section>
            <h2>{t("S-curve")}</h2>
            <MiniSCurve curve={curve} actual={actual} dd={DD} fc={sum.forecastFinish != null && sum.forecastFinish > DD ? sum.forecastFinish : null} />
          </section>
        </div>

        <div className="rp-cols">
          <section>
            <h2>{t("Progress by discipline")}</h2>
            <table className="rp-t"><thead><tr><th>{t("Discipline")}</th><th className="n">{t("Weight")}</th><th className="n">{t("Planned")}</th><th className="n">{t("Actual")}</th><th className="n">{t("Var (pp)")}</th><th className="n">{t("Delayed")}</th></tr></thead><tbody>
              {disc.map((g) => <tr key={g.name}><td>{g.name}</td><td className="n">{pct(g.weightShare, 0)}</td><td className="n">{pct(g.planned)}</td><td className="n">{pct(g.actual)}</td><td className={`n ${(g.variance ?? 0) < -0.1 ? 'neg2' : (g.variance ?? 0) < -0.05 ? 'neg1' : ''}`}>{pp(g.variance)}</td><td className="n">{g.delayed}</td></tr>)}
            </tbody></table>
          </section>
          <section>
            <h2>{t("Next critical activities")}</h2>
            <table className="rp-t"><thead><tr><th>{t("Activity")}</th><th>{t("Forecast")}</th><th className="n">{t("TF (d)")}</th><th className="n">{t("Actual")}</th><th className="rp-tl">{critSpan && <span className="rp-tl-h">{dd(critSpan[0])} {getLang() === 'ar' ? '←' : '→'} {dd(critSpan[1])}</span>}</th></tr></thead><tbody>
              {crit.length === 0 && <tr><td colSpan={5}>{t("No open critical activities.")}</td></tr>}
              {crit.map((r) => <tr key={r.a.row}><td>{r.a.id} {r.a.name}</td><td>{dd(r.fcSel)}</td><td className="n">{num(r.tfDays, 0)}</td><td className="n">{pct(r.actual, 0)}</td><td className="rp-tl">{critSpan && <CritBar r={r} span={critSpan} />}</td></tr>)}
            </tbody></table>
          </section>
        </div>

        <section>
          <h2>{t("Top 10 delayed activities")}</h2>
          <table className="rp-t"><thead><tr><th>{t("Activity")}</th><th className="n">{t("Planned")}</th><th className="n">{t("Actual")}</th><th className="n">{t("Var (pp)")}</th><th>{t("BL finish")}</th><th>{t("Forecast")}</th><th className="n">{t("Delay (d)")}</th><th>{t("Indicator")}</th></tr></thead><tbody>
            {top.length === 0 && <tr><td colSpan={8}>{t("No delayed activities.")}</td></tr>}
            {top.map((r) => <tr key={r.a.row}><td>{r.a.id} {r.a.name}</td><td className="n">{pct(r.planned, 0)}</td><td className="n">{pct(r.actual, 0)}</td><td className="n">{pp(r.variance, 0)}</td><td>{dd(r.blFinish)}</td><td>{dd(r.fcSel)}</td><td className="n">{Math.max(0, r.finishVarUsed ?? 0)}</td><td>{t(r.delayIndicator)}</td></tr>)}
          </tbody></table>
        </section>

        <section className="rp-comments">
          <h2>{t("Comments")}</h2>
          <textarea className="no-print" rows={3} value={project.reportComment ?? ''} placeholder={t("Management comments (kept with the project; printed in the PDF)…")} onChange={(e) => app.updateProject({ reportComment: e.target.value })} />
          <div className="print-only rp-comment-text">{project.reportComment || ' '}</div>
        </section>
        <footer className="rp-foot">{t('Variance is in percentage points (actual − planned %); delay is in calendar days (forecast − baseline finish). Planned % is a straight-line distribution between baseline dates (an assumption).')} {t('Generated {d} from approved project data.', { d: fd(Math.floor(Date.now() / 86400000) + 25569) })}</footer>
      </article>
    </>
  );
}
