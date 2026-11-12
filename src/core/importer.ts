/**
 * Turns a sheet (rows of raw cells) into clean activities using the column mapping.
 * Every value that cannot be read is reported - nothing is guessed or set to zero.
 */
import { FIELDS, FIELD_BY_KEY, normHeader, headerUnit, QUALITY_HEADERS, type FieldKey } from './fields';
import { parseDateText, serialToDay, type NumericDateOrder, type Day } from './dates';
import { colLetter, type Grid, type RawCell } from './xlsx';
import type { Activity, CellIssue } from './types';

export type DurationUnit = 'Days' | 'Hours';
export type PctScaleChoice = 'auto' | 1 | 100;

export interface ImportOptions {
  headerRows: 'auto' | 1 | 2;
  durationUnit: DurationUnit;
  hoursPerDay: number;
  numericDateOrder: NumericDateOrder;
  pctScale: Partial<Record<FieldKey, PctScaleChoice>>;
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  headerRows: 'auto',
  durationUnit: 'Days',
  hoursPerDay: 8,
  numericDateOrder: 'DMY',
  pctScale: {},
};

/** Header names remembered per field (first = highest priority), or ignore = "not in my file". */
export type SavedMapping = Partial<Record<FieldKey, { headers: string[]; ignore?: boolean }>>;

export interface ColumnInfo {
  index: number;
  letter: string;
  header1: string;
  header2: string;
  /** label shown to the user */
  label: string;
}

export interface FieldMatch {
  key: FieldKey;
  column: number | null;
  matchedHeader?: string;
  /** fallback = found only through a last-resort header (see FieldDef.fallback) */
  source: 'saved' | 'default' | 'fallback' | 'none' | 'ignored';
  /** % fields: scale used (1 = values are 0-1, 100 = values are 0-100) */
  scale?: 1 | 100;
  scaleNote?: string;
  note?: string;
  /** duration fields: unit for plain numbers in this column (from the header, else Import options) */
  unit?: DurationUnit;
  unitFromHeader?: boolean;
}

export interface ImportResult {
  sheetName: string;
  headerStart: number; // 0-based row index of the first header row
  headerRows: 1 | 2;
  headerRowsDetected: boolean;
  columns: ColumnInfo[];
  matches: Record<FieldKey, FieldMatch>;
  unusedColumns: ColumnInfo[];
  /** columns used by more than one field */
  sharedColumns: { column: ColumnInfo; fields: FieldKey[] }[];
  activities: Activity[];
  cellIssues: CellIssue[];
  /** activity code types found (XER codes, or text columns of the export that are not mapped to a field) */
  codeTypes: string[];
  /** data rows ignored because they have neither an Activity ID nor a name */
  ignoredRows: number[];
  notes: string[];
}

function cellText(c: RawCell): string {
  if (c == null) return '';
  if (typeof c === 'object') return String(c.d);
  if (typeof c === 'boolean') return c ? 'TRUE' : 'FALSE';
  return String(c).replace(/\s+/g, ' ').trim();
}

/** P6 internal codes (seen in XER-based or field-code exports) -> the labels P6 shows. */
const STATUS_CODES: Record<string, string> = { tk_notstart: 'Not Started', tk_active: 'In Progress', tk_complete: 'Completed' };
const TYPE_CODES: Record<string, string> = {
  tt_task: 'Task Dependent', tt_rsrc: 'Resource Dependent', tt_loe: 'Level of Effort', tt_mile: 'Start Milestone',
  tt_finmile: 'Finish Milestone', tt_wbs: 'WBS Summary',
};
export const p6Status = (t: string) => STATUS_CODES[t.toLowerCase()] ?? t;
export const p6Type = (t: string) => TYPE_CODES[t.toLowerCase()] ?? t;

function rawForReport(c: RawCell): string {
  if (c == null) return '';
  if (typeof c === 'object') return `date serial ${c.d}`;
  return String(c);
}

function knownHeaderSet(saved: SavedMapping): Set<string> {
  const s = new Set<string>();
  for (const f of FIELDS) f.headers.forEach((h) => s.add(normHeader(h)));
  for (const k of Object.keys(saved) as FieldKey[]) saved[k]?.headers.forEach((h) => s.add(normHeader(h)));
  return s;
}

function countKnown(row: RawCell[] | undefined, known: Set<string>): number {
  if (!row) return 0;
  let n = 0;
  for (const c of row) if (typeof c === 'string' && known.has(normHeader(c))) n++;
  return n;
}

