import { useState } from 'react';
import { useApp } from '../../state';
import { PageHead, pct, pp, num } from '../common';
import { fmtDate } from '../../core/dates';

export function CalculationAuditPage() {
  const { project, rows } = useApp();
  const [id, setId] = useState('');
  if (!project || !rows) return <div className="card muted">Import and calculate a schedule first.</div>;
  const st = project.settings;
  const r = rows.find((x) => x.a.id.toLowerCase() === id.trim().toLowerCase()) ?? null;
  const d = (x: number | null) => (x == null ? '-' : fmtDate(x));
  const steps: [string, string, string][] = !r ? [] : [
    ['Activity', `${r.a.id} - ${r.a.name}`, 'As imported (sheet row ' + r.a.row + ').'],
    ['Type / included', `${r.a.type || '-'}  ·  included: ${r.included ? 'yes' : r.isSummary ? 'no (WBS Summary)' : 'no (Level of Effort)'}`, 'WBS Summary never counted; LOE per Settings; milestones weight 0.'],
    ['Classification', `${r.cls.phase} / ${r.cls.discipline} / ${r.cls.building} / ${r.cls.floor} / ${r.cls.location}`, 'Manual override by ID first, else the first matching rule.'],
    ['Status (derived)', r.status, 'From P6 status text ("complet" / "progress"), else from actual dates.'],
    ['Baseline used', `${r.baselineUsed}:  ${d(r.blStart)} → ${d(r.blFinish)}`, 'Original / Revised saved baseline, or the import baseline (a fallback is flagged).'],
    ['Weight basis (' + st.weightMethod + ')', num(r.weightBasis, 2), 'Duration (days) / budgeted cost / budgeted labor units. Milestones: 0.'],
    ['Weight (included only)', num(r.weight, 2), 'Weight basis if included, else 0.'],
    ['Planned %', r.planned == null ? 'missing (excluded, not zero)' : pct(r.planned, 2), st.plannedMethod.startsWith('Linear') ? `Linear: (data date ${fmtDate(st.dataDate)} − BL start) ÷ (BL finish − BL start + 1), capped 0-100%. Milestone: 100% if data date > BL finish.` : 'P6 Schedule % Complete from the import.'],
    ['Actual %', r.actual == null ? 'missing (excluded, not zero)' : pct(r.actual, 2), `Field: ${st.actualSource} = ${r.actualField == null ? 'blank' : pct(r.actualField, 2)}. ${st.afAsComplete ? 'An Actual Finish counts as 100%.' : ''}`],
    ['Variance (pp)', pp(r.variance, 2), 'Actual % − Planned %, in percentage points.'],
    ['Planned earned / actual earned', `${num(r.plannedEarned, 3)}  /  ${num(r.actualEarned, 3)}`, 'Weight × Planned %  /  Weight × Actual %.'],
    ['EV / PV (cost)', `${num(r.ev, 2)}  /  ${num(r.pv, 2)}`, 'Budgeted cost × Actual %  /  × Planned %.'],
    ['Forecast: P6 / performance / conservative', `${d(r.fcP6)}  /  ${d(r.fcPerf)}  /  ${d(r.fcCons)}`, 'Performance (in progress) = data date + ROUNDUP((1 − actual%) × max(1, data date − actual start) ÷ actual%) − 1. Not started: max(BL finish, data date + baseline duration).'],
    ['Forecast finish (selected)', `${d(r.fcSel)}  (${r.fcSource || '-'})`, `Method: ${st.forecastMethod}. Completed = actual finish.`],
    ['Finish delay vs baseline used (days)', r.finishVarUsed == null ? '-' : String(r.finishVarUsed), 'Forecast finish − baseline finish, calendar days. Kept separate from variance in pp.'],
    ['Total float (days)', num(r.tfDays, 1), 'Converted from hours if needed.'],
    ['Flags', [r.behind && 'behind', r.openPastBLF && 'open past BL finish', r.notStartedPastBLS && 'not started past BL start', r.critical && 'critical', r.negFloat && 'negative float', r.lowFloat && 'low float', r.finishedLate && 'finished late', r.delayed && `DELAYED (${r.delayIndicator})`].filter(Boolean).join(' · ') || 'none', `Behind = more than ${pct(st.tolerance, 1)} below plan.`],
    ['Data issues', Object.entries(r.flags).filter(([, v]) => v).map(([k]) => k).join(' · ') || 'none', 'See Validation.'],
  ];
  return (
    <>
      <PageHead title="Calculation audit"><p>Type any Activity ID to see every step of its calculation, using the same code that feeds the dashboards.</p></PageHead>
      <div className="card">
        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="audit-id">Activity ID</label>
          <input id="audit-id" type="text" list="audit-ids" value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. SMP-1400" />
          <datalist id="audit-ids">{rows.map((x) => <option key={x.a.row} value={x.a.id} />)}</datalist>
        </div>
        {id && !r && <div className="notice warn">No activity with ID "{id}".</div>}
        {r && (
          <div className="table-wrap" style={{ marginTop: 12 }}><table className="t">
            <thead><tr><th>Step</th><th>Value</th><th>Rule</th></tr></thead>
            <tbody>{steps.map(([a, b, c]) => <tr key={a}><td className="nowrap"><b>{a}</b></td><td>{b}</td><td className="small muted">{c}</td></tr>)}</tbody>
          </table></div>
        )}
      </div>
      <div className="card">
        <h2>Method summary</h2>
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
            .map(([a, b]) => <tr key={a}><td className="nowrap"><b>{a}</b></td><td>{b}</td></tr>)}
        </tbody></table>
      </div>
    </>
  );
}
