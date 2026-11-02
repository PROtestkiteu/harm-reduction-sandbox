/**
 * Night service traffic, as data: the council's bin lorry with its crew, the
 * street sweeper, couriers on bikes. ILLUSTRATIVE timings, in clock minutes
 * (18:00 = 1080; after midnight the clock runs on past 1440).
 */
import type { P } from './street';

/** The inner ring's east road, southbound, and the bins its crew empties at the kerb of its west pavement. */
export const BIN_ROUND = {
  lane: { x: 48.7, from: -75, to: 75 },
  bins: [{ x: 47.05, z: -36 }, { x: 47.05, z: -8.5 }, { x: 47.05, z: 9.5 }, { x: 47.05, z: 34 }] as readonly P[],
  /** Runs at 22:30 (trade waste) and 04:30. */
  times: [1350, 1710] as const,
  speed: 5,
  /** Seconds the crew takes at each stop. */
  stop: 9,
};

/** The sweeper follows the north street's moving lane (eastbound) at a crawl, before dawn. */
export const SWEEPER = { lane: { z: -20.1, from: -75, to: 75 }, time: 1740, speed: 2.4 };

/** Couriers on bikes along the south street's moving lane, through the evening. */
export const COURIERS = {
  lane: { z: 17.9, from: 75, to: -75 },
  hours: [1110, 1560] as const,
  /** Seconds between couriers. */
  every: [25, 70] as const,
  speed: 6.5,
};
