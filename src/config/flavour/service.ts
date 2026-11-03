/**
 * Night service traffic, as data: the council's bin lorry with its crew, the
 * street sweeper, couriers on bikes. ILLUSTRATIVE timings, in clock minutes
 * (18:00 = 1080; after midnight the clock runs on past 1440).
 */
import type { P } from './street';

/**
 * The bin round: in from the north down the east street, along the inner
 * ring's north road, south down its east road (the bins its crew empties are
 * at the kerb of its west pavement), back along its south road and out south
 * down the east street. Corner points of its lane, x then z; the ends lie
 * past the widest view (world/ambient.ts FAR), so the lorry comes and goes unseen.
 */
export const BIN_ROUND = {
  route: [[25.4, -340], [25.4, -48.7], [48.7, -48.7], [48.7, 48.7], [25.4, 48.7], [25.4, 340]] as readonly (readonly [number, number])[],
  bins: [{ x: 47.05, z: -36 }, { x: 47.05, z: -8.5 }, { x: 47.05, z: 9.5 }, { x: 47.05, z: 34 }] as readonly P[],
  /** Runs at 22:30 (trade waste) and 04:30. */
  times: [1350, 1710] as const,
  speed: 5,
  /** Seconds the crew takes at each stop. */
  stop: 9,
};

/** The sweeper follows the north street's moving lane (eastbound) at a crawl, before dawn, from beyond the view to beyond it. */
export const SWEEPER = { lane: { z: -20.1, from: -340, to: 340 }, time: 1740, speed: 2.4 };

/** Couriers on bikes along the south street's moving lane, through the evening. */
export const COURIERS = {
  lane: { z: 17.9, from: 340, to: -340 },
  hours: [1110, 1560] as const,
  /** Seconds between couriers. */
  every: [25, 70] as const,
  speed: 6.5,
};

/** Out of sight, service traffic makes up time: its speed is multiplied by this, so it is not long on the way in or out. */
export const UNSEEN_HURRY = 3;
