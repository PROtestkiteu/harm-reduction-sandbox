/**
 * Sandbox parameter schema: every slider the controls panel shows, with its
 * range, default and readout. Defaults come from `illustrative.ts`, so all
 * values stay illustrative placeholders. Pure data plus URL helpers; the
 * simulation applies values (`Simulation.configure`) and the panel renders them.
 *
 * To add a lever: add an entry here, then handle its id in `Simulation.configure`.
 */
import type { ServiceId } from '../sim/types';
import { formatClock } from '../sim/clock';
import { Calendar, dayOf, formatDate } from '../sim/calendar';
import { ILLUSTRATIVE } from './illustrative';
import { ORG } from './organisation';
import { LOCALE, plural, t } from '../i18n';

export type ParamGroup = 'org' | 'night' | 'demand' | ServiceId;

export const PARAM_GROUPS: readonly { id: ParamGroup; label: string }[] = [
  { id: 'org', label: t('Budget') },
  { id: 'night', label: t('Night and season') },
  { id: 'demand', label: t('Street and venue') },
  { id: 'dropIn', label: t('Drop-in centre') },
  { id: 'outreach', label: t('Mobile outreach') },
  { id: 'clubHr', label: t('Club harm reduction stand') },
];

export interface ParamDef {
  id: string;
  group: ParamGroup;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  format(v: number): string;
  /** Short explanation for screen readers and the tooltip. */
  hint: string;
}

const S = ILLUSTRATIVE.services;
const fixed = (v: number, digits: number) => v.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
const perMin = (v: number) => t('{v} / min', { v: fixed(v, 1) });
const count = (v: number) => String(Math.round(v));
const seconds = (v: number) => `${Math.round(v)} s`;

const serviceParams = (id: ServiceId, staffMax: number, waitingMax: number, patience: [number, number]) =>
  [
    {
      id: `${id}.staff`, group: id, label: t('Staff wanted'), min: 1, max: staffMax, step: 1, default: S[id].staff, format: count,
      hint: t('How many people this service asks for. The organisation fills it from paid staff, then volunteers; if the pool is short, fewer turn up.'),
    },
    {
      id: `${id}.waiting`, group: id, label: t('Waiting places'), min: 0, max: waitingMax, step: 1, default: S[id].waitingSlots, format: count,
      hint: t('Seats or queue spots. When they are full, new arrivals cannot wait and their need goes unmet.'),
    },
    {
      id: `${id}.patience`, group: id, label: t('Visitor patience'), min: patience[0], max: patience[1], step: 5, default: S[id].patienceSeconds, format: seconds,
      hint: t('How long a person waits before leaving unserved.'),
    },
  ] as const;

