import { useMemo } from 'react';
import { useApp } from '../../state';
import { Chart, C } from '../Chart';
import { FilterBar } from '../FilterBar';
import { pct, pp, num, delayText, tjoin, fd, ltr } from '../common';
import { fmtDate } from '../../core/dates';
import { summarize, groupTable, baselineCurve, trendCompletion, snapshotActual, topDelayed, isUnfiltered } from '../../core/project';
import type { Dimension } from '../../core/classify';
import { t, tr } from '../../i18n';

const axisCommon = { axisLine: { lineStyle: { color: C.grid } }, splitLine: { lineStyle: { color: C.grid } } };
const tone = (h: string) => (h === 'RED' ? 'red' : h === 'AMBER' ? 'amber' : 'green');

export function ExecutiveDashboardPage() {
  const { project, rows, filters, history, approval, setPage } = useApp();
  const st = project?.settings;
  const sum = useMemo(() => (rows && st ? summarize(rows, st, filters) : null), [rows, st, filters]);
  const curve = useMemo(() => (rows ? baselineCurve(rows, filters) : []), [rows, filters]);
  const trend = useMemo(() => (sum && st ? trendCompletion(sum.actual, st.dataDate!, history, filters) : null), [sum, st, history, filters]);
  const es = sum?.es ?? null;
  const delayed = useMemo(() => (rows ? topDelayed(rows, filters, 10) : []), [rows, filters]);
  if (!project || !rows || !st || !sum || !trend) return <div className="card muted">{t("Import and calculate a schedule first.")}</div>;
  const DD = st.dataDate!;
  const title = st.projectTitle || project.name;
  const L = project.classification.lists;
  const prior = history.filter((h) => h.dataDate < DD).sort((a, b) => a.dataDate - b.dataDate);

  const actualPts = prior.map((h) => [h.dataDate, snapshotActual(h, filters)] as [number, number | null]).filter((p) => p[1] != null);
  const scurve = {
    backgroundColor: 'transparent', animation: false, textStyle: { color: C.text },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => (v == null ? '' : `${(v * 100).toFixed(1)}%`), axisPointer: { type: 'line' } },
    legend: { bottom: 0, textStyle: { color: C.text }, data: [t('Baseline planned'), t('Actual'), t('Forecast to finish'), t('Trend (indicative only)')] },
    grid: { left: 8, right: 16, top: 16, bottom: 44, containLabel: true },
    xAxis: { type: 'value', min: curve[0]?.date, max: Math.max(curve[curve.length - 1]?.date ?? DD, sum.forecastFinish ?? 0), axisLabel: { color: C.text, formatter: (v: number) => fmtDate(v) }, axisLine: { lineStyle: { color: C.grid } }, splitLine: { show: false } },
    yAxis: { type: 'value', min: 0, max: 1, axisLabel: { color: C.text, formatter: (v: number) => `${Math.round(v * 100)}%` }, ...axisCommon },
    series: [
      { name: t('Baseline planned'), type: 'line', showSymbol: false, smooth: false, lineStyle: { width: 2, color: C.planned }, itemStyle: { color: C.planned }, data: curve.map((c) => [c.date, c.planned]),
        markLine: { symbol: 'none', silent: true, label: { color: C.text, formatter: t('Data date {d}', { d: fd(DD) }) }, lineStyle: { color: C.amber, type: 'dashed' }, data: [{ xAxis: DD }] } },
      { name: t('Actual'), type: 'line', symbolSize: 6, lineStyle: { width: 3, color: C.actual }, itemStyle: { color: C.actual }, data: [...actualPts, ...(sum.actual != null ? [[DD, sum.actual]] : [])] },
      { name: t('Forecast to finish'), type: 'line', symbol: 'none', lineStyle: { width: 2, type: 'dashed', color: C.green }, itemStyle: { color: C.green },
        data: sum.actual != null && sum.forecastFinish != null && sum.forecastFinish > DD && sum.actual < 1 ? [[DD, sum.actual], [sum.forecastFinish, 1]] : [] },
      { name: t('Trend (indicative only)'), type: 'line', symbol: 'none', lineStyle: { width: 1.5, type: 'dotted', color: '#9ca3af' }, itemStyle: { color: '#9ca3af' },
        data: trend.date != null && sum.actual != null && sum.actual < 1 ? [[DD, sum.actual], [trend.date, 1]] : [] },
    ],
  };

  const bars = (dim: Dimension, hasPrev = false) => {
    const g = groupTable(rows, filters, dim, L[dim], hasPrev);
    return {
      backgroundColor: 'transparent', animation: false, textStyle: { color: C.text },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => (v == null ? t('n/a') : `${(v * 100).toFixed(1)}%`) },
      legend: { bottom: 0, textStyle: { color: C.text } },
      grid: { left: 4, right: 12, top: 8, bottom: 34, containLabel: true },
      xAxis: { type: 'category', data: g.map((x) => x.name), axisLabel: { color: C.text, interval: 0, rotate: g.length > 5 || g.some((x) => x.name.length > 14) ? 25 : 0 }, axisLine: { lineStyle: { color: C.grid } } },
      yAxis: { type: 'value', min: 0, max: 1, axisLabel: { color: C.text, formatter: (v: number) => `${Math.round(v * 100)}%` }, ...axisCommon },
      series: [
        { name: t('Planned'), type: 'bar', itemStyle: { color: C.planned }, data: g.map((x) => x.planned) },
        { name: t('Actual'), type: 'bar', itemStyle: { color: C.actual }, data: g.map((x) => x.actual) },
      ],
    };
  };

  const status = [['Completed', sum.completed, C.green], ['In progress', sum.inProgress, C.actual], ['Not started', sum.notStarted, '#64748b']] as const;
  const statusOpt = {
    backgroundColor: 'transparent', animation: false, textStyle: { color: C.text },
    tooltip: { trigger: 'item' }, legend: { bottom: 0, textStyle: { color: C.text } },
    series: [{ type: 'pie', radius: ['52%', '78%'], center: ['50%', '44%'], label: { color: C.text, formatter: '{c}' }, itemStyle: { borderColor: C.navy, borderWidth: 2 },
      data: status.map(([name, value, color]) => ({ name: t(name), value, itemStyle: { color } })) }],
  };

  // monthly progress: gain per saved period (current period vs last snapshot)
  const periods = [...prior.map((h) => ({ d: h.dataDate, pl: h.summary.planned, ac: snapshotActual(h, filters) })), { d: DD, pl: sum.planned, ac: sum.actual }];
  const gain = (k: 'pl' | 'ac') => periods.map((p, i) => (i === 0 || p[k] == null || periods[i - 1][k] == null ? (i === 0 ? p[k] : null) : p[k]! - periods[i - 1][k]!));
  const monthly = {
    backgroundColor: 'transparent', animation: false, textStyle: { color: C.text },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => (v == null ? t('n/a') : `${(v * 100).toFixed(1)} ${t('pp')}`) },
    legend: { bottom: 0, textStyle: { color: C.text } },
    grid: { left: 4, right: 12, top: 8, bottom: 34, containLabel: true },
    xAxis: { type: 'category', data: periods.map((p) => fmtDate(p.d)), axisLabel: { color: C.text }, axisLine: { lineStyle: { color: C.grid } } },
    yAxis: { type: 'value', axisLabel: { color: C.text, formatter: (v: number) => `${Math.round(v * 100)}` }, ...axisCommon },
    series: [{ name: t('Planned in period'), type: 'bar', itemStyle: { color: C.planned }, data: gain('pl') }, { name: t('Actual in period'), type: 'bar', itemStyle: { color: C.actual }, data: gain('ac') }],
  };

  const filtered = !isUnfiltered(filters);
  return (
    <div className="exec">
      <div className="exec-head">
        <div>
          <h1>{title}</h1>
          <div className="exec-sub">{t('Executive dashboard')}{filtered ? ` · ${t('filtered view')}` : ''}</div>
        </div>
        <div className={`exec-status ${approval === 'APPROVED' ? 'ok' : 'draft'}`}>
          {approval === 'APPROVED' ? <>{t('DATA APPROVED')} · {project.approval?.reviewer}</> : <>{t('DRAFT - NOT APPROVED')} · {t(approval)}</>}
          {approval !== 'APPROVED' && <button className="btn small" onClick={() => setPage('results')}>{t("Review & approve")}</button>}
        </div>
      </div>
      <div className="exec-strip">
        <span><i>{t("Report date")}</i>{fd(DD)}</span><span><i>{t("Baseline")}</i>{t(st.baselineUse)}</span><span><i>{t("Weighting")}</i>{t(st.weightMethod)}</span>
        <span><i>{t("Actual %")}</i>{t(st.actualSource)}</span><span><i>{t("Planned %")}</i>{t(st.plannedMethod.startsWith('Linear') ? 'Linear (assumption)' : 'P6 Schedule %')}</span><span><i>{t("Forecast")}</i>{t(st.forecastMethod.split(' (')[0])}</span>
      </div>
      <FilterBar dark />

      <div className="kpis">
        <div className="kpi"><i>{t("Planned progress")}</i><b>{pct(sum.planned)}</b></div>
        <div className="kpi"><i>{t("Actual progress")}</i><b>{pct(sum.actual)}</b></div>
        <div className={`kpi ${(sum.variance ?? 0) < -st.redPP ? 'red' : (sum.variance ?? 0) < -st.amberPP ? 'amber' : 'green'}`}><i>{t("Schedule variance")}</i><b>{pp(sum.variance)}</b><small>{t("points vs plan")}</small></div>
        <div className={`kpi ${sum.spi == null ? '' : sum.spi < st.redSPI ? 'red' : sum.spi < st.amberSPI ? 'amber' : 'green'}`}><i>{t("SPI (EV / PV)")}</i><b>{sum.spi != null ? sum.spi.toFixed(2) : t('N/A')}</b><small>{sum.spi != null ? ltr(`EV ${num(sum.ev)} · PV ${num(sum.pv)}`) : t(sum.spiReason)}</small>{es && <small>{ltr(`SPI(t) ${es.spiT.toFixed(2)}`)} · {t('SV(t) {n} d', { n: ltr(`${es.svT > 0 ? '+' : ''}${es.svT.toFixed(0)}`) })}</small>}</div>
        <div className={`kpi ${tone(sum.health)}`}><i>{t("Project health")}</i><b>{t(sum.health)}</b><small>{tjoin(sum.healthReasons) || t('All criteria within limits')}</small></div>
        <div className="kpi"><i>{t("Forecast finish")}</i><b>{fd(sum.forecastFinish)}</b><small>{delayText(sum.delayDays, sum.blFinish)}</small></div>
      </div>
      <div className="kpis small">
        {[['Activities', sum.total, ''], ['Completed', sum.completed, 'green'], ['In progress', sum.inProgress, ''], ['Not started', sum.notStarted, ''], ['Delayed', sum.delayed, sum.delayed ? 'amber' : ''], ['Critical (open)', sum.critical, sum.critical ? 'red' : '']].map(([k, v, tn]) => (
          <div key={k as string} className={`kpi ${tn}`}><i>{t(k as string)}</i><b>{v}</b></div>
        ))}
      </div>

      <div className="exec-grid">
        <section className="panel wide"><h3>{t("S-curve: planned vs actual vs forecast")}</h3>
          <Chart option={scurve} height={330} label={t("S-curve of planned, actual and forecast progress")} />
          <p className="note">{t('Planned is the straight-line baseline curve (an assumption). Forecast finish {d} comes from the selected forecast method.', { d: fd(sum.forecastFinish) })}{' '}
            {tr('{trend} (dotted) is indicative only: {value}. It does not feed project health.', { trend: <b>{t('Trend')}</b>, value: trend.date ? t('{d} at the recent progress rate', { d: fd(trend.date) }) : t(trend.reason) })}
            {prior.length === 0 && ` ${t('No monthly history saved yet, so no actual history line.')}`}</p>
        </section>
        <section className="panel"><h3>{t("Activity status")}</h3><Chart option={statusOpt} height={300} label={t("Activity status distribution")} /></section>
        <section className="panel"><h3>{t("Progress by discipline")}</h3><Chart option={bars('discipline')} height={300} label={t("Progress by discipline")} /></section>
        <section className="panel"><h3>{t("Progress by phase")}</h3><Chart option={bars('phase')} height={300} label={t("Progress by phase")} /></section>
        <section className="panel"><h3>{t("Progress by building")}</h3><Chart option={bars('building')} height={300} label={t("Progress by building")} /></section>
        <section className="panel wide"><h3>{t("Monthly progress (points gained per period)")}</h3><Chart option={monthly} height={260} label={t("Monthly progress")} />
          <p className="note">{t("First bar = progress to the first saved date. The last bar is the current period since the latest saved snapshot.")}</p></section>
        <section className="panel wide"><h3>{t("Top 10 delayed activities")}</h3>
          <div className="table-wrap dark"><table className="t">
            <thead><tr><th>{t("Activity")}</th><th className="num">{t("Planned")}</th><th className="num">{t("Actual")}</th><th className="num">{t("Var (pp)")}</th><th>{t("Forecast")}</th><th className="num">{t("Delay (d)")}</th><th>{t("Indicator")}</th></tr></thead>
            <tbody>{delayed.length === 0 && <tr><td colSpan={7}>{t("No delayed activities.")}</td></tr>}
              {delayed.map((r) => <tr key={r.a.row}><td>{r.a.id} {r.a.name}</td><td className="num">{pct(r.planned, 0)}</td><td className="num">{pct(r.actual, 0)}</td><td className="num">{pp(r.variance, 0)}</td><td className="nowrap">{fd(r.fcSel)}</td><td className="num">{Math.max(0, r.finishVarUsed ?? 0)}</td><td>{t(r.delayIndicator)}</td></tr>)}</tbody>
          </table></div>
          <p className="note">{t("Ranked by forecast delay in days, then by days behind plan. \"Var (pp)\" (percentage points) and \"Delay (d)\" (calendar days) are different measures.")}</p>
        </section>
      </div>
    </div>
  );
}
