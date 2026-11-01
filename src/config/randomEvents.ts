/**
 * Random events and who they affect. ILLUSTRATIVE rates, shares and
 * multipliers; the sources listed per event support what happens and which
 * way services push, not how often or how much.
 *
 * People carry a substance profile so a supply event reaches only the people
 * who use that substance. Profiles stay inside the model; nobody is labelled
 * by what they use on screen.
 */
import type { Citation, FactorId } from './contextFactors';
import type { ParamId } from './sandboxParams';
import type { GrantId, RecruitId } from './organisation';
import type { ServiceId } from '../sim/types';

export type Substance = 'opioid' | 'stimulant' | 'mdma' | 'cocaine' | 'cannabis' | 'alcohol' | 'none';

export interface Profile {
  substance: Substance;
  /** Injects (relevant to sterile equipment and infection exposure). */
  injects: boolean;
}

/** Substance mix by why a person is in the street (illustrative). */
export const PROFILE_MIX = {
  service: { opioid: 0.45, stimulant: 0.35, cannabis: 0.1, alcohol: 0.1 },
  club: { mdma: 0.4, cocaine: 0.2, cannabis: 0.15, alcohol: 0.25 },
  passerby: { none: 0.8, cannabis: 0.1, alcohol: 0.1 },
} as const satisfies Record<string, Partial<Record<Substance, number>>>;

/** Share of people using opioids or stimulants at the services who inject (illustrative). */
export const INJECTING_SHARE = 0.5;

export type EventId =
  | 'opioidContamination' | 'highDosePills' | 'adulteratedCannabis' | 'infectionCluster' | 'crackdown' | 'busyNight'
  | 'withdrawalWave' | 'coldNight' | 'mentalHealthCrisis' | 'stigmaIncident'
  | 'staffIllness' | 'camperBreakdown' | 'kitShortage' | 'equipmentFailure' | 'fundingGap' | 'labBacklog' | 'suppliesConfiscated'
  | 'shopClosesEarly' | 'streetMarketForms' | 'equipmentComplaints' | 'residentsPetition' | 'wordSpreads'
  | 'popUpParty' | 'musicFestival' | 'fundsRunningOut'
  | 'newYearsEve' | 'freshersWeek' | 'matchNight' | 'halloween' | 'paydayWeekend' | 'prideNight' | 'christmasMarket'
  | 'checkingRush' | 'afterCrackdown';

/** What kind of trouble: the supply, people's health, people's lives, the services themselves, or the setting. */
export type EventKind = 'supply' | 'health' | 'person' | 'service' | 'setting' | 'neighbourhood' | 'calendar';

export const KIND_LABELS: Record<EventKind, string> = {
  supply: 'Drug supply',
  health: 'Health',
  person: 'People who use drugs',
  service: 'Service falls short',
  setting: 'Street and venue',
  neighbourhood: 'Neighbourhood',
  calendar: 'Calendar and waves',
};

/** A slider, context option, or organisation action (recruit, apply) that helps with an event. */
export type Hint =
  | { param: ParamId; direction: 'up' | 'down'; label: string }
  | { factor: FactorId; option: string; label: string }
  | { org: RecruitId | GrantId | 'letGo'; label: string };

/** Modifiers an event applies while active. Combined across active events by the simulation. */
export interface EventEffects {
  /** Arrival-rate multipliers. */
  demand?: Partial<Record<'dropIn' | 'outreach' | 'club' | 'passerby', number>>;
  /** Patience multipliers per service (withdrawal makes waiting harder). */
  patience?: Partial<Record<ServiceId, number>>;
  /** Service-time multipliers per service (a crisis takes longer to support). */
  serviceTime?: Partial<Record<ServiceId, number>>;
  /** Staff who go home for the duration. */
  staffLoss?: Partial<Record<ServiceId, number>>;
  /** Services out of action for the duration. */
  outOfService?: readonly ServiceId[];
  /** No sample analysis anywhere. */
  checkingDown?: boolean;
  /** Sterile kits and naloxone run out: no kits handed out, staff reach fewer people in time. */
  kitsOut?: boolean;
  /** Services close at this clock time (minutes) at the latest. */
  closesAt?: number;
  /** Added chance of turning back before reaching a service. */
  deterrence?: number;
  /** Officers posted near services for the duration. */
  posted?: boolean;
  /** Lab results take longer: share collected multiplied by this. */
  labCollected?: number;
  /** Residents with placards by the drop-in path. */
  placards?: number;
  /** A party in the park: a small unlicensed pop-up, or a licensed open-air festival. */
  party?: 'popUp' | 'festival';
  /** Multiplier on scuffles at closing (alcohol-heavy nights). */
  scuffles?: number;
  /** Multiplier on how many people at checking sites bring a sample. */
  checkingBoost?: number;
  /** Multiplier on how often unmet need is followed by use in a hidden spot. */
  hiddenUse?: number;
}

export interface EventDef {
  id: EventId;
  kind: EventKind;
  label: string;
  /** Short word for the street alert board (pixel font: A-I, K, L, N-P, R-W). */
  boardWord: string;
  /** Substances whose users are affected. Empty: affects the setting, not a group. */
  affects: readonly Substance[];
  /** Expected starts per clock hour at frequency 1 (0: triggered by its own mechanism). */
  perHour: number;
  durationMinutes: number;
  /** Multiplier on acute-harm risk for affected people while active. */
  riskMultiplier: number;
  /** What happens, one sentence. */
  happens: string;
  /** How the services mitigate it, one sentence. */
  mitigation: string;
  effects: EventEffects;
  /** Sliders and context options that help; shown in the event feed and highlighted in the panel. */
  hints: readonly Hint[];
  evidence: Citation[];
}

const HR = 'HR Drug Checking/';
const cite = (ref: string, type: Citation['type'], note: string, source: string): Citation => ({ ref, type, note, source: `${HR}${source}` });

