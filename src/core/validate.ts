/**
 * Data checks - same list and severities as the VALIDATION LOG sheet, plus
 * import-level checks (unread cells, unknown columns, ignored rows).
 * Critical issues block approval.
 */
import { FIELDS, FIELD_BY_KEY } from './fields';
import type { ImportResult } from './importer';
import type { CalcRow } from './engine';
import type { Severity, CellIssue } from './types';
import type { Settings } from './settings';
import { DIMENSIONS, DIM_LABEL, UNCLASSIFIED, type Dimension } from './classify';

export interface Check {
  id: string;
  label: string;
  severity: Severity;
  count: number;
  help: string;
  /** affected activity IDs (or other items) for the drill-down */
  items: string[];
}

export interface ValidationReport {
  checks: Check[];
  criticalCount: number;
  warningCount: number;
  cellIssues: CellIssue[];
  /** per-activity list of issue labels (for the "activities with issues" table) */
  activityIssues: { id: string; row: number; issues: string[] }[];
}

export interface PrevSnapshotInfo {
  /** IDs present in the previous snapshot */
  ids: string[];
}

export function validate(imp: ImportResult, rows: CalcRow[] | null, settings: Settings, prev?: PrevSnapshotInfo, lists?: Record<Dimension, string[]>): ValidationReport {
  const checks: Check[] = [];
  const add = (id: string, label: string, severity: Severity, items: string[], help: string) =>
    checks.push({ id, label, severity, count: items.length, items, help });

  const missingReq = FIELDS.filter((f) => f.required && imp.matches[f.key].column == null).map((f) => f.label);
  add('reqcols', 'Required columns not mapped', 'Critical', missingReq, 'Choose the column for each required field on the Column Mapping step.');
  add('datadate', 'Data date not set', 'Critical', settings.dataDate == null ? ['Data date'] : [], 'Set the reporting data date (usually the P6 Data Date) in Settings.');

  const ids = (pred: (r: CalcRow) => boolean) => (rows ?? []).filter(pred).map((r) => r.a.id || `(row ${r.a.row})`);
  const acts = imp.activities;
  add('noid', 'Missing Activity ID', 'Critical', acts.filter((a) => !a.id).map((a) => `(row ${a.row}) ${a.name}`), 'Rows with data but no Activity ID.');
  const seen = new Map<string, number>();
  acts.forEach((a) => a.id && seen.set(a.id.toLowerCase(), (seen.get(a.id.toLowerCase()) ?? 0) + 1));
  add('dup', 'Duplicate Activity ID', 'Critical', acts.filter((a) => a.id && seen.get(a.id.toLowerCase())! > 1).map((a) => `${a.id} (row ${a.row})`),
    'Each ID must be unique per import - duplicates would be double-counted.');
  add('invalid', 'Invalid date / number values', 'Critical', acts.filter((a) => Object.keys(a.invalid).length).map((a) => a.id || `(row ${a.row})`),
    'Values that could not be read as dates, numbers or percentages. See "Values that could not be read" below.');

  if (rows) {
    add('nobl', 'Missing baseline dates', 'Warning', ids((r) => r.flags.missingBaseline), 'No planned % can be calculated - excluded from planned progress.');
    add('blfb', 'Baseline fallback used', 'Warning', ids((r) => r.flags.baselineFallback), 'Activity not in the selected saved baseline - the import baseline is used instead (or none).');
    add('noprog', 'Missing progress value', 'Warning', ids((r) => r.flags.missingProgress), `The selected Actual % field (${settings.actualSource}) is blank - excluded from actual progress, not treated as zero.`);
    add('nowt', 'Missing weight', 'Warning', ids((r) => r.flags.missingWeight), `No ${settings.weightMethod === 'Duration' ? 'duration' : settings.weightMethod === 'Cost' ? 'budgeted cost' : 'budgeted labor units'} for the selected weighting - this activity has no influence.`);
    add('order', 'Baseline finish before start', 'Warning', ids((r) => r.flags.blFinishBeforeStart), 'Check the baseline dates in P6.');
    add('ucls', 'Unclassified activities', 'Warning', ids((r) => r.flags.unclassified), 'Add a rule or a manual override on Classification.');
    if (lists) {
      const bad: string[] = [];
      for (const r of rows) {
        if (!r.included) continue;
        for (const d of DIMENSIONS) {
          const v = r.cls[d];
          const list = lists[d].map((x) => x.toLowerCase());
          if (v !== UNCLASSIFIED && list.length && !list.includes(v.toLowerCase())) bad.push(`${r.a.id}: ${DIM_LABEL[d]} "${v}"`);
        }
      }
      add('notinlist', 'Classification value not in the list', 'Warning', bad, 'A rule or override gives a value that is not in the lists on Classification (often a typing difference). Dashboards would show it as a separate group.');
    }
    add('noas', 'Progress without Actual Start', 'Warning', ids((r) => r.flags.progressWithoutAS), 'Progress reported but no actual start date.');
    add('noaf', 'Completed without Actual Finish', 'Warning', ids((r) => r.flags.completedWithoutAF), 'Status says completed but there is no actual finish.');
    add('afpct', 'Actual Finish but % < 100', 'Info', ids((r) => r.flags.afButPctBelow100), settings.afAsComplete ? 'Counted as 100% because "Activities with Actual Finish count as 100%" is Yes.' : 'Uses the % value because "Actual Finish = 100%" is No.');
    add('estdates', 'Actual dates estimated for your entries', 'Info',
      rows.filter((r) => r.a.estimated?.length).map((r) => `${r.a.id}: ${r.a.estimated!.map((k) => (k === 'as' ? 'AS' : 'AF')).join(' + ')}`),
      'The P6 file has no actual date for these entries, so an estimate is used (finish = the day before the data date). Type the real date on Enter actual progress, and enter it in P6 at the next update.');
    add('future', 'Actual dates on/after Data Date', 'Warning', ids((r) => r.flags.actualAfterDataDate), 'Actual dates cannot be on or after the data date (the data date is the start of the day).');
    add('summ', 'Excluded: WBS Summary', 'Info', ids((r) => r.isSummary), 'Never counted, to avoid double-counting.');
    add('loe', 'Excluded: Level of Effort', 'Info', settings.includeLOE ? [] : ids((r) => r.isLOE && !r.isSummary), 'Controlled by Settings.');
    if (prev) {
      const cur = new Set(acts.map((a) => a.id.toLowerCase()));
      const prevSet = new Set(prev.ids.map((i) => i.toLowerCase()));
      add('new', 'New since previous snapshot', 'Info', ids((r) => r.included && !prevSet.has(r.a.id.toLowerCase())), 'Activities not present in the previous saved period.');
      add('removed', 'Removed since previous snapshot', 'Info', prev.ids.filter((i) => !cur.has(i.toLowerCase())), 'In the previous period but not in this import.');
      add('blchg', 'Baseline finish changed vs previous', 'Info', ids((r) => r.blFinishChanged), 'Baseline finish differs from the previous saved period.');
    }
  }

  const warnCells = imp.cellIssues.filter((c) => c.severity !== 'Critical');
  add('cellwarn', 'Values outside the expected range', 'Warning', warnCells.map((c) => `${c.activityId || '(row ' + c.row + ')'}: ${FIELD_BY_KEY[c.field].label} - ${c.problem}`), 'Read, but worth checking (e.g. % above 100, very old dates).');
  add('ignored', 'Rows ignored (no ID and no name)', 'Info', imp.ignoredRows.map((r) => `sheet row ${r}`), 'These rows contain some data but neither an Activity ID nor an Activity Name.');
  add('unused', 'Columns in the file not used', 'Info', imp.unusedColumns.map((c) => `${c.letter}: ${c.label}`), 'Not needed by any calculation. If one of them holds a field you need, map it on Column Mapping.');
  add('shared', 'One column used for two fields', 'Warning', imp.sharedColumns.map((s) => `${s.column.letter}: ${s.fields.map((f) => FIELD_BY_KEY[f].label).join(' + ')}`), 'Usually a mapping mistake - check Column Mapping.');

  const criticalCount = checks.filter((c) => c.severity === 'Critical').reduce((n, c) => n + c.count, 0);
  const warningCount = checks.filter((c) => c.severity === 'Warning').reduce((n, c) => n + c.count, 0);

  const activityIssues: ValidationReport['activityIssues'] = [];
  if (rows) {
    const labels: [keyof CalcRow['flags'], string][] = [
      ['missingId', 'Missing ID'], ['duplicateId', 'Duplicate ID'], ['invalidValue', 'Invalid value'], ['missingBaseline', 'Missing baseline'],
      ['baselineFallback', 'Baseline fallback'], ['missingProgress', 'Missing progress'], ['missingWeight', 'Missing weight'],
      ['blFinishBeforeStart', 'BL finish < start'], ['unclassified', 'Unclassified'], ['progressWithoutAS', 'Progress w/o actual start'],
      ['completedWithoutAF', 'Completed w/o actual finish'], ['actualAfterDataDate', 'Actual date >= data date'], ['afButPctBelow100', 'Actual finish but % < 100'],
    ];
    for (const r of rows) {
      const iss = labels.filter(([k]) => r.flags[k]).map(([, l]) => l);
      if (r.flags.invalidValue) for (const [k, p] of Object.entries(r.a.invalid)) iss.push(`${FIELD_BY_KEY[k as keyof typeof FIELD_BY_KEY].label}: ${p}`);
      if (iss.length) activityIssues.push({ id: r.a.id, row: r.a.row, issues: iss });
    }
  }
  return { checks, criticalCount, warningCount, cellIssues: imp.cellIssues, activityIssues };
}
