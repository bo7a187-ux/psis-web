import { useEffect } from 'react';
import { GOATCOUNTER_CODE } from '../config';

/** Anonymous page counting with a GoatCounter image (no script, no cookies, page name only). */
export function VisitCounter({ page }: { page: string }) {
  useEffect(() => {
    if (!GOATCOUNTER_CODE) return;
    try {
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.src = `https://${GOATCOUNTER_CODE}.goatcounter.com/count?p=${encodeURIComponent('/' + page)}&t=${encodeURIComponent(page)}&rnd=${Date.now()}`;
    } catch { /* counting must never break the app */ }
  }, [page]);
  return null;
}
