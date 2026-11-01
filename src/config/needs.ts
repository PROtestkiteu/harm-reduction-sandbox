import { STRESS } from '../sim/cityStress';
import type { ServiceId } from '../sim/types';
import type { CamperPath } from './camperPaths';
import type { Activity } from './serviceMix';
import type { InstitutionId } from './institutionQuests';

/**
 * The city's needs a spend eases, matching the meters at the top: police,
 * medics, the sobering-up centre and how the district is doing. Each list is
 * ordered by how much it helps, so the first icon is the main one.
 */
export type Need = 'police' | 'medics' | 'sobering' | 'district';

/** More room at a service eases whatever its turned-away people would have needed (the stress weights). */
export function serviceNeeds(service: ServiceId): Need[] {
  const w: Partial<Record<Need, number>> = STRESS.turnedAway[service];
  return (Object.keys(w) as Need[]).sort((a, b) => (w[b] ?? 0) - (w[a] ?? 0));
}

/** Checking and street health reach overdoses sooner; general support shrinks the camp and wins the neighbours. */
export const PATH_NEEDS: Record<CamperPath, Need[]> = {
  nightlife: ['medics'],
  health: ['medics'],
  social: ['police', 'district'],
};

/** An allied institution: police by agreement, a backing council, A&E and the izba working with you. */
export const QUEST_NEEDS: Record<InstitutionId, Need[]> = {
  police: ['police'],
  cityHall: ['district'],
  hospital: ['medics'],
  sobering: ['sobering'],
};

/**
 * What each budget-mix activity eases: checking, test kits, needles, naloxone and food and warmth
 * keep people out of ambulances and A&E; counselling wins funders and neighbours over.
 */
export const ACTIVITY_NEEDS: Record<Activity, Need[]> = {
  checking: ['medics'],
  kits: ['medics'],
  needles: ['medics'],
  naloxone: ['medics'],
  counselling: ['district'],
  basics: ['medics'],
};

/** A partnered venue keeps water and info at the bar: fewer people end up in the izba. */
export const PARTNER_NEEDS: Need[] = ['sobering'];

/** The warming bus or water and shade: fewer people harmed outdoors. */
export const AID_NEEDS: Need[] = ['medics'];
