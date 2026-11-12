import { useState } from 'react';
import { useApp } from '../state';
import { t } from '../i18n';
import { DIMENSIONS, DIM_LABEL, rulesFromCode, type Dimension, type Rule } from '../core/classify';

/** One click: classification from a P6 activity code (e.g. the "Discipline" code fills Discipline). */
export function CodeRulesCard() {
  const app = useApp();
  const { project, imp } = app;
  const types = imp?.codeTypes ?? [];
  const [type, setType] = useState('');
  const [dim, setDim] = useState<Dimension>('discipline');
  const [msg, setMsg] = useState('');
  if (!project || !imp || !types.length) return null;
  const cfg = project.classification;
  const sel = type && types.includes(type) ? type : types[0];
  const run = () => {
    const { rules, values } = rulesFromCode(imp.activities, sel, dim);
    const key = (r: Rule) => `${r.field}|${r.type}|${r.text.toLowerCase()}|${Object.keys(r.values).join()}`;
    const have = new Set(cfg.rules.map(key));
    const fresh = rules.filter((r) => !have.has(key(r)));
    // before the "General" catch-all rules, so the codes win
    const isGeneral = (r: Rule) => DIMENSIONS.some((d) => r.values[d] === 'General');
    const firstGeneral = cfg.rules.findIndex(isGeneral);
    const at = firstGeneral < 0 ? cfg.rules.length : firstGeneral;
    const list = [...cfg.lists[dim]];
    for (const v of values) if (!list.some((x) => x.toLowerCase() === v.toLowerCase())) list.push(v);
    app.updateProject({ classification: { ...cfg, lists: { ...cfg.lists, [dim]: list }, rules: [...cfg.rules.slice(0, at), ...fresh, ...cfg.rules.slice(at)] } }, `Rules created from activity code ${sel}`);
    setMsg(t('{n} rules added.', { n: fresh.length }));
  };
  return (
    <div className="card">
      <h2>{t('Classify from P6 activity codes')}</h2>
      <p className="small muted">{t('The file has activity codes. Use one of them to fill a classification field: one rule per code value, placed before the "General" rules.')}</p>
      <div className="row" style={{ marginTop: 8 }}>
        <label className="row small"><b>{t('Activity code')}</b>
          <select value={sel} onChange={(e) => { setType(e.target.value); setMsg(''); }}>{types.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <span>→</span>
        <label className="row small"><b>{t('fills')}</b>
          <select value={dim} onChange={(e) => { setDim(e.target.value as Dimension); setMsg(''); }}>{DIMENSIONS.map((d) => <option key={d} value={d}>{t(DIM_LABEL[d])}</option>)}</select></label>
        <button className="btn primary small" onClick={run}>{t('Create rules')}</button>
        {msg && <span className="small" style={{ color: 'var(--green)' }}>{msg}</span>}
      </div>
    </div>
  );
}
