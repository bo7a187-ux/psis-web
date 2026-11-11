/**
 * DCMA 14-Point Schedule Assessment (US Defense Contract Management Agency) - the usual
 * schedule quality test for P6 programmes. Thresholds are the standard published ones.
 * Population: open (not completed) activities, without WBS Summary and Level of Effort.
 * Days are the converted P6 working days of the import; the data date is the start of the day.
 */
import type { CalcRow } from './engine';
import type { Day } from './dates';
import { HARD_CONSTRAINTS, type ScheduleLogic } from './logic';

export type DcmaStatus = 'pass' | 'fail' | 'na';

export interface DcmaCheck {
  no: number;
  id: string;
  name: string;
  /** what is counted */
  measure: string;
  count: number | null;
  total: number | null;
  /** the figure compared with the target: a fraction (0.05 = 5%), an index or a count */
  value: number | null;
  kind: 'pct' | 'index' | 'count';
  target: string;
  status: DcmaStatus;
  /** why the check could not be run (status 'na') */
  reason?: string;
  /** offending activities (or relationships): who, why (an English key), and a value */
  items: DcmaItem[];
}
export interface DcmaItem { label: string; why?: string; value?: string }

export const HIGH_FLOAT_DAYS = 44;
export const HIGH_DURATION_DAYS = 44;