/** Find the header row(s): the row (within the first 15) with the most known header names. */
export function detectHeader(rows: Grid, saved: SavedMapping, forced: 'auto' | 1 | 2) {
  const known = knownHeaderSet(saved);
  let best = 0;
  let bestCount = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const n = countKnown(rows[i], known);
    if (n > bestCount) { best = i; bestCount = n; }
  }
  // P6 two-row headers: field codes (task_code ...) then labels (Activity ID ...).
  // If the row above the best row is also a header row, start there.
  if (best > 0 && countKnown(rows[best - 1], known) >= 2) best = best - 1;
  let headerRows: 1 | 2;
  let detected = false;
  if (forced === 'auto') {
    headerRows = countKnown(rows[best + 1], known) >= 2 ? 2 : 1;
    detected = true;
  } else headerRows = forced;
  return { headerStart: best, headerRows, detected, knownCount: bestCount };
}

export function scalePct(values: number[]): { scale: 1 | 100; note?: string } {
  if (!values.length) return { scale: 1 };
  const max = values.reduce((m, v) => Math.max(m, v), -Infinity);
  if (max > 1) return { scale: 100 };
  const allZeroOne = values.every((v) => v === 0 || v === 1);
  if (allZeroOne && values.some((v) => v === 1))
    return { scale: 1, note: 'All values are 0 or 1, so they were read as 0% / 100%. If they mean 1%, set the scale to 0-100.' };
  return { scale: 1 };
}

const CURRENCY = /^(?:[A-Z]{3}|SR|[$€£¥﷼])\s*|\s*(?:[A-Z]{3}|SR|[$€£¥﷼])$/;

