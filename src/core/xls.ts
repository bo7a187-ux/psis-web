/**
 * Reader for old-style Excel 97-2003 .xls files (BIFF8 inside an OLE2 compound file), values only.
 * Older Primavera P6 versions export this format. Reads cell values, the shared string table,
 * sheet names and which cells are formatted as dates - the same output as readXlsx.
 */
import { BUILTIN_DATE_FMTS, isDateFormat, XlsxError, type Grid, type RawCell, type SheetData, type WorkbookData } from './xlsx';

const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;

/** Minimal OLE2 / Compound File Binary reader: returns the bytes of one named stream. */
function readCfbStream(buf: Uint8Array, names: string[]): Uint8Array | null {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const sigOk = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((b, i) => buf[i] === b);
  if (!sigOk) return null;
  const secSize = 1 << dv.getUint16(0x1e, true);
  const miniSize = 1 << dv.getUint16(0x20, true);
  const firstDir = dv.getUint32(0x30, true);
  const miniCutoff = dv.getUint32(0x38, true);
  const firstMiniFat = dv.getUint32(0x3c, true);
  const firstDifat = dv.getUint32(0x44, true);
  const nDifat = dv.getUint32(0x48, true);
  const secOff = (s: number) => (s + 1) * secSize;
  const u32 = (off: number) => (off + 4 <= buf.length ? dv.getUint32(off, true) : FREESECT);

  // FAT sector list: 109 entries in the header, then DIFAT sectors
  const fatSecs: number[] = [];
  for (let i = 0; i < 109; i++) { const s = u32(0x4c + i * 4); if (s < ENDOFCHAIN) fatSecs.push(s); }
  let d = firstDifat;
  for (let n = 0; n < nDifat && d < ENDOFCHAIN; n++) {
    const per = secSize / 4 - 1;
    for (let i = 0; i < per; i++) { const s = u32(secOff(d) + i * 4); if (s < ENDOFCHAIN) fatSecs.push(s); }
    d = u32(secOff(d) + per * 4);
  }
  const fat: number[] = [];
  for (const s of fatSecs) for (let i = 0; i < secSize / 4; i++) fat.push(u32(secOff(s) + i * 4));

  const chain = (start: number, table: number[]) => {
    const out: number[] = [];
    const seen = new Set<number>();
    for (let s = start; s < ENDOFCHAIN && s < table.length && !seen.has(s); s = table[s]) { seen.add(s); out.push(s); }
    return out;
  };
  const readChain = (start: number, size: number) => {
    const out = new Uint8Array(size);
    let pos = 0;
    for (const s of chain(start, fat)) {
      const n = Math.min(secSize, size - pos);
      if (n <= 0) break;
      out.set(buf.subarray(secOff(s), secOff(s) + n), pos);
      pos += n;
    }
    return out.subarray(0, pos);
  };

  // directory
  const dirSecs = chain(firstDir, fat);
  const entries: { name: string; type: number; start: number; size: number }[] = [];
  for (const s of dirSecs) {
    for (let i = 0; i < secSize / 128; i++) {
      const o = secOff(s) + i * 128;
      if (o + 128 > buf.length) break;
      const nameLen = dv.getUint16(o + 0x40, true);
      let name = '';
      for (let j = 0; j + 2 < nameLen; j += 2) name += String.fromCharCode(dv.getUint16(o + j, true));
      entries.push({ name, type: buf[o + 0x42], start: dv.getUint32(o + 0x74, true), size: dv.getUint32(o + 0x78, true) });
    }
  }
  const root = entries.find((e) => e.type === 5);
  const entry = entries.find((e) => e.type === 2 && names.includes(e.name));
  if (!entry) return null;
  if (entry.size >= miniCutoff || !root) return readChain(entry.start, entry.size);

  // small stream: stored in the mini stream (held by the root entry)
  const miniStream = readChain(root.start, root.size);
  const miniFat: number[] = [];
  for (const s of chain(firstMiniFat, fat)) for (let i = 0; i < secSize / 4; i++) miniFat.push(u32(secOff(s) + i * 4));
  const out = new Uint8Array(entry.size);
  let pos = 0;
  for (const s of chain(entry.start, miniFat)) {
    const n = Math.min(miniSize, entry.size - pos);
    if (n <= 0) break;
    out.set(miniStream.subarray(s * miniSize, s * miniSize + n), pos);
    pos += n;
  }
  return out.subarray(0, pos);
}

