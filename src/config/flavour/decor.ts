import type { P } from './street';

/**
 * More street furniture, as data. ILLUSTRATIVE: planters, café and
 * bookshop boards, a post box and bollards along the ring road's outer north and
 * west pavements (they face the camera), kept to the wall side or the kerb so they stay clear of
 * anyone walking (checked by `npm run clearance`).
 */
export type DecorKind = 'planter' | 'board' | 'postbox' | 'bollard' | 'newsbox';

export const DECOR: readonly { kind: DecorKind; at: P; face: number }[] = [
  { kind: 'planter', at: { x: -34, z: -54.55 }, face: 0 },
  { kind: 'planter', at: { x: -2, z: -54.55 }, face: 0 },
  { kind: 'planter', at: { x: 20, z: -54.55 }, face: 0 },
  { kind: 'board', at: { x: -16, z: -54.3 }, face: 0 },
  { kind: 'board', at: { x: -54.3, z: 12 }, face: Math.PI / 2 },
  { kind: 'postbox', at: { x: 0.5, z: -52.9 }, face: Math.PI },
  { kind: 'newsbox', at: { x: -54.55, z: -20 }, face: Math.PI / 2 },
  { kind: 'bollard', at: { x: -44.0, z: -52.8 }, face: 0 },
  { kind: 'bollard', at: { x: -42.6, z: -52.8 }, face: 0 },
  { kind: 'bollard', at: { x: -52.8, z: -42.6 }, face: 0 },
];
