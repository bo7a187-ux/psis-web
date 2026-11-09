import { useApp } from '../../state';
import { PageHead, fd } from '../common';
import { FIELDS, type FieldDef, type FieldKey } from '../../core/fields';
import type { SavedMapping, PctScaleChoice } from '../../core/importer';
import type { Activity } from '../../core/types';
import { t, tr } from '../../i18n';

function sample(acts: Activity[], f: FieldDef): string {
  const vals: string[] = [];
  for (const a of acts) {
    if (a.invalid[f.key]) continue;
    const v = a[f.key as keyof Activity] as unknown;
    if (v == null || v === '') continue;
    let s: string;
    if (f.kind === 'date') s = fd(v as number);
    else if (f.kind === 'pct') s = `${+((v as number) * 100).toFixed(2)}%`;
    else if (f.kind === 'duration') s = `${+(v as number).toFixed(2)} ${t('d')}`;
    else s = String(v);
    if (!vals.includes(s)) vals.push(s);
    if (vals.length >= 3) break;
  }
  return vals.join(' · ');
}

export function MappingPage() {
  const app = useApp();
  const { project, imp } = app;
  if (!project) return null;
  if (!imp) return <><PageHead step={2} title={t("Column mapping")} /><div className="card muted">{t("Import a file first.")}</div></>;

  const setMap = (key: FieldKey, val: string) => {
    const m: SavedMapping = { ...project.mapping };
    const prev = m[key]?.headers ?? [];
    if (val === 'auto') delete m[key];
    else if (val === 'ignore') m[key] = { headers: prev, ignore: true };
    else {
      const col = imp.columns[+val];
      const names = [col.header2, col.header1].filter(Boolean);
      m[key] = { headers: [...names, ...prev.filter((h) => !names.includes(h))].slice(0, 6) };
    }
    app.updateProject({ mapping: m }, 'Column mapping changed');
  };
  const setScale = (key: FieldKey, v: string) => {
    const pctScale = { ...project.importOptions.pctScale, [key]: (v === 'auto' ? 'auto' : +v) as PctScaleChoice };
    app.updateProject({ importOptions: { ...project.importOptions, pctScale } });
  };
  const missingReq = FIELDS.filter((f) => f.required && imp.matches[f.key].column == null);
  const mappedCount = FIELDS.filter((f) => imp.matches[f.key].column != null).length;
  const issuesByField = new Map<FieldKey, number>();
  imp.cellIssues.forEach((c) => c.severity === 'Critical' && issuesByField.set(c.field, (issuesByField.get(c.field) ?? 0) + 1));

  return (
    <>
      <PageHead step={2} title={t("Column mapping")} right={<button className="btn primary" onClick={() => app.setPage('validation')}>{t("Next: validation →")}</button>}>
        <p>{t("Each standard field is found by its header name, so column order does not matter. If a field is not found or the wrong column was picked, choose the right column - your choice is remembered for next month's import.")}</p>
      </PageHead>
      {missingReq.length > 0
        ? <div className="notice bad">{tr('{b} {list}. Choose the column for each one below.', { b: <b>{t('Required field(s) not found:')}</b>, list: missingReq.map((f) => t(f.label)).join('، ') })}</div>
        : <div className="notice good">{t('All required fields found.')} {t('{m} of {n} fields mapped.', { m: mappedCount, n: FIELDS.length })}</div>}
      {imp.sharedColumns.map((s) => <div key={s.column.index} className="notice warn">{t('Column {col} ({label}) is used for more than one field: {fields}.', { col: s.column.letter, label: s.column.label, fields: s.fields.map((k) => t(FIELDS.find((f) => f.key === k)?.label ?? k)).join('، ') })}</div>)}

      <div className="card">
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>{t("Standard field")}</th><th>{t("Column in your file")}</th><th>{t("Found by")}</th><th style={{ minWidth: 230 }}>{t("First values (as read)")}</th><th>{t("Status")}</th><th>{t("% scale")}</th></tr></thead>
            <tbody>
              {(['Required', 'Recommended', 'Other methods'] as const).map((g) => [
                <tr key={g}><td colSpan={6} style={{ background: 'var(--surface-2)', fontWeight: 650, fontSize: 12 }}>{t(g === 'Other methods' ? 'Used by other methods / optional' : g)}</td></tr>,
                ...FIELDS.filter((f) => f.group === g).map((f) => {
                  const m = imp.matches[f.key];
                  const sv = project.mapping[f.key];
                  const selVal = sv?.ignore ? 'ignore' : m.column != null ? String(m.column) : 'auto';
                  const bad = issuesByField.get(f.key) ?? 0;
                  return (
                    <tr key={f.key}>
                      <td className="nowrap"><b>{t(f.label)}</b>{f.required && <span className="badge critical" style={{ marginInlineStart: 6 }}>{t("required")}</span>}</td>
                      <td>
                        <select value={selVal} onChange={(e) => setMap(f.key, e.target.value)} style={{ maxWidth: 330 }}>
                          <option value="auto">{m.column == null && !sv?.ignore ? t('- not found -') : t('Automatic (by name)')}</option>
                          <option value="ignore">{t("- Not in my file -")}</option>
                          {imp.columns.map((c) => <option key={c.index} value={c.index}>{c.letter}: {c.label}</option>)}
                        </select>
                      </td>
                      <td className="small muted nowrap">{m.source === 'saved' ? t('your saved name "{h}"', { h: m.matchedHeader }) : m.source === 'default' ? `"${m.matchedHeader}"` : m.source === 'fallback' ? t('fallback "{h}"', { h: m.matchedHeader }) : m.source === 'ignored' ? t('ignored') : ''}</td>
                      <td className="small">{m.column != null ? sample(imp.activities, f) : ''}{m.note && (m.source === 'fallback'
                        ? <div style={{ color: 'var(--amber)' }}>{t('No baseline column in the file - "{h}" is used instead.', { h: m.matchedHeader })}</div>
                        : <div className="muted">{t(m.note)}</div>)}</td>
                      <td className="nowrap">
                        {m.column != null
                          ? bad ? <span className="badge critical">{t('{n} unreadable', { n: bad })}</span> : m.source === 'fallback' ? <span className="badge warning">{t('Check this')}</span> : <span className="badge ok">{t("Mapped")}</span>
                          : f.required ? <span className="badge critical">{t("MISSING")}</span> : <span className="badge">{t("Not found (optional)")}</span>}
                      </td>
                      <td>
                        {f.kind === 'pct' && m.column != null && (
                          <>
                            <select value={String(project.importOptions.pctScale[f.key] ?? 'auto')} onChange={(e) => setScale(f.key, e.target.value)}>
                              <option value="auto">{t('Auto')} ({m.scale === 100 ? '0-100' : '0-1'})</option>
                              <option value="100">0-100</option>
                              <option value="1">0-1</option>
                            </select>
                            {m.scaleNote && <div className="small" style={{ color: 'var(--amber)' }}>{t(m.scaleNote)}</div>}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                }),
              ])}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>{t('Columns in your file that are not used ({n})', { n: imp.unusedColumns.length })}</h2>
        {imp.unusedColumns.length === 0 ? <p className="muted">{t("None - every column with a header is used.")}</p> : (
          <>
            <p className="small muted">{t("These are not needed by any calculation. If one of them holds a field above, select it in the table.")}</p>
            <div className="chips" style={{ marginTop: 8 }}>{imp.unusedColumns.map((c) => <span key={c.index} className="chip" style={{ paddingRight: 10 }}>{c.letter}: {c.label}</span>)}</div>
          </>
        )}
      </div>
    </>
  );
}
