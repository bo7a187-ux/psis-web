import { useMemo, useState } from 'react';
import { useApp } from '../../state';
import { FilterBar } from '../FilterBar';
import { PageHead, Stat, Limited, num, fd, downloadBytes, printWith } from '../common';
import { Icon } from '../icons';
import { t, getLang } from '../../i18n';
import { fmtDate } from '../../core/dates';
import { inFilter } from '../../core/project';
import { DIM_LABEL, type Dimension } from '../../core/classify';
import { writeXlsx } from '../../core/xlsxWrite';
import { lookAhead, lookAheadSheet, LOOK_SHOW, type LookItem, type LookShow } from '../../core/lookahead';

type GroupBy = 'none' | 'wbs' | Dimension | `code:${string}`;
const GROUPS: GroupBy[] = ['none', 'wbs', 'discipline', 'building', 'floor', 'phase'];

/** The work of the next weeks, for the site team and the weekly meeting. */
export function LookAheadPage() {
  const { project, rows, filters, imp } = useApp();
  const [weeks, setWeeks] = useState(3);
  const [show, setShow] = useState<LookShow>('active');
  const [by, setBy] = useState<GroupBy>('none');
  const [q, setQ] = useState('');
  const dd = project?.settings.dataDate ?? null;
  const la = useMemo(() => {
    if (!rows || dd == null) return null;
    const s = q.trim().toLowerCase();
    return lookAhead(rows.filter((r) => inFilter(r, filters) && (!s || `${r.a.id} ${r.a.name} ${r.a.wbsName}`.toLowerCase().includes(s))), dd, weeks, show);
  }, [rows, dd, weeks, show, filters, q]);
  if (!project || !la || dd == null) return <div className="card muted">{t('Import and calculate a schedule first.')}</div>;

  const keyOf = (x: LookItem) => (by === 'none' ? '' : by === 'wbs' ? x.row.a.wbsName || x.row.a.wbs || '-' : by.startsWith('code:') ? x.row.a.codes?.[by.slice(5)] || t('(no value)') : x.row.cls[by as Dimension]);
  const groups: { key: string; items: LookItem[] }[] = [];
  for (const x of la.items) {
    const k = keyOf(x);
    let g = groups.find((y) => y.key === k);
    if (!g) groups.push((g = { key: k, items: [] }));
    g.items.push(x);
  }
  const ar = getLang() === 'ar';
  const exportXlsx = () => {
    const bytes = writeXlsx(lookAheadSheet(la, (x) => t(x), fmtDate, ar));
    downloadBytes(`Look_ahead_${fmtDate(la.from).replace(/-/g, '')}_${weeks}w.xlsx`, bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };
  const cols = 8 + la.weekStarts.length;

  return (
    <>
      <PageHead title={t('Look-ahead (next weeks)')} right={<div className="row no-print">
        <button className="btn" onClick={() => printWith('A4 landscape')}><Icon name="printer" size={16} />{t('Print / PDF')}</button>
        <button className="btn primary" onClick={exportXlsx}><Icon name="download" size={16} />{t('Export to Excel')}</button>
      </div>}>
        <p>{t('The open activities that work in the coming weeks after the data date, with the weeks in which each one is active. Send it to the site team or use it in the weekly meeting. Dates are the current P6 dates.')}</p>
      </PageHead>
      <div className="no-print"><FilterBar /></div>
      <div className="row no-print" style={{ marginBottom: 10 }}>
        <label className="row small"><b>{t('Period')}</b>
          <select value={weeks} onChange={(e) => setWeeks(+e.target.value)}>{[2, 3, 4, 6, 8].map((w) => <option key={w} value={w}>{t('{n} weeks', { n: w })}</option>)}</select></label>
        <label className="row small"><b>{t('Show')}</b>
          <select value={show} onChange={(e) => setShow(e.target.value as LookShow)}>{LOOK_SHOW.map((x) => <option key={x.v} value={x.v}>{t(x.label)}</option>)}</select></label>
        <label className="row small"><b>{t('Group by')}</b>
          <select value={by} onChange={(e) => setBy(e.target.value as GroupBy)}>{GROUPS.map((g) => <option key={g} value={g}>{g === 'none' ? t('No grouping') : g === 'wbs' ? 'WBS' : t(DIM_LABEL[g as Dimension])}</option>)}{(imp?.codeTypes ?? []).map((c) => <option key={c} value={`code:${c}`}>{t('Activity code')}: {c}</option>)}</select></label>
        <input type="search" placeholder={t('Search ID, name or WBS…')} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
      </div>
      <div className="grid3" style={{ marginBottom: 14 }}>
        <Stat k={t('Period')} v={<span className="nowrap">{fd(la.from)} {ar ? '←' : '→'} {fd(la.to)}</span>} />
        <Stat k={t('Activities')} v={la.items.length} sub={t('{a} start · {b} finish', { a: la.items.filter((x) => x.starts).length, b: la.items.filter((x) => x.finishes).length })} />
        <Stat k={t('Critical')} v={la.items.filter((x) => x.row.critical).length} tone={la.items.some((x) => x.row.critical) ? 'warn' : undefined} />
      </div>
      <Limited list={groups.flatMap((g) => g.items.map((x, i) => ({ x, g, first: i === 0 })))} resetKey={`${weeks}${show}${by}${q}`}>{(shown, more) => (
        <div className="table-wrap tall look-wrap"><table className="t look-t">
          <thead><tr><th>{t('Activity ID')}</th><th>{t('Activity Name')}</th><th>{t('Start')}</th><th>{t('Finish')}</th><th className="num">{t('Rem. dur (d)')}</th><th className="num">{t('TF (d)')}</th><th>{t('Status')}</th>
            {la.weekStarts.map((w, i) => <th key={w} className="wk">{t('W')}{i + 1}<div className="small muted">{fd(w)}</div></th>)}<th /></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={cols} className="muted">{t('None.')}</td></tr>}
            {shown.map(({ x, g, first }) => [
              by !== 'none' && first && <tr key={'g' + g.key} className="look-group"><td colSpan={cols}><b dir="auto">{g.key}</b> <span className="muted small">({g.items.length})</span></td></tr>,
              <tr key={x.row.a.row} className={x.row.critical ? 'crit-row' : ''}>
                <td className="mono nowrap">{x.row.a.id}</td>
                <td>{x.row.isMilestone && <span title={t('Milestone')}>◆ </span>}{x.row.a.name}</td>
                <td className={`nowrap ${x.starts ? '' : 'muted'}`}>{fd(x.start)}</td>
                <td className={`nowrap ${x.finishes ? '' : 'muted'}`}>{fd(x.finish)}</td>
                <td className="num">{num(x.row.a.remDur, 1)}</td>
                <td className={`num ${x.row.tfDays != null && x.row.tfDays < 0 ? 'bad' : ''}`}>{num(x.row.tfDays, 1)}</td>
                <td className="small">{t(x.row.status)}</td>
                {x.weeks.map((on, i) => <td key={i} className="wk">{on && <span className={`wk-on ${x.row.critical ? 'crit' : ''}`} />}</td>)}
                <td>{x.row.critical && <span className="badge critical">{t('Critical')}</span>}</td>
              </tr>,
            ])}
          </tbody>
        </table>{more}</div>)}</Limited>
      <p className="small muted" style={{ marginTop: 8 }}>{t('Grey dates are outside the period (started earlier or finishing later). Red = critical. W1 starts on the data date.')}</p>
    </>
  );
}
