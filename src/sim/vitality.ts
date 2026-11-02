/**
 * How well the district is doing, 0 to 1. Harm reduction that works (no
 * crisis, few people turned away, the city's services calm) lets it grow:
 * more people out, new bars and venues, new chances for the services. A
 * crisis or overstretched city services wear it down. ILLUSTRATIVE rates.
 */
export const VITALITY = {
  start: 0.3,
  /** Growth per clock hour when things go well (slowing as it nears full). */
  grow: 0.025,
  /** Decline per clock hour in a crisis or with city services overstretched. */
  decline: 0.03,
  /** People turned away over 24 hours below which things count as going well. */
  calmUnmet: 30,
  /** City services' average pressure below which the district can grow, and above which it declines. */
  calmStress: 0.45,
  strainedStress: 0.6,
  /** A crisis deeper than this wears the district down; a passing flicker of one does not. */
  declineCrisis: 0.25,
  /** The district grows only with a crisis lighter than this. */
  growCrisis: 0.1,
  /**
   * How the street feels pulls the district along every clock hour: up while residents feel safe
   * (above `safeAbove`), down while they do not, this much per unit of the difference.
   */
  safetyPull: 0.03,
  safeAbove: 0.7,
  /** New venues open at these levels (and close 0.07 below them). */
  venuesAt: [0.4, 0.55, 0.7, 0.85],
  /** Partnering with a venue: one-off cost, then what the venue pays per clock hour. */
  partnerCost: 100,
  partnerFeePerHour: 15,
  /** Each partnered venue eases the sobering-up centre this much per clock hour. */
  partnerEasesSobering: 0.02,
} as const;

/** The venues that open as the district thrives, in order. */
export const VENUE_KINDS = ['bar', 'cafe', 'club', 'live'] as const;
export type VenueKind = (typeof VENUE_KINDS)[number];

export interface VitalityInput {
  crisis: number;
  unmet24: number;
  /** Average pressure on the city's services, 0 to 1. */
  stress: number;
  /** How safe the street feels to residents (sim/neighbourhood.ts), 0 to 1. */
  safety?: number;
}

export class Vitality {
  level: number = VITALITY.start;
  /** How many of VENUE_KINDS are open now. */
  venues = 0;
  /** Partnered venues, by index in VENUE_KINDS. */
  readonly partners = new Set<number>();

  /** Something the project did for the district shows at once (a sweep, door-knocking). */
  lift(amount: number): void {
    this.level = Math.min(1, Math.max(0, this.level + amount));
  }

  /** Advances by `dtMinutes`; returns +1 when a venue opened, -1 when one closed, else 0. */
  tick(dtMinutes: number, inp: VitalityInput): number {
    const hours = dtMinutes / 60;
    if (inp.crisis > VITALITY.declineCrisis || inp.stress > VITALITY.strainedStress) this.level -= VITALITY.decline * hours;
    else if (inp.unmet24 < VITALITY.calmUnmet && inp.stress < VITALITY.calmStress && inp.crisis < VITALITY.growCrisis) this.level += VITALITY.grow * (1 - this.level) * hours;
    if (inp.safety !== undefined) this.level += VITALITY.safetyPull * (inp.safety - VITALITY.safeAbove) * hours;
    this.level = Math.min(1, Math.max(0, this.level));
    const at = VITALITY.venuesAt;
    if (this.venues < at.length && this.level >= at[this.venues]) { this.venues++; return 1; }
    if (this.venues > 0 && this.level < at[this.venues - 1] - 0.07) {
      this.venues--;
      this.partners.delete(this.venues);
      return -1;
    }
    return 0;
  }

  /** People out and about, against the start: 0.7 to 1.5 times. */
  get footfall(): number {
    return 0.7 + 0.8 * this.level;
  }

  /** Need for the services, against the start. */
  get demand(): number {
    return 0.85 + 0.4 * this.level;
  }
}
