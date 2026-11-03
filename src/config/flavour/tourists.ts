import type { Appearance } from '../../agents/character';
import type { P } from './street';

/**
 * Tourist groups, as data: affectionate, deliberately over-the-top tourist
 * clichés, told through clothes, props and behaviour (never faces or skin,
 * which stay the city's usual mix). A group of three to five walks one of the
 * routes, stops at a sight or two to take photos, says a few things, and
 * moves on; one group at a time. ILLUSTRATIVE; routes face the camera and no
 * crowd walks them (checked by `npm run clearance`).
 */
export type Nationality = 'british' | 'german' | 'american' | 'japanese' | 'italian' | 'french' | 'dutch';

/** Props a tourist carries, drawn as small models that follow them (world/flavour/tourists.ts). */
export type TouristProp = 'cap' | 'beret' | 'sunglasses' | 'socks' | 'can' | 'map' | 'camera' | 'flag' | 'sash' | 'baguette' | 'bucketHat' | 'hornHat'
  // Clergy (config/flavour/clergy.ts).
  | 'processionCross' | 'candle' | 'canopy' | 'banner' | 'stole' | 'blackHat' | 'kippah' | 'taqiyah' | 'veil'
  // Business people (config/flavour/business.ts).
  | 'briefcase' | 'tie' | 'coffee' | 'lanyard';

export interface TouristGroup {
  id: Nationality | string;
  /** Each member's look laid over a tourist's seeded one, and their props. */
  members: readonly { dress: Partial<Appearance>; props: readonly TouristProp[] }[];
  /** Walking pace (m/s): a stag do ambles, a tour group keeps up with its flag. */
  pace: number;
  /** Seconds at each sight. */
  stop: number;
  /** Their lines, in config/flavour/lines.ts under this voice. */
  voice: string;
}

const pink = 0xf06aa8;
const beige = 0xc8b48a;

export const TOURIST_GROUPS: readonly TouristGroup[] = [
  {
    // A stag do: matching pink T-shirts, cans in hand, the groom in a sash.
    id: 'british', pace: 1.05, stop: 9, voice: 'stagDo',
    members: [
      { dress: { top: 0xe8e2d6, bottom: 0x2a3a5a, shortSleeves: true }, props: ['sash', 'can'] },
      { dress: { top: pink, bottom: 0x3a4a6a, shortSleeves: true }, props: ['can'] },
      { dress: { top: pink, bottom: 0x2a2a2e, shortSleeves: true }, props: ['can', 'hornHat'] },
      { dress: { top: pink, bottom: 0x4a5a3a, shortSleeves: true }, props: [] },
    ],
  },
  {
    // Socks with sandals, beige shorts, a laminated map and a plan.
    id: 'german', pace: 1.35, stop: 7, voice: 'germanTour',
    members: [
      { dress: { top: 0x6a8a5a, bottom: beige, shortSleeves: true, extra: 'backpack' }, props: ['socks', 'map', 'bucketHat'] },
      { dress: { top: 0x8a3a3a, bottom: beige, shortSleeves: true, extra: 'backpack' }, props: ['socks', 'camera'] },
      { dress: { top: 0x3a5a8a, bottom: beige, shortSleeves: true }, props: ['socks'] },
    ],
  },
  {
    // Baseball caps, big cameras, everything amazing.
    id: 'american', pace: 1.1, stop: 10, voice: 'americanTour',
    members: [
      { dress: { top: 0xd8d2c4, bottom: 0x3a4a6a, girth: 0.6, extra: 'bag' }, props: ['cap', 'camera'] },
      { dress: { top: 0xb83a3a, bottom: 0x2a3a5a, girth: 0.5 }, props: ['cap', 'sunglasses'] },
      { dress: { top: 0x3a5a9a, bottom: beige, girth: 0.4 }, props: ['camera'] },
    ],
  },
  {
    // A tour group following the guide's raised flag, everyone photographing everything.
    id: 'japanese', pace: 1.3, stop: 8, voice: 'tourGroup',
    members: [
      { dress: { top: 0x2a3a5a, bottom: 0x2a2a2e }, props: ['flag'] },
      { dress: { top: 0xe8e6e0, bottom: 0x4a4a52, extra: 'bag' }, props: ['camera', 'bucketHat'] },
      { dress: { top: 0xd8b8c8, bottom: 0x3a3a42 }, props: ['camera'] },
      { dress: { top: 0x8aa0b8, bottom: 0x2a2a2e, extra: 'backpack' }, props: ['camera'] },
      { dress: { top: 0xe0e0d8, bottom: 0x5a5a62 }, props: ['camera', 'sunglasses'] },
    ],
  },
  {
    // Sharp clothes, sunglasses after dark, opinions about the coffee.
    id: 'italian', pace: 0.95, stop: 9, voice: 'italianTour',
    members: [
      { dress: { top: 0x1e2a3a, bottom: 0xd8d0bc, extra: 'scarf' }, props: ['sunglasses'] },
      { dress: { top: 0xe8e2d6, bottom: 0x2a2a2e, extra: 'jacket', accent: 0x6a3a2a }, props: ['sunglasses'] },
      { dress: { top: 0x8a2a3a, bottom: 0x1e1e22 }, props: ['sunglasses'] },
    ],
  },
  {
    // Breton stripes, a beret and a baguette under the arm.
    id: 'french', pace: 1.0, stop: 8, voice: 'frenchTour',
    members: [
      { dress: { top: 0xe8e6e0, bottom: 0x2a2a3a }, props: ['beret', 'baguette'] },
      { dress: { top: 0x1e2a4a, bottom: 0x2a2a2e, extra: 'scarf' }, props: ['beret'] },
      { dress: { top: 0xe8e6e0, bottom: 0x3a2a2a }, props: ['baguette'] },
    ],
  },
  {
    // Everything orange, tall, and appalled by the cycle lanes being only a strip.
    id: 'dutch', pace: 1.4, stop: 7, voice: 'dutchTour',
    members: [
      { dress: { top: 0xf07a1a, bottom: 0x2a3a5a, height: 1.92 }, props: ['cap'] },
      { dress: { top: 0xf07a1a, bottom: 0x2a2a2e, height: 1.86 }, props: [] },
      { dress: { top: 0xf0902a, bottom: 0x3a4a6a, height: 1.95 }, props: ['sunglasses'] },
    ],
  },
];

/**
 * Routes along the ring road's outer north and west pavements (they face the
 * camera). A group stops on reaching each listed vertex, turned to `face`, to
 * take in the sight and photograph it.
 */
export const TOURIST_ROUTES: readonly { path: readonly P[]; sights: readonly { at: number; face: number }[] }[] = [
  { path: [{ x: 44, z: -53.9 }, { x: -4, z: -53.9 }, { x: -53.9, z: -53.9 }, { x: -53.9, z: 30 }], sights: [{ at: 1, face: Math.PI }, { at: 2, face: Math.PI / 4 }] },
  { path: [{ x: -53.9, z: 36 }, { x: -53.9, z: -10 }, { x: -53.9, z: -53.9 }, { x: 40, z: -53.9 }], sights: [{ at: 1, face: -Math.PI / 2 }, { at: 2, face: -Math.PI / 4 }] },
];

export const TOURISTS = {
  /** Seconds between groups, and when they are about (clock minutes: 10:00 to 23:00, as the clock runs from 18:00 = 1080). */
  gap: [40, 110] as const,
  hours: [[1080, 1380], [2040, 2520]] as const,
  /** Members walk this far behind each other, and this far apart side to side. */
  spacing: 0.9,
  side: 0.6,
};
