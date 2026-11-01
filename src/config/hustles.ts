/**
 * Side income when grants are scarce, each with a catch. ILLUSTRATIVE sums,
 * placeholders for play.
 */
export const HUSTLE = {
  /** The club pays for the harm reduction stand, per clock hour while the stand is open. */
  clubFeePerHour: 25,
  /** Chance the club agrees when asked, on a calm street; a crisis halves it at worst. */
  clubAccepts: 0.7,
  /** After a no, clock minutes before the club can be asked again. */
  clubAskAgain: 180,
  /** A donation drive: what it costs to run, how long it runs, the range it can bring in. */
  driveCost: 40,
  driveHours: 3,
  /** Clock hours after a drive before the street will give again. */
  driveCooldownHours: 8,
  driveMin: 100,
  driveMax: 400,
  /** Donation boxes bring in this many times more while a drive is on. */
  driveBoxes: 2,
  /** Commercial drug checking: the fee per check, the share of people still willing to pay, and how much of the public good survives. */
  checkFee: 9,
  commercialDemand: 0.75,
  /** Chance an unexpected result still reaches the early warning (and alerts) when checks are sold. */
  commercialWarning: 0.4,
  /** Share of the advice that changes people's plans, when a check is a sale. */
  commercialAdvice: 0.5,
} as const;
