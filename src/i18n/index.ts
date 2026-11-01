import { PL } from './pl';

/** The interface language: English source text, or Polish. */
export type Lang = 'pl' | 'en';

function pick(value: string | null | undefined): Lang | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v.startsWith('pl')) return 'pl';
  if (v.startsWith('en')) return 'en';
  return null;
}

function detect(): Lang {
  if (typeof location !== 'undefined') {
    const forced = pick(new URLSearchParams(location.search).get('lang'));
    if (forced) return forced;
  }
  if (typeof navigator !== 'undefined') {
    const first = navigator.languages?.[0] ?? navigator.language;
    if (pick(first) === 'pl') return 'pl';
  }
  return 'en';
}

/** Decided once at load: `?lang=pl|en` wins, then the browser's first preferred language. */
export const LANG: Lang = detect();

/** Locale for numbers and dates in the chosen language. */
export const LOCALE = LANG === 'pl' ? 'pl-PL' : 'en-GB';

const fill = (text: string, vars?: Record<string, string | number>): string =>
  vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;

/**
 * Translates an English source string (the catalogue key), then fills its
 * `{name}` placeholders from `vars`. Missing entries fall back to English.
 */
export function t(en: string, vars?: Record<string, string | number>): string {
  const text = LANG === 'pl' ? PL[en] ?? en : en;
  return fill(text, vars);
}

/** Polish plural class: 0 one (1), 1 few (2-4, not 12-14), 2 many (the rest, 0, 5+). */
function plForm(n: number): 0 | 1 | 2 {
  if (!Number.isInteger(n)) return 1;
  const a = Math.abs(n);
  if (a === 1) return 0;
  const d = a % 10;
  const h = a % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? 1 : 2;
}

/**
 * Count-dependent text. Forms may hold `{n}` (filled with the count) and
 * any other `{name}` from `vars`. English: [one, other]; Polish: [1, 2-4, 5+].
 */
export function plural(
  n: number,
  en: [string, string],
  pl: [string, string, string],
  vars?: Record<string, string | number>,
): string {
  const text = LANG === 'pl' ? pl[plForm(n)] : en[n === 1 ? 0 : 1];
  return fill(text, { n, ...vars });
}