export function parseNumberText(text: string, allowHoursSuffix = false): number | null {
  let s = text.trim().replace(CURRENCY, '').trim();
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1).trim(); }
  if (allowHoursSuffix) s = s.replace(/\s*h$/i, '');
  s = s.replace(/,/g, '').replace(/\s/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

/** Duration / float: number (unit from settings) or text like "14d", "112h", "14 days". */
export function parseDuration(c: RawCell, unit: DurationUnit, hpd: number): { value: number | null; error?: string } {
  if (c == null) return { value: null };
  if (typeof c === 'number') return { value: unit === 'Hours' ? c / hpd : c };
  if (typeof c === 'object') return { value: null, error: 'Looks like a date, expected a duration' };
  if (typeof c === 'boolean') return { value: null, error: 'Expected a duration' };
  const s = c.trim().replace(/,/g, '');
  if (s === '') return { value: null };
  const m = s.match(/^([-+]?\d*\.?\d+)\s*([a-z]*)$/i);
  if (!m) return { value: null, error: `Cannot read "${c}" as a duration` };
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  if (u === '') return { value: unit === 'Hours' ? n / hpd : n };
  if (['d', 'day', 'days'].includes(u)) return { value: n };
  if (['h', 'hr', 'hrs', 'hour', 'hours'].includes(u)) return { value: n / hpd };
  return { value: null, error: `Unit "${m[2]}" in "${c}" is not supported - export durations in days or hours` };
}

export function parseDateCell(c: RawCell, date1904: boolean, order: NumericDateOrder): { value: Day | null; error?: string } {
  if (c == null) return { value: null };
  if (typeof c === 'object') {
    const v = serialToDay(c.d, date1904);
    return v == null ? { value: null, error: 'Date out of range' } : { value: v };
  }
  if (typeof c === 'number') {
    const v = serialToDay(c, date1904);
    return v == null ? { value: null, error: `Number ${c} is not a valid date` } : { value: v };
  }
  if (typeof c === 'boolean') return { value: null, error: 'Expected a date' };
  const r = parseDateText(c, order);
  return r.error ? { value: null, error: r.error } : { value: r.value };
}

function pctNumericValues(rows: Grid, col: number, from: number): number[] {
  const out: number[] = [];
  for (let r = from; r < rows.length; r++) {
    const c = rows[r]?.[col];
    if (typeof c === 'number') out.push(c);
    else if (typeof c === 'string' && !c.includes('%')) {
      const n = parseNumberText(c);
      if (n != null) out.push(n);
    }
  }
  return out;
}

export function runImport(
  rows: Grid,
  sheetName: string,
  date1904: boolean,
  saved: SavedMapping,
  opts: ImportOptions,
): ImportResult {
  const notes: string[] = [];
  const { headerStart, headerRows, detected } = detectHeader(rows, saved, opts.headerRows);
  const h1 = rows[headerStart] ?? [];
  const h2 = headerRows === 2 ? rows[headerStart + 1] ?? [] : [];
  const width = Math.max(h1.length, h2.length, ...rows.slice(headerStart, headerStart + 50).map((r) => r?.length ?? 0));
  const columns: ColumnInfo[] = [];
  for (let i = 0; i < width; i++) {
    const a = cellText(h1[i] ?? null);
    const b = cellText(h2[i] ?? null);
    columns.push({ index: i, letter: colLetter(i), header1: a, header2: b, label: b && a ? `${b}  (${a})` : b || a || `(no header)` });
  }
  const dataStart = headerStart + headerRows;

  // ---- match fields to columns
  const matches = {} as Record<FieldKey, FieldMatch>;
  for (const f of FIELDS) {
    const sv = saved[f.key];
    if (sv?.ignore) { matches[f.key] = { key: f.key, column: null, source: 'ignored' }; continue; }
    const candidates: { h: string; src: 'saved' | 'default' }[] = [
      ...(sv?.headers ?? []).map((h) => ({ h, src: 'saved' as const })),
      ...f.headers.map((h) => ({ h, src: 'default' as const })),
    ];
    let found: FieldMatch = { key: f.key, column: null, source: 'none' };
    outer: for (const cand of candidates) {
      const n = normHeader(cand.h);
      if (!n) continue;
      for (const col of columns) {
        if (normHeader(col.header1) === n || (headerRows === 2 && normHeader(col.header2) === n)) {
          found = { key: f.key, column: col.index, matchedHeader: cand.h, source: cand.src };
          break outer;
        }
      }
    }
    if (found.column == null && f.fallback) {
      fb: for (const h of f.fallback.headers) {
        const n = normHeader(h);
        for (const col of columns) {
          if (normHeader(col.header1) === n || (headerRows === 2 && normHeader(col.header2) === n)) {
            found = { key: f.key, column: col.index, matchedHeader: h, source: 'fallback', note: f.fallback.note };
            break fb;
          }
        }
      }
    }
    matches[f.key] = found;
  }

  // ---- % scales and unit hints
  for (const f of FIELDS) {
    const m = matches[f.key];
    if (m.column == null) continue;
    if (f.kind === 'pct') {
      const choice = opts.pctScale[f.key] ?? 'auto';
      if (choice === 'auto') {
        const s = scalePct(pctNumericValues(rows, m.column, dataStart));
        m.scale = s.scale;
        m.scaleNote = s.note;
      } else m.scale = choice;
    }
    if (f.kind === 'duration') {
      const col = columns[m.column];
      const fromHeader = headerUnit(col.header2, col.header1);
      m.unit = fromHeader ?? opts.durationUnit;
      m.unitFromHeader = fromHeader != null;
      let withSuffix = 0;
      for (let r = dataStart; r < rows.length; r++) {
        const c = rows[r]?.[m.column];
        if (typeof c === 'string' && /[a-z]\s*$/i.test(c.trim())) withSuffix++;
      }
      if (withSuffix > 0) m.note = `Values carry their own unit (e.g. "14d" / "112h") - read accordingly.`;
      else if (fromHeader) m.note = `Unit taken from the header: ${fromHeader.toLowerCase()}.`;
    }
  }

  // ---- shared / unused columns
  const byCol = new Map<number, FieldKey[]>();
  for (const f of FIELDS) {
    const c = matches[f.key].column;
    if (c != null) byCol.set(c, [...(byCol.get(c) ?? []), f.key]);
  }
  const sharedColumns = [...byCol.entries()].filter(([, ks]) => ks.length > 1).map(([c, fields]) => ({ column: columns[c], fields }));
  const quality = new Set(QUALITY_HEADERS.map(normHeader));
  const unusedColumns = columns.filter((c) => !byCol.has(c.index) && (c.header1 || c.header2) && !quality.has(normHeader(c.header1)) && !quality.has(normHeader(c.header2)));

  // ---- activity codes: XER "Code: x" columns, or unmapped text columns with repeated values
  const codeCols = unusedColumns.map((c) => ({ c, name: codeColumnName(c, rows, dataStart) })).filter((x): x is { c: ColumnInfo; name: string } => x.name != null);
  const codeTypes = [...new Set(codeCols.map((x) => x.name))];

  // ---- read activities
  const activities: Activity[] = [];
  const cellIssues: CellIssue[] = [];
  const ignoredRows: number[] = [];
  const get = (row: RawCell[], k: FieldKey): RawCell => {
    const c = matches[k].column;
    return c == null ? null : row[c] ?? null;
  };

  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (row.every((c) => c == null || (typeof c === 'string' && c.trim() === ''))) continue;
    const excelRow = r + 1;
    const id = cellText(get(row, 'id'));
    const name = cellText(get(row, 'name'));
    if (!id && !name) { ignoredRows.push(excelRow); continue; }
    const a: Activity = {
      row: excelRow, projectId: '', projectName: '', id, name, status: '', wbs: '', wbsName: '', type: '', critical: '',
      origDur: null, remDur: null, actDur: null, totalFloat: null, freeFloat: null,
      blStart: null, blFinish: null, start: null, finish: null, actStart: null, actFinish: null,
      schedPct: null, physPct: null, durPct: null, unitsPct: null, actPct: null,
      budgetCost: null, actualCost: null, budgetUnits: null, actualUnits: null,
      invalid: {},
    };
    const issue = (k: FieldKey, c: RawCell, problem: string, severity: 'Critical' | 'Warning' | 'Info' = 'Critical') => {
      if (severity === 'Critical') a.invalid[k] = problem;
      cellIssues.push({ row: excelRow, column: colLetter(matches[k].column ?? 0), field: k, activityId: id, value: rawForReport(c), problem, severity });
    };
    for (const f of FIELDS) {
      if (f.key === 'id' || f.key === 'name') continue;
      const c = get(row, f.key);
      if (matches[f.key].column == null) continue;
      const rec = a as unknown as Record<string, unknown>;
      switch (f.kind) {
        case 'text':
          rec[f.key] = f.key === 'status' ? p6Status(cellText(c)) : f.key === 'type' ? p6Type(cellText(c)) : cellText(c);
          break;
        case 'flag':
          rec[f.key] = c === true ? 'Yes' : c === false ? 'No' : cellText(c);
          break;
        case 'duration': {
          const p = parseDuration(c, matches[f.key].unit ?? opts.durationUnit, opts.hoursPerDay);
          if (p.error) issue(f.key, c, p.error);
          rec[f.key] = p.value;
          break;
        }
        case 'date': {
          const p = parseDateCell(c, date1904, opts.numericDateOrder);
          if (p.error) issue(f.key, c, p.error);
          else if (p.value != null && p.value < 32874) issue(f.key, c, 'Date before 1990 - check the value', 'Warning');
          rec[f.key] = p.value;
          break;
        }
        case 'pct': {
          let v: number | null = null;
          if (c == null) v = null;
          else if (typeof c === 'number') v = c / (matches[f.key].scale ?? 1);
          else if (typeof c === 'string') {
            const t = c.trim();
            if (t.endsWith('%')) {
              const n = parseNumberText(t.slice(0, -1));
              if (n == null) issue(f.key, c, `Cannot read "${c}" as a percentage`); else v = n / 100;
            } else {
              const n = parseNumberText(t);
              if (n == null) issue(f.key, c, `Cannot read "${c}" as a percentage`); else v = n / (matches[f.key].scale ?? 1);
            }
          } else issue(f.key, c, 'Expected a percentage');
          if (v != null && (v < 0 || v > 1.000001)) issue(f.key, c, `Outside 0-100% (${(v * 100).toFixed(1)}%) - will be capped`, 'Warning');
          rec[f.key] = v;
          break;
        }
        case 'number': {
          let v: number | null = null;
          if (c == null) v = null;
          else if (typeof c === 'number') v = c;
          else if (typeof c === 'string') {
            v = parseNumberText(c, f.key === 'budgetUnits' || f.key === 'actualUnits');
            if (v == null && c.trim() !== '') issue(f.key, c, `Cannot read "${c}" as a number`);
          } else issue(f.key, c, 'Expected a number');
          rec[f.key] = v;
          break;
        }
      }
    }
    for (const { c, name: cn } of codeCols) {
      const v = cellText(row[c.index] ?? null);
      if (v) (a.codes ??= {})[cn] = v;
    }
    activities.push(a);
  }
  if (ignoredRows.length)
    notes.push(`${ignoredRows.length} row(s) have data but no Activity ID or Activity Name and were ignored (sheet rows ${ignoredRows.slice(0, 10).join(', ')}${ignoredRows.length > 10 ? ', ...' : ''}).`);

  return { sheetName, headerStart, headerRows, headerRowsDetected: detected, columns, matches, unusedColumns, sharedColumns, activities, cellIssues, ignoredRows, notes, codeTypes };
}

