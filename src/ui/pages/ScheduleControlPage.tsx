import { useMemo, useState } from 'react';
import { getLang } from '../../i18n';
import { fmtDate } from '../../core/dates';
import { useApp } from '../../state';
import { FilterBar } from '../FilterBar';
import { PageHead, Stat, pct, pp, num, tjoin, fd, ltr } from '../common';
import { summarize, groupTable, wbsTable, heatmap, inFilter, trendCompletion, type HeatValue } from '../../core/project';
import { DIM_LABEL, type Dimension } from '../../core/classify';
import { ApprovalBadge } from '../../App';
import { earnedSchedule } from '../../core/earnedSchedule';
import { floatErosion } from '../../core/floatErosion';
import { MethodLine } from './ResultsPage';
import { t } from '../../i18n';

const HEAT_DIMS: Dimension[] = ['floor', 'building', 'phase', 'location'];
const HEAT_VALUES: HeatValue[] = ['Actual %', 'Planned %', 'Variance (pp)'];

function heatColor(v: number, kind: HeatValue): string {
  if (kind === 'Variance (pp)') {
    if (v >= -0.005) return '#d9f2e1';
    if (v >= -0.05) return '#fdeccb';
    if (v >= -0.10) return '#fbd0b0';
    return '#f6b5b5';
  }
  const a = 0.12 + 0.6 * Math.max(0, Math.min(1, v));
  return `rgba(37,99,235,${a.toFixed(2)})`;
}