interface Rec { type: number; data: Uint8Array; offset: number }

function records(stream: Uint8Array): Rec[] {
  const out: Rec[] = [];
  const dv = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  let p = 0;
  while (p + 4 <= stream.length) {
    const type = dv.getUint16(p, true);
    const len = dv.getUint16(p + 2, true);
    out.push({ type, data: stream.subarray(p + 4, p + 4 + len), offset: p });
    p += 4 + len;
  }
  return out;
}

/** Reads strings that may continue into CONTINUE records (each continuation restarts with a flags byte). */
class SegReader {
  private seg = 0;
  private pos = 0;
  constructor(private segs: Uint8Array[]) {}
  private ensure() {
    while (this.seg < this.segs.length && this.pos >= this.segs[this.seg].length) { this.seg++; this.pos = 0; }
  }
  get done() { this.ensure(); return this.seg >= this.segs.length; }
  u8() { this.ensure(); return this.seg < this.segs.length ? this.segs[this.seg][this.pos++] : 0; }
  u16() { return this.u8() | (this.u8() << 8); }
  u32() { return (this.u16() | (this.u16() << 16)) >>> 0; }
  skip(n: number) { for (let i = 0; i < n; i++) this.u8(); }
  /** characters: when a run crosses into the next record, a new flags byte says 8- or 16-bit */
  chars(cch: number, high: boolean): string {
    let s = '';
    let wide = high;
    let lastSeg = this.seg;
    for (let i = 0; i < cch; i++) {
      this.ensure();
      if (this.seg >= this.segs.length) break;
      if (this.seg !== lastSeg && this.pos === 0) wide = (this.u8() & 1) === 1; // characters continue in a CONTINUE record
      lastSeg = this.seg;
      s += String.fromCharCode(wide ? this.u16() : this.u8());
    }
    return s;
  }
  unicodeString(cchBytes: 1 | 2): string {
    const cch = cchBytes === 1 ? this.u8() : this.u16();
    const flags = this.u8();
    const rich = flags & 0x08 ? this.u16() : 0;
    const ext = flags & 0x04 ? this.u32() : 0;
    const s = this.chars(cch, (flags & 1) === 1);
    this.skip(rich * 4 + ext);
    return s;
  }
}

function rk(v: number): number {
  let n: number;
  if (v & 0x02) n = v >> 2; // 30-bit signed integer
  else {
    const b = new DataView(new ArrayBuffer(8));
    b.setUint32(0, 0, true);
    b.setUint32(4, (v & 0xfffffffc) >>> 0, true);
    n = b.getFloat64(0, true);
  }
  return v & 0x01 ? n / 100 : n;
}

