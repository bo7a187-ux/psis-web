import { useMemo, useState } from 'react';
import { useApp } from '../../state';
import { DateInput, PageHead, ConfirmButton, dateTime } from '../common';
import { fmtDate, type Day } from '../../core/dates';
import { saveOriginal, addRevision, compareBaselines, resolveRevision, toMap, BaselineError } from '../../core/baselines';

export function BaselinesPage() {
  const app = useApp();
  const { project, imp } = app;
  const [ref, setRef] = useState('');
  const [rev, setRev] = useState('');
  const [approved, setApproved] = useState<Day | null>(null);
  const [desc, setDesc] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const cur = useMemo(() => app.currentBaselineItems(), [app]);
  const b = project?.baselines;
  const diffs = useMemo(() => {
    if (!imp || !b) return [];
    const r = resolveRevision(b, project!.settings.revisionUse);
    return compareBaselines(imp.activities, b.original ? toMap(b.original.items) : undefined, r ? toMap(r.items) : undefined, showAll);
  }, [imp, b, project, showAll]);
  if (!project || !b) return null;
  const used = resolveRevision(b, project.settings.revisionUse);
  const run = async (f: () => Promise<void>) => { try { await f(); setMsg({ ok: true, t: 'Saved.' }); } catch (e) { setMsg({ ok: false, t: e instanceof BaselineError ? e.message : (e as Error).message }); } };
  const dd = (x: number | null) => (x == null ? '-' : fmtDate(x));
  const dl = (x: number | null) => (x == null ? '' : x > 0 ? `+${x}` : String(x));

  return (
    <>
      <PageHead title="Baselines">
        <p>Saved baselines are values: a new monthly import never changes them. The <b>Original</b> is saved once. Every approved re-baseline is added as a <b>Revised</b> baseline with its own revision number and approval date. Settings choose which one drives planned % and delays.</p>
      </PageHead>
      {!imp && <div className="notice warn">Import a schedule first. A baseline is saved from the baseline dates (BL Project Start / Finish) of the current import.</div>}
      {msg && <div className={`notice ${msg.ok ? 'good' : 'bad'}`}>{msg.t}</div>}

      <div className="grid2">
        <div className="card">
          <h2>Original baseline</h2>
          {b.original ? (
            <>
              <div className="notice good">Saved {dateTime(b.original.savedAt)} · {b.original.items.length} activities · "{b.original.reference}". It is locked and cannot be replaced.</div>
            </>
          ) : (
            <>
              <p className="small muted">Not saved yet. Save it once, from the first approved schedule. {cur.items.length} activities of the current import have both baseline dates.</p>
              <div className="field" style={{ marginTop: 8 }}><label htmlFor="bl-ref">Reference / note</label><input id="bl-ref" type="text" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. Contract baseline, approved 01-Mar-26" /></div>
              {cur.skipped.length > 0 && <div className="notice warn small">{cur.skipped.length} activit{cur.skipped.length === 1 ? 'y' : 'ies'} cannot be saved (missing baseline dates, no or duplicate ID): {cur.skipped.slice(0, 5).join('; ')}{cur.skipped.length > 5 ? '…' : ''}</div>}
              <div style={{ marginTop: 10 }}>
                <ConfirmButton className="btn primary" confirmText="Click again - the Original can never be replaced" onConfirm={() => run(() => app.saveBaselines(saveOriginal(b, { savedAt: new Date().toISOString(), reference: ref.trim() || 'Original baseline', items: cur.items }), `Original saved (${cur.items.length} activities)`))}>Save current baseline as Original</ConfirmButton>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <h2>Add a revised baseline</h2>
          <p className="small muted">Use this after a re-baseline is approved and the new baseline dates are in the P6 export you imported. Existing revisions are never overwritten.</p>
          <form onSubmit={(e) => { e.preventDefault(); if (approved == null) { setMsg({ ok: false, t: 'Enter the approval date of the revision.' }); return; }
            run(async () => { await app.saveBaselines(addRevision(b, { rev, approvedOn: approved, description: desc.trim(), savedAt: new Date().toISOString(), reference: `${rev} (${fmtDate(approved)})`, items: cur.items }), `Revision ${rev} saved (${cur.items.length} activities)`); setRev(''); setDesc(''); }); }}>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="field"><label htmlFor="rev-no">Revision no.</label><input id="rev-no" type="text" value={rev} onChange={(e) => setRev(e.target.value)} placeholder="Rev-1" style={{ width: 100 }} /></div>
              <div className="field"><label>Approved on</label><DateInput value={approved} onChange={setApproved} /></div>
            </div>
            <div className="field" style={{ marginTop: 8 }}><label htmlFor="rev-desc">Description</label><input id="rev-desc" type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. MEP re-sequencing approved" /></div>
            <button className="btn primary" style={{ marginTop: 10 }} disabled={!imp || !rev.trim()}>Save revision from current import</button>
          </form>
        </div>
      </div>

      <div className="card">
        <h2>Revision log</h2>
        <div className="table-wrap"><table className="t">
          <thead><tr><th>Rev no.</th><th>Approved on</th><th>Description</th><th className="num">Activities</th><th>Saved</th><th>Used now</th></tr></thead>
          <tbody>
            {b.revisions.length === 0 && <tr><td colSpan={6} className="muted">No revised baselines yet.</td></tr>}
            {b.revisions.map((r) => <tr key={r.rev}><td><b>{r.rev}</b></td><td>{fmtDate(r.approvedOn)}</td><td>{r.description}</td><td className="num">{r.items.length}</td><td className="small">{dateTime(r.savedAt)}</td>
              <td>{used?.rev === r.rev && project.settings.baselineUse === 'Revised (saved)' ? <span className="badge ok">in use</span> : used?.rev === r.rev ? <span className="badge">selected</span> : ''}</td></tr>)}
          </tbody>
        </table></div>
        <div className="row" style={{ marginTop: 10 }}>
          <label className="row small"><b>Baseline used for planned % and delay</b>
            <select value={project.settings.baselineUse} onChange={(e) => app.updateProject({ settings: { ...project.settings, baselineUse: e.target.value as typeof project.settings.baselineUse } }, 'Settings changed')}>
              {['Original (saved)', 'Revised (saved)', 'Current import'].map((o) => <option key={o}>{o}</option>)}
            </select></label>
          <label className="row small"><b>Revision</b>
            <select value={project.settings.revisionUse} onChange={(e) => app.updateProject({ settings: { ...project.settings, revisionUse: e.target.value } }, 'Settings changed')}>
              <option value="">Latest</option>{b.revisions.map((r) => <option key={r.rev}>{r.rev}</option>)}
            </select></label>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Original vs Revised vs Current import</h2>
          <label className="row small"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all activities (default: only those that differ)</label></div>
        <p className="small muted">Baseline finish dates. Differences are in calendar days. "Revised" is {used ? used.rev : 'not available'}; "Current" is the baseline in the latest import.</p>
        <div className="table-wrap tall"><table className="t">
          <thead><tr><th>Activity</th><th>Original</th><th>Revised</th><th>Current</th><th className="num">Rev − Orig (d)</th><th className="num">Cur − Orig (d)</th><th className="num">Cur − Rev (d)</th></tr></thead>
          <tbody>{diffs.length === 0 && <tr><td colSpan={7} className="muted">{b.original ? 'No differences between the baselines.' : 'Save the Original baseline to compare.'}</td></tr>}
            {diffs.map((d) => <tr key={d.id}><td>{d.id} {d.name}</td><td className="nowrap">{dd(d.origFinish)}</td><td className="nowrap">{dd(d.revFinish)}</td><td className="nowrap">{dd(d.curFinish)}</td><td className="num">{dl(d.revVsOrig)}</td><td className="num">{dl(d.curVsOrig)}</td><td className="num">{dl(d.curVsRev)}</td></tr>)}</tbody>
        </table></div>
      </div>
    </>
  );
}
