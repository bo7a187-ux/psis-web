/**
 * Schedule logic for the quality checks: relationships (from an XER file, or the TASKPRED sheet of a
 * P6 Excel export) and activity constraints (Primary / Secondary Constraint columns).
 * Kept apart from the activity data, so it never changes progress figures or the approval fingerprint.
 */
import { normHeader, headerUnit } from './fields';
import { parseDuration, type DurationUnit, type ImportResult } from './importer';
import type { Grid, RawCell } from './xlsx';

export type RelType = 'FS' | 'SS' | 'FF' | 'SF';
export interface Relation { pred: string; succ: string; type: RelType | string; lag: number | null }

export interface ScheduleLogic {
  /** null = the file has no relationships */
  relations: Relation[] | null;
  relationSheet: string | null;
  /** Activity ID (lower case) -> constraint names; null = no constraint columns */
  constraints: Map<string, string[]> | null;
}

/** Constraints DCMA counts as hard (they override the network logic). */
export const HARD_CONSTRAINTS = new Set(['start on', 'finish on', 'start on or before', 'finish on or before', 'mandatory start', 'mandatory finish', 'must start on', 'must finish on']);
const CODE: Record<string, string> = {
  cs_mso: 'Start On', cs_msoa: 'Start On or After', cs_msob: 'Start On or Before', cs_meo: 'Finish On',
  cs_meoa: 'Finish On or After', cs_meob: 'Finish On or Before', cs_alap: 'As Late As Possible',
  cs_mandstart: 'Mandatory Start', cs_mandfin: 'Mandatory Finish',
};

const text = (c: RawCell) => (c == null ? '' : typeof c === 'object' ? '' : String(c).trim());
const find = (row: RawCell[] | undefined, names: string[]) => {
  const want = names.map(normHeader);
  return (row ?? []).findIndex((c) => typeof c === 'string' && want.includes(normHeader(c)));
};

export function relType(v: string): RelType | string {
  const s = v.trim().toUpperCase().replace(/^PR_/, '');
  if (['FS', 'SS', 'FF', 'SF'].includes(s)) return s as RelType;
  const words = s.replace(/[^A-Z]/g, '');
  if (words === 'FINISHTOSTART') return 'FS';
  if (words === 'STARTTOSTART') return 'SS';
  if (words === 'FINISHTOFINISH') return 'FF';
  if (words === 'STARTTOFINISH') return 'SF';
  return v.trim();
}

/** Relationships: the first sheet (in the first rows) with a Predecessor and a Successor column. */
export function readRelations(sheets: { name: string; rows: Grid }[], unit: DurationUnit, hpd: number): { relations: Relation[]; sheet: string } | null {
  for (const s of sheets) {
    for (let h = 0; h < Math.min(4, s.rows.length); h++) {
      const row = s.rows[h];
      const pi = find(row, ['Predecessor', 'pred_task_id', 'Predecessor ID', 'Predecessor Activity ID']);
      const si = find(row, ['Successor', 'Successor ID', 'Successor Activity ID']);
      if (pi < 0 || si < 0) continue;
      const ti = find(row, ['Relationship Type', 'pred_type', 'Type', 'Relationship']);
      const li = find(row, ['Lag', 'lag_hr_cnt', 'Relationship Lag']);
      const lagUnit = li >= 0 ? headerUnit(String(row[li] ?? '')) ?? (/hr_cnt/i.test(String(row[li])) ? 'Hours' : unit) : unit;
      const relations: Relation[] = [];
      for (let r = h + 1; r < s.rows.length; r++) {
        const x = s.rows[r] ?? [];
        const pred = text(x[pi]), succ = text(x[si]);
        if (!pred || !succ || normHeader(pred) === 'predecessor') continue; // second header row (labels)
        const lag = li >= 0 ? parseDuration(x[li] ?? null, lagUnit, hpd).value : 0;
        relations.push({ pred, succ, type: ti >= 0 ? relType(text(x[ti])) : 'FS', lag });
      }
      return { relations, sheet: s.name };
    }
  }
  return null;
}

/** Constraints from the activity sheet, by Activity ID. */
export function readConstraints(rows: Grid, imp: ImportResult): Map<string, string[]> | null {
  const idCol = imp.matches.id.column;
  if (idCol == null) return null;
  const cols = imp.columns
    .filter((c) => ['primary constraint', 'cstr type', 'secondary constraint', 'cstr type2'].includes(normHeader(c.header1)) || ['primary constraint', 'secondary constraint'].includes(normHeader(c.header2)))
    .map((c) => c.index);
  if (!cols.length) return null;
  const out = new Map<string, string[]>();
  for (const a of imp.activities) {
    const row = rows[a.row - 1] ?? [];
    const vals = cols.map((c) => text(row[c])).filter((v) => v && !/^none$/i.test(v)).map((v) => CODE[v.toLowerCase()] ?? v);
    if (vals.length && a.id) out.set(a.id.toLowerCase(), vals);
  }
  return out;
}

export function readLogic(sheets: { name: string; rows: Grid }[], sheetIndex: number, imp: ImportResult, unit: DurationUnit, hpd: number): ScheduleLogic {
  const rel = readRelations(sheets.filter((_, i) => i !== sheetIndex), unit, hpd);
  return { relations: rel?.relations ?? null, relationSheet: rel?.sheet ?? null, constraints: readConstraints(sheets[sheetIndex]?.rows ?? [], imp) };
}
