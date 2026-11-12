/**
 * Classification (Phase, Discipline, Building, Floor, Location) - same logic as the
 * CLASSIFICATION sheet: a manual override by Activity ID wins; otherwise the FIRST rule
 * (top-down) that sets a value for that dimension and matches the activity wins;
 * otherwise "Unclassified". Each dimension is resolved independently.
 * Matching is case-insensitive, like Excel's =, LEFT() and SEARCH().
 */
import type { Activity } from './types';

export const DIMENSIONS = ['phase', 'discipline', 'building', 'floor', 'location'] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export const DIM_LABEL: Record<Dimension, string> = {
  phase: 'Phase', discipline: 'Discipline', building: 'Building', floor: 'Floor', location: 'Location',
};

/** 'Code: <type>' matches a P6 activity code */
export type RuleField = 'Activity ID' | 'WBS Code' | 'WBS Name' | 'Activity Name' | `Code: ${string}`;
export const CODE_FIELD = 'Code: ';
export const codeField = (type: string): RuleField => `Code: ${type}`;
export type RuleType = 'Starts With' | 'Contains' | 'Equals';
export const RULE_FIELDS: RuleField[] = ['Activity ID', 'WBS Code', 'WBS Name', 'Activity Name'];
export const RULE_TYPES: RuleType[] = ['Starts With', 'Contains', 'Equals'];

export interface Rule {
  field: RuleField;
  type: RuleType;
  text: string;
  values: Partial<Record<Dimension, string>>;
}

export interface Override {
  id: string;
  values: Partial<Record<Dimension, string>>;
}

export interface ClassificationConfig {
  lists: Record<Dimension, string[]>;
  rules: Rule[];
  overrides: Override[];
}

export type Classes = Record<Dimension, string>;

export const UNCLASSIFIED = 'Unclassified';

export function emptyClassification(): ClassificationConfig {
  return { lists: { phase: [], discipline: [], building: [], floor: [], location: [] }, rules: [], overrides: [] };
}

function fieldValue(a: Activity, f: RuleField): string {
  switch (f) {
    case 'Activity ID': return a.id;
    case 'WBS Code': return a.wbs;
    case 'WBS Name': return a.wbsName;
    case 'Activity Name': return a.name;
    default: return f.startsWith(CODE_FIELD) ? a.codes?.[f.slice(CODE_FIELD.length)] ?? '' : a.name;
  }
}

export function ruleMatches(rule: Rule, a: Activity): boolean {
  const text = rule.text.trim().toLowerCase();
  if (!text) return false;
  const v = fieldValue(a, rule.field).toLowerCase();
  if (rule.type === 'Equals') return v === text;
  if (rule.type === 'Starts With') return v.startsWith(text);
  return v.includes(text);
}

export function classify(a: Activity, cfg: ClassificationConfig, overrideIndex?: Map<string, Override>): Classes {
  const idx = overrideIndex ?? indexOverrides(cfg.overrides);
  const ov = idx.get(a.id.toLowerCase());
  const out = {} as Classes;
  for (const d of DIMENSIONS) {
    const o = ov?.values[d]?.trim();
    if (o) { out[d] = o; continue; }
    let val = UNCLASSIFIED;
    for (const r of cfg.rules) {
      const rv = r.values[d]?.trim();
      if (!rv) continue;
      if (ruleMatches(r, a)) { val = rv; break; }
    }
    out[d] = val;
  }
  return out;
}

export function indexOverrides(overrides: Override[]): Map<string, Override> {
  const m = new Map<string, Override>();
  for (const o of overrides) {
    const k = o.id.trim().toLowerCase();
    if (k && !m.has(k)) m.set(k, o);
  }
  return m;
}

/** How many activities each rule matches (shown next to the rule, like the Excel "Matches" column). */
export function ruleMatchCounts(acts: Activity[], rules: Rule[]): number[] {
  return rules.map((r) => acts.filter((a) => ruleMatches(r, a)).length);
}

/** The readable part of a code value: "DIV15 - Mechanical" -> "Mechanical". */
export const codeLabel = (v: string) => { const i = v.indexOf(' - '); return i > 0 ? v.slice(i + 3).trim() || v : v; };

/** One Equals rule per value of a P6 activity code, giving that dimension the code's description. */
export function rulesFromCode(acts: Activity[], type: string, dim: Dimension): { rules: Rule[]; values: string[] } {
  const vals = [...new Set(acts.map((a) => a.codes?.[type]).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return { rules: vals.map((v) => ({ field: codeField(type), type: 'Equals' as RuleType, text: v, values: { [dim]: codeLabel(v) } })), values: [...new Set(vals.map(codeLabel))] };
}
