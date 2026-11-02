import type { Group } from 'three';
import { HOTDOG } from '../../config/flavour/vignettes';
import { range, type Random } from '../../sim/random';
import { fade, type ActorPool } from './actors';
import type { Scene } from './index';
import { hotdogCart } from './props';

/**
 * The hot dog cart: the vendor pushes it along the inner ring from pitch to
 * pitch (by arc length along the loop, so it goes round the corner, never
 * across a block), stays a few minutes at each, and customers stop by.
 */
export function buildHotdog(pool: ActorPool, random: Random, root: Group): Scene {
  const legs = HOTDOG.loop.slice(1).map((b, i) => ({ a: HOTDOG.loop[i], b, len: Math.hypot(b.x - HOTDOG.loop[i].x, b.z - HOTDOG.loop[i].z) }));
  const along = (p: { x: number; z: number }) => {
    let s = 0;
    let best = { d: Infinity, s: 0 };
    for (const l of legs) {
      const t = Math.max(0, Math.min(1, ((p.x - l.a.x) * (l.b.x - l.a.x) + (p.z - l.a.z) * (l.b.z - l.a.z)) / (l.len * l.len)));
      const d = Math.hypot(l.a.x + (l.b.x - l.a.x) * t - p.x, l.a.z + (l.b.z - l.a.z) * t - p.z);
      if (d < best.d) best = { d, s: s + t * l.len };
      s += l.len;
    }
    return best.s;
  };
  const at = (s: number) => {
    for (const l of legs) {
      if (s <= l.len) return { x: l.a.x + ((l.b.x - l.a.x) * s) / l.len, z: l.a.z + ((l.b.z - l.a.z) * s) / l.len, h: Math.atan2(l.b.x - l.a.x, l.b.z - l.a.z) };
      s -= l.len;
    }
    const l = legs[legs.length - 1];
    return { x: l.b.x, z: l.b.z, h: Math.atan2(l.b.x - l.a.x, l.b.z - l.a.z) };
  };
  const pitchAt = HOTDOG.pitches.map(along);
  const cart = hotdogCart(root);
  const vendor = pool.add({ style: 'worker', extra: 'none' });
  vendor.voice = 'vendor';
  const hot = { pitch: 0, s: pitchAt[0], target: pitchAt[0], timer: range(random, HOTDOG.stay), heading: 0 };
  const customers = Array.from({ length: HOTDOG.customers }, (_, i) => ({ a: pool.add({ style: (['student', 'raver', 'everyday'] as const)[i % 3] }), timer: range(random, HOTDOG.gap), on: false }));
  for (const c of customers) c.a.voice = 'passerby';
  const update = (dt: number) => {
    fade(vendor, true, dt, 0.8);
    const moving = Math.abs(hot.target - hot.s) > 0.01;
    if (moving) {
      const dir = Math.sign(hot.target - hot.s);
      hot.s += dir * Math.min(Math.abs(hot.target - hot.s), HOTDOG.speed * dt);
      const p = at(hot.s);
      hot.heading = dir > 0 ? p.h : p.h + Math.PI;
      // The vendor walks behind the cart, pushing it.
      vendor.x = p.x - Math.sin(hot.heading) * 1.2;
      vendor.z = p.z - Math.cos(hot.heading) * 1.2;
      vendor.heading = hot.heading;
      vendor.pose = 'walk';
      vendor.speed = HOTDOG.speed;
      cart.position.set(p.x, 0.12, p.z);
      cart.rotation.y = hot.heading;
    } else {
      // At the pitch: the cart turned side on to the pavement, the vendor behind it, facing out.
      const p = at(hot.s);
      cart.position.set(p.x, 0.12, p.z);
      vendor.x = p.x + Math.cos(p.h) * 0.9;
      vendor.z = p.z - Math.sin(p.h) * 0.9;
      vendor.heading = Math.atan2(p.x - vendor.x, p.z - vendor.z);
      vendor.pose = 'stand';
      hot.timer -= dt;
      if (hot.timer <= 0) {
        // On to another pitch.
        let next = Math.floor(random() * (pitchAt.length - 1));
        if (next >= hot.pitch) next++;
        hot.pitch = next;
        hot.target = pitchAt[next];
        hot.timer = range(random, HOTDOG.stay);
      }
    }
    for (const c of customers) {
      c.timer -= dt;
      if (c.timer <= 0) {
        c.on = !c.on && !moving;
        c.timer = c.on ? range(random, HOTDOG.serve) : range(random, HOTDOG.gap);
        if (c.on) {
          // Up to the counter, on the far side from the vendor.
          const side = customers.indexOf(c) ? 0.55 : -0.55;
          const dx = cart.position.x - vendor.x;
          const dz = cart.position.z - vendor.z;
          const d = Math.hypot(dx, dz) || 1;
          c.a.x = cart.position.x + (dx / d) * 0.9 - (dz / d) * side;
          c.a.z = cart.position.z + (dz / d) * 0.9 + (dx / d) * side;
          c.a.heading = Math.atan2(-dx, -dz);
          c.a.pose = 'talk';
        }
      }
      fade(c.a, c.on && !moving, dt, 2);
    }
  };

  return { actors: [vendor, ...customers.map((c) => c.a)], update };
}
