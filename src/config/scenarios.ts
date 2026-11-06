import { t } from '../i18n';

/**
 * Scenarios: a city run under one country's model (config/nationalModels.ts),
 * with a goal to reach. Reaching it wins the scenario; the game then carries
 * on as an open run. Started from the before-game menu; a challenge is
 * use project-failure rules (the project can fold). ILLUSTRATIVE targets, tuned with
 * strategy bots (scripts/bots, naive and prepared on several seeds). Prepared
 * play should win more reliably over the measured five-day window; simpler
 * play can still win in favourable cities. These are minimum goals, not a deadline.
 * Regional additions are calibrated against recorded five-day naive and prepared bot runs.
 * Volunteer-funded runs also use the explicit prepared-lean strategy; see
 * docs/evidence/regional-scenarios.md for seeds, results and limits.
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
  /** Deaths over the whole run the scenario allows: one more and it cannot be won. */
  deaths: number;
}

export const SCENARIOS: readonly Scenario[] = [
  { id: 'first', model: null, title: t('First nights'), blurb: t('An ordinary city that tolerates the project. Learn the ropes: keep three services going for three nights.'), nights: 3, helped: 80, stars: 5, deaths: 6 },
  { id: 'netherlands', model: 'nl', title: t('The Dutch way'), blurb: t('Stable funding, a supportive council, checking licensed. Plenty is possible: the bar is high.'), nights: 5, helped: 380, stars: 9, deaths: 12 },
  { id: 'portugal', model: 'pt', title: t('Decriminalised'), blurb: t('Use is not a crime, but the money is tight. Grow without going broke.'), nights: 5, helped: 160, stars: 7, deaths: 15 },
  { id: 'poland', model: 'pl', title: t('Against the odds'), blurb: t('Possession is a crime and funding is a project at a time. Keep people alive and the doors open.'), nights: 5, helped: 170, stars: 7, deaths: 8 },
  { id: 'us', model: 'us', title: t('Patchwork'), blurb: t('A patchwork of laws and short grants. Every night is a fight for money.'), nights: 5, helped: 170, stars: 7, deaths: 10 },
  { id: 'new-zealand', model: 'nz', title: t('A licence, a volunteer team'), blurb: t('New Zealand: supportive communities and authorised checking, but a volunteer service has limited capacity. Keep the team and its services going. Based on the library’s festival evidence; unreported policy factors retain their defaults.'), nights: 5, helped: 90, stars: 4, deaths: 12 },
  { id: 'australia', model: 'au', title: t('Prove the pilot'), blurb: t('Australia: build an ACT-style festival checking trial with negotiated police cooperation and short-term funding. Keep people engaged and the project afloat. This is a jurisdiction-specific research setting, not a uniform national policy.'), nights: 5, helped: 170, stars: 6, deaths: 8 },
  { id: 'ukraine', model: 'ua', title: t('Beyond the dancefloor'), blurb: t('Ukraine: build trust through nightlife outreach, inspired by Drugstore’s research and service model. Reach people beyond the party and keep support available. Online delivery and wartime disruption are not simulated; undocumented policy factors retain game defaults.'), nights: 5, helped: 150, stars: 7, deaths: 8 },
  { id: 'colombia', model: 'mx-latam', title: t('Running on volunteers'), blurb: t('Build a community project with a small budget and a volunteer team. This scenario uses the regional Latin America preset, not a country-specific policy model.'), nights: 5, helped: 80, stars: 5, deaths: 7 },
];

/** Where a scenario stands, in one line: won, lost (too many deaths, or the project folded), or its progress. */
export function scenarioProgress(s: Scenario, at: { nights: number; helped: number; stars: number; deaths: number; won: boolean; folded: boolean }): string {
  if (at.won) return t('{title}: won.', { title: s.title });
  if (at.folded) return t('{title}: lost, the project folded.', { title: s.title });
  if (at.deaths > s.deaths) return t('{title}: lost, {deaths} deaths (at most {maxDeaths}).', { title: s.title, deaths: at.deaths, maxDeaths: s.deaths });
  return t('{title}: {nights} of {needNights} nights, {helped} of {needHelped} helped, {stars} of {needStars} stars, {deaths} of at most {maxDeaths} deaths.', {
    title: s.title, nights: at.nights, needNights: s.nights, helped: at.helped, needHelped: s.helped, stars: at.stars, needStars: s.stars, deaths: at.deaths, maxDeaths: s.deaths,
  });
}

export const scenarioById = (id: string | null | undefined): Scenario | undefined => SCENARIOS.find((s) => s.id === id);

/** Menu metadata stays separate from challenge scoring and its existing save contract. */
export interface ScenarioCard {
  id: string;
  kind: 'tutorial' | 'challenge' | 'sandbox';
  title: string;
  blurb: string;
  model: string | null;
  challenge?: Scenario;
}
export const SCENARIO_CARDS: readonly ScenarioCard[] = [
  { id: 'tutorial', kind: 'tutorial', model: null, title: t('Tutorial'), blurb: t('Start with a foot patrol beside the park. Meet your neighbours, build trust, and grow your services one step at a time.') },
  ...SCENARIOS.map((challenge): ScenarioCard => ({ ...challenge, kind: 'challenge', challenge })),
  { id: 'sandbox', kind: 'sandbox', model: null, title: t('Sandbox'), blurb: t('An open city with no final objective. Shape the starting conditions and play at your own pace.') },
];
