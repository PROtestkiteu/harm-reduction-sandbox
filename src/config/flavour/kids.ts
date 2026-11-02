import type { P } from './street';

/**
 * Children, as data. ILLUSTRATIVE: families walking on the ring road's outer
 * west pavement in the early evening, a child holding a parent's hand or
 * running a few steps ahead; and in the morning, children walking to school.
 * The routes face the camera and no crowd walks them (checked by
 * `npm run clearance`).
 */
export const FAMILIES: readonly { from: P; to: P; kids: number }[] = [
  { from: { x: -53.6, z: 30 }, to: { x: -53.6, z: -38 }, kids: 2 },
  { from: { x: -40, z: -53.6 }, to: { x: 30, z: -53.6 }, kids: 1 },
];

export const KIDS = {
  /** Child heights (metres) and the walking pace of a family (m/s). */
  height: [1.05, 1.35] as const,
  pace: 0.85,
  /** Out from 18:00 to 20:30, and to school from 07:30 to 08:30 (clock minutes). */
  hours: [[1080, 1230], [2250, 2310]] as const,
  /** Seconds before the next family sets out. */
  gap: [15, 45] as const,
};
