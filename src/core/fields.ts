/**
 * Standard fields the app understands, with the default P6 header names and
 * alternatives (same list as the COLUMN MAPPING sheet of the Excel workbook).
 */
export type FieldKind = 'text' | 'duration' | 'date' | 'pct' | 'number' | 'flag';

export type FieldKey =
  | 'projectId' | 'projectName' | 'id' | 'name' | 'status' | 'wbs' | 'wbsName' | 'type'
  | 'origDur' | 'remDur' | 'actDur' | 'totalFloat' | 'freeFloat' | 'critical'
  | 'blStart' | 'blFinish' | 'start' | 'finish' | 'actStart' | 'actFinish'
  | 'schedPct' | 'physPct' | 'durPct' | 'unitsPct' | 'actPct'
  | 'budgetCost' | 'actualCost' | 'budgetUnits' | 'actualUnits';

export interface FieldDef {
  key: FieldKey;
  label: string;
  kind: FieldKind;
  required: boolean;
  /** Default header name followed by alternatives, tried in this order. */
  headers: string[];
  group: 'Required' | 'Recommended' | 'Other methods';
  /**
   * Last-resort headers, used only when none of `headers` is in the file.
   * A match through one of these is reported to the user as an assumption.
   */
  fallback?: { headers: string[]; note: string };
}

export const FIELDS: FieldDef[] = [
  { key: 'projectId', label: 'Project ID', kind: 'text', required: false, headers: ['Project ID', 'proj_short_name', 'Project', 'proj_id'], group: 'Other methods' },
  { key: 'projectName', label: 'Project Name', kind: 'text', required: false, headers: ['Project Name', 'proj_name', 'proj_id__proj_name'], group: 'Other methods' },
  { key: 'id', label: 'Activity ID', kind: 'text', required: true, headers: ['Activity ID', 'task_code', 'Activity Code', 'ActivityID', 'Act ID', 'Task Code', 'Task ID'], group: 'Required' },
  { key: 'name', label: 'Activity Name', kind: 'text', required: true, headers: ['Activity Name', 'task_name', 'Description', 'Activity Description', 'Task Name'], group: 'Required' },
  { key: 'status', label: 'Activity Status', kind: 'text', required: false, headers: ['Activity Status', 'status_code', 'Status', 'task_status'], group: 'Recommended' },
  { key: 'wbs', label: 'WBS Code', kind: 'text', required: false, headers: ['WBS Code', 'wbs_id', 'WBS', 'WBS Path', 'wbs_short_name'], group: 'Recommended' },
  { key: 'wbsName', label: 'WBS Name', kind: 'text', required: false, headers: ['WBS Name', 'wbs_name', 'wbs_id__wbs_name'], group: 'Recommended' },
  { key: 'type', label: 'Activity Type', kind: 'text', required: false, headers: ['Activity Type', 'task_type', 'Type', 'Task Type'], group: 'Recommended' },
  { key: 'origDur', label: 'Original Duration', kind: 'duration', required: false, headers: ['Original Duration', 'target_drtn_hr_cnt', 'Orig Dur', 'Planned Duration', 'OD', 'Duration'], group: 'Recommended' },
  { key: 'remDur', label: 'Remaining Duration', kind: 'duration', required: false, headers: ['Remaining Duration', 'remain_drtn_hr_cnt', 'Rem Dur', 'RD'], group: 'Other methods' },
  { key: 'actDur', label: 'Actual Duration', kind: 'duration', required: false, headers: ['Actual Duration', 'act_drtn_hr_cnt', 'Act Dur'], group: 'Other methods' },
  { key: 'totalFloat', label: 'Total Float', kind: 'duration', required: false, headers: ['Total Float', 'total_float_hr_cnt', 'TF', 'Total Slack'], group: 'Recommended' },
  { key: 'freeFloat', label: 'Free Float', kind: 'duration', required: false, headers: ['Free Float', 'free_float_hr_cnt', 'FF', 'Free Slack'], group: 'Other methods' },
  { key: 'critical', label: 'Critical', kind: 'flag', required: false, headers: ['Critical', 'driving_path_flag', 'Critical Path', 'crit_flag', 'Longest Path'], group: 'Recommended' },
  { key: 'blStart', label: 'Baseline Start', kind: 'date', required: true, headers: ['BL Project Start', 'Baseline Start', 'BL1 Start', 'BL Start', 'Baseline 1 Start', 'Primary Baseline Start', 'Project Baseline Start', 'base_start_date', 'bsln_start_date'], group: 'Required',
    fallback: { headers: ['Planned Start', 'target_start_date'], note: 'No baseline column in the file, so Planned Start is used. Without an assigned baseline P6 fills BL Project Start from the planned dates - add "BL Project Start" to the P6 export to be sure.' } },
  { key: 'blFinish', label: 'Baseline Finish', kind: 'date', required: true, headers: ['BL Project Finish', 'Baseline Finish', 'BL1 Finish', 'BL Finish', 'Baseline 1 Finish', 'Primary Baseline Finish', 'Project Baseline Finish', 'base_end_date', 'bsln_end_date'], group: 'Required',
    fallback: { headers: ['Planned Finish', 'target_end_date'], note: 'No baseline column in the file, so Planned Finish is used. Without an assigned baseline P6 fills BL Project Finish from the planned dates - add "BL Project Finish" to the P6 export to be sure.' } },
  { key: 'start', label: 'Current Start', kind: 'date', required: false, headers: ['Start', 'start_date', 'Current Start', 'Early Start'], group: 'Recommended' },
  { key: 'finish', label: 'Current Finish', kind: 'date', required: false, headers: ['Finish', 'end_date', 'Current Finish', 'Early Finish'], group: 'Recommended' },
  { key: 'actStart', label: 'Actual Start', kind: 'date', required: false, headers: ['Actual Start', 'act_start_date'], group: 'Recommended' },
  { key: 'actFinish', label: 'Actual Finish', kind: 'date', required: false, headers: ['Actual Finish', 'act_end_date'], group: 'Recommended' },
  { key: 'schedPct', label: 'Schedule % Complete (P6 planned)', kind: 'pct', required: false, headers: ['Schedule % Complete', 'Planned % Complete', 'Schedule % Comp'], group: 'Other methods' },
  { key: 'physPct', label: 'Physical % Complete', kind: 'pct', required: false, headers: ['Physical % Complete', 'phys_complete_pct', 'Physical %', 'Physical Percent Complete'], group: 'Recommended' },
  { key: 'durPct', label: 'Duration % Complete', kind: 'pct', required: false, headers: ['Duration % Complete', 'Duration % Comp'], group: 'Other methods' },
  { key: 'unitsPct', label: 'Units % Complete', kind: 'pct', required: false, headers: ['Units % Complete', 'Units % Comp'], group: 'Other methods' },
  { key: 'actPct', label: 'Activity % Complete', kind: 'pct', required: false, headers: ['Activity % Complete', 'complete_pct', 'Activity %', '% Complete', 'Percent Complete'], group: 'Other methods' },
  { key: 'budgetCost', label: 'Budgeted Total Cost', kind: 'number', required: false, headers: ['Budgeted Total Cost', 'target_cost', 'Budget Cost', 'Budgeted Cost'], group: 'Other methods' },
  { key: 'actualCost', label: 'Actual Total Cost', kind: 'number', required: false, headers: ['Actual Total Cost', 'act_cost', 'Actual Cost', 'act_total_cost'], group: 'Other methods' },
  { key: 'budgetUnits', label: 'Budgeted Labor Units', kind: 'number', required: false, headers: ['Budgeted Labor Units', 'target_work_qty', 'Budget Labor Units', 'Budgeted Units'], group: 'Other methods' },
  { key: 'actualUnits', label: 'Actual Labor Units', kind: 'number', required: false, headers: ['Actual Labor Units', 'act_work_qty', 'Actual Units'], group: 'Other methods' },
];

