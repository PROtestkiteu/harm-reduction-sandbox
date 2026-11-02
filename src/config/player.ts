import type { Appearance } from '../agents/character';

/**
 * You: the project's coordinator. Not on the street; seen in the portrait
 * when nothing else is selected and beside the night's reports and guides.
 * One fixed look, so the player always recognises themself.
 */
export const PLAYER = {
  /** Seeds the face, hair and the portrait's brush. */
  seed: 4127,
  /** Laid over a seeded everyday look: a plain dark work jacket, no hi-vis vest (you are not on shift). */
  look: { staff: false, extra: 'jacket', top: 0x3a4a5e, accent: 0x2c3442, bottom: 0x2a2826, style: 'everyday', kit: {}, dog: false, placard: false, police: false } satisfies Partial<Appearance>,
} as const;
