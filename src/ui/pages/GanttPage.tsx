import { useMemo, useState } from 'react';
import { useApp } from '../../state';
import { FilterBar } from '../FilterBar';
import { PageHead, pct, fd, num, printWith } from '../common';
import { Icon } from '../icons';
import { readLogic } from '../../core/logic';
import { drivingPath, TOLERANCE } from '../../core/drivingPath';
import { t } from '../../i18n';
import { fmtDate } from '../../core/dates';
import { inFilter } from '../../core/project';
import { DIM_LABEL, type Dimension } from '../../core/classify';
import { ganttGroups, ganttSpan, monthTicks, weekTicks, toBar, type GanttBar, type GanttGroup, type GanttGroupBy } from '../../core/gantt';

type Zoom = 'week' | 'month' | 'quarter';
const PX: Record<Zoom, number> = { week: 16, month: 4, quarter: 1.6 };
const LEFT = 340;
/** printable width of an A3 landscape page at 96 dpi, minus margins */
const PRINT_W = 1500;
const GROUPS: GanttGroupBy[] = ['wbs', 'phase', 'discipline', 'building', 'floor', 'none'];

/** Read-only timeline of the imported schedule: bars, progress, baseline and the data date. */
export function GanttPage() {
  const { project, rows, filters, stored, imp } = useApp();
  const [by, setBy] = useState<GanttGroupBy>('wbs');
  const [zoom, setZoom] = useState<Zoom>('month');
  const [q, setQ] = useState('');
  const [critOnly, setCritOnly] = useState(false);
  const [showBL, setShowBL] = useState(true);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [pathIn, setPathIn] = useState('');
  const [target, setTarget] = useState('');
  const [printing, setPrinting] = useState(false);
  const dd = project?.settings.dataDate ?? null;
  const opts = project?.importOptions;
  const relations = useMemo(() => (stored && imp && opts ? readLogic(stored.sheets, stored.sheetIndex, imp, opts.durationUnit, opts.hoursPerDay).relations : null), [stored, imp, opts]);
  const path = useMemo(() => (target && rows && relations && dd != null ? drivingPath(rows, relations, target, dd) : null), [target, rows, relations, dd]);
  const onPath = useMemo(() => new Set(path?.rows.map((r) => r.a.row) ?? []), [path]);
  const milestones = useMemo(() => (rows ?? []).filter((r) => r.isMilestone && r.status !== 'Completed' && r.a.id).map((r) => r.a.id), [rows]);
  const groups = useMemo<GanttGroup[]>(() => {
    if (path) {
      const bars = path.rows.map(toBar);
      return [{ key: 'path', label: '', bars, start: null, finish: null }];
    }
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    const list = rows.filter((r) => inFilter(r, filters) && (!critOnly || r.critical) && (!s || `${r.a.id} ${r.a.name} ${r.a.wbs} ${r.a.wbsName}`.toLowerCase().includes(s)));
    return ganttGroups(list, by);
  }, [rows, filters, by, q, critOnly, path]);
  if (!project || !rows) return <div className="card muted">{t('Import and calculate a schedule first.')}</div>;
  const span = ganttSpan(groups, dd);
  const grouped = by !== 'none' && !path;
  const fitPx = span ? Math.min(PX.week, (PRINT_W - LEFT) / (span[1] - span[0] + 1)) : PX.month;
  const px = printing ? fitPx : PX[zoom];
  const print = () => {
    setPrinting(true);
    const done = () => { setPrinting(false); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => printWith('A3 landscape', 'print-gantt'), 80);
  };
  const trace = () => { setTarget(pathIn.trim()); setClosed(new Set()); };
  const count = groups.reduce((n, g) => n + g.bars.length, 0);
  const toggle = (k: string) => setClosed((c) => { const n = new Set(c); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const groupLabel = (label: string) => (by === 'wbs' ? label : by === 'none' ? '' : t(label));
  const notFound = target && !path;

  return (
    <>
      <PageHead title={t('Timeline (Gantt)')}>
        <p>{t('Every activity on a time line, as in P6: the filled part is the actual %, red bars are critical, green ones are completed, and the thin grey bar is the baseline. Read-only - the schedule is still edited in P6.')}</p>
      </PageHead>
      <div className="no-print"><FilterBar /></div>
      <div className="row no-print" style={{ marginBottom: 10 }}>
        <input type="search" placeholder={t('Search ID, name or WBS…')} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
        <label className="row small"><b>{t('Group by')}</b>
          <select value={by} onChange={(e) => { setBy(e.target.value as GanttGroupBy); setClosed(new Set()); }}>
            {GROUPS.map((g) => <option key={g} value={g}>{g === 'wbs' ? 'WBS' : g === 'none' ? t('No grouping') : t(DIM_LABEL[g as Dimension])}</option>)}
          </select></label>
        <label className="row small"><b>{t('Scale')}</b>
          <select value={zoom} onChange={(e) => setZoom(e.target.value as Zoom)}>
            <option value="week">{t('Weeks')}</option><option value="month">{t('Months')}</option><option value="quarter">{t('Quarters')}</option>
          </select></label>
        <label className="row small"><input type="checkbox" checked={critOnly} onChange={(e) => setCritOnly(e.target.checked)} />{t('Critical only')}</label>
        <label className="row small"><input type="checkbox" checked={showBL} onChange={(e) => setShowBL(e.target.checked)} />{t('Show baseline')}</label>
        {grouped && <>
          <button className="btn small" onClick={() => setClosed(new Set(groups.map((g) => g.key)))}>{t('Collapse all')}</button>
          <button className="btn small" onClick={() => setClosed(new Set())}>{t('Expand all')}</button>
        </>}
        <span className="grow" />
        <span className="small muted">{t('{m} of {n} activities', { m: count, n: rows.filter((r) => r.included).length })}</span>
        <button className="btn small" onClick={print}><Icon name="printer" size={15} />{t('Print / PDF')}</button>
      </div>
      <div className="row no-print path-bar">
        <Icon name="route" size={16} />
        <b className="small">{t('Driving path to')}</b>
        <input type="text" list="gantt-ms" value={pathIn} placeholder={relations ? t('Activity ID, e.g. a milestone') : t('Needs relationships (XER file)')} disabled={!relations}
          onChange={(e) => setPathIn(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && trace()} style={{ width: 220 }} />
        <datalist id="gantt-ms">{milestones.map((m) => <option key={m} value={m} />)}</datalist>
        <button className="btn small primary" disabled={!relations || !pathIn.trim()} onClick={trace}>{t('Show path')}</button>
        {target && <button className="btn small" onClick={() => { setTarget(''); setPathIn(''); }}>{t('Show all activities')}</button>}
      </div>
      {notFound && <div className="notice bad no-print">{t('Activity {id} was not found.', { id: target })}</div>}
      {path && (
        <div className="notice good small">
          <b>{t('{n} activities drive {id}.', { n: path.rows.length - 1, id: path.target })}</b>{' '}
          {t('Worked out from the current dates and the relationships: a predecessor drives when it leaves no gap (up to {d} days for a weekend). Approximate - P6 uses the calendars.', { d: TOLERANCE })}
          {[...path.ends].some(([, e]) => e === 'constraint') && <> {t('Some activities are held by a constraint or a late date, not by a predecessor: {ids}.', { ids: [...path.ends].filter(([, e]) => e === 'constraint').map(([id]) => id).join(', ') })}</>}
          {path.links.length > 0 && (
            <details style={{ marginTop: 6 }}><summary>{t('Relationships on the path ({n})', { n: path.links.length })}</summary>
              <div className="table-wrap" style={{ marginTop: 6, maxHeight: 220 }}><table className="t"><thead><tr><th>{t('Predecessor')}</th><th>{t('Successor')}</th><th>{t('Type')}</th><th className="num">{t('Lag (d)')}</th><th className="num">{t('Gap (d)')}</th></tr></thead>
                <tbody>{path.links.map((l, i) => <tr key={i}><td className="mono">{l.pred}</td><td className="mono">{l.succ}</td><td>{l.type}</td><td className="num">{num(l.lag, 1)}</td><td className="num">{num(l.gap, 1)}</td></tr>)}</tbody></table></div>
            </details>
          )}
        </div>
      )}
      <div className="gantt-legend small">
        <span><i className="lg bar" />{t('Planned / current')}</span><span><i className="lg done" />{t('Actual %')}</span>
        <span><i className="lg crit" />{t('Critical')}</span><span><i className="lg comp" />{t('Completed')}</span>
        <span><i className="lg bl" />{t('Baseline')}</span><span><i className="lg ms" />{t('Milestone')}</span><span><i className="lg dd" />{t('Data date')}</span>
      </div>
      {!span ? <div className="card muted">{t('None.')}</div> : (() => {
        const [lo, hi] = span;
        const W = Math.ceil((hi - lo + 1) * px);
        const x = (d: number) => (d - lo) * px;
        const months = monthTicks(lo, hi);
        const weeks = zoom === 'week' ? weekTicks(lo, hi) : [];
        const showMonth = (i: number) => zoom !== 'quarter' || months[i].label.startsWith('Jan') || months[i].label.startsWith('Apr') || months[i].label.startsWith('Jul') || months[i].label.startsWith('Oct');
        const bar = (b: GanttBar) => {
          const tip = `${b.row.a.id} ${b.row.a.name}\n${fmtDate(b.start)} → ${fmtDate(b.finish)}${b.done != null ? `\n${t('Actual')}: ${pct(b.done, 0)}` : ''}${b.blFinish != null ? `\n${t('BL finish')}: ${fmtDate(b.blFinish)}` : ''}${b.row.tfDays != null ? `\nTF: ${b.row.tfDays} ${t('d')}` : ''}`;
          return (
            <div className="g-track" style={{ width: W }} title={tip}>
              {showBL && b.blStart != null && b.blFinish != null && <div className="g-bl" style={{ left: x(b.blStart), width: Math.max(2, (b.blFinish - b.blStart + 1) * px) }} />}
              {b.start != null && b.finish != null && (b.milestone
                ? <div className={`g-ms ${b.completed ? 'comp' : b.critical ? 'crit' : ''}`} style={{ left: x(b.start) - 6 }} />
                : <div className={`g-bar ${b.completed ? 'comp' : b.critical ? 'crit' : ''}`} style={{ left: x(b.start), width: Math.max(3, (b.finish - b.start + 1) * px) }}>
                    {b.done != null && b.done > 0 && !b.completed && <div className="g-done" style={{ width: `${Math.min(100, b.done * 100)}%` }} />}
                  </div>)}
            </div>
          );
        };
        return (
          <div className="gantt" dir="ltr">
            <div className="g-inner" style={{ width: LEFT + W }}>
              <div className="g-row g-head">
                <div className="g-left"><b>{t('Activity')}</b></div>
                <div className="g-track g-scale" style={{ width: W }}>
                  {weeks.map((d) => <span key={'w' + d} className="g-wk" style={{ left: x(d) }}>{fmtDate(d).slice(0, 2)}</span>)}
                  {months.map((m, i) => <span key={m.day} className="g-mo" style={{ left: x(m.day) }}>{showMonth(i) ? m.label : ''}</span>)}
                </div>
              </div>
              {groups.map((g) => {
                const open = !closed.has(g.key);
                return (
                  <div key={g.key}>
                    {grouped && (
                      <div className="g-row g-group" onClick={() => toggle(g.key)}>
                        <div className="g-left"><span className="g-tog">{open ? '▾' : '▸'}</span><b dir="auto">{groupLabel(g.label)}</b><span className="muted small"> ({g.bars.length})</span></div>
                        <div className="g-track" style={{ width: W }}>{g.start != null && g.finish != null && <div className="g-sum" style={{ left: x(g.start), width: Math.max(3, (g.finish - g.start + 1) * px) }} />}</div>
                      </div>
                    )}
                    {open && g.bars.map((b) => (
                      <div key={b.row.a.row} className={`g-row ${path && onPath.has(b.row.a.row) && b.row.a.id === path.target ? 'g-target' : ''}`}>
                        <div className="g-left"><span className="g-id">{b.row.a.id}</span><span className="g-name" dir="auto">{b.row.a.name}</span></div>
                        {bar(b)}
                      </div>
                    ))}
                  </div>
                );
              })}
              {dd != null && dd >= lo && dd <= hi && <div className="g-dd" style={{ left: LEFT + x(dd) }} title={`${t('Data date')} ${fmtDate(dd)}`} />}
            </div>
          </div>
        );
      })()}
      {dd != null && <p className="small muted" style={{ marginTop: 8 }}>{t('Data date')} {fd(dd)} · {t('Hover a bar for its dates, progress and float.')}</p>}
    </>
  );
}
