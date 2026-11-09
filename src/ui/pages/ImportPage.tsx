import { useRef, useState } from 'react';
import { useApp } from '../../state';
import { DateInput, PageHead, dateTime, fd } from '../common';
import { FIELDS } from '../../core/fields';
import { guessDataDate, type ImportOptions } from '../../core/importer';
import { Icon } from '../icons';
import { P6Guide } from '../P6Guide';
import { t, tr } from '../../i18n';

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
      <PageHead step={1} title={t("Import schedule")}>
        <p>{t('Export the schedule from Primavera P6 (XER or Excel) and drop the file below. It is read inside your browser - nothing is uploaded.')}</p>
      </PageHead>

      <div className={`drop ${over ? 'over' : ''} ${busy ? 'busy' : ''} ${stored ? 'compact' : ''}`} role="button" tabIndex={0}
        onClick={() => fileRef.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files[0]); }}>
        <span className="drop-ico"><Icon name={busy ? 'clock' : 'upload'} size={26} /></span>
        <div>
          <strong>{busy ? t('Reading the file…') : stored ? t("Drop this month's P6 export to replace the current import") : t('Drop the P6 export here, or click to choose it')}</strong>
          <div className="small muted">{t(".xlsx, .xls or .xer (P6 native) · your column names and settings are kept between imports")}</div>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls,.xer,.csv,.txt" hidden onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {error && <div className="notice bad"><b>{t("The file could not be read.")}</b> {t(error)}</div>}

      <P6Guide key={stored ? 'has-import' : 'no-import'} open={!stored} />

      {stored && imp && (
        <>
          <div className="card">
            <div className="card-head">
              <h2>{t("Import result")}</h2>
              <span className="small muted"><Icon name="file" size={14} /> {stored.fileName} · {t('imported {when}', { when: dateTime(stored.importedAt) })}</span>
            </div>
            <ul className="checklist">
              {(stored.info ?? []).map((x) => <CheckLine key={x} ok>{t(x)}</CheckLine>)}
              <CheckLine ok={imp.activities.length > 0}>
                {tr('{n} activities read from sheet {sheet}', { n: <b>{imp.activities.length}</b>, sheet: <b>"{sheetName}"</b> })}
                <span className="muted"> · {t(imp.headerRows === 2 ? 'header rows {r}' : 'header row {r}', { r: imp.headerRows === 2 ? `${imp.headerStart + 1}-${imp.headerStart + 2}` : imp.headerStart + 1 })}</span>
              </CheckLine>
              <CheckLine ok={reqMissing.length === 0}>
                {reqMissing.length === 0
                  ? <>{t('All {n} required columns found', { n: required.length })} <span className="muted">· {t('{m} of {n} fields matched by name', { m: mapped, n: FIELDS.length })}</span></>
                  : tr('Missing required columns: {list}. Add them to the P6 export (see the guide above), or pick the column on the mapping page.', { list: <b>{reqMissing.map((f) => t(f.label)).join('، ')}</b> })}
              </CheckLine>
              {fallbacks.map((f) => (
                <CheckLine key={f.key} warn>{t(f.label)}: {t(imp.matches[f.key].note ?? '')}</CheckLine>
              ))}
              <CheckLine ok={unread === 0} warn={unread > 0}>
                {unread === 0 ? t('Every value could be read') : tr('{n} values could not be read - listed on the Validation page', { n: <b>{unread}</b> })}
              </CheckLine>
              <CheckLine ok={project.settings.dataDate != null} warn={project.settings.dataDate == null}>
                {project.settings.dataDate != null
                  ? <span className="row" style={{ gap: 8 }}>{t("Data date")}{' '}<DateInput value={project.settings.dataDate} onChange={setDD} /> <span className="muted small">{t("check it matches the P6 Data Date")}</span></span>
                  : <span className="row" style={{ gap: 8 }}>
                      {t("Data date not set.")}{' '}
                      {guess && <>{tr('The file suggests {d}', { d: <b>{fd(guess.value)}</b> })}<button className="btn small primary" onClick={() => setDD(guess.value)}>{t('Use {d}', { d: fd(guess.value) })}</button><span className="muted small">{t("or type the P6 Data Date:")}</span></>}
                      <DateInput value={null} onChange={setDD} />
                    </span>}
              </CheckLine>
              {imp.notes.map((n) => <CheckLine key={n} warn>{t(n)}</CheckLine>)}
            </ul>
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn primary" onClick={() => app.setPage('mapping')}>{t("Next: check column mapping →")}</button>
            </div>
          </div>

          <details className="card">
            <summary><h2 style={{ display: 'inline' }}>{t("Import options")}</h2> <span className="small muted">{t("- only needed if the result above looks wrong")}</span></summary>
            <div className="grid3" style={{ marginTop: 14 }}>
              <div className="field">
                <label>{t("Worksheet")}</label>
                <select value={stored.sheetIndex} onChange={(e) => app.setSheet(+e.target.value)}>
                  {stored.sheets.map((s, i) => <option key={i} value={i}>{s.name} ({t('{n} rows', { n: Math.max(0, s.rows.length - 1) })})</option>)}
                </select>
                <span className="help">{t("P6 exports put activities on the sheet \"TASK\". Picked automatically.")}</span>
              </div>
              <div className="field">
                <label>{t("Header rows")}</label>
                <select value={String(opts.headerRows)} onChange={(e) => setOpt({ headerRows: e.target.value === 'auto' ? 'auto' : (+e.target.value as 1 | 2) })}>
                  <option value="auto">{t("Detect automatically")}</option>
                  <option value="1">{t("1 row (labels)")}</option>
                  <option value="2">{t("2 rows (P6 field codes + labels)")}</option>
                </select>
              </div>
              <div className="field">
                <label>{t("Durations and float without a unit are in")}</label>
                <select value={opts.durationUnit} onChange={(e) => setOpt({ durationUnit: e.target.value as 'Days' | 'Hours' })}>
                  <option value="Days">{t("Days")}</option><option value="Hours">{t("Hours")}</option>
                </select>
                <span className="help">{t("Headers like \"Original Duration(h)\" and values like \"14d\" carry their own unit and are always read correctly.")}</span>
              </div>
              <div className="field">
                <label>{t("Hours per day")}</label>
                <input type="number" min={1} max={24} step={0.5} value={opts.hoursPerDay} onChange={(e) => +e.target.value > 0 && setOpt({ hoursPerDay: +e.target.value })} />
                <span className="help">{t("Used only to convert hours to days.")}</span>
              </div>
              <div className="field">
                <label>{t("Numeric dates like 03/04/2026 mean")}</label>
                <select value={opts.numericDateOrder} onChange={(e) => setOpt({ numericDateOrder: e.target.value as 'DMY' | 'MDY' })}>
                  <option value="DMY">{t("day / month / year (03-Apr-26)")}</option>
                  <option value="MDY">{t("month / day / year (04-Mar-26)")}</option>
                </select>
                <span className="help">{t("Dates such as 08-Nov-26 or real Excel dates are not affected.")}</span>
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
      <summary><h2 style={{ display: 'inline' }}>{t("File preview")}</h2> <span className="small muted">{t("- the first rows exactly as they are in the file")}</span></summary>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="t">
          <thead><tr><th>{t("Row")}</th>{imp.columns.map((c) => <th key={c.index}>{c.letter}</th>)}</tr></thead>
          <tbody>
            {show.map((r, i) => (
              <tr key={i} style={i >= imp.headerStart && i < imp.headerStart + imp.headerRows ? { fontWeight: 650, background: 'var(--blue-soft)' } : undefined}>
                <td className="muted">{i + 1}</td>
                {Array.from({ length: width }, (_, j) => {
                  const c = r?.[j];
                  const txt = c == null ? '' : typeof c === 'object' ? `[date ${c.d}]` : String(c);
                  return <td key={j} className="nowrap">{txt.length > 40 ? txt.slice(0, 40) + '…' : txt}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">{t("Highlighted rows are the header rows found. Cells shown as [date …] are real Excel dates (serial numbers).")}</p>
    </details>
  );
}
