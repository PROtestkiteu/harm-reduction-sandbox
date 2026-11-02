/**
 * What the project can do for the people living in the district's blocks.
 * ILLUSTRATIVE values: the effects move the neighbourhood's own measures
 * (discarded kit, how safe the street feels) and, at once, how the district
 * is doing (its meter at the top), never a hidden score.
 */
export const RESIDENTS = {
  /** A team sweeps courtyards and stairwells for used needles and kit. */
  sweepCost: 30,
  /** Share of the discarded kit picked up in one sweep. */
  sweepShare: 0.5,
  sweepCooldownHours: 3,
  /** The district's meter rises this much at once after a sweep (cleaner courtyards, fewer complaints). */
  sweepDistrict: 0.03,
  /** Door-knocking and a number to call: residents feel safer while it is fresh. */
  meetCost: 20,
  /** Added to how safe the street feels, while it lasts. */
  meetSafety: 0.08,
  meetHours: 6,
  meetCooldownHours: 8,
  /** The district's meter rises this much at once after a round of door-knocking. */
  meetDistrict: 0.04,
} as const;
