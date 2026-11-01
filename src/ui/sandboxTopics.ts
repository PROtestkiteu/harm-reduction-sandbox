import { normalize } from '../config/sandboxParams';
import { newGameAddress } from '../game/liveGame';
import { LANG, LANGS, t, type Lang } from '../i18n';

/** Small topics of the sandbox menu: New game, Language and About. */

type DateClock = { date: number; clock: number };

/** Where a "New city" click leaves the season and time for the next page. */
const SHUFFLE_KEY = 'hrs-shuffle';

const pick = (): DateClock => ({
  date: 1 + Math.floor(Math.random() * 365),
  clock: 18 * 60 + Math.floor((Math.random() * (24 * 60 - 5)) / 5) * 5,
});

/**
 * New game: a new city with a new season and time, or only a new season and time. The city round
 * the district is laid out once per page load, so a new layout means a new
 * page; the season and time picked wait in sessionStorage for it.
 */
export function randomSection(setDateClock: (v: DateClock) => void): HTMLFieldSetElement {
  const section = document.createElement('fieldset');
  section.className = 'sandbox-group';
  section.id = 'random-section';
  const legend = document.createElement('legend');
  legend.textContent = t('New game');
  const button = (text: string, hint: string, run: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn save-btn';
    b.textContent = text;
    b.title = hint;
    b.addEventListener('click', run);
    return b;
  };
  const season = button(t('Only a new season and time'), t('A random date and time of day; the city and this game stay as they are'), () => setDateClock(pick()));
  const city = button(t('Start a new game'), t('A freshly laid out city, its places in new spots, on a random date and time'), () => {
    try { sessionStorage.setItem(SHUFFLE_KEY, JSON.stringify(pick())); } catch { /* private mode: the city still changes */ }
    // A new game gets a new address: the old game's id stays with the old game.
    location.href = newGameAddress();
  });
  const note = Object.assign(document.createElement('p'), { className: 'note', textContent: t('Share or save this game first if you want to keep it.') });
  section.append(legend, city, note, season);
  return section;
}

/** Applies the season and time a "New city" click left for this page, once. */
export function applyShuffle(setDateClock: (v: DateClock) => void): void {
  let raw: string | null = null;
  try { raw = sessionStorage.getItem(SHUFFLE_KEY); sessionStorage.removeItem(SHUFFLE_KEY); } catch { return; }
  if (!raw) return;
  try {
    const v = JSON.parse(raw) as { date?: unknown; clock?: unknown };
    const date = normalize('date', Number(v.date));
    const clock = normalize('clock', Number(v.clock));
    if (Number.isFinite(date) && Number.isFinite(clock)) setDateClock({ date, clock });
  } catch { /* a bad value is ignored */ }
}

/** Language: each in its own name; picking one reloads the page in it, the game kept. */
export function languageSection(choose: (lang: Lang) => void): HTMLFieldSetElement {
  const section = document.createElement('fieldset');
  section.className = 'sandbox-group';
  section.id = 'language-section';
  const legend = document.createElement('legend');
  legend.textContent = t('Language');
  section.append(legend);
  for (const l of LANGS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn save-btn';
    b.lang = l.id;
    b.textContent = l.name;
    b.setAttribute('aria-pressed', String(l.id === LANG));
    b.disabled = l.id === LANG;
    b.addEventListener('click', () => choose(l.id));
    section.append(b);
  }
  return section;
}

/** About: what the game is, in a few lines, and where its code lives. */
export function aboutSection(version: string): HTMLFieldSetElement {
  const section = document.createElement('fieldset');
  section.className = 'sandbox-group about';
  section.id = 'about-section';
  const legend = document.createElement('legend');
  legend.textContent = t('About');
  const lines = [
    t('A harm reduction non-profit simulator. The challenge: more demand can easily mean less money, not more.'),
    t('Every visit costs money and wears the place down. Invest to keep places up. Run out of money and the game ends.'),
    t('Every number is illustrative. The direction of each effect follows the research cited in the panels.'),
  ].map((text) => Object.assign(document.createElement('p'), { textContent: text }));
  const link = document.createElement('a');
  link.href = 'https://github.com/PROtestkiteu/harm-reduction-sandbox';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = t('Source code on GitHub (MIT), opens in a new tab');
  const linkLine = Object.assign(document.createElement('p'), { className: 'about-link' });
  linkLine.append(link);
  const by = Object.assign(document.createElement('p'), { className: 'note', textContent: t('Made by PROtestkit.eu. Version {version}.', { version }) });
  section.append(legend, ...lines, linkLine, by);
  return section;
}

/**
 * Safari on iPhone cannot put a web page in full screen; added to the Home Screen it opens without
 * the browser bars (the manifest asks for that). A one-line pointer there, on iPhone in the browser only.
 */
export function homeScreenNote(): HTMLParagraphElement | null {
  const iPhone = /iPhone|iPod/.test(navigator.userAgent);
  const installed = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as { standalone?: boolean }).standalone === true;
  if (!iPhone || installed) return null;
  return Object.assign(document.createElement('p'), { className: 'note home-screen-note', textContent: t('Full screen on iPhone: Share, then Add to Home Screen.') });
}
