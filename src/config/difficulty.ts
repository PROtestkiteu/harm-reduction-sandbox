/**
 * How the nights get harder. The first night is the one where a player learns
 * the city, so a crisis builds more slowly; then faster, up to a ceiling. How
 * many people come grows with the district instead (sim/growth.ts). Indexed by
 * nights already survived (0 is the first evening). ILLUSTRATIVE, tuned with
 * the strategy bots (scripts/bots).
 */
export const NIGHT_RAMP = {
  /** How strongly the crisis builds, against the usual. */
  crisis: [0.45, 0.75, 1] as readonly number[],
} as const;

/** The ramp's value for `nights` survived: the last entry holds from then on. */
export const ramp = (steps: readonly number[], nights: number): number => steps[Math.min(steps.length - 1, Math.max(0, nights))];
