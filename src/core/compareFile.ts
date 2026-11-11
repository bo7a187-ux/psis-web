/** Reads the second file of a comparison with the project's own column mapping and options. Nothing is stored. */
import { readWorkbookFile } from './readFile';
import { runImport, pickSheet, findDataDate, guessDataDate, type ImportOptions, type SavedMapping } from './importer';
import { readLogic } from './logic';
import type { CompareSide } from './compare';

export class CompareFileError extends Error {}

export function readCompareSide(name: string, bytes: Uint8Array, mapping: SavedMapping, opts: ImportOptions): CompareSide {
  const wb = readWorkbookFile(name, bytes);
  if (!wb.sheets.length) throw new CompareFileError('The file has no sheets.');
  const idx = pickSheet(wb.sheets, mapping);
  const sheet = wb.sheets[idx];
  const imp = runImport(sheet.rows, sheet.name, wb.date1904, mapping, opts);
  if (!imp.matches.id || imp.matches.id.column == null || !imp.activities.some((a) => a.id))
    throw new CompareFileError('No Activity ID column was found in this file. Use an export of the same kind as the imported schedule (XER, or Excel with the same columns).');
  const logic = readLogic(wb.sheets, idx, imp, opts.durationUnit, opts.hoursPerDay);
  const dataDate = findDataDate(wb.sheets, wb.date1904) ?? guessDataDate(imp.activities)?.value ?? null;
  return { label: name, dataDate, activities: imp.activities, relations: logic.relations, constraints: logic.constraints };
}
