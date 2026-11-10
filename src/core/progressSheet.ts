/**
 * Excel round trip for actual progress: a template listing the activities (with the P6 value and
 * an empty "Actual %" column) and the reader that takes the filled file back.
 * The reader accepts the English or Arabic headers, a title row above them, values as 45 / 45% /
 * 0.45 (a value between 0 and 1, or a whole column of 0-1 values, is a fraction), and reports every value it cannot use.
 */
import { normHeader } from './fields';
import { parseNumberText } from './importer';
import { fmtDate, type Day } from './dates';
import type { Grid, RawCell } from './xlsx';
import type { XCell, XSheet } from './xlsxWrite';

export const ID_HEADERS = ['Activity ID', 'رمز النشاط', 'task_code', 'Activity Code'];
export const PCT_HEADERS = ['Actual % (enter)', 'النسبة الفعلية (أدخلها)', 'Actual %', 'النسبة الفعلية', 'Actual % Complete', 'Physical % Complete'];

export interface TemplateRow {
  id: string; name: string; wbsName: string; phase: string; building: string; status: string;
  start: Day | null; finish: Day | null; p6: number | null; current: number | null;
}

/** headers are passed in so the file can be in the user's language */
export function progressTemplate(rows: TemplateRow[], dataDate: Day, project: string, h: Record<string, string>): XSheet[] {
  const header = [h.id, h.name, h.wbs, h.phase, h.building, h.status, h.start, h.finish, h.p6, h.actual];
  const data: XCell[][] = rows.map((r) => [
    r.id, r.name, r.wbsName, r.phase, r.building, r.status,
    r.start != null ? { d: r.start } : null, r.finish != null ? { d: r.finish } : null,
    r.p6 != null ? Math.round(r.p6 * 1000) / 10 : null,
    r.current != null ? Math.round(r.current * 1000) / 10 : null,
  ]);
  return [
    { name: 'Progress', header, rows: data, widths: [16, 46, 28, 18, 18, 14, 12, 12, 10, 18] },
    { name: 'Info', header: [h.item, h.value], rows: [[h.project, project], [h.dataDate, fmtDate(dataDate)], [h.howTo, h.howToText]], widths: [22, 90] },
  ];
}

export interface ReadProgress {
  /** Activity ID as written -> fraction 0..1 */
  values: { id: string; pct: number; row: number }[];
  invalid: { row: number; id: string; value: string }[];
  /** the data date written on the Info sheet, if any */
  dataDateText: string | null;
  error?: 'no-columns';
}

const txt = (c: RawCell) => (c == null ? '' : typeof c === 'object' ? '' : String(c).trim());

export function readProgressSheet(sheets: { name: string; rows: Grid }[]): ReadProgress {
  const ids = new Set(ID_HEADERS.map(normHeader)), pcts = PCT_HEADERS.map(normHeader);
  for (const s of sheets) {
    for (let h = 0; h < Math.min(10, s.rows.length); h++) {
      const row = s.rows[h] ?? [];
      const ic = row.findIndex((c) => typeof c === 'string' && ids.has(normHeader(c)));
      if (ic < 0) continue;
      // the most specific "Actual %" header wins (the template column before a generic one)
      let pc = -1;
      for (const want of pcts) { pc = row.findIndex((c) => typeof c === 'string' && normHeader(c) === want); if (pc >= 0) break; }
      if (pc < 0) continue;
      const raw: { id: string; v: number | null; text: string; row: number }[] = [];
      for (let r = h + 1; r < s.rows.length; r++) {
        const x = s.rows[r] ?? [];
        const id = txt(x[ic]);
        const c = x[pc];
        if (!id || c == null || (typeof c === 'string' && c.trim() === '')) continue;
        let v: number | null = null;
        if (typeof c === 'number') v = c;
        else if (typeof c === 'string') { const t = c.trim(); v = parseNumberText(t.endsWith('%') ? t.slice(0, -1) : t); }
        raw.push({ id, v, text: typeof c === 'object' ? '' : String(c), row: r + 1 });
      }
      // a column where every number is between 0 and 1 holds fractions (Excel cells formatted as %)
      const nums = raw.filter((x) => x.v != null && !/%\s*$/.test(x.text)).map((x) => x.v!);
      const fractions = nums.length > 0 && nums.every((v) => v >= 0 && v <= 1) && nums.some((v) => v > 0 && v < 1);
      const values: ReadProgress['values'] = [], invalid: ReadProgress['invalid'] = [];
      for (const x of raw) {
        // a value strictly between 0 and 1 is a fraction (Excel stores a typed "55%" as 0.55);
        // 0.55% progress is not a real entry
        const pct = x.v == null ? null : /%\s*$/.test(x.text) ? x.v / 100 : fractions || (x.v > 0 && x.v < 1) ? x.v : x.v / 100;
        if (pct == null || !Number.isFinite(pct) || pct < 0 || pct > 1.000001) invalid.push({ row: x.row, id: x.id, value: x.text });
        else values.push({ id: x.id, pct: Math.min(1, pct), row: x.row });
      }
      return { values, invalid, dataDateText: infoDataDate(sheets) };
    }
  }
  return { values: [], invalid: [], dataDateText: null, error: 'no-columns' };
}

function infoDataDate(sheets: { name: string; rows: Grid }[]): string | null {
  const want = new Set(['data date', 'تاريخ البيانات']);
  for (const s of sheets) for (const r of s.rows.slice(0, 10)) {
    const i = (r ?? []).findIndex((c) => typeof c === 'string' && want.has(normHeader(c)));
    if (i >= 0 && r[i + 1] != null) return typeof r[i + 1] === 'object' ? fmtDate((r[i + 1] as { d: number }).d) : txt(r[i + 1]);
  }
  return null;
}
