import { PACKS, WEATHER_MOODS, type PackId, type PackSettings, type WeatherMood } from '../config/flavour/packs';
import { t } from '../i18n';

/**
 * Settings topic for the flavour packs: one switch per pack and the weather's
 * mood. Native checkboxes and a select, labelled, with each pack's hint as its
 * description. Changes go straight to the callbacks; the packs never touch the
 * simulation, so nothing here has to wait for a step.
 */
export function flavourSection(initial: PackSettings, cb: { onPack(id: PackId, on: boolean): void; onMood(mood: WeatherMood): void }): HTMLFieldSetElement {
  const section = document.createElement('fieldset');
  section.className = 'sandbox-group flavour';
  section.id = 'flavour-section';
  const legend = document.createElement('legend');
  legend.textContent = t('Flavour packs');
  const note = Object.assign(document.createElement('p'), { className: 'note', textContent: t('Street life on top of the model. None of it changes the numbers.') });
  section.append(legend, note);
  for (const p of PACKS) {
    const row = document.createElement('label');
    row.className = 'flavour-pack';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = initial.on[p.id];
    const hintId = `flavour-hint-${p.id}`;
    box.setAttribute('aria-describedby', hintId);
    box.addEventListener('change', () => cb.onPack(p.id, box.checked));
    const name = Object.assign(document.createElement('span'), { className: 'flavour-name', textContent: p.label });
    const hint = Object.assign(document.createElement('span'), { className: 'flavour-hint', id: hintId, textContent: p.hint });
    row.append(box, name, hint);
    section.append(row);
    if (p.id === 'weather') {
      const moodRow = document.createElement('label');
      moodRow.className = 'flavour-mood';
      moodRow.append(Object.assign(document.createElement('span'), { textContent: t('Weather') }));
      const select = document.createElement('select');
      for (const m of WEATHER_MOODS) select.append(new Option(m.label, m.id, false, m.id === initial.weather));
      select.addEventListener('change', () => cb.onMood(select.value as WeatherMood));
      moodRow.append(select);
      section.append(moodRow);
    }
  }
  return section;
}
