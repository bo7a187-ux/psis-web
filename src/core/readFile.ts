/** Opens any supported schedule file: .xlsx / .xlsm, old .xls, P6 .xer, .csv. Detected from the content, not only the name. */
import { readCsv, readXlsx, XlsxError, type WorkbookData } from './xlsx';
import { readXls } from './xls';
import { readXer } from './xer';

export interface ReadResult extends WorkbookData {
  format: 'xlsx' | 'xls' | 'xer' | 'csv';
  /** facts about the file worth showing after the import */
  info: string[];
}

export function readWorkbookFile(name: string, data: Uint8Array): ReadResult {
  const zip = data[0] === 0x50 && data[1] === 0x4b;
  const ole = data[0] === 0xd0 && data[1] === 0xcf && data[2] === 0x11 && data[3] === 0xe0;
  const head = new TextDecoder('latin1').decode(data.subarray(0, 16)).replace(/^\u00ef\u00bb\u00bf/, '');
  if (head.startsWith('ERMHDR') || /\.xer$/i.test(name)) {
    const r = readXer(data);
    const info = [`Primavera XER file${r.projects.length ? ` - project${r.projects.length > 1 ? 's' : ''} ${r.projects.join(', ')}` : ''}. Durations converted from hours with each activity's calendar.`];
    if (r.encoding !== 'UTF-8') info.push(`Text read as ${r.encoding}.`);
    return { ...r, format: 'xer', info };
  }
  if (zip) return { ...readXlsx(data), format: 'xlsx', info: [] };
  if (ole) return { ...readXls(data), format: 'xls', info: ['Old-style Excel .xls file.'] };
  if (/\.(csv|txt)$/i.test(name)) return { ...readCsv(new TextDecoder('utf-8').decode(data)), format: 'csv', info: [] };
  if (/^\s*</.test(head)) throw new XlsxError('This file is a web page or XML saved with an Excel name, not a real workbook. Open it in Excel and save it as .xlsx (File > Save As > Excel Workbook).');
  throw new XlsxError('This file type cannot be read. Use the P6 export as .xlsx, .xls or .xer (or .csv).');
}
