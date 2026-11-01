import { Vector3, type Object3D } from 'three';

/**
 * Solid footprints on the ground: benches, bins, posts, trees, parked cars,
 * shelters and the like. Builders tag their group with its footprint; once
 * the world is built the tags are gathered into a grid of oriented boxes
 * that people steer around. Pure geometry, no physics engine: cheap enough
 * for phones and headsets.
 */

interface Footprint { w: number; d: number }

/** Marks `obj` as solid: a `w` by `d` metre box (local x by local z) centred on its origin. */
export function solid<T extends Object3D>(obj: T, w: number, d = w): T {
  obj.userData.solid = { w, d } satisfies Footprint;
  return obj;
}

/** One oriented box on the ground. */
interface Box { x: number; z: number; c: number; s: number; hw: number; hd: number }

const CELL = 4;
const key = (ix: number, iz: number) => ix * 8192 + iz;

export class Solids {
  private readonly grid = new Map<number, Box[]>();
  count = 0;

  add(x: number, z: number, angle: number, w: number, d: number): void {
    const box: Box = { x, z, c: Math.cos(angle), s: Math.sin(angle), hw: w / 2, hd: d / 2 };
    const r = Math.hypot(box.hw, box.hd);
    for (let ix = Math.floor((x - r) / CELL); ix <= Math.floor((x + r) / CELL); ix++) {
      for (let iz = Math.floor((z - r) / CELL); iz <= Math.floor((z + r) / CELL); iz++) {
        const k = key(ix, iz);
        const list = this.grid.get(k);
        if (list) list.push(box);
        else this.grid.set(k, [box]);
      }
    }
    this.count++;
  }

  /**
   * Adds to `out` the push that moves a circle of `radius` at (x, z) clear of
   * the boxes near it. Returns whether anything pushed.
   */
  push(x: number, z: number, radius: number, out: { x: number; z: number }): boolean {
    const list = this.grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!list) return false;
    let hit = false;
    for (const b of list) hit = pushFromBox(b, x, z, radius, out) || hit;
    return hit;
  }
}

/** Push out of one oriented box, measured in the box's own frame. */
export function pushFromBox(b: Box, x: number, z: number, radius: number, out: { x: number; z: number }): boolean {
  const dx = x - b.x;
  const dz = z - b.z;
  // Into the box frame (rotation by -angle about y).
  const lx = dx * b.c - dz * b.s;
  const lz = dx * b.s + dz * b.c;
  const cx = Math.max(-b.hw, Math.min(b.hw, lx));
  const cz = Math.max(-b.hd, Math.min(b.hd, lz));
  let px = lx - cx;
  let pz = lz - cz;
  let d = Math.hypot(px, pz);
  if (d >= radius) return false;
  if (d < 1e-4) {
    // Centre inside the box: leave by the nearest side.
    const ex = b.hw - Math.abs(lx);
    const ez = b.hd - Math.abs(lz);
    if (ex < ez) { px = Math.sign(lx) || 1; pz = 0; d = -ex; } else { px = 0; pz = Math.sign(lz) || 1; d = -ez; }
  } else {
    px /= d;
    pz /= d;
  }
  const depth = radius - d;
  // Back to world (rotation by +angle).
  out.x += (px * b.c + pz * b.s) * depth;
  out.z += (-px * b.s + pz * b.c) * depth;
  return true;
}

/** A moving box (a car), for collisions outside the static grid. */
export function movingBox(x: number, z: number, angle: number, w: number, d: number): Box {
  return { x, z, c: Math.cos(angle), s: Math.sin(angle), hw: w / 2, hd: d / 2 };
}

/** Gathers every tagged footprint under `root` into a grid, using world positions and headings. */
export function collectSolids(root: Object3D): Solids {
  const solids = new Solids();
  const p = new Vector3();
  const axis = new Vector3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const f = o.userData.solid as Footprint | undefined;
    if (!f) return;
    p.setFromMatrixPosition(o.matrixWorld);
    // Heading from the object's local x axis in the world.
    axis.set(1, 0, 0).transformDirection(o.matrixWorld);
    const angle = Math.atan2(-axis.z, axis.x);
    const scale = Math.hypot(o.matrixWorld.elements[0], o.matrixWorld.elements[2]);
    solids.add(p.x, p.z, angle, f.w * scale, f.d * scale);
  });
  return solids;
}