export const FIELD_BY_KEY: Record<FieldKey, FieldDef> = Object.fromEntries(FIELDS.map((f) => [f.key, f])) as Record<FieldKey, FieldDef>;

/**
 * Normalised header used for matching. Real P6 exports decorate the labels:
 *  - "(*)" in front of read-only fields, e.g. "(*)Total Float"
 *  - a unit at the end, e.g. "Original Duration(d)", "Total Float (h)", "Budgeted Total Cost(SAR)"
 *  - "_" or "-" instead of spaces, odd capitals, line breaks, non-breaking spaces
 * All of that is removed, so "(*)Total Float(d)", "total_float" and "TOTAL FLOAT" match "Total Float".
 */
export function normHeader(s: unknown): string {
  let t = String(s ?? '').replace(/[\u00a0\s]+/g, ' ').trim().toLowerCase();
  t = t.replace(/^\(\s*\*\s*\)\s*|^\*\s*/, ''); // (*) read-only marker
  t = t.replace(/\s*[([][^()[\]]{1,12}[)\]]\s*$/, ''); // trailing unit like (d) (h) (%) (SAR) [days]
  t = t.replace(/[_\-./:]+/g, ' '); // task_code -> "task code" (both sides are normalised the same way)
  return t.replace(/\s*%\s*/g, ' % ').replace(/\s+/g, ' ').trim();
}

/** Unit written in the header itself: "Original Duration(d)" -> 'Days', "Total Float (h)" -> 'Hours'. */
export function headerUnit(...labels: string[]): 'Days' | 'Hours' | null {
  for (const l of labels) {
    const m = String(l ?? '').match(/[([]\s*(d|day|days|h|hr|hrs|hour|hours)\s*[)\]]\s*$/i);
    if (m) return /^d/i.test(m[1]) ? 'Days' : 'Hours';
  }
  return null;
}
