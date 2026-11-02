/**
 * What the project can do for the people living in the district's blocks.
 * ILLUSTRATIVE values: the effects move the neighbourhood's own measures
 * (discarded kit, how safe the street feels), never a hidden score.
 */
export const RESIDENTS = {
  /** A team sweeps courtyards and stairwells for used needles and kit. */
  sweepCost: 30,
  /** Share of the discarded kit picked up in one sweep. */
  sweepShare: 0.5,
  sweepCooldownHours: 3,
  /** Door-knocking and a number to call: residents feel safer while it is fresh. */
  meetCost: 20,
  /** Added to how safe the street feels, while it lasts. */
  meetSafety: 0.08,
  meetHours: 6,
  meetCooldownHours: 8,
} as const;
