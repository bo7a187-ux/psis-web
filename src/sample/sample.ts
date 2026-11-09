/** SAMPLE DATA - fictional project used to try the app. Clearly labelled everywhere. */
import sampleXlsx from './SAMPLE_P6_Export.xlsx?inline';
import type { ClassificationConfig, Dimension, Rule, RuleField, RuleType } from '../core/classify';
import { fromYMD } from '../core/dates';

export const SAMPLE_FILE_NAME = 'SAMPLE_P6_Export.xlsx';
export const SAMPLE_DATA_DATE = fromYMD(2026, 11, 8)!;
export const SAMPLE_TITLE = 'Sample Hospital Project (SAMPLE DATA)';

export function sampleFileBytes(): Uint8Array {
  const b64 = sampleXlsx.slice(sampleXlsx.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const R: [RuleField, RuleType, string, (string | null)[]][] = [
  ['WBS Code', 'Starts With', 'SMP.ENG', ['Engineering', null, null, null, 'General']],
  ['WBS Code', 'Starts With', 'SMP.CON', ['Construction', null, null, null, null]],
  ['WBS Code', 'Starts With', 'SMP.TC', ['Testing & Commissioning', null, 'General', 'General', 'General']],
  ['WBS Code', 'Starts With', 'SMP.MGT', ['Management', 'General', 'General', 'General', 'General']],
  ['WBS Code', 'Contains', '.ARC', [null, 'Architectural', null, null, null]],
  ['WBS Code', 'Contains', '.STR', [null, 'Structural', null, null, null]],
  ['WBS Code', 'Contains', '.MEC', [null, 'Mechanical', null, null, null]],
  ['WBS Code', 'Contains', '.ELE', [null, 'Electrical', null, null, null]],
  ['WBS Code', 'Contains', '.PLB', [null, 'Plumbing', null, null, null]],
  ['WBS Code', 'Contains', '.FFS', [null, 'Fire Fighting', null, null, null]],
  ['WBS Code', 'Contains', '.MB.', [null, null, 'Main Building', null, 'Inside Building']],
  ['WBS Code', 'Contains', '.UB.', [null, null, 'Utility Building', null, 'Inside Building']],
  ['WBS Code', 'Contains', '.B1.', [null, null, null, 'Basement', null]],
  ['WBS Code', 'Contains', '.GF.', [null, null, null, 'Ground Floor', null]],
  ['WBS Code', 'Contains', '.L1.', [null, null, null, 'Level 1', null]],
  ['WBS Code', 'Contains', '.L2.', [null, null, null, 'Level 2', null]],
  ['WBS Code', 'Contains', '.RF.', [null, null, null, 'Roof', null]],
  ['WBS Code', 'Starts With', 'SMP', ['General', 'General', 'General', 'General', 'General']],
];
const DIMS: Dimension[] = ['phase', 'discipline', 'building', 'floor', 'location'];

export function sampleClassification(): ClassificationConfig {
  const rules: Rule[] = R.map(([field, type, text, vals]) => ({
    field, type, text,
    values: Object.fromEntries(DIMS.map((d, i) => [d, vals[i] ?? ''])) as Rule['values'],
  }));
  return {
    lists: {
      phase: ['Engineering', 'Construction', 'Testing & Commissioning', 'Management', 'General'],
      discipline: ['Architectural', 'Structural', 'Mechanical', 'Electrical', 'Plumbing', 'Fire Fighting', 'General'],
      building: ['Main Building', 'Utility Building', 'General'],
      floor: ['Basement', 'Ground Floor', 'Level 1', 'Level 2', 'Roof', 'General'],
      location: ['Inside Building', 'General'],
    },
    rules,
    overrides: [],
  };
}

import type { Snapshot } from '../core/snapshot';
/** SAMPLE history (Jun-Oct 2026), same overall values as HISTORICAL SNAPSHOTS in the workbook. Stage 4 replaces this with saved snapshots. */
export function sampleHistory(): Snapshot[] {
  const H: [number, number, number, number, number, number, number][] = [
    [30, 6, 0.2873, 0.2873, 21, 6, 55], [31, 7, 0.4011, 0.4011, 31, 5, 46], [31, 8, 0.5589, 0.5589, 42, 10, 30],
    [30, 9, 0.7221, 0.7159, 57, 9, 16], [31, 10, 0.8472, 0.8236, 59, 13, 10],
  ];
  return H.map(([d, m, pl, ac, c, ip, ns]) => {
    const day = fromYMD(2026, m, d)!;
    return { dataDate: day, savedAt: 'sample', activities: [], summary: { dataDate: day, weighting: 'Duration', planned: pl, actual: ac, variance: ac - pl, activities: 82, completed: c, inProgress: ip, notStarted: ns, delayed: null, critical: null, negFloat: null, spi: null, note: 'SAMPLE history' } };
  });
}