export function dcma(rows: CalcRow[], logic: ScheduleLogic, dataDate: Day, projectFinishP6: Day | null): DcmaCheck[] {
  const tasks = rows.filter((r) => !r.isSummary && !r.isLOE && r.a.id);
  const open = tasks.filter((r) => r.status !== 'Completed');
  const openNonMs = open.filter((r) => !r.isMilestone);
  const key = (id: string) => id.toLowerCase();
  const label = (r: CalcRow) => `${r.a.id} ${r.a.name}`.trim();
  const openIds = new Set(open.map((r) => key(r.a.id)));
  const known = new Set(tasks.map((r) => key(r.a.id)));
  const checks: DcmaCheck[] = [];
  const pctCheck = (no: number, id: string, name: string, measure: string, bad: DcmaItem[], total: number, max: number, target: string) =>
    checks.push({ no, id, name, measure, count: bad.length, total, value: total ? bad.length / total : 0, kind: 'pct', target, status: bad.length / Math.max(1, total) <= max + 1e-9 ? 'pass' : 'fail', items: bad });
  const zeroCheck = (no: number, id: string, name: string, measure: string, bad: DcmaItem[], total: number) =>
    checks.push({ no, id, name, measure, count: bad.length, total, value: bad.length, kind: 'count', target: '0', status: bad.length === 0 ? 'pass' : 'fail', items: bad });
  const na = (no: number, id: string, name: string, measure: string, kind: DcmaCheck['kind'], target: string, reason: string) =>
    checks.push({ no, id, name, measure, count: null, total: null, value: null, kind, target, status: 'na', reason, items: [] });

  // 1-4: logic
  const rels = logic.relations;
  const noRels = 'Needs relationships: import the XER file, or add Relationships (TASKPRED) to the P6 Excel export.';
  if (rels) {
    const hasPred = new Set(rels.map((r) => key(r.succ)));
    const hasSucc = new Set(rels.map((r) => key(r.pred)));
    const missing = open.filter((r) => {
      const k = key(r.a.id);
      const startMs = /start milestone/i.test(r.a.type), finishMs = /finish milestone/i.test(r.a.type);
      return (!hasPred.has(k) && !startMs) || (!hasSucc.has(k) && !finishMs);
    }).map((r) => ({ label: label(r), why: !hasPred.has(key(r.a.id)) ? 'no predecessor' : 'no successor' }));
    pctCheck(1, 'logic', 'Logic', 'Open activities missing a predecessor or a successor', missing, open.length, 0.05, '≤ 5%');
    const live = rels.filter((r) => openIds.has(key(r.succ)) && known.has(key(r.pred)));
    const relLabel = (r: (typeof rels)[number]): DcmaItem => ({ label: `${r.pred} → ${r.succ}`, why: r.type, value: r.lag ? `${r.lag > 0 ? '+' : ''}${r.lag} d` : undefined });
    zeroCheck(2, 'leads', 'Leads', 'Relationships with a negative lag (lead)', live.filter((r) => (r.lag ?? 0) < 0).map(relLabel), live.length);
    pctCheck(3, 'lags', 'Lags', 'Relationships with a positive lag', live.filter((r) => (r.lag ?? 0) > 0).map(relLabel), live.length, 0.05, '≤ 5%');
    const notFS = live.filter((r) => r.type !== 'FS');
    checks.push({ no: 4, id: 'reltypes', name: 'Relationship types', measure: 'Finish-to-Start share of relationships', count: live.length - notFS.length, total: live.length,
      value: live.length ? (live.length - notFS.length) / live.length : null, kind: 'pct', target: '≥ 90%', status: !live.length ? 'na' : (live.length - notFS.length) / live.length >= 0.9 - 1e-9 ? 'pass' : 'fail',
      reason: live.length ? undefined : 'No relationships between open activities.', items: notFS.map(relLabel) });
  } else {
    na(1, 'logic', 'Logic', 'Open activities missing a predecessor or a successor', 'pct', '≤ 5%', noRels);
    na(2, 'leads', 'Leads', 'Relationships with a negative lag (lead)', 'count', '0', noRels);
    na(3, 'lags', 'Lags', 'Relationships with a positive lag', 'pct', '≤ 5%', noRels);
    na(4, 'reltypes', 'Relationship types', 'Finish-to-Start share of relationships', 'pct', '≥ 90%', noRels);
  }

  // 5: hard constraints
  if (logic.constraints) {
    const hard = open.filter((r) => (logic.constraints!.get(key(r.a.id)) ?? []).some((c) => HARD_CONSTRAINTS.has(c.toLowerCase())))
      .map((r) => ({ label: label(r), why: (logic.constraints!.get(key(r.a.id)) ?? []).find((c) => HARD_CONSTRAINTS.has(c.toLowerCase())) }));
    pctCheck(5, 'hard', 'Hard constraints', 'Open activities with a hard constraint (Start/Finish On, On or Before, Mandatory)', hard, open.length, 0.05, '≤ 5%');
  } else na(5, 'hard', 'Hard constraints', 'Open activities with a hard constraint (Start/Finish On, On or Before, Mandatory)', 'pct', '≤ 5%', 'Needs the Primary Constraint column: import the XER file, or add Primary / Secondary Constraint to the P6 Excel export.');

  // 6-7: float
  const withTF = open.filter((r) => r.tfDays != null);
  if (withTF.length) {
    pctCheck(6, 'highfloat', 'High float', `Open activities with total float over ${HIGH_FLOAT_DAYS} days`, withTF.filter((r) => r.tfDays! > HIGH_FLOAT_DAYS).map((r) => ({ label: label(r), why: 'TF', value: `${r.tfDays} d` })), withTF.length, 0.05, '≤ 5%');
    zeroCheck(7, 'negfloat', 'Negative float', 'Open activities with negative total float', withTF.filter((r) => r.tfDays! < 0).map((r) => ({ label: label(r), why: 'TF', value: `${r.tfDays} d` })), withTF.length);
  } else {
    na(6, 'highfloat', 'High float', `Open activities with total float over ${HIGH_FLOAT_DAYS} days`, 'pct', '≤ 5%', 'Needs the Total Float column.');
    na(7, 'negfloat', 'Negative float', 'Open activities with negative total float', 'count', '0', 'Needs the Total Float column.');
  }

  // 8: high duration (remaining work of open activities; original duration if not started)
  const dur = (r: CalcRow) => (r.status === 'Not Started' ? r.a.origDur ?? r.a.remDur : r.a.remDur ?? r.a.origDur);
  const withDur = openNonMs.filter((r) => dur(r) != null);
  if (withDur.length) pctCheck(8, 'highdur', 'High duration', `Open activities with a duration over ${HIGH_DURATION_DAYS} days`, withDur.filter((r) => dur(r)! > HIGH_DURATION_DAYS).map((r) => ({ label: label(r), why: 'Duration', value: `${dur(r)} d` })), withDur.length, 0.05, '≤ 5%');
  else na(8, 'highdur', 'High duration', `Open activities with a duration over ${HIGH_DURATION_DAYS} days`, 'pct', '≤ 5%', 'Needs Original or Remaining Duration.');

  // 9: invalid dates - forecasts before the data date, actuals on or after it
  const invalid: DcmaItem[] = [];
  for (const r of tasks) {
    const a = r.a;
    if (a.actStart != null && a.actStart >= dataDate) invalid.push({ label: label(r), why: 'actual start on/after the data date' });
    else if (a.actFinish != null && a.actFinish >= dataDate) invalid.push({ label: label(r), why: 'actual finish on/after the data date' });
    else if (r.status !== 'Completed' && a.actStart == null && a.start != null && a.start < dataDate) invalid.push({ label: label(r), why: 'planned start before the data date' });
    else if (r.status !== 'Completed' && a.finish != null && a.finish < dataDate) invalid.push({ label: label(r), why: 'planned finish before the data date' });
  }
  zeroCheck(9, 'dates', 'Invalid dates', 'Planned dates before the data date, or actual dates on/after it', invalid, tasks.length);

  // 10: resources (cost or labour units loaded)
  const anyLoad = tasks.some((r) => (r.a.budgetCost ?? 0) > 0 || (r.a.budgetUnits ?? 0) > 0);
  const durOpen = openNonMs.filter((r) => (dur(r) ?? 0) > 0);
  if (anyLoad) pctCheck(10, 'resources', 'Resources', 'Open activities with a duration but no cost or labour units', durOpen.filter((r) => !((r.a.budgetCost ?? 0) > 0 || (r.a.budgetUnits ?? 0) > 0)).map((r) => ({ label: label(r) })), durOpen.length, 0, '0%');
  else na(10, 'resources', 'Resources', 'Open activities with a duration but no cost or labour units', 'pct', '0%', 'No cost or labour units in the file (the schedule is not resource loaded).');

  // 11 & 14: baseline execution
  const due = tasks.filter((r) => r.blFinish != null && r.blFinish < dataDate);
  const doneOnTime = (r: CalcRow) => r.status === 'Completed' && (r.a.actFinish == null || r.a.actFinish <= r.blFinish!);
  if (due.length) pctCheck(11, 'missed', 'Missed tasks', 'Activities due by the baseline that did not finish on time', due.filter((r) => !doneOnTime(r)).map((r) => ({ label: label(r), why: r.status === 'Completed' ? 'finished after the baseline finish' : 'not finished, baseline finish passed' })), due.length, 0.05, '≤ 5%');
  else na(11, 'missed', 'Missed tasks', 'Activities due by the baseline that did not finish on time', 'pct', '≤ 5%', 'No activity was due to finish before the data date.');

  // 12: critical path test - needs a CPM recalculation in P6
  na(12, 'cpt', 'Critical path test', 'Add a large delay to a critical activity: the project finish must move by the same amount', 'count', 'Pass', 'Run in P6: this needs a CPM recalculation of the schedule.');

  // 13: CPLI = (critical path length + total float) / critical path length
  const cpl = projectFinishP6 != null ? projectFinishP6 - dataDate : null;
  const ptf = withTF.length ? withTF.filter((r) => r.critical || r.tfDays! <= 0).reduce((m, r) => Math.min(m, r.tfDays!), Infinity) : null;
  const ptfUsed = ptf == null || !Number.isFinite(ptf) ? (withTF.length ? withTF.reduce((m, r) => Math.min(m, r.tfDays!), Infinity) : null) : ptf;
  if (cpl != null && cpl > 0 && ptfUsed != null) {
    const v = (cpl + ptfUsed) / cpl;
    checks.push({ no: 13, id: 'cpli', name: 'CPLI', measure: 'Critical Path Length Index = (remaining critical path length + project total float) ÷ length', count: null, total: null, value: v, kind: 'index', target: '≥ 0.95', status: v >= 0.95 - 1e-9 ? 'pass' : 'fail', items: [] });
  } else na(13, 'cpli', 'CPLI', 'Critical Path Length Index = (remaining critical path length + project total float) ÷ length', 'index', '≥ 0.95', 'Needs the current finish dates and total float.');

  if (due.length) {
    const completed = tasks.filter((r) => r.status === 'Completed').length;
    const v = completed / due.length;
    checks.push({ no: 14, id: 'bei', name: 'BEI', measure: 'Baseline Execution Index = activities completed ÷ activities due by the baseline', count: completed, total: due.length, value: v, kind: 'index', target: '≥ 0.95', status: v >= 0.95 - 1e-9 ? 'pass' : 'fail', items: [] });
  } else na(14, 'bei', 'BEI', 'Baseline Execution Index = activities completed ÷ activities due by the baseline', 'index', '≥ 0.95', 'No activity was due to finish before the data date.');

  return checks.sort((a, b) => a.no - b.no);
}
