import { useMemo, useState } from 'react';
import { useApp } from '../../state';
import { FilterBar } from '../FilterBar';
import { PageHead, pct, pp, num, downloadBytes } from '../common';
import { writeXlsx } from '../../core/xlsxWrite';
import { delaySheets } from '../../core/delayExport';
import { fmtDate } from '../../core/dates';
import { exceptionList, EXCEPTION_TYPES, type ExceptionType } from '../../core/project';
import { ApprovalBadge } from '../../App';

export function DelayAnalysisPage() {
  const { project, rows, filters, approval } = useApp();
  const [type, setType] = useState<ExceptionType>('Late finish forecast (days)');
  const [top, setTop] = useState(20);
  const list = useMemo(() => (rows && project ? exceptionList(rows, project.settings, filters, type) : []), [rows, project, filters, type]);
  if (!project || !rows) return <div className="card muted">Import and calculate a schedule first.</div>;
  const shown = list.slice(0, top);
  return (
    <>
      <PageHead title="Delay analysis" right={<ApprovalBadge />}>
        <p>Data date <b>{fmtDate(project.settings.dataDate)}</b>. Two different measures: <b>Var (pp)</b> = percentage points behind the planned %; <b>Finish delay (d)</b> = calendar days between forecast and baseline finish. An activity can be behind in % and still finish on time, or the reverse.</p>
      </PageHead>
      <FilterBar />
      <div className="card">
        <div className="card-head">
          <div className="row">
            <label className="row small"><b>Show</b><select value={type} onChange={(e) => setType(e.target.value as ExceptionType)}>{EXCEPTION_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="row small"><b>Rows</b><select value={top} onChange={(e) => setTop(+e.target.value)}><option value={10}>Top 10</option><option value={20}>Top 20</option><option value={100000}>All</option></select></label>
          </div>
          <div className="row">
            <span className="small muted">Matching activities: <b>{list.length}</b></span>
            <button className="btn" onClick={() => {
              const scope = Object.entries(filters).every(([, v]) => v === 'All') ? 'Whole project' : Object.entries(filters).filter(([, v]) => v !== 'All').map(([k, v]) => `${k}: ${v}`).join(', ');
              const bytes = writeXlsx(delaySheets(list, project.settings, type, scope, project.settings.projectTitle || project.name, approval === 'APPROVED' ? `APPROVED by ${project.approval?.reviewer}` : `DRAFT - NOT APPROVED (${approval})`));
              downloadBytes(`Delay_report_${fmtDate(project.settings.dataDate).replace(/-/g, '')}.xlsx`, bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            }}>Export to Excel</button>
          </div>
        </div>
        <div className="table-wrap tall"><table className="t">
          <thead><tr><th>Activity ID</th><th>Name</th><th>Discipline</th><th>Floor</th><th className="num">Planned</th><th className="num">Actual</th><th className="num">Var (pp)</th><th>BL start</th><th>BL finish</th><th>Fc: P6</th><th>Fc: Performance</th><th>Fc: Conservative</th><th>Selected source</th><th className="num">Finish delay (d)</th><th className="num">TF (d)</th><th>Indicator</th></tr></thead>
          <tbody>{shown.length === 0 && <tr><td colSpan={16} className="muted">No activities in this list.</td></tr>}
            {shown.map((r) => <tr key={r.a.row}><td className="nowrap">{r.a.id}</td><td>{r.a.name}</td><td>{r.cls.discipline}</td><td>{r.cls.floor}</td><td className="num">{pct(r.planned, 0)}</td><td className="num">{pct(r.actual, 0)}</td><td className="num">{pp(r.variance, 0)}</td>
              <td className="nowrap">{fmtDate(r.blStart)}</td><td className="nowrap">{fmtDate(r.blFinish)}</td><td className="nowrap">{fmtDate(r.fcP6)}</td><td className="nowrap">{fmtDate(r.fcPerf)}</td><td className="nowrap">{fmtDate(r.fcCons)}</td>
              <td className="small">{r.fcSource}</td><td className="num">{r.finishVarUsed ?? ''}</td><td className="num">{num(r.tfDays, 1)}</td><td className="small">{r.delayIndicator}</td></tr>)}</tbody>
        </table></div>
      </div>
    </>
  );
}
