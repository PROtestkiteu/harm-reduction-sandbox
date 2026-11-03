import { Group, type Mesh, type MeshLambertMaterial } from 'three';
import { BIN_ROUND, COURIERS, SWEEPER, UNSEEN_HURRY } from '../../config/flavour/service';
import { inView } from '../../render/viewEdge';
import { Route, type RoutePoint } from '../routes';
import { range } from '../../sim/random';
import { add, box, cylinder } from '../kit';
import { glowMat, mat } from '../materials';
import { dynamic, mergeStatic } from '../mergeStatic';
import { speedForGap, stood, type TrafficCar } from '../traffic';
import { approach } from '../animated';
import { fade, walkTo } from './actors';
import type { Pack, PackDeps } from './index';
import { courierBike, wheelieBin } from './props';

/**
 * Night service traffic: the council's bin lorry and its crew emptying the
 * bins along the inner ring (and clearing fly-tipping on the way), the street
 * sweeper crawling the north street before dawn, and couriers on bikes through
 * the evening. Each vehicle joins the traffic register, so cars queue behind a
 * lorry at a stop instead of driving through it.
 */

/** A bin lorry facing +z: cab, compactor body, an orange band and an amber beacon. */
function lorry(beacon: MeshLambertMaterial): Group {
  const g = new Group();
  const white = mat(0xd8d8d0);
  const dark = mat(0x1e2022);
  const orange = mat(0xd86a1e);
  add(g, box(2.3, 2.3, 2.0, white, 0, 0.45, 3.0));
  add(g, box(2.32, 0.7, 1.0, glowMat(0x2a3440, 0x8aa0b0, 0.25), 0, 1.75, 3.55));
  add(g, box(2.4, 2.7, 5.4, mat(0x5a6a52), 0, 0.55, -0.9));
  add(g, box(2.42, 0.3, 5.42, orange, 0, 1.3, -0.9));
  add(g, box(2.2, 0.6, 0.6, dark, 0, 0.5, -3.9));
  for (const z of [2.9, -0.6, -2.0]) for (const x of [-1.05, 1.05]) add(g, cylinder(0.5, 0.35, dark, 10, x, 0.5, z)).rotation.z = Math.PI / 2;
  mergeStatic(g);
  add(g, box(0.3, 0.18, 0.3, beacon, 0, 2.75, 3.4));
  g.traverse((o) => { o.castShadow = false; });
  return g;
}

/** A compact street sweeper facing +z, with two brushes that spin. */
function sweeper(): { g: Group; brushes: Mesh[] } {
  const g = new Group();
  add(g, box(1.5, 1.4, 2.6, mat(0xd8d8d0), 0, 0.35, 0));
  add(g, box(1.52, 0.7, 1.0, glowMat(0x2a3440, 0x8aa0b0, 0.25), 0, 1.1, 0.7));
  add(g, box(1.54, 0.2, 2.62, mat(0xd86a1e), 0, 0.6, 0));
  const dark = mat(0x1e2022);
  for (const z of [0.9, -0.9]) for (const x of [-0.72, 0.72]) add(g, cylinder(0.33, 0.25, dark, 8, x, 0.33, z)).rotation.z = Math.PI / 2;
  mergeStatic(g);
  const brushMat = mat(0x6a5a3a);
  const brushes = [-0.65, 0.65].map((x) => add(g, cylinder(0.45, 0.08, brushMat, 8, x, 0.04, 1.55)));
  g.traverse((o) => { o.castShadow = false; });
  return { g, brushes };
}

