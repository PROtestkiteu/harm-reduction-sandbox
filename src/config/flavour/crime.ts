import { t } from '../../i18n';

/**
 * More kinds of everyday street crime, shown where they happen. These are a
 * flavour layer: they never touch the simulation's incidents, money or random
 * stream (sim/flavourCrime.ts has its own), so a scenario plays the same with
 * them on or off. Rates are ILLUSTRATIVE placeholders, expected incidents per
 * clock hour; like the simulation's own crime, none is attributed to people
 * who use drugs.
 */
export type FlavourCrime = 'phoneSnatch' | 'shoplifting' | 'vandalism' | 'flyTipping';

export interface CrimeInfo {
  label: string;
  /** Per clock hour, in the hours it can happen ([from, to) clock minutes, 18:00 = 1080, past midnight runs on to 1800). */
  rate: number;
  hours: readonly [number, number];
  /** What a witness says (overheard lines, at the scene). */
  cry: string;
  /** Wardens write it up; they come over if they are near. */
  guardAttends: boolean;
  /** How long what is left behind stays, in clock minutes (0: nothing stays). */
  lasts: number;
}

export const FLAVOUR_CRIMES: Record<FlavourCrime, CrimeInfo> = {
  phoneSnatch: { label: t('phone snatches'), rate: 0.35, hours: [1200, 1620], cry: t('Hey! My phone!'), guardAttends: true, lasts: 0 },
  shoplifting: { label: t('shoplifting'), rate: 0.45, hours: [1080, 1380], cry: t('Oi, come back here!'), guardAttends: true, lasts: 0 },
  vandalism: { label: t('smashed glass'), rate: 0.3, hours: [1320, 1710], cry: t('Someone kicked the shelter in.'), guardAttends: true, lasts: 480 },
  flyTipping: { label: t('fly-tipping'), rate: 0.25, hours: [1260, 1740], cry: t('Who dumps a mattress here?'), guardAttends: false, lasts: 900 },
};

/** Fewer incidents with more police about (the same damping as the simulation's own crime). */
export const POLICE_DAMP = 0.5;
/** Fly-tipped rubbish and broken glass are cleared once the bin crew passes, if the service pack runs. */
export const CLEARED_BY_CREW: readonly FlavourCrime[] = ['flyTipping', 'vandalism'];

/** Where each kind happens: the spot, and for a thief on foot or wheels, the way they get away. */
export interface CrimeSite { at: { x: number; z: number }; away: { x: number; z: number } }

/** On the inner ring's pavements, which no crowd walks, so nothing here blocks anyone. */
export const CRIME_SITES: Record<FlavourCrime, readonly CrimeSite[]> = {
  // The victim stands at the kerb; the scooter comes up the pavement behind them and away.
  phoneSnatch: [
    { at: { x: 47.0, z: 8 }, away: { x: 46.8, z: -46 } },
    { at: { x: 47.0, z: -30 }, away: { x: 46.8, z: -46 } },
    { at: { x: 10, z: 47.0 }, away: { x: 46, z: 46.8 } },
  ],
  // A shop door; the thief runs off along the pavement.
  shoplifting: [
    { at: { x: 45.3, z: 25.5 }, away: { x: 46.4, z: 46 } },
    { at: { x: -30, z: 45.3 }, away: { x: -46, z: 46.2 } },
    { at: { x: 45.3, z: -28 }, away: { x: 46.4, z: -46 } },
  ],
  vandalism: [
    { at: { x: 46.0, z: -2 }, away: { x: 46.0, z: -2 } },
    { at: { x: -15, z: 46.8 }, away: { x: -15, z: 46.8 } },
  ],
  flyTipping: [
    { at: { x: 46.9, z: 14.5 }, away: { x: 46.9, z: 14.5 } },
    { at: { x: 46.9, z: -38.5 }, away: { x: 46.9, z: -38.5 } },
    { at: { x: -46.9, z: 8 }, away: { x: -46.9, z: 8 } },
  ],
};
