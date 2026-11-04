import { CHANNELS, PRESETS, presetOf, type Channel, type PresetId, type SoundSettings } from '../audio';
import { t } from '../i18n';

/** What the panel needs of the sound: its settings and the setters that keep them. */
export interface SoundControls {
  readonly settings: SoundSettings;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  setChannel(c: Channel, change: { volume?: number; muted?: boolean }): void;
  applyPreset(id: PresetId): void;
}

const CHANNEL_NAME: Record<Channel, () => string> = {
  city: () => t('City ambience'),
  traffic: () => t('Traffic'),
  people: () => t('People and voices'),
  music: () => t('Music from venues'),
  weather: () => t('Weather'),
  events: () => t('Sirens and alerts'),
  ui: () => t('Interface clicks'),
};

const CHANNEL_HINT: Record<Channel, () => string> = {
  city: () => t('The night street, the river, birds before dawn, dogs, doors and shutters.'),
  traffic: () => t('Cars, buses, scooters, horns, the train, boats on the river and planes overhead.'),
  people: () => t('Footsteps, talk outside the club and the bars, glasses, stadium and festival crowds.'),
  music: () => t('The club through its walls, a rave in the park, the festival stage.'),
  weather: () => t('Rain, wind and far thunder.'),
  events: () => t('Sirens, police radios at a raid, the helicopter.'),
  ui: () => t('Soft clicks for buttons, confirmations and warnings.'),
};

const PRESET_NAME: Record<PresetId, () => string> = {
  standard: () => t('Standard'),
  calm: () => t('Calm'),
  busy: () => t('Busy street'),
  interface: () => t('Interface only'),
};

/** A labelled 0 to 100 slider with its value beside it, announced as a percentage. */
function slider(id: string, name: string, value: number, onInput: (v: number) => void): { row: HTMLDivElement; input: HTMLInputElement; show(): void } {
  const row = document.createElement('div');
  row.className = 'sound-volume';
  const label = Object.assign(document.createElement('label'), { htmlFor: id, textContent: name, className: 'sound-name' });
  const input = Object.assign(document.createElement('input'), { type: 'range', id, min: '0', max: '100', step: '5', value: String(value) });
  const shown = document.createElement('output');
  shown.htmlFor.add(id);
  const show = () => {
    const text = `${input.value}%`;
    shown.textContent = text;
    input.setAttribute('aria-valuetext', text);
  };
  show();
  input.addEventListener('input', () => { show(); onInput(Number(input.value)); });
  row.append(label, input, shown);
  return { row, input, show };
}

/**
 * Settings topic for sound: Mute and the master volume, a few mix presets,
 * and a volume with its own mute for each channel. All native controls,
 * labelled, usable by keyboard; changes go straight to the sound, which keeps
 * them in this browser.
 */
export function soundSection(sound: SoundControls): HTMLFieldSetElement {
  const s = sound.settings;
  const section = document.createElement('fieldset');
  section.className = 'sandbox-group sound';
  section.id = 'sound-section';
  const legend = document.createElement('legend');
  legend.textContent = t('Sound');
  const note = Object.assign(document.createElement('p'), { className: 'note', textContent: t('A recorded night street under sounds made in the browser, which follow the hour, the weather and where you look. They start with your first click or key press.') });

  const muteRow = document.createElement('label');
  muteRow.className = 'flavour-pack';
  const mute = Object.assign(document.createElement('input'), { type: 'checkbox', checked: s.muted });
  mute.addEventListener('change', () => { sound.setMuted(mute.checked); sync(); });
  muteRow.append(mute, Object.assign(document.createElement('span'), { className: 'flavour-name', textContent: t('Mute') }));
  const master = slider('sound-master', t('Volume'), s.volume, (v) => sound.setVolume(v));
  master.row.classList.add('sound-master');

  const presets = document.createElement('div');
  presets.className = 'sound-presets';
  presets.setAttribute('role', 'group');
  presets.setAttribute('aria-label', t('Mix presets'));
  const presetButtons = (Object.keys(PRESETS) as PresetId[]).map((id) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'btn sound-preset', textContent: PRESET_NAME[id]() });
    b.dataset.preset = id;
    b.addEventListener('click', () => {
      sound.applyPreset(id);
      for (const c of CHANNELS) {
        rows[c].slider.input.value = String(s.mix[c].volume);
        rows[c].slider.show();
      }
      sync();
    });
    presets.append(b);
    return b;
  });

  const mixer = document.createElement('div');
  mixer.className = 'sound-mixer';
  mixer.setAttribute('role', 'group');
  mixer.setAttribute('aria-label', t('Mixer'));
  // Column heads for sight only: each control carries its own name.
  const head = Object.assign(document.createElement('div'), { className: 'sound-mixer-head' });
  head.setAttribute('aria-hidden', 'true');
  head.append(Object.assign(document.createElement('span'), { textContent: t('Mixer') }), Object.assign(document.createElement('span'), { textContent: t('Mute') }));
  mixer.append(head);
  const rows = {} as Record<Channel, { slider: ReturnType<typeof slider>; mute: HTMLInputElement }>;
  for (const c of CHANNELS) {
    const name = CHANNEL_NAME[c]();
    const sl = slider(`sound-${c}`, name, s.mix[c].volume, (v) => { sound.setChannel(c, { volume: v }); sync(); });
    sl.row.dataset.iconHint = CHANNEL_HINT[c]();
    sl.input.setAttribute('aria-describedby', `sound-${c}-hint`);
    const hint = Object.assign(document.createElement('span'), { id: `sound-${c}-hint`, className: 'sound-hint', textContent: CHANNEL_HINT[c]() });
    const m = Object.assign(document.createElement('input'), { type: 'checkbox', checked: s.mix[c].muted, className: 'sound-mute' });
    m.setAttribute('aria-label', t('Mute {channel}', { channel: name }));
    m.dataset.iconHint = t('Mute {channel}', { channel: name });
    m.addEventListener('change', () => { sound.setChannel(c, { muted: m.checked }); sync(); });
    sl.row.append(m, hint);
    rows[c] = { slider: sl, mute: m };
    mixer.append(sl.row);
  }

  /** Marks the matching preset and dims muted channels. */
  function sync(): void {
    const current = presetOf(s.mix);
    for (const b of presetButtons) b.setAttribute('aria-pressed', String(b.dataset.preset === current));
    for (const c of CHANNELS) rows[c].slider.row.classList.toggle('muted', s.mix[c].muted || s.muted);
    master.row.classList.toggle('muted', s.muted);
  }
  sync();

  section.append(legend, note, muteRow, master.row, presets, mixer);
  return section;
}
