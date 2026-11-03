/**
 * The mixer's channels, in the order the Sound panel shows them. Every sound
 * the game makes goes to exactly one of them.
 */
export const CHANNELS = ['city', 'traffic', 'people', 'music', 'weather', 'events', 'ui'] as const;
export type Channel = (typeof CHANNELS)[number];

export interface ChannelSetting {
  /** 0 to 100. */
  volume: number;
  muted: boolean;
}

/** The player's sound choices, kept in this browser only. */
export interface SoundSettings {
  /** Mutes everything: the audio context is suspended. */
  muted: boolean;
  /** Master volume, 0 to 100. */
  volume: number;
  mix: Record<Channel, ChannelSetting>;
}

export type PresetId = 'standard' | 'calm' | 'busy' | 'interface';

/** Channel volumes of each preset (master and mutes are left alone). */
export const PRESETS: Record<PresetId, Record<Channel, number>> = {
  standard: { city: 70, traffic: 60, people: 65, music: 60, weather: 70, events: 55, ui: 70 },
  calm: { city: 75, traffic: 25, people: 40, music: 30, weather: 80, events: 20, ui: 55 },
  busy: { city: 85, traffic: 90, people: 90, music: 75, weather: 65, events: 75, ui: 70 },
  interface: { city: 0, traffic: 0, people: 0, music: 0, weather: 0, events: 0, ui: 80 },
};

const KEY = 'hrp-sound';
export const DEFAULT_VOLUME = 45;

const clamp = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : d);

export function defaultMix(): Record<Channel, ChannelSetting> {
  const out = {} as Record<Channel, ChannelSetting>;
  for (const c of CHANNELS) out[c] = { volume: PRESETS.standard[c], muted: false };
  return out;
}

/** Reads the kept settings; older ones (a mute and one volume) keep both and get the standard mix. */
export function loadSoundSettings(): SoundSettings {
  const out: SoundSettings = { muted: false, volume: DEFAULT_VOLUME, mix: defaultMix() };
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { muted?: unknown; volume?: unknown; mix?: Record<string, { volume?: unknown; muted?: unknown } | undefined> } | null;
    if (typeof kept?.muted === 'boolean') out.muted = kept.muted;
    out.volume = clamp(kept?.volume, DEFAULT_VOLUME);
    for (const c of CHANNELS) {
      const k = kept?.mix?.[c];
      if (!k) continue;
      out.mix[c].volume = clamp(k.volume, out.mix[c].volume);
      if (typeof k.muted === 'boolean') out.mix[c].muted = k.muted;
    }
  } catch { /* storage blocked or bad data: defaults */ }
  return out;
}

export function saveSoundSettings(s: SoundSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: not kept */ }
}

/** The preset the channel volumes match exactly, if any. */
export function presetOf(mix: Record<Channel, ChannelSetting>): PresetId | null {
  for (const id of Object.keys(PRESETS) as PresetId[]) if (CHANNELS.every((c) => PRESETS[id][c] === mix[c].volume)) return id;
  return null;
}
