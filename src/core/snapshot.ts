import type { Day } from './dates';

/** Overall (unfiltered) results saved for a month - same columns as HISTORICAL SNAPSHOTS. */
export interface SnapshotSummary {
  dataDate: Day;
  weighting: string;
  planned: number | null;
  actual: number | null;
  variance: number | null;
  activities: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  delayed: number | null;
  critical: number | null;
  negFloat: number | null;
  spi: number | null;
  note: string;
}

/** Activity-level row of a saved month - same columns as SNAPSHOT ACTIVITIES. */
export interface SnapshotActivity {
  id: string;
  project: string;
  phase: string;
  discipline: string;
  building: string;
  floor: string;
  weight: number;
  planned: number | null;
  actual: number | null;
  actualEarned: number;
  blFinish: Day | null;
  fcFinish: Day | null;
}

export interface Snapshot {
  dataDate: Day;
  savedAt: string;
  summary: SnapshotSummary;
  activities: SnapshotActivity[];
}
