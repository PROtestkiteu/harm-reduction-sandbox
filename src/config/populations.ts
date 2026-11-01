/**
 * Who is out on the street, and when. Each population has a time-of-night
 * profile, weekday and season multipliers and special dates; permanent ones
 * live here, temporary ones come for a season, waves come with a date or
 * with another event. ILLUSTRATIVE weights throughout.
 *
 * Library evidence is thin here: festival seasons grow (Hutton 2021: 330 to
 * 1,368 samples per season), festival crowds travel (ACT 2019 festival: about
 * 80% from interstate), and campaigns raise demand for checking (Kirk 2025).
 * Weekday, payday, football and holiday patterns have no library evidence.
 */
import type { CalendarDate, Season } from '../sim/calendar';
import { dayOf } from '../sim/calendar';
import { t } from '../i18n';

export type PopulationId =
  | 'residents' | 'dogWalkers' | 'commuters' | 'diners' | 'workers' | 'clubbers'
  | 'students' | 'tourists' | 'fans';

export type Permanence = 'permanent' | 'temporary' | 'wave';

export interface Population {
  id: PopulationId;
  label: string;
  permanence: Permanence;
  /** Base weight among passers-by. */
  weight: number;
  /** Weight by hour band of the day, on the running clock (06:00 is 30 h, 18:00 is 42 h): [from, to) minutes and multiplier. */
  hours: readonly [number, number, number][];
  /** Multiplier Monday to Sunday. */
  weekdays: readonly number[];
  seasons: Record<Season, number>;
  /** Extra multiplier on particular dates (term, holidays, match nights). */
  special?: (d: CalendarDate) => number;
  /** How strongly this population feeds the club queue (0 none). */
  clubPull: number;
}

const H = 60;
const all = (v: number): Record<Season, number> => ({ winter: v, spring: v, summer: v, autumn: v });
const between = (d: CalendarDate, from: number, to: number) => d.dayOfYear >= from && d.dayOfYear <= to;

/** University term: late September to mid June, minus winter and spring breaks. */
export const inTerm = (d: CalendarDate) =>
  (between(d, dayOf(8, 20), 364) || between(d, 0, dayOf(5, 15))) && !between(d, dayOf(11, 18), 364) && !between(d, 0, dayOf(0, 6)) && !between(d, dayOf(3, 1), dayOf(3, 14));
/** Football season: August to May. */
export const footballSeason = (d: CalendarDate) => d.month >= 7 || d.month <= 4;
/** Last Friday or Saturday of the month: payday weekend. */
export const paydayWeekend = (d: CalendarDate) => (d.weekday === 4 || d.weekday === 5) && d.day > [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][d.month] - 7;

