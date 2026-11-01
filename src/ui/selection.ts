import { Group } from 'three';
import { add, box } from '../world/kit';
import { glowMat } from '../world/materials';
import type { LocationVisual } from '../world/buildings';

/** Ground-level corner brackets around the selected location. */
export class SelectionMarker {
  readonly group = new Group();
  private readonly material = glowMat(0xfff0c8, 0xffe2a0, 1.2);
  private readonly corners: Group[] = [];
  private time = 0;

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

  show(visual: LocationVisual | null): void {
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

  /** Returns true when the marker changed and the frame needs a redraw. */
  update(dt: number, reducedMotion: boolean): boolean {
    if (!this.group.visible || reducedMotion) return false;
    this.time += dt;
    this.material.emissiveIntensity = 0.9 + 0.5 * Math.sin(this.time * 3);
    return true;
  }
}
