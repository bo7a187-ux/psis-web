import { useRef, useState } from 'react';
import { useApp } from '../../state';
import { DateInput, PageHead, Stat, dateTime } from '../common';
import { FIELDS } from '../../core/fields';
import type { ImportOptions } from '../../core/importer';

export function ImportPage() {
  const app = useApp();
  const { project, stored, imp } = app;
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  if (!project) return null;

  const handle = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true); setError('');
    try { await app.importFile(f); } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };
  const setOpt = (patch: Partial<ImportOptions>) => app.updateProject({ importOptions: { ...project.importOptions, ...patch } });
  const opts = project.importOptions;
  const mapped = imp ? FIELDS.filter((f) => imp.matches[f.key].column != null).length : 0;
  const reqMissing = imp ? FIELDS.filter((f) => f.required && imp.matches[f.key].column == null) : [];
  const unread = imp ? imp.cellIssues.filter((c) => c.severity === 'Critical').length : 0;

  return (
    <>
      <PageHead title="1. Import schedule">
        <p>Export the activities from Primavera P6 to Excel (.xlsx) and choose the file here. The file is read inside your browser and is not uploaded.</p>
      </PageHead>

      <div className={`drop ${over ? 'over' : ''}`} onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files[0]); }}>
        <strong>{busy ? 'Reading…' : 'Click to choose the P6 export, or drop it here'}</strong>
        <div className="small muted" style={{ marginTop: 4 }}>.xlsx (recommended) or .csv</div>
        <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.csv" hidden onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {error && <div className="notice bad">{error}</div>}

      {stored && imp && (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-head">
              <h2>Current import</h2>
              <span className="small muted">{stored.fileName} · imported {dateTime(stored.importedAt)}</span>
            </div>
            <div className="grid3">
              <Stat k="Activities read" v={imp.activities.length} />
              <Stat k="Fields found" v={`${mapped} / ${FIELDS.length}`} tone={reqMissing.length ? 'bad' : 'good'} sub={reqMissing.length ? `Missing required: ${reqMissing.map((f) => f.label).join(', ')}` : 'All required fields found'} />
              <Stat k="Values that could not be read" v={unread} tone={unread ? 'bad' : 'good'} sub={unread ? 'Listed on Validation' : 'None'} />
              <Stat k="Header rows" v={imp.headerRows} sub={`${opts.headerRows === 'auto' ? 'detected automatically' : 'set manually'} · starting at sheet row ${imp.headerStart + 1}`} />
            </div>
            {imp.notes.map((n) => <div key={n} className="notice warn">{n}</div>)}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={() => app.setPage('mapping')}>Next: check column mapping →</button>
            </div>
          </div>

          <div className="card">
            <h2>Import options</h2>
            <p className="small muted">The defaults suit a standard P6 export. Change them only if the preview or mapping looks wrong.</p>
            <div className="grid3" style={{ marginTop: 10 }}>
              <div className="field">
                <label>Worksheet</label>
                <select value={stored.sheetIndex} onChange={(e) => app.setSheet(+e.target.value)}>
                  {stored.sheets.map((s, i) => <option key={i} value={i}>{s.name} ({Math.max(0, s.rows.length - 1)} rows)</option>)}
                </select>
                <span className="help">P6 exports put activities on the sheet "TASK".</span>
              </div>
              <div className="field">
                <label>Header rows</label>
                <select value={String(opts.headerRows)} onChange={(e) => setOpt({ headerRows: e.target.value === 'auto' ? 'auto' : (+e.target.value as 1 | 2) })}>
                  <option value="auto">Detect automatically</option>
                  <option value="1">1 row (labels)</option>
                  <option value="2">2 rows (P6 field codes + labels)</option>
                </select>
              </div>
              <div className="field">
                <label>Durations and float without a unit are in</label>
                <select value={opts.durationUnit} onChange={(e) => setOpt({ durationUnit: e.target.value as 'Days' | 'Hours' })}>
                  <option>Days</option><option>Hours</option>
                </select>
                <span className="help">Values like "14d" or "112h" carry their own unit and are always read correctly.</span>
              </div>
              <div className="field">
                <label>Hours per day</label>
                <input type="number" min={1} max={24} step={0.5} value={opts.hoursPerDay} onChange={(e) => +e.target.value > 0 && setOpt({ hoursPerDay: +e.target.value })} />
                <span className="help">Used only to convert hours to days.</span>
              </div>
              <div className="field">
                <label>Numeric dates like 03/04/2026 mean</label>
                <select value={opts.numericDateOrder} onChange={(e) => setOpt({ numericDateOrder: e.target.value as 'DMY' | 'MDY' })}>
                  <option value="DMY">day / month / year (03-Apr-26)</option>
                  <option value="MDY">month / day / year (04-Mar-26)</option>
                </select>
                <span className="help">Dates such as 08-Nov-26 or real Excel dates are not affected.</span>
              </div>
              <div className="field">
                <label>Reporting data date</label>
                <DateInput value={project.settings.dataDate} onChange={(d) => app.updateProject({ settings: { ...project.settings, dataDate: d } })} />
                <span className="help">Usually the P6 Data Date. Treated as the start of the day.</span>
              </div>
            </div>
          </div>
          <RawPreview />
        </>
      )}
    </>
  );
}

function RawPreview() {
  const { stored, imp } = useApp();
  if (!stored || !imp) return null;
  const rows = stored.sheets[stored.sheetIndex].rows;
  const show = rows.slice(0, imp.headerStart + imp.headerRows + 8);
  const width = imp.columns.length;
  return (
    <div className="card">
      <h2>File preview (first rows, as in the file)</h2>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Row</th>{imp.columns.map((c) => <th key={c.index}>{c.letter}</th>)}</tr></thead>
          <tbody>
            {show.map((r, i) => (
              <tr key={i} style={i >= imp.headerStart && i < imp.headerStart + imp.headerRows ? { fontWeight: 650, background: '#f7f9fc' } : undefined}>
                <td className="muted">{i + 1}</td>
                {Array.from({ length: width }, (_, j) => {
                  const c = r?.[j];
                  const t = c == null ? '' : typeof c === 'object' ? `[date ${c.d}]` : String(c);
                  return <td key={j} className="nowrap">{t.length > 40 ? t.slice(0, 40) + '…' : t}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">Bold rows are the header rows found. Cells shown as [date …] are real Excel dates (serial numbers).</p>
    </div>
  );
}
