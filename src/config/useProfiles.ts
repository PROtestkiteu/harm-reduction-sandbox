/**
 * Archetypes of people who use drugs, for the person card. Each one is drawn
 * from a study in the DrugsPRO research library (Chemical Safety/Wiedza) and
 * names it. They describe common patterns, not any real person, and the
 * figures in the scene are assigned one by where they are heading.
 */
import { t } from '../i18n';
export type UseProfileId =
  | 'weekendRaver' | 'festivalDoubleDropper' | 'chemsexGuest' | 'psychonaut' | 'oatClient'
  | 'streetInjecting' | 'mephedroneInjecting' | 'collegeStudent' | 'afterWorkCocaine' | 'olderCannabis'
  | 'spiceSmoker' | 'ketamineRegular' | 'darknetShopper' | 'friendChecker';

export interface UseProfile {
  name: string;
  blurb: string;
  uses: string;
  risks: string;
  source: string;
}

export const USE_PROFILES: Record<UseProfileId, UseProfile> = {
  weekendRaver: {
    name: t('Weekend raver'),
    blurb: t('Works or studies in the week and goes out hard from Friday to Sunday, mixing several drugs across one long night.'),
    uses: t('alcohol, MDMA, speed, cocaine, cannabis'),
    risks: t('mixing, overheating, pills of unknown strength'),
    source: 'Hungerbuehler 2011: party-goers mostly aged 20 to 35; ecstasy, amphetamines, cannabis and cocaine were the most used.',
  },
  festivalDoubleDropper: {
    name: t('Festival double dropper'),
    blurb: t('Young, out for a festival weekend. Often takes two pills at once, from the days when pills were weak.'),
    uses: t('MDMA pills, alcohol, nitrous oxide'),
    risks: t('high MDMA doses, adulterated pills, dehydration'),
    source: 'Grigg 2018: 48% of 777 festival pill users took two at once last time (median age 20).',
  },
  chemsexGuest: {
    name: t('Chemsex party guest'),
    blurb: t('Usually a gay or bi man in his thirties or older, at sex parties that can run for days. Some smoke, some inject.'),
    uses: t('meth, mephedrone, 3-MMC, GHB or GBL, poppers'),
    risks: t('GHB overdose, infections, one cathinone sold as another'),
    source: 'García 2023: cathinones often substituted; injecting and snorting each 42% of routes.',
  },
  psychonaut: {
    name: t('Careful psychonaut'),
    blurb: t('Plans trips, reads forums and keeps notes. Buys blotters and powders, sometimes new tryptamines.'),
    uses: t('LSD, mushrooms, 2C-B, newer tryptamines'),
    risks: t('NBOMe or DOx sold as LSD, hard trips, unclear doses'),
    source: 'Hirschfeld 2021: about 80% of samples sold as LSD were LSD; the rest held other psychedelics.',
  },
  oatClient: {
    name: t('On methadone'),
    blurb: t('Used heroin for years and now collects methadone or buprenorphine. Still uses now and then, and worries about fentanyl.'),
    uses: t('methadone, buprenorphine, heroin, benzodiazepines'),
    risks: t('overdose when topping up, fentanyl in heroin, benzos with opioids'),
    source: 'Sutherland 2025: 71% had overdosed on opioids at some point; 76% worried about fentanyl.',
  },
  streetInjecting: {
    name: t('Injecting, sleeping rough'),
    blurb: t('Injects opioids several times a day and sleeps outside or in shelters. Street opioids are now mostly fentanyl, often with benzos.'),
    uses: t('fentanyl, heroin, street benzos, stimulants'),
    risks: t('overdose, sedation naloxone cannot reverse, vein damage'),
    source: 'Karamouzian 2018: 79.8% of 1411 checks at a supervised site were fentanyl positive.',
  },
  mephedroneInjecting: {
    name: t('Injecting mephedrone'),
    blurb: t('Started by snorting cathinones and moved to injecting when the nose gave out. Redoses many times a session.'),
    uses: t('mephedrone, 3-MMC, alpha-PVP, meth'),
    risks: t('abscesses and thrombosis, constant redosing, no sleep'),
    source: 'Poradnik NSP (Wojnar, ed.): 17.7% of people in a 2016 Polish survey had used mephedrone.',
  },
  collegeStudent: {
    name: t('First-year student'),
    blurb: t('Lives in halls, drinks with friends and sometimes takes speed or pills to stay up for exams or parties.'),
    uses: t('alcohol, speed, MDMA, cocaine'),
    risks: t('alcohol with stimulants, no sleep, not knowing the services'),
    source: 'Boys 2001: 91.3% of people using amphetamines used them to stay awake, 29.4% to study.',
  },
  afterWorkCocaine: {
    name: t('After-work cocaine'),
    blurb: t('Well paid, has a few drinks after work and does lines in the bar toilets to keep going.'),
    uses: t('cocaine, alcohol, sometimes MDMA'),
    risks: t('cocaine with alcohol on the heart, levamisole cuts, creeping use'),
    source: 'Sutherland 2018: the ecstasy and cocaine group (19%) was less likely to be on a low income.',
  },
  olderCannabis: {
    name: t('Older cannabis smoker'),
    blurb: t('Middle-aged, has smoked for years, mostly in the evening to sleep or ease pain. Would like to know what is in the weed.'),
    uses: t('cannabis, hash, CBD flower'),
    risks: t('synthetic cannabinoids sprayed on weed, dependence, tobacco'),
    source: 'Sutherland 2018: cannabis-only users were the largest group (46%) and older than the rest.',
  },
  spiceSmoker: {
    name: t('Smokes spice'),
    blurb: t('Out of prison or under drug tests, so smokes spice that standard tests miss. Some get it unknowingly on cheap CBD weed.'),
    uses: t('synthetic cannabinoids, low-THC weed, alcohol'),
    risks: t('seizures and collapse, unknown strength, dependence'),
    source: 'Monti 2022: half of 94 checked low-THC samples held synthetic cannabinoids.',
  },
  ketamineRegular: {
    name: t('Ketamine regular'),
    blurb: t('Went from a bump at the club to ketamine most days. Bladder pain is starting.'),
    uses: t('ketamine, MDMA, cocaine, alcohol'),
    risks: t('bladder damage, dependence, falls'),
    source: 'Winstock 2012: 26.6% of people using ketamine had urinary symptoms; half improved after cutting down.',
  },
  darknetShopper: {
    name: t('Darknet shopper'),
    blurb: t('Young and online. Avoids street dealers and orders to the door, often sharing with friends.'),
    uses: t('MDMA, cannabis, LSD, new substances'),
    risks: t('mislabelled products, strong doses by post, a parcel at the door'),
    source: 'Barratt 2016: 3% met threats buying online, against 35% buying from strangers.',
  },
  friendChecker: {
    name: t('Checks for friends'),
    blurb: t("The one in the group who takes everyone's bags to drug checking and passes the results on."),
    uses: t('MDMA, cocaine, ketamine'),
    risks: t('results lost on the way, batches differ, carrying for others'),
    source: 'Larnder 2021: 52% checked for reasons beyond their own use, mostly for friends.',
  },
};

