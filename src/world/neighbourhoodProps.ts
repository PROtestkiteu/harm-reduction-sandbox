import { BoxGeometry, Group, InstancedMesh, Matrix4, type Scene } from 'three';
import { PALETTE } from '../config/palette';
import { add, box, signBoard } from './kit';
import { mat } from './materials';

/** What the neighbourhood makes visible. Derived from the simulation's neighbourhood state. */
export interface StreetView {
  /** Shutters down on the corner shop and cafe. */
  shopsShut: boolean;
  /** 0..1 discarded equipment. */
  litter: number;
}

/** Spots where discarded equipment shows up: park corners and the out-of-view places people use. */
const LITTER_SPOTS: readonly [number, number][] = [
  [4.0, 12.9], [4.6, 12.2], [9.3, 13.9], [10.0, 13.5], [-13.0, 13.6], [-13.7, 14.2],
  [14.0, 14.4], [14.6, 13.8], [6.2, 11.0], [12.4, 9.8], [-12.6, 12.9], [8.0, 14.3],
  [3.4, 10.8], [13.2, 12.2],
];

/** A roller shutter: a slatted panel that rolls down from the top of a shopfront. */
function shutter(width: number, height: number): Group {
  const g = new Group();
  const slat = mat(0x8a8c96);
  const dark = mat(0x6a6c76);
  for (let y = 0; y < height; y += 0.16) add(g, box(width, 0.14, 0.05, (Math.round(y / 0.16) % 2 ? slat : dark), 0, -y - 0.14, 0));
  const sign = signBoard('CLOSED', 1.1, 0.3, '#fff4dc', '#7a3a30', 0.6).mesh;
  sign.position.set(0, -height * 0.55, 0.04);
  g.add(sign);
  return g;
}

/**
 * Street-level consequences: shutters on the corner shop and cafe, and
 * discarded equipment in corners. Both change slowly with the simulation.
 */
export class NeighbourhoodProps {
  private readonly shutters: Group[] = [];
  private readonly litter: InstancedMesh;
  private shown = -1;
  private target = 0;
  private current = 0;

  constructor(scene: Scene) {
    const root = add(scene, new Group());
    // Corner shop front faces the street (+x) at x = -10.6; cafe glazing faces the park (+z) at z = 6.6.
    const shop = shutter(3.2, 2.1);
    shop.position.set(-10.48, 2.65, 12.8);
    shop.rotation.y = Math.PI / 2;
    const cafe = shutter(2.0, 2.0);
    cafe.position.set(13.775, 2.6, 6.7);
    root.add(shop, cafe);
    this.shutters.push(shop, cafe);
    for (const s of this.shutters) {
      s.scale.y = 0.001;
      s.visible = false;
    }

    const geo = new BoxGeometry(0.22, 0.05, 0.08);
    this.litter = new InstancedMesh(geo, mat(PALETTE.canvasCream), LITTER_SPOTS.length);
    const m = new Matrix4();
    LITTER_SPOTS.forEach(([x, z], i) => {
      m.makeRotationY(i * 1.7);
      m.setPosition(x, 0.13, z);
      this.litter.setMatrixAt(i, m);
    });
    this.litter.count = 0;
    root.add(this.litter);
    this.set({ shopsShut: false, litter: 0 });
  }

  set(v: StreetView): void {
    this.target = v.shopsShut ? 1 : 0;
    const n = Math.round(v.litter * LITTER_SPOTS.length);
    if (n !== this.shown) {
      this.shown = n;
      this.litter.count = n;
    }
  }

  /** Rolls shutters toward their target; returns true while moving. */
  update(dt: number): boolean {
    if (this.current === this.target) return false;
    const step = dt / 3;
    this.current = this.target > this.current ? Math.min(this.target, this.current + step) : Math.max(this.target, this.current - step);
    for (const s of this.shutters) {
      s.scale.y = Math.max(0.001, this.current);
      s.visible = this.current > 0.01;
    }
    return true;
  }
}
