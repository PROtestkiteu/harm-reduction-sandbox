import { t } from '../i18n';

/**
 * Tutorial boxes the player can turn off: the welcome at the start of each
 * new game, and the guides that open when a city meter goes red. Each has a
 * "Don't show again" tick box; the choice is kept on this device (per
 * viewer, a convenience: with storage blocked they simply keep showing).
 */
export type TutorialId = 'welcome' | 'guides';

const KEY = 'hrp-tutorials-hidden';

function read(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Whether the player ticked "Don't show again" for `id`. */
export function tutorialHidden(id: TutorialId): boolean {
  return read().has(id);
}

export function setTutorialHidden(id: TutorialId, hidden: boolean): void {
  const s = read();
  if (hidden) s.add(id);
  else s.delete(id);
  try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* storage blocked: this visit only */ }
}

/** The tick box for `id`, showing and changing the kept choice. */
export function dontShowAgain(id: TutorialId): HTMLLabelElement {
  const label = Object.assign(document.createElement('label'), { className: 'dont-show-again' });
  const box = Object.assign(document.createElement('input'), { type: 'checkbox', checked: tutorialHidden(id) });
  box.addEventListener('change', () => setTutorialHidden(id, box.checked));
  label.append(box, Object.assign(document.createElement('span'), { textContent: t("Don't show again") }));
  // A box shown again (How it works) reads the kept choice afresh.
  label.addEventListener('refresh', () => { box.checked = tutorialHidden(id); });
  return label;
}
