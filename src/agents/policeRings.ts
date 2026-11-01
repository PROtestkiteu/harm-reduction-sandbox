import { CircleGeometry, InstancedMesh, Matrix4, MeshBasicMaterial, RingGeometry, type Object3D } from 'three';
import type { P2 } from '../world/layout';

/** Most officers shown at once. */
const MAX = 8;

/**
 * The ground an officer covers: a faint red disc with a brighter rim, as
 * wide as their presence keeps people who use drugs away from the services
 * (see `deterrenceRadius`). Two instanced meshes, so two draw calls however
 * many officers are out.
 */
export class PoliceRings {
  private readonly disc: InstancedMesh;
  private readonly rim: InstancedMesh;
  private readonly m = new Matrix4();

  constructor(parent: Object3D) {
    const make = (geometry: CircleGeometry | RingGeometry, opacity: number) => {
      geometry.rotateX(-Math.PI / 2);
      const mesh = new InstancedMesh(geometry, new MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity, depthWrite: false }), MAX);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      mesh.raycast = () => {};
      parent.add(mesh);
      return mesh;
    };
    this.disc = make(new CircleGeometry(1, 40), 0.12);
    this.rim = make(new RingGeometry(0.96, 1, 48), 0.55);
  }

  /** One ring of `radius` metres round each officer at `at`. */
  update(at: readonly P2[], radius: number): void {
    const n = radius > 0.5 ? Math.min(MAX, at.length) : 0;
    for (let i = 0; i < n; i++) {
      this.m.makeScale(radius, 1, radius).setPosition(at[i].x, 0.145, at[i].z);
      this.disc.setMatrixAt(i, this.m);
      this.rim.setMatrixAt(i, this.m);
    }
    for (const mesh of [this.disc, this.rim]) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

/** How far an officer's presence keeps people away, from the context's deterrence (0 to 1). */
export function deterrenceRadius(deterrence: number): number {
  return deterrence > 0 ? 3 + 9 * deterrence : 0;
}
