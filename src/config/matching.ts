import type { TraitId } from '../sim/team';
import type { ServiceId } from '../sim/types';
import { t } from '../i18n';

/**
 * Matching people to the worker who can help them. Some people who come to a
 * service need a particular skill: another language, help with housing, a
 * wound dressed, someone they can trust, calm in a crisis. With a worker on
 * shift there who has it, the visit goes quicker and the worker is glad of
 * it; without, it takes much longer and the place queues up. ILLUSTRATIVE
 * shares and effects.
 */
export type NeedId = 'language' | 'housing' | 'wound' | 'trust' | 'crisis';

export interface NeedInfo {
  label: string;
  /** Traits that meet it. */
  traits: readonly TraitId[];
  /** Share of visitors at each service with this need. */
  share: Partial<Record<ServiceId, number>>;
}

export const NEEDS: Record<NeedId, NeedInfo> = {
  language: { label: t('another language'), traits: ['languages'], share: { dropIn: 0.06, outreach: 0.06, clubHr: 0.04, footPatrol: 0.06, shelter: 0.06, clinic: 0.06, drugChecking: 0.04 } },
  housing: { label: t('housing and benefits'), traits: ['social'], share: { dropIn: 0.075, shelter: 0.15, outreach: 0.03 } },
  wound: { label: t('wound care'), traits: ['nurse'], share: { dropIn: 0.04, outreach: 0.05, footPatrol: 0.05, clinic: 0.15 } },
  trust: { label: t('someone they can trust'), traits: ['peer'], share: { dropIn: 0.05, outreach: 0.075, footPatrol: 0.075, clubHr: 0.04 } },
  crisis: { label: t('calm in a crisis'), traits: ['calm'], share: { clubHr: 0.05, outreach: 0.03, dropIn: 0.025 } },
};

export const NEED_IDS = Object.keys(NEEDS) as NeedId[];

export const MATCHING = {
  /** Visit time with the right worker, and without. */
  matchedTime: 0.85,
  unmatchedTime: 1.35,
  /** In a crisis, more people come in a state that needs calm (added to the share at full crisis). */
  crisisShare: 0.1,
} as const;
