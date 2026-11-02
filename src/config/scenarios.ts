import { t } from '../i18n';

/**
 * Scenarios: a city run under one country's model (config/nationalModels.ts),
 * with a goal to reach. Reaching it wins the scenario; the game then carries
 * on as an open run. Started from Settings, as a fresh game. ILLUSTRATIVE
 * targets, tuned with the strategy bots: the stricter the setting, the lower
 * the bar, since the same work helps fewer people there.
 */
export interface Scenario {
  id: string;
  /** National model id, or null for the default city. */
  model: string | null;
  title: string;
  blurb: string;
  nights: number;
  helped: number;
  stars: number;
}

export const SCENARIOS: readonly Scenario[] = [
  { id: 'first', model: null, title: t('First nights'), blurb: t('An ordinary city that tolerates the project. Learn the ropes: keep three services going for three nights.'), nights: 3, helped: 70, stars: 4 },
  { id: 'netherlands', model: 'nl', title: t('The Dutch way'), blurb: t('Stable funding, a supportive council, checking licensed. Plenty is possible: the bar is high.'), nights: 5, helped: 170, stars: 9 },
  { id: 'portugal', model: 'pt', title: t('Decriminalised'), blurb: t('Use is not a crime, but the money is tight. Grow without going broke.'), nights: 5, helped: 140, stars: 8 },
  { id: 'poland', model: 'pl', title: t('Against the odds'), blurb: t('Possession is a crime and funding is a project at a time. Keep people alive and the doors open.'), nights: 5, helped: 110, stars: 6 },
  { id: 'us', model: 'us', title: t('Patchwork'), blurb: t('A patchwork of laws and short grants. Every night is a fight for money.'), nights: 5, helped: 120, stars: 7 },
];

export const scenarioById = (id: string | null | undefined): Scenario | undefined => SCENARIOS.find((s) => s.id === id);
