import { t } from '../i18n';

/**
 * Each night's three goals, checked at 08:00 in the night report: help enough
 * people, keep the city's services out of the red, and end the night with
 * the money in no worse shape. One star per goal met; stars add up over the
 * run. ILLUSTRATIVE targets, tuned with the strategy bots (scripts/bots) so a
 * sensible night earns two stars and a strong one three. Targets grow with
 * the nights' ramp (config/difficulty.ts).
 */
export const GOALS = {
  /** People helped in a night at the usual demand (scaled by the night's demand ramp). */
  helped: 28,
  /** Clock hours with any meter red (police, medics or sobering at 0.7 and over) a night may have. */
  redHours: 4,
  /** The money may fall by at most this much over a night. */
  moneyDrop: 100,
} as const;

export type GoalId = 'helped' | 'calm' | 'money';

export const GOAL_TEXT: Record<GoalId, (target: number) => string> = {
  helped: (n) => t('Help at least {n} people tonight.', { n }),
  calm: (n) => t('No more than {n} hours with a city service in the red.', { n }),
  money: (n) => t('End the night with no more than {n} less money than you started with.', { n }),
};

/** The same goals in a few words, with progress, for the live strip above the event feed. */
export const GOAL_SHORT: Record<GoalId, (target: number, value: number) => string> = {
  helped: (n, v) => t('Help {n} people: {v} so far', { n, v }),
  calm: (n, v) => t('At most {n} h in the red: {v} h', { n, v }),
  money: (n, v) => (v > 0 ? t('Money down at most {n}: {v} down', { n, v }) : t('Money down at most {n}: not down', { n })),
};