export const PARAMS = [
  {
    id: 'orgBudget', group: 'org', label: t('Budget now'), min: 0, max: 10000, step: 50, default: ORG.startBudget,
    format: (v: number) => `● ${Math.round(v).toLocaleString(LOCALE)}`,
    hint: t('Money in sandbox units. Follows the night live; dragging sets it. Wages, kits, analyses and naloxone draw it down; funding refills it.'),
  },
  {
    id: 'clock', group: 'night', label: t('Time of day'), min: 18 * 60, max: 42 * 60 - 5, step: 5, default: ILLUSTRATIVE.clockStartMinutes, format: formatClock,
    hint: t('Jumps the scene clock, from the evening round the night and through the next day. Light, people and services follow the hour.'),
  },
  {
    id: 'date', group: 'night', label: t('Date'), min: 1, max: 365, step: 1, default: dayOf(9, 15) + 1,
    format: (v: number) => formatDate(new Calendar(v - 1).date),
    hint: t('Tonight\'s date: weekday, season and special nights (match nights, Freshers, Pride, Christmas, New Year\'s Eve). Moves on each time the night loops.'),
  },
  {
    id: 'calendarPace', group: 'night', label: t('Calendar pace'), min: 1, max: 30, step: 1, default: 1,
    format: (v: number) => plural(v, ['{n} day per night', '{n} days per night'], ['{n} dzień na noc', '{n} dni na noc', '{n} dni na noc']),
    hint: t('How far the calendar moves each time the night loops, so seasons can pass in a sitting.'),
  },
  {
    id: 'dayCycle', group: 'night', label: t('Day and night'), min: 0, max: 1, step: 1, default: 1,
    format: (v: number) => (v ? t('Running') : t('Held')),
    hint: t('Let the hours run, or hold the time of day where it is. People keep moving either way.'),
  },
  {
    id: 'clockSpeed', group: 'night', label: t('Clock speed'), min: 0.25, max: 6, step: 0.25, default: ILLUSTRATIVE.clockMinutesPerSecond,
    format: (v: number) => t('{v} clock min / s', { v: fixed(v, 2) }),
    hint: t('Clock minutes per real second at 1x. People on the street keep pace with the clock.'),
  },
  {
    id: 'passersby', group: 'demand', label: t('Passers-by'), min: 0, max: 10, step: 0.2, default: ILLUSTRATIVE.passersbyPerMinute, format: perMin,
    hint: t('People walking through to somewhere else.'),
  },
  {
    id: 'cars', group: 'demand', label: t('Traffic'), min: 0, max: 20, step: 0.2, default: ILLUSTRATIVE.carsPerMinute, format: perMin,
    hint: t('Cars along the one-way street. Cars stop for people on the crossing.'),
  },
  {
    id: 'clubArrivals', group: 'demand', label: t('Club arrivals'), min: 0, max: 12, step: 0.2, default: ILLUSTRATIVE.club.arrivalsPerMinute, format: perMin,
    hint: t('People heading to the music club.'),
  },
  {
    id: 'venueCapacity', group: 'demand', label: t('Venue capacity'), min: 20, max: 300, step: 5, default: ILLUSTRATIVE.club.capacity, format: count,
    hint: t('When the club is full the door stops letting people in and the door queue grows.'),
  },
  {
    id: 'eventFrequency', group: 'demand', label: t('Random events'), min: 0, max: 3, step: 0.25, default: 1,
    format: (v: number) => (v === 0 ? t('Off') : `${fixed(v, 2)}x`),
    hint: t('How often random events start: supply shocks, health events, challenges people face, and services falling short. Off still allows manual triggers.'),
  },
  {
    id: 'dropIn.demand', group: 'dropIn', label: t('People seeking it'), min: 0, max: 10, step: 0.2, default: S.dropIn.demandPerMinute, format: perMin,
    hint: t('Demand: people per minute who set out for the drop-in centre.'),
  },
  ...serviceParams('dropIn', 5, 8, [10, 240]),
  {
    id: 'outreach.demand', group: 'outreach', label: t('People seeking it'), min: 0, max: 8, step: 0.2, default: S.outreach.demandPerMinute, format: perMin,
    hint: t('Demand: people per minute who set out for the outreach camper.'),
  },
  ...serviceParams('outreach', 4, 8, [10, 180]),
  {
    id: 'clubHr.interest', group: 'clubHr', label: t('Club-goers stopping by'), min: 0, max: 1, step: 0.05, default: ILLUSTRATIVE.club.standInterest,
    format: (v: number) => `${Math.round(v * 100)} %`,
    hint: t('Demand: share of club arrivals who look for the stand on the way in.'),
  },
  ...serviceParams('clubHr', 3, 4, [5, 90]),
] as const satisfies readonly ParamDef[];

export type ParamId = (typeof PARAMS)[number]['id'];
export type SandboxSettings = Record<ParamId, number>;

export const PARAM_BY_ID = Object.fromEntries(PARAMS.map((p) => [p.id, p])) as Record<ParamId, ParamDef>;

export function defaultSettings(): SandboxSettings {
  return Object.fromEntries(PARAMS.map((p) => [p.id, p.default])) as SandboxSettings;
}

/** Clamps to the range and snaps to the step, so URL or input values are always valid. */
export function normalize(id: ParamId, value: number): number {
  const p = PARAM_BY_ID[id];
  const snapped = p.min + Math.round((value - p.min) / p.step) * p.step;
  return Math.min(p.max, Math.max(p.min, Number(snapped.toFixed(4))));
}

/** `?set=cars:4,dropIn.staff:3` lists only values that differ from the defaults. */
export function encodeSettings(s: SandboxSettings): string {
  return PARAMS.filter((p) => s[p.id] !== p.default).map((p) => `${p.id}:${s[p.id]}`).join(',');
}

export function decodeSettings(text: string | null): Partial<SandboxSettings> {
  const out: Partial<SandboxSettings> = {};
  for (const pair of (text ?? '').split(',')) {
    const [id, raw] = pair.split(':');
    const value = Number(raw);
    if (id in PARAM_BY_ID && raw !== undefined && Number.isFinite(value)) out[id as ParamId] = normalize(id as ParamId, value);
  }
  return out;
}
