import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fmtDate, fromYMD, parseDateText, toYMD, type Day } from '../core/dates';
import { t, getLang } from '../i18n';

export function pct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '';
  return `${(v * 100).toFixed(digits)}%`;
}
export function pp(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '';
  const x = v * 100;
  return `${ltr(`${x > 0 ? '+' : ''}${x.toFixed(digits)}`)} ${t('pp')}`;
}

/** Keeps dates, signed numbers and codes left-to-right inside Arabic (right-to-left) text. Display only. */
export const ltr = (s: string): string => (getLang() === 'ar' && s ? `\u2066${s}\u2069` : s);
/** Date for display (dd-Mmm-yy), safe inside Arabic text. Use fmtDate for values compared or typed. */
export const fd = (d: Day | null | undefined): string => ltr(fmtDate(d));
export function num(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return '';
  const s = v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return v < 0 ? ltr(s) : s;
}
export function dateTime(iso: string): string {
  const d = new Date(iso);
  const day = fromYMD(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return ltr(`${fmtDate(day)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
}

/** Date field that always shows dd-Mmm-yy. Type a date or use the calendar button. */
export function DateInput({ value, onChange, id }: { value: Day | null; onChange: (d: Day | null) => void; id?: string }) {
  const [text, setText] = useState(fmtDate(value));
  const [err, setErr] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => { setText(fmtDate(value)); setErr(''); }, [value]);
  const commit = () => {
    if (text.trim() === '') { setErr(''); onChange(null); return; }
    const r = parseDateText(text);
    if (r.value == null) { setErr(t(r.error ?? 'Invalid date')); return; }
    setErr('');
    onChange(r.value);
  };
  const iso = value != null ? (() => { const { y, m, d } = toYMD(value); return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; })() : '';
  return (
    <span className={`date-input ${err ? 'err' : ''}`} title={err || t('Type e.g. 08-Nov-26, or use the calendar')}>
      <input id={id} type="text" value={text} placeholder={t("dd-Mmm-yy")} onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()} />
      <button type="button" className="btn small" aria-label={t("Open calendar")} onClick={() => {
        const el = picker.current;
        if (!el) return;
        try { el.showPicker(); } catch { el.focus(); }
      }}>📅</button>
      <input ref={picker} type="date" tabIndex={-1} value={iso} onChange={(e) => {
        const [y, m, d] = e.target.value.split('-').map(Number);
        const v = fromYMD(y, m, d);
        if (v != null) onChange(v);
      }} />
      {err && <span className="small" style={{ color: 'var(--red)' }}>{err}</span>}
    </span>
  );
}

export function Stat({ k, v, tone, sub }: { k: string; v: ReactNode; tone?: 'bad' | 'warn' | 'good'; sub?: ReactNode }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {sub && <div className="small muted">{sub}</div>}
    </div>
  );
}

export function SevBadge({ s }: { s: 'Critical' | 'Warning' | 'Info' }) {
  return <span className={`badge ${s.toLowerCase()}`}>{t(s)}</span>;
}

/** Prints with this paper size (e.g. "A4 landscape"), then the normal A4 portrait applies again. */
export function printWith(size: string, bodyClass?: string) {
  const st = document.createElement('style');
  st.textContent = `@media print { @page { size: ${size}; margin: 8mm; } }`;
  document.head.appendChild(st);
  if (bodyClass) document.body.classList.add(bodyClass);
  const done = () => { st.remove(); if (bodyClass) document.body.classList.remove(bodyClass); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}

/** Rows drawn at once in a long table: a 10 000-activity schedule stays quick to scroll and type in. */
export const PAGE_ROWS = 300;
/**
 * First PAGE_ROWS of a list plus a "show more" bar. The count goes back to PAGE_ROWS when resetKey
 * changes (a new search or filter), but not when the same list is recalculated after an entry.
 */
export function useLimit<T>(list: readonly T[], resetKey = ''): { shown: readonly T[]; more: ReactNode } {
  const [st, setSt] = useState({ n: PAGE_ROWS, key: resetKey });
  const n = st.key === resetKey ? st.n : PAGE_ROWS;
  if (list.length <= n) return { shown: list, more: null };
  return {
    shown: list.slice(0, n),
    more: (
      <div className="more-rows">
        <span className="small muted">{t('Showing {m} of {n}.', { m: n, n: list.length })}</span>
        <button className="btn small" onClick={() => setSt({ n: n + PAGE_ROWS * 2, key: resetKey })}>{t('Show {k} more', { k: Math.min(PAGE_ROWS * 2, list.length - n) })}</button>
        <button className="btn small" onClick={() => setSt({ n: Infinity, key: resetKey })}>{t('Show all ({n})', { n: list.length })}</button>
      </div>
    ),
  };
}

/** useLimit as a component, for pages that return early before their tables (hooks cannot follow a return). */
export function Limited<T>({ list, resetKey = '', children }: { list: readonly T[]; resetKey?: string; children: (shown: readonly T[], more: ReactNode) => ReactNode }) {
  const { shown, more } = useLimit(list, resetKey);
  return <>{children(shown, more)}</>;
}

export function PageHead({ title, children, right, step }: { title: string; children?: ReactNode; right?: ReactNode; step?: number }) {
  return (
    <div className="page-head">
      <div>
        {step != null && <div className="eyebrow">{t('Step {n} of 6 · Monthly workflow', { n: step })}</div>}
        <h1>{title}</h1>
        {children}
      </div>
      {right}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card muted" style={{ textAlign: 'center', padding: 40 }}>{children}</div>;
}

/** In-page dialog (browser prompt/confirm boxes are blocked in some hosts). */
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Ask for a text value. If `confirmWord` is set, the OK button stays disabled until the user types it. */
export function AskText({ title, label, initial = '', okLabel = 'OK', danger, confirmWord, help, onOk, onClose }: {
  title: string; label: string; initial?: string; okLabel?: string; danger?: boolean; confirmWord?: string; help?: ReactNode;
  onOk: (v: string) => void; onClose: () => void;
}) {
  const [v, setV] = useState(initial);
  const ok = confirmWord ? v.trim() === confirmWord : v.trim() !== '';
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (ok) { onOk(v.trim()); onClose(); } }}>
        {help && <div className="small" style={{ margin: '6px 0 10px' }}>{help}</div>}
        <div className="field">
          <label htmlFor="ask-text">{label}</label>
          <input id="ask-text" type="text" autoFocus value={v} onChange={(e) => setV(e.target.value)} />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
          <button type="button" className="btn" onClick={onClose}>{t("Cancel")}</button>
          <button type="submit" className={`btn ${danger ? 'danger' : 'primary'}`} disabled={!ok}>{okLabel}</button>
        </div>
      </form>
    </Modal>
  );
}

/** A button that asks "Click again to confirm" before running the action. */
export function ConfirmButton({ children, confirmText = 'Click again to confirm', onConfirm, className = 'btn' }: {
  children: ReactNode; confirmText?: string; onConfirm: () => void; className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const tm = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(tm); }, [armed]);
  return <button className={armed ? `${className} danger` : className} onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>{armed ? confirmText : children}</button>;
}

/** Save text as a file. (Browsers block this inside some preview frames; it works in the downloaded file and on the hosted site.) */
export function downloadText(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadBytes(name: string, bytes: Uint8Array, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** "12 days late vs 30-Apr-27" / "3 days early" / "on baseline 30-Apr-27", translated. */
export function delayText(days: number | null | undefined, blFinish: number | null | undefined): string {
  if (days == null) return '';
  if (days > 0) return t('{n} days late vs {date}', { n: days, date: fd(blFinish) });
  if (days < 0) return t('{n} days early', { n: -days });
  return t('on baseline {date}', { date: fd(blFinish) });
}

/** Translate each message of a list (health reasons, flags…) and join them. */
export const tjoin = (xs: string[], sep = ' · ') => xs.map((x) => t(x)).join(sep);
