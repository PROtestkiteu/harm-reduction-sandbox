/**
 * The organisation behind the services: money, a pool of paid staff and
 * volunteers, recruiting, and long-term funding applications that may unlock
 * better conditions. ILLUSTRATIVE: money is in sandbox units. Only the ratio
 * between funding levels follows the library (EMCDDA 2001 annual budgets:
 * Energy Control about EUR 50,000 as a project-funded NGO, ChEck iT! about
 * EUR 145,000 with stable public funding, roughly one to three).
 */
import type { ServiceId } from '../sim/types';
import type { Citation, FactorId } from './contextFactors';
import { t } from '../i18n';

const HR = 'HR Drug Checking/';
const cite = (ref: string, type: Citation['type'], note: string, source: string): Citation => ({ ref, type, note, source: `${HR}${source}` });

export const ORG = {
  /**
   * A new game starts about level: three services, one paid worker and four volunteers on the
   * project funding. Money to grow comes from what the player does (the club deal, donations,
   * grants); opening more services or hiring tips it into the red until they bring more in.
   */
  startBudget: 750,
  startPaid: 1,
  startVolunteers: 4,
  /**
   * A new game opens the three original services only, so it starts close to breaking even and
   * the player grows from there; the rest wait under Services until the money allows them.
   */
  startServices: ['dropIn', 'outreach', 'clubHr'] as readonly ServiceId[],
  /** Wage per paid worker per clock hour on shift. Volunteers are unpaid. */
  wagePerHour: 35,
  /** Base running cost per clock hour of each place: rent, heating, cleaning, insurance (illustrative). */
  runningPerPlace: 8,
  /**
   * Extra wear on an open place while the street is busier than usual: its running cost grows by
   * this share of the foot traffic above ordinary (illustrative; 1 doubles it at twice the people).
   */
  footfallStrain: 1,
  /** Income per clock hour by the national funding option (context factor `funding`). */
  incomePerHour: { volunteer: 15, project: 90, stable: 260 } as Record<string, number>,
  costs: { sterileKit: 2, onsiteCheck: 6, labCheck: 15, overdoseResponse: 20 },
  /**
   * What every person served costs on top (coffee, supplies, a bed, a dressing).
   * Drug checking is charged per check instead. Demand is never profit here.
   */
  visitCost: { dropIn: 0.6, outreach: 0.5, clubHr: 0.4, footPatrol: 0.35, drugChecking: 0, shelter: 1.2, clinic: 1.5 } as Record<string, number>,
  /** Less than this left counts as out of money: nothing costs less, so nothing can be done. */
  brokeBelow: 10,
  /** After running out, paid staff come back only once the budget recovers to this (no flapping at zero). */
  recoverAt: 300,
  /** Out of money this long (clock minutes, after the last closure below) and the run is over. */
  gameOverAfter: 480,
  /**
   * Out of money for this long (clock minutes) and a service closes down for
   * good, in this order. Restoring the budget before a deadline resets the count.
   */
  closeDownAfter: [{ service: 'clubHr', minutes: 180 }, { service: 'outreach', minutes: 300 }, { service: 'dropIn', minutes: 420 }] as const,
  /** Relaunching a closed-down service: cost and clock minutes until it can open again. */
  reopen: { cost: 600, minutes: 120 },
  /** Share of volunteers who drift away per clock hour. */
  volunteerChurnPerHour: 0.04,
  evidence: [
    cite('EMCDDA 2001', 'guideline', 'Annual budgets around 2000: Energy Control (Spain, NGO with project support) about EUR 50,000; ChEck iT! (Austria, public funding) about EUR 145,000; Techno Plus (France) about EUR 400,000.', '2001_EMCDDA_Pill_Testing_Fact_Files'),
    cite('Hutton 2021', 'survey', 'New Zealand: services often unfunded and volunteer-staffed, with only three spectrometers in the country.', '2021_Hutton_Drug Checking at New Zealand Festivals p9, p53, p64'),
    cite('Bird 2026', 'survey', 'Funding gaps a major barrier for 80% of Latin American and 54% of US programmes.', '2026_Bird_Drug Checking Services in Latin America vs. the United States p1'),
    cite('Carroll 2022', 'qualitative', 'Boston: restricted grant funding; spectrometers expensive; strong funder relationships help.', '2022_Carroll_The Bronze Age of drug checking p1, p4-5'),
  ],
} as const;

