/**
 * Context factors, top to bottom: from national law down to the neighbourhood
 * and the design of a service. Each factor is an ordered set of named options;
 * each option maps to model mechanisms (who turns back before reaching a
 * service, police on the street, opening hours, whether checking is allowed)
 * and lists the library sources for the DIRECTION of that effect.
 *
 * MAGNITUDES ARE ILLUSTRATIVE. The library is mostly qualitative and
 * cross-sectional; it supports which way a factor pushes, rarely how far.
 * Where a source reports a figure, it is quoted in the citation note and,
 * where used directly, named in CHECKING below. Options with no evidence in
 * the library say so and carry no assumed effect.
 *
 * Library: Chemical Safety/Wiedza (HR Drug Checking, narkopolityka, _polskie).
 */

import type { ServiceId } from '../sim/types';
import { t } from '../i18n';

export type FactorLevel =
  | 'national_law'
  | 'enforcement_policing'
  | 'health_system_funding'
  | 'local_government_planning'
  | 'community_attitudes_stigma'
  | 'venue_nightlife'
  | 'service_design_access';

export const LEVEL_LABELS: Record<FactorLevel, string> = {
  national_law: t('National law'),
  enforcement_policing: t('Policing'),
  health_system_funding: t('Health system and funding'),
  local_government_planning: t('Local government'),
  community_attitudes_stigma: t('Neighbourhood'),
  venue_nightlife: t('Nightlife venue'),
  service_design_access: t('Service design'),
};

export type EvidenceType = 'SR' | 'ScR' | 'RCT' | 'cohort' | 'survey' | 'qualitative' | 'evaluation' | 'monitoring' | 'guideline' | 'opinion' | 'statistics' | 'profile' | 'none';

export interface Citation {
  /** Short reference: first author, year. */
  ref: string;
  type: EvidenceType;
  /** Setting and what the source reports, paraphrased, figures as reported. */
  note: string;
  /** File in the library and page. */
  source: string;
}

/** Mechanism levers one option sets. Combined across factors by `combineEffects`. */
export interface ContextEffects {
  /** Chance a person who sets out for a service turns back before reaching it. Combined as 1 - product(1 - d). */
  deterrence: number;
  /** Police officers patrolling the street. Combined: maximum. */
  patrol: number;
  /** Posted at service entrances, walking a beat past them, or keeping clear by agreement. Combined: most intrusive. */
  patrolStyle: PatrolStyle;
  /** Police stop people for possession. Combined: any. */
  possessionStops: boolean;
  /** Clock minutes when services close for the night (null: all night). Combined: earliest. */
  closesAt: number | null;
  /** The stand may analyse samples (otherwise information only). Combined: all. */
  checkingAllowed: boolean;
  /** Results on site in minutes, or from a lab days later. Combined: lab wins. */
  turnaround: 'onsite' | 'lab';
  /** The outreach camper may park and open. Combined: all. */
  outreachPermitted: boolean;
  /** The club lets the stand set up. Combined: all. */
  standPermitted: boolean;
  /** Residents holding placards near the drop-in. Combined: maximum. */
  placards: number;
  /** Services where visitors can have a sample checked. Set by one factor. */
  checkingSites: readonly ServiceId[];
  /** A collection point with a lab drop box (results days later). Combined: any. */
  collectionPoint: boolean;
  /** Public early-warning board that shows alerts after unexpected results. Combined: any. */
  publicAlerts: boolean;
}

export type PatrolStyle = 'clear' | 'beat' | 'posted';
const PATROL_ORDER: readonly PatrolStyle[] = ['clear', 'beat', 'posted'];

export const NEUTRAL_EFFECTS: ContextEffects = {
  deterrence: 0,
  patrol: 0,
  patrolStyle: 'clear',
  possessionStops: false,
  closesAt: null,
  checkingAllowed: true,
  turnaround: 'onsite',
  outreachPermitted: true,
  standPermitted: true,
  placards: 0,
  checkingSites: ['clubHr'],
  collectionPoint: false,
  publicAlerts: false,
};

