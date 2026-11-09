import { useApp } from '../state';
import { NO_FILTER, type FilterKey } from '../core/project';

export function FilterBar({ dark }: { dark?: boolean }) {
  const { project, rows, filters, setFilters } = useApp();
  if (!project || !rows) return null;
  const L = project.classification.lists;
  const projects = [...new Set(rows.filter((r) => r.included).map((r) => r.a.projectId).filter(Boolean))];
  const extra = (k: 'phase' | 'discipline' | 'building' | 'floor') => [...new Set(rows.filter((r) => r.included).map((r) => r.cls[k]))].filter((v) => !L[k].includes(v));
  const defs: [FilterKey, string, string[]][] = [
    ['project', 'Project', projects], ['phase', 'Phase', [...L.phase, ...extra('phase')]], ['discipline', 'Discipline', [...L.discipline, ...extra('discipline')]],
    ['building', 'Building', [...L.building, ...extra('building')]], ['floor', 'Floor', [...L.floor, ...extra('floor')]],
  ];
  const active = Object.values(filters).some((v) => v !== 'All');
  return (
    <div className={`filterbar ${dark ? 'dark' : ''}`}>
      <span className="lbl">Filters</span>
      {defs.map(([k, label, opts]) => (
        <label key={k} className="fsel"><span>{label}</span>
          <select value={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })}>
            <option>All</option>{opts.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
      ))}
      {active && <button className="btn small" onClick={() => setFilters(NO_FILTER)}>Clear filters</button>}
    </div>
  );
}
