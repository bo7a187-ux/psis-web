import { useMemo, useState } from 'react';
import { useApp } from '../../state';
import { PageHead, Stat, pct, fd, ltr } from '../common';
import { t, tr } from '../../i18n';
import { readLogic } from '../../core/logic';
import { dcma, type DcmaCheck } from '../../core/dcma';

const STATUS_BADGE = { pass: 'ok', fail: 'critical', na: '' } as const;
const STATUS_LABEL = { pass: 'Pass', fail: 'Fail', na: 'Not available' } as const;

function result(c: DcmaCheck): string {
  if (c.value == null) return '-';
  if (c.kind === 'index') return c.value.toFixed(2);
  if (c.kind === 'count') return String(c.count);
  return `${pct(c.value, 1)}${c.count != null && c.total != null ? ` (${c.count} / ${c.total})` : ''}`;
}

export function QualityPage() {
  const { project, stored, imp, rows, summary } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const opts = project?.importOptions;
  const logic = useMemo(() => (stored && imp && opts ? readLogic(stored.sheets, stored.sheetIndex, imp, opts.durationUnit, opts.hoursPerDay) : null), [stored, imp, opts]);
  const checks = useMemo(() => (rows && logic && project?.settings.dataDate != null ? dcma(rows, logic, project.settings.dataDate, summary?.forecastP6 ?? null) : null),
    [rows, logic, project, summary]);
  if (!project || !checks || !logic) return <div className="card muted">{t('Import and calculate a schedule first.')}</div>;
  const passed = checks.filter((c) => c.status === 'pass').length;
  const failed = checks.filter((c) => c.status === 'fail').length;
  const na = checks.filter((c) => c.status === 'na').length;

  return (
    <>
      <PageHead title={t('Schedule quality (DCMA 14-point)')}>
        <p>{t('The DCMA 14-point assessment is the usual quality test for a P6 schedule: logic, constraints, float, durations and progress against the baseline. Run it before the schedule is submitted.')}</p>
      </PageHead>

      <div className="grid3" style={{ marginBottom: 16 }}>
        <Stat k={t('Checks passed')} v={ltr(`${passed} / ${passed + failed}`)} tone={failed ? 'warn' : 'good'} sub={t('of the checks that could be run')} />
        <Stat k={t('Checks failed')} v={failed} tone={failed ? 'bad' : 'good'} />
        <Stat k={t('Not available')} v={na} sub={t('need data not in the file')} />
        <Stat k={t('Data date')} v={fd(project.settings.dataDate)} />
      </div>

      {logic.relations
        ? <div className="notice good">{tr('Relationships read from sheet {sheet}: {n}.', { sheet: <b>{logic.relationSheet}</b>, n: <b>{logic.relations.length}</b> })}</div>
        : <div className="notice warn">{t('No relationships in this file, so the logic checks (1-4) cannot run. Import the XER file, or tick Relationships when exporting to Excel from P6.')}</div>}

      <div className="card">
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th className="num">#</th><th>{t('Check')}</th><th>{t('What is measured')}</th><th className="num">{t('Result')}</th><th className="num">{t('Target')}</th><th>{t('Status')}</th><th /></tr></thead>
            <tbody>
              {checks.map((c) => [
                <tr key={c.id} className={open === c.id ? 'sel' : ''}>
                  <td className="num muted">{c.no}</td>
                  <td className="nowrap"><b>{t(c.name)}</b></td>
                  <td className="small">{t(c.measure)}{c.reason && <div className="muted">{t(c.reason)}</div>}</td>
                  <td className="num"><b>{ltr(result(c))}</b></td>
                  <td className="num">{ltr(c.target === 'Pass' ? t('Pass') : c.target)}</td>
                  <td><span className={`badge ${STATUS_BADGE[c.status]}`}>{t(STATUS_LABEL[c.status])}</span></td>
                  <td>{c.items.length > 0 && <button className="btn small" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? t('Hide') : t('Show ({n})', { n: c.items.length })}</button>}</td>
                </tr>,
                open === c.id && (
                  <tr key={c.id + '-items'}><td colSpan={7} style={{ background: 'var(--surface-2)' }}>
                    <div className="small" style={{ maxHeight: 260, overflow: 'auto', columnWidth: 320 }}>
                      {c.items.map((it, i) => <div key={i}><span className="mono">{ltr(it.label)}</span>{it.why && <span className="muted"> - {t(it.why)}{it.value ? ` ${ltr(it.value.replace(/ d$/, ''))} ${it.value.endsWith(' d') ? t('d') : ''}` : ''}</span>}</div>)}
                    </div>
                  </td></tr>
                ),
              ])}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>{t('Open activities only, without WBS Summary and Level of Effort. 44 days is the DCMA limit for high float and high duration. The thresholds are guidelines: a failed check is a point to explain or fix, not automatically an error.')}</p>
      </div>
    </>
  );
}
