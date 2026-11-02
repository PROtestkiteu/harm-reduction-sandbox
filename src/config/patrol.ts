import type { StressMeter } from '../sim/cityStress';
import { t } from '../i18n';

/**
 * Sending the foot patrol out: the streetworkers leave their table and walk
 * to where they are needed, for a few hours, then come back. Out there they
 * reach people the doors never see, hand out kits and leaflets, and take some
 * weight off the city's services where they are. ILLUSTRATIVE numbers, tuned
 * with the strategy bots (scripts/bots).
 */
export type PatrolSpot = 'camp' | 'party' | 'busiest' | 'club' | 'daemon';

export interface PatrolSpotInfo {
  label: string;
  /** Who they find there, for the panel. */
  does: string;
  /** People reached per worker per clock hour there. */
  contacts: number;
  /** Load taken off the city's meters per clock hour while there. */
  eases: Partial<Record<StressMeter, number>>;
}

export const PATROL = {
  /** Clock hours out before the patrol walks back to its table. */
  hours: 3,
  /** Kit and bus fare for a round (money). */
  cost: 15,
  /** Energy each worker spends on the walk out. */
  walk: 0.08,
  /** Extra chance outreach reaches someone using alone in time while the patrol is out. */
  reach: 0.15,
  spots: {
    camp: { label: t('the tent camp in the park'), does: t('People sleeping out: kits, naloxone, a warm drink, a word about the shelter.'), contacts: 2.2, eases: { medics: 0.02 } },
    party: { label: t('the party in the park'), does: t('Water, earplugs, test strips and an eye on anyone in trouble.'), contacts: 2.6, eases: { medics: 0.02, sobering: 0.03 } },
    busiest: { label: t('the longest queue'), does: t('People about to give up waiting: a kit and advice on the spot instead of nothing.'), contacts: 2, eases: { police: 0.015 } },
    club: { label: t('outside the club'), does: t('People leaving the club late: water, a seat, a lift home called.'), contacts: 1.8, eases: { sobering: 0.03, police: 0.01 } },
    daemon: { label: t('the person in crisis'), does: t('Two streetworkers walk up slowly and talk; it often works better than any siren.'), contacts: 0.6, eases: { police: 0.02 } },
  } satisfies Record<PatrolSpot, PatrolSpotInfo>,
} as const;

export const PATROL_SPOTS = Object.keys(PATROL.spots) as PatrolSpot[];
