import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fmtDate, fromYMD, parseDateText, toYMD, type Day } from '../core/dates';

export function pct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '';
  return `${(v * 100).toFixed(digits)}%`;
}
export function pp(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '';
  const x = v * 100;
  return `${x > 0 ? '+' : ''}${x.toFixed(digits)} pp`;
}
export function num(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return '';
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export function dateTime(iso: string): string {
  const d = new Date(iso);
  const day = fromYMD(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return `${fmtDate(day)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
    if (r.value == null) { setErr(r.error ?? 'Invalid date'); return; }
    setErr('');
    onChange(r.value);
  };
  const iso = value != null ? (() => { const { y, m, d } = toYMD(value); return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; })() : '';
  return (
    <span className={`date-input ${err ? 'err' : ''}`} title={err || 'Type e.g. 08-Nov-26, or use the calendar'}>
      <input id={id} type="text" value={text} placeholder="dd-Mmm-yy" onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()} />
      <button type="button" className="btn small" aria-label="Open calendar" onClick={() => {
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
  return <span className={`badge ${s.toLowerCase()}`}>{s}</span>;
}

export function PageHead({ title, children, right, step }: { title: string; children?: ReactNode; right?: ReactNode; step?: number }) {
  return (
    <div className="page-head">
      <div>
        {step != null && <div className="eyebrow">Step {step} of 6 · Monthly workflow</div>}
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
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
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
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
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
