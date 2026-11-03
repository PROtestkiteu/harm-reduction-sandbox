import { SCENARIOS } from '../config/scenarios';
import { newGameAddress } from '../game/liveGame';
import { t } from '../i18n';

/**
 * Settings topic: the scenarios. Each starts a fresh game in that country's
 * setting with its goal; the address carries the choice (`?scenario=`), so a
 * scenario can be shared as a link. The current game stays at its own address.
 */
export function scenariosSection(current: string | null): HTMLFieldSetElement {
  const section = document.createElement('fieldset');
  section.className = 'sandbox-group scenarios';
  section.id = 'scenarios-section';
  const legend = Object.assign(document.createElement('legend'), { textContent: t('Scenarios') });
  section.append(legend, Object.assign(document.createElement('p'), { className: 'note', textContent: t('Each one starts a new game with a goal to reach. Share or save this game first if you want to keep it.') }));
  for (const s of SCENARIOS) {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'btn save-btn scenario-btn' });
    b.append(Object.assign(document.createElement('strong'), { textContent: s.title }), Object.assign(document.createElement('span'), {
      className: 'scenario-blurb',
      textContent: `${s.blurb} ${t('Goal: {nights} nights, {helped} people helped, {stars} stars, no more than {deaths} deaths.', { nights: s.nights, helped: s.helped, stars: s.stars, deaths: s.deaths })}`,
    }));
    if (s.id === current) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => {
      const url = new URL(newGameAddress(), location.href);
      for (const k of ['set', 'ctx', 'model', 'scenario']) url.searchParams.delete(k);
      url.searchParams.set('scenario', s.id);
      if (s.model) url.searchParams.set('model', s.model);
      location.href = url.pathname + url.search;
    });
    section.append(b);
  }
  return section;
}
