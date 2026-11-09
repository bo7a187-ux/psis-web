import { useState } from 'react';
import { fmtDate } from '../../core/dates';
import { useApp } from '../../state';
import { PageHead, pct, pp, num, fd, ltr } from '../common';
import { t } from '../../i18n';

export function CalculationAuditPage() {
  const { project, rows } = useApp();
  const [id, setId] = useState('');
  if (!project || !rows) return <div className="card muted">{t("Import and calculate a schedule first.")}</div>;
  const st = project.settings;
  const r = rows.find((x) => x.a.id.toLowerCase() === id.trim().toLowerCase()) ?? null;
  const d = (x: number | null) => (x == null ? '-' : fd(x));
  const yes = (b: boolean) => t(b ? 'yes' : 'no');
  const steps: [string, string, string][] = !r ? [] : [
    [t('Activity'), `${r.a.id} - ${r.a.name}`, t('As imported (sheet row {n}).', { n: r.a.row })],
    [t('Type / included'), `${t(r.a.type || '-')}  ·  ${t('included:')} ${r.included ? yes(true) : r.isSummary ? t('no (WBS Summary)') : t('no (Level of Effort)')}`, t('WBS Summary never counted; LOE per Settings; milestones weight 0.')],
    [t('Classification'), `${r.cls.phase} / ${r.cls.discipline} / ${r.cls.building} / ${r.cls.floor} / ${r.cls.location}`, t('Manual override by ID first, else the first matching rule.')],
    [t('Status (derived)'), t(r.status), t('From P6 status text ("complet" / "progress"), else from actual dates.')],
    [t('Baseline used'), `${t(r.baselineUsed)}:  ${ltr(`${fmtDate(r.blStart)} → ${fmtDate(r.blFinish)}`)}`, t('Original / Revised saved baseline, or the import baseline (a fallback is flagged).')],
    [t('Weight basis ({m})', { m: t(st.weightMethod) }), num(r.weightBasis, 2), t('Duration (days) / budgeted cost / budgeted labor units. Milestones: 0.')],
    [t('Weight (included only)'), num(r.weight, 2), t('Weight basis if included, else 0.')],
    [t('Planned %'), r.planned == null ? t('missing (excluded, not zero)') : pct(r.planned, 2), st.plannedMethod.startsWith('Linear') ? t('Linear: (data date {d} − BL start) ÷ (BL finish − BL start + 1), capped 0-100%. Milestone: 100% if data date > BL finish.', { d: fd(st.dataDate) }) : t('P6 Schedule % Complete from the import.')],
    [t('Actual %'), r.actual == null ? t('missing (excluded, not zero)') : pct(r.actual, 2), `${t('Field: {f} = {v}.', { f: t(st.actualSource), v: r.actualField == null ? t('blank') : pct(r.actualField, 2) })} ${st.afAsComplete ? t('An Actual Finish counts as 100%.') : ''}`],
    [t('Variance (pp)'), pp(r.variance, 2), t('Actual % − Planned %, in percentage points.')],
    [t('Planned earned / actual earned'), `${num(r.plannedEarned, 3)}  /  ${num(r.actualEarned, 3)}`, t('Weight × Planned %  /  Weight × Actual %.')],
    [t('EV / PV (cost)'), `${num(r.ev, 2)}  /  ${num(r.pv, 2)}`, t('Budgeted cost × Actual %  /  × Planned %.')],
    [t('Forecast: P6 / performance / conservative'), `${d(r.fcP6)}  /  ${d(r.fcPerf)}  /  ${d(r.fcCons)}`, t('Performance (in progress) = data date + ROUNDUP((1 − actual%) × max(1, data date − actual start) ÷ actual%) − 1. Not started: max(BL finish, data date + baseline duration).')],
    [t('Forecast finish (selected)'), `${d(r.fcSel)}  (${t(r.fcSource || '-')})`, t('Method: {m}. Completed = actual finish.', { m: t(st.forecastMethod) })],
    [t('Finish delay vs baseline used (days)'), r.finishVarUsed == null ? '-' : String(r.finishVarUsed), t('Forecast finish − baseline finish, calendar days. Kept separate from variance in pp.')],
    [t('Total float (days)'), num(r.tfDays, 1), t('Converted from hours if needed.')],
    [t('Flags'), [r.behind && t('behind'), r.openPastBLF && t('open past BL finish'), r.notStartedPastBLS && t('not started past BL start'), r.critical && t('critical'), r.negFloat && t('negative float'), r.lowFloat && t('low float'), r.finishedLate && t('finished late'), r.delayed && `${t('DELAYED')} (${t(r.delayIndicator)})`].filter(Boolean).join(' · ') || t('none'), t('Behind = more than {p} below plan.', { p: pct(st.tolerance, 1) })],
    [t('Data issues'), Object.entries(r.flags).filter(([, v]) => v).map(([k]) => k).join(' · ') || t('none'), t('See Validation.')],
  ];
  return (
    <>
      <PageHead title={t("Calculation audit")}><p>{t("Type any Activity ID to see every step of its calculation, using the same code that feeds the dashboards.")}</p></PageHead>
      <div className="card">
        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="audit-id">{t("Activity ID")}</label>
          <input id="audit-id" type="text" list="audit-ids" value={id} onChange={(e) => setId(e.target.value)} placeholder={t("e.g. SMP-1400")} />
          <datalist id="audit-ids">{rows.map((x) => <option key={x.a.row} value={x.a.id} />)}</datalist>
        </div>
        {id && !r && <div className="notice warn">{t('No activity with ID "{id}".', { id })}</div>}
        {r && (
          <div className="table-wrap" style={{ marginTop: 12 }}><table className="t">
            <thead><tr><th>{t("Step")}</th><th>{t("Value")}</th><th>{t("Rule")}</th></tr></thead>
            <tbody>{steps.map(([a, b, c]) => <tr key={a}><td className="nowrap"><b>{a}</b></td><td>{b}</td><td className="small muted">{c}</td></tr>)}</tbody>
          </table></div>
        )}
      </div>
      <div className="card">
        <h2>{t("Method summary")}</h2>
        <table className="t"><tbody>
          {[['Weighted progress', 'Progress of any group = Σ(weight × progress %) ÷ Σ(weight) over included activities that have a value. Never a simple average.'],
            ['Included activities', 'WBS Summary always excluded (no double-counting); Level of Effort excluded unless enabled; milestones counted in totals with weight 0.'],
            ['Data date', "Start of the day, as in Primavera: that day's work is not yet planned as done."],
            ['Planned % (linear)', 'An assumption: work spread evenly over the baseline calendar days. Switch to P6 Schedule % Complete in Settings for P6\'s own curve.'],
            ['Actual %', 'Physical, Duration, Units and Activity % Complete are different measures; the one in use is printed on every dashboard and never mixed.'],
            ['Missing data', 'Activities without baseline, progress or weight are excluded from the affected figure and listed in Validation - never treated as zero.'],
            ['Variance vs delay', 'Variance is in percentage points (Actual − Planned). Delay is in calendar days (forecast − baseline finish).'],
            ['SPI', 'EV ÷ PV, shown only when cost coverage ≥ the Settings threshold and PV > 0; otherwise N/A with the reason.'],
            ['Project health', 'RED/AMBER when a limit in Settings is crossed (forecast delay days, variance pp, SPI); each reason is written. The trend completion is indicative only and not used.']]
            .map(([a, b]) => <tr key={a}><td className="nowrap"><b>{t(a)}</b></td><td>{t(b)}</td></tr>)}
        </tbody></table>
      </div>
    </>
  );
}
