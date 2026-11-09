import { useState } from 'react';
import { useApp } from '../../state';
import { PageHead, SevBadge, Stat } from '../common';
import { FIELD_BY_KEY } from '../../core/fields';
import type { Check } from '../../core/validate';

const ORDER = { Critical: 0, Warning: 1, Info: 2 } as const;

export function ValidationPage() {
  const app = useApp();
  const { imp, report, project, calcError } = app;
  const [open, setOpen] = useState<string | null>(null);
  if (!project) return null;
  if (!imp || !report) return <><PageHead step={3} title="Validation" /><div className="card muted">Import a file first.</div></>;
  const checks = [...report.checks].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  const infoCount = report.checks.filter((c) => c.severity === 'Info').reduce((n, c) => n + c.count, 0);
  const noSavedBaseline = project.settings.baselineUse !== 'Current import' && !project.baselines.original;

  return (
    <>
      <PageHead step={3} title="Validation" right={<button className="btn primary" onClick={() => app.setPage('classification')}>Next: classification →</button>}>
        <p>Review the import here before any report is used. Critical issues block approval; warnings explain what is excluded from a figure and why. Missing values are reported, never treated as zero.</p>
      </PageHead>
      <div className="grid3" style={{ marginBottom: 16 }}>
        <Stat k="Critical issues" v={report.criticalCount} tone={report.criticalCount ? 'bad' : 'good'} sub={report.criticalCount ? 'Must be fixed before approval' : 'Nothing blocks approval'} />
        <Stat k="Warnings" v={report.warningCount} tone={report.warningCount ? 'warn' : 'good'} />
        <Stat k="Information" v={infoCount} />
        <Stat k="Approval" v={<span className={`badge ${app.approval === 'APPROVED' ? 'ok' : 'draft'}`}>{app.approval}</span>} sub={<button className="link-btn" onClick={() => app.setPage('results')}>Go to approval</button>} />
      </div>
      {calcError && <div className="notice bad">{calcError}</div>}
      {noSavedBaseline && (
        <div className="notice info">
          <b>Baseline:</b> Settings say "{project.settings.baselineUse}", but no baseline has been saved yet. Until then every activity uses the baseline dates from this import and the check "Baseline fallback used" counts them. Save the Original on the <button className="link-btn" onClick={() => app.setPage('baselines')}>Baselines</button> page, or set Baseline to "Current import" in Settings to use the import's dates on purpose.
        </div>
      )}

      <div className="card">
        <h2>Data checks</h2>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Check</th><th>Severity</th><th className="num">Count</th><th>What it means / what to do</th><th /></tr></thead>
            <tbody>
              {checks.map((c: Check) => [
                <tr key={c.id} className={open === c.id ? 'sel' : ''}>
                  <td className="nowrap"><b>{c.label}</b></td>
                  <td>{c.count > 0 ? <SevBadge s={c.severity} /> : <span className="badge ok">OK</span>}</td>
                  <td className="num"><b>{c.count}</b></td>
                  <td className="small">{c.help}</td>
                  <td>{c.count > 0 && <button className="btn small" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Hide' : 'Show'}</button>}</td>
                </tr>,
                open === c.id && (
                  <tr key={c.id + '-items'}><td colSpan={5} style={{ background: '#fbfcfe' }}>
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
        <h2>Values that could not be read ({report.cellIssues.length})</h2>
        {report.cellIssues.length === 0 ? <p className="muted">None. Every date, number and percentage in the mapped columns was read.</p> : (
          <div className="table-wrap tall">
            <table className="t">
              <thead><tr><th>Sheet row</th><th>Column</th><th>Activity ID</th><th>Field</th><th>Value in file</th><th>Problem</th><th>Severity</th></tr></thead>
              <tbody>
                {report.cellIssues.map((c, i) => (
                  <tr key={i}>
                    <td className="num">{c.row}</td><td>{c.column}</td><td className="nowrap">{c.activityId}</td><td className="nowrap">{FIELD_BY_KEY[c.field].label}</td>
                    <td className="mono">{c.value}</td><td>{c.problem}</td><td><SevBadge s={c.severity} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Activities with issues ({report.activityIssues.length})</h2>
        {report.activityIssues.length === 0 ? <p className="muted">None.</p> : (
          <div className="table-wrap tall">
            <table className="t">
              <thead><tr><th>Activity ID</th><th>Sheet row</th><th>Issues</th></tr></thead>
              <tbody>{report.activityIssues.map((a) => <tr key={a.row}><td className="nowrap">{a.id || '(no ID)'}</td><td className="num">{a.row}</td><td className="small">{a.issues.join(' · ')}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
