/**
 * How the nights get harder. Hard from the first night (the guidelines ask for
 * scarcity from the start), a little harder over the next two, then at its
 * ceiling. The big crisis (config/storm.ts) is the real test. How many people
 * come grows with the district instead (sim/growth.ts). Indexed by nights
 * already survived (0 is the first evening). ILLUSTRATIVE, tuned with the
 * strategy bots (scripts/bots).
 */
export const NIGHT_RAMP = {
  /** How strongly the crisis builds, against the usual. */
  crisis: [0.7, 0.85, 1] as readonly number[],
} as const;

/** The ramp's value for `nights` survived: the last entry holds from then on. */
export const ramp = (steps: readonly number[], nights: number): number => steps[Math.min(steps.length - 1, Math.max(0, nights))];
