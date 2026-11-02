import { GUARD, GUARD_ROUND } from '../../config/flavour/guard';
import { fade, walkTo, type Actor } from './actors';
import type { Pack, PackDeps } from './index';

/**
 * The city guard: pairs of municipal wardens walking the inner ring and the
 * east street. They stop for a word with anyone sitting out (the board's
 * checks), and nobody moves on for them: they are not police. They also come
 * to the scene of the street crime pack's incidents when near, to write it up.
 */
interface Pair {
  a: Actor;
  b: Actor;
  leg: number;
  dir: 1 | -1;
  /** Seconds left talking with someone, and who. */
  talk: number;
  with: { x: number; z: number } | null;
  /** Where they are stepping to before a word with someone. */
  go: { x: number; z: number } | null;
  seen: Map<object, number>;
}

export function buildGuard({ pool, board }: PackDeps): Pack {
  let clock = 0;
  const look = { style: 'worker' as const, vest: GUARD.vest, kit: { hiVis: true } };
  const pairs: Pair[] = Array.from({ length: GUARD.pairs }, (_, i) => {
    const start = GUARD_ROUND[(i * 2) % GUARD_ROUND.length];
    const a = pool.add(look, start.x, start.z);
    const b = pool.add({ ...look, extra: 'bag' }, start.x + 0.9, start.z);
    a.voice = b.voice = 'guard';
    return { a, b, leg: (i * 2) % GUARD_ROUND.length, dir: i % 2 ? -1 : 1, talk: 0, with: null, go: null, seen: new Map() };
  });
  const n = GUARD_ROUND.length;

  const tick = (p: Pair, dt: number) => {
    fade(p.a, true, dt, 0.8);
    fade(p.b, true, dt, 0.8);
    if (p.go) {
      const g = p.go;
      const ux = g.x - p.a.x;
      const uz = g.z - p.a.z;
      const d = Math.hypot(ux, uz) || 1;
      walkTo(p.b, g.x + (uz / d) * 0.9, g.z - (ux / d) * 0.9, GUARD.speed * 1.2, dt);
      if (walkTo(p.a, g.x, g.z, GUARD.speed, dt)) p.go = null;
      return;
    }
    if (p.talk > 0) {
      p.talk -= dt;
      const w = p.with!;
      for (const m of [p.a, p.b]) {
        m.pose = m === p.a ? 'talk' : 'stand';
        m.heading = Math.atan2(w.x - m.x, w.z - m.z);
      }
      return;
    }
    // An incident nearby comes first: they walk over to write it up.
    const call = board.calls.find((c) => c.live() && Math.hypot(c.x - p.a.x, c.z - p.a.z) < GUARD.callReach && !p.seen.has(c));
    if (call) {
      const d = Math.hypot(call.x - p.a.x, call.z - p.a.z);
      if (d > 1.6) {
        walkTo(p.a, call.x, call.z, GUARD.speed * 1.6, dt);
        walkTo(p.b, call.x + 0.9, call.z + 0.4, GUARD.speed * 1.7, dt);
        return;
      }
      p.seen.set(call, clock);
      p.talk = GUARD.checkFor * 1.5;
      p.with = { x: call.x, z: call.z };
      board.speak(p.a.x, p.a.z, 'guardReport');
      return;
    }
    // Someone to check on, close by and not seen lately?
    for (const c of board.checks) {
      if (!c.live()) continue;
      const d = Math.hypot(c.x - p.a.x, c.z - p.a.z);
      if (d > GUARD.checkReach || clock - (p.seen.get(c) ?? -Infinity) < GUARD.checkAgain) continue;
      board.speak(p.a.x, p.a.z, 'guard');
      p.seen.set(c, clock);
      p.talk = GUARD.checkFor;
      p.with = { x: c.x, z: c.z };
      // They step up to them, side by side, before the word.
      const ux = (p.a.x - c.x) / (d || 1);
      const uz = (p.a.z - c.z) / (d || 1);
      p.go = { x: c.x + ux * 1.3, z: c.z + uz * 1.3 };
      return;
    }
    const next = GUARD_ROUND[(p.leg + (p.dir > 0 ? 1 : n - 1)) % n];
    if (walkTo(p.a, next.x, next.z, GUARD.speed, dt)) p.leg = (p.leg + (p.dir > 0 ? 1 : n - 1)) % n;
    // The second walks beside the first, a step to their right.
    const h = p.a.heading;
    walkTo(p.b, p.a.x + Math.cos(h) * 0.9, p.a.z - Math.sin(h) * 0.9, GUARD.speed * 1.3, dt);
    p.b.heading = h;
    p.b.pose = p.a.pose;
  };

  return {
    setEnabled(on) {
      if (!on) for (const p of pairs) { p.a.shown = p.b.shown = 0; p.talk = 0; p.go = null; }
    },
    update(dt) {
      clock += dt;
      for (const p of pairs) tick(p, dt);
    },
  };
}
