import { useState } from 'react';
import { useApp, type Page } from './state';
import { Home } from './ui/pages/Home';
import { ImportPage } from './ui/pages/ImportPage';
import { MappingPage } from './ui/pages/MappingPage';
import { ValidationPage } from './ui/pages/ValidationPage';
import { ClassificationPage } from './ui/pages/ClassificationPage';
import { SettingsPage } from './ui/pages/SettingsPage';
import { ActivitiesPage } from './ui/pages/ActivitiesPage';
import { ResultsPage } from './ui/pages/ResultsPage';
import { ExecutiveDashboardPage } from './ui/pages/ExecutiveDashboardPage';
import { ScheduleControlPage } from './ui/pages/ScheduleControlPage';
import { DelayAnalysisPage } from './ui/pages/DelayAnalysisPage';
import { HistoryPage } from './ui/pages/HistoryPage';
import { BaselinesPage } from './ui/pages/BaselinesPage';
import { ReportPage } from './ui/pages/ReportPage';
import { CalculationAuditPage } from './ui/pages/CalculationAuditPage';
import { fmtDate } from './core/dates';
import { AskText } from './ui/common';

const WORKFLOW: { p: Page; label: string }[] = [
  { p: 'import', label: 'Import schedule' },
  { p: 'mapping', label: 'Column mapping' },
  { p: 'validation', label: 'Validation' },
  { p: 'classification', label: 'Classification' },
  { p: 'settings', label: 'Settings' },
  { p: 'results', label: 'Approve & results' },
];
const LATER: { p: Page; label: string; stage: number }[] = [
  { p: 'exec', label: 'Executive dashboard', stage: 3 },
  { p: 'control', label: 'Schedule control', stage: 3 },
  { p: 'delay', label: 'Delay analysis', stage: 3 },
  { p: 'history', label: 'History & snapshots', stage: 4 },
  { p: 'baselines', label: 'Baselines', stage: 4 },
  { p: 'report', label: 'Monthly report (PDF)', stage: 5 },
  { p: 'audit', label: 'Calculation audit', stage: 3 },
];

export function App() {
  const app = useApp();
  const { page, setPage, project, projects } = app;
  const needsProject = !project;

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">Schedule Intelligence<small>Primavera P6 analysis &amp; reporting</small></div>
        <button className={`nav-btn ${page === 'home' ? 'active' : ''}`} onClick={() => setPage('home')}>⌂ Home</button>
        <div className="nav-group">Monthly workflow</div>
        {WORKFLOW.map((w, i) => (
          <button key={w.p} className={`nav-btn ${page === w.p ? 'active' : ''}`} disabled={needsProject} onClick={() => setPage(w.p)}>
            <span className="num">{i + 1}</span>{w.label}
          </button>
        ))}
        <button className={`nav-btn ${page === 'activities' ? 'active' : ''}`} disabled={needsProject} onClick={() => setPage('activities')}>
          <span className="num">≡</span>Activities (data)
        </button>
        <div className="nav-group">Reports</div>
        {LATER.map((w) => w.stage <= 5 ? (
          <button key={w.p} className={`nav-btn ${page === w.p ? 'active' : ''}`} disabled={needsProject || !app.rows} onClick={() => setPage(w.p)}>{w.label}</button>
        ) : (
          <button key={w.p} className="nav-btn" disabled title={`Coming in stage ${w.stage}`}>
            {w.label}<span className="tag">stage {w.stage}</span>
          </button>
        ))}
        <div className="side-foot">
          🔒 Runs only in this browser. Your schedule data is never uploaded.
          {!app.persisted && app.ready && <div style={{ marginTop: 6 }}>Storage is not marked as persistent - keep a backup file.</div>}
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <span className="lbl">Project</span>
          <select value={project?.id ?? ''} onChange={(e) => e.target.value && app.selectProject(e.target.value)} style={{ minWidth: 260 }}>
            {!project && <option value="">- none -</option>}
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ProjectMenu />
          <span className="grow" />
          {project?.isSample && <span className="badge sample">SAMPLE DATA</span>}
          {project && <span className="small muted">Data date: <b>{fmtDate(project.settings.dataDate) || 'not set'}</b></span>}
          {project && <ApprovalBadge />}
        </div>
        <div className="content">
          {!app.ready ? <div className="muted">Loading…</div> : <Router page={page} />}
        </div>
      </div>
    </div>
  );
}

function Router({ page }: { page: Page }) {
  const { project } = useApp();
  if (!project || page === 'home') return <Home />;
  switch (page) {
    case 'import': return <ImportPage />;
    case 'mapping': return <MappingPage />;
    case 'validation': return <ValidationPage />;
    case 'classification': return <ClassificationPage />;
    case 'settings': return <SettingsPage />;
    case 'activities': return <ActivitiesPage />;
    case 'results': return <ResultsPage />;
    case 'exec': return <ExecutiveDashboardPage />;
    case 'control': return <ScheduleControlPage />;
    case 'delay': return <DelayAnalysisPage />;
    case 'audit': return <CalculationAuditPage />;
    case 'report': return <ReportPage />;
    case 'history': return <HistoryPage />;
    case 'baselines': return <BaselinesPage />;
    default: return <Home />;
  }
}

export type Ask = null | 'new' | 'rename' | 'delete';

export function ProjectDialogs({ ask, setAsk }: { ask: Ask; setAsk: (a: Ask) => void }) {
  const app = useApp();
  if (ask === 'new') return <AskText title="New project" label="Project name" okLabel="Create" onOk={(n) => app.createProject(n)} onClose={() => setAsk(null)} />;
  if (ask === 'rename' && app.project) return <AskText title="Rename project" label="Project name" initial={app.project.name} okLabel="Rename" onOk={(n) => app.renameProject(n)} onClose={() => setAsk(null)} />;
  if (ask === 'delete' && app.project)
    return <AskText title="Delete project" label="Type DELETE to confirm" danger okLabel="Delete permanently" confirmWord="DELETE"
      help={<>This permanently removes <b>{app.project.name}</b> from this browser: its import, mapping, rules and settings. Export a backup first if you may need it.</>}
      onOk={() => app.deleteProject()} onClose={() => setAsk(null)} />;
  return null;
}

function ProjectMenu() {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState<Ask>(null);
  const pick = (a: Ask) => { setAsk(a); setOpen(false); };
  return (
    <span style={{ position: 'relative' }}>
      <button className="btn small" onClick={() => setOpen(!open)} aria-expanded={open}>Project ▾</button>
      {open && (
        <div className="card" style={{ position: 'absolute', top: 34, left: 0, zIndex: 20, width: 260, padding: 8 }} onMouseLeave={() => setOpen(false)}>
          <MenuItem onClick={() => pick('new')}>New project…</MenuItem>
          <MenuItem onClick={() => { app.createSample(); setOpen(false); }}>New sample project (SAMPLE DATA)</MenuItem>
          {app.project && <MenuItem onClick={() => pick('rename')}>Rename…</MenuItem>}
          {app.project && <MenuItem danger onClick={() => pick('delete')}>Delete project…</MenuItem>}
        </div>
      )}
      <ProjectDialogs ask={ask} setAsk={setAsk} />
    </span>
  );
}
function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button className="nav-btn" style={{ color: danger ? 'var(--red)' : 'var(--ink)' }} onClick={onClick}>{children}</button>;
}

export function ApprovalBadge() {
  const { approval } = useApp();
  if (approval === 'APPROVED') return <span className="badge ok">DATA APPROVED</span>;
  return <span className="badge draft" title={approval}>DRAFT - NOT APPROVED · {approval}</span>;
}
