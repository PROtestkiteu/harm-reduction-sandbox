import { t } from '../i18n';
import type { ServiceId } from '../sim/types';

/** Illustrative work skills, not professional credentials or eligibility gates. */
export const SKILL_IDS = ['outreach', 'care', 'analysis', 'coordination'] as const;
export type SkillId = typeof SKILL_IDS[number];
export type SkillValues = Record<SkillId, number>;
export const SKILL_MAX = 20;
export const SKILL_NEUTRAL = 8;
export const SKILL_CAPACITY_PER_POINT = 0.015;
/** Slow, bounded practice gains use already-recorded service hours. */
export const SKILL_PRACTICE_HOURS = 18;
export const SKILL_PRACTICE_GAIN_MAX = 4;

export const SKILLS: Readonly<Record<SkillId, { label: string; detail: string }>> = {
  outreach: { label: t('Outreach skill'), detail: t('Listening, building trust and explaining options.') },
  care: { label: t('Care skill'), detail: t('Practical care and a calm response to health needs.') },
  analysis: { label: t('Analysis skill'), detail: t('Careful checking and clear explanations of results.') },
  coordination: { label: t('Coordination skill'), detail: t('Referrals, housing support and keeping services connected.') },
};

/** Every row sums to one, so mixed services do not get a larger bonus. */
export const SERVICE_SKILL_WEIGHTS: Readonly<Record<ServiceId, Readonly<Partial<SkillValues>>>> = {
  dropIn: { outreach: .25, care: .25, coordination: .5 },
  outreach: { outreach: .65, care: .2, coordination: .15 },
  clubHr: { outreach: .4, care: .25, analysis: .15, coordination: .2 },
  footPatrol: { outreach: .55, care: .3, coordination: .15 },
  drugChecking: { analysis: .8, outreach: .1, coordination: .1 },
  shelter: { coordination: .65, outreach: .25, care: .1 },
  clinic: { care: .85, coordination: .1, outreach: .05 },
};
