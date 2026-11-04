import type { TutorialCapabilities } from '../game/tutorial';
import type { Rect } from '../world/layout';

export const TUTORIAL_AREAS: Readonly<Record<TutorialCapabilities['district'], Rect>> = {
  park: { x0: -34, x1: 7, z0: 54, z1: 95 },
  street: { x0: -34, x1: 12, z0: 21, z1: 95 },
  residential: { x0: -46, x1: 16, z0: 21, z1: 95 },
  nightlife: { x0: -46, x1: 23, z0: -16, z1: 95 },
  city: { x0: -160, x1: 190, z0: -160, z1: 190 },
};

/** A quiet park-edge spot remains reachable throughout the authored introduction. */
export const TUTORIAL_PRIVACY_SPOT = { node: 'tutorialCampNorth', at: { x: -19, z: 75.25 }, face: 0.4 } as const;
