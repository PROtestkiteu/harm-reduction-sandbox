import type { TouristGroup } from './tourists';

/**
 * Business people, as data: in suits with briefcases, takeaway coffee and
 * lanyards, walking briskly to and from the office in the morning and early
 * evening, on the phone, talking shop. Walked on the tourists' routes
 * (config/flavour/tourists.ts). ILLUSTRATIVE.
 */
const navy = 0x1e2638;
const charcoal = 0x2e3036;
const shirt = 0xe8ecf0;

export const BUSINESS_GROUPS: readonly TouristGroup[] = [
  {
    id: 'suits', pace: 1.55, stop: 5, voice: 'business',
    members: [
      { dress: { top: shirt, accent: navy, bottom: navy, extra: 'jacket', hairStyle: 3 }, props: ['tie', 'briefcase'] },
      { dress: { top: shirt, accent: charcoal, bottom: charcoal, extra: 'jacket', hairStyle: 0 }, props: ['tie', 'coffee'] },
    ],
  },
  {
    id: 'startup', pace: 1.45, stop: 6, voice: 'startup',
    members: [
      { dress: { top: 0x2a2a2e, bottom: 0x3a4a6a, extra: 'backpack' }, props: ['lanyard', 'coffee'] },
      { dress: { top: 0xd8d2c4, bottom: 0x2a2a2e, extra: 'bag' }, props: ['lanyard'] },
      { dress: { top: 0x5a6a7a, bottom: 0x3a3a42, extra: 'backpack' }, props: ['lanyard', 'coffee'] },
    ],
  },
  {
    id: 'bankers', pace: 1.35, stop: 5, voice: 'business',
    members: [
      { dress: { top: shirt, accent: 0x15151a, bottom: 0x15151a, extra: 'jacket', girth: 0.4 }, props: ['tie', 'briefcase'] },
      { dress: { top: 0xf0e6e8, accent: navy, bottom: navy, extra: 'jacket', skirt: true, hairStyle: 2 }, props: ['briefcase'] },
      { dress: { top: shirt, accent: charcoal, bottom: charcoal, extra: 'jacket' }, props: ['tie'] },
    ],
  },
];
