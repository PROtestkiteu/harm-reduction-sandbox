import type { ServiceId } from '../sim/types';
import { t } from '../i18n';

/**
 * What a service spends its visits on: drug checking, clean needles and
 * syringes, naloxone and first aid, counselling and referrals, basics (food,
 * drinks, warmth). Each place sets a weight per activity; the shares change
 * what a visit costs, how long it takes, and what it does.
 *
 * ILLUSTRATIVE: the directions follow the panels' cited research (checking
 * informs people, kits cut injecting harm, naloxone saves overdoses); the
 * sizes are placeholders for play.
 */
export type Activity = 'checking' | 'needles' | 'naloxone' | 'counselling' | 'basics';

export interface ActivityInfo {
  label: string;
  short: string;
  /** Money per visit, relative to the place's usual visit cost, when it is all a place does. */
  cost: number;
  /** Time per visit, relative to the usual, when it is all a place does. */
  time: number;
  /** One line on what more of it does. */
  does: string;
  /** Paid once per place before it can be offered there (equipment, training). */
  setup?: number;
}

export const ACTIVITY: Record<Activity, ActivityInfo> = {
  checking: { label: t('Drug checking'), short: t('Checking'), cost: 1.8, time: 1.6, does: t('More substances checked: people learn what is in them.'), setup: 400 },
  needles: { label: t('Clean needles and syringes'), short: t('Needles'), cost: 1.0, time: 0.7, does: t('More people who inject leave with sterile kits.') },
  naloxone: { label: t('Naloxone and first aid'), short: t('Naloxone'), cost: 1.2, time: 0.9, does: t('Staff reach more overdoses in time.') },
  counselling: { label: t('Counselling and referrals'), short: t('Counselling'), cost: 0.7, time: 2.0, does: t('A better name with funders and neighbours; long talks.') },
  basics: { label: t('Food, drinks and warmth'), short: t('Basics'), cost: 1.1, time: 1.0, does: t('Fewer people harmed by cold or heat.') },
};

/** What each place can offer, in menu order. */
export const SERVICE_ACTIVITIES: Record<ServiceId, readonly Activity[]> = {
  dropIn: ['counselling', 'needles', 'naloxone', 'basics', 'checking'],
  outreach: ['needles', 'naloxone', 'checking', 'counselling', 'basics'],
  clubHr: ['checking', 'naloxone', 'counselling', 'basics'],
  pharmacy: ['needles', 'naloxone', 'counselling'],
  drugChecking: ['checking', 'counselling'],
  shelter: ['basics', 'counselling', 'naloxone'],
  clinic: ['counselling', 'naloxone', 'needles'],
};

/** Places where checking is part of the service from the start: no set-up to pay. */
export const CHECKING_BUILT_IN: readonly ServiceId[] = ['drugChecking', 'clubHr'];

/** Slider steps per activity: 0 (none) to 10. */
export const MIX_MAX = 10;
export const MIX_DEFAULT = 5;
