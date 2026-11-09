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
import { Icon, BrandMark, type IconName } from './ui/icons';
import { FIELDS } from './core/fields';

const WORKFLOW: { p: Page; label: string; icon: IconName }[] = [
  { p: 'import', label: 'Import schedule', icon: 'upload' },
  { p: 'mapping', label: 'Column mapping', icon: 'columns' },
  { p: 'validation', label: 'Validation', icon: 'shield' },
  { p: 'classification', label: 'Classification', icon: 'tag' },
  { p: 'settings', label: 'Settings', icon: 'sliders' },
  { p: 'results', label: 'Approve & results', icon: 'check' },
];
const REPORTS: { p: Page; label: string; icon: IconName }[] = [
  { p: 'exec', label: 'Executive dashboard', icon: 'gauge' },
  { p: 'control', label: 'Schedule control', icon: 'gantt' },
  { p: 'delay', label: 'Delay analysis', icon: 'clock' },
  { p: 'history', label: 'History & snapshots', icon: 'history' },
  { p: 'baselines', label: 'Baselines', icon: 'flag' },
  { p: 'report', label: 'Monthly report (PDF)', icon: 'report' },
  { p: 'audit', label: 'Calculation audit', icon: 'search' },
];

/** Which workflow steps are finished, so the sidebar can tick them off. */
export function useStepState(): Partial<Record<Page, boolean>> {
  const { project, stored, imp, report, approval } = useApp();
  if (!project) return {};
  const mapped = !!imp && FIELDS.every((f) => !f.required || imp.matches[f.key].column != null);
  return {
    import: !!stored && !!imp && imp.activities.length > 0,
    mapping: mapped,
    validation: mapped && !!report && report.criticalCount === 0,
    settings: project.settings.dataDate != null,
    results: approval === 'APPROVED',
  };
}

export function App() {
  const app = useApp();
  const { page, setPage, project, projects } = app;
  const needsProject = !project;
  const done = useStepState();

  return (
    <div className="app">
      <aside className="side">
        <button className="brand" onClick={() => setPage('home')}>
          <BrandMark />
          <span>Schedule Intelligence<small>P6 analysis &amp; reporting</small></span>
        </button>
        <button className={`nav-btn ${page === 'home' ? 'active' : ''}`} onClick={() => setPage('home')}><Icon name="home" />Home</button>
        <div className="nav-group">Monthly workflow</div>
        {WORKFLOW.map((w, i) => (
          <button key={w.p} className={`nav-btn step-btn ${page === w.p ? 'active' : ''} ${done[w.p] ? 'done' : ''}`} disabled={needsProject} onClick={() => setPage(w.p)}>
            <span className="num">{done[w.p] ? <Icon name="check" size={12} stroke={3} /> : i + 1}</span>{w.label}
          </button>
        ))}
        <button className={`nav-btn ${page === 'activities' ? 'active' : ''}`} disabled={needsProject} onClick={() => setPage('activities')}>
          <Icon name="table" />Activities (data)
        </button>
        <div className="nav-group">Reports</div>
        {REPORTS.map((w) => (
          <button key={w.p} className={`nav-btn ${page === w.p ? 'active' : ''}`} disabled={needsProject || !app.rows} onClick={() => setPage(w.p)}>
            <Icon name={w.icon} />{w.label}
          </button>
        ))}
        <div className="side-foot">
          <Icon name="lock" size={15} />
          <span>Runs only in this browser. Your schedule data is never uploaded.
            {!app.persisted && app.ready && <em>Storage is not marked as persistent - keep a backup file.</em>}
          </span>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <label className="proj-pick">
            <span className="lbl">Project</span>
            <select value={project?.id ?? ''} onChange={(e) => e.target.value && app.selectProject(e.target.value)}>
              {!project && <option value="">- none -</option>}
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <ProjectMenu />
          <span className="grow" />
          {project?.isSample && <span className="badge sample">SAMPLE DATA</span>}
          {project && <span className="dd-chip"><Icon name="calendar" size={14} />Data date <b>{fmtDate(project.settings.dataDate) || 'not set'}</b></span>}
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
      <button className="btn small" onClick={() => setOpen(!open)} aria-expanded={open}>Manage ▾</button>
      {open && (
        <div className="card menu" onMouseLeave={() => setOpen(false)}>
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
  if (approval === 'APPROVED') return <span className="badge ok"><Icon name="check" size={12} stroke={3} />DATA APPROVED</span>;
  return <span className="badge draft" title={`Reports are drafts until the data is approved (${approval})`}>DRAFT · {approval}</span>;
}
