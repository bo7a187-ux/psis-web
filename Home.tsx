import { useState } from 'react';
import { useApp } from '../../state';
import { ProjectDialogs, type Ask } from '../../App';
import { BackupCard } from '../BackupCard';

export function Home() {
  const app = useApp();
  const [ask, setAsk] = useState<Ask>(null);
  return (
    <>
      <ProjectDialogs ask={ask} setAsk={setAsk} />
      <div className="page-head">
        <div>
          <h1>Project Schedule Intelligence</h1>
          <p>Turns a Primavera P6 export into approved management dashboards: weighted progress, delays, forecasts, S-curve and a monthly report. Everything runs inside this browser - no server, no login, and your schedule is never uploaded.</p>
        </div>
      </div>
      {!app.project && (
        <div className="card">
          <h2>Get started</h2>
          <p className="muted">Create a project for your schedule, or open the sample project to see how it works.</p>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={() => setAsk('new')}>New project</button>
            <button className="btn" onClick={() => app.createSample()}>Try with sample data</button>
          </div>
        </div>
      )}
      <div className="card">
        <h2>Monthly workflow</h2>
        <div className="steps" style={{ marginTop: 10 }}>
          {[
            ['Import', 'Choose the P6 .xlsx export. Columns are found by name; order does not matter.'],
            ['Check mapping', 'Every required field must be found. Names you fix are remembered.'],
            ['Validate', 'Critical issues block approval. Warnings explain what is excluded and why.'],
            ['Classify', 'Rules and manual overrides assign Phase, Discipline, Building, Floor, Location.'],
            ['Settings', 'Data date, baseline, weighting, progress source, forecast method, thresholds.'],
            ['Approve', 'Locks a fingerprint of the data. Any change returns the reports to DRAFT.'],
            ['Read & report', 'Dashboards, delay lists, S-curve and the one-page PDF report. (one-page PDF report, delay report in Excel)'],
            ['Save the month', 'A snapshot that never changes afterwards. '],
          ].map(([t, d], i) => (
            <div className="step" key={t}><span className="n">{i + 1}</span><b>{t}</b><p className="small muted">{d}</p></div>
          ))}
        </div>
      </div>
      {app.project && (
        <div className="card">
          <h2>{app.project.name}</h2>
          <p className="muted">{app.stored ? `Current import: ${app.stored.fileName}` : 'No schedule imported yet.'}</p>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn primary" onClick={() => app.setPage(app.stored ? 'validation' : 'import')}>{app.stored ? 'Continue' : 'Import a schedule'}</button>
          </div>
        </div>
      )}
      <BackupCard />
      <div className="card small muted">
        <b>Where is my data?</b> In this browser's local storage (IndexedDB) on this computer only. Clearing the browser's site data deletes it - use the backup above. The page is built so it cannot send data anywhere (no network connections are allowed).
      </div>
    </>
  );
}
