import type { SoundSettings } from '../audio';
import { t } from '../i18n';

/**
 * Settings topic for sound: a Mute switch and a Volume slider, both native and
 * labelled. Changes go straight to the callbacks, which keep them.
 */
export function soundSection(initial: SoundSettings, cb: { onMute(muted: boolean): void; onVolume(volume: number): void }): HTMLFieldSetElement {
  const section = document.createElement('fieldset');
  section.className = 'sandbox-group sound';
  section.id = 'sound-section';
  const legend = document.createElement('legend');
  legend.textContent = t('Sound');
  const note = Object.assign(document.createElement('p'), { className: 'note', textContent: t('Street sounds and soft clicks, made in the browser. They start with your first click or key press.') });

  const muteRow = document.createElement('label');
  muteRow.className = 'flavour-pack';
  const mute = document.createElement('input');
  mute.type = 'checkbox';
  mute.checked = initial.muted;
  mute.addEventListener('change', () => cb.onMute(mute.checked));
  muteRow.append(mute, Object.assign(document.createElement('span'), { className: 'flavour-name', textContent: t('Mute') }));

  const volumeRow = document.createElement('label');
  volumeRow.className = 'sound-volume';
  const volume = document.createElement('input');
  volume.type = 'range';
  volume.min = '0';
  volume.max = '100';
  volume.step = '5';
  volume.value = String(initial.volume);
  const shown = document.createElement('output');
  const show = () => {
    const text = `${volume.value}%`;
    shown.textContent = text;
    volume.setAttribute('aria-valuetext', text);
  };
  show();
  volume.addEventListener('input', () => { show(); cb.onVolume(Number(volume.value)); });
  volumeRow.append(Object.assign(document.createElement('span'), { textContent: t('Volume') }), volume, shown);

  section.append(legend, note, muteRow, volumeRow);
  return section;
}
