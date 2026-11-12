import { useApp } from '../state';
import { NO_FILTER, NO_CODE, isUnfiltered, type FilterKey } from '../core/project';
import { t } from '../i18n';

export function FilterBar({ dark }: { dark?: boolean }) {
  const { project, rows, filters, setFilters } = useApp();
  if (!project || !rows) return null;
  const L = project.classification.lists;
  const inc = rows.filter((r) => r.included);
  const projects = [...new Set(inc.map((r) => r.a.projectId).filter(Boolean))];
  const extra = (k: 'phase' | 'discipline' | 'building' | 'floor') => [...new Set(inc.map((r) => r.cls[k]))].filter((v) => !L[k].includes(v));
  const defs: [FilterKey, string, string[]][] = [
    ['project', 'Project', projects], ['phase', 'Phase', [...L.phase, ...extra('phase')]], ['discipline', 'Discipline', [...L.discipline, ...extra('discipline')]],
    ['building', 'Building', [...L.building, ...extra('building')]], ['floor', 'Floor', [...L.floor, ...extra('floor')]],
  ];
  // P6 activity codes of this import
  const codeTypes = [...new Set(inc.flatMap((r) => Object.keys(r.a.codes ?? {})))];
  const type = filters.codeType && codeTypes.includes(filters.codeType) ? filters.codeType : '';
  const values = type ? [...new Set(inc.map((r) => r.a.codes?.[type]).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) : [];
  const hasNone = type ? inc.some((r) => !r.a.codes?.[type]) : false;
  return (
    <div className={`filterbar ${dark ? 'dark' : ''}`}>
      <span className="lbl">{t("Filters")}</span>
      {defs.map(([k, label, opts]) => (
        <label key={k} className="fsel"><span>{t(label)}</span>
          <select value={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })}>
            <option value="All">{t("All")}</option>{opts.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
      ))}
      {codeTypes.length > 0 && <>
        <label className="fsel"><span>{t('Activity code')}</span>
          <select value={type} onChange={(e) => setFilters({ ...filters, codeType: e.target.value || undefined, code: 'All' })}>
            <option value="">{t('- choose -')}</option>{codeTypes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        {type && <label className="fsel"><span dir="auto">{type}</span>
          <select value={filters.code ?? 'All'} onChange={(e) => setFilters({ ...filters, code: e.target.value })} style={{ maxWidth: 240 }}>
            <option value="All">{t("All")}</option>{values.map((v) => <option key={v} value={v}>{v}</option>)}
            {hasNone && <option value={NO_CODE}>{t(NO_CODE)}</option>}
          </select>
        </label>}
      </>}
      {!isUnfiltered(filters) && <button className="btn small" onClick={() => setFilters(NO_FILTER)}>{t("Clear filters")}</button>}
    </div>
  );
}