/** Who tends to be heading where. Weighted lists; repeats raise the weight. */
export const PROFILES_BY_GOAL: Record<string, readonly UseProfileId[]> = {
  club: ['weekendRaver', 'weekendRaver', 'weekendRaver', 'ketamineRegular', 'afterWorkCocaine', 'collegeStudent', 'collegeStudent', 'darknetShopper', 'psychonaut', 'chemsexGuest'],
  clubHr: ['weekendRaver', 'weekendRaver', 'ketamineRegular', 'collegeStudent', 'friendChecker', 'festivalDoubleDropper'],
  party: ['festivalDoubleDropper', 'festivalDoubleDropper', 'festivalDoubleDropper', 'weekendRaver', 'psychonaut', 'collegeStudent'],
  dropIn: ['streetInjecting', 'streetInjecting', 'mephedroneInjecting', 'spiceSmoker', 'oatClient'],
  outreach: ['streetInjecting', 'streetInjecting', 'spiceSmoker', 'mephedroneInjecting', 'oatClient'],
  footPatrol: ['mephedroneInjecting', 'streetInjecting', 'oatClient', 'chemsexGuest'],
  drugChecking: ['friendChecker', 'friendChecker', 'psychonaut', 'darknetShopper', 'weekendRaver', 'olderCannabis', 'chemsexGuest'],
  shelter: ['streetInjecting', 'streetInjecting', 'spiceSmoker'],
  clinic: ['oatClient', 'oatClient', 'ketamineRegular', 'chemsexGuest', 'mephedroneInjecting'],
};

/** Passers-by: most use nothing; a few fit an archetype that matches how they look. */
export const PROFILES_BY_GROUP: Record<string, readonly UseProfileId[]> = {
  raver: ['weekendRaver', 'ketamineRegular', 'darknetShopper'],
  student: ['collegeStudent', 'darknetShopper', 'psychonaut'],
  office: ['afterWorkCocaine'],
  older: ['olderCannabis'],
  unhoused: ['streetInjecting', 'spiceSmoker'],
  everyday: ['olderCannabis', 'darknetShopper'],
  worker: ['olderCannabis', 'afterWorkCocaine'],
  technoBlack: ['ketamineRegular', 'weekendRaver', 'friendChecker'],
  punk: ['weekendRaver', 'olderCannabis', 'spiceSmoker'],
  goth: ['psychonaut', 'weekendRaver'],
  hiphop: ['olderCannabis', 'afterWorkCocaine', 'darknetShopper'],
  queerRave: ['chemsexGuest', 'weekendRaver', 'ketamineRegular'],
  metal: ['olderCannabis', 'weekendRaver'],
};
