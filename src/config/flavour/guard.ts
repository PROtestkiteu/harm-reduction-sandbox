/**
 * The city guard: municipal wardens (like Poland's straż miejska) on foot in
 * pairs. They answer to the council, not the police: they check on people,
 * write tickets for small offences and call help, and nobody moves on when they
 * pass. ILLUSTRATIVE: the round and the pauses are picked to read on screen.
 */
import type { P } from './street';

/** The inner ring's pavements: one loop, walked both ways. No crowd walks them. */
export const GUARD_ROUND: readonly P[] = [
  { x: 46.6, z: -46.6 }, { x: 46.6, z: 46.6 }, { x: -46.6, z: 46.6 }, { x: -46.6, z: -46.6 },
];

export const GUARD = {
  /** Pairs out at once. */
  pairs: 2,
  speed: 1.05,
  /** How close someone must be for a pair to stop and check on them, and for how long (s). */
  checkReach: 4.5,
  checkFor: 9,
  /** How far they walk over to an incident. */
  callReach: 26,
  /** Seconds before the same pair checks the same spot again. */
  checkAgain: 120,
  /** Hi-vis yellow-green, apart from the council's orange and the outreach teal. */
  vest: 0xc8d23a,
} as const;
