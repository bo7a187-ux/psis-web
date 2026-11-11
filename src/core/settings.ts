import type { Day } from './dates';

export type WeightMethod = 'Duration' | 'Cost' | 'Man-hours';
export type PlannedMethod = 'Linear (Baseline dates)' | 'P6 Schedule % Complete';
export type ActualSource = 'Physical % Complete' | 'Duration % Complete' | 'Units % Complete' | 'Activity % Complete';
export type CritRule = 'P6 Critical flag' | 'Total Float <= 0';
export type BaselineUse = 'Original (saved)' | 'Revised (saved)' | 'Current import';
export type ForecastMethod = 'Conservative (later of P6 and performance)' | 'P6 Current Finish' | 'Performance-based';

export const WEIGHT_METHODS: WeightMethod[] = ['Duration', 'Cost', 'Man-hours'];
export const PLANNED_METHODS: PlannedMethod[] = ['Linear (Baseline dates)', 'P6 Schedule % Complete'];
export const ACTUAL_SOURCES: ActualSource[] = ['Physical % Complete', 'Duration % Complete', 'Units % Complete', 'Activity % Complete'];
export const CRIT_RULES: CritRule[] = ['P6 Critical flag', 'Total Float <= 0'];
export const BASELINE_USES: BaselineUse[] = ['Original (saved)', 'Revised (saved)', 'Current import'];
export const FORECAST_METHODS: ForecastMethod[] = ['Conservative (later of P6 and performance)', 'P6 Current Finish', 'Performance-based'];

/** Calculation settings - same names and defaults as the SETTINGS sheet. */
export interface Settings {
  projectTitle: string;
  dataDate: Day | null;
  weightMethod: WeightMethod;
  plannedMethod: PlannedMethod;
  actualSource: ActualSource;
  afAsComplete: boolean;
  includeLOE: boolean;
  /** fraction: 0.05 = 5 percentage points */
  tolerance: number;
  lowFloat: number;
  critRule: CritRule;
  baselineUse: BaselineUse;
  /** '' = latest revision */
  revisionUse: string;
  forecastMethod: ForecastMethod;
  amberDays: number;
  redDays: number;
  amberPP: number;
  redPP: number;
  amberSPI: number;
  redSPI: number;
  /** SPI(t) (earned schedule) counts in the health colour with the SPI limits. Missing = yes. */
  spiTHealth?: boolean;
  costCoverage: number;
}

export const DEFAULT_SETTINGS: Settings = {
  projectTitle: '',
  dataDate: null,
  weightMethod: 'Duration',
  plannedMethod: 'Linear (Baseline dates)',
  actualSource: 'Physical % Complete',
  afAsComplete: true,
  includeLOE: false,
  tolerance: 0.05,
  lowFloat: 10,
  critRule: 'P6 Critical flag',
  baselineUse: 'Original (saved)',
  revisionUse: '',
  forecastMethod: 'Conservative (later of P6 and performance)',
  amberDays: 0,
  redDays: 30,
  amberPP: 0.05,
  redPP: 0.1,
  amberSPI: 0.95,
  redSPI: 0.9,
  spiTHealth: true,
  costCoverage: 0.95,
};

import type { FieldKey } from './fields';
export const ACTUAL_FIELD: Record<ActualSource, FieldKey> = {
  'Physical % Complete': 'physPct',
  'Duration % Complete': 'durPct',
  'Units % Complete': 'unitsPct',
  'Activity % Complete': 'actPct',
};