export type RecruitId = 'hirePaid' | 'volunteerDrive';

export interface RecruitOption {
  id: RecruitId;
  label: string;
  cost: number;
  minutes: number;
  /** Paid: chance a suitable person is found. Volunteers: chance per each of `tries` people. */
  chance: number;
  tries: number;
  summary: string;
}

export const RECRUIT: Record<RecruitId, RecruitOption> = {
  hirePaid: { id: 'hirePaid', label: t('Hire a paid worker'), cost: 300, minutes: 120, chance: 0.9, tries: 1, summary: t('Advert and interviews; starts in about two hours if someone suitable applies.') },
  volunteerDrive: { id: 'volunteerDrive', label: t('Look for volunteers'), cost: 40, minutes: 90, chance: 0.4, tries: 3, summary: t('Cheap, but nobody may come, and volunteers drift away over the night.') },
};

/** Chance a recruitment brings at least one person: one try for a paid post, several for volunteers. */
export const recruitChance = (id: RecruitId): number => 1 - (1 - RECRUIT[id].chance) ** RECRUIT[id].tries;

/** What the simulation knows when an application is decided. */
export interface ApplicationContext {
  /** 0 opposed, 1 tolerant, 2 supportive. */
  council: number;
  policeAgreement: boolean;
  publicAlerts: boolean;
  checksDone: number;
  /** Possession is a criminal offence. */
  criminalPossession: boolean;
  /** Multiplies every grant's chance: below 1 after a media attack on the project. */
  reputation?: number;
}

export type GrantId = 'councilGrant' | 'foundationKits' | 'equipmentFund' | 'checkingLicence' | 'nationalProgramme' | 'peerProgramme' | 'schoolsProject';

export interface GrantReward {
  incomePerHour?: number;
  oneOff?: number;
  volunteers?: number;
  /** Halves volunteer churn. */
  steadierVolunteers?: boolean;
  /** Makes analyser failures rarer. */
  equipment?: boolean;
  /** Sets a context factor option, for example a licence or stable funding. */
  unlock?: { factor: FactorId; option: string };
}

export interface GrantOption {
  id: GrantId;
  label: string;
  /** Effort and fees to apply. */
  fee: number;
  /** Clock minutes until the decision. */
  minutes: number;
  chance(ctx: ApplicationContext): number;
  /** What drives the chance, one line for the panel. */
  odds: string;
  reward: GrantReward;
  rewardText: string;
  evidence: Citation[];
}

const clamp = (v: number) => Math.min(0.95, Math.max(0.02, v));

