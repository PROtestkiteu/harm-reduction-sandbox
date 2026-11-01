import type { EventId } from './randomEvents';
import type { LocationId } from '../sim/types';

/**
 * Where on the map an event plays out, so selecting it can bring that spot
 * into view: a place, the park (parties), the park camp, or wherever the
 * crowd is thickest right now.
 */
export type EventPlace = LocationId | 'park' | 'camp' | 'busiest';

export const EVENT_PLACE: Record<EventId, EventPlace> = {
  opioidContamination: 'drugChecking',
  highDosePills: 'club',
  adulteratedCannabis: 'drugChecking',
  infectionCluster: 'dropIn',
  crackdown: 'busiest',
  busyNight: 'club',
  withdrawalWave: 'dropIn',
  coldNight: 'shelter',
  mentalHealthCrisis: 'dropIn',
  stigmaIncident: 'dropIn',
  staffIllness: 'dropIn',
  camperBreakdown: 'outreach',
  kitShortage: 'outreach',
  equipmentFailure: 'drugChecking',
  fundingGap: 'dropIn',
  labBacklog: 'drugChecking',
  suppliesConfiscated: 'outreach',
  shopClosesEarly: 'dropIn',
  streetMarketForms: 'busiest',
  equipmentComplaints: 'outreach',
  residentsPetition: 'dropIn',
  wordSpreads: 'dropIn',
  popUpParty: 'park',
  musicFestival: 'park',
  fundsRunningOut: 'dropIn',
  newYearsEve: 'club',
  freshersWeek: 'club',
  matchNight: 'busiest',
  halloween: 'club',
  paydayWeekend: 'club',
  prideNight: 'park',
  christmasMarket: 'park',
  checkingRush: 'drugChecking',
  afterCrackdown: 'outreach',
};
