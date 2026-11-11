import type { CalcRow } from './engine';
import type { Settings } from './settings';
import type { XSheet, XCell } from './xlsxWrite';
import { fmtDate } from './dates';

/**
 * Same columns as the Delay Analysis screen. Dates are real dates, percentages real percentages.
 * tx translates labels and words (identity = English); rtl makes the sheets right-to-left.
 */
export function delaySheets(rows: CalcRow[], s: Settings, listName: string, scope: string, projectName: string, approvalText: string,
  tx: (s: string) => string = (x) => x, rtl = false): XSheet[] {
  const d = (x: number | null): XCell => (x == null ? null : { d: x });
  const p = (x: number | null): XCell => (x == null ? null : { p: x });
  const header = ['Activity ID', 'Activity Name', 'Discipline', 'Floor', 'Planned %', 'Actual %', 'Var (pp)', 'BL Start', 'BL Finish', 'Fc: P6', 'Fc: Performance', 'Fc: Conservative', 'Selected forecast source', 'Finish delay (d)', 'Total Float (d)', 'Indicator'].map(tx);
  const data: XCell[][] = rows.map((r) => [
    r.a.id, r.a.name, r.cls.discipline, r.cls.floor, p(r.planned), p(r.actual), r.variance == null ? null : { n1: r.variance * 100 },
    d(r.blStart), d(r.blFinish), d(r.fcP6), d(r.fcPerf), d(r.fcCons), tx(r.fcSource), r.finishVarUsed, r.tfDays == null ? null : { n1: r.tfDays }, tx(r.delayIndicator),
  ]);
  const info: XCell[][] = ([
    ['Project', projectName], ['List', tx(listName)], ['Scope (filters)', scope], ['Data date', fmtDate(s.dataDate)], ['Baseline', tx(s.baselineUse)],
    ['Weighting', tx(s.weightMethod)], ['Actual % source', tx(s.actualSource)], ['Planned % method', tx(s.plannedMethod)], ['Forecast method', tx(s.forecastMethod)],
    ['Data status', approvalText], ['Activities in list', rows.length],
    ['Note', tx('Var (pp) = percentage points behind plan. Finish delay (d) = calendar days between forecast finish and baseline finish. They are different measures.')],
  ] as [string, XCell][]).map(([k, v]) => [tx(k), v]);
  return [
    { name: tx('Delay report'), header, rows: data, widths: [12, 38, 14, 13, 10, 10, 9, 11, 11, 11, 15, 15, 28, 14, 13, 22], rtl },
    { name: tx('Report info'), header: [tx('Item'), tx('Value')], rows: info, widths: [22, 90], rtl },
  ];
}
