import { t } from '../i18n';

/**
 * The big crisis: a night you are warned about and must prepare for, like the
 * storm in Frostpunk. A deep freeze in the cold half of the year, a wave of
 * contaminated drugs in the warm half. It is a test of how well the project
 * runs: unprepared, a first attempt should lose people, then the team, then
 * the project. ILLUSTRATIVE numbers, tuned with the strategy bots
 * (scripts/bots: the naive bot should fold, the prepared one hold).
 */
export type StormKind = 'freeze' | 'badBatch';

export const STORM = {
  /** The first storm comes on this night (0 is the first evening), then every `every` nights, each worse. */
  firstNight: 2,
  every: 4,
  /** Each later storm is this much worse than the one before (added to a severity of 1). */
  worsen: 0.25,
  /** The warning comes at this clock time the night before (counted from 18:00, so 20:00). */
  warnAt: 20 * 60,
  /** The storm's peak, in clock minutes (20:00 to 04:00). */
  from: 20 * 60,
  to: 28 * 60,
  /** People coming to the low-threshold services at the peak, against the usual (times severity). */
  demand: 3.5,
  /** Staff tire this much faster at the peak. */
  drain: 1.6,
  /** Turning people away hurts the team this many times more at the peak. */
  moraleBlow: 1.2,
  /**
   * People across the city in danger each clock hour of the peak (times severity): sleeping out in
   * the freeze, or using the bad batch alone. Each one served that hour at a low-threshold place is
   * safe; for each of the rest, `risk` that they die before morning (before preparation). Counted
   * in the sim, not by who reaches a door, so it holds however crowded the street is.
   */
  atRiskPerHour: 10,
  risk: 0.2,
  /** With an outreach worker on the street and the right stock (blankets, naloxone), that much of the danger is caught. */
  outreachSaves: 0.6,
  /** Preparations the player can make once warned. */
  prepare: {
    /** Emergency beds at the drop-in: cost, extra places during the peak, and the death risk left. */
    beds: { cost: 200, places: 4, risk: 0.5 },
    /** Warn the street with leaflets: how many it takes, and the death risk left. */
    warn: { leaflets: 40, risk: 0.6 },
    /** On-call volunteers for the night: cost and how many. They go home afterwards. */
    standby: { cost: 120, volunteers: 2 },
  },
} as const;

export type StormPrep = keyof typeof STORM.prepare;

export const STORM_TEXT: Record<StormKind, { name: string; warning: string; stock: 'blankets' | 'naloxone' }> = {
  freeze: { name: t('the deep freeze'), warning: t('The forecast says a deep freeze comes tomorrow night, from 20:00 to 04:00. Many more people will need a warm place, and anyone left outside may not live to see the morning.'), stock: 'blankets' },
  badBatch: { name: t('the bad batch'), warning: t('Word from the street and the early warning: a batch laced with something far stronger is coming in. Tomorrow night, from 20:00 to 04:00, expect many more people in trouble and overdoses that need naloxone in minutes.'), stock: 'naloxone' },
};
