import { t } from '../i18n';

/**
 * What the outreach camper specialises in. One at a time; choosing (or changing)
 * pays for the kit and training. ILLUSTRATIVE effects, placeholders for play.
 */
export type CamperPath = 'nightlife' | 'health' | 'social';
export const CAMPER_PATH_IDS: readonly CamperPath[] = ['nightlife', 'health', 'social'];

export const CAMPER_PATH: Record<CamperPath, { label: string; short: string; does: string; cost: number }> = {
  nightlife: {
    label: t('Drug checking'),
    short: t('Drug checking'),
    does: t('Checking and test kits on board: more people come by, and more of them find out what is in their drugs.'),
    cost: 300,
  },
  health: {
    label: t('Injections and infections'),
    short: t('Safer injecting'),
    does: t('Sterile kits, wound care and overdose response: staff reach more people using alone, and kits cost less.'),
    cost: 350,
  },
  social: {
    label: t('General support'),
    short: t('General support'),
    does: t('Counselling, food and referrals to housing: the camps shrink faster and funders and neighbours think better of you.'),
    cost: 250,
  },
};

export const CAMPER_PATH_EFFECT = {
  /** Nightlife: outreach demand, checking and kits at the camper. */
  nightlifeDemand: 1.2,
  nightlifeChecking: 2,
  nightlifeKits: 1.5,
  /** Street health: more overdoses in hidden spots reached; kits cheaper. */
  healthReach: 0.15,
  healthKitCost: 0.7,
  /** Housing and referrals: extra camp shrinking per clock hour; reputation. */
  socialCampShrink: 0.02,
  socialReputation: 1.05,
} as const;
