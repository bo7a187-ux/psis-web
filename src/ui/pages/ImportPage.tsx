import { useRef, useState } from 'react';
import { useApp } from '../../state';
import { DateInput, PageHead, dateTime } from '../common';
import { FIELDS } from '../../core/fields';
import { guessDataDate, type ImportOptions } from '../../core/importer';
import { fmtDate } from '../../core/dates';
import { Icon } from '../icons';
import { P6Guide } from '../P6Guide';

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
  const setDD = (d: number | null) => app.updateProject({ settings: { ...project.settings, dataDate: d } }, 'Data date changed');
  const opts = project.importOptions;
  const required = FIELDS.filter((f) => f.required);
  const mapped = imp ? FIELDS.filter((f) => imp.matches[f.key].column != null).length : 0;
  const reqMissing = imp ? required.filter((f) => imp.matches[f.key].column == null) : [];
  const fallbacks = imp ? FIELDS.filter((f) => imp.matches[f.key].source === 'fallback') : [];
  const unread = imp ? imp.cellIssues.filter((c) => c.severity === 'Critical').length : 0;
  const guess = imp && project.settings.dataDate == null ? guessDataDate(imp.activities) : null;
  const sheetName = stored ? stored.sheets[stored.sheetIndex]?.name : '';

  return (
    <>
      <PageHead step={1} title="Import schedule">
        <p>Export the activities from Primavera P6 to Excel and drop the file below. It is read inside your browser - nothing is uploaded.</p>
      </PageHead>

      <div className={`drop ${over ? 'over' : ''} ${busy ? 'busy' : ''} ${stored ? 'compact' : ''}`} role="button" tabIndex={0}
        onClick={() => fileRef.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files[0]); }}>
        <span className="drop-ico"><Icon name={busy ? 'clock' : 'upload'} size={26} /></span>
        <div>
          <strong>{busy ? 'Reading the file…' : stored ? 'Drop this month\'s P6 export to replace the current import' : 'Drop the P6 Excel export here, or click to choose it'}</strong>
          <div className="small muted">.xlsx, .xls or .xer (P6 native) · your column names and settings are kept between imports</div>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls,.xer,.csv,.txt" hidden onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {error && <div className="notice bad"><b>The file could not be read.</b> {error}</div>}

      <P6Guide key={stored ? 'has-import' : 'no-import'} open={!stored} />

      {stored && imp && (
        <>
          <div className="card">
            <div className="card-head">
              <h2>Import result</h2>
              <span className="small muted"><Icon name="file" size={14} /> {stored.fileName} · imported {dateTime(stored.importedAt)}</span>
            </div>
            <ul className="checklist">
              {(stored.info ?? []).map((x) => <CheckLine key={x} ok>{x}</CheckLine>)}
              <CheckLine ok={imp.activities.length > 0}>
                <b>{imp.activities.length}</b> activities read from sheet <b>"{sheetName}"</b>
                <span className="muted"> · header {imp.headerRows === 2 ? 'rows' : 'row'} {imp.headerStart + 1}{imp.headerRows === 2 ? `-${imp.headerStart + 2}` : ''}</span>
              </CheckLine>
              <CheckLine ok={reqMissing.length === 0}>
                {reqMissing.length === 0
                  ? <>All {required.length} required columns found <span className="muted">· {mapped} of {FIELDS.length} fields matched by name</span></>
                  : <>Missing required column{reqMissing.length > 1 ? 's' : ''}: <b>{reqMissing.map((f) => f.label).join(', ')}</b>. Add {reqMissing.length > 1 ? 'them' : 'it'} to the P6 export (see the guide above), or pick the column on the mapping page.</>}
              </CheckLine>
              {fallbacks.map((f) => (
                <CheckLine key={f.key} warn>{f.label}: {imp.matches[f.key].note}</CheckLine>
              ))}
              <CheckLine ok={unread === 0} warn={unread > 0}>
                {unread === 0 ? 'Every value could be read' : <><b>{unread}</b> value{unread > 1 ? 's' : ''} could not be read - listed on the Validation page</>}
              </CheckLine>
              <CheckLine ok={project.settings.dataDate != null} warn={project.settings.dataDate == null}>
                {project.settings.dataDate != null
                  ? <span className="row" style={{ gap: 8 }}>Data date <DateInput value={project.settings.dataDate} onChange={setDD} /> <span className="muted small">check it matches the P6 Data Date</span></span>
                  : <span className="row" style={{ gap: 8 }}>
                      Data date not set.{' '}
                      {guess && <>The file suggests <b>{fmtDate(guess.value)}</b><button className="btn small primary" onClick={() => setDD(guess.value)}>Use {fmtDate(guess.value)}</button><span className="muted small">or type the P6 Data Date:</span></>}
                      <DateInput value={null} onChange={setDD} />
                    </span>}
              </CheckLine>
              {imp.notes.map((n) => <CheckLine key={n} warn>{n}</CheckLine>)}
            </ul>
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn primary" onClick={() => app.setPage('mapping')}>Next: check column mapping →</button>
            </div>
          </div>

          <details className="card">
            <summary><h2 style={{ display: 'inline' }}>Import options</h2> <span className="small muted">- only needed if the result above looks wrong</span></summary>
            <div className="grid3" style={{ marginTop: 14 }}>
              <div className="field">
                <label>Worksheet</label>
                <select value={stored.sheetIndex} onChange={(e) => app.setSheet(+e.target.value)}>
                  {stored.sheets.map((s, i) => <option key={i} value={i}>{s.name} ({Math.max(0, s.rows.length - 1)} rows)</option>)}
                </select>
                <span className="help">P6 exports put activities on the sheet "TASK". Picked automatically.</span>
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
                <span className="help">Headers like "Original Duration(h)" and values like "14d" carry their own unit and are always read correctly.</span>
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
            </div>
          </details>
          <RawPreview />
        </>
      )}
    </>
  );
}

function CheckLine({ ok, warn, children }: { ok?: boolean; warn?: boolean; children: React.ReactNode }) {
  const tone = ok ? 'ok' : warn ? 'warn' : 'bad';
  return <li className={tone}><span className="cl-ico"><Icon name={ok ? 'check' : 'alert'} size={14} stroke={2.4} /></span><span>{children}</span></li>;
}

function RawPreview() {
  const { stored, imp } = useApp();
  if (!stored || !imp) return null;
  const rows = stored.sheets[stored.sheetIndex].rows;
  const show = rows.slice(0, imp.headerStart + imp.headerRows + 8);
  const width = imp.columns.length;
  return (
    <details className="card">
      <summary><h2 style={{ display: 'inline' }}>File preview</h2> <span className="small muted">- the first rows exactly as they are in the file</span></summary>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="t">
          <thead><tr><th>Row</th>{imp.columns.map((c) => <th key={c.index}>{c.letter}</th>)}</tr></thead>
          <tbody>
            {show.map((r, i) => (
              <tr key={i} style={i >= imp.headerStart && i < imp.headerStart + imp.headerRows ? { fontWeight: 650, background: 'var(--blue-soft)' } : undefined}>
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
      <p className="small muted">Highlighted rows are the header rows found. Cells shown as [date …] are real Excel dates (serial numbers).</p>
    </details>
  );
}
