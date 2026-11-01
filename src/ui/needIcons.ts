import type { Need } from '../config/needs';
import { t } from '../i18n';

/** Small icons for the city's needs, drawn in the text colour: a police badge, a medical cross, a bed, a house. */
export const NEED_ICONS: Record<Need, string> = {
  police: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1l6 2.2v4.3c0 3.6-2.6 6.3-6 7.5-3.4-1.2-6-3.9-6-7.5V3.2z"/></svg>',
  medics: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M6 1.5h4v4.5h4.5v4H10v4.5H6V10H1.5V6H6z"/></svg>',
  sobering: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M1 4h2v5h12v5h-2v-2H3v2H1zm3 1.5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM7 6h6.5a1.5 1.5 0 0 1 1.5 1.5V8H7z"/></svg>',
  district: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.5l6.5 5.5H13v7.5H9.5V10h-3v4.5H3V7H1.5z"/></svg>',
};

const NEED_NAME: Record<Need, string> = { police: t('Police'), medics: t('Medics'), sobering: t('Sobering'), district: t('District') };

/**
 * A meter's state for its colour: green, amber, red. Pressure on a city service is bad high;
 * the district doing well is good high.
 */
export function meterState(need: Need, v: number): 'low' | 'mid' | 'high' {
  if (need === 'district') return v >= 0.55 ? 'low' : v >= 0.3 ? 'mid' : 'high';
  return v >= 0.7 ? 'high' : v >= 0.4 ? 'mid' : 'low';
}

/** The four city meters, in the order the HUD shows them. */
export const METER_ORDER: readonly Need[] = ['police', 'medics', 'district', 'sobering'];

/** An empty holder for need icons, to put at the end of a priced reply. */
export function needTag(): HTMLElement {
  const tag = document.createElement('span');
  tag.className = 'needs';
  tag.setAttribute('role', 'img');
  tag.hidden = true;
  return tag;
}

/** Shows which needs a spend eases; touches the DOM only when the list changes. */
export function setNeeds(tag: HTMLElement, needs: readonly Need[] = []): void {
  const key = needs.join(' ');
  if (tag.dataset.needs === key) return;
  tag.dataset.needs = key;
  tag.hidden = needs.length === 0;
  tag.setAttribute('aria-label', needs.length ? t('Eases: {needs}', { needs: needs.map((n) => NEED_NAME[n]).join(', ') }) : '');
  tag.replaceChildren(...needs.map((n) => {
    const icon = document.createElement('span');
    icon.className = 'need';
    icon.dataset.need = n;
    icon.innerHTML = NEED_ICONS[n];
    return icon;
  }));
}

/** A need tag already filled, for replies built once. */
export function needsFor(needs: readonly Need[] | undefined): HTMLElement {
  const tag = needTag();
  setNeeds(tag, needs);
  return tag;
}
