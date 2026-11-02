import { Group } from 'three';
import { CYCLING, RACKS } from '../../config/flavour/cycling';
import { range } from '../../sim/random';
import { fade, type Actor } from './actors';
import type { Pack, PackDeps } from './index';
import { bikeProp, bikeRack } from './props';

/**
 * Cyclists round the ring road's bike lane (config/flavour/cycling.ts), each
 * keeping right, half one way round and half the other, resting between
 * rides; and racks of parked bikes at the kerb. One pass over six riders a
 * frame; the racks are static props.
 */
interface Rider { a: Actor; s: number; dir: 1 | -1; speed: number; rest: number; riding: boolean }

/** A point and heading at distance `s` round a square of half size `r` centred on the origin, clockwise from the north-west corner. */
function onSquare(r: number, s: number, out: { x: number; z: number; h: number }): void {
  const side = 2 * r;
  const t = ((s % (4 * side)) + 4 * side) % (4 * side);
  const k = Math.floor(t / side);
  const u = t - k * side;
  if (k === 0) { out.x = -r + u; out.z = -r; out.h = Math.PI / 2; }
  else if (k === 1) { out.x = r; out.z = -r + u; out.h = 0; }
  else if (k === 2) { out.x = r - u; out.z = r; out.h = -Math.PI / 2; }
  else { out.x = -r; out.z = r - u; out.h = Math.PI; }
}

export function buildCycling({ pool, random, scene }: PackDeps): Pack {
  const root = new Group();
  scene.add(root);
  const riders: Rider[] = Array.from({ length: CYCLING.riders }, (_, i) => {
    const a = pool.add({ style: (['student', 'everyday', 'worker', 'office', 'raver', 'hiphop'] as const)[i % 6], extra: i % 2 ? 'backpack' : 'none' });
    a.attach = bikeProp(root, CYCLING.frames[i % CYCLING.frames.length]);
    a.pose = 'sit';
    a.lift = 0.38;
    a.speed = 1;
    return { a, s: random() * 8 * CYCLING.ring, dir: i % 2 ? -1 : 1, speed: range(random, CYCLING.speed), rest: random() * 20, riding: false };
  });
  for (const rack of RACKS) {
    const g = bikeRack(root, rack.bikes, CYCLING.frames, random);
    g.position.set(rack.at.x, 0.12, rack.at.z);
  }
  const p = { x: 0, z: 0, h: 0 };

  return {
    setEnabled(on) {
      root.visible = on;
      if (!on) for (const r of riders) r.a.shown = 0;
    },
    update(dt, ctx) {
      const [from, to] = CYCLING.hours;
      const busy = ctx.clock >= from && ctx.clock < to;
      riders.forEach((r, i) => {
        const out = busy || i < Math.round(CYCLING.riders * CYCLING.lateShare);
        if (!r.riding) {
          fade(r.a, false, dt, 2);
          if (out && (r.rest -= dt) <= 0) { r.riding = true; r.rest = range(random, CYCLING.rest) * 3; }
          return;
        }
        // Clockwise keeps right on the outer side of the lane, anticlockwise on the inner.
        r.s += r.dir * r.speed * dt;
        onSquare(CYCLING.ring + r.dir * CYCLING.keepRight, r.s, p);
        r.a.x = p.x;
        r.a.z = p.z;
        r.a.heading = r.dir > 0 ? p.h : p.h + Math.PI;
        fade(r.a, true, dt, 2);
        // A ride lasts about one side or two; then a rest out of sight.
        if ((r.rest -= dt) <= 0) { r.riding = false; r.rest = range(random, CYCLING.rest); }
      });
    },
  };
}
