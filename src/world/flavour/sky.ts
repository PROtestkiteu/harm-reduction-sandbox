import { BoxGeometry, Group, InstancedMesh, Matrix4, Quaternion, Vector3, type Object3D } from 'three';
import { SKY } from '../../config/flavour/sky';
import { range } from '../../sim/random';
import { add, box, cylinder } from '../kit';
import { glowMat, mat } from '../materials';
import { dynamic } from '../mergeStatic';
import type { Pack, PackDeps } from './index';

/**
 * The sky (config/flavour/sky.ts): a small flock now and then (one
 * instanced mesh of flapping wings), a light aircraft with blinking lights
 * after dark, and on fine days a hot-air balloon or a glider. Each crosses
 * past the middle of the view and is hidden between crossings, so the pack
 * costs a few draw calls only while something is up.
 */
interface Crossing { g: Object3D; on: boolean; wait: number; t: number; from: Vector3; dir: Vector3; speed: number; length: number }

function lightPlane(): Group {
  const g = new Group();
  const white = mat(0xe8e6e0);
  add(g, box(0.5, 0.5, 3.2, white, 0, 0, -1.4));
  add(g, box(5.6, 0.08, 0.9, white, 0, 0.35, -0.6));
  add(g, box(1.8, 0.06, 0.5, white, 0, 0.2, -2.7));
  add(g, box(0.06, 0.6, 0.5, mat(0xb83a2a), 0, 0.25, -2.75));
  add(g, box(0.4, 0.3, 0.5, mat(0x30404c), 0, 0.42, -0.4));
  return g;
}

function balloon(): Group {
  const g = new Group();
  const stripes = [0xc8382a, 0xe8b830, 0x2a6aa8, 0xe8e2d0];
  for (let i = 0; i < 4; i++) add(g, cylinder(2.4 - Math.abs(i - 1.5) * 0.5, 1.1, mat(stripes[i]), 12, 0, 2.6 + i * 1.1, 0));
  add(g, cylinder(1.2, 0.6, mat(stripes[0]), 12, 0, 2.0, 0));
  add(g, box(0.8, 0.6, 0.8, mat(0x6a4a2a), 0, 0, 0));
  for (const [x, z] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) add(g, box(0.03, 1.5, 0.03, mat(0x3a3a3a), x, 0.6, z));
  return g;
}

function glider(): Group {
  const g = new Group();
  const white = mat(0xf2f2ee);
  add(g, box(0.35, 0.35, 3.6, white, 0, 0, -1.6));
  add(g, box(9, 0.05, 0.5, white, 0, 0.2, -0.8));
  add(g, box(1.4, 0.05, 0.35, white, 0, 0.4, -3.3));
  add(g, box(0.05, 0.6, 0.4, white, 0, 0.35, -3.35));
  return g;
}