export interface FactorOption {
  id: string;
  label: string;
  /** One line on what changes in the scene. */
  summary: string;
  effects: Partial<ContextEffects>;
  evidence: Citation[];
}

export interface FactorDef {
  id: string;
  level: FactorLevel;
  label: string;
  options: readonly FactorOption[];
  /** Index of the default option. */
  default: number;
}

const NO_EVIDENCE = (what: string): Citation => ({
  ref: 'No evidence in library',
  type: 'none',
  note: `${what} No effect is assumed beyond the options it shares mechanics with.`,
  source: 'Chemical Safety/Wiedza (searched)',
});

const HR = 'HR Drug Checking/';

// Citations reused by several options.
const C = {
  davis: { ref: 'Davis 2022', type: 'qualitative', note: 'Victoria BC, 26 interviews: criminalisation produces structural stigma; people fear repercussions and avoid services.', source: `${HR}2022_Davis_Substance Use Stigma and Community Drug Checking p1` },
  wallace: { ref: 'Wallace 2022', type: 'qualitative', note: 'Victoria BC, 26 interviews: criminalisation and market pressures are the most critical factors; services need places without risk of arrest.', source: `${HR}2022_Wallace_Implementing drug checking as an illicit drug market intervention p1` },
  graceScr: { ref: 'Grace 2023', type: 'ScR', note: '29 articles: legality and privacy are two of four primary implementation themes and reduce utilisation.', source: `${HR}2023_Grace_Contextual factors affecting the implementation of drug checking p1, p3` },
  puljevic: { ref: 'Puljević 2025', type: 'qualitative', note: 'Queensland, 57 interviews: fear of being punished or apprehended among barriers with cost and wait time.', source: `${HR}2025_Puljević_It'd Be Nice to Know p5` },
  art62: { ref: 'Polish court and police statistics', type: 'statistics', note: 'Possession (art. 62) was 61 to 69% of drug-law convictions 2006 to 2016; drug-law convictions rose from 1.7% (2002) to 6.7% (2016) of adult convictions.', source: 'narkopolityka/stare_082_30_2018 (sheet 2002-2017)' },
  art62a: { ref: 'Polish prosecution statistics', type: 'statistics', note: 'Discontinuations for small amounts rose from 7.0% (2013) to 23.8% (2017) of closed possession cases while detections stayed about 32,000 to 34,000 a year: fewer convictions, not fewer police contacts.', source: 'narkopolityka/2013 - 2018 wybrane art.xlsx (wykryte)' },
  hunt: { ref: 'Hunt 2004', type: 'SR', note: 'Civil penalties for cannabis did not raise use and reduced harm to people apprehended; South Australia saw net-widening (more notices, 45% of fines paid on time).', source: `${HR}2004_NEIL_HUNT_harm reduction review` },
  singh: { ref: 'Singh 2025', type: 'monitoring', note: 'Vancouver under the 2023 decriminalisation framework, Feb to Jul 2023: 1805 police seizures alongside 9085 drug checking samples; ecological, 6 months.', source: `${HR}2025_Singh_Probing trends of opioid seizures p1` },
  caldicott: { ref: 'Caldicott 2023', type: 'opinion', note: 'ACT, Australia: about 24 months of advocacy produced the first legally sanctioned festival pill testing (April 2018).', source: `${HR}2023_Caldicott_A step change model analysis p1, p3-4` },
  bird: { ref: 'Bird 2026', type: 'survey', note: '38 services: equipment legal in 44% of Latin American vs 75% of US programmes; police confiscated supplies at 38% vs 11%; funding gaps 80% vs 54%.', source: `${HR}2026_Bird_Drug Checking Services in Latin America vs. the United States p1` },
  ondocsin: { ref: 'Ondocsin 2023', type: 'qualitative', note: 'US and Canada, 11 providers: threat of prosecution; legal exposure pushed some programmes to mobile models.', source: `${HR}2023_Ondocsin_Insights from Drug Checking Programs p4, p7` },
  kaskela: { ref: 'Kaskela 2025', type: 'evaluation', note: 'Finland, 503 samples: for legal reasons only used paraphernalia could be tested; monthly lab analysis; results collected for 208 of 503 (41%).', source: `${HR}2025_Kaskela_From trash to results p1, p3` },
  mullin: { ref: 'Mullin 2023', type: 'evaluation', note: 'UK: first Home Office licensed pharmacist-led community service, embedded in a substance use service (n = 13).', source: `${HR}2023_Mullin_Handheld Raman Spectroscopy p1` },
  verdenik26: { ref: 'Verdenik 2026', type: 'evaluation', note: 'Slovenia 2018 to 2024: from NGO initiative to nationally funded measure linked to early warning; 4338 visits, 5518 samples; 82.9% had no prior contact with drug services; results in 4 to 7 days.', source: `${HR}2026_Verdenik_I want to know what I'm taking` },
  reed24: { ref: 'Reed 2024', type: 'qualitative', note: 'Philadelphia, 40 people who use drugs: any police involvement would stop them taking part.', source: `${HR}2024_Reed_Recommendations from people who use drugs in Philadelphia p7` },
  summers: { ref: 'Summers 2026', type: 'evaluation', note: 'Boston: after a mass sweep and heavier policing, residents preferred on-site checking to off-site services given the police presence.', source: `${HR}2026_Summers_Real time, on-site drug checking p3, p5` },
  emcdda: { ref: 'EMCDDA 2001', type: 'guideline', note: 'Belgium: local police discouraged attendance with a massive physical presence; Vienna, Barcelona, Bern: police neutral or supportive.', source: `${HR}2001_EMCDDA_Pill_Testing_Fact_Files` },
  pocuca: { ref: 'Pocuca 2025', type: 'qualitative', note: 'Australia, 23 staff: agreements protecting clients from over-policing are a paramount uptake factor, with confidentiality.', source: `${HR}2025_Pocuca_Understanding Drug and Alcohol Staff Perspectives p1` },
  falzon: { ref: 'Falzon 2023', type: 'qualitative', note: 'Scotland, 43 interviews (abstract only): police approach and community attitudes are key external factors.', source: `${HR}2023_Falzon_Planning and implementing community-based drug checking services in Scotland p2` },
  carroll: { ref: 'Carroll 2022', type: 'qualitative', note: 'Boston: restricted grant funding and expensive equipment; strong funder relationships help.', source: `${HR}2022_Carroll_The Bronze Age of drug checking p1, p4-5` },
  karden: { ref: 'Karden 2025', type: 'survey', note: 'Austria, n = 1113: 20.1% had used checking; 62% of non-users had no service near home.', source: `${HR}2025_Karden_Utilization of drug checking services in Austria p4` },
  hutchison: { ref: 'Hutchison 2025', type: 'qualitative', note: 'Vancouver Island, 39 interviews: responses range from welcoming to oppositional, reflecting local politics, councils and mayors.', source: `${HR}2025_Hutchison` },
  pires: { ref: 'Pires 2024', type: 'qualitative', note: 'Porto (restrictive, zero tolerance) vs Lisbon (harm reduction focused): city policy shaped responsiveness within one national law.', source: `${HR}2024_Pires_City-level drug policies in Portugal p1` },
  caluzzi: { ref: 'Caluzzi 2023', type: 'survey', note: 'Australia, national household survey 2019: 55.8% supported drug checking, higher in cities and among the more advantaged.', source: `${HR}2023_Caluzzi` },
  coulaud: { ref: 'Coulaud 2024', type: 'qualitative', note: 'Vancouver: casual users struggle to see themselves as drug users, a moral barrier to access; stigma also burdens staff.', source: `${HR}2024_Coulaud_Implementation opportunities and challenges p5, p9` },
  olsen: { ref: 'Olsen 2022', type: 'evaluation', note: 'Australian festival pilot: 170 substances for more than 230 patrons; 88% had an accurate idea of what their drugs contained, 12% (17) had something other than expected.', source: `${HR}2022_Olsen_Music festival drug checking` },
  magnolini: { ref: 'Magnolini 2025', type: 'evaluation', note: 'Zurich: anonymous and free AAS checking; NPS 97, satisfaction 93% (n = 30).', source: `${HR}2025_Magnolini_Evaluation of implementing drug checking services for anabolic androgenic steroids p3-4, p7` },
  moon: { ref: 'Moon 2024', type: 'guideline', note: 'US consensus: published results must protect anonymity; scrutinise what data police could use.', source: `${HR}2024_Moon_Enhancing drug checking services for supply monitoring p5, p7` },
  barratt17: { ref: 'Barratt 2017', type: 'survey', note: 'Australia, 851 partygoers (stated intentions): 94% would not use a service if arrest were possible; 97% would use one police kept clear of, or with confidential results.', source: `${HR}2017_Barratt_Pill testing or drug checking in Australia Acceptability of service design features p5, p10` },
  barratt17wait: { ref: 'Barratt 2017', type: 'survey', note: 'Australia, 851 partygoers: acceptable wait 15 minutes 95%, one hour 80%, one week 61%; on-site 94%, fixed site 85%, mail 53%.', source: `${HR}2017_Barratt_Pill testing or drug checking in Australia p5, p10` },
  hutton: { ref: 'Hutton 2021', type: 'qualitative', note: 'New Zealand: legal grey area kept many events from inviting the checking service; organisers feared arrests on site.', source: `${HR}2021_Hutton` },
  mcallister: { ref: 'McAllister 2020', type: 'survey', note: 'Australia, n = 2045: 63.4% public support for festival pill testing; support split by party (National voters OR 0.36 vs Labor); NSW government rejected a coroner-recommended pilot.', source: `${HR}2020_McAllister` },
  measham19: { ref: 'Measham 2019', type: 'evaluation', note: 'UK festival 2016: stakeholders objected that checking normalises use; mis-sold samples led 66.7% to hand in more drugs vs 9.1% when as sold.', source: `${HR}2019_Measham_Drug safety testing p2, p4, p7, p10` },
  berry: { ref: 'Berry 2025', type: 'evaluation', note: 'Maryland syringe services with mail-in lab checking: +74% participant encounters per quarter, +131% wound care.', source: `${HR}2025_Berry_Impact of Lab-Based Drug Checking Services on Syringe Service Program Engagement p1-2` },
  karamouzian: { ref: 'Karamouzian 2018', type: 'evaluation', note: 'Vancouver supervised injection site: legal exemption allowed on-site checking; 79.8% of 1411 checks fentanyl positive, but only about 1% of visits involved a check.', source: `${HR}2018_Karamouzian_Evaluation of a fentanyl drug checking service p3` },
  keygan: { ref: 'Keygan 2025', type: 'RCT', note: 'Randomised online vignette, Australians using MDMA pills: after an alert 45.4% intended not to use vs 20.7% of controls (alert n = 441, control n = 184). Stated intention.', source: `${HR}2025_Keygan_Risk communication about high-dose MDMA p1` },
  silcox: { ref: 'Silcox 2026', type: 'cohort', note: 'Massachusetts, 2430 samples (preprint): new substances detected a median 249 days earlier in community samples than in police samples.', source: `${HR}2026_Silcox_Source Matters p1` },
  brunt: { ref: 'Brunt 2011', type: 'monitoring', note: 'Netherlands: the national monitoring system (DIMS) uses checking results to issue warnings about dangerous tablets.', source: `${HR}Brunt_2011b drug  information monitoring system in the netherlands DIMS p2, p5, p8` },
  graceWait: { ref: 'Grace 2023', type: 'ScR', note: 'Wait time is a frequent barrier; at one Canadian site 68% of those willing would wait up to 10 minutes.', source: `${HR}2023_Grace_Contextual factors p5` },
} satisfies Record<string, Citation>;

