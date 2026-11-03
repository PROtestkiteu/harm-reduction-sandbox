import type { Appearance, Archetype } from '../../agents/character';

/**
 * Crowds for the city's big days (the simulation's happenings: a football
 * match, a festival in the park, a university weekend off), as data.
 * ILLUSTRATIVE: how many walk at the height of it, how fast, and how they
 * look. The routes come from the stadium and festival gates (world/layout.ts),
 * the campus and the open bars' pavement spots (world.barSpots).
 */
export type HappeningId = 'match' | 'festival' | 'uniWeekend';

export interface CrowdKind {
  /** Walkers out at once at full crowd, and seconds between new ones. */
  most: number;
  every: number;
  /** Walking pace (m/s), and who they are. */
  pace: readonly [number, number];
  style: Archetype;
  /** Each walker's look: one of these laid over the seeded one. */
  dress: readonly Partial<Appearance>[];
  /** Overheard lines (config/flavour/lines.ts). */
  voice: string;
  /** At a bar: seconds they stand outside before moving on. */
  linger: readonly [number, number];
}

const home = 0xc8202a;
const away = 0x2a5ab8;

export const CROWD_KINDS: Record<HappeningId, CrowdKind> = {
  // Fans in the club's colours, scarves up, in loud groups; a few hooligans in black among them.
  match: {
    most: 18, every: 1.6, pace: [1.3, 1.7], style: 'everyday', voice: 'fans', linger: [40, 90],
    dress: [
      { top: home, bottom: 0x2a2a2e, extra: 'scarf', accent: home },
      { top: 0xf2f0ea, bottom: 0x2a3a5a, extra: 'scarf', accent: home },
      { top: home, bottom: 0x3a3a42, extra: 'scarf', accent: 0xf2f0ea },
      { top: 0x15151a, bottom: 0x15151a, extra: 'jacket', accent: 0x15151a, kit: { hood: 'up' } },
      { top: away, bottom: 0x2a2a2e, extra: 'scarf', accent: away },
    ],
  },
  // Festival-goers: bright clothes, bucket hats, backpacks.
  festival: {
    most: 16, every: 1.4, pace: [1.0, 1.35], style: 'raver', voice: 'festival', linger: [30, 60],
    dress: [{ extra: 'backpack' }, { extra: 'backpack', kit: { bucketHat: true } }, {}, { kit: { bucketHat: true } }],
  },
  // Students out to the bars, busiest about midnight.
  uniWeekend: {
    most: 14, every: 2.2, pace: [1.1, 1.4], style: 'student', voice: 'student', linger: [60, 150],
    dress: [{ extra: 'backpack' }, {}, { extra: 'bag' }, { kit: { hood: 'down' } }],
  },
};
