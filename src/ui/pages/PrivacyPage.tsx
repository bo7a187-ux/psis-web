import { PageHead } from '../common';
import { Icon, type IconName } from '../icons';
import { t } from '../../i18n';
import { GOATCOUNTER_CODE } from '../../config';

const POINTS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'lock', title: 'Your files never leave your computer',
    text: 'The P6 file (XER, Excel) is read by your browser itself. It is not uploaded: the site has no server that receives files, and the page tells the browser to block every connection it could use to send data (Content Security Policy: connect-src \'none\').' },
  { icon: 'file', title: 'Where your data is kept',
    text: 'Projects, settings, baselines, progress entries and snapshots are kept in this browser\'s storage (IndexedDB) on this computer only. Nobody else can see them, not even the developer. Clearing the browser\'s site data deletes them, so save a project file (backup) every month.' },
  { icon: 'users', title: 'Sharing is your choice',
    text: 'Data goes to another person only when you send it yourself: a project file, an Excel export or a printed PDF. The comparison file and the progress Excel are read the same way, in the browser only.' },
  { icon: 'gauge', title: 'Anonymous visit counting',
    text: 'Visits are counted with GoatCounter, without cookies and without any schedule data: only the name of the page opened (for example /gantt) is sent. If an ad blocker stops it, the site works the same.' },
  { icon: 'search', title: 'How to check it yourself',
    text: 'Open the browser\'s developer tools (F12), Network tab, then import a file and use the pages: no request carries your schedule.' },
];

export function PrivacyPage() {
  return (
    <>
      <PageHead title={t('Privacy')}>
        <p>{t('Masar Schedule is built so that construction schedules, which are often confidential, stay with the company that owns them.')}</p>
      </PageHead>
      <div className="privacy">
        {POINTS.filter((p) => GOATCOUNTER_CODE || p.icon !== 'gauge').map((p) => (
          <div key={p.title} className="card privacy-card">
            <span className="phase-ico"><Icon name={p.icon} size={18} /></span>
            <div><h2>{t(p.title)}</h2><p className="small">{t(p.text)}</p></div>
          </div>
        ))}
      </div>
      <p className="small muted">{t('Questions: use the email or LinkedIn buttons on the home page.')}</p>
    </>
  );
}
