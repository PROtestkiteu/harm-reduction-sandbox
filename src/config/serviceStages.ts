import { t } from '../i18n';
import type { Activity } from './serviceMix';
import type { ServiceId } from '../sim/types';

/**
 * How each service grows, from a small start to its full form, as real
 * services are set up and scaled (Chemical Safety/Wiedza; notes in the
 * side-session file service-staging-evidence.md). Investing fills a bar; a
 * full bar builds the next stage, which shows on the street.
 *
 * Places and upkeep are ILLUSTRATIVE: the library gives stages and rough
 * throughput from single pilots, not rates to copy. Stage 2 is today's
 * baseline; the three services a game starts with begin there, services
 * opened later begin at stage 1.
 */
export interface ServiceStage {
  /** Short name, as on the place card. */
  label: string;
  /** What it is, in one line. */
  does: string;
  /** Places added to (or, below the baseline, taken from) the service's capacity. */
  places: number;
  /** Mix activities this stage sets up at the place, no separate equipment purchase needed. */
  unlocks?: readonly Activity[];
  /** Where the stage comes from: file and page, or "no evidence in library". */
  source: string;
}

export const SERVICE_STAGES: Record<ServiceId, readonly ServiceStage[]> = {
  drugChecking: [
    { label: t('Reagent kits on a table'), does: t('Colour tests and test strips: a first answer in minutes, run by trained peers.'), places: -2, source: '2009_CharloisGuide_SaferNightLife p6; 2011_EU_NEWIP_Guidelines for Drug Checking Methodology p28' },
    { label: t('Spectrometer in a tent'), does: t('An FTIR scan in under two minutes, with a chemist and a quiet booth to talk results through.'), places: 0, unlocks: ['checking'], source: '2019_Measham_Drug safety testing... p2, p5; CDA-AMC drug checking technologies p34, p117' },
    { label: t('Lab bus'), does: t('A bus with an HPLC bench: it measures how strong a pill is, not only what is in it.'), places: 2, source: '2011_EU_NEWIP_Guidelines for Drug Checking Methodology p18 to p21; 2001_EMCDDA_Pill_Testing_Fact_Files p15' },
    { label: t('Lab drop-off point'), does: t('Samples go by courier to a GC-MS lab: up to a hundred a week, results in days.'), places: 4, source: '2011_EU_NEWIP_Guidelines for Drug Checking Methodology p7, p14 to p15; 2025_Kaskela_From trash to results p1' },
  ],
  clubHr: [
    { label: t('Peer info stand'), does: t('Leaflets, water, earplugs and condoms from trained peers.'), places: -2, source: '2009_CharloisGuide_SaferNightLife p5 to p6' },
    { label: t('Chill-out space'), does: t('A quiet corner with sofas, water and fruit where people come down safely.'), places: 0, source: '2009_CharloisGuide_SaferNightLife p6' },
    { label: t('Testing corner'), does: t('Checking beside the stand, with someone to explain the result.'), places: 2, unlocks: ['checking'], source: '2009_CharloisGuide_SaferNightLife p6 to p7; 2015_EU_NEWIP_Drug checking_standards p36, p42' },
    { label: t('Safer nightlife label'), does: t('Free water, first aid and door staff trained by the peers.'), places: 4, source: '2009_CharloisGuide_SaferNightLife p5, p7 to p8' },
  ],
  outreach: [
    { label: t('Supply van'), does: t('A van at a regular spot with clean kit at the side door.'), places: -2, source: '2004_NEIL_HUNT_harm reduction review p9 to p10' },
    { label: t('Van with a sample box'), does: t('A lockbox for samples; results come back days later.'), places: 0, source: 'Carroll, community drug checking (HR Drug Checking) p8 to p9' },
    { label: t('Van with a spectrometer'), does: t('An FTIR bench and a laptop on board: results at the kerb.'), places: 2, unlocks: ['checking'], source: 'Carroll p5 to p7; 2020_Wallace_What is needed for implementing drug checking services p8, p10' },
    { label: t('Clinical van alongside'), does: t('A second van for wound care, testing and same-day prescriptions.'), places: 4, source: 'Carroll p3' },
  ],
  footPatrol: [
    { label: t('Workers on foot'), does: t('Two workers with backpacks: condoms, leaflets, a word.'), places: -2, source: '2004_NEIL_HUNT_harm reduction review p12 to p13' },
    { label: t('Needle exchange table'), does: t('Sterile kit handed out, used kit taken back in a sharps bin.'), places: 0, source: '2004_NEIL_HUNT_harm reduction review p9, p13' },
    { label: t('Vending machine'), does: t('Kits, naloxone and test strips around the clock.'), places: 2, source: '2004_NEIL_HUNT_harm reduction review p9 to p10, p12' },
    { label: t('Used kit to the lab'), does: t('Discarded kit is collected and analysed: what is going round, month by month.'), places: 4, source: '2025_Kaskela_From trash to results p1' },
  ],
  dropIn: [
    { label: t('Counter and chairs'), does: t('A counter, a few chairs, hot drinks and supplies.'), places: -2, source: '2009_CharloisGuide_SaferNightLife p6; Vale 2025 p4 to p5' },
    { label: t('Drop-in with test strips'), does: t('Test strips at the counter for whoever asks.'), places: 0, unlocks: ['checking'], source: '2018_Karamouzian_Evaluation of a fentanyl drug checking service p1' },
    { label: t('Mobile consumption van'), does: t('A van with booths where the scene is: use with someone there.'), places: 2, source: 'Vale 2025 p3' },
    { label: t('Supervised consumption room'), does: t('Booths, oxygen and nurses: overdoses managed on the spot.'), places: 4, source: '2004_NEIL_HUNT_harm reduction review p22, p31 to p32' },
  ],
  shelter: [
    { label: t('Hall of beds'), does: t('Beds and a canteen for the night.'), places: -2, source: 'Vale 2025 p2' },
    { label: t('Low-threshold shelter'), does: t('A dispensing room: substitution, clean kit and naloxone; places for women and LGBT people.'), places: 0, source: 'Vale 2025 p3, p9' },
    { label: t('Checking in the common room'), does: t('Visiting checking sessions where people live.'), places: 2, unlocks: ['checking'], source: 'Summers (HR Drug Checking) p1, p5; 2022_Wallace p8' },
  ],
  clinic: [
    { label: t('Naloxone at discharge'), does: t('Nasal naloxone and test strips handed over when people leave A&E.'), places: -2, source: 'Kannam (HR Drug Checking) p1; 2004_NEIL_HUNT_harm reduction review p10' },
    { label: t('Medical tent'), does: t('A first aid tent by the checking service: fewer ambulance runs.'), places: 0, source: 'Olsen (HR Drug Checking) p4, p11; 2021_Hutton p19' },
    { label: t('Clinical van'), does: t('Wound care and testing out on the street.'), places: 2, source: 'Carroll p3; Berry (HR Drug Checking) p4' },
    { label: t('Substitution clinic'), does: t('Prescribed substitution with daily dispensing.'), places: 4, source: '2004_NEIL_HUNT_harm reduction review p14, p22' },
  ],
};

/** Stage index (1-based) a service starts at: the starting services at their usual size, the rest small. */
export const BASE_STAGE = 2;
export const NEW_STAGE = 1;
export const stageCount = (id: ServiceId): number => SERVICE_STAGES[id].length;
export const stageOf = (id: ServiceId, level: number): ServiceStage => SERVICE_STAGES[id][Math.min(SERVICE_STAGES[id].length, Math.max(1, level)) - 1];
