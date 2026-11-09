import { useState } from 'react';
import { FIELDS, type FieldDef } from '../core/fields';
import { writeXlsx } from '../core/xlsxWrite';
import { downloadBytes } from './common';
import { Icon } from './icons';

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
          <b>How to export the Excel file from Primavera P6</b>
          <small>Two minutes, once. P6 remembers the export template for next month.</small>
        </span>
        <Icon name="chevron" className="chev" />
      </button>
      {open && (
        <div className="guide-body">
          <div className="guide-cols">
            <div>
              <h3>P6 Professional</h3>
              <ol className="guide-steps">
                <li>Open the project and press <kbd>F9</kbd> to schedule it. Note the <b>Data Date</b>.</li>
                <li><b>File › Export…</b> › choose <b>Spreadsheet - (XLSX)</b> › Next.</li>
                <li>Tick <b>Activities</b> › Next › select the project › Next.</li>
                <li>Template: <b>Add</b> › tab <b>Columns</b> › move the columns listed here to the right side › OK.</li>
                <li>Pick a file name › <b>Finish</b>. Drop that file on this page.</li>
              </ol>
              <h3>P6 Web (EPPM)</h3>
              <ol className="guide-steps">
                <li>Open <b>Activities</b> and add the columns listed here to the view.</li>
                <li>Use <b>Download › Excel (XLSX)</b> and drop the file here.</li>
              </ol>
              <div className="notice info small">
                Column order, extra columns, a title row above the headers, "(*)" marks and units such as "(d)" or "(h)" are all fine -
                columns are found by their name. If a name is different in your file, you choose it once on the mapping page and it is remembered.
              </div>
            </div>
            <div>
              <h3>Columns to include</h3>
              <div className="col-list">
                <span className="col-k">Required</span>
                {REQUIRED.map((f) => <span key={f.key} className="pill req">{name(f)}</span>)}
                <span className="col-k">Recommended</span>
                {RECOMMENDED.map((f) => <span key={f.key} className="pill">{name(f)}</span>)}
                <span className="col-k">Optional (other calculation methods)</span>
                {OPTIONAL.map((f) => <span key={f.key} className="pill opt">{name(f)}</span>)}
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn small" onClick={copy}>{copied ? 'Copied ✓' : 'Copy column list'}</button>
                <button className="btn small" onClick={downloadTemplate}><Icon name="download" size={14} />Empty template (.xlsx)</button>
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>
                No baseline assigned in P6? The app then uses <b>Planned Start / Finish</b> and tells you so on the mapping page.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