export function ScheduleControlPage() {
  const { project, rows, filters, history } = useApp();
  const [rowDim, setRowDim] = useState<Dimension>('discipline');
  const [colDim, setColDim] = useState<Dimension>('floor');
  const [hv, setHv] = useState<HeatValue>('Actual %');
  const [q, setQ] = useState('');
  const st = project?.settings;
  const sum = useMemo(() => (rows && st ? summarize(rows, st, filters) : null), [rows, st, filters]);
  if (!project || !rows || !st || !sum) return <div className="card muted">{t("Import and calculate a schedule first.")}</div>;
  const L = project.classification.lists;
  const trend = trendCompletion(sum.actual, st.dataDate!, history, filters);
  const es = earnedSchedule(rows, filters, sum.actual, st.dataDate!);
  const prevSnap = [...history].filter((h) => h.dataDate < st.dataDate!).sort((a, b) => b.dataDate - a.dataDate)[0] ?? null;
  const erosion = floatErosion(rows.filter((r) => inFilter(r, filters)), prevSnap);
  const hm = heatmap(rows, filters, rowDim, L[rowDim], colDim, L[colDim], hv);
  const fmtCell = (v: number | null | undefined) => (v === undefined ? '·' : v == null ? t('n/a') : hv === 'Variance (pp)' ? pp(v) : pct(v));
  const list = rows.filter((r) => inFilter(r, filters)).filter((r) => !q || `${r.a.id} ${r.a.name}`.toLowerCase().includes(q.toLowerCase()));
  const groups: Dimension[] = ['discipline', 'phase', 'building', 'floor'];
  const wbs = wbsTable(rows, filters);
  const dd = (a: number | null) => (a == null ? '-' : fd(a));

  return (
    <>
      <PageHead title={t("Schedule control")} right={<ApprovalBadge />}>
        <p><MethodLine st={st} />. {t('Filters apply to everything on this page.')}</p>
      </PageHead>
      <FilterBar />

      <div className="grid2">
        <div className="card">
          <h2>{t("Project-level status")}</h2>
          <table className="t"><tbody>
            <tr><td>{t("Baseline start / finish (used)")}</td><td className="num">{ltr(`${fmtDate(sum.blStart)} → ${fmtDate(sum.blFinish)}`)}</td></tr>
            <tr><td>{t("Original baseline finish")}</td><td className="num">{sum.origFinish ? fd(sum.origFinish) : t('not saved')}</td></tr>
            <tr><td>{t("Revised baseline finish")}</td><td className="num">{sum.revFinish ? fd(sum.revFinish) : t('not saved')}</td></tr>
            <tr><td>{t("Forecast - P6 / Performance / Conservative")}</td><td className="num">{dd(sum.forecastP6)} / {dd(sum.forecastPerf)} / {dd(sum.forecastCons)}</td></tr>
            <tr><td><b>{t("Forecast - selected")}</b></td><td className="num"><b>{dd(sum.forecastFinish)}</b></td></tr>
            <tr><td>{t("Delay vs baseline used / original / revised (days)")}</td><td className="num">{sum.delayDays ?? '-'} / {sum.delayVsOrig ?? '-'} / {sum.delayVsRev ?? '-'}</td></tr>
            <tr><td>{t("Project total float (open activities, days)")}</td><td className="num">{sum.projectFloat != null ? num(sum.projectFloat, 1) : '-'}</td></tr>
            <tr><td>{t("Time elapsed vs baseline")}</td><td className="num">{pct(sum.timeElapsed)}</td></tr>
            <tr><td>{t("Progress planned / actual")}</td><td className="num">{pct(sum.planned)} / {pct(sum.actual)}</td></tr>
            <tr><td>{t("Critical path progress planned / actual")}</td><td className="num">{sum.critPlanned == null ? t('no open critical work') : `${pct(sum.critPlanned)} / ${pct(sum.critActual)}`}</td></tr>
            <tr><td>{t('SPI(t) - earned schedule')}</td><td className="num">{es ? <b className={es.spiT < st.redSPI ? 'h-red' : es.spiT < st.amberSPI ? 'h-amber' : 'h-green'}>{es.spiT.toFixed(2)}</b> : '-'}</td></tr>
            <tr><td>{t('SV(t) - schedule variance in time (days)')}</td><td className="num">{es ? ltr(`${es.svT > 0 ? '+' : ''}${es.svT.toFixed(1)}`) : '-'}</td></tr>
            <tr><td>{t('Forecast finish - earned schedule')}</td><td className="num">{es ? fd(es.forecast) : '-'}</td></tr>
            <tr><td>{t("Trend completion")}{' '}<span className="badge">{t("indicative only")}</span></td><td className="num">{trend.date ? fd(trend.date) : t(trend.reason)}</td></tr>
            <tr><td>{t("Project health")}</td><td className="num"><span className={`badge ${sum.health === 'RED' ? 'red' : sum.health === 'AMBER' ? 'amber' : 'green'}`}>{t(sum.health)}</span></td></tr>
          </tbody></table>
          <p className="small muted">{sum.healthReasons.length ? t('Reasons: {list}', { list: tjoin(sum.healthReasons, '؛ ') }) : t('All health criteria within limits.')} {t("The trend does not feed health.")}</p>
        </div>
        <div className="card">
          <h2>{t("Schedule exceptions")}</h2>
          <div className="grid3">
            <Stat k={t("Delayed")} v={sum.delayed} tone={sum.delayed ? 'warn' : undefined} />
            <Stat k={t("Behind planned progress")} v={sum.behind} />
            <Stat k={t("Open past BL finish")} v={sum.openPastBLF} />
            <Stat k={t("Not started past BL start")} v={sum.notStartedPastBLS} />
            <Stat k={t("Finished late")} v={sum.finishedLate} />
            <Stat k={t("Critical (open)")} v={sum.critical} tone={sum.critical ? 'bad' : undefined} />
            <Stat k={t("Negative float")} v={sum.negFloat} tone={sum.negFloat ? 'bad' : undefined} />
            <Stat k={t("Low float (open)")} v={sum.lowFloat} />
            <Stat k={t("BL finish changed")} v={sum.blFinishChanged} sub={t("vs previous snapshot")} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>{t('Float erosion since the previous snapshot')}</h2>
        {!erosion ? <p className="muted small">{prevSnap ? t('The previous snapshot was saved before float was recorded. Float erosion is shown from the next saved month.') : t('Save a monthly snapshot: from next month the float of every open activity is compared with this one.')}</p> : (
          <>
            <div className="grid3">
              <Stat k={t('Project total float now')} v={erosion.projectFloatNow != null ? `${num(erosion.projectFloatNow, 1)} ${t('d')}` : '-'} />
              <Stat k={t('At {d}', { d: fd(erosion.prevDate) })} v={erosion.projectFloatPrev != null ? `${num(erosion.projectFloatPrev, 1)} ${t('d')}` : '-'} />
              <Stat k={t('Activities losing float')} v={`${erosion.eroded.length} / ${erosion.compared}`} tone={erosion.eroded.some((x) => x.critical) ? 'bad' : erosion.eroded.length ? 'warn' : 'good'} sub={t('{n} of them critical', { n: erosion.eroded.filter((x) => x.critical).length })} />
            </div>
            {erosion.eroded.length > 0 && (
              <div className="table-wrap" style={{ marginTop: 12, maxHeight: 300 }}><table className="t">
                <thead><tr><th>{t('Activity')}</th><th className="num">{t('Float before (d)')}</th><th className="num">{t('Float now (d)')}</th><th className="num">{t('Change (d)')}</th><th>{t('Critical')}</th></tr></thead>
                <tbody>{erosion.eroded.slice(0, 50).map((x) => <tr key={x.id}><td>{x.id} {x.name}</td><td className="num">{num(x.prev, 1)}</td><td className="num">{num(x.now, 1)}</td><td className={`num ${x.change <= -5 ? 'bad' : 'warn'}`}>{num(x.change, 1)}</td><td>{x.critical ? t('Yes') : ''}</td></tr>)}</tbody>
              </table></div>
            )}
          </>
        )}
        <p className="small muted" style={{ marginTop: 8 }}>{t('A healthy SPI can hide a critical path that is using up its float. Read SPI together with SPI(t) and the float of the driving activities.')}</p>
      </div>

      <div className="grid2">
        {groups.map((d) => {
          const g = groupTable(rows, filters, d, L[d], false);
          return (
            <div className="card" key={d} style={{ minWidth: 0 }}>
              <h2>{t('By {dim}', { dim: t(DIM_LABEL[d]) })}</h2>
              <div className="table-wrap"><table className="t">
                <thead><tr><th>{t(DIM_LABEL[d])}</th><th className="num">{t("Weight")}</th><th className="num">{t("Planned")}</th><th className="num">{t("Actual")}</th><th className="num">{t("Var (pp)")}</th><th className="num">{t("Delayed")}</th><th className="num">{t("Critical")}</th></tr></thead>
                <tbody>{g.map((x) => <tr key={x.name}><td>{x.name}{!x.inList && <span className="badge warning" style={{ marginInlineStart: 6 }}>{t("not in list")}</span>}</td><td className="num">{pct(x.weightShare)}</td><td className="num">{pct(x.planned)}</td><td className="num">{pct(x.actual)}</td><td className={`num ${(x.variance ?? 0) < -0.1 ? 'bad' : (x.variance ?? 0) < -0.05 ? 'warn' : ''}`}>{pp(x.variance)}</td><td className="num">{x.delayed}</td><td className="num">{x.critical}</td></tr>)}</tbody>
              </table></div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t("Heatmap")}</h2>
          <div className="row">
            <label className="row small">{t("Rows")}{' '}<select value={rowDim} onChange={(e) => setRowDim(e.target.value as Dimension)}>{(['discipline', 'phase', 'building', 'floor'] as Dimension[]).map((d) => <option key={d} value={d}>{t(DIM_LABEL[d])}</option>)}</select></label>
            <label className="row small">{t("Columns")}{' '}<select value={colDim} onChange={(e) => setColDim(e.target.value as Dimension)}>{HEAT_DIMS.map((d) => <option key={d} value={d}>{t(DIM_LABEL[d])}</option>)}</select></label>
            <label className="row small">{t("Value")}{' '}<select value={hv} onChange={(e) => setHv(e.target.value as HeatValue)}>{HEAT_VALUES.map((v) => <option key={v} value={v}>{t(v)}</option>)}</select></label>
          </div>
        </div>
        <div className="table-wrap"><table className="heat" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr><th>{t(DIM_LABEL[rowDim])} ↓ / {t(DIM_LABEL[colDim])} {getLang() === 'ar' ? '←' : '→'}</th>{hm.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{hm.rows.map((rn, i) => <tr key={rn}><th style={{ textAlign: 'start' }}>{rn}</th>{hm.cols.map((c, j) => {
            const v = hm.cells[i][j];
            return <td key={c} className={v === undefined ? 'dot' : ''} style={typeof v === 'number' ? { background: heatColor(v, hv) } : undefined}>{fmtCell(v)}</td>;
          })}</tr>)}</tbody>
        </table></div>
        <p className="small muted">{t("\"·\" = no weighted activities in that cell.")}{' '}{hv === 'Variance (pp)' ? 'Green: on plan; orange: behind 0.5-10 pp; red: more than 10 pp behind.' : 'Darker blue = more complete.'} {t("Cells are weighted by the selected weighting method.")}</p>
      </div>

      <div className="card">
        <h2>{t("WBS performance")}</h2>
        <div className="table-wrap tall"><table className="t">
          <thead><tr><th>{t("WBS name")}</th><th className="num">{t("Weight")}</th><th className="num">{t("Planned")}</th><th className="num">{t("Actual")}</th><th className="num">{t("Var (pp)")}</th><th>{t("BL finish")}</th><th>{t("Forecast")}</th><th className="num">{t("Delay (d)")}</th></tr></thead>
          <tbody>{wbs.map((w) => <tr key={w.name}><td>{w.name}</td><td className="num">{pct(w.weightShare)}</td><td className="num">{pct(w.planned)}</td><td className="num">{pct(w.actual)}</td><td className="num">{pp(w.variance)}</td><td className="nowrap">{dd(w.blFinish)}</td><td className="nowrap">{dd(w.forecast)}</td><td className="num">{w.delay ?? ''}</td></tr>)}</tbody>
        </table></div>
      </div>

      <div className="card">
        <div className="card-head"><h2>{t('Activity performance ({n})', { n: list.length })}</h2><input type="search" placeholder={t("Search ID or name…")} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} /></div>
        <div className="table-wrap tall"><table className="t">
          <thead><tr><th>{t("Activity")}</th><th>{t("BL start")}</th><th>{t("BL finish")}</th><th>{t("Start")}</th><th>{t("Finish")}</th><th>{t("Actual start")}</th><th>{t("Actual finish")}</th><th className="num">{t("Planned")}</th><th className="num">{t("Actual")}</th><th className="num">{t("Var (pp)")}</th><th className="num">{t("Rem. dur (d)")}</th><th className="num">{t("TF (d)")}</th><th>{t("Critical")}</th><th>{t("Status")}</th></tr></thead>
          <tbody>{list.map((r) => <tr key={r.a.row}><td className="nowrap">{r.a.id} {r.a.name}</td><td className="nowrap">{dd(r.blStart)}</td><td className="nowrap">{dd(r.blFinish)}</td><td className="nowrap">{dd(r.a.start)}</td><td className="nowrap">{dd(r.a.finish)}</td><td className="nowrap">{dd(r.a.actStart)}</td><td className="nowrap">{dd(r.a.actFinish)}</td>
            <td className="num">{pct(r.planned, 0)}</td><td className="num">{pct(r.actual, 0)}</td><td className="num">{pp(r.variance, 0)}</td><td className="num">{num(r.a.remDur, 1)}</td><td className="num">{num(r.tfDays, 1)}</td><td>{r.critical ? t('Yes') : ''}</td><td>{t(r.performance)}</td></tr>)}</tbody>
        </table></div>
      </div>
    </>
  );
}
