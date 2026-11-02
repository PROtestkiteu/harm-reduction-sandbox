/**
 * Team morale and how workers grow into the job. ILLUSTRATIVE numbers, tuned
 * with the strategy bots (scripts/bots). The direction follows what burnout
 * research in harm reduction describes (overdose deaths of clients and
 * turning people away weigh most; being able to help sustains people), but
 * the sizes are placeholders for play.
 *
 * Morale runs 0 to 1 per person. Below `leaveBelow` they quit, with a notice
 * that says why. It replaces the old flat volunteer churn.
 */
export const MORALE = {
  /** New people start here, give or take `startSpread`. */
  start: 0.7,
  startSpread: 0.1,
  /** Each person helped at a place lifts everyone on shift there by this. */
  helped: 0.008,
  /** Each person turned away at a place drops everyone on shift there by this... */
  turnedAway: 0.006,
  /** ...and everyone else in the team by this (word gets round). */
  turnedAwayTeam: 0.001,
  /** An overdose nobody reached in time (most are people never served, using alone): everyone in the team, a little. */
  overdoseAlone: 0.006,
  /** Someone died (the cold, the heat, an overdose in a storm): everyone in the team. */
  death: 0.1,
  /** Someone in need matched with a worker who has the right skill: that worker. */
  matched: 0.01,
  /** Per clock hour on shift while worn out (energy under `TIRED` plus 0.1). */
  overworkedPerHour: 0.03,
  /** Per clock hour for paid staff while the wages cannot be paid. */
  unpaidPerHour: 0.05,
  /** Per clock hour off shift: morale drifts back toward `restTo`, never above it. */
  restPerHour: 0.04,
  restTo: 0.65,
  /** Volunteers feel every blow this much more (they are not paid to stay); halved by the peer programme. */
  volunteerFragility: 1.2,
  /** Below this, a worker quits at the next hour mark. */
  leaveBelow: 0.15,
  /** Below this, they work slower (and the panel says they are shaken). */
  shakenBelow: 0.35,
  /** Capacity lost while shaken. */
  shakenFit: 0.15,
  /** A notice when someone's morale first falls below this (once until they recover above `shakenBelow`). */
  warnBelow: 0.25,
} as const;

/**
 * Growing into the job: clock hours on shift until "new to the work" wears
 * off, and hours at one place until a worker specialises there.
 */
export const GROWTH_IN_JOB = {
  newWearsOffHours: 12,
  specialiseHours: 18,
  /** A specialist's extra share of capacity at their place. */
  specialBonus: 0.25,
} as const;
