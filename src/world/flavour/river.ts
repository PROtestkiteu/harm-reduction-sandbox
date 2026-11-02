import { Group } from 'three';
import { BOATS, FISHING, RIVER_RUN } from '../../config/flavour/river';
import { add, box, cylinder } from '../kit';
import { glowMat, mat, vehicleMat } from '../materials';
import { RIVER_X } from '../bridges';
import { fade } from './actors';
import type { Pack, PackDeps } from './index';
import { prop as propOf } from './props';

/**
 * The river (config/flavour/river.ts): a barge, a motor launch and a rowing
 * boat working up and down, under the arched bridges, each turning at the
 * ends of its run; and two people fishing from the promenade wall, rods out
 * over the water. Three boats and two anglers a frame.
 */
const mid = (RIVER_X.x0 + RIVER_X.x1) / 2;

/**
 * A hull along +z: a box amidships, a pointed bow (a triangular prism with
 * its point forward), a gunwale strip round the top, and the waterline darker
 * below it. `w` wide, `len` long, `h` high above the water.
 */
function hull(g: Group, w: number, len: number, h: number, paint: number, trim: number): void {
  const r = w / Math.sqrt(3);
  const body = len - 1.5 * r;
  add(g, box(w, h, body, vehicleMat(paint), 0, -0.35, -1.5 * r / 2));
  add(g, cylinder(r, h, vehicleMat(paint), 3, 0, -0.35, body / 2 - 1.5 * r / 2 + r / 2));
  // The gunwale: a thin rail of a lighter colour along each side.
  for (const sx of [-1, 1]) add(g, box(0.1, 0.12, body, vehicleMat(trim), sx * (w / 2 - 0.02), h - 0.37, -1.5 * r / 2));
  // Dark below the waterline where it shows.
  add(g, box(w - 0.04, 0.12, body - 0.1, vehicleMat(0x141618), 0, -0.36, -1.5 * r / 2));
}

export function boat(kind: (typeof BOATS)[number]['kind']): Group {
  const g = new Group();
  if (kind === 'barge') {
    // A long working barge: low black hull, a covered hold, the wheelhouse aft with a stove pipe.
    hull(g, 2.6, 11, 0.95, 0x22262c, 0xb8382a);
    add(g, box(2.2, 0.35, 6.2, vehicleMat(0x4a3a2a), 0, 0.6, 0.4));
    for (let z = -2.4; z <= 3.2; z += 0.8) add(g, box(2.24, 0.05, 0.08, vehicleMat(0x2a2018), 0, 0.95, z));
    add(g, box(1.9, 1.25, 2.1, vehicleMat(0xe0dacc), 0, 0.6, -3.7));
    add(g, box(2.05, 0.1, 2.3, vehicleMat(0x3a2a24), 0, 1.85, -3.7));
    for (const x of [-0.96, 0.96]) add(g, box(0.02, 0.4, 1.4, glowMat(0x2a3440, 0xffe0a0, 0.55), x, 1.2, -3.7));
    add(g, box(1.5, 0.4, 0.02, glowMat(0x2a3440, 0xffe0a0, 0.55), 0, 1.2, -2.64));
    add(g, cylinder(0.08, 0.7, vehicleMat(0x1a1a1a), 6, 0.6, 1.95, -4.2));
  } else if (kind === 'launch') {
    // A small white motor launch: raked cabin, a windscreen, a blue stripe.
    hull(g, 1.9, 5.2, 0.75, 0xe8e6e0, 0x2a5a8a);
    add(g, box(1.6, 0.7, 1.7, vehicleMat(0xf0eee8), 0, 0.4, -0.3));
    add(g, box(1.62, 0.08, 1.8, vehicleMat(0x2a5a8a), 0, 1.1, -0.3));
    add(g, box(1.4, 0.38, 0.04, glowMat(0x203040, 0xd8f0ff, 0.45), 0, 0.68, 0.56)).rotation.x = -0.35;
    add(g, box(0.5, 0.06, 0.8, vehicleMat(0x6a6a6a), 0, 0.42, -2.0));
  } else {
    // A wooden rowing boat with a rower and oars out.
    hull(g, 1.15, 3.1, 0.45, 0x7a4a2a, 0xc89a6a);
    add(g, box(1.0, 0.05, 0.3, vehicleMat(0x9a6a3a), 0, 0.05, 0));
    add(g, box(0.38, 0.45, 0.3, vehicleMat(0x2a5a3a), 0, 0.12, -0.15));
    add(g, cylinder(0.12, 0.24, vehicleMat(0xd8b08a), 8, 0, 0.6, -0.15));
    for (const sx of [-1, 1]) add(g, box(2.0, 0.035, 0.07, vehicleMat(0x8a6a4a), sx * 0.85, 0.2, 0)).rotation.z = sx * 0.18;
  }
  return g;
}

/** A fishing rod and its line, held out over the water (+z is the way the angler faces). */
function rod(): Group {
  const g = new Group();
  const pole = add(g, cylinder(0.02, 3.2, mat(0x2a2a2a), 4, 0.25, 1.0, 0.2));
  pole.rotation.x = 1.05;
  add(g, box(0.01, 2.4, 0.01, mat(0xd8d8d0), 0.25, -0.9, 3.1));
  return g;
}

export function buildRiver({ pool, scene }: PackDeps): Pack {
  const root = new Group();
  scene.add(root);
  const boats = BOATS.map((b, i) => {
    const g = propOf(root, boat(b.kind));
    return { g, b, z: RIVER_RUN.z[0] + ((i + 1) / (BOATS.length + 1)) * (RIVER_RUN.z[1] - RIVER_RUN.z[0]), dir: i % 2 ? -1 : 1, bob: i * 2 };
  });
  const anglers = FISHING.spots.map((s, i) => {
    const a = pool.add({ style: i ? 'older' : 'worker', extra: 'jacket' }, RIVER_X.x0 + s.out, s.z);
    a.heading = Math.PI / 2;
    a.pose = i ? 'sit' : 'stand';
    a.attach = propOf(root, rod());
    a.voice = 'angler';
    return a;
  });
  let time = 0;

  return {
    setEnabled(on) {
      root.visible = on;
      if (!on) for (const a of anglers) a.shown = 0;
    },
    update(dt, ctx) {
      time += dt;
      for (const p of boats) {
        p.z += p.dir * p.b.speed * dt;
        // Turn round at the ends of the run, crossing to the other side of the river.
        if (p.z > RIVER_RUN.z[1]) { p.z = RIVER_RUN.z[1]; p.dir = -1; }
        if (p.z < RIVER_RUN.z[0]) { p.z = RIVER_RUN.z[0]; p.dir = 1; }
        const lane = p.dir > 0 ? p.b.lane : -p.b.lane;
        p.g.position.set(mid + lane, RIVER_RUN.y + (ctx.still ? 0 : Math.sin(time * 1.3 + p.bob) * 0.04), p.z);
        p.g.rotation.y = p.dir > 0 ? 0 : Math.PI;
      }
      const out = FISHING.hours.some(([a, b]) => ctx.clock >= a && ctx.clock < b);
      for (const a of anglers) fade(a, out, dt, 0.6);
    },
  };
}