export const POPULATIONS: readonly Population[] = [
  {
    id: 'residents', label: t('Residents'), permanence: 'permanent', weight: 1.0, clubPull: 0,
    hours: [[18 * H, 21 * H, 1.3], [21 * H, 24 * H, 0.7], [24 * H, 30 * H, 0.15], [30 * H, 33 * H, 0.8], [33 * H, 42 * H, 1.4]],
    weekdays: [1, 1, 1, 1, 1, 1.1, 1.1], seasons: { winter: 0.7, spring: 1, summer: 1.3, autumn: 0.9 },
  },
  {
    id: 'dogWalkers', label: t('Dog walkers'), permanence: 'permanent', weight: 0.35, clubPull: 0,
    hours: [[18 * H, 20.5 * H, 1.4], [22 * H, 23.5 * H, 0.8], [29 * H, 31.5 * H, 1.4], [36 * H, 38 * H, 0.8]],
    weekdays: [1, 1, 1, 1, 1, 1, 1], seasons: all(1),
  },
  {
    id: 'commuters', label: t('Commuters'), permanence: 'permanent', weight: 0.9, clubPull: 0,
    hours: [[18 * H, 20 * H, 1.6], [20 * H, 22 * H, 0.4], [29 * H, 30 * H, 0.8], [30.5 * H, 33.5 * H, 2.6], [33.5 * H, 40 * H, 0.5], [40 * H, 42 * H, 2.2]],
    weekdays: [1, 1, 1, 1, 0.9, 0.3, 0.2], seasons: { winter: 1, spring: 1, summer: 0.8, autumn: 1 },
  },
  {
    id: 'diners', label: t('Diners'), permanence: 'permanent', weight: 0.6, clubPull: 0.1,
    hours: [[19 * H, 23 * H, 1.3], [36 * H, 38.5 * H, 1.6]],
    weekdays: [0.6, 0.7, 0.8, 1, 1.4, 1.5, 1.1], seasons: { winter: 0.8, spring: 1, summer: 1.4, autumn: 0.9 },
  },
  {
    id: 'workers', label: t('Night and early-shift workers'), permanence: 'permanent', weight: 0.5, clubPull: 0,
    hours: [[22 * H, 24 * H, 0.6], [27 * H, 30 * H, 1.6], [30 * H, 42 * H, 0.9]],
    weekdays: [1, 1, 1, 1, 1, 0.8, 0.6], seasons: all(1),
  },
  {
    id: 'clubbers', label: t('Clubbers'), permanence: 'permanent', weight: 0.8, clubPull: 1,
    hours: [[21 * H, 23 * H, 0.8], [23 * H, 27 * H, 1.6], [27 * H, 29 * H, 0.8]],
    weekdays: [0.4, 0.4, 0.6, 1, 1.6, 1.8, 0.6], seasons: { winter: 0.9, spring: 1, summer: 1.2, autumn: 1 },
    special: (d) => (paydayWeekend(d) ? 1.3 : 1),
  },
  {
    id: 'students', label: t('Students'), permanence: 'temporary', weight: 0.7, clubPull: 0.8,
    hours: [[20 * H, 23 * H, 1.2], [23 * H, 27 * H, 1.3], [32 * H, 41 * H, 1.1]],
    weekdays: [1.1, 1.0, 1.3, 1.4, 1.0, 0.9, 0.6], seasons: all(1),
    special: (d) => (!inTerm(d) ? 0.15 : between(d, dayOf(8, 20), dayOf(8, 27)) ? 4 : 1),
  },
  {
    id: 'tourists', label: t('Tourists'), permanence: 'temporary', weight: 0.4, clubPull: 0.4,
    hours: [[18 * H, 23 * H, 1.3], [23 * H, 26 * H, 0.7], [33 * H, 42 * H, 1.6]],
    weekdays: [0.8, 0.8, 0.8, 0.9, 1.2, 1.4, 1.1], seasons: { winter: 0.4, spring: 0.9, summer: 2.2, autumn: 0.8 },
    // Christmas markets in December.
    special: (d) => (between(d, dayOf(11, 1), dayOf(11, 23)) ? 3 : 1),
  },
  {
    id: 'fans', label: t('Football fans'), permanence: 'wave', weight: 0, clubPull: 0.2,
    hours: [[18.5 * H, 20 * H, 1.5], [22 * H, 24 * H, 1.5]],
    weekdays: [1, 1, 1, 1, 1, 1, 1], seasons: all(1),
    // Match nights: Wednesdays and Saturdays in the season.
    special: (d) => (footballSeason(d) && (d.weekday === 2 || d.weekday === 5) ? 1.2 : 0),
  },
];

export const POPULATION_BY_ID = Object.fromEntries(POPULATIONS.map((p) => [p.id, p])) as Record<PopulationId, Population>;

/** Weight of a population at this clock time and date. */
export function presence(p: Population, clock: number, d: CalendarDate): number {
  const band = p.hours.find(([from, to]) => clock >= from && clock < to);
  if (!band) return 0;
  return p.weight * band[2] * p.weekdays[d.weekday] * p.seasons[d.season] * (p.special?.(d) ?? 1);
}

/** Calendar waves: dated happenings that start an event in the feed for a window of the night. */
export interface CalendarWave {
  event: 'newYearsEve' | 'freshersWeek' | 'matchNight' | 'halloween' | 'paydayWeekend' | 'prideNight' | 'christmasMarket';
  when: (d: CalendarDate) => boolean;
  /** Clock minutes the wave starts and ends tonight. */
  from: number;
  to: number;
}

export const CALENDAR_WAVES: readonly CalendarWave[] = [
  { event: 'newYearsEve', when: (d) => d.month === 11 && d.day === 31, from: 21 * H, to: 29 * H },
  { event: 'freshersWeek', when: (d) => between(d, dayOf(8, 20), dayOf(8, 27)), from: 20 * H, to: 28 * H },
  { event: 'matchNight', when: (d) => footballSeason(d) && (d.weekday === 2 || d.weekday === 5), from: 18.5 * H, to: 24 * H },
  { event: 'halloween', when: (d) => d.month === 9 && d.day === 31, from: 19 * H, to: 28 * H },
  { event: 'paydayWeekend', when: paydayWeekend, from: 21 * H, to: 28 * H },
  // Pride: the last Saturday of June.
  { event: 'prideNight', when: (d) => d.month === 5 && d.weekday === 5 && d.day > 23, from: 18 * H, to: 28 * H },
  { event: 'christmasMarket', when: (d) => between(d, dayOf(11, 1), dayOf(11, 23)), from: 18 * H, to: 22 * H },
];

/** Seasonal multipliers on how often random events start. */
export const SEASONAL_EVENT_RATE: Partial<Record<string, Record<Season, number>>> = {
  musicFestival: { winter: 0, spring: 0.8, summer: 3, autumn: 0.5 },
  popUpParty: { winter: 0.3, spring: 1, summer: 2.5, autumn: 0.8 },
  coldNight: { winter: 3, spring: 0.6, summer: 0, autumn: 1.2 },
  withdrawalWave: all(1),
};
