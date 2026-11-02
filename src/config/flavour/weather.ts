import type { Season } from '../../sim/calendar';

/**
 * Rain and fog, as data. ILLUSTRATIVE: chances per evening by season, and how
 * much each mood wets the streets (the same scale as the seasons' wetness).
 */
export const RAIN_CHANCE: Record<Season, number> = { spring: 0.4, summer: 0.2, autumn: 0.5, winter: 0.25 };
/** Ground fog gathers before dawn on some nights. */
export const FOG_CHANCE: Record<Season, number> = { spring: 0.3, summer: 0.15, autumn: 0.45, winter: 0.35 };
/** In the automatic mood, fog shows between these clock minutes (02:30 to 06:00). */
export const FOG_HOURS: readonly [number, number] = [1590, 1800];

export const RAIN = {
  drops: 1400,
  /** Half size of the box of rain round the middle of the view, metres. */
  reach: 44,
  height: 26,
  fall: 17,
  /** Streets this wet while it rains (seasons run 0 to about 3). */
  wetness: 2.6,
};

export const FOG = {
  /** Fog banks round the view: drifting soft layers near the ground. */
  banks: 10,
  reach: 46,
  /** Per layer; layers overlap, so the whole bank is a few times this. */
  opacity: 0.22,
  /** Lit grey by day, a lamp-lit blue-grey at night (darker would vanish on dark streets). */
  dayColour: 0xc8ccd0,
  nightColour: 0x7a828c,
  drift: 0.6,
};
