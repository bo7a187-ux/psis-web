import { useMemo, useState } from 'react';
import { useApp } from '../../state';
import { PageHead, pct, num } from '../common';
import { fmtDate } from '../../core/dates';
import type { FieldKey } from '../../core/fields';
import type { CalcRow } from '../../core/engine';
import type { Activity } from '../../core/types';

type Col = { h: string; k?: FieldKey; v: (a: Activity, r?: CalcRow) => string; num?: boolean };
const COLS: Col[] = [
  { h: 'Row', v: (a) => String(a.row), num: true },
  { h: 'Activity ID', k: 'id', v: (a) => a.id },
  { h: 'Activity Name', k: 'name', v: (a) => a.name },
  { h: 'Type', k: 'type', v: (a) => a.type },
  { h: 'P6 Status', k: 'status', v: (a) => a.status },
  { h: 'WBS', k: 'wbs', v: (a) => a.wbs },
  { h: 'Orig Dur (d)', k: 'origDur', v: (a) => num(a.origDur, 1), num: true },
  { h: 'BL Start', k: 'blStart', v: (a) => fmtDate(a.blStart) },
  { h: 'BL Finish', k: 'blFinish', v: (a) => fmtDate(a.blFinish) },
  { h: 'Start', k: 'start', v: (a) => fmtDate(a.start) },
  { h: 'Finish', k: 'finish', v: (a) => fmtDate(a.finish) },
  { h: 'Actual Start', k: 'actStart', v: (a) => fmtDate(a.actStart) },
  { h: 'Actual Finish', k: 'actFinish', v: (a) => fmtDate(a.actFinish) },
  { h: 'TF (d)', k: 'totalFloat', v: (a) => num(a.totalFloat, 1), num: true },
  { h: 'Critical', k: 'critical', v: (a) => a.critical },
  { h: 'Physical %', k: 'physPct', v: (a) => pct(a.physPct, 0), num: true },
  { h: 'Duration %', k: 'durPct', v: (a) => pct(a.durPct, 0), num: true },
  { h: 'Units %', k: 'unitsPct', v: (a) => pct(a.unitsPct, 0), num: true },
  { h: 'Budget Cost', k: 'budgetCost', v: (a) => num(a.budgetCost), num: true },
  { h: 'Budget Units', k: 'budgetUnits', v: (a) => num(a.budgetUnits), num: true },
  { h: 'Phase', v: (_a, r) => r?.cls.phase ?? '' },
  { h: 'Discipline', v: (_a, r) => r?.cls.discipline ?? '' },
  { h: 'Building', v: (_a, r) => r?.cls.building ?? '' },
  { h: 'Floor', v: (_a, r) => r?.cls.floor ?? '' },
  { h: 'Location', v: (_a, r) => r?.cls.location ?? '' },
  { h: 'Included', v: (_a, r) => (r ? (r.included ? 'Yes' : r.isSummary ? 'No (WBS Summary)' : 'No (LOE)') : '') },
];

export function ActivitiesPage() {
  const { imp, rows } = useApp();
  const [q, setQ] = useState('');
  const [onlyIssues, setOnlyIssues] = useState(false);
  const list = useMemo(() => {
    if (!imp) return [];
    const byRow = new Map(rows?.map((r) => [r.a.row, r]));
    const s = q.trim().toLowerCase();
    return imp.activities
      .map((a) => ({ a, r: byRow.get(a.row) }))
      .filter(({ a }) => !s || `${a.id} ${a.name} ${a.wbs}`.toLowerCase().includes(s))
      .filter(({ a }) => !onlyIssues || Object.keys(a.invalid).length > 0);
  }, [imp, rows, q, onlyIssues]);
  if (!imp) return <><PageHead title="Activities" /><div className="card muted">Import a file first.</div></>;
  return (
    <>
      <PageHead title="Activities (cleaned data)">
        <p>Every activity as read from the file, after cleaning: dates in dd-Mmm-yy, durations in days, percentages on one scale. Red cells could not be read - hover to see why. Empty cells are empty in the file (never replaced by zero).</p>
      </PageHead>
      <div className="row" style={{ marginBottom: 10 }}>
        <input type="search" placeholder="Search ID, name or WBS…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 280 }} />
        <label className="row small"><input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Only rows with unreadable values</label>
        <span className="small muted">{list.length} of {imp.activities.length} activities</span>
      </div>
      <div className="table-wrap tall">
        <table className="t">
          <thead><tr>{COLS.map((c) => <th key={c.h} className={c.num ? 'num' : ''}>{c.h}</th>)}</tr></thead>
          <tbody>
            {list.map(({ a, r }) => (
              <tr key={a.row}>
                {COLS.map((c) => {
                  const bad = c.k ? a.invalid[c.k] : undefined;
                  const unc = !c.k && r && r.included && c.v(a, r) === 'Unclassified';
                  return <td key={c.h} className={`${c.num ? 'num' : ''} ${bad ? 'bad' : unc ? 'warn' : ''} ${c.h === 'Activity Name' ? '' : 'nowrap'}`} title={bad}>{bad ? 'Invalid' : c.v(a, r)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
