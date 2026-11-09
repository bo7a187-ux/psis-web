/**
 * Minimal, dependency-light XLSX reader (values only).
 * An .xlsx file is a ZIP of XML files; we read the cached cell values,
 * shared strings, sheet names and which cells are formatted as dates.
 * Formulas are not evaluated - P6 exports contain values only.
 */
import { unzipSync, strFromU8 } from 'fflate';

/** A cell value. Date-formatted numeric cells keep their serial in `{ d }`. */
export type RawCell = string | number | boolean | null | { d: number };
export type Grid = RawCell[][];

export interface SheetData {
  name: string;
  rows: Grid;
}

export interface WorkbookData {
  sheets: SheetData[];
  date1904: boolean;
}

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeXml(s: string): string {
  return s
    .replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e: string) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return String.fromCodePoint(code);
      }
      return ENTITY[e];
    })
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

function attr(attrs: string, name: string): string | undefined {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return m ? decodeXml(m[1]) : undefined;
}

/** Concatenate the text of all <t> elements (handles rich-text runs). */
function textOf(xml: string): string {
  let out = '';
  const re = /<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>|<(?:\w+:)?t(?:\s[^>]*)?\/>/g;
  let m: RegExpExecArray | null;
  // ignore phonetic runs <rPh>
  const clean = xml.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '');
  while ((m = re.exec(clean))) out += m[1] ? decodeXml(m[1]) : '';
  return out;
}

export function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90) n = n * 26 + (c - 64);
    else if (c >= 97 && c <= 122) n = n * 26 + (c - 96);
    else break;
  }
  return n - 1;
}

export function colLetter(i: number): string {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export const BUILTIN_DATE_FMTS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

export function isDateFormat(code: string): boolean {
  const s = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
  return /[dmyhs]/i.test(s) && !/^[#0.,%\s]*$/.test(s) && !/General/i.test(s) && /[dy]|m{3,}/i.test(s);
}

function readStyles(xml: string | undefined): boolean[] {
  if (!xml) return [];
  const custom = new Map<number, string>();
  const nf = /<(?:\w+:)?numFmt\b([^>]*)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = nf.exec(xml))) {
    const id = Number(attr(m[1], 'numFmtId'));
    custom.set(id, attr(m[1], 'formatCode') ?? '');
  }
  const xfs = xml.match(/<(?:\w+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cellXfs>/);
  if (!xfs) return [];
  const out: boolean[] = [];
  const xf = /<(?:\w+:)?xf\b([^>]*?)(?:\/>|>)/g;
  while ((m = xf.exec(xfs[1]))) {
    const id = Number(attr(m[1], 'numFmtId') ?? 0);
    out.push(BUILTIN_DATE_FMTS.has(id) || (custom.has(id) && isDateFormat(custom.get(id)!)));
  }
  return out;
}

function resolvePath(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const p of target.split('/')) {
    if (p === '..') parts.pop();
    else if (p !== '.') parts.push(p);
  }
  return parts.join('/');
}

export class XlsxError extends Error {}

export function readXlsx(data: Uint8Array): WorkbookData {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch {
    throw new XlsxError('This file could not be opened as an Excel workbook. If it is password-protected, remove the password in Excel first. If it is an old .xls file, open it in Excel and save it as .xlsx (File > Save As > Excel Workbook).');
  }
  const get = (p: string) => (files[p] ? strFromU8(files[p]) : undefined);
  const wbXml = get('xl/workbook.xml');
  if (!wbXml) throw new XlsxError('This file does not contain an Excel workbook (xl/workbook.xml is missing).');
  const date1904 = /<(?:\w+:)?workbookPr\b[^>]*date1904="(1|true)"/.test(wbXml);

  const rels = new Map<string, string>();
  const relXml = get('xl/_rels/workbook.xml.rels') ?? '';
  for (const m of relXml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = attr(m[1], 'Id');
    const target = attr(m[1], 'Target');
    if (id && target) rels.set(id, resolvePath('xl/workbook.xml', target));
  }

  const shared: string[] = [];
  const ssXml = get('xl/sharedStrings.xml');
  if (ssXml) for (const m of ssXml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>|<(?:\w+:)?si\s*\/>/g)) shared.push(m[1] ? textOf(m[1]) : '');

  const dateStyle = readStyles(get('xl/styles.xml'));

  const sheets: SheetData[] = [];
  for (const m of wbXml.matchAll(/<(?:\w+:)?sheet\b([^>]*)\/?>/g)) {
    const name = attr(m[1], 'name') ?? `Sheet${sheets.length + 1}`;
    const rid = attr(m[1], 'r:id') ?? m[1].match(/\s\w+:id="([^"]*)"/)?.[1];
    const path = rid ? rels.get(rid) : undefined;
    const xml = path ? get(path) : undefined;
    if (!xml) continue; // chart sheets etc.
    sheets.push({ name, rows: parseSheet(xml, shared, dateStyle) });
  }
  return { sheets, date1904 };
}

function parseSheet(xml: string, shared: string[], dateStyle: boolean[]): Grid {
  const rows: Grid = [];
  const data = xml.match(/<(?:\w+:)?sheetData\b[^>]*>([\s\S]*?)<\/(?:\w+:)?sheetData>/);
  if (!data) return rows;
  let nextRow = 0;
  const rowRe = /<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(data[1]))) {
    const rAttr = attr(rm[1], 'r');
    const ri = rAttr ? Number(rAttr) - 1 : nextRow;
    nextRow = ri + 1;
    if (!rm[2]) continue;
    const row: RawCell[] = [];
    let nextCol = 0;
    const cellRe = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[2]))) {
      const ref = attr(cm[1], 'r');
      const ci = ref ? colIndex(ref) : nextCol;
      nextCol = ci + 1;
      if (ci > 16383) continue;
      const t = attr(cm[1], 't') ?? 'n';
      const s = Number(attr(cm[1], 's') ?? 0);
      const inner = cm[2] ?? '';
      const vm = inner.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/);
      const raw = vm ? decodeXml(vm[1]) : undefined;
      let val: RawCell = null;
      if (t === 's') val = raw != null ? shared[Number(raw)] ?? '' : null;
      else if (t === 'inlineStr') val = textOf(inner.replace(/<(?:\w+:)?f\b[\s\S]*?(?:\/>|<\/(?:\w+:)?f>)/, ''));
      else if (t === 'str') val = raw ?? '';
      else if (t === 'b') val = raw === '1' || raw === 'true';
      else if (t === 'e') val = raw ?? '#ERROR';
      else if (t === 'd') val = raw ?? null; // ISO date text; parsed later like any text date
      else if (raw != null && raw !== '') {
        const n = Number(raw);
        val = Number.isFinite(n) ? (dateStyle[s] ? { d: n } : n) : raw;
      }
      if (val === '' ) val = null;
      row[ci] = val;
    }
    for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = null;
    rows[ri] = row;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}

/** RFC-4180 CSV reader (comma, semicolon or tab separated - detected from the first line). */
export function readCsv(text: string): WorkbookData {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const counts = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length] as const);
  const delim = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: Grid = [];
  let row: RawCell[] = [];
  let field = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(field === '' ? null : field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field === '' ? null : field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field === '' ? null : field); rows.push(row); }
  return { sheets: [{ name: 'CSV', rows }], date1904: false };
}