export const GRANTS: Record<GrantId, GrantOption> = {
  councilGrant: {
    id: 'councilGrant', label: t('City council grant'), fee: 50, minutes: 240,
    chance: (c) => clamp([0.1, 0.5, 0.8][c.council] ?? 0.5),
    odds: t('Depends on the city council: opposed, tolerant or supportive.'),
    reward: { incomePerHour: 60 }, rewardText: t('+60 income per hour from now on'),
    evidence: [cite('Hutchison 2025', 'qualitative', 'Vancouver Island: town councils and mayors range from welcoming to oppositional.', '2025_Hutchison_Implementing community drug checking in smaller urban communities')],
  },
  foundationKits: {
    id: 'foundationKits', label: t('Foundation grant for kits and naloxone'), fee: 30, minutes: 180,
    chance: () => 0.6,
    odds: t('Fixed: charitable funders often back supplies.'),
    reward: { oneOff: 1200 }, rewardText: t('+1200 once'),
    evidence: [cite('Carroll 2022', 'qualitative', 'Boston: programmes rely on restricted grants; strong funder relationships help.', '2022_Carroll_The Bronze Age of drug checking p4-5')],
  },
  equipmentFund: {
    id: 'equipmentFund', label: t('Equipment fund for a spectrometer'), fee: 80, minutes: 360,
    chance: (c) => clamp(0.3 + Math.min(0.3, c.checksDone * 0.01)),
    odds: t('Better with a record of samples already checked.'),
    reward: { oneOff: 400, equipment: true }, rewardText: t('A second analyser: failures much rarer, +400 once'),
    evidence: [cite('Carroll 2022', 'qualitative', 'Spectrometers are expensive and confirmatory testing an ongoing large expense.', '2022_Carroll_The Bronze Age of drug checking p1, p4-5')],
  },
  checkingLicence: {
    id: 'checkingLicence', label: t('Drug checking licence'), fee: 150, minutes: 480,
    chance: (c) => clamp(0.15 + (c.policeAgreement ? 0.35 : 0) + (c.council === 2 ? 0.2 : 0)),
    odds: t('Much better with a police agreement and a supportive council.'),
    reward: { unlock: { factor: 'checkingLaw', option: 'licensed' } }, rewardText: t('Unlocks licensed on-site checking'),
    evidence: [
      cite('Caldicott 2023', 'opinion', 'ACT: about 24 months of advocacy and coalition building led to legally sanctioned pill testing.', '2023_Caldicott_A step change model analysis p1, p3-4'),
      cite('Mullin 2023', 'evaluation', 'UK: the first Home Office licence for a community service.', '2023_Mullin_Handheld Raman Spectroscopy p1'),
    ],
  },
  nationalProgramme: {
    id: 'nationalProgramme', label: t('National health programme funding'), fee: 200, minutes: 600,
    chance: (c) => clamp(0.1 + Math.min(0.4, c.checksDone * 0.01) + (c.publicAlerts ? 0.15 : 0) + (c.council === 2 ? 0.1 : 0) - (c.criminalPossession ? 0.05 : 0)),
    odds: t('Builds on checks done and public alerts; a long shot early on.'),
    reward: { unlock: { factor: 'funding', option: 'stable' } }, rewardText: t('Unlocks stable national funding'),
    evidence: [cite('Verdenik 2026', 'evaluation', 'Slovenia: from NGO initiatives and EU project money to state project funding linked to early warning.', "2026_Verdenik_I want to know what I'm taking")],
  },
  schoolsProject: {
    id: 'schoolsProject', label: t('School education project'), fee: 40, minutes: 360,
    // Schools want a name they can trust and a council that backs it; harsh drug laws make heads wary.
    chance: (c) => clamp(0.15 + [0, 0.15, 0.3][c.council] + 0.25 * ((c.reputation ?? 1) - 0.8) - (c.criminalPossession ? 0.1 : 0)),
    odds: t('Better with a supportive council and a good name; harsh drug laws make school heads wary.'),
    reward: { incomePerHour: 35 }, rewardText: t('+35 income per hour from now on: staff run sessions in local schools'),
    evidence: [cite('No evidence in library', 'none', 'Searched; no study in the library covers school education by harm reduction services. Effects are illustrative only.', 'Chemical Safety/Wiedza (searched)')],
  },
  peerProgramme: {
    id: 'peerProgramme', label: t('Peer worker programme'), fee: 60, minutes: 300,
    chance: () => 0.5,
    odds: t('Fixed.'),
    reward: { volunteers: 2, steadierVolunteers: true }, rewardText: t('+2 peer volunteers who stay longer'),
    evidence: [cite('Grace 2023', 'qualitative', 'Peer staff build trust and attendance (qualitative; also Pocuca 2025, Puljević 2025).', '2023_Grace_A qualitative assessment of key considerations')],
  },
};

export const GRANT_IDS = Object.keys(GRANTS) as GrantId[];
