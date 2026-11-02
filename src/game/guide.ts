import type { Need } from '../config/needs';
import { SERVICE_TEXT } from '../config/places';
import type { GoalResult } from '../sim/goals';
import type { LocationId, ServiceId } from '../sim/types';
import { t } from '../i18n';

/**
 * Your next step, as the coordinator would put it to themself: one plain
 * sentence and, where there is one, the reply that does it. Like the advisor
 * line in Two Point Hospital or Frostpunk, it reads the state and names the
 * most pressing thing, so a player who has selected nothing always has a lead.
 * Pure: reads a small view of the game, changes nothing.
 */
export type GuideAct =
  | { kind: 'place'; id: LocationId }
  | { kind: 'org' }
  | { kind: 'services' }
  | { kind: 'meter'; need: Need };

export interface GuideStep {
  /** Stable per kind of advice, so the panel updates text only when it changes. */
  id: string;
  said: string;
  act?: GuideAct & { label: string; short: string };
  /** Something is going wrong now: the line is shown in the alert colour. */
  urgent?: boolean;
}

export interface GuideView {
  budget: number;
  /** Income less running costs and wages, per game hour. */
  netPerHour: number;
  /** Shut for lack of money, waiting for a relaunch. */
  closedDown: readonly ServiceId[];
  /** City meters in the red, worst first; the place adding most to each, if a place does. */
  red: readonly { need: Need; place?: LocationId }[];
  /** The longest queue now, against its waiting places. */
  busiest: { service: ServiceId; queue: number; room: number };
  goals: readonly GoalResult[];
  /** Minutes since 20:00 tonight (the night runs to 08:00, 720 minutes); 0 in the daytime. */
  nightMinutes: number;
  /** Nights survived so far. */
  nights: number;
  /** A worker worn out on automatic placement, by name. */
  tired: string | null;
  trust: 'wary' | 'usual' | 'confident';
  /** Services not open that could be switched on, and the cheapest way in. */
  canOpenMore: boolean;
  /** A place's name as the player sees it (they may have renamed it). */
  placeName(id: LocationId): string;
  /** First steps the player has taken (kept per viewer). */
  tried: { place: boolean; person: boolean; org: boolean };
}

export const locationOf = (s: ServiceId): LocationId => (s === 'clubHr' ? 'club' : s);

const METER: Record<Need, string> = {
  police: t('The police are under pressure.'),
  medics: t('The medics are under pressure.'),
  sobering: t('The sobering-up service is overrun.'),
  district: t('The district is going downhill.'),
};

/** The most pressing step first; the first rule that applies is the one shown. */
export function nextStep(v: GuideView): GuideStep {
  const placeAct = (id: LocationId, label: string, short: string) => ({ kind: 'place' as const, id, label, short });
  const orgAct = { kind: 'org' as const, label: t('Open My organisation: team, money and grants.'), short: t('My organisation.') };

  if (v.budget < 0) {
    return { id: 'broke', urgent: true, said: t('We are out of money. A donation drive or a grant can keep the doors open.'), act: orgAct };
  }
  if (v.closedDown.length) {
    const s = v.closedDown[0];
    return { id: `closed:${s}`, urgent: true, said: t('{place} shut down for lack of money. Relaunch it once we can afford it.', { place: SERVICE_TEXT[s].label }), act: placeAct(locationOf(s), t('Go to {place}.', { place: v.placeName(locationOf(s)) }), t('Go there.')) };
  }
  if (v.netPerHour < 0 && v.budget < -v.netPerHour * 4) {
    return { id: 'short', urgent: true, said: t('Money runs out in about {h} hours at this rate. Raise some, or trim a shift.', { h: Math.max(1, Math.floor(v.budget / -v.netPerHour)) }), act: orgAct };
  }
  const red = v.red[0];
  if (red) {
    const act = red.place
      ? placeAct(red.place, t('Go to {place}, where it comes from.', { place: v.placeName(red.place) }), t('Go there.'))
      : { kind: 'meter' as const, need: red.need, label: t('See what is pushing it.'), short: t('Why?') };
    return { id: `red:${red.need}:${red.place ?? ''}`, urgent: true, said: METER[red.need], act };
  }
  // The first night: the three things every player needs to have tried once.
  if (v.nights === 0) {
    if (!v.tried.place) return { id: 'try:place', said: t('First, look at the drop-in centre: who is waiting, and who is on shift.'), act: placeAct('dropIn', t('Go to the drop-in centre.'), t('Drop-in.')) };
    if (!v.tried.person) return { id: 'try:person', said: t('Tap someone on the street to see who they are and what they need.') };
    if (!v.tried.org) return { id: 'try:org', said: t('Our team, money and grants are under My organisation.'), act: orgAct };
  }
  const { service, queue, room } = v.busiest;
  if (room > 0 && queue >= Math.max(3, room * 0.75)) {
    const id = locationOf(service);
    return { id: `queue:${service}`, said: t('The queue at {place} is nearly full: {n} waiting. One more on shift there would help.', { place: v.placeName(id), n: queue }), act: placeAct(id, t('Go to {place}.', { place: v.placeName(id) }), t('Go there.')) };
  }
  if (v.tired) return { id: 'tired', said: t('{name} is worn out. Give them a rest under Your team.', { name: v.tired }), act: orgAct };
  if (v.trust === 'wary') return { id: 'wary', said: t('The funders are wary: they want to see more people helped. Keep the services open and staffed.'), act: { kind: 'services', label: t('Review the services.'), short: t('Services.') } };
  const helped = v.goals.find((g) => g.id === 'helped');
  // Behind tonight's pace: fewer helped than an even share of the night would give.
  if (helped && !helped.met && v.nightMinutes > 120 && helped.value < helped.target * (v.nightMinutes / 720) * 0.8) {
    return { id: 'goal', said: t('Tonight we are behind: {n} more to help to meet the goal. Open places help most where people already queue.', { n: helped.target - helped.value }) };
  }
  if (v.canOpenMore && v.netPerHour > 0) {
    return { id: 'grow', said: t('Money is coming in steadily. We could open another service.'), act: { kind: 'services', label: t('Review the services.'), short: t('Services.') } };
  }
  return { id: 'calm', said: t('All steady for now. Watch the street, or speed up the clock.') };
}