export const FACTORS = [
  {
    id: 'law', level: 'national_law', label: t('Personal possession'), default: 0,
    options: [
      {
        id: 'criminal', label: t('Criminal offence'), summary: t('Fear of arrest keeps some people from reaching services; police stop people for possession.'),
        effects: { deterrence: 0.25, possessionStops: true },
        evidence: [C.davis, C.wallace, C.graceScr, C.puljevic, C.art62],
      },
      {
        id: 'discretionary', label: t('Discretionary (small amounts)'), summary: t('Prosecutors may drop small-amount cases, but police still detect and stop.'),
        effects: { deterrence: 0.2, possessionStops: true },
        evidence: [C.art62a],
      },
      {
        id: 'depenalised', label: t('Depenalised (not prosecuted)'), summary: t('Still formally an offence, but users are not targeted; no possession stops.'),
        effects: { deterrence: 0.12 },
        evidence: [C.hunt, { ref: 'Brunt 2011', type: 'monitoring', note: 'Netherlands: use is not an offence and small amounts are not prosecuted; the national monitoring system (DIMS) grew inside that policy.', source: `${HR}Brunt_2011b drug  information monitoring system in the netherlands DIMS p1` }],
      },
      {
        id: 'decriminalised', label: t('Decriminalised'), summary: t('No criminal stops for possession; less fear on the way to services.'),
        effects: { deterrence: 0.08 },
        evidence: [C.hunt, C.singh],
      },
      {
        id: 'cannabisRegulated', label: t('Cannabis legal, others decriminalised'), summary: t('As decriminalised; no separate effect of a legal cannabis market is modelled.'),
        effects: { deterrence: 0.08 },
        evidence: [NO_EVIDENCE('The library has no study of regulated legal cannabis markets (only Dutch coffeeshop tolerance and pre-2004 civil-penalty schemes).'), C.hunt],
      },
    ],
  },
  {
    id: 'checkingLaw', level: 'national_law', label: t('Drug checking itself'), default: 1,
    options: [
      {
        id: 'prohibited', label: t('Not permitted'), summary: t('The stand can only give information; no samples are analysed.'),
        effects: { checkingAllowed: false },
        evidence: [C.bird, C.ondocsin],
      },
      {
        id: 'grey', label: t('Tolerated, legally unclear'), summary: t('Checking happens, but services and visitors carry legal risk.'),
        effects: { deterrence: 0.05 },
        evidence: [C.bird, C.ondocsin, C.hutton],
      },
      {
        id: 'labOnly', label: t('Permitted, lab analysis only'), summary: t('Samples go to a lab; results come days later and many are never collected.'),
        effects: { turnaround: 'lab' },
        evidence: [C.kaskela, C.barratt17wait],
      },
      {
        id: 'licensed', label: t('Licensed or state-run'), summary: t('On-site checking with results in minutes.'),
        effects: {},
        evidence: [C.caldicott, C.mullin, C.verdenik26],
      },
    ],
  },
  {
    id: 'policing', level: 'enforcement_policing', label: t('Police near services'), default: 1,
    options: [
      {
        id: 'visible', label: t('Visible deterrence'), summary: t('Officers posted near entrances; many people turn back.'),
        effects: { patrol: 2, patrolStyle: 'posted', deterrence: 0.5 },
        evidence: [C.barratt17, C.reed24, C.summers, C.emcdda],
      },
      {
        id: 'neutral', label: t('Routine patrols'), summary: t('One officer walks the street; services are not targeted.'),
        effects: { patrol: 1, patrolStyle: 'beat', deterrence: 0.06 },
        evidence: [C.emcdda],
      },
      {
        id: 'agreement', label: t('Agreement with services'), summary: t('Patrols keep clear of entrances by agreement.'),
        effects: { patrol: 1, patrolStyle: 'clear' },
        evidence: [C.barratt17, C.pocuca, C.falzon, C.emcdda],
      },
    ],
  },
  {
    id: 'funding', level: 'health_system_funding', label: t('Funding'), default: 1,
    options: [
      {
        id: 'volunteer', label: t('Volunteer, no funding'), summary: t('Services close at 22:00.'),
        effects: { closesAt: 22 * 60 },
        evidence: [C.bird, C.carroll],
      },
      {
        id: 'project', label: t('Short-term project'), summary: t('Services close at 01:00.'),
        effects: { closesAt: 25 * 60 },
        evidence: [C.carroll, C.verdenik26],
      },
      {
        id: 'stable', label: t('Stable national funding'), summary: t('Services stay open all night.'),
        effects: {},
        evidence: [C.verdenik26],
      },
    ],
  },
  {
    id: 'council', level: 'local_government_planning', label: t('City council'), default: 1,
    options: [
      {
        id: 'opposed', label: t('Opposed'), summary: t('No parking permit for the outreach camper; a 23:00 curfew for services.'),
        effects: { outreachPermitted: false, closesAt: 23 * 60 },
        evidence: [C.hutchison, C.pires, C.karden],
      },
      {
        id: 'tolerant', label: t('Tolerates services'), summary: t('Services operate; no extra support.'),
        effects: {},
        evidence: [C.hutchison],
      },
      {
        id: 'supportive', label: t('Supports services'), summary: t('Services operate with council backing.'),
        effects: {},
        evidence: [C.pires, C.falzon],
      },
    ],
  },
  {
    id: 'neighbourhood', level: 'community_attitudes_stigma', label: t('Neighbourhood attitudes'), default: 1,
    options: [
      {
        id: 'opposed', label: t('Opposed to the drop-in'), summary: t('Residents gather with placards; stigma makes more people turn back.'),
        effects: { placards: 3, deterrence: 0.12 },
        evidence: [C.hutchison, C.coulaud, C.davis, C.falzon, C.measham19],
      },
      {
        id: 'mixed', label: t('Mixed'), summary: t('Some stigma, no open opposition.'),
        effects: { deterrence: 0.04 },
        evidence: [C.caluzzi, C.mcallister],
      },
      {
        id: 'supportive', label: t('Supportive'), summary: t('No added barrier from the neighbourhood.'),
        effects: {},
        evidence: [C.caluzzi, C.falzon],
      },
    ],
  },
  {
    id: 'venue', level: 'venue_nightlife', label: t('Club management'), default: 1,
    options: [
      {
        id: 'refuses', label: t('Refuses the stand'), summary: t('The harm reduction stand cannot set up on the terrace.'),
        effects: { standPermitted: false },
        evidence: [NO_EVIDENCE('The library has no study of venue refusal; festival and club services in it all had organiser consent.')],
      },
      {
        id: 'hosts', label: t('Hosts the stand'), summary: t('The stand sets up on the club terrace.'),
        effects: {},
        evidence: [C.olsen],
      },
    ],
  },
  {
    id: 'anonymity', level: 'service_design_access', label: t('Anonymity'), default: 1,
    options: [
      {
        id: 'registered', label: t('Name or ID recorded'), summary: t('Some people turn back rather than be identified.'),
        effects: { deterrence: 0.1 },
        evidence: [C.barratt17, C.moon, C.graceScr],
      },
      {
        id: 'anonymous', label: t('Anonymous'), summary: t('No identification asked.'),
        effects: {},
        evidence: [C.magnolini, C.verdenik26],
      },
    ],
  },
  {
    id: 'checkingSite', level: 'service_design_access', label: t('Where checking happens'), default: 0,
    options: [
      {
        id: 'nightlife', label: t('At the club (nightlife stand)'), summary: t('Only the stand on the club terrace checks samples.'),
        effects: { checkingSites: ['clubHr'] },
        evidence: [C.olsen, C.barratt17wait],
      },
      {
        id: 'fixed', label: t('Fixed site (drop-in centre)'), summary: t('The drop-in centre checks samples; a sign stands on its forecourt.'),
        effects: { checkingSites: ['dropIn'] },
        evidence: [C.barratt17wait, C.verdenik26],
      },
      {
        id: 'fixedNightlife', label: t('Fixed site and club'), summary: t('Both the drop-in centre and the club stand check samples.'),
        effects: { checkingSites: ['dropIn', 'clubHr'] },
        evidence: [C.barratt17wait, C.magnolini],
      },
      {
        id: 'integrated', label: t('Integrated in harm reduction'), summary: t('Drop-in and outreach camper check samples alongside their other work.'),
        effects: { checkingSites: ['dropIn', 'outreach'] },
        evidence: [C.berry, C.karamouzian, C.verdenik26],
      },
      {
        id: 'mobileNightlife', label: t('Mobile and club'), summary: t('The outreach camper and the club stand check samples.'),
        effects: { checkingSites: ['outreach', 'clubHr'] },
        evidence: [C.ondocsin, C.bird],
      },
      {
        id: 'everywhere', label: t('Fixed, mobile and club'), summary: t('All three services check samples.'),
        effects: { checkingSites: ['dropIn', 'outreach', 'clubHr'] },
        evidence: [C.berry, C.barratt17wait],
      },
      {
        id: 'collection', label: t('Collection point, lab analysis'), summary: t('Samples go into a lab drop box at the drop-in; results come days later.'),
        effects: { checkingSites: ['dropIn'], collectionPoint: true, turnaround: 'lab' },
        evidence: [C.verdenik26, C.kaskela, C.barratt17wait],
      },
    ],
  },
  {
    id: 'alerts', level: 'health_system_funding', label: t('Early warning'), default: 0,
    options: [
      {
        id: 'none', label: t('No public alerts'), summary: t('Results stay with the person who brought the sample.'),
        effects: {},
        evidence: [C.silcox],
      },
      {
        id: 'public', label: t('Public alerts'), summary: t('A street board flashes an alert when a check finds something unexpected.'),
        effects: { publicAlerts: true },
        evidence: [C.keygan, C.brunt, C.verdenik26, C.silcox],
      },
    ],
  },
  {
    id: 'cannabisMarket', level: 'national_law', label: t('Cannabis and new substances market'), default: 1,
    options: [
      {
        id: 'prohibited', label: t('Prohibited'), summary: t('No cannabis or legal-highs shops on the street.'),
        effects: {},
        evidence: [NO_EVIDENCE('Shops are shown on the street only; no effect on use or harm is modelled.')],
      },
      {
        id: 'medical', label: t('Medical cannabis on prescription'), summary: t('A medical cannabis dispensary on the street. No separate effect on use or harm is modelled.'),
        effects: {},
        evidence: [NO_EVIDENCE('Shops are shown on the street only; no effect on use or harm is modelled.')],
      },
      {
        id: 'legalHighs', label: t('Legal highs sold openly'), summary: t('A smart shop sells new substances before they are controlled. No separate effect is modelled.'),
        effects: {},
        evidence: [NO_EVIDENCE('Shops are shown on the street only; no effect on use or harm is modelled.')],
      },
      {
        id: 'coffeeshops', label: t('Tolerated coffeeshops'), summary: t('A coffeeshop sells cannabis to adults under a tolerance policy, beside a medical dispensary. No separate effect is modelled.'),
        effects: {},
        evidence: [NO_EVIDENCE('Shops are shown on the street only; no effect on use or harm is modelled.')],
      },
      {
        id: 'regulated', label: t('Regulated cannabis retail'), summary: t('A licensed cannabis store and a medical dispensary. No separate effect is modelled.'),
        effects: {},
        evidence: [NO_EVIDENCE('Shops are shown on the street only; no effect on use or harm is modelled.')],
      },
    ],
  },
] as const satisfies readonly FactorDef[];

