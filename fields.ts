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
}

export const FIELDS: FieldDef[] = [
  { key: 'projectId', label: 'Project ID', kind: 'text', required: false, headers: ['Project ID', 'proj_short_name', 'Project'], group: 'Other methods' },
  { key: 'projectName', label: 'Project Name', kind: 'text', required: false, headers: ['Project Name', 'proj_name'], group: 'Other methods' },
  { key: 'id', label: 'Activity ID', kind: 'text', required: true, headers: ['Activity ID', 'task_code', 'Activity Code'], group: 'Required' },
  { key: 'name', label: 'Activity Name', kind: 'text', required: true, headers: ['Activity Name', 'task_name', 'Description'], group: 'Required' },
  { key: 'status', label: 'Activity Status', kind: 'text', required: false, headers: ['Activity Status', 'status_code', 'Status'], group: 'Recommended' },
  { key: 'wbs', label: 'WBS Code', kind: 'text', required: false, headers: ['WBS Code', 'wbs_id', 'WBS'], group: 'Recommended' },
  { key: 'wbsName', label: 'WBS Name', kind: 'text', required: false, headers: ['WBS Name', 'wbs_name'], group: 'Recommended' },
  { key: 'type', label: 'Activity Type', kind: 'text', required: false, headers: ['Activity Type', 'task_type', 'Type'], group: 'Recommended' },
  { key: 'origDur', label: 'Original Duration', kind: 'duration', required: false, headers: ['Original Duration', 'target_drtn_hr_cnt', 'Orig Dur'], group: 'Recommended' },
  { key: 'remDur', label: 'Remaining Duration', kind: 'duration', required: false, headers: ['Remaining Duration', 'remain_drtn_hr_cnt', 'Rem Dur'], group: 'Other methods' },
  { key: 'actDur', label: 'Actual Duration', kind: 'duration', required: false, headers: ['Actual Duration', 'act_drtn_hr_cnt'], group: 'Other methods' },
  { key: 'totalFloat', label: 'Total Float', kind: 'duration', required: false, headers: ['Total Float', 'total_float_hr_cnt', 'TF'], group: 'Recommended' },
  { key: 'freeFloat', label: 'Free Float', kind: 'duration', required: false, headers: ['Free Float', 'free_float_hr_cnt', 'FF'], group: 'Other methods' },
  { key: 'critical', label: 'Critical', kind: 'flag', required: false, headers: ['Critical', 'driving_path_flag', 'Critical Path'], group: 'Recommended' },
  { key: 'blStart', label: 'Baseline Start', kind: 'date', required: true, headers: ['BL Project Start', 'Baseline Start', 'BL1 Start'], group: 'Required' },
  { key: 'blFinish', label: 'Baseline Finish', kind: 'date', required: true, headers: ['BL Project Finish', 'Baseline Finish', 'BL1 Finish'], group: 'Required' },
  { key: 'start', label: 'Current Start', kind: 'date', required: false, headers: ['Start', 'start_date', 'Current Start'], group: 'Recommended' },
  { key: 'finish', label: 'Current Finish', kind: 'date', required: false, headers: ['Finish', 'end_date', 'Current Finish'], group: 'Recommended' },
  { key: 'actStart', label: 'Actual Start', kind: 'date', required: false, headers: ['Actual Start', 'act_start_date'], group: 'Recommended' },
  { key: 'actFinish', label: 'Actual Finish', kind: 'date', required: false, headers: ['Actual Finish', 'act_end_date'], group: 'Recommended' },
  { key: 'schedPct', label: 'Schedule % Complete (P6 planned)', kind: 'pct', required: false, headers: ['Schedule % Complete', 'Planned % Complete', 'Schedule % Comp'], group: 'Other methods' },
  { key: 'physPct', label: 'Physical % Complete', kind: 'pct', required: false, headers: ['Physical % Complete', 'phys_complete_pct', 'Physical %'], group: 'Recommended' },
  { key: 'durPct', label: 'Duration % Complete', kind: 'pct', required: false, headers: ['Duration % Complete', 'Duration % Comp'], group: 'Other methods' },
  { key: 'unitsPct', label: 'Units % Complete', kind: 'pct', required: false, headers: ['Units % Complete', 'Units % Comp'], group: 'Other methods' },
  { key: 'actPct', label: 'Activity % Complete', kind: 'pct', required: false, headers: ['Activity % Complete', 'complete_pct', 'Activity %'], group: 'Other methods' },
  { key: 'budgetCost', label: 'Budgeted Total Cost', kind: 'number', required: false, headers: ['Budgeted Total Cost', 'target_cost', 'Budget Cost'], group: 'Other methods' },
  { key: 'actualCost', label: 'Actual Total Cost', kind: 'number', required: false, headers: ['Actual Total Cost', 'act_cost', 'Actual Cost'], group: 'Other methods' },
  { key: 'budgetUnits', label: 'Budgeted Labor Units', kind: 'number', required: false, headers: ['Budgeted Labor Units', 'target_work_qty', 'Budget Labor Units'], group: 'Other methods' },
  { key: 'actualUnits', label: 'Actual Labor Units', kind: 'number', required: false, headers: ['Actual Labor Units', 'act_work_qty'], group: 'Other methods' },
];

export const FIELD_BY_KEY: Record<FieldKey, FieldDef> = Object.fromEntries(FIELDS.map((f) => [f.key, f])) as Record<FieldKey, FieldDef>;

/** Every known header name (normalised) - used to detect header rows and unknown columns. */
export function normHeader(s: unknown): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}
