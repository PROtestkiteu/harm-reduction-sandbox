import type { LocationId, ServiceId } from '../sim/types';
import { t } from '../i18n';

/** How each service is named in the interface, in plain, neutral words. */
export interface ServiceText {
  /** Switch label and panel line, for example "Drop-in services". */
  label: string;
  /** Phone-width switch label. */
  short: string;
  /** Staff team name on a person's card. */
  team: string;
  /** "the drop-in centre": used in "Walking to ...". */
  place: string;
  /** Where people being served are, for "3 inside": "inside", "at the counter". */
  servedAt: string;
}

export const SERVICE_TEXT: Record<ServiceId, ServiceText> = {
  dropIn: { label: t('Drop-in services'), short: t('Drop-in'), team: t('Drop-in centre team'), place: t('the drop-in centre'), servedAt: t('inside') },
  outreach: { label: t('Mobile outreach'), short: t('Outreach'), team: t('Outreach team'), place: t('the outreach camper'), servedAt: t('at the counter') },
  clubHr: { label: t('Club harm reduction'), short: t('Stand at the club'), team: t('Harm reduction stand team'), place: t('the harm reduction stand'), servedAt: t('at the stand') },
  footPatrol: { label: t('Foot patrol'), short: t('Foot patrol'), team: t('Foot patrol team'), place: t('the foot patrol'), servedAt: t('at the table') },
  drugChecking: { label: t('Drug checking'), short: t('Drug checking'), team: t('Drug checking team'), place: t('the drug checking service'), servedAt: t('inside') },
  shelter: { label: t('Shelter and day centre'), short: t('Shelter'), team: t('Shelter team'), place: t('the shelter'), servedAt: t('inside') },
  clinic: { label: t('Treatment clinic'), short: t('Clinic'), team: t('Clinic team'), place: t('the clinic'), servedAt: t('inside') },
};

/** Location names on labels, tooltips and the panel. */
export const LOCATION_NAMES: Record<LocationId, string> = {
  dropIn: t('Drop-in centre'),
  outreach: t('Outreach camper'),
  club: t('Music club'),
  footPatrol: t('Foot patrol'),
  drugChecking: t('Drug checking'),
  shelter: t('Shelter'),
  clinic: t('Clinic and A&E'),
};
