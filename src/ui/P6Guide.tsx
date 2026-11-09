import { useState } from 'react';
import { FIELDS, type FieldDef } from '../core/fields';
import { writeXlsx } from '../core/xlsxWrite';
import { downloadBytes } from './common';
import { Icon } from './icons';
import { t, tr } from '../i18n';

/** Column names as P6 shows them in its column picker (Columns > Available Options). */
const P6_NAME: Partial<Record<FieldDef['key'], string>> = {
  blStart: 'BL Project Start', blFinish: 'BL Project Finish', start: 'Start', finish: 'Finish',
  origDur: 'Original Duration (or Planned Duration)',
};
const name = (f: FieldDef) => P6_NAME[f.key] ?? f.headers[0];

const REQUIRED = FIELDS.filter((f) => f.group === 'Required');
const RECOMMENDED = FIELDS.filter((f) => f.group === 'Recommended');
const OPTIONAL = FIELDS.filter((f) => f.group === 'Other methods');

/** Empty workbook with the standard headers - for schedules that are not exported straight from P6. */
function downloadTemplate() {
  const header = FIELDS.map((f) => f.headers[0]);
  const bytes = writeXlsx([{ name: 'TASK', header, rows: [], widths: header.map((h) => Math.max(12, h.length + 2)) }]);
  downloadBytes('P6_import_template.xlsx', bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export function P6Guide({ open: initial = false }: { open?: boolean }) {
  const [open, setOpen] = useState(initial);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const text = [...REQUIRED, ...RECOMMENDED].map(name).join('\n');
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  return (
    <div className={`card guide ${open ? 'open' : ''}`}>
      <button className="guide-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="guide-ico"><Icon name="info" size={20} /></span>
        <span className="grow">
          <b>{t('How to export the file from Primavera P6')}</b>
          <small>{t("Two minutes, once. P6 remembers the export template for next month.")}</small>
        </span>
        <Icon name="chevron" className="chev" />
      </button>
      {open && (
        <div className="guide-body">
          <div className="guide-cols">
            <div>
              <h3>{t('Easiest: the native P6 file (XER)')}</h3>
              <ol className="guide-steps">
                <li>{tr('In P6 Professional press {f9} to schedule the project.', { f9: <kbd>F9</kbd> })}</li>
                <li>{tr('{menu} › choose {xer} › Next › tick the project › Finish.', { menu: <b>File › Export…</b>, xer: <b>Primavera PM - (XER)</b> })}</li>
                <li>{t('Drop the .xer file on this page. All columns, the WBS, calendars and the data date are read automatically - nothing to set up.')}</li>
              </ol>
              <h3>{t('Or an Excel file - P6 Professional')}</h3>
              <ol className="guide-steps">
                <li>{tr('{menu} › choose {xlsx} › Next.', { menu: <b>File › Export…</b>, xlsx: <b>Spreadsheet - (XLSX)</b> })}</li>
                <li>{tr('Tick {act} › Next › select the project › Next.', { act: <b>Activities</b> })}</li>
                <li>{tr('Template: {add} › tab {cols} › move the columns listed here to the right side › OK.', { add: <b>Add</b>, cols: <b>Columns</b> })}</li>
                <li>{tr('Pick a file name › {fin}. Drop that file on this page.', { fin: <b>Finish</b> })}</li>
              </ol>
              <h3>{t('P6 Web (EPPM)')}</h3>
              <ol className="guide-steps">
                <li>{tr('Open {act} and add the columns listed here to the view.', { act: <b>Activities</b> })}</li>
                <li>{tr('Use {dl} and drop the file here.', { dl: <b>Download › Excel (XLSX)</b> })}</li>
              </ol>
              <div className="notice info small">
                {t('Column order, extra columns, a title row above the headers, "(*)" marks and units such as "(d)" or "(h)" are all fine - columns are found by their name. If a name is different in your file, you choose it once on the mapping page and it is remembered. Old .xls files from earlier P6 versions work too.')}</div>
            </div>
            <div>
              <h3>{t("Columns to include")}</h3>
              <div className="col-list">
                <span className="col-k">{t("Required")}</span>
                {REQUIRED.map((f) => <span key={f.key} className="pill req">{name(f)}</span>)}
                <span className="col-k">{t("Recommended")}</span>
                {RECOMMENDED.map((f) => <span key={f.key} className="pill">{name(f)}</span>)}
                <span className="col-k">{t("Optional (other calculation methods)")}</span>
                {OPTIONAL.map((f) => <span key={f.key} className="pill opt">{name(f)}</span>)}
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn small" onClick={copy}>{copied ? t('Copied ✓') : t('Copy column list')}</button>
                <button className="btn small" onClick={downloadTemplate}><Icon name="download" size={14} />{t("Empty template (.xlsx)")}</button>
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>
                {tr('No baseline assigned in P6? The app then uses {ps} and tells you so on the mapping page.', { ps: <b>Planned Start / Finish</b> })}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
