import { useApp } from '../state';
import { ConfirmButton } from './common';
import { saveOriginal } from '../core/baselines';
import { t } from '../i18n';

/**
 * Shown while the file has no baseline (the Planned dates stand in for it) and no Original is saved:
 * planned % and SPI(t) then move with every update. One click saves this import as the Original.
 */
export function NoBaselineNotice() {
  const app = useApp();
  const { project, imp } = app;
  if (!project || !imp || project.baselines.original || imp.matches.blStart?.source !== 'fallback') return null;
  const save = async () => {
    const cur = app.currentBaselineItems();
    await app.saveBaselines(saveOriginal(project.baselines, { savedAt: new Date().toISOString(), reference: t('Original baseline (from the planned dates of this import)'), items: cur.items }), `Original saved from planned dates (${cur.items.length} activities)`);
  };
  return (
    <div className="notice warn">
      <b>{t('This file has no baseline.')}</b>{' '}
      {t('Planned %, delays and SPI(t) are measured against the current planned dates, so they move with every P6 update and look better than they are. Save a baseline once: best from the first schedule before any progress (import it, then save); if you do not have it, save this one so the next months are measured against it.')}
      <div className="row" style={{ marginTop: 8 }}>
        <ConfirmButton className="btn small primary" confirmText={t('Click again - the Original can never be replaced')} onConfirm={save}>{t('Save this import as the Original baseline')}</ConfirmButton>
        <button className="btn small" onClick={() => app.setPage('baselines')}>{t('Baselines')}</button>
      </div>
    </div>
  );
}
