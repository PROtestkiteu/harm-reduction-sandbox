import type { Random } from './random';
import type { Season } from './calendar';

/**
 * Weather harm to people outdoors: cold on winter nights (and any cold
 * night), heat in the middle of summer days. Someone is found too cold or
 * overheated and dehydrated, an ambulance is called, and some do not survive.
 * Two things the organisation can run lower the risk: a warming bus on cold
 * nights, a water and shade point on hot days.
 *
 * ILLUSTRATIVE: no study in the library gives these rates. The direction
 * (shelter and water lower exposure deaths) is common sense, the numbers are
 * placeholders for play.
 */
export const EXPOSURE = {
  /** Expected harms per clock hour while it is cold out, with nowhere warm. */
  coldPerHour: 0.08,
  /** A cold-night event triples the risk. */
  coldNight: 3,
  /** Heat harms per clock hour in the middle of a summer day. */
  heatPerHour: 0.07,
  /** An open drop-in takes some people in from the cold or the heat. */
  dropInOpen: 0.55,
  /** The warming bus, or the water and shade point, while running. */
  aid: 0.25,
  /** Chance that outreach staff reach the person first, when outreach is open. */
  reachedByOutreach: 0.5,
  /** Chance of dying: reached and treated early, or found late and alone. */
  diesIfReached: 0.04,
  diesAlone: 0.3,
  /** Running costs per clock hour. */
  warmingBusPerHour: 20,
  coolingPointPerHour: 8,
} as const;

export type ExposureKind = 'cold' | 'heat';

export interface ExposureInput {
  season: Season;
  /** Scene clock in minutes, 18:00 (1080) to 18:00 the next day (2520). */
  clock: number;
  coldNight: boolean;
  dropInOpen: boolean;
  outreachOpen: boolean;
  warmingBus: boolean;
  coolingPoint: boolean;
  /** The places' budget mix: more basics (food, drinks, warmth), lower risk. */
  mixFactor?: number;
  /** Overstretched ambulances: more of those harmed do not survive. */
  deathFactor?: number;
}

export interface ExposureHarm {
  kind: ExposureKind;
  /** Outreach staff got there first. */
  reached: boolean;
  died: boolean;
}

/** Which weather harm, if any, people outdoors face at this hour of this season. */
export function exposureNow(season: Season, clock: number, coldNight: boolean): ExposureKind | null {
  // Night: 22:00 to 07:00. Midday heat: 11:00 to 18:00.
  const night = clock >= 22 * 60 && clock < 31 * 60;
  const midday = clock >= 35 * 60 && clock < 42 * 60;
  if (night && (season === 'winter' || coldNight)) return 'cold';
  if (midday && season === 'summer') return 'heat';
  return null;
}

/** Whether a remedy has anything to do this season (the bus in winter or on a cold night, water in summer). */
export function aidSeason(kind: ExposureKind, season: Season, coldNight: boolean): boolean {
  return kind === 'cold' ? season === 'winter' || coldNight : season === 'summer';
}

export class Exposure {
  harms = 0;
  deaths = 0;

  constructor(private readonly random: Random) {}

  tick(dtMinutes: number, inp: ExposureInput): ExposureHarm | null {
    const kind = exposureNow(inp.season, inp.clock, inp.coldNight);
    if (!kind) return null;
    let perHour = kind === 'cold' ? EXPOSURE.coldPerHour * (inp.coldNight ? EXPOSURE.coldNight : 1) : EXPOSURE.heatPerHour;
    if (inp.dropInOpen) perHour *= EXPOSURE.dropInOpen;
    perHour *= inp.mixFactor ?? 1;
    if (kind === 'cold' ? inp.warmingBus : inp.coolingPoint) perHour *= EXPOSURE.aid;
    if (this.random() >= perHour * (dtMinutes / 60)) return null;
    const reached = inp.outreachOpen && this.random() < EXPOSURE.reachedByOutreach;
    const died = this.random() < (reached ? EXPOSURE.diesIfReached : EXPOSURE.diesAlone) * (inp.deathFactor ?? 1);
    this.harms++;
    if (died) this.deaths++;
    return { kind, reached, died };
  }
}