const CODE_RE = /^code:\s*/i;
/**
 * Name of an activity code column, or null. XER columns are named "Code: <type>". In an Excel export
 * an unmapped column counts when it holds short text that repeats (codes, calendar, resource...),
 * not numbers, dates or free notes.
 */
function codeColumnName(c: ColumnInfo, rows: Grid, dataStart: number): string | null {
  const label = (c.header2 || c.header1 || '').trim();
  if (CODE_RE.test(c.header1) || CODE_RE.test(c.header2)) return (CODE_RE.test(c.header1) ? c.header1 : c.header2).replace(CODE_RE, '').trim() || null;
  if (!label) return null;
  let n = 0, filled = 0, long = 0;
  const seen = new Set<string>();
  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((x) => x == null || x === '')) continue;
    n++;
    const v = row[c.index];
    if (v == null || (typeof v === 'string' && v.trim() === '')) continue;
    if (typeof v !== 'string' || /^[-+]?[\d.,]+%?$/.test(v.trim())) return null; // numbers, dates, flags
    filled++; seen.add(v.trim());
    if (v.length > 60) long++;
  }
  if (n < 2 || filled < n * 0.3 || long > filled * 0.1) return null;
  return seen.size >= 1 && seen.size <= Math.max(40, n * 0.3) && seen.size < filled ? label : null;
}

