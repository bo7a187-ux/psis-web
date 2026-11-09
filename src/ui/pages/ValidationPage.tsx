import { useState } from 'react';
import { useApp } from '../../state';
import { PageHead, SevBadge, Stat } from '../common';
import { FIELD_BY_KEY } from '../../core/fields';
import type { Check } from '../../core/validate';
import { t, tr } from '../../i18n';

const ORDER = { Critical: 0, Warning: 1, Info: 2 } as const;

export function ValidationPage() {
  const app = useApp();
  const { imp, report, project, calcError } = app;
  const [open, setOpen] = useState<string | null>(null);
  if (!project) return null;
  if (!imp || !report) return <><PageHead step={3} title={t("Validation")} /><div className="card muted">{t("Import a file first.")}</div></>;
  const checks = [...report.checks].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  const infoCount = report.checks.filter((c) => c.severity === 'Info').reduce((n, c) => n + c.count, 0);
  const noSavedBaseline = project.settings.baselineUse !== 'Current import' && !project.baselines.original;

  return (
    <>
      <PageHead step={3} title={t("Validation")} right={<button className="btn primary" onClick={() => app.setPage('classification')}>{t("Next: classification →")}</button>}>
        <p>{t("Review the import here before any report is used. Critical issues block approval; warnings explain what is excluded from a figure and why. Missing values are reported, never treated as zero.")}</p>
      </PageHead>
      <div className="grid3" style={{ marginBottom: 16 }}>
        <Stat k={t("Critical issues")} v={report.criticalCount} tone={report.criticalCount ? 'bad' : 'good'} sub={t(report.criticalCount ? 'Must be fixed before approval' : 'Nothing blocks approval')} />
        <Stat k={t("Warnings")} v={report.warningCount} tone={report.warningCount ? 'warn' : 'good'} />
        <Stat k={t("Information")} v={infoCount} />
        <Stat k={t("Approval")} v={<span className={`badge ${app.approval === 'APPROVED' ? 'ok' : 'draft'}`}>{t(app.approval)}</span>} sub={<button className="link-btn" onClick={() => app.setPage('results')}>{t("Go to approval")}</button>} />
      </div>
      {calcError && <div className="notice bad">{t(calcError)}</div>}
      {noSavedBaseline && (
        <div className="notice info">
          {tr('{b} Settings say "{use}", but no baseline has been saved yet. Until then every activity uses the baseline dates from this import and the check "Baseline fallback used" counts them. Save the Original on the {page} page, or set Baseline to "Current import" in Settings to use the import\'s dates on purpose.', { b: <b>{t('Baseline:')}</b>, use: t(project.settings.baselineUse), page: <button className="link-btn" onClick={() => app.setPage('baselines')}>{t('Baselines')}</button> })}</div>
      )}

      <div className="card">
        <h2>{t("Data checks")}</h2>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>{t("Check")}</th><th>{t("Severity")}</th><th className="num">{t("Count")}</th><th>{t("What it means / what to do")}</th><th /></tr></thead>
            <tbody>
              {checks.map((c: Check) => [
                <tr key={c.id} className={open === c.id ? 'sel' : ''}>
                  <td className="nowrap"><b>{t(c.label)}</b></td>
                  <td>{c.count > 0 ? <SevBadge s={c.severity} /> : <span className="badge ok">{t("OK")}</span>}</td>
                  <td className="num"><b>{c.count}</b></td>
                  <td className="small">{t(c.help)}</td>
                  <td>{c.count > 0 && <button className="btn small" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Hide' : 'Show'}</button>}</td>
                </tr>,
                open === c.id && (
                  <tr key={c.id + '-items'}><td colSpan={5} style={{ background: 'var(--surface-2)' }}>
                    <div className="small mono" style={{ maxHeight: 220, overflow: 'auto', columnWidth: 260 }}>
                      {c.items.map((it, i) => <div key={i}>{it}</div>)}
                    </div>
                  </td></tr>
                ),
              ])}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>{t('Values that could not be read ({n})', { n: report.cellIssues.length })}</h2>
        {report.cellIssues.length === 0 ? <p className="muted">{t("None. Every date, number and percentage in the mapped columns was read.")}</p> : (
          <div className="table-wrap tall">
            <table className="t">
              <thead><tr><th>{t("Sheet row")}</th><th>{t("Column")}</th><th>{t("Activity ID")}</th><th>{t("Field")}</th><th>{t("Value in file")}</th><th>{t("Problem")}</th><th>{t("Severity")}</th></tr></thead>
              <tbody>
                {report.cellIssues.map((c, i) => (
                  <tr key={i}>
                    <td className="num">{c.row}</td><td>{c.column}</td><td className="nowrap">{c.activityId}</td><td className="nowrap">{t(FIELD_BY_KEY[c.field].label)}</td>
                    <td className="mono">{c.value}</td><td>{t(c.problem)}</td><td><SevBadge s={c.severity} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>{t('Activities with issues ({n})', { n: report.activityIssues.length })}</h2>
        {report.activityIssues.length === 0 ? <p className="muted">{t("None.")}</p> : (
          <div className="table-wrap tall">
            <table className="t">
              <thead><tr><th>{t("Activity ID")}</th><th>{t("Sheet row")}</th><th>{t("Issues")}</th></tr></thead>
              <tbody>{report.activityIssues.map((a) => <tr key={a.row}><td className="nowrap">{a.id || t('(no ID)')}</td><td className="num">{a.row}</td><td className="small">{a.issues.map((x) => t(x)).join(' · ')}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
