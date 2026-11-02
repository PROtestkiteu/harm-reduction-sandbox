/** The player's sound choices, kept in this browser only. */
export interface SoundSettings {
  muted: boolean;
  /** 0 to 100. */
  volume: number;
}

const KEY = 'hrp-sound';
export const DEFAULT_VOLUME = 45;

export function loadSoundSettings(): SoundSettings {
  const out: SoundSettings = { muted: false, volume: DEFAULT_VOLUME };
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<SoundSettings> | null;
    if (typeof kept?.muted === 'boolean') out.muted = kept.muted;
    if (typeof kept?.volume === 'number' && Number.isFinite(kept.volume)) out.volume = Math.min(100, Math.max(0, Math.round(kept.volume)));
  } catch { /* storage blocked or bad data: defaults */ }
  return out;
}

export function saveSoundSettings(s: SoundSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: not kept */ }
}