export type FactorId = (typeof FACTORS)[number]['id'];
export type ContextSelection = Record<FactorId, number>;

export const FACTOR_BY_ID = Object.fromEntries(FACTORS.map((f) => [f.id, f])) as unknown as Record<FactorId, FactorDef>;

export function defaultContext(): ContextSelection {
  return Object.fromEntries(FACTORS.map((f) => [f.id, f.default])) as ContextSelection;
}

/** Combines every selected option's effects with the rules documented on `ContextEffects`. */
export function combineEffects(selection: ContextSelection): ContextEffects {
  const out: ContextEffects = { ...NEUTRAL_EFFECTS };
  let pass = 1;
  for (const f of FACTORS) {
    const e: Partial<ContextEffects> = f.options[Math.min(selection[f.id], f.options.length - 1)].effects;
    if (e.deterrence) pass *= 1 - e.deterrence;
    if (e.patrol !== undefined) out.patrol = Math.max(out.patrol, e.patrol);
    if (e.patrolStyle && PATROL_ORDER.indexOf(e.patrolStyle) > PATROL_ORDER.indexOf(out.patrolStyle)) out.patrolStyle = e.patrolStyle;
    if (e.possessionStops) out.possessionStops = true;
    if (e.closesAt != null) out.closesAt = out.closesAt === null ? e.closesAt : Math.min(out.closesAt, e.closesAt);
    if (e.checkingAllowed === false) out.checkingAllowed = false;
    if (e.turnaround === 'lab') out.turnaround = 'lab';
    if (e.outreachPermitted === false) out.outreachPermitted = false;
    if (e.standPermitted === false) out.standPermitted = false;
    if (e.placards !== undefined) out.placards = Math.max(out.placards, e.placards);
    if (e.checkingSites) out.checkingSites = e.checkingSites;
    if (e.collectionPoint) out.collectionPoint = true;
    if (e.publicAlerts) out.publicAlerts = true;
  }
  out.deterrence = 1 - pass;
  return out;
}

