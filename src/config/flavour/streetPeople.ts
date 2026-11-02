import type { Appearance } from '../../agents/character';
import type { VisitorKind, Stance } from '../streetVisitors';
import { t } from '../../i18n';
import type { P } from './street';

/**
 * Where the simulation's petty thefts (sim/pettyCrime.ts) and its pickets,
 * priests and nuns (sim/streetVisitors.ts) are shown. ILLUSTRATIVE placements
 * on the inner ring's pavements, which no crowd walks, checked by
 * `npm run clearance`. The shops are the crime pack's shop doors
 * (config/flavour/crime.ts CRIME_SITES.shoplifting), in the same order as the
 * simulation's SHOP_NAMES.
 */

/** A pickpocket's beat: the victim walks from `from` to `to`; the thief closes in behind and peels off to `away`. */
export const PICKPOCKET_BEATS: readonly { from: P; to: P; away: P }[] = [
  { from: { x: 46.3, z: -40 }, to: { x: 46.3, z: -20 }, away: { x: 46.3, z: -46 } },
  { from: { x: -38, z: 46.3 }, to: { x: -18, z: 46.3 }, away: { x: -46, z: 46.3 } },
  { from: { x: 46.3, z: 34 }, to: { x: 46.3, z: 14 }, away: { x: 46.3, z: 46 } },
];

export const THIEVES = {
  /** Walking speed of the victim, the thief closing in, and the thief getting away (m/s). */
  walk: 1.2,
  close: 1.7,
  run: 3.6,
  /** Seconds until the victim notices, pats their pockets, and gives up. */
  notice: 3,
  pat: 4,
  /** Seconds a shoplifter is inside, and a caught one is held at the door. */
  inside: [4, 7] as const,
  held: 10,
  /** A guard stands this far out from the shop door, a little to one side (metres). */
  guardOut: 0.8,
  guardAlong: 1.3,
} as const;

/** What people say. */
export const THIEF_LINES = {
  pickpocket: [t('My wallet! Someone had my wallet!'), t('Wait, where is my phone?'), t('My bag is open.')],
  shoplifting: [t('Oi, come back here!'), t('That is not paid for!')],
  caught: [t('Not so fast. Wait here.'), t('Put it back on the counter.')],
} as const;

/**
 * The picket, priest or nun stands out on the drop-in's pavement, facing the
 * door; a picket is three people a metre apart. The drop-in moves from launch
 * to launch, so the pack picks the row nearest the door that keeps `clear`
 * metres from the crowd's walking lines, within this range, local to the drop-in's frame
 * (world/layout.ts VENUE_FRAME.dropIn): metres along the front, and out from it.
 */
export const VISIT_ROOM = { along: [-8, 8] as const, out: [-2.4, -5.2] as const, clear: 0.35 };

/** How each kind looks: clerical black (a priest), a dark habit with the hood up as a veil (a nun), everyday clothes (a picket). */
export const VISIT_DRESS: Record<VisitorKind, Partial<Appearance>> = {
  picket: {},
  priest: { top: 0x15151a, bottom: 0x15151a, accent: 0x15151a, hairStyle: 3, extra: 'none' },
  nun: { top: 0x1a1a22, bottom: 0x1a1a22, accent: 0x1a1a22, skirt: true, extra: 'none' },
};

export const VISIT_LINES: Record<Stance, Record<VisitorKind, readonly string[]>> = {
  oppose: {
    picket: [t('Not in our street!'), t('Close it down!'), t('Think of the children!')],
    priest: [t('There is another way. Turn back.'), t('This place only keeps you sick.')],
    nun: [t('Go home, child, and pray.'), t('You do not need this place.')],
  },
  support: {
    picket: [t('We remember them tonight.'), t('Every life is worth saving.')],
    priest: [t('Tea? Nobody here will judge you.'), t('You are welcome, whatever brings you.')],
    nun: [t('Take a blanket, it is cold.'), t('Sit with me a while.')],
  },
};
