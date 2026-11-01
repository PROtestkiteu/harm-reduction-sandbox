import type { LocationId, ServiceId } from '../sim/types';

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
  dropIn: { label: 'Drop-in services', short: 'Drop-in', team: 'Drop-in centre team', place: 'the drop-in centre', servedAt: 'inside' },
  outreach: { label: 'Mobile outreach', short: 'Outreach', team: 'Outreach team', place: 'the outreach camper', servedAt: 'at the counter' },
  clubHr: { label: 'Club harm reduction', short: 'Club stand', team: 'Harm reduction stand team', place: 'the harm reduction stand', servedAt: 'at the stand' },
  pharmacy: { label: 'Pharmacy NSP', short: 'Pharmacy', team: 'Pharmacy team', place: 'the pharmacy', servedAt: 'at the counter' },
  drugChecking: { label: 'Drug checking', short: 'Checking', team: 'Drug checking team', place: 'the drug checking service', servedAt: 'inside' },
  shelter: { label: 'Shelter and day centre', short: 'Shelter', team: 'Shelter team', place: 'the shelter', servedAt: 'inside' },
  clinic: { label: 'Treatment clinic', short: 'Clinic', team: 'Clinic team', place: 'the clinic', servedAt: 'inside' },
};

/** Location names on labels, tooltips and the panel. */
export const LOCATION_NAMES: Record<LocationId, string> = {
  dropIn: 'Drop-in centre',
  outreach: 'Outreach camper',
  club: 'Music club',
  pharmacy: 'Pharmacy',
  drugChecking: 'Drug checking',
  shelter: 'Shelter',
  clinic: 'Clinic and A&E',
};
