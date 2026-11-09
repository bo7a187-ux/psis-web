import { useMemo, useState } from 'react';
import { useApp } from '../../state';
import { FilterBar } from '../FilterBar';
import { PageHead, pct, pp, num, downloadBytes, fd } from '../common';
import { writeXlsx } from '../../core/xlsxWrite';
import { delaySheets } from '../../core/delayExport';
import { fmtDate } from '../../core/dates';
import { exceptionList, EXCEPTION_TYPES, type ExceptionType } from '../../core/project';
import { ApprovalBadge } from '../../App';
import { t, tr } from '../../i18n';

export function DelayAnalysisPage() {
  const { project, rows, filters, approval } = useApp();
  const [type, setType] = useState<ExceptionType>('Late finish forecast (days)');
  const [top, setTop] = useState(20);
  const list = useMemo(() => (rows && project ? exceptionList(rows, project.settings, filters, type) : []), [rows, project, filters, type]);
  if (!project || !rows) return <div className="card muted">{t("Import and calculate a schedule first.")}</div>;
  const shown = list.slice(0, top);
  return (
    <>
      <PageHead title={t("Delay analysis")} right={<ApprovalBadge />}>
        <p>{tr('Data date {dd}. Two different measures: {var} = percentage points behind the planned %; {delay} = calendar days between forecast and baseline finish. An activity can be behind in % and still finish on time, or the reverse.', { dd: <b>{fd(project.settings.dataDate)}</b>, var: <b>{t('Var (pp)')}</b>, delay: <b>{t('Finish delay (d)')}</b> })}</p>
      </PageHead>
      <FilterBar />
      <div className="card">
        <div className="card-head">
          <div className="row">
            <label className="row small"><b>{t("Show")}</b><select value={type} onChange={(e) => setType(e.target.value as ExceptionType)}>{EXCEPTION_TYPES.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></label>
            <label className="row small"><b>{t("Rows")}</b><select value={top} onChange={(e) => setTop(+e.target.value)}><option value={10}>{t("Top 10")}</option><option value={20}>{t("Top 20")}</option><option value={100000}>{t("All")}</option></select></label>
          </div>
          <div className="row">
            <span className="small muted">{t("Matching activities:")}{' '}<b>{list.length}</b></span>
            <button className="btn" onClick={() => {
              const scope = Object.entries(filters).every(([, v]) => v === 'All') ? 'Whole project' : Object.entries(filters).filter(([, v]) => v !== 'All').map(([k, v]) => `${k}: ${v}`).join(', ');
              const bytes = writeXlsx(delaySheets(list, project.settings, type, scope, project.settings.projectTitle || project.name, approval === 'APPROVED' ? `APPROVED by ${project.approval?.reviewer}` : `DRAFT - NOT APPROVED (${approval})`));
              downloadBytes(`Delay_report_${fmtDate(project.settings.dataDate).replace(/-/g, '')}.xlsx`, bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            }}>{t("Export to Excel")}</button>
          </div>
        </div>
        <div className="table-wrap tall"><table className="t">
          <thead><tr><th>{t("Activity ID")}</th><th>{t("Name")}</th><th>{t("Discipline")}</th><th>{t("Floor")}</th><th className="num">{t("Planned")}</th><th className="num">{t("Actual")}</th><th className="num">{t("Var (pp)")}</th><th>{t("BL start")}</th><th>{t("BL finish")}</th><th>{t("Fc: P6")}</th><th>{t("Fc: Performance")}</th><th>{t("Fc: Conservative")}</th><th>{t("Selected source")}</th><th className="num">{t("Finish delay (d)")}</th><th className="num">{t("TF (d)")}</th><th>{t("Indicator")}</th></tr></thead>
          <tbody>{shown.length === 0 && <tr><td colSpan={16} className="muted">{t("No activities in this list.")}</td></tr>}
            {shown.map((r) => <tr key={r.a.row}><td className="nowrap">{r.a.id}</td><td>{r.a.name}</td><td>{r.cls.discipline}</td><td>{r.cls.floor}</td><td className="num">{pct(r.planned, 0)}</td><td className="num">{pct(r.actual, 0)}</td><td className="num">{pp(r.variance, 0)}</td>
              <td className="nowrap">{fd(r.blStart)}</td><td className="nowrap">{fd(r.blFinish)}</td><td className="nowrap">{fd(r.fcP6)}</td><td className="nowrap">{fd(r.fcPerf)}</td><td className="nowrap">{fd(r.fcCons)}</td>
              <td className="small">{t(r.fcSource)}</td><td className="num">{r.finishVarUsed ?? ''}</td><td className="num">{num(r.tfDays, 1)}</td><td className="small">{t(r.delayIndicator)}</td></tr>)}</tbody>
        </table></div>
      </div>
    </>
  );
}
