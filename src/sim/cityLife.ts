/**
 * Ordinary city life around the services, most of it nothing to do with
 * drugs: the rhythm of the night (commuters, diners, nightlife, early
 * shifts), the night bus, street cleaners, and everyday street crime.
 * Rendering-free; the crowd and world map site ids to places.
 *
 * ILLUSTRATIVE throughout. The library has evidence on festivals and venue
 * regulation (Eassey 2024: lockouts and trading-hour limits cut alcohol
 * violence; Bows 2020 and 2023: festival safety) but none on general street
 * crime, so incident rates and drivers are placeholders. Crime here is never
 * attributed to people who use drugs.
 */

import { POPULATIONS, presence, type PopulationId } from '../config/populations';
import type { CalendarDate } from './calendar';
import { t } from '../i18n';

/** Who a passer-by is: one of the populations, drawn by time of night, weekday, season and date. */
export type PasserbyKind = PopulationId;

export type CrimeType = 'bikeTheft' | 'carBreakIn' | 'pickpocket' | 'graffiti' | 'scuffle';

export const CRIME_LABELS: Record<CrimeType, string> = {
  bikeTheft: t('bike thefts'), carBreakIn: t('car break-ins'), pickpocket: t('pickpocketing'), graffiti: t('graffiti'), scuffle: t('scuffles at closing'),
};

/** What the city tells the crowd and world. Sites are names the crowd maps to places. */
export type CityHappening =
  | { kind: 'bus' }
  | { kind: 'cleaners' }
  | { kind: 'crime'; crime: CrimeType; responded: boolean };

export interface CityInputs {
  clock: number;
  /** People around the club door and any party: more crowd, more pickpocketing. */
  crowd: number;
  /** Visibly intoxicated club leavers per hour. */
  intoxicatedPerHour: number;
  /** Stand staff on site at closing (welfare presence). */
  standStaffed: boolean;
  patrol: number;
  /** Council not opposed: cleaners come and remove graffiti. */
  councilCleans: boolean;
  party: 'popUp' | 'festival' | null;
  /** Alcohol-heavy nights (match night, New Year's Eve) multiply scuffles. */
  scuffleMultiplier: number;
}

export class CityLife {
  readonly incidents: Record<CrimeType, number> = { bikeTheft: 0, carBreakIn: 0, pickpocket: 0, graffiti: 0, scuffle: 0 };
  responded = 0;
  /** Graffiti tags currently on walls (cleaners remove them). */
  graffiti = 0;
  /** Bikes left on the rack (thefts take them; restocked each evening). */
  bikes = 2;
  /** Recent incidents weigh on how safe the street feels (decays). */
  pressure = 0;
  private busTimer = 8;
  private cleanedTonight = false;
  private lastClock = -Infinity;

  constructor(private readonly random: () => number) {}

  /** Footfall multiplier: everyone out tonight at this hour, against a typical evening. */
  footfall(clock: number, d: CalendarDate): number {
    const total = POPULATIONS.reduce((n, p) => n + presence(p, clock, d), 0);
    return Math.min(2.5, Math.max(0.3, 0.3 + total / 3.2));
  }

  /** Club arrivals multiplier: populations that head for the club, weighted by how strongly. */
  clubPull(clock: number, d: CalendarDate): number {
    const pull = POPULATIONS.reduce((n, p) => n + presence(p, clock, d) * p.clubPull, 0);
    return Math.min(2.2, Math.max(0.3, 0.4 + pull / 1.8));
  }

  /** Draws who a passer-by is for this hour and date. */
  passerbyKind(clock: number, d: CalendarDate): PasserbyKind {
    const weights = POPULATIONS.map((p) => presence(p, clock, d));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.random() * total;
    for (let i = 0; i < POPULATIONS.length; i++) if ((r -= weights[i]) <= 0) return POPULATIONS[i].id;
    return 'residents';
  }

  /** Advances by `dtMinutes` of clock time; returns what happened. */
  tick(dtMinutes: number, inp: CityInputs): CityHappening[] {
    const out: CityHappening[] = [];
    const hours = dtMinutes / 60;
    if (inp.clock < this.lastClock) {
      // A new evening: bikes back on the rack, cleaners due again.
      this.bikes = 2;
      this.cleanedTonight = false;
    }
    this.lastClock = inp.clock;
    this.pressure *= Math.exp(-0.5 * hours);

    // Night bus every 25 to 35 clock minutes, until about 01:30, then from 05:00.
    const busHours = inp.clock < 25.5 * 60 || inp.clock >= 29 * 60;
    if (busHours && (this.busTimer -= dtMinutes) <= 0) {
      this.busTimer = 25 + this.random() * 10;
      out.push({ kind: 'bus' });
    }

    if (!this.cleanedTonight && inp.clock >= 29 * 60 && inp.councilCleans) {
      this.cleanedTonight = true;
      this.graffiti = 0;
      out.push({ kind: 'cleaners' });
    }

    const late = inp.clock >= 26 * 60 && inp.clock < 28.5 * 60;
    const policeDamp = 1 / (1 + 0.5 * inp.patrol);
    const party = inp.party === 'festival' ? 2 : inp.party === 'popUp' ? 1.3 : 1;
    // Expected incidents per clock hour (illustrative placeholders).
    const rates: Record<CrimeType, number> = {
      bikeTheft: this.bikes > 0 ? 0.08 * policeDamp : 0,
      carBreakIn: 0.06 * policeDamp,
      pickpocket: 0.02 * inp.crowd * party * policeDamp,
      graffiti: 0.07 * (late ? 2 : 1),
      // Venue regulation and welfare presence lower alcohol-related violence (Eassey 2024).
      scuffle: late ? 0.04 * inp.intoxicatedPerHour * (inp.standStaffed ? 0.5 : 1) * party * inp.scuffleMultiplier : 0,
    };
    for (const crime of Object.keys(rates) as CrimeType[]) {
      if (this.random() >= rates[crime] * hours) continue;
      this.incidents[crime]++;
      this.pressure += crime === 'scuffle' ? 0.15 : 0.08;
      if (crime === 'bikeTheft') this.bikes--;
      if (crime === 'graffiti') this.graffiti = Math.min(3, this.graffiti + 1);
      const responded = inp.patrol > 0 && crime !== 'graffiti' && this.random() < 0.7;
      if (responded) this.responded++;
      out.push({ kind: 'crime', crime, responded });
    }
    return out;
  }
}
