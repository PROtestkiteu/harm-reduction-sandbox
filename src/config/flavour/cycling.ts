import type { P } from './street';

/**
 * People on bikes, as data. ILLUSTRATIVE: the riders loop the ring road's
 * bike lane (world/district.ts), keeping right, more in the evening than
 * after midnight; racks of parked bikes stand at the kerb of the ring road's
 * outer north pavement, which faces the camera (checked by `npm run clearance`).
 */
export const CYCLING = {
  /**
   * The ring road's two bike lanes, one along each kerb (world/district.ts), as distances
   * from the middle: clockwise riders keep right in the inner lane, the others in the outer.
   */
  inner: 48.15, // world/layout.ts: INNER + 2.5 (the inner kerb) + half a lane
  outer: 51.85, // INNER + 7.5 (the outer kerb) - half a lane
  riders: 6,
  /** Metres a second. */
  speed: [3.4, 5.4] as const,
  /** Out from 18:00 to 02:00 (clock minutes); after that only this share still rides. */
  hours: [1080, 1560] as const,
  lateShare: 0.35,
  /** Seconds between rides, for each rider. */
  rest: [10, 40] as const,
  frames: [0x2a5a8a, 0xb8382a, 0x2a2a2e, 0x6a8a3a, 0xd8c8a0, 0x8a4a8a],
};

/** Bike racks at the kerb: the rack runs along x; bikes stand across it, this many. */
export const RACKS: readonly { at: P; bikes: number }[] = [
  { at: { x: -24, z: -52.9 }, bikes: 3 },
  { at: { x: 9, z: -52.9 }, bikes: 2 },
  { at: { x: 33, z: -52.9 }, bikes: 3 },
];
