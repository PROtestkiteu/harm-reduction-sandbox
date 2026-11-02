import type { GrantId } from './organisation';
import { t } from '../i18n';

/**
 * The project's standing: its name in the city, earned one person at a time.
 * Every person helped adds to it, every person turned away and every death
 * takes from it. Its tiers decide how often people give and how much, which
 * grants will take an application seriously, and what the project can take
 * on next (a rented shop, a point, a partner venue, a second camper).
 * ILLUSTRATIVE numbers, tuned with the strategy bots (scripts/bots).
 */
export const STANDING = {
  /** Points per person helped, and extra when their need met the right skill. */
  helped: 1,
  matched: 0.5,
  /** Points lost per person turned away, per overdose nobody reached in time, per death. */
  turnedAway: 0.25,
  overdoseAlone: 0.25,
  death: 8,
  /** Points needed for each tier (index is the tier). */
  tiers: [0, 30, 90, 200, 400] as readonly number[],
  /** A tier is lost only this many points below where it starts, so it does not flap. */
  slack: 25,
  /** Donation boxes and drives bring in this much against the usual, by tier. */
  giving: [0.8, 1, 1.2, 1.4, 1.6] as readonly number[],
  /** Chance per clock hour that someone walks in with a gift, by tier, and its size range. */
  giftsPerHour: [0, 0.04, 0.08, 0.12, 0.16] as readonly number[],
  gift: { min: 60, max: 220 },
} as const;

export const TIER_NAMES: readonly string[] = [t('Unknown'), t('Known locally'), t('Trusted'), t('Respected'), t('Renowned')];

/** The tier a grant needs before funders read the application. Not listed: any tier. */
export const GRANT_TIER: Partial<Record<GrantId, number>> = {
  councilGrant: 1,
  equipmentFund: 1,
  schoolsProject: 2,
  checkingLicence: 2,
  nationalProgramme: 3,
};

/** What a tier opens up. */
export type Unlock = 'rentUnit' | 'openPoint' | 'partnerVenue' | 'extraCamper';
export const UNLOCK_TIER: Record<Unlock, number> = { rentUnit: 1, openPoint: 2, partnerVenue: 2, extraCamper: 3 };
export const UNLOCK_NAMES: Record<Unlock, string> = { rentUnit: t('renting an empty shop'), openPoint: t('opening harm reduction points'), partnerVenue: t('venue partnerships'), extraCamper: t('a second outreach camper') };
