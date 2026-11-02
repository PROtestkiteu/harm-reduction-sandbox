/**
 * How the nights get harder. The first night is the one where a player learns
 * the city, so it is lighter: fewer people in need and a crisis that builds
 * more slowly; then each night asks a little more, up to a ceiling. Indexed by
 * nights already survived (0 is the first evening). ILLUSTRATIVE, tuned with
 * the strategy bots (scripts/bots).
 */
export const NIGHT_RAMP = {
  /** People who come to the services, against the usual. */
  demand: [0.7, 0.85, 1, 1.08, 1.15, 1.2] as readonly number[],
  /** How strongly the crisis builds, against the usual. */
  crisis: [0.45, 0.75, 1] as readonly number[],
} as const;

/** The ramp's value for `nights` survived: the last entry holds from then on. */
export const ramp = (steps: readonly number[], nights: number): number => steps[Math.min(steps.length - 1, Math.max(0, nights))];