export const EVENTS: Record<EventId, EventDef> = {
  opioidContamination: {
    kind: 'supply', effects: {},
    hints: [
      { factor: 'checkingSite', option: 'integrated', label: 'Checking at drop-in and camper' },
      { factor: 'alerts', option: 'public', label: 'Public alerts' },
      { param: 'outreach.staff', direction: 'up', label: 'More outreach staff' },
      { factor: 'policing', option: 'agreement', label: 'Police agreement' },
    ],
    id: 'opioidContamination', label: 'Potent opioid in the street supply', boardWord: 'OPIOID', affects: ['opioid'],
    perHour: 0.35, durationMinutes: 150, riskMultiplier: 6,
    happens: 'A stronger synthetic opioid or sedative cut reaches the street; people using opioids are at much higher overdose risk, most of all when using alone.',
    mitigation: 'Checking at the drop-in or camper detects it, public alerts lower use, and outreach staff reach people who collapse.',
    evidence: [
      cite('Karamouzian 2018', 'evaluation', 'Vancouver supervised injection site: 79.8% of 1411 checks fentanyl positive; a positive check made planned dose reduction more likely (OR 9.36).', '2018_Karamouzian_Evaluation of a fentanyl drug checking service p3'),
      cite('Scarfone 2022', 'monitoring', 'Toronto, 555 samples: 49% high-potency opioids, benzodiazepine-type drugs in 21%; overdose or other negative effects reported for 11%.', '2022_Scarfone_Diverse psychotropic substances detected p1'),
      cite('Gomez 2025', 'monitoring', 'New York City syringe services: xylazine in opioid samples rose from 10.7% (2021) to 53.7% (2024).', '2025_Gomez_Community-based drug checking at syringe service programs p1'),
      cite('Curtis 2026', 'monitoring', 'Canberra fixed-site service identified a novel nitazene: early warning from checking (preprint).', '2026_Curtis_Identification of isotocyanozene p1'),
      cite('Silcox 2026', 'cohort', 'New substances detected a median 249 days earlier in community samples than in police samples (preprint).', '2026_Silcox_Source Matters p1'),
      cite('Hunt 2004', 'SR', "Sydney's supervised injecting centre managed 50 overdoses in its first six months.", '2004_NEIL_HUNT_harm reduction review pp. 30-32'),
    ],
  },
  highDosePills: {
    kind: 'supply', effects: {},
    hints: [
      { factor: 'checkingSite', option: 'nightlife', label: 'Checking at the club' },
      { factor: 'alerts', option: 'public', label: 'Public alerts' },
      { param: 'clubHr.staff', direction: 'up', label: 'More stand staff' },
      { factor: 'venue', option: 'hosts', label: 'Club hosts the stand' },
    ],
    id: 'highDosePills', label: 'High-strength pills at the club', boardWord: 'PILLS', affects: ['mdma'],
    perHour: 0.3, durationMinutes: 120, riskMultiplier: 5,
    happens: 'Unusually strong ecstasy pills circulate; some club-goers who take MDMA overheat and collapse.',
    mitigation: 'Checking at the stand detects them, alerts make fewer people take them, and stand staff help people who collapse.',
    evidence: [
      cite('Vogels 2009', 'monitoring', 'Netherlands: ecstasy tablet content varied widely over time; checking samples represent the consumer market.', 'Vogels et al 2009 p2-3'),
      cite('Caudevilla 2016', 'monitoring', 'International cryptomarket testing: high-dose MDMA pills raise risk even when the substance is as advertised.', '2016_Caudevilla_Results of an international drug testing service'),
      cite('Keygan 2025', 'RCT', 'Randomised vignette: after an alert about high-dose MDMA, 45.4% intended not to use vs 20.7% of controls.', '2025_Keygan_Risk communication about high-dose MDMA p1'),
    ],
  },
  adulteratedCannabis: {
    kind: 'supply', effects: {},
    hints: [
      { factor: 'alerts', option: 'public', label: 'Public alerts' },
      { factor: 'checkingSite', option: 'everywhere', label: 'Checking everywhere' },
    ],
    id: 'adulteratedCannabis', label: 'Synthetic cannabinoid in cannabis', boardWord: 'CANNABIS', affects: ['cannabis'],
    perHour: 0.2, durationMinutes: 120, riskMultiplier: 4,
    happens: 'Low-THC cannabis sprayed with a synthetic cannabinoid circulates; some people using cannabis have severe reactions.',
    mitigation: 'Checking detects it and alerts reach people who would not think to test cannabis.',
    evidence: [
      cite('Cannabis-adulterated 2022', 'monitoring', '9 European services, 1142 suspicious samples: 23.6% contained MDMB-4en-PINACA; three serious incidents.', 'Cannabis-adulterated-with-the-synthetic-cannabinoid-rec_2022_International-J p1-2'),
      cite('Monti 2022', 'monitoring', 'Switzerland: 50% of 94 low-THC samples contained synthetic cannabinoids; more adverse events in that group.', '2022_Monti_Adulteration of low-delta-9-tetrahydrocannabinol products p1'),
    ],
  },
  infectionCluster: {
    kind: 'health', effects: { demand: { dropIn: 1.5 } },
    hints: [
      { org: 'foundationKits', label: 'Apply for a kits grant' },
      { param: 'dropIn.waiting', direction: 'up', label: 'More drop-in waiting places' },
      { param: 'outreach.staff', direction: 'up', label: 'More outreach staff' },
      { factor: 'funding', option: 'stable', label: 'Stable funding' },
    ],
    id: 'infectionCluster', label: 'HIV and hepatitis C cluster', boardWord: 'HIV', affects: [],
    perHour: 0, durationMinutes: 180, riskMultiplier: 1,
    happens: 'Repeated injecting without sterile equipment seeds a cluster of new infections; more people come to the drop-in for testing.',
    mitigation: 'Sterile kits from the drop-in and outreach lower exposure; every injecting person turned away adds to it.',
    evidence: [
      cite('Hunt 2004', 'SR', 'When a city closed its needle programme, needle reuse and unreliable sources increased while discarded needles did not fall.', '2004_NEIL_HUNT_harm reduction review p12'),
      cite('Hunt 2004', 'SR', 'Outreach (36 publications): reduced needle reuse in 16 of 20 studies, reduced injecting frequency in 17 of 18.', '2004_NEIL_HUNT_harm reduction review p12'),
    ],
  },
  crackdown: {
    kind: 'setting', effects: { posted: true, deterrence: 0.3 },
    hints: [
      { factor: 'policing', option: 'agreement', label: 'Police agreement' },
      { factor: 'anonymity', option: 'anonymous', label: 'Anonymous services' },
    ],
    id: 'crackdown', label: 'Police crackdown', boardWord: 'INFO', affects: [],
    perHour: 0.15, durationMinutes: 60, riskMultiplier: 1,
    happens: 'Officers are posted near the services for an hour and supply is disrupted, which makes a contaminated batch more likely.',
    mitigation: 'Little: services lose visitors who stay away, which is why police agreements matter.',
    evidence: [
      cite('Summers 2026', 'evaluation', 'Boston: a mass sweep and heavier policing destabilised supply and pushed people away from services.', '2026_Summers_Real time, on-site drug checking p3, p9'),
      cite('Barratt 2017', 'survey', '94% would not use a service if arrest were possible there.', '2017_Barratt_Pill testing or drug checking in Australia p5'),
    ],
  },
  busyNight: {
    kind: 'setting', effects: { demand: { club: 2 } },
    hints: [
      { param: 'clubHr.staff', direction: 'up', label: 'More stand staff' },
      { param: 'clubHr.waiting', direction: 'up', label: 'More stand waiting places' },
    ],
    id: 'busyNight', label: 'Big night at the club', boardWord: 'INFO', affects: [],
    perHour: 0.2, durationMinutes: 90, riskMultiplier: 1,
    happens: 'A popular line-up doubles club arrivals for an hour and a half.',
    mitigation: 'The stand sees more people; staffing and waiting places decide how many it reaches.',
    evidence: [
      cite('McCormack 2021', 'survey', 'Festivals are sites of atypical intoxication: past-year drug use 68.2% among festival-goers vs 20.3% of young adults.', '2021_McCormack_The Normalization of Leisure Sex and Recreational Drugs'),
      cite('Hutton 2021', 'survey', 'New Zealand: 78% of festival-goers planned to or usually used illegal drugs at festivals.', '2021_Hutton_Drug Checking at New Zealand Festivals'),
    ],
  },
  withdrawalWave: {
    id: 'withdrawalWave', kind: 'person', label: 'Withdrawal after a supply drought', boardWord: 'INFO', affects: [],
    perHour: 0.2, durationMinutes: 120, riskMultiplier: 1,
    happens: 'Supply dries up and people go into withdrawal: more come to the services and few can wait.',
    mitigation: 'Short waits matter most: more staff and waiting places keep people from leaving unserved.',
    effects: { demand: { dropIn: 1.4, outreach: 1.4 }, patience: { dropIn: 0.4, outreach: 0.4 } },
    hints: [
      { org: 'hirePaid', label: 'Hire a paid worker' },
      { param: 'dropIn.staff', direction: 'up', label: 'More drop-in staff' },
      { param: 'outreach.staff', direction: 'up', label: 'More outreach staff' },
      { param: 'dropIn.waiting', direction: 'up', label: 'More waiting places' },
    ],
    evidence: [cite('Grace 2023', 'ScR', 'For people entering withdrawal a 3 to 6 minute wait may already be too long.', '2023_Grace_Contextual factors affecting the implementation of drug checking p3, p5')],
  },
  coldNight: {
    id: 'coldNight', kind: 'person', label: 'Cold night, nowhere to stay', boardWord: 'INFO', affects: [],
    perHour: 0.15, durationMinutes: 240, riskMultiplier: 1,
    happens: 'Temperatures drop; people without housing look for somewhere warm and the drop-in fills up.',
    mitigation: 'Longer opening hours and more waiting places keep the drop-in open to people who need shelter.',
    effects: { demand: { dropIn: 1.8 }, serviceTime: { dropIn: 1.5 } },
    hints: [
      { org: 'volunteerDrive', label: 'Find volunteers' },
      { factor: 'funding', option: 'stable', label: 'Open all night (stable funding)' },
      { param: 'dropIn.waiting', direction: 'up', label: 'More waiting places' },
      { param: 'dropIn.staff', direction: 'up', label: 'More drop-in staff' },
    ],
    evidence: [cite('No evidence in library', 'none', 'Searched; no study in the library covers this. Effects are illustrative only.', 'Chemical Safety/Wiedza (searched)'), cite('Summers 2026', 'evaluation', 'Boston: harm reduction housing residents preferred services where they live.', '2026_Summers_Real time, on-site drug checking p4, p8')],
  },
  mentalHealthCrisis: {
    id: 'mentalHealthCrisis', kind: 'person', label: 'Mental health crisis at the drop-in', boardWord: 'INFO', affects: [],
    perHour: 0.2, durationMinutes: 60, riskMultiplier: 1,
    happens: 'Someone in acute distress needs staff time; everyone else waits longer.',
    mitigation: 'Extra staff absorb it; with one person on shift the queue stalls.',
    effects: { serviceTime: { dropIn: 2.2 } },
    hints: [
      { org: 'hirePaid', label: 'Hire a paid worker' },
      { param: 'dropIn.staff', direction: 'up', label: 'More drop-in staff' },
      { param: 'dropIn.patience', direction: 'up', label: 'Visitors can wait longer' },
    ],
    evidence: [cite('No evidence in library', 'none', 'Searched; no study in the library covers this. Effects are illustrative only.', 'Chemical Safety/Wiedza (searched)')],
  },
  stigmaIncident: {
    id: 'stigmaIncident', kind: 'person', label: 'Hostile incident outside the drop-in', boardWord: 'INFO', affects: [],
    perHour: 0.15, durationMinutes: 90, riskMultiplier: 1,
    happens: 'Visitors are shouted at near the entrance; more people turn back before reaching the door.',
    mitigation: 'Anonymity and neighbourhood dialogue lower the barrier; outreach reaches people who stay away.',
    effects: { deterrence: 0.25 },
    hints: [
      { factor: 'anonymity', option: 'anonymous', label: 'Anonymous services' },
      { factor: 'neighbourhood', option: 'supportive', label: 'Neighbourhood dialogue' },
      { param: 'outreach.staff', direction: 'up', label: 'More outreach staff' },
    ],
    evidence: [
      cite('Davis 2022', 'qualitative', 'Victoria BC: anticipated stigma makes people avoid services.', '2022_Davis_Substance Use Stigma and Community Drug Checking p1'),
      cite('Coulaud 2024', 'qualitative', 'Vancouver: a moral barrier to access; stigma also burdens staff.', '2024_Coulaud_Implementation opportunities and challenges p5, p9'),
    ],
  },
  staffIllness: {
    id: 'staffIllness', kind: 'service', label: 'Drop-in staff member off sick', boardWord: 'INFO', affects: [],
    perHour: 0.2, durationMinutes: 120, riskMultiplier: 1,
    happens: 'One drop-in worker goes home; capacity drops for two hours.',
    mitigation: 'Spare staff cover the gap; on a thin rota the service runs short.',
    effects: { staffLoss: { dropIn: 1 } },
    hints: [
      { org: 'volunteerDrive', label: 'Find volunteers' }, { org: 'hirePaid', label: 'Hire a paid worker' },
      { param: 'dropIn.staff', direction: 'up', label: 'More drop-in staff' },
      { factor: 'funding', option: 'stable', label: 'Stable funding' },
    ],
    evidence: [cite('Hutton 2021', 'survey', 'New Zealand: services often unfunded and volunteer-staffed, which limited capacity.', '2021_Hutton_Drug Checking at New Zealand Festivals p9')],
  },
  camperBreakdown: {
    id: 'camperBreakdown', kind: 'service', label: 'Outreach camper breaks down', boardWord: 'INFO', affects: [],
    perHour: 0.12, durationMinutes: 90, riskMultiplier: 1,
    happens: 'The camper cannot open; people who rely on outreach are turned away.',
    mitigation: 'A drop-in with room and checking there too catches people the camper would have seen.',
    effects: { outOfService: ['outreach'] },
    hints: [
      { param: 'dropIn.waiting', direction: 'up', label: 'More drop-in waiting places' },
      { param: 'dropIn.staff', direction: 'up', label: 'More drop-in staff' },
      { factor: 'checkingSite', option: 'fixed', label: 'Checking at the drop-in' },
    ],
    evidence: [cite('Ondocsin 2023', 'qualitative', 'US and Canada: programmes run on bootstrap resources; mobile models depend on scarce equipment.', '2023_Ondocsin_Insights from Drug Checking Programs p4, p7')],
  },
  kitShortage: {
    id: 'kitShortage', kind: 'service', label: 'Sterile kits and naloxone run out', boardWord: 'INFO', affects: [],
    perHour: 0.12, durationMinutes: 150, riskMultiplier: 1,
    happens: 'No sterile kits to hand out and less naloxone: injecting exposure rises and staff reach fewer overdoses in time.',
    mitigation: 'Stable funding keeps stock in; while it lasts, outreach can still find people.',
    effects: { kitsOut: true },
    hints: [
      { org: 'foundationKits', label: 'Apply for a kits grant' },
      { factor: 'funding', option: 'stable', label: 'Stable funding' },
      { param: 'outreach.staff', direction: 'up', label: 'More outreach staff' },
    ],
    evidence: [
      cite('Bird 2026', 'survey', 'Funding gaps a major barrier for 80% of Latin American and 54% of US programmes.', '2026_Bird_Drug Checking Services in Latin America vs. the United States p1'),
      cite('Hunt 2004', 'SR', 'After a needle programme closed, needle reuse and unreliable sources increased.', '2004_NEIL_HUNT_harm reduction review p12'),
    ],
  },
  equipmentFailure: {
    id: 'equipmentFailure', kind: 'service', label: 'Analyser out of order', boardWord: 'INFO', affects: [],
    perHour: 0.12, durationMinutes: 90, riskMultiplier: 1,
    happens: 'The spectrometer fails; no samples can be analysed, so a contaminated batch goes unnoticed longer.',
    mitigation: 'Lab analysis and alerts from other services keep some warning going.',
    effects: { checkingDown: true },
    hints: [
      { org: 'equipmentFund', label: 'Apply for an equipment fund' },
      { factor: 'alerts', option: 'public', label: 'Public alerts' },
      { factor: 'funding', option: 'stable', label: 'Stable funding' },
    ],
    evidence: [cite('Carroll 2022', 'qualitative', 'Boston: spectrometers are expensive and confirmatory testing an ongoing large expense.', '2022_Carroll_The Bronze Age of drug checking p1, p4-5')],
  },
  fundingGap: {
    id: 'fundingGap', kind: 'service', label: 'Project funding runs out', boardWord: 'INFO', affects: [],
    perHour: 0.08, durationMinutes: 300, riskMultiplier: 1,
    happens: 'A grant ends and services cut the night short at 22:00.',
    mitigation: 'Stable national funding prevents the gap.',
    effects: { closesAt: 22 * 60 },
    hints: [
      { org: 'nationalProgramme', label: 'Apply for national funding' }, { org: 'councilGrant', label: 'Apply for a council grant' },{ factor: 'funding', option: 'stable', label: 'Stable funding' }],
    evidence: [
      cite('Bird 2026', 'survey', 'Funding gaps a major barrier for 80% of Latin American and 54% of US programmes.', '2026_Bird_Drug Checking Services in Latin America vs. the United States p1'),
      cite('Verdenik 2026', 'evaluation', 'Slovenia: checking moved from NGO initiatives and EU project money to state project funding linked to early warning.', "2026_Verdenik_I want to know what I'm taking"),
    ],
  },
  labBacklog: {
    id: 'labBacklog', kind: 'service', label: 'Lab backlog', boardWord: 'INFO', affects: [],
    perHour: 0.12, durationMinutes: 180, riskMultiplier: 1,
    happens: 'Lab results slow down; fewer people ever collect them.',
    mitigation: 'On-site checking gives results in minutes and is not affected.',
    effects: { labCollected: 0.5 },
    hints: [{ factor: 'checkingLaw', option: 'licensed', label: 'Licensed on-site checking' }],
    evidence: [cite('Kaskela 2025', 'evaluation', 'Finland: monthly lab analysis; results collected for 208 of 503 samples (41%).', '2025_Kaskela_From trash to results p1, p3')],
  },
  suppliesConfiscated: {
    id: 'suppliesConfiscated', kind: 'service', label: 'Police confiscate checking supplies', boardWord: 'INFO', affects: [],
    perHour: 0.08, durationMinutes: 120, riskMultiplier: 1,
    happens: 'Reagents and strips are seized; checking stops until new supplies arrive.',
    mitigation: 'A licence or a police agreement protects supplies.',
    effects: { checkingDown: true },
    hints: [
      { org: 'checkingLicence', label: 'Apply for a licence' },
      { factor: 'checkingLaw', option: 'licensed', label: 'Licensed checking' },
      { factor: 'policing', option: 'agreement', label: 'Police agreement' },
    ],
    evidence: [cite('Bird 2026', 'survey', 'Police confiscated supplies at 38% of Latin American and 11% of US programmes.', '2026_Bird_Drug Checking Services in Latin America vs. the United States p1')],
  },
  shopClosesEarly: {
    id: 'shopClosesEarly', kind: 'neighbourhood', label: 'Corner shop and cafe shut early', boardWord: 'INFO', affects: [],
    perHour: 0, durationMinutes: 180, riskMultiplier: 1,
    happens: 'Trade has fallen with how safe the street feels; the shutters come down and fewer people walk through.',
    mitigation: 'Less visible use, less discarded equipment and no street market bring trade back over time.',
    effects: { demand: { passerby: 0.75 } },
    hints: [
      { param: 'outreach.staff', direction: 'up', label: 'More outreach (clean-up, contact)' },
      { param: 'dropIn.waiting', direction: 'up', label: 'More drop-in waiting places' },
      { factor: 'neighbourhood', option: 'supportive', label: 'Neighbourhood dialogue' },
    ],
    evidence: [cite('Hunt 2004', 'SR', 'Open drug scenes and discarded equipment lower real and perceived safety, concentrated in poorer neighbourhoods (narrative, no figures).', '2004_NEIL_HUNT_harm reduction review p7'), cite('Hutchison 2025', 'qualitative', 'Clients fear being treated differently by local business owners.', '2025_Hutchison_Implementing community drug checking p6'), cite('No evidence in library', 'none', 'Searched; no study in the library measures this. The size of the effect is illustrative only.', 'Chemical Safety/Wiedza (searched)')],
  },
  streetMarketForms: {
    id: 'streetMarketForms', kind: 'neighbourhood', label: 'Street market forms', boardWord: 'INFO', affects: [],
    perHour: 0, durationMinutes: 180, riskMultiplier: 1,
    happens: 'Where unmet need concentrates, sellers start standing on the corner; police presence moves them, it does not remove them.',
    mitigation: 'Meeting need at the services shrinks the market; crackdowns only displace it.',
    effects: { deterrence: 0.05 },
    hints: [
      { param: 'dropIn.staff', direction: 'up', label: 'More drop-in staff' },
      { param: 'outreach.staff', direction: 'up', label: 'More outreach staff' },
      { factor: 'checkingSite', option: 'everywhere', label: 'Checking everywhere' },
    ],
    evidence: [
      cite('Barratt 2016', 'SR', 'Law enforcement takedowns prompted innovation rather than elimination.', '2016_Barratt_Everything you always wanted to know about drug cryptomarkets p4'),
      cite('Aldridge 2017', 'SR', 'Street buying carries more arrest and violence risk than online buying.', '2017_Aldridge_Will growth in cryptomarket drug buying increase the harms'),
      cite('Summers 2026', 'evaluation', 'Boston: a sweep destabilised supply and pushed people away from services.', '2026_Summers_Real time, on-site drug checking p3, p9'),
    ],
  },
  equipmentComplaints: {
    id: 'equipmentComplaints', kind: 'neighbourhood', label: 'Complaints about discarded equipment', boardWord: 'INFO', affects: [],
    perHour: 0, durationMinutes: 150, riskMultiplier: 1,
    happens: 'Used equipment turns up in the park and by the corners; residents complain.',
    mitigation: 'Sterile kits with disposal and outreach clean-up bring it down; closing the needle programme does not.',
    effects: { deterrence: 0.05 },
    hints: [
      { param: 'outreach.staff', direction: 'up', label: 'More outreach (clean-up)' },
      { org: 'foundationKits', label: 'Apply for a kits grant' },
      { factor: 'funding', option: 'stable', label: 'Stable funding' },
    ],
    evidence: [cite('Hunt 2004', 'SR', 'When a city closed its needle programme over discarded-needle complaints, discarded needles did not decrease while reuse rose.', '2004_NEIL_HUNT_harm reduction review p12'), cite('Hunt 2004', 'SR', 'Open drug scenes and discarded equipment lower real and perceived safety, concentrated in poorer neighbourhoods (narrative, no figures).', '2004_NEIL_HUNT_harm reduction review p7')],
  },
  residentsPetition: {
    id: 'residentsPetition', kind: 'neighbourhood', label: 'Residents petition the council', boardWord: 'INFO', affects: [],
    perHour: 0, durationMinutes: 240, riskMultiplier: 1,
    happens: 'After a long stretch of the street feeling unsafe, residents gather with placards; a council grant gets harder.',
    mitigation: 'Dialogue with residents and visible improvement (clean street, no open scene) settle it.',
    effects: { placards: 3, deterrence: 0.1 },
    hints: [
      { factor: 'neighbourhood', option: 'supportive', label: 'Neighbourhood dialogue' },
      { param: 'outreach.staff', direction: 'up', label: 'More outreach staff' },
      { factor: 'policing', option: 'agreement', label: 'Police agreement' },
    ],
    evidence: [
      cite('Moran 2024', 'qualitative', 'Harm reduction is criticised as enabling and making neighbourhoods less safe; pushback moves legislators despite evidence.', '2024_Moran_How do we understand the value of drug checking p3, p11'),
      cite('Falzon 2023', 'qualitative', 'Scotland: community attitudes influence success; dialogue and tailored communication suggested.', '2023_Falzon_Planning and implementing community-based drug checking services in Scotland p2'),
      cite('Hunt 2004', 'SR', 'Dutch and Swiss heroin trials: no serious public order or safety problems nearby; consumption rooms probably reduce visible use and nuisance; policing changes confound crime outcomes.', '2004_NEIL_HUNT_harm reduction review pp. 23, 30-32'),
    ],
  },
  wordSpreads: {
    id: 'wordSpreads', kind: 'neighbourhood', label: 'Word spreads: people come from elsewhere', boardWord: 'INFO', affects: [],
    perHour: 0, durationMinutes: 240, riskMultiplier: 1,
    happens: 'The services have a good name; people who use drugs come from other districts. More attendance means better access, and it strains capacity.',
    mitigation: 'Add staff and waiting places so the new demand is met rather than turned away onto the street.',
    effects: { demand: { dropIn: 1.3, outreach: 1.3 } },
    hints: [
      { param: 'dropIn.staff', direction: 'up', label: 'More drop-in staff' },
      { param: 'dropIn.waiting', direction: 'up', label: 'More waiting places' },
      { org: 'hirePaid', label: 'Hire a paid worker' },
    ],
    evidence: [
      cite('Verdenik 2026', 'evaluation', 'Slovenia: 82.9% of checking users had no prior contact with drug services: good services reach new people.', "2026_Verdenik_I want to know what I'm taking"),
      cite('Hunt 2004', 'SR', 'Dutch and Swiss heroin trials: no serious public order or safety problems nearby; consumption rooms probably reduce visible use and nuisance; policing changes confound crime outcomes.', '2004_NEIL_HUNT_harm reduction review pp. 23, 30-32'),
    ],
  },
  popUpParty: {
    id: 'popUpParty', kind: 'setting', label: 'Pop-up party in the park', boardWord: 'INFO', affects: [],
    perHour: 0.12, durationMinutes: 200, riskMultiplier: 1,
    happens: 'An unlicensed party sets up speakers in the park; a few dozen people dance, sellers follow the crowd, and posted police may shut it down.',
    mitigation: 'Outreach with checking can go to the crowd; shutting it down scatters people rather than stopping use.',
    effects: { party: 'popUp', demand: { outreach: 1.3 } },
    hints: [
      { param: 'outreach.staff', direction: 'up', label: 'More outreach staff' },
      { factor: 'checkingSite', option: 'mobileNightlife', label: 'Checking at the camper' },
      { factor: 'alerts', option: 'public', label: 'Public alerts' },
    ],
    evidence: [
      cite('McCormack 2021', 'survey', 'Festivals are sites of atypical intoxication: past-year drug use 68.2% among festival-goers vs 20.3% of young adults.', '2021_McCormack_The Normalization of Leisure Sex and Recreational Drugs'),
      cite('Grigg 2018', 'survey', 'Australian festivals: of people carrying drugs who saw a detection dog, 10% took them on the spot.', '2018_Grigg_Drug detection dogs p4, p11'),
      cite('No evidence in library', 'none', 'No study of unlicensed pop-up parties. Size of effects illustrative only.', 'Chemical Safety/Wiedza (searched)'),
    ],
  },
  musicFestival: {
    id: 'musicFestival', kind: 'setting', label: 'Open-air music festival', boardWord: 'INFO', affects: [],
    perHour: 0.05, durationMinutes: 300, riskMultiplier: 1,
    happens: 'A licensed festival stage goes up in the park; hundreds pass through, the stand and outreach see far more people, and a supply shock reaches many at once.',
    mitigation: 'An organiser who invites checking and alerts makes the difference; venue liability fears keep many from doing so.',
    effects: { party: 'festival', demand: { outreach: 1.5, club: 1.3, passerby: 1.3 } },
    hints: [
      { factor: 'venue', option: 'hosts', label: 'Organiser hosts checking' },
      { factor: 'checkingSite', option: 'everywhere', label: 'Checking everywhere' },
      { param: 'clubHr.staff', direction: 'up', label: 'More stand staff' },
      { factor: 'alerts', option: 'public', label: 'Public alerts' },
    ],
    evidence: [
      cite('Hutton 2021', 'survey', 'New Zealand: 78% of festival-goers planned to or usually used illegal drugs at festivals.', '2021_Hutton_Drug Checking at New Zealand Festivals'),
      cite('Olsen 2022', 'evaluation', 'Australian festival pilot: 170 substances for more than 230 patrons; 12% had something other than expected.', '2022_Olsen_Music festival drug checking'),
      cite('Palamar 2019', 'opinion', 'US venue liability law: promoters refuse on-site checking for fear of being deemed to allow drug use.', '2019_Palamar_Adulterants and altruism A qualitative investigation of drug checkers in North America'),
      cite('Bows 2023', 'survey', 'UK festivals: perceptions of safety and experiences of gender-based violence.', '2023_Bows_Perceptions of safety and experiences of gender-based violence'),
    ],
  },
  fundsRunningOut: {
    id: 'fundsRunningOut', kind: 'service', label: 'Money has run out', boardWord: 'INFO', affects: [],
    perHour: 0, durationMinutes: 24 * 60, riskMultiplier: 1,
    happens: 'Paid staff stay home and kits and checks stop. Without money for 3 hours the club stand closes down for good, after 5 hours the outreach camper, after 7 hours the drop-in.',
    mitigation: 'Bring the budget back above 300 before a deadline: cut wages, win a grant, or change national funding. A closed-down service needs a costly relaunch.',
    effects: {},
    hints: [
      { org: 'foundationKits', label: 'Apply for a foundation grant' },
      { org: 'councilGrant', label: 'Apply for a council grant' },
      { org: 'letGo', label: 'Let a paid worker go' },
      { factor: 'funding', option: 'stable', label: 'Stable funding' },
    ],
    evidence: [
      cite('Bird 2026', 'survey', 'Funding gaps a major barrier for 80% of Latin American and 54% of US programmes.', '2026_Bird_Drug Checking Services in Latin America vs. the United States p1'),
      cite('Ondocsin 2023', 'qualitative', 'US and Canada: programmes run on bootstrap resources under constant financial strain.', '2023_Ondocsin_Insights from Drug Checking Programs p4'),
      cite('Verdenik 2026', 'evaluation', 'Slovenia: checking moved from NGO and project money to state funding, which kept it running.', "2026_Verdenik_I want to know what I'm taking"),
    ],
  },
  newYearsEve: {
    id: 'newYearsEve', kind: 'calendar', label: "New Year's Eve", boardWord: 'INFO', affects: [],
    perHour: 0, durationMinutes: 480, riskMultiplier: 1,
    happens: 'The busiest night of the year: a street party in the park, the club at capacity, crowds until dawn, and more scuffles.',
    mitigation: 'Extra staff at the stand and on outreach, public alerts, and checking where the crowds are.',
    effects: { demand: { club: 2.5, passerby: 2 }, party: 'popUp', scuffles: 2.5 },
    hints: [
      { param: 'clubHr.staff', direction: 'up', label: 'More stand staff' },
      { param: 'outreach.staff', direction: 'up', label: 'More outreach staff' },
      { org: 'volunteerDrive', label: 'Find volunteers' },
      { factor: 'alerts', option: 'public', label: 'Public alerts' },
    ],
    evidence: [cite('Eassey 2024', 'SR', 'Licensed venue regulation (lockouts, trading hours, multicomponent programmes) lowers alcohol-related violence.', '2024_Eassey_A systematic review of interventions that impact alcohol and other drug-related harms in licensed entertainment'), cite('No evidence in library', 'none', 'Searched; no study in the library measures this calendar pattern. Sizes are illustrative.', 'Chemical Safety/Wiedza (searched)')],
  },
  freshersWeek: {
    id: 'freshersWeek', kind: 'calendar', label: "Freshers' week", boardWord: 'INFO', affects: [],
    perHour: 0, durationMinutes: 480, riskMultiplier: 1,
    happens: 'New students arrive: many first nights out, people new to the city and to drugs, the club and parties full.',
    mitigation: 'Information at the stand and checking reach first-time users; peer staff help.',
    effects: { demand: { club: 1.6, passerby: 1.3 } },
    hints: [
      { param: 'clubHr.staff', direction: 'up', label: 'More stand staff' },
      { factor: 'checkingSite', option: 'fixedNightlife', label: 'Checking at the club' },
      { org: 'peerProgramme', label: 'Peer worker programme' },
    ],
    evidence: [
      cite('Pocuca 2026', 'survey', 'Australian residential college students: 68% aware of drug checking and most positive, but unsure they would feel comfortable going.', "2026_Pocuca_Australian University Residential College Students' Awareness of and Attitudes Toward Drug Checking Services"),
      cite('Measham 2019', 'evaluation', 'UK festival: 8.3% of checking users were first-time users of that drug.', '2019_Measham_Drug safety testing, disposals and dealing in an English field p5'),
    ],
  },
  matchNight: {
    id: 'matchNight', kind: 'calendar', label: 'Match night', boardWord: 'INFO', affects: [],
    perHour: 0, durationMinutes: 330, riskMultiplier: 1,
    happens: 'Fans pass through before the match and come back after it; heavy drinking and a few more scuffles, mostly nothing to do with drugs.',
    mitigation: 'Police on a normal beat and welfare staff at closing keep it calm.',
    effects: { demand: { passerby: 1.4 }, scuffles: 1.8 },
    hints: [
      { factor: 'policing', option: 'neutral', label: 'Routine patrols' },
      { param: 'clubHr.staff', direction: 'up', label: 'Welfare staff at the stand' },
    ],
    evidence: [cite('Eassey 2024', 'SR', 'Licensed venue regulation (lockouts, trading hours, multicomponent programmes) lowers alcohol-related violence.', '2024_Eassey_A systematic review of interventions that impact alcohol and other drug-related harms in licensed entertainment'), cite('No evidence in library', 'none', 'Searched; no study in the library measures this calendar pattern. Sizes are illustrative.', 'Chemical Safety/Wiedza (searched)')],
  },
  halloween: {
    id: 'halloween', kind: 'calendar', label: 'Halloween', boardWord: 'INFO', affects: [],
    perHour: 0, durationMinutes: 540, riskMultiplier: 1,
    happens: 'Costume night: the club and the street busier than a normal weekday.',
    mitigation: 'The stand and public alerts reach the crowd.',
    effects: { demand: { club: 1.6, passerby: 1.4 } },
    hints: [{ param: 'clubHr.staff', direction: 'up', label: 'More stand staff' }, { factor: 'alerts', option: 'public', label: 'Public alerts' }],
    evidence: [cite('No evidence in library', 'none', 'Searched; no study in the library measures this calendar pattern. Sizes are illustrative.', 'Chemical Safety/Wiedza (searched)')],
  },
  paydayWeekend: {
    id: 'paydayWeekend', kind: 'calendar', label: 'Payday weekend', boardWord: 'INFO', affects: [],
    perHour: 0, durationMinutes: 420, riskMultiplier: 1,
    happens: 'Wages are in: nightlife is busier and more people bring samples to check before the weekend.',
    mitigation: 'More checking capacity at the club and on outreach.',
    effects: { demand: { club: 1.3 }, checkingBoost: 1.3 },
    hints: [{ param: 'clubHr.staff', direction: 'up', label: 'More stand staff' }, { factor: 'checkingSite', option: 'mobileNightlife', label: 'Checking at the camper' }],
    evidence: [cite('No evidence in library', 'none', 'Searched; no study in the library measures this calendar pattern. Sizes are illustrative.', 'Chemical Safety/Wiedza (searched)')],
  },
  prideNight: {
    id: 'prideNight', kind: 'calendar', label: 'Pride night', boardWord: 'INFO', affects: [],
    perHour: 0, durationMinutes: 600, riskMultiplier: 1,
    happens: 'Pride brings a street party and a full club; anonymous, non-judgemental services are used more.',
    mitigation: 'Anonymity and peer staff matter; checking at the party reaches people who avoid other services.',
    effects: { demand: { club: 1.8, passerby: 2 }, party: 'popUp' },
    hints: [
      { factor: 'anonymity', option: 'anonymous', label: 'Anonymous services' },
      { org: 'peerProgramme', label: 'Peer worker programme' },
      { factor: 'checkingSite', option: 'mobileNightlife', label: 'Checking at the camper' },
    ],
    evidence: [
      cite('Coulaud 2024', 'qualitative', 'Vancouver pilot for sexual and gender minority men: casual users struggle to see themselves as drug users; stigma is a moral barrier.', '2024_Coulaud_Implementation opportunities and challenges p5, p9'),
      cite('McCormack 2021', 'survey', 'Leisure sex and recreational drug use are linked among festival-goers.', '2021_McCormack_The Normalization of Leisure Sex and Recreational Drugs'),
    ],
  },
  christmasMarket: {
    id: 'christmasMarket', kind: 'calendar', label: 'Christmas market season', boardWord: 'INFO', affects: [],
    perHour: 0, durationMinutes: 240, riskMultiplier: 1,
    happens: 'Early evening fills with tourists and shoppers; the cafe and corner shop trade well; lights go up.',
    mitigation: 'Nothing to mitigate: a good night for the street.',
    effects: { demand: { passerby: 1.6 } },
    hints: [],
    evidence: [cite('No evidence in library', 'none', 'Searched; no study in the library measures this calendar pattern. Sizes are illustrative.', 'Chemical Safety/Wiedza (searched)')],
  },
  checkingRush: {
    id: 'checkingRush', kind: 'calendar', label: 'Rush to drug checking after an alert', boardWord: 'INFO', affects: [],
    perHour: 0, durationMinutes: 180, riskMultiplier: 1,
    happens: 'Word of a dangerous batch spreads; more people bring samples to the checking sites.',
    mitigation: 'Staff and waiting places at checking sites decide how many are seen.',
    effects: { demand: { dropIn: 1.25, outreach: 1.3 }, checkingBoost: 2 },
    hints: [
      { param: 'outreach.staff', direction: 'up', label: 'More outreach staff' },
      { param: 'dropIn.waiting', direction: 'up', label: 'More waiting places' },
    ],
    evidence: [
      cite('Kirk 2025', 'evaluation', 'New York State: test strip demand rose with each campaign release.', '2025_Kirk_Using RE-AIM to evaluate the implementation of a social marketing and free product distribution project'),
      cite('Keygan 2025', 'RCT', 'After an alert 45.4% intended not to use vs 20.7% of controls.', '2025_Keygan_Risk communication about high-dose MDMA p1'),
    ],
  },
  afterCrackdown: {
    id: 'afterCrackdown', kind: 'calendar', label: 'Displacement after the crackdown', boardWord: 'INFO', affects: [],
    perHour: 0, durationMinutes: 150, riskMultiplier: 1,
    happens: 'People pushed off the street by the crackdown use further out of sight and stay away from services for a while.',
    mitigation: 'Outreach reaches people the services lost; police agreements avoid the cycle.',
    effects: { deterrence: 0.12, hiddenUse: 1.6 },
    hints: [{ param: 'outreach.staff', direction: 'up', label: 'More outreach staff' }, { factor: 'policing', option: 'agreement', label: 'Police agreement' }],
    evidence: [cite('Summers 2026', 'evaluation', 'Boston: after a mass sweep, residents avoided off-site services given the police presence; supply destabilised.', '2026_Summers_Real time, on-site drug checking p3, p5')],
  },
};

export const EVENT_IDS = Object.keys(EVENTS) as EventId[];

/** Acute-harm and mitigation rates (illustrative). */
export const ACUTE = {
  /** Chance an affected person who uses has an acute harm, before the event multiplier. */
  base: 0.07,
  /** Using alone in a hidden spot multiplies it (nobody there to notice). */
  aloneMultiplier: 1.5,
  /** Chance staff reach someone who collapses, when the relevant service is open and staffed. */
  reachedByStaff: { hidden: 0.55, terrace: 0.9 },
  /** Net share of affected people who avoid the substance after a public alert (Keygan 2025: 45.4% vs 20.7%). */
  alertAvoidance: 0.25,
  /** Chance an unsafe injecting episode seeds an infection cluster (when none is active). */
  clusterPerUnsafeEpisode: 0.03,
  /** A crackdown makes a contaminated batch this much more likely while it lasts. */
  crackdownContamination: 2,
} as const;
