import { Group } from 'three';
import { USER_GROUPS, USERS, type UserGroup, type UserSpot } from '../../config/flavour/users';
import { range } from '../../sim/random';
import { fade, walkTo, type Actor } from './actors';
import type { Pack, PackDeps } from './index';
import { parkBench } from './props';

/**
 * Who uses what (config/flavour/users.ts): smokers and vapers, and a few small groups on the inner
 * ring's pavements, each out in its own hours, more of them on a busy street
 * night, and most moving off under heavy policing. People pace, sway, fold
 * over or lie down as their substance makes them; the figures' body states
 * (agents/character.ts) carry the movement, so this costs one pass over a
 * dozen actors a frame while the pack is on and nothing while it is off.
 */
interface Person {
  a: Actor;
  spot: UserSpot;
  group: UserGroup;
  /** Their place in the group: the first ones out on a quiet night. */
  rank: number;
  /** Pacing: heading to the far end. */
  out: boolean;
  /** Lying down: seconds left, or 0 when up. */
  down: number;
}

export function buildUsers({ pool, random, scene }: PackDeps): Pack {
  const root = new Group();
  scene.add(root);
  const people: Person[] = [];
  for (const group of USER_GROUPS) {
    group.spots.forEach((spot, rank) => {
      const a = pool.add({ style: group.style, kit: group.kit, dress: group.dress }, spot.at.x, spot.at.z);
      a.heading = spot.face;
      a.pose = spot.pose;
      a.body = spot.body;
      a.voice = group.voice;
      if (spot.smokes) { a.glow = spot.smokes; a.smokes = true; a.vapes = spot.smokes === 'vape'; }
      if (spot.pose === 'dance') a.speed = 0.8;
      people.push({ a, spot, group, rank, out: true, down: 0 });
    });
  }
  // The cannabis smokers' bench, behind where they sit.
  const smokers = USER_GROUPS.find((g) => g.kind === 'cannabis');
  const bench = smokers ? parkBench(root) : null;
  if (bench && smokers) {
    const [p, q] = smokers.spots;
    bench.position.set((p.at.x + q.at.x) / 2, 0.12, (p.at.z + q.at.z) / 2 + 0.05);
    bench.rotation.y = p.face;
  }

  return {
    setEnabled(on) {
      root.visible = on;
      if (!on) for (const p of people) p.a.shown = 0;
    },
    update(dt, ctx) {
      const scattered = ctx.patrol >= USERS.scatterAt;
      // Out of each group: half on a quiet street, all of them when the market is busy.
      const share = USERS.quietShare + (1 - USERS.quietShare) * ctx.market;
      for (const p of people) {
        const { a, spot, group } = p;
        const [from, to] = group.hours;
        const hours = ctx.clock >= from && ctx.clock < to;
        const out = hours && (!scattered || !!group.stubborn) && p.rank < Math.max(1, Math.round(group.spots.length * share));
        fade(a, out, dt, 0.6);
        if (bench && group === smokers && p.rank === 0) bench.visible = a.shown > 0.2;
        if (a.shown <= 0) { a.x = spot.at.x; a.z = spot.at.z; a.lying = false; p.down = 0; continue; }
        if (spot.pace) {
          // Pacing up and down, quick, turning at each end.
          const end = p.out ? spot.pace : spot.at;
          if (walkTo(a, end.x, end.z, USERS.paceSpeed, dt)) p.out = !p.out;
          a.body = spot.body;
          continue;
        }
        if (spot.liesDown) {
          if (p.down > 0) {
            p.down -= dt;
            if (p.down <= 0) { a.lying = false; a.pose = spot.pose; }
          } else if (random() < (dt / 60) * USERS.lieDownPerMinute) {
            p.down = range(random, USERS.lieFor);
            a.lying = true;
          }
        }
      }
    },
  };
}
