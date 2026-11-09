import type { ReactNode } from 'react';
import { useApp } from '../../state';
import { ConfirmButton, DateInput, PageHead } from '../common';
import { t } from '../../i18n';
import {
  ACTUAL_SOURCES, BASELINE_USES, CRIT_RULES, FORECAST_METHODS, PLANNED_METHODS, WEIGHT_METHODS, DEFAULT_SETTINGS, type Settings,
} from '../../core/settings';

function Row({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <tr>
      <td style={{ width: 300 }}><b>{label}</b></td>
      <td style={{ width: 340 }}>{children}</td>
      <td className="small muted">{help}</td>
    </tr>
  );
}

export function SettingsPage() {
  const app = useApp();
  const { project } = app;
  if (!project) return null;
  const s = project.settings;
  const set = (patch: Partial<Settings>) => app.updateProject({ settings: { ...s, ...patch } }, 'Settings changed');
  const sel = <K extends keyof Settings>(k: K, opts: readonly string[]) => (
    <select value={String(s[k])} onChange={(e) => set({ [k]: e.target.value } as Partial<Settings>)}>{opts.map((o) => <option key={o} value={o}>{t(o)}</option>)}</select>
  );
  const yn = (k: 'afAsComplete' | 'includeLOE') => (
    <select value={s[k] ? 'Yes' : 'No'} onChange={(e) => set({ [k]: e.target.value === 'Yes' })}><option value="Yes">{t("Yes")}</option><option value="No">{t("No")}</option></select>
  );
  const numIn = (k: keyof Settings, step = 1, asPct = false) => (
    <span className="row">
      <input type="number" step={step} value={asPct ? +((s[k] as number) * 100).toFixed(4) : (s[k] as number)} style={{ width: 110 }}
        onChange={(e) => { const v = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(v)) set({ [k]: asPct ? v / 100 : v } as Partial<Settings>); }} />
      {asPct && <span className="muted">{k === 'costCoverage' ? '%' : t('pp')}</span>}
    </span>
  );

  return (
    <>
      <PageHead step={5} title={t("Settings")} right={<div className="row"><button className="btn primary" onClick={() => app.setPage('results')}>{t("Next: approve & results →")}</button><ConfirmButton confirmText={t("Click again: reset all methods and thresholds")} onConfirm={() => set({ ...DEFAULT_SETTINGS, dataDate: s.dataDate, projectTitle: s.projectTitle })}>{t("Reset to defaults")}</ConfirmButton></div>}>
        <p>{t("Reporting parameters and calculation methods - the same options as the SETTINGS sheet. Every method in use is printed on the dashboards. Changing any of them after approval returns the reports to DRAFT.")}</p>
      </PageHead>
      <div className="card">
        <h2>{t("Report")}</h2>
        <table className="t"><tbody>
          <Row label={t("Project title (for dashboards)")} help={t("Leave blank to use the Project Name from the import.")}>
            <input type="text" value={s.projectTitle} onChange={(e) => set({ projectTitle: e.target.value })} style={{ width: '100%' }} />
          </Row>
          <Row label={t("Reporting data date")} help={t("Usually the P6 Data Date. Treated as the START of the day, like Primavera: planned progress counts the days before it.")}>
            <DateInput value={s.dataDate} onChange={(d) => set({ dataDate: d })} />
          </Row>
        </tbody></table>
      </div>
      <div className="card">
        <h2>{t("Progress calculation")}</h2>
        <table className="t"><tbody>
          <Row label={t("Weighting method")} help={t("Duration = Original Duration (falls back to the baseline calendar span). Cost = Budgeted Total Cost. Man-hours = Budgeted Labor Units.")}>{sel('weightMethod', WEIGHT_METHODS)}</Row>
          <Row label={t("Planned % method")} help={t("Linear = straight line between Baseline Start and Finish (calendar days) - an assumption. P6 = use the exported Schedule % Complete.")}>{sel('plannedMethod', PLANNED_METHODS)}</Row>
          <Row label={t("Actual % source field")} help={t("Which P6 progress field is the actual %. Physical, Duration, Units and Activity % Complete are different measures - choose the one your project reports. They are never mixed.")}>{sel('actualSource', ACTUAL_SOURCES)}</Row>
          <Row label={t("Activities with Actual Finish count as 100%")} help={t("Yes = an activity with an Actual Finish is 100% even if the % field says otherwise (flagged in Validation).")}>{yn('afAsComplete')}</Row>
          <Row label={t("Include Level of Effort activities")} help={t("LOE activities usually span the whole project and distort progress, so they are excluded by default. WBS Summary is always excluded.")}>{yn('includeLOE')}</Row>
          <Row label={t("Delay tolerance")} help={t("An activity is 'Behind' when Actual % is lower than Planned % by more than this.")}>{numIn('tolerance', 0.5, true)}</Row>
        </tbody></table>
      </div>
      <div className="card">
        <h2>{t("Baseline, critical path and forecast")}</h2>
        <table className="t"><tbody>
          <Row label={t("Baseline used for planned % and delay")} help={t("Original / Revised = the versions saved on Baselines (never changed by imports). Falls back to the import's baseline, flagged, if an activity is not saved.")}>{sel('baselineUse', BASELINE_USES)}</Row>
          <Row label={t("Revised baseline revision to use")} help={t("Revision number from the revision log on Baselines. Latest = the most recently saved revision.")}>
            <select value={s.revisionUse} onChange={(e) => set({ revisionUse: e.target.value })}><option value="">{t("Latest")}</option>{project.baselines.revisions.map((r) => <option key={r.rev}>{r.rev}</option>)}</select>
          </Row>
          <Row label={t("Critical activity definition")} help={t("Use the P6 Critical column, or treat Total Float <= 0 as critical. Open activities only.")}>{sel('critRule', CRIT_RULES)}</Row>
          <Row label={t("Low float threshold (days)")} help={t("Open activities with Total Float from 0 up to this value are 'Low float'.")}>{numIn('lowFloat')}</Row>
          <Row label={t("Activity forecast finish method")} help={t("P6 = Current Finish from the import (CPM). Performance = data date + remaining % at the actual rate achieved. Conservative = the later of the two (default).")}>{sel('forecastMethod', FORECAST_METHODS)}</Row>
        </tbody></table>
      </div>
      <div className="card">
        <h2>{t("Project health thresholds")}</h2>
        <p className="small muted">{t("Each threshold that is crossed is written as a reason under the health colour.")}</p>
        <table className="t"><tbody>
          <Row label={t("AMBER: forecast delay greater than (days)")}>{numIn('amberDays')}</Row>
          <Row label={t("RED: forecast delay greater than (days)")}>{numIn('redDays')}</Row>
          <Row label={t("AMBER: behind plan by more than")}>{numIn('amberPP', 0.5, true)}</Row>
          <Row label={t("RED: behind plan by more than")}>{numIn('redPP', 0.5, true)}</Row>
          <Row label={t("AMBER: SPI below (only if SPI available)")}>{numIn('amberSPI', 0.01)}</Row>
          <Row label={t("RED: SPI below (only if SPI available)")}>{numIn('redSPI', 0.01)}</Row>
          <Row label={t("Minimum cost coverage for SPI")} help={t("SPI (EV/PV) is shown only if at least this share of included non-milestone activities have a budgeted cost, and PV > 0.")}>{numIn('costCoverage', 1, true)}</Row>
        </tbody></table>
      </div>
    </>
  );
}
