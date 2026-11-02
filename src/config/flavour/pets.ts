import type { P } from './street';

/**
 * Pets, as data. ILLUSTRATIVE: people walking dogs up and down the ring
 * road's outer north and west pavements (they face the camera; the inner
 * ones lie behind their buildings from it), stopping now and
 * then while the dog sniffs, in the evening and again in the early morning;
 * cats in doorways along the same walls, now and then trotting a few metres
 * and settling again. Checked by `npm run clearance`.
 */
export const DOG_WALKS: readonly { from: P; to: P }[] = [
  { from: { x: -38, z: -53.8 }, to: { x: -6, z: -53.8 } },
  { from: { x: 14, z: -53.8 }, to: { x: 40, z: -53.8 } },
  { from: { x: -53.8, z: -32 }, to: { x: -53.8, z: 6 } },
];

export const PETS = {
  /** Walking pace (m/s), and a stop to sniff: chance a second, seconds. */
  pace: 1.0,
  sniffPerSecond: 0.06,
  sniff: [3, 7] as const,
  /** Out in the evening and early morning (clock minutes, 18:00 = 1080). */
  hours: [[1080, 1410], [1860, 2160]] as const,
  /** Cats: where they settle (by a wall), how often one moves on, how far, and how fast. */
  cats: [{ x: -30.5, z: -54.65 }, { x: 4.2, z: -54.65 }, { x: -54.65, z: -12 }, { x: 26.5, z: -54.65 }] as readonly P[],
  catMovePerSecond: 0.02,
  catHop: [1.5, 4] as const,
  catSpeed: 1.6,
  coats: [0x2a2622, 0xd89a52, 0x8a8a8a, 0xe8e2d6] as const,
};
