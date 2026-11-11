import type { Day } from './dates';
import type { FieldKey } from './fields';

/** One activity after cleaning. Missing values are null - never zero. */
export interface Activity {
  /** row number in the source sheet as Excel shows it (1-based) */
  row: number;
  projectId: string;
  projectName: string;
  id: string;
  name: string;
  status: string;
  wbs: string;
  wbsName: string;
  type: string;
  critical: string;
  /** durations and float in DAYS (converted from hours when needed) */
  origDur: number | null;
  remDur: number | null;
  actDur: number | null;
  totalFloat: number | null;
  freeFloat: number | null;
  blStart: Day | null;
  blFinish: Day | null;
  start: Day | null;
  finish: Day | null;
  actStart: Day | null;
  actFinish: Day | null;
  /** percentages as fractions (0.45 = 45%), not capped - capping happens in the engine */
  schedPct: number | null;
  physPct: number | null;
  durPct: number | null;
  unitsPct: number | null;
  actPct: number | null;
  budgetCost: number | null;
  actualCost: number | null;
  budgetUnits: number | null;
  actualUnits: number | null;
  /** fields whose value could not be read (shown as Invalid) */
  invalid: Partial<Record<FieldKey, string>>;
  /** actual dates estimated by the app for a progress entry (not in the P6 file) */
  estimated?: ('as' | 'af')[];
}

export type Severity = 'Critical' | 'Warning' | 'Info';

export interface CellIssue {
  row: number;
  column: string;
  field: FieldKey;
  activityId: string;
  value: string;
  problem: string;
  severity: Severity;
}
