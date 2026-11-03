import type { CalendarDate } from '../sim/calendar';
import { footballSeason } from './populations';
import { t } from '../i18n';

/**
 * Regular happenings with a place of their own beyond the district: summer
 * festival weekends at the festival grounds in the big park, home matches at
 * the football stadium, and the university's weekends off in term time. Each
 * has a timetable (people arriving, the thing itself, people leaving) and
 * what it brings to the district while it lasts. The world draws the grounds,
 * the stadium and the crowds from `sim.happenings()`. ILLUSTRATIVE sizes and
 * dates; no library evidence for calendar patterns (see config/populations).
 */
export type HappeningId = 'festival' | 'match' | 'uniWeekend';

export interface HappeningInfo {
  label: string;
  /** Tonight's date has one. */
  when: (d: CalendarDate) => boolean;
  /** Clock minutes (counted from 18:00, so 02:00 is 26 * 60): arrivals start, it begins, it ends, the last leave. */
  arrive: number;
  start: number;
  end: number;
  leave: number;
  /** While on (and arriving or leaving, at half): people out against the usual, by flow. */
  demand: Partial<Record<'passerby' | 'club' | 'clubHr' | 'drugChecking', number>>;
  /** Load per clock hour on the city's services at full crowd. */
  load: Partial<Record<'police' | 'medics' | 'sobering', number>>;
  /** One notice as it begins. */
  begins: string;
}

const H = 60;
/** Week of the year (0 to 52). */
const week = (d: CalendarDate) => Math.floor(d.dayOfYear / 7);
/** University term: October to January and March to June. */
const term = (d: CalendarDate) => d.month >= 9 || d.month === 0 || (d.month >= 2 && d.month <= 5);

export const HAPPENINGS: Record<HappeningId, HappeningInfo> = {
  festival: {
    label: t('Festival weekend at the festival grounds'),
    // Every third weekend from June to August, Friday and Saturday.
    when: (d) => d.month >= 5 && d.month <= 7 && week(d) % 3 === 0 && (d.weekday === 4 || d.weekday === 5),
    arrive: 18 * H, start: 19.5 * H, end: 25 * H, leave: 26.5 * H,
    demand: { passerby: 1.5, club: 1.3, drugChecking: 1.8, clubHr: 1.4 },
    load: { medics: 0.05, sobering: 0.04, police: 0.02 },
    begins: t('A festival is on at the grounds in the big park: thousands pass through the district tonight, and drug checking and the stand will be in demand.'),
  },
  match: {
    label: t('Home match at the stadium'),
    // Home games: Saturdays and every other Wednesday in the season.
    when: (d) => footballSeason(d) && (d.weekday === 5 || (d.weekday === 2 && week(d) % 2 === 0)),
    arrive: 18.5 * H, start: 19.5 * H, end: 21.5 * H, leave: 23.5 * H,
    demand: { passerby: 1.4, club: 1.1 },
    load: { police: 0.07, medics: 0.03, sobering: 0.03 },
    begins: t('Home match tonight: fans and a few groups of hooligans walk through the district to the stadium, and back after the final whistle.'),
  },
  uniWeekend: {
    label: t('University weekend off'),
    // Term-time Friday and Saturday nights.
    when: (d) => term(d) && (d.weekday === 4 || d.weekday === 5),
    arrive: 21 * H, start: 22 * H, end: 26 * H, leave: 27.5 * H,
    demand: { passerby: 1.25, club: 1.4, clubHr: 1.3 },
    load: { sobering: 0.05, medics: 0.015 },
    begins: t('A university weekend off: students fill the bars and the club, and spill onto the pavements late.'),
  },
};

export const HAPPENING_IDS = Object.keys(HAPPENINGS) as HappeningId[];
