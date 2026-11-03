import type { TouristGroup } from './tourists';

/**
 * Clergy out on the street, as data. A Corpus Christi-style procession: a
 * server with the processional cross, two with candles, the priest under a
 * canopy carried on four poles, nuns and parishioners with candles and a
 * banner, walking slowly and stopping to pray. And a walk of the district's
 * three faiths together: a priest, a rabbi and an imam, talking. Dress and
 * props only; walked on the tourists' routes (config/flavour/tourists.ts).
 * ILLUSTRATIVE.
 */
const black = 0x15151a;
const white = 0xf0eee6;

export const CLERGY_GROUPS: readonly TouristGroup[] = [
  {
    id: 'procession', pace: 0.6, stop: 14, voice: 'procession',
    members: [
      { dress: { top: white, bottom: black, extra: 'none' }, props: ['processionCross'] },
      { dress: { top: white, bottom: black }, props: ['candle'] },
      { dress: { top: white, bottom: black }, props: ['candle'] },
      { dress: { top: 0xf2e6c0, bottom: white, accent: 0xd8b048, hairStyle: 3 }, props: ['canopy', 'stole'] },
      { dress: { top: 0x1e2030, bottom: 0x1e2030, skirt: true }, props: ['veil', 'candle'] },
      { dress: { top: 0x1e2030, bottom: 0x1e2030, skirt: true }, props: ['veil'] },
      { dress: { top: 0x6a5a48, bottom: 0x3a3a42 }, props: ['banner'] },
      { dress: { top: 0x8a7a6a, bottom: 0x3a3a42 }, props: ['candle'] },
    ],
  },
  {
    id: 'interfaith', pace: 0.95, stop: 10, voice: 'interfaith',
    members: [
      { dress: { top: black, bottom: black, hairStyle: 3 }, props: ['stole'] },
      { dress: { top: black, bottom: black, extra: 'jacket', accent: black, beard: true }, props: ['blackHat'] },
      { dress: { top: white, bottom: white, beard: true }, props: ['taqiyah'] },
    ],
  },
];
