import type { Appearance, Archetype } from '../../agents/character';
import type { P } from './street';

/**
 * Easter eggs: five pioneers of psychedelic research and practice, out for a
 * walk through the district one at a time, now and then. Each is the crowd's
 * own figure dressed as they were known to dress, and says a line of harm
 * reduction good sense in their own spirit; none of the lines is a quotation.
 * Albert Hofmann rides a bicycle, after his ride home on 19 April 1943.
 *
 * - Albert Hofmann (1906 to 2008), Swiss chemist who first made LSD and
 *   isolated psilocybin.
 * - María Sabina (about 1894 to 1985), Mazatec curandera of Huautla de
 *   Jiménez, whose mushroom ceremonies became known to the outside world.
 * - Timothy Leary (1920 to 1996), psychologist, who stressed set and setting.
 * - Stanislav Grof (born 1931), psychiatrist, a founder of transpersonal
 *   psychology and of holotropic breathwork.
 * - Alexander "Sasha" Shulgin (1925 to 2014), chemist, who made and tested
 *   hundreds of compounds and wrote up every trial.
 */
export interface Pioneer {
  id: 'hofmann' | 'sabina' | 'leary' | 'grof' | 'shulgin';
  style: Archetype;
  dress: Partial<Appearance>;
  extra?: 'none' | 'backpack' | 'bag' | 'scarf' | 'jacket';
  /** Rides the ring road's bike lane instead of walking. */
  bike?: boolean;
}

export const PIONEERS: readonly Pioneer[] = [
  // An elderly Swiss chemist: bald crown, grey, a dark suit; on his bicycle.
  { id: 'hofmann', style: 'office', bike: true, dress: { height: 1.74, hairStyle: 5, hair: 0xb8b4ac, top: 0x2e3236, bottom: 0x2a2c30, accent: 0x5a3a2a, beard: false, girth: 0.3 } },
  // Small and older, a white huipil embroidered in red, a dark skirt, long dark hair.
  { id: 'sabina', style: 'older', dress: { height: 1.48, hairStyle: 1, hair: 0x1e1a18, top: 0xece6d8, accent: 0xb0302a, bottom: 0x2a2228, skirt: true, girth: 0.25 } },
  // Tall and lean, short grey hair, a light shirt and jacket.
  { id: 'leary', style: 'everyday', extra: 'jacket', dress: { height: 1.83, hairStyle: 0, hair: 0xa8a49c, top: 0xd8d0bc, accent: 0x8a7a5a, bottom: 0x4a4a52, girth: 0 } },
  // White hair swept back, a dark jumper.
  { id: 'grof', style: 'older', dress: { height: 1.76, hairStyle: 0, hair: 0xe8e6e0, top: 0x3a3e4a, accent: 0x3a3e4a, bottom: 0x2a2c30, girth: 0.15 } },
  // A white beard and white hair, a bright patterned shirt.
  { id: 'shulgin', style: 'older', dress: { height: 1.8, hairStyle: 0, hair: 0xecebe6, beard: true, top: 0x3a7ab0, accent: 0xe8b030, bottom: 0x5a5448, girth: 0.35 } },
];

/** Where they walk: the ring road's outer pavements, which face the camera; the cyclist rides the lane. */
export const PIONEER_WALK: readonly P[] = [{ x: -53.7, z: 40 }, { x: -53.7, z: -53.7 }, { x: 44, z: -53.7 }];

export const PIONEER_TIMING = {
  /** Seconds between one walk and the next (any of the five), the pace, and the bicycle's speed. */
  gap: [45, 120] as const,
  pace: 1.05,
  ride: 4.2,
  /** Seconds between lines while in view. */
  say: 9,
};