/** Rank sheets by how many known headers they contain (P6 exports put activities on "TASK"). */
export function pickSheet(sheets: { name: string; rows: Grid }[], saved: SavedMapping): number {
  const known = knownHeaderSet(saved);
  let best = 0, bestN = -1;
  sheets.forEach((s, i) => {
    let n = 0;
    for (let r = 0; r < Math.min(15, s.rows.length); r++) n = Math.max(n, countKnown(s.rows[r], known));
    if (n > bestN) { best = i; bestN = n; }
  });
  return best;
}

export { FIELD_BY_KEY };

/**
 * Data date written in the workbook, if any: a "Data Date" / "last_recalc_date" header cell
 * (P6 PROJECT sheet, or a title block) with a date next to it or below it.
 */
export function findDataDate(sheets: { name: string; rows: Grid }[], date1904: boolean): Day | null {
  const wanted = new Set(['data date', 'last recalc date', 'reporting data date', 'project data date']);
  for (const s of sheets) {
    for (let r = 0; r < Math.min(40, s.rows.length); r++) {
      const row = s.rows[r] ?? [];
      for (let c = 0; c < row.length; c++) {
        if (typeof row[c] !== 'string' || !wanted.has(normHeader(row[c]))) continue;
        for (const cand of [row[c + 1], s.rows[r + 1]?.[c], s.rows[r + 2]?.[c]]) {
          if (cand == null || cand === '') continue;
          const p = parseDateCell(cand, date1904, 'DMY');
          if (p.value != null && p.value > 32874) return p.value;
        }
      }
    }
  }
  return null;
}

/**
 * Best estimate of the P6 data date from the activities when the file does not state it:
 * P6 moves every unfinished start to the data date or later, and every actual date is before it.
 * Returns the earliest start of a not-started activity (often exactly the data date), bounded by
 * the day after the latest actual date.
 */
export function guessDataDate(acts: Activity[]): { value: Day; latestActual: Day | null; earliestOpenStart: Day | null } | null {
  let latestActual: Day | null = null;
  let earliestOpenStart: Day | null = null;
  for (const a of acts) {
    for (const d of [a.actStart, a.actFinish]) if (d != null && (latestActual == null || d > latestActual)) latestActual = d;
    const notStarted = a.actStart == null && !/complet|progress/i.test(a.status);
    if (notStarted && a.start != null && (earliestOpenStart == null || a.start < earliestOpenStart)) earliestOpenStart = a.start;
  }
  const floor = latestActual != null ? latestActual + 1 : null;
  if (earliestOpenStart != null && (floor == null || earliestOpenStart >= floor)) return { value: earliestOpenStart, latestActual, earliestOpenStart };
  if (floor != null) return { value: floor, latestActual, earliestOpenStart };
  return earliestOpenStart != null ? { value: earliestOpenStart, latestActual, earliestOpenStart } : null;
}
