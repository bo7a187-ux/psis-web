import { useApp } from '../../state';
import { PageHead } from '../common';
import { FIELDS, type FieldDef, type FieldKey } from '../../core/fields';
import type { SavedMapping, PctScaleChoice } from '../../core/importer';
import { fmtDate } from '../../core/dates';
import type { Activity } from '../../core/types';

function sample(acts: Activity[], f: FieldDef): string {
  const vals: string[] = [];
  for (const a of acts) {
    if (a.invalid[f.key]) continue;
    const v = a[f.key as keyof Activity] as unknown;
    if (v == null || v === '') continue;
    let s: string;
    if (f.kind === 'date') s = fmtDate(v as number);
    else if (f.kind === 'pct') s = `${+((v as number) * 100).toFixed(2)}%`;
    else if (f.kind === 'duration') s = `${+(v as number).toFixed(2)} d`;
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
  if (!imp) return <><PageHead step={2} title="Column mapping" /><div className="card muted">Import a file first.</div></>;

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
      <PageHead step={2} title="Column mapping" right={<button className="btn primary" onClick={() => app.setPage('validation')}>Next: validation →</button>}>
        <p>Each standard field is found by its header name, so column order does not matter. If a field is not found or the wrong column was picked, choose the right column - your choice is remembered for next month's import.</p>
      </PageHead>
      {missingReq.length > 0
        ? <div className="notice bad"><b>Required field(s) not found:</b> {missingReq.map((f) => f.label).join(', ')}. Choose the column for each one below.</div>
        : <div className="notice good">All required fields found. {mappedCount} of {FIELDS.length} fields mapped.</div>}
      {imp.sharedColumns.map((s) => <div key={s.column.index} className="notice warn">Column {s.column.letter} ({s.column.label}) is used for more than one field: {s.fields.join(', ')}.</div>)}

      <div className="card">
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Standard field</th><th>Column in your file</th><th>Found by</th><th style={{ minWidth: 230 }}>First values (as read)</th><th>Status</th><th>% scale</th></tr></thead>
            <tbody>
              {(['Required', 'Recommended', 'Other methods'] as const).map((g) => [
                <tr key={g}><td colSpan={6} style={{ background: 'var(--surface-2)', fontWeight: 650, fontSize: 12 }}>{g === 'Other methods' ? 'Used by other methods / optional' : g}</td></tr>,
                ...FIELDS.filter((f) => f.group === g).map((f) => {
                  const m = imp.matches[f.key];
                  const sv = project.mapping[f.key];
                  const selVal = sv?.ignore ? 'ignore' : m.column != null ? String(m.column) : 'auto';
                  const bad = issuesByField.get(f.key) ?? 0;
                  return (
                    <tr key={f.key}>
                      <td className="nowrap"><b>{f.label}</b>{f.required && <span className="badge critical" style={{ marginLeft: 6 }}>required</span>}</td>
                      <td>
                        <select value={selVal} onChange={(e) => setMap(f.key, e.target.value)} style={{ maxWidth: 330 }}>
                          <option value="auto">{m.column == null && !sv?.ignore ? '- not found -' : 'Automatic (by name)'}</option>
                          <option value="ignore">- Not in my file -</option>
                          {imp.columns.map((c) => <option key={c.index} value={c.index}>{c.letter}: {c.label}</option>)}
                        </select>
                      </td>
                      <td className="small muted nowrap">{m.source === 'saved' ? `your saved name "${m.matchedHeader}"` : m.source === 'default' ? `"${m.matchedHeader}"` : m.source === 'fallback' ? `fallback "${m.matchedHeader}"` : m.source === 'ignored' ? 'ignored' : ''}</td>
                      <td className="small">{m.column != null ? sample(imp.activities, f) : ''}{m.note && (m.source === 'fallback'
                        ? <div style={{ color: 'var(--amber)' }}>No baseline column in the file - "{m.matchedHeader}" is used instead.</div>
                        : <div className="muted">{m.note}</div>)}</td>
                      <td className="nowrap">
                        {m.column != null
                          ? bad ? <span className="badge critical">{bad} unreadable</span> : m.source === 'fallback' ? <span className="badge warning">Check</span> : <span className="badge ok">Mapped</span>
                          : f.required ? <span className="badge critical">MISSING</span> : <span className="badge">Not found (optional)</span>}
                      </td>
                      <td>
                        {f.kind === 'pct' && m.column != null && (
                          <>
                            <select value={String(project.importOptions.pctScale[f.key] ?? 'auto')} onChange={(e) => setScale(f.key, e.target.value)}>
                              <option value="auto">Auto ({m.scale === 100 ? '0-100' : '0-1'})</option>
                              <option value="100">0-100</option>
                              <option value="1">0-1</option>
                            </select>
                            {m.scaleNote && <div className="small" style={{ color: 'var(--amber)' }}>{m.scaleNote}</div>}
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
        <h2>Columns in your file that are not used ({imp.unusedColumns.length})</h2>
        {imp.unusedColumns.length === 0 ? <p className="muted">None - every column with a header is used.</p> : (
          <>
            <p className="small muted">These are not needed by any calculation. If one of them holds a field above, select it in the table.</p>
            <div className="chips" style={{ marginTop: 8 }}>{imp.unusedColumns.map((c) => <span key={c.index} className="chip" style={{ paddingRight: 10 }}>{c.letter}: {c.label}</span>)}</div>
          </>
        )}
      </div>
    </>
  );
}