/**
 * Drug checking outcome rates used when the stand analyses a sample. These are
 * the only rates taken from sources, each from one setting; they illustrate
 * scale and do not generalise. Counted as stated intentions, kept apart from
 * the adverse-outcome placeholder, which assumes no service effect.
 */
export const CHECKING = {
  /** Share of samples not containing only what was expected. */
  unexpected: { value: 0.35, cite: { ref: 'Barratt 2024', type: 'monitoring', note: 'Australia, 103 cryptomarket samples: 65% contained only the advertised substance.', source: `${HR}2024_Barratt_Adulteration and substitution of drugs purchased in Australia from cryptomarkets p1` } },
  /** Share of lab results that are ever collected. */
  labCollected: { value: 0.41, cite: C.kaskela },
  /** Share intending to change plans after an unexpected result. */
  changePlans: { value: 0.655, cite: { ref: 'Verdenik 2024', type: 'cohort', note: 'Slovenia, 364 clients: intention to avoid use when the sample was not as expected in 65.5% of cases.', source: `${HR}2024_Verdenik_I will not use it because the results are bad` } },
} as const satisfies Record<string, { value: number; cite: Citation }>;

/** `?ctx=law:criminal,policing:visible` lists option ids that differ from the defaults. */
export function encodeContext(selection: ContextSelection): string {
  return FACTORS.filter((f) => selection[f.id] !== f.default).map((f) => `${f.id}:${f.options[selection[f.id]].id}`).join(',');
}

export function decodeContext(text: string | null): ContextSelection {
  const sel = defaultContext();
  for (const pair of (text ?? '').split(',')) {
    const [id, optionId] = pair.split(':');
    const f = FACTOR_BY_ID[id as FactorId];
    const index = f?.options.findIndex((o) => o.id === optionId) ?? -1;
    if (f && index >= 0) sel[id as FactorId] = index;
  }
  return sel;
}
