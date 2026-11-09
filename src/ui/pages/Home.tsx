import { useState } from 'react';
import { useApp } from '../../state';
import { ProjectDialogs, useStepState, type Ask } from '../../App';
import { BackupCard } from '../BackupCard';
import { Icon, type IconName } from '../icons';
import { fmtDate } from '../../core/dates';
import { pct } from '../common';

const PHASES: { icon: IconName; title: string; steps: [string, string][] }[] = [
  { icon: 'upload', title: 'Bring in the schedule', steps: [
    ['Import', 'Drop the P6 Excel export. Columns are found by name - order does not matter.'],
    ['Check mapping', 'Every required field must be found. A name you fix once is remembered.'],
    ['Validate', 'Critical issues block approval; warnings explain what is excluded and why.'],
  ] },
  { icon: 'sliders', title: 'Set the rules', steps: [
    ['Classify', 'Rules and overrides assign Phase, Discipline, Building, Floor and Location.'],
    ['Settings', 'Data date, baseline, weighting, progress source, forecast method, thresholds.'],
  ] },
  { icon: 'report', title: 'Approve & report', steps: [
    ['Approve', 'Locks a fingerprint of the data. Any change sends reports back to DRAFT.'],
    ['Read & report', 'Dashboards, delay lists, S-curve, one-page PDF and delay report in Excel.'],
    ['Save the month', 'A snapshot that never changes afterwards, for the trend.'],
  ] },
];

export function Home() {
  const app = useApp();
  const [ask, setAsk] = useState<Ask>(null);
  const done = useStepState();
  const p = app.project;
  const nextPage = !app.stored ? 'import' : !done.mapping ? 'mapping' : !done.validation ? 'validation' : !done.results ? 'results' : 'exec';
  const nextLabel = { import: 'Import a schedule', mapping: 'Fix the column mapping', validation: 'Review validation', results: 'Approve the data', exec: 'Open the dashboard' }[nextPage];

  return (
    <>
      <ProjectDialogs ask={ask} setAsk={setAsk} />
      <section className="hero">
        <div className="hero-text">
          <span className="hero-kicker"><Icon name="lock" size={14} /> 100% in your browser · nothing is uploaded</span>
          <h1>From a Primavera P6 export to an approved monthly report.</h1>
          <p>Weighted progress, delays, forecasts, the S-curve and a one-page PDF - calculated the same way every month, with an audit trail for every number.</p>
          <div className="row hero-cta">
            {p ? (
              <>
                <button className="btn primary lg" onClick={() => app.setPage(nextPage)}>{nextLabel} →</button>
                <button className="btn ghost lg" onClick={() => setAsk('new')}><Icon name="plus" size={16} />New project</button>
              </>
            ) : (
              <>
                <button className="btn primary lg" onClick={() => setAsk('new')}><Icon name="plus" size={16} />New project</button>
                <button className="btn ghost lg" onClick={() => app.createSample()}>Try with sample data</button>
              </>
            )}
          </div>
        </div>
        <HeroVisual planned={app.summary?.planned} actual={app.summary?.actual} spi={app.summary?.spi} />
      </section>

      {p && (
        <div className="card proj-card">
          <div>
            <div className="eyebrow">Current project</div>
            <h2>{p.name}</h2>
            <p className="muted small">
              {app.stored ? <>Import: <b>{app.stored.fileName}</b> · data date <b>{fmtDate(p.settings.dataDate) || 'not set'}</b></> : 'No schedule imported yet.'}
            </p>
          </div>
          {app.summary && (
            <div className="proj-kpis">
              <div><i>Planned</i><b>{pct(app.summary.planned)}</b></div>
              <div><i>Actual</i><b>{pct(app.summary.actual)}</b></div>
              <div><i>Health</i><b className={`h-${app.summary.health.toLowerCase()}`}>{app.summary.health}</b></div>
            </div>
          )}
          <div className="proj-steps">
            {(['import', 'mapping', 'validation', 'settings', 'results'] as const).map((k) => (
              <span key={k} className={`ps ${done[k] ? 'done' : ''}`}>{done[k] && <Icon name="check" size={11} stroke={3} />}{k === 'results' ? 'approved' : k}</span>
            ))}
          </div>
        </div>
      )}

      <h2 className="section-title">How the monthly cycle works</h2>
      <div className="phases">
        {PHASES.map((ph, i) => {
          const start = PHASES.slice(0, i).reduce((n, x) => n + x.steps.length, 0);
          return (
            <div className="phase" key={ph.title}>
              <div className="phase-head"><span className="phase-ico"><Icon name={ph.icon} size={18} /></span><b>{ph.title}</b></div>
              <ol start={start + 1}>
                {ph.steps.map(([t, d], j) => <li key={t}><span className="n">{start + j + 1}</span><div><b>{t}</b><p>{d}</p></div></li>)}
              </ol>
            </div>
          );
        })}
      </div>

      <BackupCard />
      <div className="card small muted data-note">
        <Icon name="info" size={16} />
        <span><b>Where is my data?</b> In this browser's local storage (IndexedDB) on this computer only. Clearing the browser's site data deletes it - use the backup above. The page is built so it cannot send data anywhere (no network connections are allowed).</span>
      </div>
    </>
  );
}

/** Decorative preview: KPI tiles and an S-curve, drawn inline. */
function HeroVisual({ planned, actual, spi }: { planned?: number | null; actual?: number | null; spi?: number | null }) {
  const real = planned != null && actual != null;
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="hv-kpis">
        <div><i>Planned</i><b>{real ? pct(planned) : '62.4%'}</b></div>
        <div><i>Actual</i><b>{real ? pct(actual) : '58.1%'}</b></div>
        <div><i>SPI</i><b className={spi != null && spi >= 0.95 ? '' : 'amber'}>{real ? (spi != null ? spi.toFixed(2) : 'N/A') : '0.93'}</b></div>
      </div>
      <svg viewBox="0 0 300 130" className="hv-chart">
        {[0, 1, 2, 3].map((i) => <line key={i} x1="0" x2="300" y1={20 + i * 30} y2={20 + i * 30} stroke="rgba(255,255,255,.07)" />)}
        <path d="M0 122 C 60 118, 90 100, 130 72 S 220 22, 300 16" fill="none" stroke="#8ea2c6" strokeWidth="2" strokeDasharray="5 4" />
        <path d="M0 122 C 55 119, 85 106, 120 84 S 160 60, 180 55" fill="none" stroke="#4f8bff" strokeWidth="3" strokeLinecap="round" />
        <path d="M180 55 C 210 46, 250 34, 300 26" fill="none" stroke="#ffb020" strokeWidth="2" strokeDasharray="2 4" />
        <line x1="180" x2="180" y1="6" y2="126" stroke="rgba(255,255,255,.35)" strokeDasharray="3 3" />
        <circle cx="180" cy="55" r="4.5" fill="#4f8bff" stroke="#0b1730" strokeWidth="2" />
      </svg>
      <div className="hv-legend"><span className="l1" />Planned<span className="l2" />Actual<span className="l3" />Forecast</div>
    </div>
  );
}
