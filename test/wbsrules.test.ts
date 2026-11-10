import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readWorkbookFile } from '../src/core/readFile';
import { runImport, pickSheet, DEFAULT_IMPORT_OPTIONS } from '../src/core/importer';
import { wbsNames, rulesFromWbs, level1Nodes } from '../src/core/wbsRules';
import { FIX } from './helpers';

it('makes Phase rules from WBS level 1, using names from the XER WBS table', () => {
  const wb = readWorkbookFile('sample.xer', new Uint8Array(readFileSync(join(FIX, 'sample.xer'))));
  const si = pickSheet(wb.sheets, {});
  const imp = runImport(wb.sheets[si].rows, wb.sheets[si].name, wb.date1904, {}, DEFAULT_IMPORT_OPTIONS);
  const names = wbsNames(wb.sheets, imp.activities);
  expect(level1Nodes(imp.activities, names)).toEqual([{ code: 'TWR-P2.CIV', name: 'Civil Works' }]);
  const { rules, values } = rulesFromWbs(imp.activities, names, [{ level: 1, dim: 'phase' }, { level: 2, dim: 'building', under: 'TWR-P2.CIV' }]);
  expect(values).toEqual({ phase: ['Civil Works'], building: ['Foundations'] });
  expect(rules).toContainEqual({ field: 'WBS Code', type: 'Starts With', text: 'TWR-P2.CIV.', values: { phase: 'Civil Works' } });
});
