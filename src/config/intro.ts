/**
 * One thing at a time. A new game opens with the team, the money and three
 * places; each further system is introduced on its own night, with one
 * notice, so the player can see what it does before the next one arrives.
 * Until its night a system has no effect at all (supplies still restock on
 * their own). Indexed like the night ramp: 0 is the first evening, and a
 * system arrives at the morning report that ends the night before.
 */
export const INTRO = {
  /** Supplies on the shelf: the panel shows them, and the standing orders become the player's. */
  supplies: 1,
  /** Standing in the city: its tiers, gifts and what they open. */
  standing: 2,
  /** Matching people's needs to the worker with the right skill. */
  matching: 3,
} as const;

export type IntroId = keyof typeof INTRO;
