/**
 * Night service traffic, as data: the council's bin lorry with its crew, the
 * street sweeper, couriers on bikes. ILLUSTRATIVE timings, in clock minutes
 * (18:00 = 1080; after midnight the clock runs on past 1440).
 */
import type { P } from './street';

/** Corner points of a lane, x then z. */
type Lane = readonly (readonly [number, number])[];

/**
 * The bin rounds, each with its own lorry and crew. The lorries drive the
 * middle of the inner ring's roads, between its two kerbside bike lanes
 * (world/district.ts); the bins stand at the kerb of the ring's inner
 * pavement. Both ends of each route lie past the widest view
 * (world/ambient.ts FAR), so the lorries come and go unseen.
 *
 * - East: in from the north down the east street, along the ring's north
 *   road, south down its east road, back along its south road and out south
 *   down the east street.
 * - West: in from the east along the south street, north up the ring's west
 *   road, and out east along the north street.
 */
export const BIN_ROUNDS: readonly { route: Lane; bins: readonly P[]; times: readonly number[]; livery: number }[] = [
  {
    route: [[25.4, -340], [25.4, -50], [50, -50], [50, 50], [25.4, 50], [25.4, 340]],
    bins: [{ x: 47.05, z: -36 }, { x: 47.05, z: -8.5 }, { x: 47.05, z: 9.5 }, { x: 47.05, z: 34 }],
    /** 22:30 (trade waste) and 04:30. */
    times: [1350, 1710],
    livery: 0x3a6a42,
  },
  {
    route: [[340, 17.9], [-50, 17.9], [-50, -20.1], [340, -20.1]],
    bins: [{ x: -47.05, z: 9.5 }, { x: -47.05, z: -8.5 }],
    /** 23:15 and 04:45, after the east round has set out. */
    times: [1395, 1725],
    livery: 0x2a5a7a,
  },
];

/** Both rounds: cruising speed, and seconds the crew takes at each stop. */
export const BIN_ROUND = { speed: 5, stop: 9 };

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
