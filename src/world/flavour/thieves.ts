import { Group } from 'three';
import { CRIME_SITES } from '../../config/flavour/crime';
import { PICKPOCKET_BEATS, THIEF_LINES, THIEVES } from '../../config/flavour/streetPeople';
import { range } from '../../sim/random';
import { fade, walkTo } from './actors';
import type { Pack, PackDeps } from './index';
import { shutter } from './props';

/**
 * The simulation's petty thefts (sim/pettyCrime.ts), shown where they happen:
 * a pickpocket closes in behind someone walking the ring, brushes past and
 * peels off, and the victim stops, pats their pockets and calls out; a
 * shoplifter goes into a shop and runs out with the worker after them, or is
 * held at the door by the shop's guard. Shops that hired a guard keep one at
 * the door; a shop that shut early has its shutter down. Wardens come over to
 * write it up. Nothing here feeds back to the simulation.
 */
const pick = <T>(random: () => number, list: readonly T[]) => list[Math.floor(random() * list.length)];

export function buildThieves({ pool, board, random, scene }: PackDeps): Pack {
  const root = new Group();
  scene.add(root);
  const shops = CRIME_SITES.shoplifting;

  // The pickpocket and their mark.
  const dip = pool.add({ style: 'everyday', kit: { hood: 'up' } });
  const mark = pool.add({ style: 'tourist', extra: 'backpack' });
  mark.voice = 'passerby';
  const pp = { on: false, beat: PICKPOCKET_BEATS[0], t: 0, stage: 'close' as 'close' | 'off' | 'pat' };

  // The shoplifter, the worker who comes out after them, and each shop's guard and shutter.
  const lifter = pool.add({ style: 'hiphop', kit: { hood: 'up' }, extra: 'bag' });
  const worker = pool.add({ style: 'worker', extra: 'none' });
  const sl = { on: false, shop: 0, caught: false, t: 0, inside: 0 };
  const guards = shops.map((s) => {
    // Beside the door, out from the wall (the shop doors face the pavement, the wall behind them).
    const a = pool.add({ style: 'office', vest: 0x1c1c20, extra: 'none' }, s.at.x, s.at.z);
    a.pose = 'stand';
    return a;
  });
  const shutters = shops.map(() => { const g = shutter(root); g.visible = false; return g; });
  // Place guards and shutters once: each door's wall runs along the pavement it faces.
  shops.forEach((s, i) => {
    const east = Math.abs(s.at.x) > Math.abs(s.at.z);
    const wallX = east ? Math.sign(s.at.x) * 45.05 : s.at.x;
    const wallZ = east ? s.at.z : Math.sign(s.at.z) * 45.05;
    shutters[i].position.set(wallX, 0, wallZ);
    shutters[i].rotation.y = east ? Math.PI / 2 : 0;
    const g = guards[i];
    g.x = east ? wallX + THIEVES.guardOut : s.at.x + THIEVES.guardAlong;
    g.z = east ? s.at.z + THIEVES.guardAlong : wallZ + THIEVES.guardOut;
    g.heading = east ? Math.PI / 2 : 0;
  });

  // Wardens may come over for a minute after each one.
  let time = 0;
  const call = (x: number, z: number) => {
    const until = time + 60;
    board.calls.push({ x, z, live: () => time < until });
  };

  const startPickpocket = () => {
    if (pp.on) return;
    const beat = pick(random, PICKPOCKET_BEATS);
    Object.assign(pp, { on: true, beat, t: 0, stage: 'close' });
    mark.x = beat.from.x;
    mark.z = beat.from.z;
    mark.body = 'normal';
    // The thief starts a few steps behind.
    const dx = beat.to.x - beat.from.x, dz = beat.to.z - beat.from.z, d = Math.hypot(dx, dz) || 1;
    dip.x = beat.from.x - (dx / d) * 4;
    dip.z = beat.from.z - (dz / d) * 4;
  };

  const startShoplifting = (shop: number, caught: boolean) => {
    if (sl.on || shop < 0 || shop >= shops.length) return;
    const s = shops[shop];
    Object.assign(sl, { on: true, shop, caught, t: 0, inside: range(random, THIEVES.inside) });
    lifter.x = worker.x = s.at.x;
    lifter.z = worker.z = s.at.z;
    lifter.shown = 0;
    worker.shown = 0;
  };

  const tickPickpocket = (dt: number) => {
    if (!pp.on) { fade(dip, false, dt, 2); fade(mark, false, dt); return; }
    const b = pp.beat;
    pp.t += dt;
    if (pp.stage === 'close') {
      fade(mark, true, dt);
      fade(dip, true, dt);
      walkTo(mark, b.to.x, b.to.z, THIEVES.walk, dt);
      walkTo(dip, mark.x, mark.z, THIEVES.close, dt);
      // Close enough: the lift, and off the other way.
      if (Math.hypot(dip.x - mark.x, dip.z - mark.z) < 0.5 || pp.t > 20) { pp.stage = 'off'; pp.t = 0; }
    } else if (pp.stage === 'off') {
      walkTo(dip, b.away.x, b.away.z, THIEVES.run * 0.6, dt);
      if (!walkTo(mark, b.to.x, b.to.z, THIEVES.walk, dt) && pp.t < THIEVES.notice) return;
      pp.stage = 'pat';
      pp.t = 0;
      mark.pose = 'talk';
      mark.body = 'wired';
      board.say(mark.x, mark.z, pick(random, THIEF_LINES.pickpocket));
      call(mark.x, mark.z);
    } else {
      walkTo(dip, b.away.x, b.away.z, THIEVES.run * 0.6, dt);
      if (pp.t > THIEVES.pat) { fade(mark, false, dt, 0.8); fade(dip, false, dt, 0.8); }
      if (pp.t > THIEVES.pat + 3) { pp.on = false; mark.body = 'normal'; }
    }
  };

  const tickShoplifting = (dt: number) => {
    if (!sl.on) { fade(lifter, false, dt, 2); fade(worker, false, dt); return; }
    const s = shops[sl.shop];
    sl.t += dt;
    if (sl.t < sl.inside) return; // inside the shop
    if (sl.caught) {
      // Held at the door by the guard until the wardens come.
      fade(lifter, sl.t < sl.inside + THIEVES.held, dt);
      lifter.pose = 'stand';
      lifter.heading = guards[sl.shop].heading;
      if (sl.t - dt < sl.inside) { board.say(s.at.x, s.at.z, pick(random, THIEF_LINES.caught)); call(s.at.x, s.at.z); }
      if (sl.t > sl.inside + THIEVES.held + 2) sl.on = false;
      return;
    }
    fade(lifter, true, dt, 3);
    if (sl.t - dt < sl.inside + 1.2 && sl.t >= sl.inside + 1.2) { board.say(s.at.x, s.at.z, pick(random, THIEF_LINES.shoplifting)); call(s.at.x, s.at.z); }
    fade(worker, sl.t > sl.inside + 1 && sl.t < sl.inside + 9, dt);
    worker.pose = 'talk';
    worker.heading = Math.atan2(s.away.x - s.at.x, s.away.z - s.at.z);
    if (walkTo(lifter, s.away.x, s.away.z, THIEVES.run, dt) || Math.hypot(lifter.x - s.away.x, lifter.z - s.away.z) < 6) fade(lifter, false, dt, 2);
    if (sl.t > sl.inside + 12) sl.on = false;
  };

  return {
    setEnabled(on) {
      root.visible = on;
      if (!on) { for (const a of [dip, mark, lifter, worker, ...guards]) a.shown = 0; pp.on = sl.on = false; }
    },
    update(dt, ctx) {
      time += dt;
      for (const th of ctx.thefts.splice(0)) {
        if (th.kind === 'pickpocket') startPickpocket();
        else startShoplifting(th.shop, th.caught);
      }
      tickPickpocket(dt);
      tickShoplifting(dt);
      guards.forEach((g, i) => fade(g, !!ctx.shopGuard[i] && !ctx.shopShut[i] && ctx.clock < 1500, dt, 0.8));
      shutters.forEach((g, i) => { g.visible = !!ctx.shopShut[i]; });
    },
  };
}
