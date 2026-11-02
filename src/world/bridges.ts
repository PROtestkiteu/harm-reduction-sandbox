import { GROW } from './layout';

/**
 * The two road bridges over the river east of the district are low arches,
 * tall enough at mid-span for the river boats to pass under. Cars and
 * emergency vehicles follow the same curve (world/ambient.ts), and the deck
 * is built along it (world/cityBeyond.ts).
 */
export const RIVER_X = { x0: 56 + GROW, x1: 76 + GROW };
export const BRIDGE = {
  /** Road height at mid-span above the street (metres), and how far the ramps reach onto each bank. */
  rise: 3.4,
  ramp: 7,
};
const A = RIVER_X.x0 - BRIDGE.ramp;
const B = RIVER_X.x1 + BRIDGE.ramp;

/** Road surface height at `x` on a bridge's line (0.02 off it, as on every street). */
export function bridgeY(x: number): number {
  if (x <= A || x >= B) return 0.02;
  return 0.02 + BRIDGE.rise * Math.sin((Math.PI * (x - A)) / (B - A));
}

/** Rise of the road per metre along +x at `x` (0 off the bridge). */
export function bridgeSlope(x: number): number {
  if (x <= A || x >= B) return 0;
  return BRIDGE.rise * (Math.PI / (B - A)) * Math.cos((Math.PI * (x - A)) / (B - A));
}

/** Where the arch starts and ends along x. */
export const BRIDGE_SPAN = { x0: A, x1: B };