export function buildSky({ pool, random, scene }: PackDeps): Pack {
  const root = dynamic(new Group());
  scene.add(root);
  // Birds: two wings each, as one instanced mesh; up to two flocks of eight.
  const WINGS = 32;
  const wing = new InstancedMesh(new BoxGeometry(0.42, 0.03, 0.16).translate(0.21, 0, 0), mat(0x2a2826), WINGS);
  wing.castShadow = false;
  wing.count = 0;
  root.add(wing);
  const flock = { on: false, wait: range(random, SKY.birds.every) * 0.3, t: 0, n: 0, from: new Vector3(), dir: new Vector3(), offs: [] as { x: number; y: number; z: number; ph: number }[] };
  const make = (g: Object3D, every: readonly [number, number]): Crossing => {
    g.visible = false;
    root.add(g);
    return { g, on: false, wait: range(random, every) * 0.5, t: 0, from: new Vector3(), dir: new Vector3(), speed: 0, length: SKY.reach * 2 };
  };
  const plane = lightPlane();
  const blink = add(plane, box(0.12, 0.12, 0.12, glowMat(0x401010, 0xff3030, 2.2), 0, -0.3, -1.4));
  const planeX = make(plane, SKY.plane.every);
  const balloonX = make(balloon(), SKY.balloon.every);
  const gliderX = make(glider(), SKY.glider.every);
  const m = new Matrix4();
  const q = new Quaternion();
  const v = new Vector3();
  const one = new Vector3(1, 1, 1);
  const up = new Vector3(0, 1, 0);
  const fwd = new Vector3(0, 0, 1);
  const flapQ = new Quaternion();
  let time = 0;

  /** Starts a crossing past the view's middle at `height`, in a random direction. */
  const launch = (c: { from: Vector3; dir: Vector3 }, height: number) => {
    const view = pool.viewCentre;
    const a = random() * Math.PI * 2;
    c.dir.set(Math.sin(a), 0, Math.cos(a));
    const side = (random() - 0.5) * 30;
    c.from.set(view.x - c.dir.x * SKY.reach + c.dir.z * side, height, view.z - c.dir.z * SKY.reach - c.dir.x * side);
  };
  const tick = (c: Crossing, dt: number, every: readonly [number, number], height: number, speed: number, allowed: boolean) => {
    if (!c.on) {
      if ((c.wait -= dt) > 0 || !allowed) return;
      c.on = true;
      c.t = 0;
      c.speed = speed;
      launch(c, height);
      c.g.visible = true;
      c.g.rotation.y = Math.atan2(c.dir.x, c.dir.z);
    }
    c.t += dt;
    const d = c.t * c.speed;
    c.g.position.copy(c.from).addScaledVector(c.dir, d);
    if (d > c.length) { c.on = false; c.g.visible = false; c.wait = range(random, every); }
  };

  return {
    setEnabled(on) {
      root.visible = on;
    },
    update(dt, ctx) {
      time += dt;
      const day = ctx.day > 0.4;
      tick(planeX, dt, SKY.plane.every, SKY.plane.height, SKY.plane.speed, true);
      blink.visible = !day && Math.sin(time * 6) > 0.6;
      tick(balloonX, dt, SKY.balloon.every, SKY.balloon.height, SKY.balloon.speed, day && !ctx.snowy);
      // A glider circles a little as it goes.
      tick(gliderX, dt, SKY.glider.every, SKY.glider.height, SKY.glider.speed, day && !ctx.snowy);
      if (gliderX.on) gliderX.g.rotation.z = 0.25;
      // Birds: one flock at a time, more by day.
      if (!flock.on) {
        if ((flock.wait -= dt * (day ? 1 : 0.35)) <= 0) {
          flock.on = true;
          flock.t = 0;
          flock.n = Math.round(range(random, SKY.birds.flock));
          launch(flock, range(random, SKY.birds.height));
          flock.offs = Array.from({ length: flock.n }, (_, i) => ({ x: (random() - 0.5) * 6, y: (random() - 0.5) * 2, z: -i * 1.4 - random(), ph: random() * 6 }));
        }
        wing.count = 0;
        return;
      }
      flock.t += dt;
      const d = flock.t * SKY.birds.speed;
      if (d > SKY.reach * 2) { flock.on = false; flock.wait = range(random, SKY.birds.every); wing.count = 0; return; }
      const heading = Math.atan2(flock.dir.x, flock.dir.z);
      let k = 0;
      for (const o of flock.offs) {
        const cx = flock.from.x + flock.dir.x * (d + o.z) + flock.dir.z * o.x;
        const cz = flock.from.z + flock.dir.z * (d + o.z) - flock.dir.x * o.x;
        const flap = ctx.still ? 0.2 : Math.sin(time * 9 + o.ph) * 0.7;
        for (const s of [-1, 1]) {
          q.setFromAxisAngle(up, heading + (s < 0 ? Math.PI : 0));
          q.multiply(flapQ.setFromAxisAngle(fwd, s * flap));
          m.compose(v.set(cx, flock.from.y + o.y, cz), q, one);
          if (k < WINGS) wing.setMatrixAt(k++, m);
        }
      }
      wing.count = k;
      wing.instanceMatrix.needsUpdate = true;
    },
  };
}
