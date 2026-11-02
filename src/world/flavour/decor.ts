import { Group } from 'three';
import { DECOR, type DecorKind } from '../../config/flavour/decor';
import type { Pack, PackDeps } from './index';
import { aBoard, bollard, newsBox, planter, postBox } from './props';

/**
 * More street furniture (config/flavour/decor.ts): planters, café and
 * bookshop boards, a post box, a newspaper box and bollards. Static props,
 * built once; nothing runs per frame.
 */
const MAKE: Record<DecorKind, (g: Group) => Group> = { planter, board: aBoard, postbox: postBox, bollard, newsbox: newsBox };

export function buildDecor({ scene }: PackDeps): Pack {
  const root = new Group();
  scene.add(root);
  for (const d of DECOR) {
    const g = MAKE[d.kind](root);
    g.position.set(d.at.x, 0.12, d.at.z);
    g.rotation.y = d.face;
  }
  return {
    setEnabled(on) { root.visible = on; },
    update() { /* static */ },
  };
}
