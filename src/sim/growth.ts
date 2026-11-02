/**
 * The district grows, whatever the player does; how it grows is theirs.
 *
 * `size` is how many people are out at night against the first evening, and
 * so how many come to the services. It rises every clock hour: a little on its
 * own (the city draws people in), more with a thriving nightlife (the district's
 * vitality: new venues, bigger crowds), and more with a street scene (people
 * sleeping rough, open use, a crisis left to run).
 *
 * `street` is that street scene, 0 to 1. A crisis, people turned away, the
 * money running out and the tent camps feed it; calm nights with the services
 * open wear it back down, slowly. It brings more people to the low-threshold
 * services and the city's harder edges (the chaos layer draws it).
 *
 * Rendering-free. ILLUSTRATIVE rates, tuned with the strategy bots.
 */
export const GROWTH = {
  /** The first evening is lighter, so a new player learns the city. */
  start: 0.75,
  /** Growth per clock hour on its own... */
  perHour: 0.004,
  /** ...plus this times the district's vitality (0 to 1)... */
  nightlifePerHour: 0.008,
  /** ...plus this times the street scene (0 to 1). */
  streetPerHour: 0.008,
  /** Growth slows as it nears this many times the first evening. */
  max: 3.5,
  /** Street scene rising per clock hour: at full crisis, at `unmetFull` turned away in a day, broke, a full camp. */
  rise: { crisis: 0.025, unmet: 0.012, broke: 0.03, camp: 0.01 },
  /** People turned away over a day, per unit of size, counted as the full `rise.unmet`. */
  unmetFull: 60,
  /** Street scene easing per clock hour while the crisis is light, more the calmer it is. */
  ease: 0.03,
  /** A crisis below this lets the street scene ease. */
  easeBelow: 0.35,
  /** The street scene adds this share of demand at the low-threshold services, at its height. */
  streetDemand: 0.5,
  /** Funders pay this share more per unit of growth: a bigger district, bigger budgets. */
  funding: 0.7,
} as const;

export interface GrowthInput {
  /** The district's vitality, 0 to 1. */
  vitality: number;
  crisis: number;
  unmet24: number;
  broke: boolean;
  /** The tent camps, 0 (none) to 1 (full). */
  camp: number;
}

export class Growth {
  size: number = GROWTH.start;
  street = 0;

  tick(dtMinutes: number, inp: GrowthInput): void {
    const hours = dtMinutes / 60;
    const r = GROWTH.rise;
    // Turned away is judged against the district's size: a bigger district turns more away at the same care.
    const unmet = Math.min(1, inp.unmet24 / (GROWTH.unmetFull * this.size));
    const rise = r.crisis * inp.crisis + r.unmet * unmet + (inp.broke ? r.broke : 0) + r.camp * inp.camp;
    const ease = !inp.broke && inp.crisis < GROWTH.easeBelow ? GROWTH.ease * (1 - inp.crisis / GROWTH.easeBelow) : 0;
    this.street = Math.min(1, Math.max(0, this.street + (rise - ease) * hours));
    const pull = GROWTH.perHour + GROWTH.nightlifePerHour * inp.vitality + GROWTH.streetPerHour * this.street;
    this.size = Math.min(GROWTH.max, this.size + pull * (1 - this.size / GROWTH.max) * hours * GROWTH.max / 2);
  }

  /** Demand at a low-threshold service (drop-in, outreach, shelter, clinic, foot patrol), against the first evening. */
  get streetNeed(): number {
    return this.size * (1 + GROWTH.streetDemand * this.street);
  }

  /** Funding against the first evening's. */
  get funding(): number {
    return 1 + GROWTH.funding * (this.size - 1);
  }

  snapshot(): { size: number; street: number } {
    return { size: Math.round(this.size * 1000) / 1000, street: Math.round(this.street * 1000) / 1000 };
  }

  restore(s: { size?: unknown; street?: unknown } | undefined): void {
    if (!s) return;
    if (typeof s.size === 'number' && Number.isFinite(s.size)) this.size = Math.min(GROWTH.max, Math.max(0.5, s.size));
    if (typeof s.street === 'number' && Number.isFinite(s.street)) this.street = Math.min(1, Math.max(0, s.street));
  }
}
