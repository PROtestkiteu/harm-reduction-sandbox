import { Group } from 'three';
import { CRIME_SITES, FLAVOUR_CRIMES, type CrimeSite, type FlavourCrime } from '../../config/flavour/crime';
import { FlavourCrimes } from '../../sim/flavourCrime';
import { fade, walkTo, type Actor } from './actors';
import type { Pack, PackDeps } from './index';
import { brokenGlass, flyTip, scooter } from './props';

/**
 * Street crime, shown where it happens: a scooter takes a phone off someone at
 * the kerb, a shoplifter runs from a door with the worker calling after them,
 * glass is left where a shelter was kicked in, rubbish and a mattress are dumped
 * at the kerb. Wardens walk over to write it up; the bin crew clears what is
 * left. The timing comes from sim/flavourCrime.ts, outside the simulation.
 */
export function buildCrime({ pool, board, random, scene }: PackDeps): Pack {
  const root = new Group();
  scene.add(root);
  const clock = new FlavourCrimes();
  let last = -1;
  let enabled = false;

  // The snatch: a rider on a scooter, a victim on a phone.
  const rider = pool.add({ style: 'hiphop', kit: { hood: 'up' } });
  rider.attach = scooter(root);
  rider.pose = 'sit';
  rider.lift = 0.12;
  const victim = pool.add({ style: 'office' });
  victim.voice = 'passerby';
  const snatch = { on: false, site: null as CrimeSite | null, t: 0, taken: false };
  // The shoplifting: the thief and the worker who comes out after them.
  const thief = pool.add({ style: 'everyday', kit: { hood: 'up' }, extra: 'bag' });
  const worker = pool.add({ style: 'worker', extra: 'none' });
  const lift = { on: false, site: null as CrimeSite | null, t: 0 };

  // What stays behind: a few of each, reused.
  const remains = (make: () => Group, n: number) => Array.from({ length: n }, () => {
    const g = make();
    g.visible = false;
    return { g, until: -1, site: -1, clear: null as (() => void) | null };
  });
  const glass = remains(() => brokenGlass(root), 2);
  const tips = remains(() => flyTip(root), 3);
  const left = [...glass, ...tips];

  /** Incidents the wardens may come to, for `secs` seconds each. */
  const open: { c: { x: number; z: number; live: () => boolean }; left: number }[] = [];
  const call = (x: number, z: number, secs: number) => {
    const entry = { c: { x, z, live: () => enabled && entry.left > 0 }, left: secs };
    board.calls.push(entry.c);
    open.push(entry);
  };

  const start = (kind: FlavourCrime, now: number) => {
    const info = FLAVOUR_CRIMES[kind];
    const sites = CRIME_SITES[kind];
    const i = Math.floor(random() * sites.length);
    const site = sites[i];
    if (kind === 'phoneSnatch') {
      if (snatch.on) return;
      Object.assign(snatch, { on: true, site, t: 0, taken: false });
      victim.x = site.at.x;
      victim.z = site.at.z;
      victim.heading = Math.PI / 2;
      victim.glow = 'phone';
      victim.pose = 'stand';
      // The rider starts well behind the victim, on the far side from where they get away to.
      const ux = site.at.x - site.away.x;
      const uz = site.at.z - site.away.z;
      const d = Math.hypot(ux, uz) || 1;
      rider.x = site.at.x + (ux / d) * 30;
      rider.z = site.at.z + (uz / d) * 30;
    } else if (kind === 'shoplifting') {
      if (lift.on) return;
      Object.assign(lift, { on: true, site, t: 0 });
      thief.x = worker.x = site.at.x;
      thief.z = worker.z = site.at.z;
      worker.shown = 0;
      board.say(site.at.x, site.at.z, info.cry);
    } else {
      const pool = kind === 'vandalism' ? glass : tips;
      if (pool.some((p) => p.site === i && p.g.visible)) return;
      const free = pool.find((p) => !p.g.visible);
      if (!free) return;
      free.g.visible = true;
      free.g.position.set(site.at.x, 0, site.at.z);
      free.g.rotation.y = random() * Math.PI;
      free.until = now + info.lasts;
      free.site = i;
      const entry = { x: site.at.x, z: site.at.z, clear: () => {
        free.g.visible = false;
        free.site = -1;
        free.clear = null;
        board.litter.splice(board.litter.indexOf(entry), 1);
      } };
      free.clear = entry.clear;
      board.litter.push(entry);
      if (kind === 'vandalism') board.say(site.at.x, site.at.z, info.cry);
    }
    if (info.guardAttends) call(site.at.x, site.at.z, 60);
  };

  const tickSnatch = (dt: number) => {
    if (!snatch.on || !snatch.site) {
      fade(victim, false, dt);
      fade(rider, false, dt, 3);
      return;
    }
    const s = snatch.site;
    snatch.t += dt;
    fade(victim, snatch.t < 22, dt);
    if (snatch.t < 2) return;
    fade(rider, true, dt, 3);
    const passing = Math.hypot(rider.x - s.at.x, rider.z - s.at.z) < 1.2;
    if (passing && !snatch.taken) {
      snatch.taken = true;
      victim.glow = 'none';
      victim.pose = 'talk';
      board.say(s.at.x, s.at.z, FLAVOUR_CRIMES.phoneSnatch.cry);
    }
    if (walkTo(rider, s.away.x, s.away.z, 9, dt)) rider.shown = 0;
    rider.pose = 'sit';
    if (snatch.taken) victim.heading = Math.atan2(rider.x - victim.x, rider.z - victim.z);
    if (snatch.t > 24 && victim.shown === 0) snatch.on = false;
  };

  const tickLift = (dt: number) => {
    if (!lift.on || !lift.site) {
      fade(thief, false, dt, 3);
      fade(worker, false, dt);
      return;
    }
    const s = lift.site;
    lift.t += dt;
    if (walkTo(thief, s.away.x, s.away.z, 3.8, dt)) fade(thief, false, dt, 3);
    else fade(thief, true, dt, 4);
    thief.speed = 3.8;
    // The worker steps out of the door and calls after them, then goes back in.
    fade(worker, lift.t > 0.8 && lift.t < 14, dt);
    if (lift.t > 0.8) {
      worker.pose = 'talk';
      worker.heading = Math.atan2(s.away.x - worker.x, s.away.z - worker.z);
    }
    if (lift.t > 16 && thief.shown === 0) lift.on = false;
  };

  return {
    setEnabled(on) {
      enabled = on;
      root.visible = on;
      if (!on) {
        snatch.on = lift.on = false;
        for (const a of [rider, victim, thief, worker] as Actor[]) a.shown = 0;
        for (const p of left) p.clear?.();
      }
      last = -1;
    },
    update(dt, ctx) {
      // Clock minutes since the last frame; a jump (a new evening, a set clock) starts afresh.
      const step = last < 0 || ctx.clock < last || ctx.clock - last > 30 ? 0 : ctx.clock - last;
      last = ctx.clock;
      for (const kind of clock.tick(step, ctx.clock, ctx.patrol)) start(kind, ctx.clock);
      tickSnatch(dt);
      tickLift(dt);
      for (let i = open.length - 1; i >= 0; i--) {
        if ((open[i].left -= dt) > 0) continue;
        board.calls.splice(board.calls.indexOf(open[i].c), 1);
        open.splice(i, 1);
      }
      // What was left behind goes once its time is up (or, sooner, with the bin crew).
      for (const p of left) if (p.clear && (ctx.clock > p.until || ctx.clock < p.until - 1440)) p.clear();
    },
  };
}
