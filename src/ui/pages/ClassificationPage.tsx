import { useMemo, useState } from 'react';
import { useApp } from '../../state';
import { PageHead } from '../common';
import { DIMENSIONS, DIM_LABEL, RULE_FIELDS, RULE_TYPES, UNCLASSIFIED, ruleMatchCounts, type ClassificationConfig, type Dimension, type Rule, type Override } from '../../core/classify';
import { t, tr } from '../../i18n';

export function ClassificationPage() {
  const app = useApp();
  const { project, imp, rows } = app;
  const [newVal, setNewVal] = useState<Record<string, string>>({});
  const counts = useMemo(() => (imp && project ? ruleMatchCounts(imp.activities, project.classification.rules) : []), [imp, project]);
  if (!project) return null;
  const cfg = project.classification;
  const save = (c: ClassificationConfig) => app.updateProject({ classification: c });
  const setRule = (i: number, r: Rule) => save({ ...cfg, rules: cfg.rules.map((x, j) => (j === i ? r : x)) });
  const moveRule = (i: number, d: number) => {
    const rules = [...cfg.rules];
    const j = i + d;
    if (j < 0 || j >= rules.length) return;
    [rules[i], rules[j]] = [rules[j], rules[i]];
    save({ ...cfg, rules });
  };
  const setOv = (i: number, o: Override) => save({ ...cfg, overrides: cfg.overrides.map((x, j) => (j === i ? o : x)) });
  const addOverride = (id = '') => save({ ...cfg, overrides: [...cfg.overrides, { id, values: {} }] });

  const unclassified = (rows ?? []).filter((r) => r.included && DIMENSIONS.some((d) => r.cls[d] === UNCLASSIFIED));
  const ids = imp?.activities.map((a) => a.id).filter(Boolean) ?? [];

  return (
    <>
      <PageHead step={4} title={t("Classification")} right={<button className="btn primary" onClick={() => app.setPage('settings')}>{t("Next: settings →")}</button>}>
        <p>{tr('Assign Phase, Discipline, Building, Floor and Location. A manual override by Activity ID wins. Otherwise the {first} rule from the top that gives a value for that item and matches the activity is used. Each item is decided separately. Matching ignores upper/lower case. Overrides survive every new import.', { first: <b>{t('first')}</b> })}</p>
      </PageHead>
      {rows && (unclassified.length
        ? <div className="notice warn">{tr('{n} included activities are not fully classified. Add a rule or an override until this is 0.', { n: <b>{unclassified.length}</b> })}</div>
        : <div className="notice good">{t("All included activities are classified.")}</div>)}
      {DIMENSIONS.map((d) => <datalist key={d} id={`dl-${d}`}>{cfg.lists[d].map((v) => <option key={v} value={v} />)}</datalist>)}
      <datalist id="dl-ids">{ids.map((i) => <option key={i} value={i} />)}</datalist>

      <div className="card">
        <h2>{t("Lists of values")}</h2>
        <p className="small muted">{t("The values used on dashboards and filters. Rules and overrides should use these exact values; anything else is flagged on Validation.")}</p>
        <div className="grid3" style={{ marginTop: 10 }}>
          {DIMENSIONS.map((d) => (
            <div key={d} className="field">
              <label>{t(DIM_LABEL[d])}</label>
              <div className="chips">
                {cfg.lists[d].map((v) => (
                  <span className="chip" key={v}>{v}<button aria-label={t('Remove {v}', { v })} onClick={() => save({ ...cfg, lists: { ...cfg.lists, [d]: cfg.lists[d].filter((x) => x !== v) } })}>×</button></span>
                ))}
              </div>
              <form className="row" onSubmit={(e) => {
                e.preventDefault();
                const v = (newVal[d] ?? '').trim();
                if (v && !cfg.lists[d].some((x) => x.toLowerCase() === v.toLowerCase())) save({ ...cfg, lists: { ...cfg.lists, [d]: [...cfg.lists[d], v] } });
                setNewVal({ ...newVal, [d]: '' });
              }}>
                <input type="text" placeholder={t('Add a value…')} value={newVal[d] ?? ''} onChange={(e) => setNewVal({ ...newVal, [d]: e.target.value })} style={{ flex: 1 }} />
                <button className="btn small">{t("Add")}</button>
              </form>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t("Rules (first match wins, top to bottom)")}</h2>
          <button className="btn small" onClick={() => save({ ...cfg, rules: [...cfg.rules, { field: 'WBS Code', type: 'Contains', text: '', values: {} }] })}>{t("+ Add rule")}</button>
        </div>
        <p className="small muted">{t("Example: WBS Code · Contains · \".MEC\" → Discipline = Mechanical. Leave an item blank when the rule should not set it.")}</p>
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table className="t">
            <thead><tr><th>#</th><th>{t("Match field")}</th><th>{t("Match type")}</th><th>{t("Text")}</th>{DIMENSIONS.map((d) => <th key={d}>{t(DIM_LABEL[d])}</th>)}<th className="num">{t("Matches")}</th><th /></tr></thead>
            <tbody>
              {cfg.rules.length === 0 && <tr><td colSpan={11} className="muted">{t("No rules yet.")}</td></tr>}
              {cfg.rules.map((r, i) => (
                <tr key={i}>
                  <td className="muted">{i + 1}</td>
                  <td><select value={r.field} onChange={(e) => setRule(i, { ...r, field: e.target.value as Rule['field'] })}>{RULE_FIELDS.map((f) => <option key={f} value={f}>{t(f)}</option>)}</select></td>
                  <td><select value={r.type} onChange={(e) => setRule(i, { ...r, type: e.target.value as Rule['type'] })}>{RULE_TYPES.map((f) => <option key={f} value={f}>{t(f)}</option>)}</select></td>
                  <td><input type="text" value={r.text} onChange={(e) => setRule(i, { ...r, text: e.target.value })} style={{ width: 110 }} /></td>
                  {DIMENSIONS.map((d: Dimension) => (
                    <td key={d}><input type="text" list={`dl-${d}`} value={r.values[d] ?? ''} onChange={(e) => setRule(i, { ...r, values: { ...r.values, [d]: e.target.value } })} style={{ width: 108 }} /></td>
                  ))}
                  <td className="num">{counts[i] ?? ''}</td>
                  <td className="nowrap">
                    <button className="btn small" title={t("Move up")} onClick={() => moveRule(i, -1)}>↑</button>{' '}
                    <button className="btn small" title={t("Move down")} onClick={() => moveRule(i, 1)}>↓</button>{' '}
                    <button className="btn small danger" title={t("Delete rule")} onClick={() => save({ ...cfg, rules: cfg.rules.filter((_, j) => j !== i) })}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t("Manual overrides (by Activity ID)")}</h2>
          <button className="btn small" onClick={() => addOverride()}>{t("+ Add override")}</button>
        </div>
        <p className="small muted">{t("Blank items keep the value from the rules.")}</p>
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table className="t">
            <thead><tr><th>{t("Activity ID")}</th>{DIMENSIONS.map((d) => <th key={d}>{t(DIM_LABEL[d])}</th>)}<th>{t("In this import")}</th><th /></tr></thead>
            <tbody>
              {cfg.overrides.length === 0 && <tr><td colSpan={8} className="muted">{t("No overrides.")}</td></tr>}
              {cfg.overrides.map((o, i) => (
                <tr key={i}>
                  <td><input type="text" list="dl-ids" value={o.id} onChange={(e) => setOv(i, { ...o, id: e.target.value })} style={{ width: 120 }} /></td>
                  {DIMENSIONS.map((d) => <td key={d}><input type="text" list={`dl-${d}`} value={o.values[d] ?? ''} onChange={(e) => setOv(i, { ...o, values: { ...o.values, [d]: e.target.value } })} style={{ width: 108 }} /></td>)}
                  <td>{o.id && (ids.some((x) => x.toLowerCase() === o.id.trim().toLowerCase()) ? <span className="badge ok">{t("Yes")}</span> : <span className="badge warning">{t("Not found")}</span>)}</td>
                  <td><button className="btn small danger" onClick={() => save({ ...cfg, overrides: cfg.overrides.filter((_, j) => j !== i) })}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {unclassified.length > 0 && (
        <div className="card">
          <h2>{t('Activities that need classification ({n})', { n: unclassified.length })}</h2>
          <div className="table-wrap tall" style={{ marginTop: 8 }}>
            <table className="t">
              <thead><tr><th>{t("Activity ID")}</th><th>{t("Name")}</th><th>{t("WBS")}</th>{DIMENSIONS.map((d) => <th key={d}>{t(DIM_LABEL[d])}</th>)}<th /></tr></thead>
              <tbody>
                {unclassified.map((r) => (
                  <tr key={r.a.row}>
                    <td className="nowrap">{r.a.id}</td><td>{r.a.name}</td><td className="nowrap">{r.a.wbs}</td>
                    {DIMENSIONS.map((d) => <td key={d} className={r.cls[d] === UNCLASSIFIED ? 'warn' : ''}>{r.cls[d]}</td>)}
                    <td><button className="btn small" onClick={() => addOverride(r.a.id)}>{t("Add override")}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
