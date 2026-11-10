import { useMemo, useState } from 'react';
import { useApp } from '../state';
import { t } from '../i18n';
import { DIMENSIONS, DIM_LABEL, type Dimension } from '../core/classify';
import { wbsNames, rulesFromWbs, level1Nodes, generalRules } from '../core/wbsRules';

/** One click: classification rules from the WBS (level 1 and level 2). */
export function WbsRulesCard() {
  const app = useApp();
  const { project, stored, imp } = app;
  const [d1, setD1] = useState<Dimension | ''>('phase');
  const [d2, setD2] = useState<Dimension | ''>('building');
  const [under, setUnder] = useState('');
  const [msg, setMsg] = useState('');
  const names = useMemo(() => (stored && imp ? wbsNames(stored.sheets, imp.activities) : new Map<string, string>()), [stored, imp]);
  const nodes = useMemo(() => (imp ? level1Nodes(imp.activities, names) : []), [imp, names]);
  if (!project || !imp || !nodes.length) return null;
  const cfg = project.classification;
  const run = () => {
    const plan = [...(d1 ? [{ level: 1, dim: d1 }] : []), ...(d2 ? [{ level: 2, dim: d2, under: under || undefined }] : [])];
    const { rules, values } = rulesFromWbs(imp.activities, names, plan);
    const lists = { ...cfg.lists };
    for (const dim of DIMENSIONS) for (const v of values[dim] ?? []) if (!lists[dim].some((x) => x.toLowerCase() === v.toLowerCase())) lists[dim] = [...lists[dim], v];
    const have = new Set(cfg.rules.map((r) => `${r.field}|${r.type}|${r.text.toLowerCase()}`));
    const fresh = rules.filter((r) => !have.has(`${r.field}|${r.type}|${r.text.toLowerCase()}`));
    // last rule: everything not set above becomes "General", so no activity stays unclassified
    const general = generalRules(imp.activities, DIMENSIONS);
    const isGeneral = (r: (typeof cfg.rules)[number]) => DIMENSIONS.every((d) => r.values[d] === 'General');
    const others = cfg.rules.filter((r) => !isGeneral(r));
    for (const dim of DIMENSIONS) if (!lists[dim].some((x) => x.toLowerCase() === 'general')) lists[dim] = [...lists[dim], 'General'];
    app.updateProject({ classification: { ...cfg, lists, rules: [...others, ...fresh, ...general] } }, 'Rules created from the WBS');
    setMsg(t('{n} rules added.', { n: fresh.length }));
  };
  const sel = (v: Dimension | '', set: (x: Dimension | '') => void) => (
    <select value={v} onChange={(e) => set(e.target.value as Dimension | '')}>
      <option value="">{t('- not used -')}</option>
      {DIMENSIONS.map((d) => <option key={d} value={d}>{t(DIM_LABEL[d])}</option>)}
    </select>
  );
  return (
    <div className="card" style={{ borderColor: '#c8d8ff' }}>
      <h2>{t('Quick start: rules from the WBS')}</h2>
      <p className="small muted">{t('Most schedules already hold the phase and the building in the WBS. Choose what each level means and the rules are written for you; you can edit them below.')}</p>
      <div className="row" style={{ marginTop: 10, alignItems: 'flex-end' }}>
        <label className="field"><span className="lbl">{t('WBS level 1 is the')}</span>{sel(d1, setD1)}</label>
        <label className="field"><span className="lbl">{t('WBS level 2 is the')}</span>{sel(d2, setD2)}</label>
        <label className="field"><span className="lbl">{t('Level 2 only inside')}</span>
          <select value={under} onChange={(e) => setUnder(e.target.value)}>
            <option value="">{t('All of the WBS')}</option>{nodes.map((n) => <option key={n.code} value={n.code}>{n.name}</option>)}
          </select></label>
        <button className="btn primary" disabled={!d1 && !d2} onClick={run}>{t('Create rules')}</button>
        {msg && <span className="badge ok">{msg}</span>}
      </div>
    </div>
  );
}
