/**
 * Favours with city hall: the organisation holds at most one. Using it gets
 * something done now; city hall then asks for a concession some hours later,
 * and only agreeing to it earns the next favour. ILLUSTRATIVE.
 */
import { t } from '../i18n';
export type FavourId = 'funding' | 'police' | 'camp';

export const FAVOURS: Record<FavourId, { label: string; done: string }> = {
  funding: { label: t('Emergency funding (+300 now)'), done: t('City hall found 300 in an emergency fund.') },
  police: { label: t('Police keep their distance for 12 hours'), done: t('Police will keep away from the services for the next 12 hours.') },
  camp: { label: t('No clearing of the park camp for two days'), done: t('City hall will not clear the park camp for two days.') },
};

export type ConcessionId = 'postedOfficer' | 'cleanUp' | 'camperOff';

/** What city hall asks for in return. */
export const CONCESSIONS: Record<ConcessionId, { title: string; ask: string; agree: string }> = {
  postedOfficer: {
    title: t('City hall asks a favour back'),
    ask: t('The mayor wants to be seen to be tough: an officer posted by the services for 12 hours.'),
    agree: t('An officer is posted by the services for 12 hours.'),
  },
  cleanUp: {
    title: t('City hall asks a favour back'),
    ask: t('The council wants the project to pay for a street clean-up round the services (120).'),
    agree: t('You paid for the clean-up.'),
  },
  camperOff: {
    title: t('City hall asks a favour back'),
    ask: t('A councillor wants the outreach camper off the street for 6 hours during a visit.'),
    agree: t('The camper is off the street for 6 hours.'),
  },
};

export const FAVOUR = {
  emergencyFunding: 300,
  policeHours: 12,
  campHoldHours: 48,
  /** City hall asks its concession this many clock hours after a favour, give or take. */
  askAfterHours: [6, 18] as const,
  cleanUpCost: 120,
  camperOffHours: 6,
} as const;
