import { BoxGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, Quaternion, SphereGeometry, Vector3, type Object3D } from 'three';
import { SKY } from '../../config/flavour/sky';
import { inView } from '../../render/viewEdge';
import { range } from '../../sim/random';
import { add, box } from '../kit';
import { glowMat, mat, vehicleMat } from '../materials';
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

/** How far either side of (x, z) a crossing at `height` must start and end to be out of sight along `dir`. */
function reachFor(x: number, z: number, dx: number, dz: number, height: number): number {
  let r = SKY.reach;
  while (r < 700 && (inView(x - dx * r, z - dz * r, 0, 0, 6, 6, height - 3) || inView(x + dx * r, z + dz * r, 0, 0, 6, 6, height - 3))) r += 30;
  return r;
}

function lightPlane(): Group {
  const g = new Group();
  const white = vehicleMat(0xe8e6e0);
  add(g, box(0.5, 0.5, 3.2, white, 0, 0, -1.4));
  add(g, box(5.6, 0.08, 0.9, white, 0, 0.35, -0.6));
  add(g, box(1.8, 0.06, 0.5, white, 0, 0.2, -2.7));
  add(g, box(0.06, 0.6, 0.5, vehicleMat(0xb83a2a), 0, 0.25, -2.75));
  add(g, box(0.4, 0.3, 0.5, vehicleMat(0x30404c), 0, 0.42, -0.4));
  return g;
}

export function balloon(): Group {
  const g = new Group();
  // The envelope: a round crown of vertical gores in four colours, narrowing to the mouth over the basket.
  const stripes = [0xc8382a, 0xe8b830, 0x2a6aa8, 0xe8e2d0];
  const GORES = 12;
  for (let i = 0; i < GORES; i++) {
    const m = vehicleMat(stripes[i % stripes.length], 0);
    const crown = new Mesh(new SphereGeometry(2.4, 3, 10, (i / GORES) * Math.PI * 2, (Math.PI * 2) / GORES, 0, Math.PI * 0.62), m);
    crown.position.y = 4.6;
    crown.scale.y = 1.12;
    g.add(crown);
    const skirt = new Mesh(new CylinderGeometry(2.4 * Math.sin(Math.PI * 0.62), 0.45, 2.2, 3, 1, true, (i / GORES) * Math.PI * 2, (Math.PI * 2) / GORES), m);
    // Its top meets the crown's lower edge; its open bottom is the mouth.
    skirt.position.y = 4.6 + 2.4 * 1.12 * Math.cos(Math.PI * 0.62) - 1.1;
    g.add(skirt);
  }
  add(g, box(0.8, 0.6, 0.8, vehicleMat(0x6a4a2a), 0, 0, 0));
  for (const [x, z] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) add(g, box(0.03, 1.0, 0.03, vehicleMat(0x3a3a3a), x, 0.6, z));
  return g;
}

function glider(): Group {
  const g = new Group();
  const white = vehicleMat(0xf2f2ee);
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
  const flock = { on: false, wait: range(random, SKY.birds.every) * 0.3, t: 0, d: 0, reach: SKY.reach, n: 0, from: new Vector3(), dir: new Vector3(), offs: [] as { x: number; y: number; z: number; ph: number }[] };
  const make = (g: Object3D, every: readonly [number, number]): Crossing => {
    g.visible = false;
    g.userData.mover = 'air';
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

  let wind = random() * Math.PI * 2;
  /**
   * Starts a crossing past the view's middle at `height`, heading `angle` (a
   * random one if not given), from and to points out of sight. Returns its length.
   */
  const launch = (c: { from: Vector3; dir: Vector3 }, height: number, angle = random() * Math.PI * 2): number => {
    const view = pool.viewCentre;
    c.dir.set(Math.sin(angle), 0, Math.cos(angle));
    const side = (random() - 0.5) * 30;
    const mx = view.x + c.dir.z * side;
    const mz = view.z - c.dir.x * side;
    const reach = reachFor(mx, mz, c.dir.x, c.dir.z, height);
    c.from.set(mx - c.dir.x * reach, height, mz - c.dir.z * reach);
    return reach * 2;
  };
  /** Metres it moved this frame: its speed, made up when out of sight. */
  const pace = (x: number, y: number, z: number, speed: number, dt: number) => speed * dt * (inView(x, z, 0, 0, 6, 6, y - 3) ? 1 : SKY.unseenHurry);
  const tick = (c: Crossing, dt: number, every: readonly [number, number], height: number, speed: number, allowed: boolean, angle?: () => number) => {
    if (!c.on) {
      if ((c.wait -= dt) > 0 || !allowed) return;
      c.on = true;
      c.t = 0;
      c.speed = speed;
      c.length = launch(c, height, angle?.());
      c.g.visible = true;
      c.g.rotation.y = Math.atan2(c.dir.x, c.dir.z);
    }
    // `t` is the distance flown.
    c.t += pace(c.g.position.x, height, c.g.position.z, c.speed, dt);
    c.g.position.copy(c.from).addScaledVector(c.dir, c.t);
    if (c.t > c.length) { c.on = false; c.g.visible = false; c.wait = range(random, every); }
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
      // The balloon goes where the wind takes it; the wind veers a little between one balloon and the next.
      tick(balloonX, dt, SKY.balloon.every, SKY.balloon.height, SKY.balloon.speed, day && !ctx.snowy, () => (wind += (random() - 0.5) * 2 * SKY.windVeer));
      if (balloonX.on) balloonX.g.position.y += ctx.still ? 0 : Math.sin(time * 0.4) * 1.2;
      // A glider circles a little as it goes.
      tick(gliderX, dt, SKY.glider.every, SKY.glider.height, SKY.glider.speed, day && !ctx.snowy);
      if (gliderX.on) gliderX.g.rotation.z = 0.25;
      // Birds: one flock at a time, more by day.
      if (!flock.on) {
        if ((flock.wait -= dt * (day ? 1 : 0.35)) <= 0) {
          flock.on = true;
          flock.t = 0;
          flock.n = Math.round(range(random, SKY.birds.flock));
          flock.offs = Array.from({ length: flock.n }, (_, i) => ({ x: (random() - 0.5) * 6, y: (random() - 0.5) * 2, z: -i * 1.4 - random(), ph: random() * 6 }));
          // At dusk the flocks head for their roost in the big park, at dawn away from it.
          const v = pool.viewCentre;
          const toRoost = Math.atan2(SKY.roost.x - v.x, SKY.roost.z - v.z);
          const c = ctx.clock;
          const angle = c >= SKY.roost.dusk[0] && c < SKY.roost.dusk[1] ? toRoost : c >= SKY.roost.dawn[0] && c < SKY.roost.dawn[1] ? toRoost + Math.PI : undefined;
          flock.reach = launch(flock, range(random, SKY.birds.height), angle) / 2;
          flock.d = 0;
        }
        wing.count = 0;
        return;
      }
      flock.t += dt;
      flock.d += pace(flock.from.x + flock.dir.x * flock.d, flock.from.y, flock.from.z + flock.dir.z * flock.d, SKY.birds.speed, dt);
      const d = flock.d;
      if (d > flock.reach * 2) { flock.on = false; flock.wait = range(random, SKY.birds.every); wing.count = 0; return; }
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
