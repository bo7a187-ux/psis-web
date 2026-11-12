import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readWorkbookFile } from '../src/core/readFile';
import { runImport, pickSheet, DEFAULT_IMPORT_OPTIONS } from '../src/core/importer';
import { calcActivities } from '../src/core/engine';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { emptyClassification, classify, rulesFromCode, codeField, codeLabel } from '../src/core/classify';
import { inFilter, isUnfiltered, filterParts, NO_FILTER, NO_CODE } from '../src/core/project';
import { ganttGroups } from '../src/core/gantt';
import { FIX } from './helpers';

// sample.xer + P6 activity code tables (as P6 writes them)
const tables = [
  '%T\tACTVTYPE', '%F\tactv_code_type_id\tactv_short_len\tseq_num\tactv_code_type\tproj_id\twbs_id\tactv_code_type_scope',
  '%R\t1\t10\t1\tArea\t\t\tAS_Global', '%R\t2\t10\t2\tResponsibility\t4521\t\tAS_Project', '%R\t3\t10\t3\tUnused\t\t\tAS_Global',
  '%T\tACTVCODE', '%F\tactv_code_id\tparent_actv_code_id\tactv_code_type_id\tactv_code_name\tshort_name\tseq_num',
  '%R\t11\t\t1\tZone A\tZA\t1', '%R\t12\t\t1\tZone B\tZB\t2', '%R\t21\t\t2\tCivil Contractor\tCIV\t1', '%R\t22\t\t2\t\tMEP\t2',
  '%T\tTASKACTV', '%F\ttask_id\tactv_code_type_id\tactv_code_id\tproj_id',
  '%R\t2\t1\t11\t4521', '%R\t3\t1\t12\t4521', '%R\t2\t2\t21\t4521', '%R\t3\t2\t22\t4521', '%R\t5\t1\t11\t4521',
  '%R\t102\t1\t12\t4600', // baseline project task: not reported
];
const xer = readFileSync(join(FIX, 'sample.xer'), 'utf8').replace('%E', tables.join('\r\n') + '\r\n%E');
const wb = readWorkbookFile('codes.xer', new TextEncoder().encode(xer));
const sheet = wb.sheets[pickSheet(wb.sheets, {})];
const imp = runImport(sheet.rows, sheet.name, wb.date1904, {}, { ...DEFAULT_IMPORT_OPTIONS, durationUnit: 'Hours' });
const by = (id: string) => imp.activities.find((a) => a.id === id)!;

describe('P6 activity codes', () => {
  it('are read from the XER file, per activity, only for code types in use', () => {
    expect(imp.codeTypes).toEqual(['Area', 'Responsibility']);
    expect(by('A1010').codes).toEqual({ Area: 'ZA - Zone A', Responsibility: 'CIV - Civil Contractor' });
    expect(by('A1020').codes).toEqual({ Area: 'ZB - Zone B', Responsibility: 'MEP' });
    expect(by('A1000').codes).toBeUndefined();
  });
  const rows = calcActivities({ activities: imp.activities, settings: { ...DEFAULT_SETTINGS, dataDate: 46068 }, classification: emptyClassification() });
  it('filter: by code value, and activities without a value', () => {
    const f = { ...NO_FILTER, codeType: 'Area', code: 'ZA - Zone A' };
    expect(rows.filter((r) => inFilter(r, f)).map((r) => r.a.id).sort()).toEqual(['A1010', 'A1040'].filter((id) => rows.find((r) => r.a.id === id)!.included));
    expect(rows.filter((r) => inFilter(r, { ...f, code: NO_CODE })).every((r) => !r.a.codes?.Area)).toBe(true);
    expect(isUnfiltered(f)).toBe(false);
    expect(isUnfiltered({ ...NO_FILTER, codeType: 'Area', code: 'All' })).toBe(true);
    expect(filterParts(f)).toEqual([['Area', 'ZA - Zone A']]);
  });
  it('classification rules from a code fill a dimension with the code description', () => {
    expect(codeLabel('DIV15 - Mechanical')).toBe('Mechanical');
    const { rules, values } = rulesFromCode(imp.activities, 'Responsibility', 'discipline');
    expect(rules.map((r) => [r.field, r.text, r.values.discipline])).toEqual([[codeField('Responsibility'), 'CIV - Civil Contractor', 'Civil Contractor'], [codeField('Responsibility'), 'MEP', 'MEP']]);
    expect(values).toEqual(['Civil Contractor', 'MEP']);
    const cfg = { ...emptyClassification(), rules };
    expect(classify(by('A1020'), cfg).discipline).toBe('MEP');
    expect(classify(by('A1000'), cfg).discipline).toBe('Unclassified');
  });
  it('Gantt can group by an activity code', () => {
    const g = ganttGroups(rows.filter((r) => r.included), 'code:Area');
    expect(g.map((x) => x.key).sort()).toEqual(['-', 'ZA - Zone A', 'ZB - Zone B']);
  });
  it('Excel export: an unmapped text column with repeated values is a code; notes, numbers and IDs are not', () => {
    const grid = [
      ['Activity ID', 'Activity Name', 'Area', 'Notebook', 'Weight', 'Ref'],
      ['A1', 'Dig', 'Zone A', 'long note one', 3, 'R1'], ['A2', 'Pour', 'Zone A', 'note two', 4, 'R2'],
      ['A3', 'Cure', 'Zone B', 'note three', 5, 'R3'], ['A4', 'Strip', null, 'note four', 6, 'R4'],
    ];
    const r = runImport(grid, 'S', false, {}, DEFAULT_IMPORT_OPTIONS);
    expect(r.codeTypes).toEqual(['Area']);
    expect(r.activities[0].codes).toEqual({ Area: 'Zone A' });
    expect(r.activities[3].codes).toBeUndefined();
  });
});
