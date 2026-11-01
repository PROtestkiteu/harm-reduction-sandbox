import { QUALITY } from '../render/quality';
import { CapsuleGeometry, Color, Group, InstancedMesh, Matrix4, MeshLambertMaterial, Quaternion, SphereGeometry, Vector3, type Object3D } from 'three';
import type { Random } from '../sim/random';
import { GROW, ROAD, STREETS } from './layout';
import { bus, car, CAR_COLOURS, emergencyVehicle, rollWheels, type EmergencyVehicle } from './vehicles';
import { dynamic } from './mergeStatic';
import { approach } from './animated';
import { speedForGap, stood, type Traffic, type TrafficCar } from './traffic';
import type { Figure } from '../agents/character';
import { t } from '../i18n';

/**
 * Life in the city around the district, outside the simulation: traffic on
 * the roads that run on from the district (over the bridges too) and people
 * walking the promenade, the park, the old town and the station. None of
 * them are part of the model; they make the city feel lived in.
 *
 * Cars keep their size and appear or vanish at the ends of their runs. Walkers are
 * two instanced meshes, so a crowd of them costs two draw calls.
 */
export interface Ambient {
  update(dt: number): void;
  /**
   * The park follows the city: `market` (0..1) is the street market the
   * simulation tracks, `patrol` the policing level (0 none). More market,
   * more sellers; more policing, more officers on the park round.
   */
  setParkLife(market: number, patrol: number): void;
  /** How many joggers run the park's round (0 to 4): fewer when the park feels unsafe. */
  setJoggers(n: number): void;
  /** Where the camera looks and how many metres a screen pixel covers, for level of detail. */
  setView(x: number, z: number, radius: number, metresPerPixel: number): void;
  /** Makes a sculpted figure for a person of this kind, once the people's assets are loaded. */
  setFigureFactory(make: (kind: AmbientKind) => Figure): void;
  /** Asks whether someone is on the road just ahead of a car at (x, z) heading (dx, dz): it waits if so. */
  setYield(ahead: (x: number, z: number, dx: number, dz: number) => boolean): void;
  /** Places where people who have had too much hang about: a liquor store, a casino. */
  setHangouts(points: readonly { x: number; z: number }[]): void;
  /**
   * Sends an ambulance or a police car to (x, z) for `reason`: it drives in,
   * stops with lights flashing, then leaves. False when every one is out already.
   */
  dispatch(kind: 'ambulance' | 'police', x: number, z: number, reason: string): boolean;
  /** Police cars and ambulances now on screen, for picking. */
  vehicles(): readonly { id: number; root: Object3D }[];
  /** What a vehicle is doing and why it came, while it is out. */
  vehicle(id: number): VehicleInfo | undefined;
}

export interface VehicleInfo {
  kind: 'ambulance' | 'police' | 'bus' | 'warmingBus';
  /** Why it is out: the call it answers, or its patrol. */
  reason: string;
  state: 'On the way' | 'At the scene' | 'Leaving' | 'On patrol' | 'On its route' | 'Held up' | 'Parked';
}

export type AmbientKind = 'stroller' | 'seller' | 'buyer' | 'police' | 'drunk' | 'jogger';

/** Most sculpted figures at once; people in view past this are left out rather than drawn as sticks. */
const POOL = QUALITY.figures;
/** Below this many pixels tall a person is drawn as a cheap instanced shape. */
const TINY_PX = 9;

interface Run { from: Vector3; to: Vector3 }
interface Driver {
  group: Group; run: Run; t: number;
  /** Cruising speed for this run, and the speed it is doing now (it slows for traffic and people). */
  speed: number; v: number;
  length: number;
  car: TrafficCar;
  /** Seconds off the road before its next run. */
  wait?: number;
}
interface Walker { run: Run; t: number; speed: number; length: number; phase: number; height: number }

const FAR = 250 + GROW;
/** Bridges lift the road over the river (x 56 to 76, pushed out by the outer ring): deck top at 0.37. */
const RIVER = { x0: 55 + GROW, x1: 77 + GROW };
/** The big park, south of the district: its lawn's edges and its long path. */
const PARK = { x0: -44 - GROW, x1: 48 + GROW, z0: 52 + GROW, z1: 117 + GROW, path: 76 + GROW };

