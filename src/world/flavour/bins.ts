import { Group, Mesh, SphereGeometry } from 'three';
import { allBuildings, frontFrame, lookClaimed } from '../cityBuildings';
import { add, box, cylinder } from '../kit';
import { DISTRICT, PAVEMENT_TOP, STREETS, clearOfWalks, groundY, type P2, type Rect } from '../layout';
import { clothMat, mat } from '../materials';
import { mergeStatic } from '../mergeStatic';
import type { Pack, PackDeps } from './index';

/**
 * Bins on the district's pavements: round litter bins with a lid and a
 * cigarette stub plate at street corners, recycling clusters (paper,
 * plastic and metal, glass, mixed) on the ring road's pavements, and pairs of
 * wheelie bins out in front of buildings, the odd one with a bag on its lid or
 * beside it. Static and merged; each stands only on a pavement, clear of the
 * walking lines and of anything solid.
 */

const bag = new SphereGeometry(1, 6, 4);

export function buildBins({ pool, random, scene }: PackDeps): Pack {
  const root = new Group();
  scene.add(root);
  const placed: P2[] = [];
  const room = (p: P2, w: number, d: number, rot = 0) =>
    groundY(p.x, p.z) >= PAVEMENT_TOP && clearOfWalks(p.x, p.z, rot, w, d) && !pool.blocked(p.x, p.z, Math.max(w, d) / 2 + 0.05)
    && !placed.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 3);

  /** A litter bin: a green drum with a domed lid, a stub plate, a band. */
  const litter = (p: P2) => {
    const g = add(root, new Group());
    g.position.set(p.x, PAVEMENT_TOP, p.z);
    const green = mat(0x2a4a32);
    add(g, cylinder(0.24, 0.8, green, 10, 0, 0, 0));
    add(g, cylinder(0.25, 0.05, mat(0x8a8c8e), 10, 0, 0.6, 0));
    add(g, cylinder(0.26, 0.08, green, 10, 0, 0.8, 0));
    add(g, cylinder(0.12, 0.03, mat(0x8a8c8e), 8, 0, 0.88, 0));
    if (random() < 0.3) add(g, new Mesh(bag, clothMat(0xd8d0c0))).position.set(0, 0.9, 0.05);
  };

  /** Recycling: four bins in their colours, lids and slots, side by side along `rot`. */
  const recycling = (p: P2, rot: number) => {
    const g = add(root, new Group(), rot);
    g.position.set(p.x, PAVEMENT_TOP, p.z);
    [0x1e4aa8, 0xd0b020, 0x2a7a3a, 0x3a3a3a].forEach((c, i) => {
      const x = -1.05 + i * 0.7;
      add(g, box(0.62, 1.05, 0.62, mat(c), x, 0, 0));
      add(g, box(0.66, 0.06, 0.66, mat(c), x, 1.05, 0));
      add(g, box(0.3, 0.05, 0.02, mat(0x141414), x, 0.85, 0.32));
    });
    // Something left beside them.
    if (random() < 0.6) add(g, box(0.5, 0.35, 0.4, clothMat(0x9a7a4e), 1.55, 0, 0.1)).rotation.y = 0.3;
  };

  /** Two wheelie bins on their wheels, one lid not quite shut. */
  const wheelies = (p: P2, rot: number) => {
    const g = add(root, new Group(), rot);
    g.position.set(p.x, PAVEMENT_TOP, p.z);
    for (const [i, c] of [[0, 0x2a2a2c], [1, random() < 0.5 ? 0x7a5a2a : 0x1e4aa8]] as const) {
      const x = -0.35 + i * 0.7;
      add(g, box(0.58, 0.95, 0.7, mat(c), x, 0.05, 0));
      const lid = add(g, box(0.62, 0.05, 0.76, mat(c), x, 1.0, 0.02));
      if (i === 1) lid.rotation.x = -0.15;
      for (const sx of [-0.22, 0.22]) add(g, cylinder(0.08, 0.05, mat(0x141414), 8, x + sx, 0.08, -0.36)).rotation.z = Math.PI / 2;
    }
    if (random() < 0.45) add(g, new Mesh(bag, clothMat(0x161618))).position.set(0.75, 0.25, 0.1);
  };

  // Litter bins at the corners of the junctions, a little round from the corner itself.
  const roads: Rect[] = Object.values(STREETS).map((s) => s.road);
  const xs = roads.filter((r) => r.x1 - r.x0 > r.z1 - r.z0);
  const zs = roads.filter((r) => r.x1 - r.x0 <= r.z1 - r.z0);
  for (const xr of xs) for (const zr of zs) {
    if (zr.x1 < xr.x0 || zr.x0 > xr.x1 || xr.z1 < zr.z0 || xr.z0 > zr.z1) continue;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      if (random() < 0.4) continue;
      const p = { x: (sx < 0 ? zr.x0 : zr.x1) + sx * 0.5, z: (sz < 0 ? xr.z0 : xr.z1) + sz * 1.9 };
      if (room(p, 0.5, 0.5)) { litter(p); placed.push(p); }
    }
  }
  // Recycling clusters along the ring's pavements, at the kerb, their slots facing the pavement.
  for (const s of [STREETS.ringSouth, STREETS.ringEast, STREETS.ringNorth, STREETS.ringWest]) {
    const road: Rect = s.road;
    let n = 0;
    for (const p of s.pavements as readonly Rect[]) {
      for (let t = 0; t < 8 && n < 2; t++) {
        const along = -DISTRICT * 0.6 + random() * DISTRICT * 1.2;
        let q: P2;
        let rot: number;
        if (s.along === 'x') {
          // The pavement's edge on the road, and away from it.
          const kerbHigh = Math.abs(p.z1 - road.z0) < 0.1;
          q = { x: along, z: kerbHigh ? p.z1 - 0.45 : p.z0 + 0.45 };
          rot = kerbHigh ? Math.PI : 0;
        } else {
          const kerbHigh = Math.abs(p.x1 - road.x0) < 0.1;
          q = { x: kerbHigh ? p.x1 - 0.45 : p.x0 + 0.45, z: along };
          rot = kerbHigh ? -Math.PI / 2 : Math.PI / 2;
        }
        if (room(q, 3.2, 0.8, rot)) { recycling(q, rot); placed.push(q); n++; }
      }
    }
  }
  // Wheelie bins out in front of a few ordinary buildings.
  const fronts = allBuildings().filter((b) => !lookClaimed(b.id) && Math.max(Math.abs((b.x0 + b.x1) / 2), Math.abs((b.z0 + b.z1) / 2)) < DISTRICT - 4);
  for (const b of fronts) {
    if (random() < 0.6) continue;
    const f = frontFrame(b);
    const off = (random() - 0.5) * f.width * 0.6;
    const p = { x: f.x + Math.cos(f.rot) * off + Math.sin(f.rot) * 0.55, z: f.z - Math.sin(f.rot) * off + Math.cos(f.rot) * 0.55 };
    if (room(p, 1.5, 0.8, f.rot)) { wheelies(p, f.rot); placed.push(p); }
  }
  mergeStatic(root);

  return {
    setEnabled(on) {
      root.visible = on;
    },
    update() {},
  };
}
