/**
 * Classification rules made from the WBS: e.g. level 1 -> Phase, level 2 -> Building.
 * WBS names come from the PROJWBS sheet of an XER import, or from the activities themselves.
 */
import type { Activity } from './types';
import type { Grid } from './xlsx';
import type { Dimension, Rule } from './classify';
import { normHeader } from './fields';

export function wbsNames(sheets: { name: string; rows: Grid }[], acts: Activity[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of acts) if (a.wbs && a.wbsName) m.set(a.wbs, a.wbsName);
  const s = sheets.find((x) => /^projwbs/i.test(x.name));
  const h = s?.rows[0] ?? [];
  const ci = h.findIndex((c) => normHeader(c) === 'wbs code'), ni = h.findIndex((c) => normHeader(c) === 'wbs name');
  if (s && ci >= 0 && ni >= 0) for (const r of s.rows.slice(1)) if (r[ci] && r[ni]) m.set(String(r[ci]), String(r[ni]));
  return m;
}

/** The WBS code of an activity cut to a level (1 = first level under the project). */
function levelCode(code: string, level: number, root: boolean): string | null {
  const parts = code.split('.');
  const n = level + (root ? 1 : 0);
  return parts.length >= n ? parts.slice(0, n).join('.') : null;
}

export interface WbsPlan { level: number; dim: Dimension; /** only codes inside this WBS node */ under?: string }

export function rulesFromWbs(acts: Activity[], names: Map<string, string>, plan: WbsPlan[]): { rules: Rule[]; values: Partial<Record<Dimension, string[]>> } {
  const codes = acts.map((a) => a.wbs).filter(Boolean);
  const first = new Set(codes.map((c) => c.split('.')[0]));
  const root = first.size === 1 && codes.some((c) => c.includes('.')); // all codes start with the project node
  const rules: Rule[] = [];
  const values: Partial<Record<Dimension, string[]>> = {};
  for (const { level, dim, under } of plan) {
    const seen = new Set<string>();
    for (const c of codes) {
      const lc = levelCode(c, level, root);
      if (!lc || seen.has(lc) || (under && !lc.startsWith(under + '.'))) continue;
      seen.add(lc);
      const name = (names.get(lc) ?? lc.split('.').pop() ?? lc).trim();
      rules.push({ field: 'WBS Code', type: 'Equals', text: lc, values: { [dim]: name } });
      rules.push({ field: 'WBS Code', type: 'Starts With', text: lc + '.', values: { [dim]: name } });
      (values[dim] ??= []).includes(name) || values[dim]!.push(name);
    }
  }
  return { rules, values };
}

/** Level-1 nodes (code and name), to choose where a level-2 rule applies. */
export function level1Nodes(acts: Activity[], names: Map<string, string>): { code: string; name: string }[] {
  const codes = acts.map((a) => a.wbs).filter(Boolean);
  const root = new Set(codes.map((c) => c.split('.')[0])).size === 1 && codes.some((c) => c.includes('.'));
  const out = new Map<string, string>();
  for (const c of codes) { const lc = levelCode(c, 1, root); if (lc) out.set(lc, names.get(lc) ?? lc); }
  return [...out].map(([code, name]) => ({ code, name }));
}

/** Last rules: every activity gets "General" for any item not set by an earlier rule. */
export function generalRules(acts: Activity[], dims: readonly Dimension[]): Rule[] {
  const firsts = [...new Set(acts.map((a) => a.wbs.split('.')[0]).filter(Boolean))];
  const values = Object.fromEntries(dims.map((d) => [d, 'General'])) as Rule['values'];
  return firsts.flatMap((f) => [
    { field: 'WBS Code' as const, type: 'Equals' as const, text: f, values },
    { field: 'WBS Code' as const, type: 'Starts With' as const, text: f + '.', values },
  ]);
}
