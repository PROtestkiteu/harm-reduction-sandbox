import { t } from '../i18n';
import type { TraitId } from '../sim/team';
import type { ServiceId } from '../sim/types';

/** Game balance only: these scores are neither clinical outcomes nor diagnostic rules. */
export type CareAction = 'talk' | 'leaflet' | 'kit' | 'quiet' | 'bed' | 'strip' | 'tlc' | 'machine';
export type NeedGroup = 'social' | 'mental' | 'health' | 'substances';
export interface RecipientNeed {
  label: string; description: string; icon: string; group: NeedGroup; urgency: number;
  specialist: TraitId; actions: readonly CareAction[];
}
const need = (label: string, icon: string, group: NeedGroup, urgency: number, specialist: TraitId, actions: readonly CareAction[]): RecipientNeed => ({
  label, icon, group, urgency, specialist, actions,
  description: {
    social: t('Help accessing housing, work and social services.'),
    mental: t('Conversation, a quiet space and access to psychological support.'),
    health: t('Physical health support and access to nursing care.'),
    substances: t('Information, support and access to drug checking.'),
  }[group],
});
export const RECIPIENT_NEEDS = {
  housing: need(t('Homelessness'), '⌂', 'social', 2, 'social', ['talk', 'leaflet', 'bed']),
  employment: need(t('Unemployment'), '▣', 'social', 1, 'social', ['talk', 'leaflet']),
  psychosis: need(t('Psychosis'), '✧', 'mental', 3, 'psychologist', ['talk', 'leaflet', 'quiet']),
  loneliness: need(t('Loneliness'), '◎', 'mental', 1, 'psychologist', ['talk', 'leaflet']),
  paranoia: need(t('Paranoia'), '◈', 'mental', 2, 'psychologist', ['talk', 'leaflet', 'quiet']),
  badTrip: need(t('Bad trip'), '☁', 'mental', 3, 'psychologist', ['talk', 'leaflet', 'quiet', 'kit']),
  lowMood: need(t('Feeling unwell'), '◒', 'mental', 1, 'psychologist', ['talk', 'leaflet']),
  sexualHealth: need(t('Sexual health concerns'), '◇', 'health', 1, 'nurse', ['talk', 'leaflet', 'kit']),
  wounds: need(t('Ulceration'), '✚', 'health', 2, 'nurse', ['talk', 'leaflet', 'kit']),
  nosebleed: need(t('Nosebleed'), '◆', 'health', 2, 'nurse', ['talk', 'leaflet', 'kit']),
  hearing: need(t('Hearing difficulties'), '◖', 'health', 1, 'nurse', ['talk', 'leaflet', 'kit', 'quiet']),
  jaw: need(t('Jaw tension'), '▱', 'health', 1, 'nurse', ['talk', 'leaflet', 'kit']),
  experimenting: need(t('Experimenting with substances'), '△', 'substances', 1, 'chemist', ['talk', 'leaflet']),
  mixing: need(t('Mixing substances'), '⋈', 'substances', 2, 'chemist', ['talk', 'leaflet', 'kit']),
  unknown: need(t('Unknown substance'), '?', 'substances', 2, 'chemist', ['talk', 'leaflet', 'strip', 'tlc', 'machine']),
  adulteration: need(t('Suspected adulteration'), '⚑', 'substances', 3, 'chemist', ['talk', 'leaflet', 'strip', 'tlc', 'machine']),
} as const satisfies Record<string, RecipientNeed>;
export type RecipientNeedId = keyof typeof RECIPIENT_NEEDS;
export const RECIPIENT_NEED_IDS = Object.keys(RECIPIENT_NEEDS) as RecipientNeedId[];
export const CARE = {
  talk: { label: t('Conversation'), minutes: 10, points: 30 },
  leaflet: { label: t('Relevant leaflet'), minutes: 2, points: 5 },
  kit: { label: t('Matched support kit'), minutes: 3, points: 10 },
  quiet: { label: t('Quiet drop-in support'), minutes: 10, points: 10 },
  bed: { label: t('Arrange a shelter bed'), minutes: 10, points: 30 },
  strip: { label: t('Single-use test'), minutes: 10, points: 5 },
  tlc: { label: t('TLC analysis'), minutes: 25, points: 20 },
  machine: { label: t('Instrumental analysis'), minutes: 40, points: 50 },
} as const;
export const CARE_SITES: Record<CareAction, readonly ServiceId[]> = {
  talk: ['dropIn', 'outreach', 'clubHr', 'footPatrol', 'clinic', 'shelter', 'drugChecking'],
  leaflet: ['dropIn', 'outreach', 'clubHr', 'footPatrol', 'clinic', 'shelter', 'drugChecking'],
  kit: ['dropIn', 'outreach', 'clubHr', 'footPatrol', 'clinic'], quiet: ['dropIn'], bed: ['shelter'],
  strip: ['drugChecking', 'outreach', 'clubHr'], tlc: ['drugChecking'], machine: ['drugChecking'],
};
export const isTest = (a: CareAction): boolean => a === 'strip' || a === 'tlc' || a === 'machine';
export function maximumSupport(id: RecipientNeedId): number {
  const actions: readonly CareAction[] = RECIPIENT_NEEDS[id].actions;
  return Math.min(100, actions.filter(a => !isTest(a)).reduce((n, a) => n + CARE[a].points, 0)
    + Math.max(0, ...actions.filter(isTest).map(a => CARE[a].points)));
}
export const RECIPIENT_BALANCE = {
  // Calibrated across three seeded 240-recipient cohorts: common simple contacts, rarer complex cases.
  stateCountWeights: [45, 25, 15, 10, 5],
  maxStates: 5, waitMinutes: 60, waitPerExtraState: 8, minimumWait: 15, warningFraction: 0.75,
  specialistTime: 0.75, leafletTime: 0.9, minimumTimeFactor: 0.5,
  referralMinutes: 10, transferTimeout: 60,
} as const;
