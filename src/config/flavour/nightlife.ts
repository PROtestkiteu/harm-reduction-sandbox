/**
 * The nightlife pack's numbers (world/flavour/nightlife.ts). ILLUSTRATIVE.
 * Clock minutes: 18:00 = 1080, midnight = 1440, 04:00 = 1680.
 */

export type VenueKind = 'pub' | 'restaurant' | 'kebab';

export const NIGHTLIFE = {
  /** How many of each the district has, on ordinary shopfronts nothing else dresses. */
  count: { pub: 3, restaurant: 3, kebab: 1 } as Record<VenueKind, number>,
  /** Venues at least this far apart (metres), so the street keeps its ordinary shops between. */
  apart: 16,
  /** Fronts at least this wide (metres): a terrace needs room for tables. */
  width: { pub: 4.5, restaurant: 6, kebab: 3.5 } as Record<VenueKind, number>,
  /** Opening hours. */
  hours: { pub: [1080, 1560], restaurant: [1080, 1395], kebab: [1140, 1740] } as Record<VenueKind, readonly [number, number]>,
  /** Restaurants: the share of tables taken through the evening, by clock (linear between). */
  dining: [[1080, 0.3], [1140, 0.9], [1290, 1], [1350, 0.4], [1395, 0]] as readonly (readonly [number, number])[],
  /** Pubs: drinkers out front at most, and the hour from which more of them sway. */
  drinkers: 5,
  tipsyFrom: 1350,
  /** The kebab shop's queue at most, after midnight. */
  queue: 4,
  /** Walking home the worse for wear: how many at once, from when to when, how fast, how often a new one. */
  homeward: { most: 5, hours: [1380, 1680] as const, pace: [0.55, 0.85] as const, every: [9, 20] as const },
  /** Seconds a waiter stands at a table, and their pace. */
  waiter: { stay: [3, 7] as const, pace: 1.1 },
};

/** Fascia names (pixel signs, not translated: they are names). */
export const VENUE_NAMES: Record<VenueKind, readonly string[]> = {
  pub: ['THE ANCHOR', 'PUB', 'BAR 22', 'THE CROWN'],
  restaurant: ['TRATTORIA', 'BISTRO', 'PIEROGI', 'TAPAS'],
  kebab: ['KEBAB 24'],
};

/** Fascia and awning colours: [fascia background, letters, awning]. */
export const VENUE_COLOURS: Record<VenueKind, readonly (readonly [string, string, number])[]> = {
  pub: [['#1e3a2a', '#f0d890', 0x1e3a2a], ['#3a1a1a', '#f4e0b0', 0x5a1e1e], ['#1a2a4a', '#f0e8d0', 0x1a2a4a]],
  restaurant: [['#7a1e1e', '#fff4e0', 0xb0302a], ['#2a3a2a', '#f8f0d8', 0x3a6a3a], ['#1a1a1a', '#f0d890', 0x6a4a2a]],
  kebab: [['#c82020', '#fff2a0', 0xd0a020]],
};
