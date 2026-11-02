import { CircleGeometry, Color, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, RingGeometry, type Object3D } from 'three';
import { dynamic } from './mergeStatic';

/**
 * What the map overlays draw on the ground: soft discs and rings (a service's
 * load, a hot spot, a reach) and a small dot under each person (who is where).
 * Discs come from a fixed pool, set a few times a second; the people dots are
 * one instanced mesh, moved every frame only while that overlay is on. With no
 * overlay, nothing is shown and nothing is updated.
 */

export interface GroundMark {
  x: number;
  z: number;
  /** Radius in metres. */
  r: number;
  color: number;
  /** 0..1 */
  alpha: number;
  /** A ring (an outline) instead of a filled disc. */
  ring?: boolean;
  /** Height in metres, for a mark over a roof; on the ground by default. */
  y?: number;
}

const DISCS = 48;
const PEOPLE = 400;
const Y = 0.07;

export class MapOverlays {
  private readonly root: Object3D;
  private readonly fills: Mesh<CircleGeometry, MeshBasicMaterial>[] = [];
  private readonly rings: Mesh<RingGeometry, MeshBasicMaterial>[] = [];
  private readonly dots: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly c = new Color();

  constructor(parent: Object3D) {
    this.root = dynamic(new Group());
    this.root.visible = false;
    parent.add(this.root);
    const disc = new CircleGeometry(1, 40).rotateX(-Math.PI / 2);
    const ring = new RingGeometry(0.94, 1, 64).rotateX(-Math.PI / 2);
    const mat = () => new MeshBasicMaterial({ transparent: true, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let i = 0; i < DISCS; i++) {
      const f = new Mesh(disc, mat());
      const r = new Mesh(ring, mat());
      for (const o of [f, r]) { o.visible = false; o.renderOrder = 1; o.raycast = () => {}; this.root.add(o); }
      this.fills.push(f);
      this.rings.push(r);
    }
    const dotMat = new MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 });
    this.dots = new InstancedMesh(new CircleGeometry(0.42, 14).rotateX(-Math.PI / 2), dotMat, PEOPLE);
    this.dots.count = 0;
    this.dots.renderOrder = 2;
    this.dots.frustumCulled = false;
    this.dots.raycast = () => {};
    this.root.add(this.dots);
  }

  set visible(on: boolean) {
    this.root.visible = on;
  }

  /** Replaces the ground marks (a few times a second). */
  setMarks(marks: readonly GroundMark[]): void {
    let f = 0;
    let r = 0;
    for (const k of marks) {
      const mesh = k.ring ? this.rings[r++] : this.fills[f++];
      if (!mesh) continue;
      mesh.visible = true;
      mesh.position.set(k.x, k.y ?? Y, k.z);
      mesh.scale.setScalar(Math.max(0.1, k.r));
      mesh.material.color.setHex(k.color);
      mesh.material.opacity = k.alpha;
    }
    for (let i = f; i < DISCS; i++) this.fills[i].visible = false;
    for (let i = r; i < DISCS; i++) this.rings[i].visible = false;
  }

  /** Starts a frame of people dots. */
  beginPeople(): void {
    this.dots.count = 0;
  }

  /** One person at (x, z), in `color`. */
  person(x: number, z: number, color: number): void {
    const i = this.dots.count;
    if (i >= PEOPLE) return;
    this.m.makeTranslation(x, Y + 0.01, z);
    this.dots.setMatrixAt(i, this.m);
    this.dots.setColorAt(i, this.c.setHex(color));
    this.dots.count = i + 1;
  }

  endPeople(): void {
    this.dots.instanceMatrix.needsUpdate = true;
    if (this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true;
  }

  clearPeople(): void {
    this.dots.count = 0;
  }
}