export function buildAmbient(scene: Object3D, random: Random, traffic: Traffic): Ambient {
  const runs: Run[] = [];
  const lane = (a: [number, number], b: [number, number]) => runs.push({ from: new Vector3(a[0], 0, a[1]), to: new Vector3(b[0], 0, b[1]) });
  // Through-traffic, one way per street, horizon to horizon, so no car ever
  // appears or vanishes at the district's edge: eastbound on the north street,
  // westbound on the south street, southbound on the east street, each in the
  // kerb lane kept free of parking. The main street's own traffic is the crowd's.
  const north = STREETS.north.road;
  const south = STREETS.south.road;
  const east = STREETS.east.road;
  lane([-FAR, north.z0 + 1.4], [FAR, north.z0 + 1.4]);
  lane([FAR, south.z0 + 1.4], [-FAR, south.z0 + 1.4]);
  lane([east.x0 + 1.4, -FAR], [east.x0 + 1.4, FAR]);

  const drivers: Driver[] = [];
  let yieldTo: ((x: number, z: number, dx: number, dz: number) => boolean) | null = null;
  // Everything here moves: kept out of the static merge.
  const g = dynamic(new Group());
  scene.add(g);
  // Cars, and a city bus among them (its index kept, so it can be clicked).
  const busDrivers: number[] = [];
  for (let i = 0; i < 22; i++) {
    const run = runs[Math.floor(random() * runs.length)];
    // One city bus among the cars: more bunch up at the lights on one street.
    const isBus = i === 11;
    const group = isBus ? bus() : car(CAR_COLOURS[Math.floor(random() * CAR_COLOURS.length)], true);
    group.traverse((o) => { o.castShadow = false; });
    const dir = new Vector3().subVectors(run.to, run.from);
    group.rotation.y = Math.atan2(dir.x, dir.z);
    g.add(group);
    const speed = 8 + random() * 7;
    if (isBus) busDrivers.push(drivers.length);
    drivers.push({ group, run, t: random(), speed, v: speed, length: dir.length(), car: traffic.add(isBus ? 5.2 : 2.2) });
  }

  // Walkers: where people stroll outside the district.
  const paths: Run[] = [];
  const path = (a: [number, number], b: [number, number]) => paths.push({ from: new Vector3(a[0], 0, a[1]), to: new Vector3(b[0], 0, b[1]) });
  path([52 + GROW, -150], [52 + GROW, 150]); path([53.5 + GROW, 150], [53.5 + GROW, -150]); // the promenade
  path([PARK.x0 - 1, PARK.path], [PARK.x1, PARK.path]); path([PARK.x1, PARK.path + 1.2], [PARK.x0 - 1, PARK.path + 1.2]); // the park's long path
  path([12, PARK.z0 - 2], [12, PARK.z1 + 1]); path([13.2, PARK.z1 + 1], [13.2, PARK.z0 - 2]); // and its cross path
  path([-60 - GROW, 4], [-120 - GROW, 4]); path([-120 - GROW, 2], [-60 - GROW, 2]); // through the old town and its square
  path([-48, -68.6 - GROW], [-8, -68.6 - GROW]); path([-8, -69.4 - GROW], [-48, -69.4 - GROW]); // the station platform
  path([-56 - GROW, -40], [-56 - GROW, 40]); path([-130 - GROW, -20], [-60 - GROW, -20]);
  const walkers: Walker[] = [];
  const strollers = 48;
  // The park's own life after the strollers: sellers, buyers and police.
  const SELLERS = [new Vector3(-30, 0, 60 + GROW), new Vector3(32, 0, 108 + GROW), new Vector3(-12, 0, 104 + GROW), new Vector3(40, 0, 60 + GROW)];
  const BUYERS = 6;
  const POLICE = 4;
  const ROUND = [new Vector3(PARK.x0 + 2, 0, PARK.z0 + 1), new Vector3(PARK.x1 - 2, 0, PARK.z0 + 1), new Vector3(PARK.x1 - 2, 0, PARK.z1 - 2), new Vector3(PARK.x0 + 2, 0, PARK.z1 - 2)];
  const DRUNKS = 8;
  const JOGGERS = 4;
  const count = strollers + SELLERS.length + BUYERS + DRUNKS + JOGGERS + POLICE;
  const drunkBase = strollers + SELLERS.length + BUYERS;
  const joggerBase = drunkBase + DRUNKS;
  for (let i = 0; i < strollers; i++) {
    const run = paths[i % paths.length];
    walkers.push({ run, t: random(), speed: 1.1 + random() * 0.5, length: run.from.distanceTo(run.to), phase: random() * 6.28, height: 0.9 + random() * 0.2 });
  }
  const bodyMat = new MeshLambertMaterial({ color: 0xffffff });
  const headMat = new MeshLambertMaterial({ color: 0xffffff });
  const bodies = new InstancedMesh(new CapsuleGeometry(0.22, 0.9, 3, 8), bodyMat, count);
  const heads = new InstancedMesh(new SphereGeometry(0.15, 8, 6), headMat, count);
  const clothes = [0x4a5a6a, 0x8a3a3a, 0x3a4a3a, 0x6a5a48, 0x2a2a30, 0xa89070, 0x5a4a6a];
  const skin = [0xe8c4a0, 0xc8986a, 0x8a5a3a, 0x5a3a2a, 0xd8b090];
  const c = new Color();
  const hoodies = [0x1e1e22, 0x2a2a30, 0x3a3a40];
  for (let i = 0; i < count; i++) {
    const seller = i >= strollers && i < strollers + SELLERS.length;
    const police = i >= count - POLICE;
    bodies.setColorAt(i, c.setHex(police ? 0x1e2a4a : seller ? hoodies[i % hoodies.length] : clothes[Math.floor(random() * clothes.length)]));
    // Officers' caps read as a dark head from above; sellers keep their hoods up.
    heads.setColorAt(i, c.setHex(police ? 0x141c30 : seller ? 0x1a1a1e : skin[Math.floor(random() * skin.length)]));
  }

  // Park life state.
  let sellersOut = 1;
  let officers = 2;
  const seller = SELLERS.map(() => ({ shown: 0 }));
  const buyers = Array.from({ length: BUYERS }, () => ({ pos: edgePoint(random), target: new Vector3(), wait: random() * 6, dealer: -1, shown: 0 }));
  const police = Array.from({ length: POLICE }, (_, i) => ({ leg: i < 2 ? 0 : 2, pos: ROUND[i < 2 ? 0 : 2].clone().add(new Vector3(i % 2 ? 1.1 : 0, 0, 0)), shown: 0 }));
  // People who have had too much, round the liquor store and the casino.
  let hangouts: Vector3[] = [];
  const drunks = Array.from({ length: DRUNKS }, (_, i) => ({ home: i, pos: new Vector3(), target: new Vector3(), wait: random() * 4, shown: 0 }));
  // Joggers run the park's round, a little inside the officers' path, spread out along it.
  const mid = (PARK.z0 + PARK.z1) / 2;
  const LOOP = ROUND.map((p) => new Vector3(p.x * 0.9, 0, mid + (p.z - mid) * 0.85));
  const joggers = Array.from({ length: JOGGERS }, (_, i) => ({ leg: i % 4, pos: LOOP[i % 4].clone(), shown: 0 }));
  let joggersOut = 2;
  // Overdoses in the park: someone goes down near a seller; an ambulance comes.
  let parkOverdoseIn = 60 + random() * 120;
  let market = 0;
  // Emergency vehicles: a small pool, sent where needed.
  // `kerb`: where it pulls over at the scene, out of the lane, so traffic flows past while it stands there.
  const fleet: { v: EmergencyVehicle; kind: 'ambulance' | 'police'; path: Vector3[]; kerb: Vector3; leg: number; hold: number; busy: boolean; reason: string; car: TrafficCar; speed: number }[] = [];
  // Enough police cars for a raid to swarm a place.
  for (const kind of ['ambulance', 'ambulance', 'police', 'police', 'police', 'police'] as const) {
    const v = emergencyVehicle(kind);
    v.group.visible = false;
    v.group.traverse((o) => { o.castShadow = false; });
    g.add(v.group);
    fleet.push({ v, kind, path: [], kerb: new Vector3(), leg: 0, hold: 0, busy: false, reason: '', car: traffic.add(kind === 'ambulance' ? 2.8 : 2.3), speed: 0 });
  }
  // Two police cars on routine patrol among the traffic.
  const patrols: Group[] = [];
  let patrolLevel = 0;
  for (let i = 0; i < 2; i++) {
    const v = emergencyVehicle('police');
    const run = runs[(i * 5 + 3) % runs.length];
    const dir = new Vector3().subVectors(run.to, run.from);
    v.group.rotation.y = Math.atan2(dir.x, dir.z);
    v.group.traverse((o) => { o.castShadow = false; });
    g.add(v.group);
    patrols.push(v.group);
    drivers.push({ group: v.group, run, t: random(), speed: 8, v: 8, length: dir.length(), car: traffic.add(2.3) });
  }
  /**
   * A route in from the city's edge to the road nearest (x, z), to stop there, and where to pull
   * over: up on the kerb, out of the moving lane (the other side of each street is lined with
   * parked cars).
   */
  const routeTo = (x: number, z: number): { path: Vector3[]; kerb: Vector3 } => {
    // Along the main street's inner lane (cars use it) or a cross street, whichever is nearer.
    const toMain = Math.abs(x - ROAD.laneX);
    const cross = [STREETS.north.road, STREETS.south.road];
    const road = cross.reduce((a, b) => (Math.abs(z - (a.z0 + a.z1) / 2) < Math.abs(z - (b.z0 + b.z1) / 2) ? a : b));
    const nearest = (road.z0 + road.z1) / 2;
    if (toMain <= Math.abs(z - nearest)) {
      const from = z < 0 ? -FAR : FAR;
      const stop = Math.max(-FAR, Math.min(FAR, z));
      return { path: [new Vector3(ROAD.laneX, 0, from), new Vector3(ROAD.laneX, 0, stop)], kerb: new Vector3(ROAD.x0 - 0.5, 0, stop) };
    }
    const from = x < 0 ? -FAR : FAR;
    const stop = Math.max(-FAR, Math.min(FAR, x));
    return { path: [new Vector3(from, 0, nearest - 1.2), new Vector3(stop, 0, nearest - 1.2)], kerb: new Vector3(stop, 0, road.z1 + 1.0) };
  };
  const step = (pos: Vector3, to: Vector3, speed: number, dt: number) => {
    const d = pos.distanceTo(to);
    if (d <= speed * dt) { pos.copy(to); return true; }
    pos.lerp(to, (speed * dt) / d);
    return false;
  };
  // Where each person is this frame; drawn afterwards at the level of detail the camera needs.
  const people = Array.from({ length: count }, (_, i) => ({
    x: 0, z: 0, heading: 0, moving: false, shown: 0, bob: 0,
    kind: (i < strollers ? 'stroller' : i < strollers + SELLERS.length ? 'seller' : i < drunkBase ? 'buyer' : i < joggerBase ? 'drunk' : i < count - POLICE ? 'jogger' : 'police') as AmbientKind,
    lying: false,
  }));
  const place = (i: number, pos: Vector3, shown: number, bob: number) => {
    const p = people[i];
    const dx = pos.x - p.x;
    const dz = pos.z - p.z;
    p.moving = dx * dx + dz * dz > 1e-6;
    if (p.moving) p.heading = Math.atan2(dx, dz);
    p.x = pos.x;
    p.z = pos.z;
    p.shown = shown;
    p.bob = bob;
  };
  const view = { x: 0, z: 0, radius: 60, mpp: 0.2 };
  let makeFigure: ((kind: AmbientKind) => Figure) | null = null;
  const figures = new Map<number, Figure>();
  const order: number[] = [];
  bodies.frustumCulled = heads.frustumCulled = false;
  scene.add(dynamic(bodies), dynamic(heads));

  const at = new Vector3();
  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const up = new Vector3(0, 1, 0);
  let walkClock = 0;
  q.setFromAxisAngle(up, 0);

  /**
   * Level of detail: zoomed far out (a person a few pixels tall), everyone is
   * a cheap instanced shape. Closer, the people in view nearest the middle get
   * sculpted figures from a small pool; nobody in view is drawn as a stick.
   */
  function dispatch(kind: 'ambulance' | 'police', x: number, z: number, reason: string): boolean {
    const f = fleet.find((v) => v.kind === kind && !v.busy);
    if (!f) return false;
    f.reason = reason;
    const route = routeTo(x, z);
    f.path = route.path;
    f.kerb.copy(route.kerb);
    f.leg = 0;
    f.busy = true;
    f.hold = 0;
    f.v.flashing = true;
    f.v.group.visible = true;
    f.v.group.position.copy(f.path[0]);
    return true;
  }

  function draw(dt: number): void {
    const tiny = !makeFigure || 1.7 / view.mpp < TINY_PX;
    const near: number[] = [];
    if (!tiny) {
      const r2 = (view.radius * 1.15) ** 2;
      for (let i = 0; i < count; i++) {
        const p = people[i];
        const dx = p.x - view.x;
        const dz = p.z - view.z;
        if (p.shown > 0.05 && dx * dx + dz * dz < r2) near.push(i);
      }
      near.sort((a, b) => (people[a].x - view.x) ** 2 + (people[a].z - view.z) ** 2 - ((people[b].x - view.x) ** 2 + (people[b].z - view.z) ** 2));
      near.length = Math.min(near.length, POOL);
    }
    const withFigure = new Set(near);
    for (let i = 0; i < count; i++) {
      const p = people[i];
      // The cheap shape only when tiny; otherwise hidden (a figure or nothing at all).
      const k = tiny ? Math.max(0.001, p.shown) : 0.001;
      m.compose(at.set(p.x, 0.55 + p.bob, p.z), q, s.set(k, k, k));
      bodies.setMatrixAt(i, m);
      m.compose(at.set(p.x, 1.25 + p.bob, p.z), q, s.set(k, k, k));
      heads.setMatrixAt(i, m);
      let fig = figures.get(i);
      if (withFigure.has(i)) {
        if (!fig && makeFigure) {
          fig = makeFigure(p.kind);
          fig.root.userData.baseScale = fig.root.scale.x;
          scene.add(dynamic(fig.root));
          figures.set(i, fig);
        }
        if (fig) {
          const idx = order.indexOf(i);
          if (idx >= 0) order.splice(idx, 1);
          order.push(i);
          fig.root.visible = true;
          fig.root.position.set(p.x, p.lying ? 0.18 : -0.04, p.z);
          fig.root.rotation.set(p.lying ? -Math.PI / 2 : 0, p.heading, 0, 'YXZ');
          fig.root.scale.setScalar(Math.max(0.001, p.shown) * fig.root.userData.baseScale);
          fig.update(dt, p.moving && !p.lying ? 'walk' : 'stand', p.kind === 'drunk' ? 0.7 : p.kind === 'jogger' ? 2.4 : 1.2);
        }
      } else if (fig) fig.root.visible = false;
    }
    // Keep only a bounded set of figures alive: drop the longest unused.
    while (figures.size > POOL + 8 && order.length) {
      const old = order.shift()!;
      const fig = figures.get(old);
      if (fig && !fig.root.visible) {
        scene.remove(fig.root);
        fig.dispose();
        figures.delete(old);
      } else if (fig) order.push(old);
    }
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
  }

  return {
    update(dt) {
      for (const d of drivers) {
        const inv = 1 / d.length;
        const hx = (d.run.to.x - d.run.from.x) * inv;
        const hz = (d.run.to.z - d.run.from.z) * inv;
        if (d.wait && d.wait > 0) {
          d.wait -= dt;
          // Sets out only once the start of its road is clear.
          if (d.wait <= 0) {
            Object.assign(d.car, { x: d.run.from.x, z: d.run.from.z, dx: hx, dz: hz });
            if (traffic.gapAhead(d.car) < 8) d.wait = 1;
          }
          d.car.active = false;
          continue;
        }
        at.lerpVectors(d.run.from, d.run.to, d.t);
        Object.assign(d.car, { x: at.x, z: at.z, dx: hx, dz: hz, active: true });
        // Slows for the car or crossing traffic ahead, and stops for anyone on the road just ahead.
        const gap = traffic.gapAhead(d.car);
        let target = speedForGap(d.speed, gap);
        if (yieldTo && d.t > 0 && yieldTo(at.x, at.z, hx, hz)) target = 0;
        d.v = gap < 1.2 ? 0 : approach(d.v, target, target < d.v ? 12 : 4, dt);
        stood(d.car, d.v, dt);
        d.t += (dt * d.v) / d.length;
        rollWheels(d.group, d.v * dt);
        if (d.t >= 1) {
          // A new journey each time: another road and direction, another pace, after a pause off screen.
          d.t = 0;
          d.run = runs[Math.floor(random() * runs.length)];
          const dir = at.subVectors(d.run.to, d.run.from);
          d.length = dir.length();
          d.group.rotation.y = Math.atan2(dir.x, dir.z);
          d.speed = 8 + random() * 7;
          d.v = d.speed;
          d.wait = random() * 5;
          d.group.visible = false;
          d.car.active = false;
          continue;
        }
        at.lerpVectors(d.run.from, d.run.to, d.t);
        // Up onto the bridge decks over the river.
        at.y = at.x > RIVER.x0 && at.x < RIVER.x1 ? 0.37 : 0.02;
        d.group.position.copy(at);
        // Full size the whole way: a car shrinking to nothing reads as a toy.
        d.group.visible = true;
      }
      for (let i = 0; i < walkers.length; i++) {
        const w = walkers[i];
        w.t += (dt * w.speed) / w.length;
        if (w.t >= 1) w.t -= 1;
        w.phase += dt * 8 * w.speed;
        at.lerpVectors(w.run.from, w.run.to, w.t);
        const k = Math.min(1, w.t * w.length / 2, (1 - w.t) * w.length / 2);
        place(i, at, k, Math.abs(Math.sin(w.phase)) * 0.04);
      }
      // Police walk the park's round in pairs; the first pair always, the second with more policing.
      police.forEach((p, i) => {
        const on = i < officers;
        p.shown = Math.min(1, Math.max(0, p.shown + (on ? dt : -dt) * 2));
        const next = ROUND[(p.leg + 1) % ROUND.length];
        const target = at.copy(next).add(s.set(i % 2 ? 1.1 : 0, 0, i % 2 ? 0.6 : 0));
        if (step(p.pos, target, 1.2, dt)) p.leg = (p.leg + 1) % ROUND.length;
        place(count - POLICE + i, p.pos, p.shown, Math.abs(Math.sin(walkClock * 7 + i)) * 0.03);
      });
      walkClock += dt;
      // Sellers stand at their spots; they melt away while officers are near.
      SELLERS.forEach((spot, i) => {
        const near = police.some((p) => p.shown > 0.5 && p.pos.distanceTo(spot) < 14);
        const want = i < sellersOut && !near ? 1 : 0;
        seller[i].shown = Math.min(1, Math.max(0, seller[i].shown + (want ? dt : -dt) * 1.5));
        place(strollers + i, spot, seller[i].shown, Math.sin(walkClock * 1.3 + i) * 0.015);
      });
      // Buyers come in from the park's edge, stop at a seller for a moment, and leave.
      buyers.forEach((b, i) => {
        if (b.wait > 0) {
          b.wait -= dt;
          if (b.wait <= 0) {
            if (b.dealer < 0) {
              const open = SELLERS.map((_, j) => j).filter((j) => seller[j].shown > 0.9);
              if (open.length) {
                b.dealer = open[Math.floor(random() * open.length)];
                b.target.copy(SELLERS[b.dealer]).add(s.set(0.8, 0, 0.5));
              } else {
                b.wait = 3;
              }
            } else {
              b.dealer = -1;
              b.target.copy(edgePoint(random));
            }
          }
        } else if (step(b.pos, b.target, 1.3, dt)) {
          // At a seller: a short exchange. At the edge: gone a while before coming back.
          b.wait = b.dealer >= 0 ? 3 + random() * 3 : 6 + random() * 10;
          if (b.dealer < 0) b.pos.copy(b.target);
        }
        const out = b.dealer < 0 && b.wait > 0;
        b.shown = Math.min(1, Math.max(0, b.shown + (out ? -dt : dt) * 2));
        place(strollers + SELLERS.length + i, b.pos, b.shown, b.wait > 0 ? 0 : Math.abs(Math.sin(walkClock * 8 + i)) * 0.04);
      });
      // Drunk people drift slowly about their hangout, swaying.
      drunks.forEach((d, i) => {
        const home = hangouts[d.home % Math.max(1, hangouts.length)];
        const want = home ? 1 : 0;
        d.shown = Math.min(1, Math.max(0, d.shown + (want ? dt : -dt)));
        if (!home) { place(drunkBase + i, d.pos, d.shown, 0); return; }
        if (d.shown < 0.05) d.pos.copy(home);
        if (d.wait > 0) d.wait -= dt;
        else if (step(d.pos, d.target, 0.55, dt)) {
          d.wait = 2 + random() * 6;
          d.target.set(home.x + (random() - 0.5) * 8, 0, home.z + (random() - 0.5) * 8);
        }
        const sway = Math.sin(walkClock * 2.1 + i * 1.7) * 0.25;
        place(drunkBase + i, at.set(d.pos.x + sway * 0.3, 0, d.pos.z), d.shown, Math.abs(Math.sin(walkClock * 3 + i)) * 0.05);
        people[drunkBase + i].heading += sway * 0.4;
      });
      joggers.forEach((j, i) => {
        j.shown = Math.min(1, Math.max(0, j.shown + (i < joggersOut ? dt : -dt) * 0.8));
        if (step(j.pos, LOOP[(j.leg + 1) % LOOP.length], 2.8, dt)) j.leg = (j.leg + 1) % LOOP.length;
        place(joggerBase + i, j.pos, j.shown, Math.abs(Math.sin(walkClock * 11 + i)) * 0.07);
      });
      // Now and then someone in the park overdoses near a seller; the ambulance is called.
      parkOverdoseIn -= dt * (0.4 + market);
      if (parkOverdoseIn <= 0) {
        parkOverdoseIn = 90 + random() * 150;
        const near = buyers.findIndex((b) => b.dealer >= 0 && b.wait > 0 && b.shown > 0.9);
        if (near >= 0) {
          const b = buyers[near];
          b.wait = 34;
          people[strollers + SELLERS.length + near].lying = true;
          setTimeout(() => { people[strollers + SELLERS.length + near].lying = false; }, 30000);
          dispatch('ambulance', b.pos.x, b.pos.z, t('Someone overdosed in the park, near where drugs are sold. A passer-by called it in.'));
        }
      }
      // Emergency vehicles: drive in, hold with lights on, drive off out of the city.
      for (const f of fleet) {
        f.v.tick(dt);
        f.car.active = f.busy;
        if (!f.busy) continue;
        const pos = f.v.group.position;
        if (f.hold > 0) {
          // Pulled over at the scene, out of everyone's way: off the traffic register until it leaves.
          f.car.active = false;
          step(pos, f.kerb, 3, dt);
          f.hold -= dt;
          if (f.hold <= 0) {
            // Back into its lane only once it is clear behind and ahead, then on through and out the far side.
            const last = f.path[f.path.length - 1];
            const fwd = last.clone().sub(f.path[0]).normalize();
            Object.assign(f.car, { x: last.x, z: last.z, dx: fwd.x, dz: fwd.z });
            if (!traffic.laneClear(f.car, 14, 8)) { f.hold = 0.5; continue; }
            const out = last.clone().addScaledVector(fwd, last.distanceTo(f.path[0]));
            f.path = [pos.clone(), last.clone().addScaledVector(fwd, 6), out];
            f.leg = 0;
            f.v.flashing = false;
          }
          continue;
        }
        const target = f.path[f.leg + 1];
        if (!target) { f.busy = false; f.car.active = false; f.v.group.visible = false; continue; }
        const dir = at.subVectors(target, pos);
        if (dir.lengthSq() > 1e-4) f.v.group.rotation.y = Math.atan2(dir.x, dir.z);
        const h = f.v.group.rotation.y;
        Object.assign(f.car, { x: pos.x, z: pos.z, dx: Math.sin(h), dz: Math.cos(h) });
        // Blue lights or not, it does not drive through a queue: it slows behind it.
        const gap = traffic.gapAhead(f.car);
        f.speed = gap < 1.2 ? 0 : approach(f.speed, speedForGap(14, gap), 12, dt);
        stood(f.car, f.speed, dt);
        rollWheels(f.v.group, f.speed * dt);
        if (step(pos, target, f.speed, dt)) {
          f.leg++;
          if (f.leg === f.path.length - 1 && f.v.flashing) f.hold = 28;
        }
        pos.y = pos.x > RIVER.x0 && pos.x < RIVER.x1 ? 0.37 : 0.02;
      }
      draw(dt);
    },
    setYield(ahead) {
      yieldTo = ahead;
    },
    setHangouts(points) {
      hangouts = points.map((p) => new Vector3(p.x, 0, p.z));
    },
    dispatch: (kind, x, z, reason) => dispatch(kind, x, z, reason),
    vehicles() {
      const out: { id: number; root: Object3D }[] = [];
      fleet.forEach((f, i) => { if (f.busy && f.v.group.visible) out.push({ id: i, root: f.v.group }); });
      patrols.forEach((p, i) => { if (p.visible) out.push({ id: fleet.length + i, root: p }); });
      busDrivers.forEach((d, i) => { if (drivers[d].group.visible) out.push({ id: fleet.length + patrols.length + i, root: drivers[d].group }); });
      return out;
    },
    vehicle(id) {
      const f = fleet[id];
      if (f) {
        if (!f.busy) return undefined;
        return { kind: f.kind, reason: f.reason, state: f.hold > 0 ? 'At the scene' : f.v.flashing ? 'On the way' : 'Leaving' };
      }
      const b = busDrivers[id - fleet.length - patrols.length];
      if (b !== undefined) {
        const d = drivers[b];
        if (!d.group.visible) return undefined;
        return { kind: 'bus', reason: t('A city bus on its route across town, through the district.'), state: d.v < 1 ? 'Held up' : 'On its route' };
      }
      if (!patrols[id - fleet.length]) return undefined;
      return {
        kind: 'police',
        reason: patrolLevel >= 2
          ? t('Patrolling under the current policy: officers are posted near the health services and stop people on their way in.')
          : t('A routine patrol round the district, not called to anything.'),
        state: 'On patrol',
      };
    },
    setView(x, z, radius, mpp) {
      view.x = x;
      view.z = z;
      view.radius = radius;
      view.mpp = mpp;
    },
    setFigureFactory(make) {
      makeFigure = make;
    },
    setJoggers(n) {
      joggersOut = Math.max(0, Math.min(JOGGERS, Math.round(n)));
    },
    setParkLife(level, patrol) {
      market = level;
      sellersOut = Math.min(SELLERS.length, 1 + Math.floor(Math.max(0, level) * 3.5));
      officers = patrol > 0 ? POLICE : 2;
      patrolLevel = patrol;
    },
  };
}

/** A random point on the edge of the big park's lawn. */
function edgePoint(random: Random): Vector3 {
  const t = random();
  const side = Math.floor(random() * 3);
  if (side === 0) return new Vector3(PARK.x0 + t * (PARK.x1 - PARK.x0), 0, PARK.z1);
  if (side === 1) return new Vector3(PARK.x0, 0, PARK.z0 + t * (PARK.z1 - PARK.z0));
  return new Vector3(PARK.x1, 0, PARK.z0 + t * (PARK.z1 - PARK.z0));
}
