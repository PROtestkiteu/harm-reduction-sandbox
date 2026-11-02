import { BoxGeometry, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { Archetype } from '../../agents/character';
import { BENCH, BUSKER, DELIVERY, SMOKERS } from '../../config/flavour/vignettes';
import { range } from '../../sim/random';
import { CLUB_QUEUE_DIR, VENUE_FRAME, toWorld } from '../layout';
import { mat } from '../materials';
import { dynamic } from '../mergeStatic';
import { fade, walkTo, type Actor } from './actors';
import type { Pack, PackDeps } from './index';
import { buildBusStops } from './busStops';
import { buildHotdog } from './hotdog';
import { courierBike, openCase, parkBench } from './props';

/**
 * Small scenes of street life: a busker in the centre park with people
 * stopping to listen, smokers by the club door, delivery riders waiting with
 * their bikes and riding off, and on the park bench someone feeding pigeons by
 * day or a couple sharing chips after dark, plus the hot dog cart
 * (hotdog.ts) and the bus stops at the edges (busStops.ts).
 */
const LISTENER_STYLES: readonly Archetype[] = ['student', 'tourist', 'everyday', 'older', 'raver'];
const SMOKER_STYLES: readonly Archetype[] = ['technoBlack', 'raver', 'punk', 'queerRave'];

export function buildVignettes({ pool, random, scene, buses }: PackDeps): Pack {
  const root = new Group();
  scene.add(root);

  // The busker and their listeners.
  const busker = pool.add({ style: 'punk', extra: 'backpack' }, BUSKER.at.x, BUSKER.at.z);
  busker.heading = BUSKER.face;
  busker.pose = 'dance';
  busker.speed = 0.6;
  busker.voice = 'busker';
  const guitarCase = openCase(root);
  guitarCase.position.set(BUSKER.at.x + Math.sin(BUSKER.face) * 0.9, 0, BUSKER.at.z + Math.cos(BUSKER.face) * 0.9);
  guitarCase.rotation.y = BUSKER.face;
  const listeners = BUSKER.listeners.map((at, i) => {
    const a = pool.add({ style: LISTENER_STYLES[i % LISTENER_STYLES.length] }, at.x, at.z);
    a.heading = Math.atan2(BUSKER.at.x - at.x, BUSKER.at.z - at.z);
    a.voice = 'listener';
    return { a, at, on: false, timer: range(random, BUSKER.gap) };
  });

  // Smokers by the club door, on the side away from the queue.
  const smokers = SMOKERS.map((s, i) => {
    const p = toWorld(VENUE_FRAME.club, { x: -8.5 + s.out, z: -2.4 + s.along });
    const a = pool.add({ style: SMOKER_STYLES[i % SMOKER_STYLES.length] }, p.x, p.z);
    // Facing out from the wall, turned a little to each other.
    a.heading = Math.atan2(CLUB_QUEUE_DIR.z, -CLUB_QUEUE_DIR.x) + (i - 1) * 0.7;
    a.glow = 'ember';
    a.smokes = true;
    a.pose = i === 1 ? 'talk' : 'stand';
    a.voice = 'smoker';
    return a;
  });

  // Delivery riders: wait with the bike, ride off, a new one comes.
  const riders = DELIVERY.wait.map((at, i) => {
    const a = pool.add({ style: 'worker', extra: 'none' }, at.x, at.z);
    a.attach = courierBike(root, i ? 0x3a3a40 : 0x2a4a3a, i ? 0x2aa0a0 : 0xe07a2a);
    a.glow = 'phone';
    a.voice = 'rider';
    return { a, at, state: 'wait' as 'wait' | 'ride' | 'gone', timer: range(random, DELIVERY.waitFor) * (i + 0.6) };
  });

  // The bench, and its pigeons (one instanced mesh, pecking).
  const seat = parkBench(root);
  seat.position.set(BENCH.at.x, 0.12, BENCH.at.z - 0.05);
  seat.rotation.y = BENCH.face;
  const feeder = pool.add({ style: 'older', extra: 'bag' }, BENCH.at.x - 0.3, BENCH.at.z);
  feeder.heading = BENCH.face;
  feeder.pose = 'sit';
  const partner = pool.add({ style: 'student' }, BENCH.at.x + 0.6, BENCH.at.z);
  partner.heading = BENCH.face;
  partner.pose = 'sit';
  partner.voice = 'passerby';
  const pigeons = dynamic(new InstancedMesh(new BoxGeometry(0.16, 0.13, 0.26).translate(0, 0.07, 0), mat(0x7a7c84), BENCH.pigeons));
  pigeons.castShadow = false;
  root.add(pigeons);
  const birds = Array.from({ length: BENCH.pigeons }, (_, i) => ({ a: (i / BENCH.pigeons) * 6.28, r: 1 + random() * 1.4, peck: random() * 6 }));
  const m = new Matrix4();
  const q = new Quaternion();
  const v = new Vector3();
  const one = new Vector3(1, 1, 1);
  const up = new Vector3(0, 1, 0);
  const side = new Vector3(1, 0, 0);
  const tilt = new Quaternion();
  let time = 0;

  const cart = buildHotdog(pool, random, root);
  const stops = buildBusStops(pool, random, root, buses);

  const all: Actor[] = [...cart.actors, ...stops.actors,busker, ...listeners.map((l) => l.a), ...smokers, ...riders.map((r) => r.a), feeder, partner];

  return {
    setEnabled(on) {
      root.visible = on;
      if (!on) for (const a of all) a.shown = 0;
    },
    update(dt, ctx) {
      time += dt;
      cart.update(dt);
      stops.update(dt);
      const playing = ctx.clock < BUSKER.until;
      fade(busker, playing, dt, 0.8);
      guitarCase.visible = busker.shown > 0.2;
      for (const l of listeners) {
        l.timer -= dt;
        if (l.timer <= 0) {
          l.on = playing && !l.on;
          l.timer = l.on ? range(random, BUSKER.stay) : range(random, BUSKER.gap);
        }
        fade(l.a, l.on, dt, 0.8);
      }
      const clubOpen = ctx.clock >= 1260 && ctx.clock < 1740;
      for (const s of smokers) fade(s, clubOpen, dt, 0.5);
      const busy = ctx.clock >= DELIVERY.hours[0] && ctx.clock < DELIVERY.hours[1];
      for (const r of riders) {
        const a = r.a;
        if (r.state === 'wait') {
          fade(a, busy, dt);
          a.pose = 'stand';
          a.heading = Math.PI / 2;
          r.timer -= dt;
          if (r.timer <= 0 && a.shown > 0.9) { r.state = 'ride'; a.glow = 'none'; }
        } else if (r.state === 'ride') {
          a.lift = 0.38;
          a.pose = 'sit';
          if (walkTo(a, DELIVERY.ride[1].x, DELIVERY.ride[1].z, DELIVERY.speed, dt)) { r.state = 'gone'; r.timer = 20 + random() * 30; }
          a.pose = 'sit';
          a.speed = 1;
          if (Math.abs(a.z - DELIVERY.ride[1].z) < 8) fade(a, false, dt, 2);
        } else {
          a.shown = 0;
          r.timer -= dt;
          if (r.timer <= 0) {
            // Someone new: back at the wait spot, fading in.
            a.x = r.at.x;
            a.z = r.at.z;
            a.lift = 0;
            a.glow = 'phone';
            r.state = 'wait';
            r.timer = range(random, DELIVERY.waitFor);
          }
        }
      }
      // By day the pigeons; after dark the couple with their chips.
      const day = ctx.day > 0.3;
      fade(feeder, true, dt, 0.5);
      fade(partner, !day, dt, 0.5);
      feeder.voice = day ? undefined : 'passerby';
      pigeons.visible = day && feeder.shown > 0.5;
      if (pigeons.visible) {
        birds.forEach((b, i) => {
          b.peck -= dt;
          if (b.peck <= 0) { b.peck = 0.6 + random() * 2.5; b.a += (random() - 0.5) * 0.8; b.r = Math.max(0.8, Math.min(2.6, b.r + (random() - 0.5) * 0.5)); }
          const bob = ctx.still ? 0 : Math.max(0, Math.sin(time * 9 + i * 2)) * 0.25;
          q.setFromAxisAngle(up, b.a + Math.PI / 2).multiply(tilt.setFromAxisAngle(side, bob));
          m.compose(v.set(BENCH.at.x + Math.cos(b.a) * b.r, 0.12, BENCH.at.z + 1.6 + Math.sin(b.a) * b.r * 0.6), q, one);
          pigeons.setMatrixAt(i, m);
        });
        pigeons.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
