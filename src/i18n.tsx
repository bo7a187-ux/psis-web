/**
 * Interface language (English / Arabic). English text is the key: t('Import schedule') returns the
 * Arabic translation when Arabic is on, else the English text. Messages built by the calculation
 * core (with numbers inside) are translated by the patterns in ar.ts. Arabic switches the page to RTL.
 */
import { Fragment, createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AR, AR_PATTERNS } from './ar';

export type Lang = 'en' | 'ar';
const KEY = 'psis:lang';

function initial(): Lang {
  try {
    const s = localStorage.getItem(KEY);
    if (s === 'ar' || s === 'en') return s;
  } catch { /* storage blocked */ }
  return typeof navigator !== 'undefined' && /^ar\b/i.test(navigator.language ?? '') ? 'ar' : 'en';
}

let current: Lang = initial();
export const getLang = () => current;

type Vars = Record<string, string | number | null | undefined>;

function lookup(s: string): string {
  if (current !== 'ar') return s;
  const hit = AR[s];
  if (hit != null) return hit;
  for (const [re, fn] of AR_PATTERNS) {
    const m = s.match(re);
    if (m) return fn(m, lookup);
  }
  return s;
}

/** Translate a text. {name} placeholders are filled from vars after translation. */
export function t(s: string, vars?: Vars): string {
  const out = lookup(s);
  return vars ? out.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : out;
}

/** Like t(), but placeholders may be elements: tr('Approved by {who}', { who: <b>{name}</b> }). */
export function tr(s: string, vars: Record<string, ReactNode>): ReactNode {
  const parts = lookup(s).split(/\{(\w+)\}/g);
  return parts.map((p, i) => <Fragment key={i}>{i % 2 ? vars[p] : p}</Fragment>);
}

function apply(l: Lang) {
  current = l;
  const html = document.documentElement;
  html.lang = l;
  html.dir = l === 'ar' ? 'rtl' : 'ltr';
  document.title = t('Project Schedule Intelligence');
}

const C = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: current, setLang: () => {} });
export const useLang = () => useContext(C);

export function LangProvider({ children }: { children: (lang: Lang) => ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);
  apply(lang); // before children render, so t() already uses the new language
  useEffect(() => { apply(lang); }, [lang]);
  const setLang = (l: Lang) => {
    try { localStorage.setItem(KEY, l); } catch { /* storage blocked */ }
    setLangState(l);
  };
  return <C.Provider value={{ lang, setLang }}>{children(lang)}</C.Provider>;
}
