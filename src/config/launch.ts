import { createRandom, type Random } from '../sim/random';

/**
 * This launch's seed. Everything dealt once per page load (the places' sites,
 * the camper's and the squat's kerb spots, the city round the district, a
 * fresh game's start date, the big events' timing) draws from streams of it,
 * never straight from Math.random: the loading screen's timers draw from that
 * too, as often as loading takes, so the same Math.random seed would deal a
 * different city on every load. Checks pin it through `__launchSeed`
 * (scripts/bots/chrome.mjs sets it from SEED), so one seed is one city.
 */
const pinned = (globalThis as { __launchSeed?: unknown }).__launchSeed;
export const LAUNCH_SEED: number = typeof pinned === 'number' && Number.isFinite(pinned) ? pinned >>> 0 : (Math.random() * 0x7fffffff) | 0;

/** Streams of the launch seed, one per purpose, so taking more from one never shifts another. */
export const LAUNCH_STREAM = { sites: 1, kerbs: 2, startDate: 3, events: 4 } as const;

/** A stream of this launch's seed for one purpose. */
export function launchRandom(stream: number): Random {
  return createRandom((LAUNCH_SEED ^ Math.imul(stream, 0x9e3779b1)) >>> 0);
}
