/**
 * Dates are stored as whole-day serial numbers, the same system Excel uses
 * (1 = 01-Jan-1900, 1900 date system). This keeps every calculation identical
 * to the workbook and avoids time-zone problems: there is no time of day.
 */
export type Day = number;

const MS_PER_DAY = 86400000;
const EXCEL_EPOCH_OFFSET = 25569; // serial of 01-Jan-1970

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LOOKUP: Record<string, number> = {};
MONTHS.forEach((m, i) => (MONTH_LOOKUP[m.toLowerCase()] = i + 1));
['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
  .forEach((m, i) => (MONTH_LOOKUP[m] = i + 1));
MONTH_LOOKUP['sept'] = 9;

export function fromYMD(y: number, m: number, d: number): Day | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null; // e.g. 31-Feb
  return Math.round(t / MS_PER_DAY) + EXCEL_EPOCH_OFFSET;
}

export function toYMD(day: Day): { y: number; m: number; d: number } {
  const dt = new Date((day - EXCEL_EPOCH_OFFSET) * MS_PER_DAY);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** dd-Mmm-yy, e.g. 08-Nov-26 (the format used everywhere in the app). */
export function fmtDate(day: Day | null | undefined): string {
  if (day == null || !Number.isFinite(day)) return '';
  const { y, m, d } = toYMD(day);
  return `${String(d).padStart(2, '0')}-${MONTHS[m - 1]}-${String(y % 100).padStart(2, '0')}`;
}

/** dd-Mmm-yyyy for places where the full year avoids ambiguity (e.g. typed confirmations). */
export function fmtDateLong(day: Day | null | undefined): string {
  if (day == null || !Number.isFinite(day)) return '';
  const { y, m, d } = toYMD(day);
  return `${String(d).padStart(2, '0')}-${MONTHS[m - 1]}-${y}`;
}

export function todayDay(): Day {
  const n = new Date();
  return fromYMD(n.getFullYear(), n.getMonth() + 1, n.getDate())!;
}

/** Excel serial -> valid day, or null when outside Excel's date range. */
export function serialToDay(n: number, date1904 = false): Day | null {
  if (!Number.isFinite(n)) return null;
  const v = Math.floor(n) + (date1904 ? 1462 : 0);
  if (v < 1 || v > 2958465) return null;
  return v;
}

function year2(y: number): number {
  // Excel convention: 00-29 -> 2000-2029, 30-99 -> 1930-1999
  return y < 30 ? 2000 + y : 1900 + y;
}

export type NumericDateOrder = 'DMY' | 'MDY';

export interface DateParse {
  value: Day | null;
  /** set when the text was not empty but could not be read */
  error?: string;
}

/**
 * Read a date written as text. P6 markers are removed first:
 *  " A" (actual), "*" (constraint), and a time of day such as "08:00".
 * Accepted: 08-Nov-26, 8-Nov-2026, 08 Nov 26, 08-November-2026, Nov 8, 2026,
 * 2026-11-08 (ISO), and numeric dd/mm/yyyy (or mm/dd/yyyy if chosen).
 * Anything else is reported, never guessed.
 */
export function parseDateText(text: string, order: NumericDateOrder = 'DMY'): DateParse {
  let s = String(text).trim();
  if (s === '') return { value: null };
  s = s.replace(/\*/g, ' ').trim();
  s = s.replace(/\s+A$/i, '').trim(); // actual marker
  s = s.replace(/[T\s]\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?\s*(AM|PM)?\s*(Z|[+-]\d{2}:?\d{2})?$/i, '').trim(); // time of day
  s = s.replace(/\s+A$/i, '').trim();
  let m: RegExpMatchArray | null;

  // 08-Nov-26 / 8 Nov 2026 / 08-November-2026 / 08.Nov.26
  if ((m = s.match(/^(\d{1,2})[-\s./]+([A-Za-z]{3,9})\.?[-\s.,/]+(\d{2}|\d{4})$/))) {
    const mon = MONTH_LOOKUP[m[2].toLowerCase()];
    if (!mon) return { value: null, error: `Unknown month "${m[2]}"` };
    const y = m[3].length === 2 ? year2(+m[3]) : +m[3];
    const v = fromYMD(y, mon, +m[1]);
    return v == null ? { value: null, error: 'Not a real calendar date' } : { value: v };
  }
  // Nov 8, 2026 / November 08 2026
  if ((m = s.match(/^([A-Za-z]{3,9})\.?[-\s]+(\d{1,2}),?[-\s]+(\d{2}|\d{4})$/))) {
    const mon = MONTH_LOOKUP[m[1].toLowerCase()];
    if (!mon) return { value: null, error: `Unknown month "${m[1]}"` };
    const y = m[3].length === 2 ? year2(+m[3]) : +m[3];
    const v = fromYMD(y, mon, +m[2]);
    return v == null ? { value: null, error: 'Not a real calendar date' } : { value: v };
  }
  // ISO 2026-11-08 or 2026/11/08
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) {
    const v = fromYMD(+m[1], +m[2], +m[3]);
    return v == null ? { value: null, error: 'Not a real calendar date' } : { value: v };
  }
  // numeric dd/mm/yyyy or mm/dd/yyyy
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) {
    const a = +m[1], b = +m[2];
    const y = m[3].length === 2 ? year2(+m[3]) : +m[3];
    const [d, mon] = order === 'DMY' ? [a, b] : [b, a];
    if (mon > 12) {
      return { value: null, error: `"${text}" does not fit the ${order === 'DMY' ? 'day/month/year' : 'month/day/year'} order chosen for numeric dates` };
    }
    const v = fromYMD(y, mon, d);
    return v == null ? { value: null, error: 'Not a real calendar date' } : { value: v };
  }
  return { value: null, error: `Unrecognised date format "${text}"` };
}
