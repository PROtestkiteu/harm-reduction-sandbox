import type { Group } from 'three';
import { BUS_STOPS } from '../../config/flavour/vignettes';
import { range, type Random } from '../../sim/random';
import { fade, type ActorPool } from './actors';
import type { Scene } from './index';
import { busShelter } from './props';

/**
 * Bus stops at the edges of the playable area: shelters, and people waiting
 * who get on when a bus passes. Where the buses are is asked twice a second,
 * not every frame.
 */
export function buildBusStops(pool: ActorPool, random: Random, root: Group, buses: () => readonly { x: number; z: number }[]): Scene {
  const stops = BUS_STOPS.stops.map((st, i) => {
    const g = busShelter(root);
    g.position.set(st.at.x, 0.12, st.at.z);
    g.rotation.y = st.face;
    const fx = Math.sin(st.face);
    const fz = Math.cos(st.face);
    const waiting = Array.from({ length: BUS_STOPS.waiting }, (_, k) => {
      const a = pool.add({ style: (['office', 'older', 'student', 'worker'] as const)[(i + k) % 4], extra: k ? 'bag' : 'backpack' });
      // Inside the shelter, side by side along it, facing the road.
      const off = (k - 0.5) * 1.0;
      a.x = st.at.x + fz * off + fx * 0.1;
      a.z = st.at.z - fx * off + fz * 0.1;
      a.heading = st.face;
      a.pose = k ? 'stand' : 'sit';
      a.voice = 'waiting';
      if (k === 1) a.glow = 'phone';
      return { a, on: random() < 0.7, timer: range(random, BUS_STOPS.arrive) };
    });
    return { st, waiting };
  });
  let busCheck = 0;
  const update = (dt: number) => {
    busCheck -= dt;
    if (busCheck <= 0) {
      busCheck = 0.5;
      const near = buses();
      for (const s of stops) {
        if (!near.some((b) => Math.hypot(b.x - s.st.at.x, b.z - s.st.at.z) < BUS_STOPS.board)) continue;
        // A bus at the stop: everyone waiting gets on.
        for (const w of s.waiting) if (w.on) { w.on = false; w.timer = range(random, BUS_STOPS.arrive); }
      }
    }
    for (const s of stops) for (const w of s.waiting) {
      if (!w.on) {
        w.timer -= dt;
        if (w.timer <= 0) w.on = true;
      }
      fade(w.a, w.on, dt, 1.2);
    }
  };

  return { actors: stops.flatMap((s) => s.waiting.map((w) => w.a)), update };
}
