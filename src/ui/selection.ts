import { Group } from 'three';
import { add, box } from '../world/kit';
import { mat } from '../world/materials';
import type { LocationVisual } from '../world/buildings';

/**
 * Ground-level corner brackets around the selected location, in the matte
 * selection red. They do not glow: emissive brackets bloomed into a shine in
 * daylight, and the building's own red rim already carries the selection.
 */
export class SelectionMarker {
  readonly group = new Group();
  private readonly material = mat(0xedb300);
  private readonly corners: Group[] = [];

  constructor() {
    for (let i = 0; i < 4; i++) {
      const c = add(this.group, new Group());
      add(c, box(1.3, 0.05, 0.2, this.material, 0.55, 0, 0));
      add(c, box(0.2, 0.05, 1.3, this.material, 0, 0, 0.55));
      c.traverse((o) => { o.castShadow = false; });
      this.corners.push(c);
    }
    this.group.visible = false;
  }

  show(visual: Pick<LocationVisual, 'footprint'> | null): void {
    this.group.visible = !!visual;
    if (!visual) return;
    const { x, z, rx, rz } = visual.footprint;
    const signs: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    this.corners.forEach((c, i) => {
      const [sx, sz] = signs[i];
      c.position.set(x + sx * rx, 0.15, z + sz * rz);
      c.scale.set(-sx, 1, -sz);
    });
  }

  /** Still: nothing to animate. Kept so callers need not change. */
  update(_dt: number, _reducedMotion: boolean): boolean {
    return false;
  }
}
