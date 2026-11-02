/**
 * Funder trust: the project's funders watch what the money does. ILLUSTRATIVE
 * numbers, tuned with the strategy bots (scripts/bots). The direction follows
 * how harm reduction is funded in practice: project and programme money is
 * renewed on reported outreach and contacts, and a service that closes its
 * doors loses its funders' confidence (Carroll 2022: strong funder
 * relationships; EMCDDA 2001: project-funded NGOs).
 *
 * Trust runs from `min` to `max` (1 is the funders' usual confidence) and
 * moves towards a target set by the last day's results, slowly enough to read.
 */
export const FUNDERS = {
  start: 1,
  min: 0.25,
  max: 1.5,
  /** Share of the gap to the target closed per clock hour. */
  followPerHour: 0.04,
  /** People helped over the last 24 clock hours that funders count as a good day's work (target 1). */
  goodDayHelped: 32,
  /** Target with nobody helped, before anything else. */
  base: 0.45,
  /** How much of the target results can add on top of `base` (at `goodDayHelped`; more helps less). */
  resultsWeight: 0.55,
  /** Street reputation above or below its middle (0.5) moves the target by this much per unit. */
  reputationWeight: 0.3,
  /** Each of the starting services switched off by the player takes this off the target. */
  closedServiceCut: 0.12,
  /** Clock hours before funders judge a new project at all. */
  graceHours: 6,
  /** Bands for the notice when trust moves a lot (low, high). */
  wary: 0.7,
  confident: 1.2,
} as const;
