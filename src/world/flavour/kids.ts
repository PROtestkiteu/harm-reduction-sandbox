import { Group } from 'three';
import { FAMILIES, KIDS } from '../../config/flavour/kids';
import { range } from '../../sim/random';
import { fade, walkTo, type Actor } from './actors';
import type { Pack, PackDeps } from './index';

/**
 * Children with their parents (config/flavour/kids.ts): a family walks its
 * route, the children at the parent's side and one now and then skipping
 * ahead, then a pause before the next family. Children are the crowd's own
 * figures at a child's height.
 */
interface Family { parent: Actor; kids: Actor[]; route: (typeof FAMILIES)[number]; on: boolean; wait: number; ahead: number }

export function buildKids({ pool, random, scene }: PackDeps): Pack {
  const root = new Group();
  scene.add(root);
  const families: Family[] = FAMILIES.map((route, i) => {
    const parent = pool.add({ style: i ? 'office' : 'everyday', extra: 'bag' }, route.from.x, route.from.z);
    parent.voice = 'parent';
    const kids = Array.from({ length: route.kids }, (_, k) => {
      const a = pool.add({ style: 'student', extra: k ? 'none' : 'backpack', dress: { height: range(random, KIDS.height), build: 0.8 } }, route.from.x, route.from.z);
      a.voice = 'child';
      return a;
    });
    return { parent, kids, route, on: false, wait: range(random, KIDS.gap) * (i + 0.5), ahead: 0 };
  });

  return {
    setEnabled(on) {
      root.visible = on;
      if (!on) for (const f of families) for (const a of [f.parent, ...f.kids]) a.shown = 0;
    },
    update(dt, ctx) {
      const hours = KIDS.hours.some(([a, b]) => ctx.clock >= a && ctx.clock < b);
      for (const f of families) {
        const all = [f.parent, ...f.kids];
        if (!f.on) {
          for (const a of all) fade(a, false, dt);
          if (hours && (f.wait -= dt) <= 0) {
            f.on = true;
            for (const a of all) { a.x = f.route.from.x; a.z = f.route.from.z; }
          }
          continue;
        }
        for (const a of all) fade(a, true, dt);
        const { to, from } = f.route;
        const arrived = walkTo(f.parent, to.x, to.z, KIDS.pace, dt);
        // Along the route, beside the parent; one child runs a few steps ahead now and then.
        const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1;
        const ux = dx / d, uz = dz / d;
        if ((f.ahead -= dt) < -6 && random() < dt * 0.2) f.ahead = 2.5;
        f.kids.forEach((k, i) => {
          const lead = i === 0 && f.ahead > 0 ? 2.2 : -0.2;
          const side = (i + 1) * 0.45;
          walkTo(k, f.parent.x + ux * lead - uz * side, f.parent.z + uz * lead + ux * side, KIDS.pace * (lead > 0 ? 2.4 : 1.4), dt);
          if (Math.hypot(k.x - f.parent.x, k.z - f.parent.z) < 3) k.heading = f.parent.heading;
        });
        if (arrived) { f.on = false; f.wait = range(random, KIDS.gap); }
      }
    },
  };
}