export function buildService({ pool, board, random, scene, traffic }: PackDeps): Pack {
  const root = new Group();
  scene.add(dynamic(root));
  let enabled = false;
  let last = -1;
  const due = (t: number, now: number) => last >= 0 && last < t && now >= t;

  // The bin round.
  const beacon = glowMat(0x7a4a10, 0xffa020, 1.2);
  const truck = lorry(beacon);
  truck.visible = false;
  truck.userData.mover = 'lorry';
  root.add(truck);
  const truckCar = traffic.add(3.4);
  const bins = BIN_ROUND.bins.map((at) => {
    const g = wheelieBin(root, 0x2a4a32);
    g.position.set(at.x, 0.1, at.z);
    return { g, at };
  });
  const crew = [0, 1].map((i) => {
    const a = pool.add({ style: 'worker', vest: 0xe07a20, kit: { hiVis: true } });
    a.voice = 'crew';
    return { a, i };
  });
  const route = new Route(BIN_ROUND.route, 4);
  // Where along the route each bin is: the nearest point of the lane to it.
  const here: RoutePoint = { x: 0, z: 0, dx: 0, dz: 1 };
  const seg = { seg: 0 };
  const binS = BIN_ROUND.bins.map((b) => {
    let best = 0;
    let bestD = Infinity;
    for (let s = 0; s < route.length; s += 0.5) {
      route.point(s, here, seg);
      const d = Math.hypot(here.x - b.x, here.z - b.z);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  });
  seg.seg = 0;
  const round = { on: false, s: 0, v: 0, stop: -1, t: 0, done: new Set<number>() };

  // The sweeper.
  const sw = sweeper();
  sw.g.visible = false;
  sw.g.userData.mover = 'sweeper';
  sw.g.rotation.y = Math.PI / 2;
  root.add(sw.g);
  const swCar = traffic.add(1.5);
  const sweep = { on: false, x: SWEEPER.lane.from, v: 0 };

  // Couriers.
  const couriers = [0, 1, 2].map((i) => {
    const a = pool.add({ style: i === 1 ? 'student' : 'worker', extra: 'none' });
    a.attach = courierBike(root, [0x3a3a40, 0x5a2a2a, 0x2a3a5a][i], [0x2aa0a0, 0xe07a2a, 0xd8c040][i]);
    a.pose = 'sit';
    a.lift = 0.38;
    a.voice = 'rider';
    return { a, on: false, car: traffic.add(0.9) as TrafficCar, x: COURIERS.lane.from, v: 0 };
  });
  let courierIn = 5;

  /** No other vehicle in the lane round where `car` would set out, at (x, z) heading (dx, dz). */
  const clearToStart = (car: TrafficCar, x: number, z: number, dx: number, dz: number) => {
    Object.assign(car, { x, z, dx, dz });
    return traffic.laneClear(car, car.half + 8, car.half + 6) && traffic.gapAhead(car) > 8;
  };

  /** Drives a registered vehicle along its lane: slows for the gap ahead; returns the speed. */
  const drive = (car: TrafficCar, x: number, z: number, dx: number, dz: number, cruise: number, v: number, dt: number, stopping: boolean) => {
    Object.assign(car, { x, z, dx, dz, active: true });
    const gap = traffic.gapAhead(car);
    const target = stopping ? 0 : speedForGap(cruise, gap);
    const next = gap < 1.2 ? 0 : approach(v, target, target < v ? 6 : 2, dt);
    stood(car, next, dt);
    return next;
  };

  const tickRound = (dt: number) => {
    if (!round.on) {
      truck.visible = false;
      truckCar.active = false;
      for (const c of crew) fade(c.a, false, dt);
      return;
    }
    // Sets out (out of sight, at the city's edge) only once its lane is clear there.
    if (round.s === 0 && !clearToStart(truckCar, route.start.x, route.start.z, route.start.dx, route.start.dz)) { truck.visible = false; truckCar.active = false; return; }
    truck.visible = true;
    beacon.emissiveIntensity = 0.5 + 0.9 * Math.max(0, Math.sin(round.t * 7));
    round.t += dt;
    // The next bin ahead (the lorry stops level with it, its rear at the bin).
    const next = bins.findIndex((_, i) => !round.done.has(i) && binS[i] > round.s - 1);
    const stopAt = next >= 0 ? binS[next] - 3 : Infinity;
    const stopping = round.stop >= 0 || (next >= 0 && stopAt - round.s < 3);
    route.point(round.s, here, seg);
    const seen = inView(here.x, here.z, here.dx, here.dz, 4, 3.2);
    round.v = drive(truckCar, here.x, here.z, here.dx, here.dz, BIN_ROUND.speed * (seen ? 1 : UNSEEN_HURRY), round.v, dt, stopping);
    round.s += round.v * dt;
    truck.position.set(here.x, 0.02, here.z);
    truck.rotation.y = Math.atan2(here.dx, here.dz);
    if (round.stop < 0 && next >= 0 && round.v < 0.05 && stopAt - round.s < 3) { round.stop = next; round.t = 0; }
    // The crew's spots behind the lorry: on the ring's east road it faces south (+z), its rear to the north.
    const rearX = here.x - here.dz * 1.5 - here.dx * 3.8;
    const rearZ = here.z + here.dx * 1.5 - here.dz * 3.8;
    if (round.stop >= 0) {
      const b = bins[round.stop];
      const rear = { x: rearX, z: rearZ };
      // One fetches the bin to the lorry's rear, it is lifted and tipped, and they take it back.
      const fetcher = crew[0].a;
      const t = round.t;
      fade(fetcher, true, dt, 3);
      fade(crew[1].a, true, dt, 3);
      if (t < BIN_ROUND.stop * 0.35) {
        if (walkTo(fetcher, b.at.x - 0.6, b.at.z, 1.6, dt)) fetcher.pose = 'stand';
      } else if (t < BIN_ROUND.stop * 0.6) {
        walkTo(fetcher, rear.x - 0.7, rear.z, 1.4, dt);
        b.g.position.set(fetcher.x + 0.6, 0.1, fetcher.z);
      } else if (t < BIN_ROUND.stop * 0.8) {
        b.g.position.set(rear.x, 0.9, rear.z - 0.4);
        b.g.rotation.x = -1.6;
      } else {
        b.g.rotation.x = 0;
        if (walkTo(fetcher, b.at.x - 0.6, b.at.z, 1.6, dt)) fetcher.pose = 'stand';
        b.g.position.set(fetcher.x + 0.6, 0.1, fetcher.z);
      }
      // The other waits at the back, then clears any dumped rubbish near the stop.
      walkTo(crew[1].a, rear.x - 0.3, rear.z - 0.8, 1.6, dt);
      crew[1].a.heading = Math.PI / 2;
      if (t > BIN_ROUND.stop) {
        b.g.position.set(b.at.x, 0.1, b.at.z);
        for (const l of [...board.litter]) if (Math.abs(l.z - b.at.z) < 8 && Math.abs(l.x - b.at.x) < 4) l.clear();
        round.done.add(round.stop);
        round.stop = -1;
        // The crew hop back on.
        for (const c of crew) { c.a.shown = 0; c.a.x = rear.x; c.a.z = rear.z; }
      }
    } else {
      for (const c of crew) { c.a.x = rearX; c.a.z = rearZ; fade(c.a, false, dt, 4); }
    }
    if (round.s >= route.length) { round.on = false; }
  };

  const tickSweep = (dt: number) => {
    if (!sweep.on) { sw.g.visible = false; swCar.active = false; return; }
    if (sweep.x === SWEEPER.lane.from && !clearToStart(swCar, sweep.x, SWEEPER.lane.z, 1, 0)) { swCar.active = false; return; }
    sw.g.visible = true;
    const seen = inView(sweep.x, SWEEPER.lane.z, 1, 0, 1.5, 2);
    sweep.v = drive(swCar, sweep.x, SWEEPER.lane.z, 1, 0, SWEEPER.speed * (seen ? 1 : UNSEEN_HURRY * 2), sweep.v, dt, false);
    sweep.x += sweep.v * dt;
    sw.g.position.set(sweep.x, 0.02, SWEEPER.lane.z);
    for (const b of sw.brushes) b.rotation.y += dt * 9 * (b.position.x < 0 ? 1 : -1);
    if (sweep.x > SWEEPER.lane.to) sweep.on = false;
  };

  const tickCouriers = (dt: number, clock: number) => {
    const busy = clock >= COURIERS.hours[0] && clock < COURIERS.hours[1];
    courierIn -= dt;
    if (busy && courierIn <= 0) {
      courierIn = range(random, COURIERS.every);
      const free = couriers.find((c) => !c.on);
      if (free) { free.on = true; free.x = COURIERS.lane.from; free.v = COURIERS.speed; }
    }
    for (const c of couriers) {
      if (!c.on) { c.a.shown = 0; c.car.active = false; continue; }
      if (c.x === COURIERS.lane.from && !clearToStart(c.car, c.x, COURIERS.lane.z - 0.9, -1, 0)) { c.car.active = false; continue; }
      const seen = inView(c.x, COURIERS.lane.z - 0.9, -1, 0, 1, 2);
      c.v = drive(c.car, c.x, COURIERS.lane.z - 0.9, -1, 0, COURIERS.speed * (seen ? 1 : UNSEEN_HURRY), c.v, dt, false);
      c.x -= c.v * dt;
      c.a.x = c.x;
      c.a.z = COURIERS.lane.z - 0.9;
      c.a.heading = -Math.PI / 2;
      c.a.pose = 'sit';
      c.a.speed = 1;
      // Out of sight at both ends of the lane, so shown the whole way.
      fade(c.a, true, dt, 3);
      if (c.x < COURIERS.lane.to) { c.on = false; c.car.active = false; }
    }
  };

  return {
    setEnabled(on) {
      enabled = on;
      root.visible = on;
      if (!on) {
        round.on = sweep.on = false;
        truckCar.active = swCar.active = false;
        for (const c of couriers) { c.on = false; c.car.active = false; c.a.shown = 0; }
        for (const c of crew) c.a.shown = 0;
        for (const b of bins) { b.g.position.set(b.at.x, 0.1, b.at.z); b.g.rotation.x = 0; }
      }
      last = -1;
    },
    update(dt, ctx) {
      if (!enabled) return;
      for (const t of BIN_ROUND.times) if (due(t, ctx.clock) && !round.on) { Object.assign(round, { on: true, s: 0, v: BIN_ROUND.speed, stop: -1, t: 0, done: new Set<number>() }); seg.seg = 0; }
      if (due(SWEEPER.time, ctx.clock) && !sweep.on) Object.assign(sweep, { on: true, x: SWEEPER.lane.from, v: SWEEPER.speed });
      last = ctx.clock;
      tickRound(dt);
      tickSweep(dt);
      tickCouriers(dt, ctx.clock);
    },
  };
}
