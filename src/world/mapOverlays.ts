import { CircleGeometry, Color, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, RingGeometry, type BufferGeometry, type Object3D } from 'three';
import { dynamic } from './mergeStatic';

/**
 * What the map overlays draw: soft discs and rings (a service's load, a hot
 * spot, a reach, a ring over a roof) and a small dot under each person (who is
 * where). The discs and the rings are two instanced meshes, each mark with its
 * own colour and opacity, so a view over every building in the district is
 * still two draw calls; they are set a few times a second. The people dots are
 * a third, moved every frame only while a view with people is on. With no
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

const MARKS = 320;
const PEOPLE = 400;
const Y = 0.07;

/** A pool of marks of one shape: per-instance colour and opacity. */
function markPool(geo: BufferGeometry, offset: number): InstancedMesh {
  const mat = new MeshBasicMaterial({ transparent: true, depthWrite: false, side: DoubleSide, forceSinglePass: true, polygonOffset: true, polygonOffsetFactor: offset });
  // Opacity per mark, from an instance attribute (three.js has colour per instance, not alpha).
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float instanceAlpha;\nvarying float vMarkAlpha;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMarkAlpha = instanceAlpha;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vMarkAlpha;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, opacity * vMarkAlpha );');
  };
  const mesh = new InstancedMesh(geo, mat, MARKS);
  mesh.geometry.setAttribute('instanceAlpha', new InstancedBufferAttribute(new Float32Array(MARKS), 1));
  mesh.setColorAt(0, new Color());
  mesh.count = 0;
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  return mesh;
}

export class MapOverlays {
  private readonly root: Object3D;
  private readonly fills: InstancedMesh;
  private readonly rings: InstancedMesh;
  private readonly dots: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly c = new Color();

  constructor(parent: Object3D) {
    this.root = dynamic(new Group());
    this.root.visible = false;
    parent.add(this.root);
    this.fills = markPool(new CircleGeometry(1, 40).rotateX(-Math.PI / 2), -2);
    this.rings = markPool(new RingGeometry(0.94, 1, 64).rotateX(-Math.PI / 2), -2);
    this.root.add(this.fills, this.rings);
    const dotMat = new MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, side: DoubleSide, forceSinglePass: true, polygonOffset: true, polygonOffsetFactor: -3 });
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

  /** Replaces the marks (a few times a second). */
  setMarks(marks: readonly GroundMark[]): void {
    this.fills.count = 0;
    this.rings.count = 0;
    for (const k of marks) {
      const mesh = k.ring ? this.rings : this.fills;
      const i = mesh.count;
      if (i >= MARKS) continue;
      const r = Math.max(0.1, k.r);
      this.m.makeScale(r, 1, r).setPosition(k.x, k.y ?? Y, k.z);
      mesh.setMatrixAt(i, this.m);
      mesh.setColorAt(i, this.c.setHex(k.color));
      (mesh.geometry.getAttribute('instanceAlpha') as InstancedBufferAttribute).setX(i, k.alpha);
      mesh.count = i + 1;
    }
    for (const mesh of [this.fills, this.rings]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.geometry.getAttribute('instanceAlpha').needsUpdate = true;
    }
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