export function readXls(data: Uint8Array): WorkbookData {
  const stream = readCfbStream(data, ['Workbook', 'Book']);
  if (!stream) throw new XlsxError('This .xls file could not be opened (no Excel workbook inside). Open it in Excel and save it as .xlsx.');
  const recs = records(stream);
  if (!recs.length || recs[0].type !== 0x0809) throw new XlsxError('This .xls file is not a valid Excel workbook.');
  const bofVer = recs[0].data[0] | (recs[0].data[1] << 8);
  if (bofVer !== 0x0600) throw new XlsxError('This .xls file is from Excel 95 or older, which cannot be read. Open it in Excel and save it as .xlsx.');

  let date1904 = false;
  const sst: string[] = [];
  const formats = new Map<number, string>();
  const xfFmt: number[] = [];
  const bound: { name: string; pos: number; visibleSheet: boolean }[] = [];

  // workbook globals: until the first EOF
  let i = 1;
  for (; i < recs.length; i++) {
    const r = recs[i];
    const dv = new DataView(r.data.buffer, r.data.byteOffset, r.data.byteLength);
    if (r.type === 0x000a) break; // EOF
    if (r.type === 0x002f) throw new XlsxError('This .xls file is password-protected. Remove the password in Excel, save as .xlsx, and choose the new file.');
    if (r.type === 0x0022) date1904 = dv.getUint16(0, true) === 1;
    else if (r.type === 0x041e) {
      const rd = new SegReader([r.data]);
      const id = rd.u16();
      formats.set(id, rd.unicodeString(2));
    } else if (r.type === 0x00e0) xfFmt.push(dv.getUint16(2, true));
    else if (r.type === 0x0085) {
      const pos = dv.getUint32(0, true);
      const dt = r.data[5];
      const rd = new SegReader([r.data.subarray(6)]);
      bound.push({ name: rd.unicodeString(1), pos, visibleSheet: dt === 0 });
    } else if (r.type === 0x00fc) {
      const segs = [r.data.subarray(8)];
      for (let j = i + 1; j < recs.length && recs[j].type === 0x003c; j++) segs.push(recs[j].data);
      const total = dv.getUint32(4, true);
      const rd = new SegReader(segs);
      for (let k = 0; k < total && !rd.done; k++) sst.push(rd.unicodeString(2));
    }
  }
  const isDateXf = (xf: number) => {
    const f = xfFmt[xf];
    if (f == null) return false;
    return BUILTIN_DATE_FMTS.has(f) || (f >= 27 && f <= 36) || (f >= 50 && f <= 58) || (formats.has(f) && isDateFormat(formats.get(f)!));
  };

  const byOffset = new Map<number, number>();
  recs.forEach((r, k) => byOffset.set(r.offset, k));
  const sheets: SheetData[] = [];
  for (const b of bound) {
    if (!b.visibleSheet) continue; // chart / macro sheets
    const start = byOffset.get(b.pos);
    if (start == null) continue;
    const rows: Grid = [];
    const put = (r: number, c: number, v: RawCell) => {
      if (c > 16383) return;
      (rows[r] ??= [])[c] = v === '' ? null : v;
    };
    const num = (r: number, c: number, xf: number, v: number) => put(r, c, isDateXf(xf) ? { d: v } : v);
    let pendingString: [number, number] | null = null;
    for (let k = start + 1; k < recs.length; k++) {
      const r = recs[k];
      if (r.type === 0x000a) break;
      const dv = new DataView(r.data.buffer, r.data.byteOffset, r.data.byteLength);
      if (r.data.length < 6 && r.type !== 0x0207) continue;
      const row = r.data.length >= 2 ? dv.getUint16(0, true) : 0;
      const col = r.data.length >= 4 ? dv.getUint16(2, true) : 0;
      switch (r.type) {
        case 0x00fd: put(row, col, sst[dv.getUint32(6, true)] ?? ''); break; // LABELSST
        case 0x0203: num(row, col, dv.getUint16(4, true), dv.getFloat64(6, true)); break; // NUMBER
        case 0x027e: num(row, col, dv.getUint16(4, true), rk(dv.getUint32(6, true))); break; // RK
        case 0x00bd: { // MULRK
          const last = dv.getUint16(r.data.length - 2, true);
          for (let c = col, o = 4; c <= last; c++, o += 6) num(row, c, dv.getUint16(o, true), rk(dv.getUint32(o + 2, true)));
          break;
        }
        case 0x0204: case 0x00d6: { // LABEL, RSTRING
          const rd = new SegReader([r.data.subarray(6)]);
          put(row, col, rd.unicodeString(2));
          break;
        }
        case 0x0205: { // BOOLERR
          const v = r.data[6];
          put(row, col, r.data[7] ? '#ERROR' : v === 1);
          break;
        }
        case 0x0006: { // FORMULA: cached result
          const res = r.data.subarray(6, 14);
          if (res[6] === 0xff && res[7] === 0xff) {
            if (res[0] === 0) pendingString = [row, col];
            else if (res[0] === 1) put(row, col, res[2] === 1);
            else if (res[0] === 2) put(row, col, '#ERROR');
          } else num(row, col, dv.getUint16(4, true), dv.getFloat64(6, true));
          break;
        }
        case 0x0207: { // STRING (result of the previous formula)
          if (pendingString) {
            const segs = [r.data];
            for (let j = k + 1; j < recs.length && recs[j].type === 0x003c; j++) segs.push(recs[j].data);
            put(pendingString[0], pendingString[1], new SegReader(segs).unicodeString(2));
            pendingString = null;
          }
          break;
        }
      }
    }
    for (let r = 0; r < rows.length; r++) {
      if (!rows[r]) rows[r] = [];
      for (let c = 0; c < rows[r].length; c++) if (rows[r][c] === undefined) rows[r][c] = null;
    }
    sheets.push({ name: b.name, rows });
  }
  return { sheets, date1904 };
}
