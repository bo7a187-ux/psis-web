import { useMemo, useState } from 'react';
import { useApp } from '../../state';
import { FilterBar } from '../FilterBar';
import { PageHead, Stat, pct, pp, num } from '../common';
import { fmtDate } from '../../core/dates';
import { summarize, groupTable, wbsTable, heatmap, inFilter, trendCompletion, type HeatValue } from '../../core/project';
import { DIM_LABEL, type Dimension } from '../../core/classify';
import { ApprovalBadge } from '../../App';

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
  if (!project || !rows || !st || !sum) return <div className="card muted">Import and calculate a schedule first.</div>;
  const L = project.classification.lists;
  const trend = trendCompletion(sum.actual, st.dataDate!, history, filters);
  const hm = heatmap(rows, filters, rowDim, L[rowDim], colDim, L[colDim], hv);
  const fmtCell = (v: number | null | undefined) => (v === undefined ? '·' : v == null ? 'n/a' : hv === 'Variance (pp)' ? pp(v) : pct(v));
  const list = rows.filter((r) => inFilter(r, filters)).filter((r) => !q || `${r.a.id} ${r.a.name}`.toLowerCase().includes(q.toLowerCase()));
  const groups: Dimension[] = ['discipline', 'phase', 'building', 'floor'];
  const wbs = wbsTable(rows, filters);
  const dd = (a: number | null) => (a == null ? '-' : fmtDate(a));

  return (
    <>
      <PageHead title="Schedule control" right={<ApprovalBadge />}>
        <p>Data date <b>{fmtDate(st.dataDate)}</b> · Baseline <b>{st.baselineUse}</b> · Forecast <b>{st.forecastMethod}</b> · Actual <b>{st.actualSource}</b>. Filters apply to everything on this page.</p>
      </PageHead>
      <FilterBar />

      <div className="grid2">
        <div className="card">
          <h2>Project-level status</h2>
          <table className="t"><tbody>
            <tr><td>Baseline start / finish (used)</td><td className="num">{dd(sum.blStart)} → {dd(sum.blFinish)}</td></tr>
            <tr><td>Original baseline finish</td><td className="num">{sum.origFinish ? fmtDate(sum.origFinish) : 'not saved'}</td></tr>
            <tr><td>Revised baseline finish</td><td className="num">{sum.revFinish ? fmtDate(sum.revFinish) : 'not saved'}</td></tr>
            <tr><td>Forecast - P6 / Performance / Conservative</td><td className="num">{dd(sum.forecastP6)} / {dd(sum.forecastPerf)} / {dd(sum.forecastCons)}</td></tr>
            <tr><td><b>Forecast - selected</b></td><td className="num"><b>{dd(sum.forecastFinish)}</b></td></tr>
            <tr><td>Delay vs baseline used / original / revised (days)</td><td className="num">{sum.delayDays ?? '-'} / {sum.delayVsOrig ?? '-'} / {sum.delayVsRev ?? '-'}</td></tr>
            <tr><td>Project total float (open activities, days)</td><td className="num">{sum.projectFloat != null ? num(sum.projectFloat, 1) : '-'}</td></tr>
            <tr><td>Time elapsed vs baseline</td><td className="num">{pct(sum.timeElapsed)}</td></tr>
            <tr><td>Progress planned / actual</td><td className="num">{pct(sum.planned)} / {pct(sum.actual)}</td></tr>
            <tr><td>Critical path progress planned / actual</td><td className="num">{sum.critPlanned == null ? 'no open critical work' : `${pct(sum.critPlanned)} / ${pct(sum.critActual)}`}</td></tr>
            <tr><td>Trend completion <span className="badge">indicative only</span></td><td className="num">{trend.date ? fmtDate(trend.date) : trend.reason}</td></tr>
            <tr><td>Project health</td><td className="num"><span className={`badge ${sum.health === 'RED' ? 'red' : sum.health === 'AMBER' ? 'amber' : 'green'}`}>{sum.health}</span></td></tr>
          </tbody></table>
          <p className="small muted">{sum.healthReasons.length ? `Reasons: ${sum.healthReasons.join('; ')}` : 'All health criteria within limits.'} The trend does not feed health.</p>
        </div>
        <div className="card">
          <h2>Schedule exceptions</h2>
          <div className="grid3">
            <Stat k="Delayed" v={sum.delayed} tone={sum.delayed ? 'warn' : undefined} />
            <Stat k="Behind planned progress" v={sum.behind} />
            <Stat k="Open past BL finish" v={sum.openPastBLF} />
            <Stat k="Not started past BL start" v={sum.notStartedPastBLS} />
            <Stat k="Finished late" v={sum.finishedLate} />
            <Stat k="Critical (open)" v={sum.critical} tone={sum.critical ? 'bad' : undefined} />
            <Stat k="Negative float" v={sum.negFloat} tone={sum.negFloat ? 'bad' : undefined} />
            <Stat k="Low float (open)" v={sum.lowFloat} />
            <Stat k="BL finish changed" v={sum.blFinishChanged} sub="vs previous snapshot" />
          </div>
        </div>
      </div>

      <div className="grid2">
        {groups.map((d) => {
          const g = groupTable(rows, filters, d, L[d], false);
          return (
            <div className="card" key={d} style={{ minWidth: 0 }}>
              <h2>By {DIM_LABEL[d].toLowerCase()}</h2>
              <div className="table-wrap"><table className="t">
                <thead><tr><th>{DIM_LABEL[d]}</th><th className="num">Weight</th><th className="num">Planned</th><th className="num">Actual</th><th className="num">Var (pp)</th><th className="num">Delayed</th><th className="num">Critical</th></tr></thead>
                <tbody>{g.map((x) => <tr key={x.name}><td>{x.name}{!x.inList && <span className="badge warning" style={{ marginLeft: 6 }}>not in list</span>}</td><td className="num">{pct(x.weightShare)}</td><td className="num">{pct(x.planned)}</td><td className="num">{pct(x.actual)}</td><td className={`num ${(x.variance ?? 0) < -0.1 ? 'bad' : (x.variance ?? 0) < -0.05 ? 'warn' : ''}`}>{pp(x.variance)}</td><td className="num">{x.delayed}</td><td className="num">{x.critical}</td></tr>)}</tbody>
              </table></div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Heatmap</h2>
          <div className="row">
            <label className="row small">Rows <select value={rowDim} onChange={(e) => setRowDim(e.target.value as Dimension)}>{(['discipline', 'phase', 'building', 'floor'] as Dimension[]).map((d) => <option key={d} value={d}>{DIM_LABEL[d]}</option>)}</select></label>
            <label className="row small">Columns <select value={colDim} onChange={(e) => setColDim(e.target.value as Dimension)}>{HEAT_DIMS.map((d) => <option key={d} value={d}>{DIM_LABEL[d]}</option>)}</select></label>
            <label className="row small">Value <select value={hv} onChange={(e) => setHv(e.target.value as HeatValue)}>{HEAT_VALUES.map((v) => <option key={v}>{v}</option>)}</select></label>
          </div>
        </div>
        <div className="table-wrap"><table className="heat" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr><th>{DIM_LABEL[rowDim]} ↓ / {DIM_LABEL[colDim]} →</th>{hm.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{hm.rows.map((rn, i) => <tr key={rn}><th style={{ textAlign: 'left' }}>{rn}</th>{hm.cols.map((c, j) => {
            const v = hm.cells[i][j];
            return <td key={c} className={v === undefined ? 'dot' : ''} style={typeof v === 'number' ? { background: heatColor(v, hv) } : undefined}>{fmtCell(v)}</td>;
          })}</tr>)}</tbody>
        </table></div>
        <p className="small muted">"·" = no weighted activities in that cell. {hv === 'Variance (pp)' ? 'Green: on plan; orange: behind 0.5-10 pp; red: more than 10 pp behind.' : 'Darker blue = more complete.'} Cells are weighted by the selected weighting method.</p>
      </div>

      <div className="card">
        <h2>WBS performance</h2>
        <div className="table-wrap tall"><table className="t">
          <thead><tr><th>WBS name</th><th className="num">Weight</th><th className="num">Planned</th><th className="num">Actual</th><th className="num">Var (pp)</th><th>BL finish</th><th>Forecast</th><th className="num">Delay (d)</th></tr></thead>
          <tbody>{wbs.map((w) => <tr key={w.name}><td>{w.name}</td><td className="num">{pct(w.weightShare)}</td><td className="num">{pct(w.planned)}</td><td className="num">{pct(w.actual)}</td><td className="num">{pp(w.variance)}</td><td className="nowrap">{dd(w.blFinish)}</td><td className="nowrap">{dd(w.forecast)}</td><td className="num">{w.delay ?? ''}</td></tr>)}</tbody>
        </table></div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Activity performance ({list.length})</h2><input type="search" placeholder="Search ID or name…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} /></div>
        <div className="table-wrap tall"><table className="t">
          <thead><tr><th>Activity</th><th>BL start</th><th>BL finish</th><th>Start</th><th>Finish</th><th>Actual start</th><th>Actual finish</th><th className="num">Planned</th><th className="num">Actual</th><th className="num">Var (pp)</th><th className="num">Rem. dur (d)</th><th className="num">TF (d)</th><th>Critical</th><th>Status</th></tr></thead>
          <tbody>{list.map((r) => <tr key={r.a.row}><td className="nowrap">{r.a.id} {r.a.name}</td><td className="nowrap">{dd(r.blStart)}</td><td className="nowrap">{dd(r.blFinish)}</td><td className="nowrap">{dd(r.a.start)}</td><td className="nowrap">{dd(r.a.finish)}</td><td className="nowrap">{dd(r.a.actStart)}</td><td className="nowrap">{dd(r.a.actFinish)}</td>
            <td className="num">{pct(r.planned, 0)}</td><td className="num">{pct(r.actual, 0)}</td><td className="num">{pp(r.variance, 0)}</td><td className="num">{num(r.a.remDur, 1)}</td><td className="num">{num(r.tfDays, 1)}</td><td>{r.critical ? 'Yes' : ''}</td><td>{r.performance}</td></tr>)}</tbody>
        </table></div>
      </div>
    </>
  );
}
