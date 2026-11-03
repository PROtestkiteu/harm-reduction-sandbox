import { t } from '../i18n';
import { QUALITY_MODES, type QualityMode, type QualityTier } from '../render/renderQuality';

const label = (m: QualityMode): string => (m === 'auto' ? t('Auto') : m === 'low' ? t('Low') : m === 'medium' ? t('Medium') : m === 'high' ? t('High') : t('Ultra'));

/**
 * Settings topic for graphics: Auto (picked from the device and how fast it
 * draws, per zoom) or a fixed Low, Medium, High or Ultra, as native radio buttons.
 * Under Auto the note says which tier is in use now; `sync` updates it when Auto changes tier.
 */
export function graphicsSection(initial: QualityMode, cb: { onMode(mode: QualityMode): void; tier(): QualityTier }): { section: HTMLFieldSetElement; sync(): void } {
  const section = document.createElement('fieldset');
  section.className = 'sandbox-group graphics';
  section.id = 'graphics-section';
  const legend = document.createElement('legend');
  legend.textContent = t('Graphics');
  const note = Object.assign(document.createElement('p'), { className: 'note' });
  const showNote = (mode: QualityMode) => {
    note.textContent = mode === 'auto'
      ? t('Auto keeps the picture sharp and the game smooth on this device, zoomed in or out. Now: {tier}.', { tier: label(cb.tier()) })
      : mode === 'ultra'
        ? t('Ultra draws finer detail than High, for fast computers and phones.')
        : t('Lower settings draw fewer light and shadow details, so slower phones stay smooth.');
  };

  let mode = initial;
  const rows = QUALITY_MODES.map((m) => {
    const row = document.createElement('label');
    row.className = 'flavour-pack';
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'graphics-quality', value: m, checked: m === initial });
    input.addEventListener('change', () => {
      if (!input.checked) return;
      mode = m;
      cb.onMode(m);
      showNote(m);
    });
    row.append(input, Object.assign(document.createElement('span'), { className: 'flavour-name', textContent: label(m) }));
    return row;
  });
  showNote(initial);

  section.append(legend, note, ...rows);
  return { section, sync: () => { if (mode === 'auto') showNote(mode); } };
}
