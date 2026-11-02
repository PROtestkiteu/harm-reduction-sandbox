import { Group } from 'three';
import { BOATS, FISHING, RIVER_RUN } from '../../config/flavour/river';
import { add, box, cylinder } from '../kit';
import { glowMat, mat } from '../materials';
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

function boat(kind: (typeof BOATS)[number]['kind']): Group {
  const g = new Group();
  if (kind === 'barge') {
    add(g, box(2.6, 0.9, 11, mat(0x2a2e34), 0, -0.5, 0));
    add(g, box(2.4, 0.4, 7, mat(0x5a3a26), 0, 0.4, -0.8));
    add(g, box(2.0, 1.4, 2.2, mat(0xd8d2c4), 0, 0.4, 3.8));
    add(g, box(1.8, 0.4, 0.05, glowMat(0x2a3440, 0xffe0a0, 0.6), 0, 1.2, 4.92));
  } else if (kind === 'launch') {
    add(g, box(1.8, 0.7, 5, mat(0xe8e6e0), 0, -0.4, 0));
    add(g, box(1.6, 0.9, 1.6, mat(0x2a5a8a), 0, 0.3, 0.6));
    add(g, box(1.4, 0.35, 0.05, glowMat(0x203040, 0xd8f0ff, 0.5), 0, 0.85, 1.42));
  } else {
    add(g, box(1.1, 0.4, 3, mat(0x7a4a2a), 0, -0.25, 0));
    add(g, box(0.4, 0.5, 0.35, mat(0x2a5a3a), 0, 0.15, 0));
    add(g, cylinder(0.12, 0.25, mat(0xd8b08a), 6, 0, 0.62, 0));
    for (const s of [-1, 1]) add(g, box(2.2, 0.04, 0.08, mat(0x8a6a4a), s * 0.6, 0.25, 0)).rotation.z = s * 0.2;
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
