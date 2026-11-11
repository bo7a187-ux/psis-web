import { useMemo, useState } from 'react';
import { useApp } from '../../state';
import { FilterBar } from '../FilterBar';
import { PageHead, pct, fd } from '../common';
import { t } from '../../i18n';
import { fmtDate } from '../../core/dates';
import { inFilter } from '../../core/project';
import { DIM_LABEL, type Dimension } from '../../core/classify';
import { ganttGroups, ganttSpan, monthTicks, weekTicks, type GanttBar, type GanttGroupBy } from '../../core/gantt';

type Zoom = 'week' | 'month' | 'quarter';
const PX: Record<Zoom, number> = { week: 16, month: 4, quarter: 1.6 };
const LEFT = 340;
const GROUPS: GanttGroupBy[] = ['wbs', 'phase', 'discipline', 'building', 'floor', 'none'];

/** Read-only timeline of the imported schedule: bars, progress, baseline and the data date. */
export function GanttPage() {
  const { project, rows, filters } = useApp();
  const [by, setBy] = useState<GanttGroupBy>('wbs');
  const [zoom, setZoom] = useState<Zoom>('month');
  const [q, setQ] = useState('');
  const [critOnly, setCritOnly] = useState(false);
  const [showBL, setShowBL] = useState(true);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const dd = project?.settings.dataDate ?? null;
  const groups = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    const list = rows.filter((r) => inFilter(r, filters) && (!critOnly || r.critical) && (!s || `${r.a.id} ${r.a.name} ${r.a.wbs} ${r.a.wbsName}`.toLowerCase().includes(s)));
    return ganttGroups(list, by);
  }, [rows, filters, by, q, critOnly]);
  if (!project || !rows) return <div className="card muted">{t('Import and calculate a schedule first.')}</div>;
  const span = ganttSpan(groups, dd);
  const px = PX[zoom];
  const count = groups.reduce((n, g) => n + g.bars.length, 0);
  const toggle = (k: string) => setClosed((c) => { const n = new Set(c); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const groupLabel = (label: string) => (by === 'wbs' ? label : by === 'none' ? '' : t(label));

  return (
    <>
      <PageHead title={t('Timeline (Gantt)')}>
        <p>{t('Every activity on a time line, as in P6: the filled part is the actual %, red bars are critical, green ones are completed, and the thin grey bar is the baseline. Read-only - the schedule is still edited in P6.')}</p>
      </PageHead>
      <FilterBar />
      <div className="row" style={{ marginBottom: 10 }}>
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
        {by !== 'none' && <>
          <button className="btn small" onClick={() => setClosed(new Set(groups.map((g) => g.key)))}>{t('Collapse all')}</button>
          <button className="btn small" onClick={() => setClosed(new Set())}>{t('Expand all')}</button>
        </>}
        <span className="grow" />
        <span className="small muted">{t('{m} of {n} activities', { m: count, n: rows.filter((r) => r.included).length })}</span>
      </div>
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
                    {by !== 'none' && (
                      <div className="g-row g-group" onClick={() => toggle(g.key)}>
                        <div className="g-left"><span className="g-tog">{open ? '▾' : '▸'}</span><b dir="auto">{groupLabel(g.label)}</b><span className="muted small"> ({g.bars.length})</span></div>
                        <div className="g-track" style={{ width: W }}>{g.start != null && g.finish != null && <div className="g-sum" style={{ left: x(g.start), width: Math.max(3, (g.finish - g.start + 1) * px) }} />}</div>
                      </div>
                    )}
                    {open && g.bars.map((b) => (
                      <div key={b.row.a.row} className="g-row">
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
