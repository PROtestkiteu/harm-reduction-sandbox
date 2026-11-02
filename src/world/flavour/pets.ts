import { type BufferGeometry, CapsuleGeometry, Color, ConeGeometry, Group, InstancedMesh, Matrix4, MeshLambertMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { Dog } from '../../agents/dog';
import { DOG_WALKS, PETS } from '../../config/flavour/pets';
import { range } from '../../sim/random';
import { dynamic } from '../mergeStatic';
import { fade, walkTo, type Actor } from './actors';
import type { Pack, PackDeps } from './index';

/**
 * Pets (config/flavour/pets.ts): people walking dogs up and down the inner
 * ring's pavements, stopping while the dog sniffs, and cats in doorways that
 * now and then trot a few metres and settle. The dogs are the crowd's own
 * (agents/dog.ts); the cats are four instanced parts, so every cat together
 * costs four draw calls.
 */
interface Walker { a: Actor; dog: Dog; to: 0 | 1; sniff: number; walk: (typeof DOG_WALKS)[number] }
interface Cat { x: number; z: number; tx: number; tz: number; h: number; moving: boolean; tail: number }

const inHours = (clock: number) => PETS.hours.some(([a, b]) => clock >= a && clock < b);

export function buildPets({ pool, random, scene }: PackDeps): Pack {
  const root = dynamic(new Group());
  scene.add(root);
  const walkers: Walker[] = DOG_WALKS.map((walk, i) => {
    const a = pool.add({ style: (['older', 'everyday', 'student'] as const)[i % 3], extra: i === 1 ? 'jacket' : 'none' }, walk.from.x, walk.from.z);
    const dog = new Dog(31 + i * 7);
    // The dog keeps its own place at heel inside a holder that follows the walker.
    const holder = new Group();
    holder.add(dog.root);
    root.add(holder);
    a.attach = holder;
    return { a, dog, to: 1, sniff: 0, walk };
  });

  // Cats: body, head, ears and tail, one instanced mesh each, a coat per cat.
  const n = PETS.cats.length;
  const mats = new MeshLambertMaterial({ color: 0xffffff });
  const part = (geo: BufferGeometry, count: number) => {
    const m = new InstancedMesh(geo, mats, count);
    m.castShadow = false;
    root.add(m);
    return m;
  };
  const body = part(new CapsuleGeometry(0.07, 0.2, 3, 8).rotateX(Math.PI / 2), n);
  const head = part(new SphereGeometry(0.065, 8, 6), n);
  const ears = part(new ConeGeometry(0.025, 0.05, 4), n * 2);
  const tail = part(new CapsuleGeometry(0.014, 0.2, 2, 4).translate(0, 0.1, 0), n);
  const cats: Cat[] = PETS.cats.map((p) => ({ x: p.x, z: p.z, tx: p.x, tz: p.z, h: random() * 6.28, moving: false, tail: random() * 6 }));
  cats.forEach((_, i) => {
    const c = new Color(PETS.coats[i % PETS.coats.length]);
    body.setColorAt(i, c); head.setColorAt(i, c); tail.setColorAt(i, c); ears.setColorAt(i * 2, c); ears.setColorAt(i * 2 + 1, c);
  });
  const m = new Matrix4();
  const q = new Quaternion();
  const v = new Vector3();
  const one = new Vector3(1, 1, 1);
  const up = new Vector3(0, 1, 0);
  const tilt = new Quaternion();
  const tq = new Quaternion();
  const side = new Vector3(1, 0, 0);
  const place = (i: number, c: Cat, still: boolean) => {
    const sit = !c.moving;
    q.setFromAxisAngle(up, c.h);
    m.compose(v.set(c.x, sit ? 0.2 : 0.24, c.z), q, one);
    body.setMatrixAt(i, m);
    const fx = Math.sin(c.h), fz = Math.cos(c.h);
    const hy = sit ? 0.38 : 0.3;
    m.compose(v.set(c.x + fx * 0.15, hy, c.z + fz * 0.15), q, one);
    head.setMatrixAt(i, m);
    for (const s of [-1, 1]) {
      m.compose(v.set(c.x + fx * 0.15 + Math.cos(c.h) * s * 0.035, hy + 0.06, c.z + fz * 0.15 - Math.sin(c.h) * s * 0.035), q, one);
      ears.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), m);
    }
    // The tail: up and curling while it walks, along the ground with a flick when it sits.
    const flick = still ? 0 : Math.sin(c.tail) * 0.4;
    tilt.setFromAxisAngle(side, sit ? -1.3 + flick * 0.3 : -0.4 + flick);
    m.compose(v.set(c.x - fx * 0.15, 0.24, c.z - fz * 0.15), tq.copy(q).multiply(tilt), one);
    tail.setMatrixAt(i, m);
  };

  return {
    setEnabled(on) {
      root.visible = on;
      if (!on) for (const w of walkers) w.a.shown = 0;
    },
    update(dt, ctx) {
      const out = inHours(ctx.clock);
      for (const w of walkers) {
        fade(w.a, out, dt, 0.8);
        if (w.a.shown <= 0) continue;
        const target = w.to ? w.walk.to : w.walk.from;
        let moving = true;
        if (w.sniff > 0) {
          w.sniff -= dt;
          w.a.pose = 'stand';
          moving = false;
        } else if (walkTo(w.a, target.x, target.z, PETS.pace, dt)) w.to = w.to ? 0 : 1;
        else if (random() < PETS.sniffPerSecond * dt) w.sniff = range(random, PETS.sniff);
        w.dog.update(dt, moving, ctx.still);
      }
      cats.forEach((c, i) => {
        c.tail += dt * (c.moving ? 6 : 1.5);
        if (c.moving) {
          const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
          if (d < PETS.catSpeed * dt) { c.x = c.tx; c.z = c.tz; c.moving = false; }
          else { c.x += (dx / d) * PETS.catSpeed * dt; c.z += (dz / d) * PETS.catSpeed * dt; c.h = Math.atan2(dx, dz); }
        } else if (!ctx.still && random() < PETS.catMovePerSecond * dt) {
          // Along its wall a little way, never off it: home spot plus or minus a hop.
          const home = PETS.cats[i];
          const along = (random() < 0.5 ? -1 : 1) * range(random, PETS.catHop);
          const alongX = Math.abs(home.z) > Math.abs(home.x);
          c.tx = alongX ? home.x + along : home.x;
          c.tz = alongX ? home.z : home.z + along;
          c.moving = true;
        }
        place(i, c, ctx.still);
      });
      for (const mesh of [body, head, ears, tail]) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
