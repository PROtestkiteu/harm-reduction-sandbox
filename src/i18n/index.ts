/** The interface language: English source text, Polish, Spanish or Portuguese. */
export type Lang = 'en' | 'pl' | 'es' | 'pt';

export const LANGS: readonly { id: Lang; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'pl', name: 'Polski' },
  { id: 'es', name: 'Español' },
  { id: 'pt', name: 'Português' },
];

/** Where a language picked in Settings is remembered. */
export const LANG_KEY = 'hrp-lang';

function pick(value: string | null | undefined): Lang | null {
  if (!value) return null;
  const v = value.toLowerCase();
  return LANGS.find((l) => v.startsWith(l.id))?.id ?? null;
}

function detect(): Lang {
  if (typeof location !== 'undefined') {
    const forced = pick(new URLSearchParams(location.search).get('lang'));
    if (forced) return forced;
  }
  try {
    const kept = pick(localStorage.getItem(LANG_KEY));
    if (kept) return kept;
  } catch { /* storage blocked */ }
  if (typeof navigator !== 'undefined') {
    for (const l of navigator.languages ?? [navigator.language]) {
      const found = pick(l);
      if (found) return found;
    }
  }
  return 'en';
}

/** Decided once at load: `?lang=`, then the language picked in Settings, then the browser's preferences. */
export const LANG: Lang = detect();

/** Locale for numbers and dates in the chosen language. */
export const LOCALE = { en: 'en-GB', pl: 'pl-PL', es: 'es-ES', pt: 'pt-PT' }[LANG];

/** The chosen language's catalogue; English needs none. Loaded before the game starts (loading.ts). */
let CAT: Record<string, string> | null = null;

/** Fetches the catalogue for LANG (its own small chunk), so each player downloads only their language. */
export async function loadCatalogue(): Promise<void> {
  if (LANG === 'pl') CAT = (await import('./pl')).PL;
  else if (LANG === 'es') CAT = (await import('./es')).ES;
  else if (LANG === 'pt') CAT = (await import('./pt')).PT;
}

const fill = (text: string, vars?: Record<string, string | number>): string =>
  vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;

/**
 * Translates an English source string (the catalogue key), then fills its
 * `{name}` placeholders from `vars`. Missing entries fall back to English.
 */
export function t(en: string, vars?: Record<string, string | number>): string {
  return fill(CAT?.[en] ?? en, vars);
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
 * Spanish and Portuguese count like English: each English form is looked up
 * in their catalogue.
 */
export function plural(
  n: number,
  en: [string, string],
  pl: [string, string, string],
  vars?: Record<string, string | number>,
): string {
  const form = en[n === 1 ? 0 : 1];
  const text = LANG === 'pl' ? pl[plForm(n)] : CAT?.[form] ?? form;
  return fill(text, { n, ...vars });
}
