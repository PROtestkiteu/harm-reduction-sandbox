import cityNight from './assets/city-night.mp3?no-inline';
import uiTap from './assets/ui-tap.wav?no-inline';
import uiConfirm from './assets/ui-confirm.wav?no-inline';
import uiWarn from './assets/ui-warn.wav?no-inline';
import type { UiCue } from './cues';

/**
 * Recorded sounds (CC0; see assets/CREDITS.md): a night street in Paris for
 * the city's bed, and three interface clicks. About 450 KB in all, fetched
 * only once sound has started (after the first unmuted press), with hashed
 * names so the browser keeps them. Until they arrive, or if they cannot be
 * fetched, the generated sound plays on its own.
 */
export interface Recordings {
  city: AudioBuffer | null;
  cues: Partial<Record<UiCue, AudioBuffer>>;
}

async function load(ctx: BaseAudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await ctx.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Fetches and decodes the recordings; each one that fails is simply left out. */
export async function loadRecordings(ctx: BaseAudioContext): Promise<Recordings> {
  const [city, tap, confirm, warn] = await Promise.all([load(ctx, cityNight), load(ctx, uiTap), load(ctx, uiConfirm), load(ctx, uiWarn)]);
  const cues: Recordings['cues'] = {};
  if (tap) cues.tap = tap;
  if (confirm) cues.confirm = confirm;
  if (warn) cues.warn = warn;
  return { city, cues };
}
