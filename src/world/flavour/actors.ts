import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type Object3D,
} from 'three';
import type { Appearance, Archetype, BodyState, Figure, Kit, Pose } from '../../agents/character';
import { dynamic } from '../mergeStatic';
import type { Solids } from '../solids';

/**
 * The people the flavour packs put in the street. One pool for all packs, so
 * their figures share one budget: the actors nearest the middle of the view get
 * sculpted figures, the rest are cheap instanced shapes when the camera is far
 * out, or nothing when it is close (out of view). Small lights people hold (a
 * cigarette, a lighter, a phone) and the smoke they breathe out are two shared
 * point clouds, so a street full of smokers costs two draw calls.
 */

/** Who an actor is, for their figure: the clothes of an everyday group, kit, uniform. */
export interface ActorLook {
  style: Archetype;
  kit?: Kit;
  police?: boolean;
  /** Hi-vis vest in this colour (wardens, bin crews). */
  vest?: number;
  extra?: 'none' | 'backpack' | 'bag' | 'scarf' | 'jacket';
  /** Laid over the seeded look: colours, hair, a beard. */
  dress?: Partial<Appearance>;
}

/** A small light at the hand: an ember, a lighter's flame, a phone screen. */
export type Glow = 'none' | 'ember' | 'flame' | 'phone' | 'vape';

export interface Actor {
  x: number;
  z: number;
  heading: number;
  pose: Pose;
  body: BodyState;
  /** Walking speed for the stride, m/s. */
  speed: number;
  /** 0 hidden to 1 fully there: people fade in and out at the edges of their scene. */
  shown: number;
  /** Flat on the ground (someone overdosed or asleep). */
  lying: boolean;
  /** Raised off the ground this far (a rider on a bike's saddle). */
  lift: number;
  glow: Glow;
  /** Puffs of smoke now and then (smokers, people using). */
  smokes: boolean;
  /** Vaping: bigger clouds, more often. */
  vapes?: boolean;
  /** Something that goes where they go (a bike, a guitar case, a box): placed under the actor each frame. */
  attach?: Object3D;
  /** What kind of line they might say (see config/flavour/lines.ts), or none. */
  voice?: string;
  readonly look: ActorLook;
  /** Set by the pool: has a sculpted figure this frame (lines only go to those). */
  detailed: boolean;
  /** Set by the pool: squared distance from the middle of the view this frame. */
  d2: number;
}

export type FigureMaker = (look: ActorLook) => Figure | null;

/** Below this many pixels tall, a person is drawn as a cheap shape. */
const TINY_PX = 9;
const MAX = 160;
const SMOKE = 96;

function dotTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 32, 32);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

const GLOW_COLOUR: Record<Exclude<Glow, 'none'>, number> = { ember: 0xff6a2a, flame: 0xffc060, phone: 0xbcd8ff, vape: 0x5ae0ff };

const byDistance = (a: Actor, b: Actor) => a.d2 - b.d2;

export class ActorPool {
  readonly actors: Actor[] = [];
  private readonly near: Actor[] = [];
  private readonly root = dynamic(new Group());
  private readonly figures = new Map<Actor, Figure>();
  private readonly lastUsed = new Map<Actor, number>();
  private readonly bodies: InstancedMesh;
  private readonly heads: InstancedMesh;
  private readonly glows: Points;
  private readonly smoke: Points;
  private readonly smokeAge = new Float32Array(SMOKE).fill(9);
  private readonly smokeVel = new Float32Array(SMOKE * 3);
  private smokeNext = 0;
  private make: FigureMaker | null = null;
  private readonly view = { x: 0, z: 0, radius: 60, mpp: 0.2 };
  private clock = 0;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly v = new Vector3();
  private readonly s = new Vector3();
  private readonly c = new Color();

  constructor(scene: Object3D, private readonly budget: number, private readonly random: () => number) {
    scene.add(this.root);
    const mat = new MeshLambertMaterial({ color: 0xffffff });
    this.bodies = new InstancedMesh(new CapsuleGeometry(0.22, 0.9, 3, 8), mat, MAX);
    this.heads = new InstancedMesh(new SphereGeometry(0.15, 8, 6), mat, MAX);
    this.bodies.count = this.heads.count = 0;
    this.bodies.frustumCulled = this.heads.frustumCulled = false;
    const tex = dotTexture();
    const glowGeo = new BufferGeometry();
    glowGeo.setAttribute('position', new BufferAttribute(new Float32Array(MAX * 3), 3));
    glowGeo.setAttribute('color', new BufferAttribute(new Float32Array(MAX * 3), 3));
    glowGeo.setDrawRange(0, 0);
    this.glows = new Points(glowGeo, new PointsMaterial({ size: 0.22, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false }));
    const smokeGeo = new BufferGeometry();
    smokeGeo.setAttribute('position', new BufferAttribute(new Float32Array(SMOKE * 3).fill(-99), 3));
    smokeGeo.setAttribute('color', new BufferAttribute(new Float32Array(SMOKE * 3), 3));
    this.smoke = new Points(smokeGeo, new PointsMaterial({ size: 0.5, map: tex, vertexColors: true, transparent: true, depthWrite: false, opacity: 0.5 }));
    this.glows.frustumCulled = this.smoke.frustumCulled = false;
    this.root.add(this.bodies, this.heads, this.glows, this.smoke);
  }

  setFigureMaker(make: FigureMaker): void {
    this.make = make;
  }

  setView(x: number, z: number, radius: number, mpp: number): void {
    Object.assign(this.view, { x, z, radius, mpp });
  }

  /** The middle of the view on the ground and the radius it shows (metres), for things placed relative to the camera. */
  get viewCentre(): { readonly x: number; readonly z: number; readonly radius: number } {
    return this.view;
  }

  /** Metres a screen pixel covers now, for things drawn a pixel or two wide. */
  get metresPerPixel(): number {
    return this.view.mpp;
  }

  add(look: ActorLook, x = 0, z = 0): Actor {
    const a: Actor = { x, z, heading: 0, pose: 'stand', body: 'normal', speed: 1.2, shown: 0, lying: false, lift: 0, glow: 'none', smokes: false, look, detailed: false, d2: 0 };
    this.actors.push(a);
    return a;
  }

  /** Whether anything is out: the manager skips the pool entirely when nothing is. */
  get busy(): boolean {
    for (const a of this.actors) if (a.shown > 0.01) return true;
    return this.smokeAge.some((age) => age < 3);
  }

  setVisible(on: boolean): void {
    this.root.visible = on;
    if (!on) for (const f of this.figures.values()) f.root.visible = false;
  }

  /** The street's fixed obstacles (benches, bins, trees, parked cars): walkers are kept clear of them. */
  private solids: Solids | null = null;
  private readonly push = { x: 0, z: 0 };
  setSolids(solids: Solids): void {
    this.solids = solids;
  }

  /** Draws every actor at the detail the camera needs. */
  update(dt: number): void {
    this.clock += dt;
    // People walking a pack's route step round what stands in the way, as the crowd does (agents/crowd.ts);
    // those standing, sitting or lying were placed clear of it already.
    const solids = this.solids;
    if (solids) {
      for (const a of this.actors) {
        if (a.shown <= 0.01 || a.pose !== 'walk' || a.lift > 0) continue;
        this.push.x = this.push.z = 0;
        if (solids.push(a.x, a.z, 0.22, this.push)) { a.x += this.push.x; a.z += this.push.z; }
      }
    }
    const view = this.view;
    const tiny = !this.make || 1.7 / view.mpp < TINY_PX;
    // Sculpted figures for the actors nearest the middle of the view, up to the budget (arrays reused, nothing allocated).
    const near = this.near;
    near.length = 0;
    for (const a of this.actors) a.detailed = false;
    if (!tiny) {
      const r2 = (view.radius * 1.15) ** 2;
      for (const a of this.actors) {
        if (a.shown <= 0.05) continue;
        a.d2 = (a.x - view.x) ** 2 + (a.z - view.z) ** 2;
        if (a.d2 < r2) near.push(a);
      }
      if (near.length > this.budget) {
        near.sort(byDistance);
        near.length = this.budget;
      }
      for (const a of near) a.detailed = true;
    }
    let n = 0;
    let g = 0;
    const gp = this.glows.geometry.getAttribute('position') as BufferAttribute;
    const gc = this.glows.geometry.getAttribute('color') as BufferAttribute;
    for (const a of this.actors) {
      const fig = this.figures.get(a);
      const shown = a.shown > 0.01;
      if (a.attach) {
        a.attach.visible = shown;
        if (shown) { a.attach.position.set(a.x, 0, a.z); a.attach.rotation.y = a.heading; }
      }
      if (!shown) { if (fig) fig.root.visible = false; continue; }
      if (a.detailed) {
        let f = fig;
        if (!f && this.make) {
          f = this.make(a.look) ?? undefined;
          if (f) {
            f.root.userData.baseScale = f.root.scale.x;
            this.root.add(f.root);
            this.figures.set(a, f);
          }
        }
        if (f) {
          this.lastUsed.set(a, this.clock);
          f.root.visible = true;
          f.root.position.set(a.x, (a.lying ? 0.18 : -0.04) + a.lift, a.z);
          f.root.rotation.set(a.lying ? -Math.PI / 2 : 0, a.heading, 0, 'YXZ');
          f.root.scale.setScalar(Math.max(0.001, a.shown) * f.root.userData.baseScale);
          f.setBodyState(a.body);
          f.update(dt, a.lying ? 'stand' : a.pose, a.speed);
        }
      } else if (fig) fig.root.visible = false;
      if (tiny && n < MAX) {
        const k = a.shown;
        const lift = a.pose === 'sit' || a.pose === 'crouch' ? -0.35 : 0;
        this.m.compose(this.v.set(a.x, 0.55 + lift, a.z), this.q, this.s.set(k, a.lying ? 0.4 * k : k, k));
        this.bodies.setMatrixAt(n, this.m);
        this.m.compose(this.v.set(a.x, 1.25 + lift, a.z), this.q, this.s.set(k, k, k));
        this.heads.setMatrixAt(n, this.m);
        this.bodies.setColorAt(n, this.c.setHex(a.look.vest ?? (a.look.police ? 0x1e2a4a : a.look.kit?.hood === 'up' ? 0x1e1e22 : 0x5a5a60)));
        n++;
      }
      if (a.glow !== 'none' && g < MAX && !a.lying) {
        // The hand: at the mouth for a draw now and then, else at the hip; a lighter is held low and in front.
        const up = a.glow === 'flame' ? (a.pose === 'crouch' ? 0.55 : a.pose === 'sit' ? 0.75 : 1.1)
          : a.glow === 'phone' ? (a.pose === 'sit' ? 0.85 : 1.25)
          : a.glow === 'vape' ? (Math.sin(this.clock * 0.7 + a.x) > 0.5 ? 1.5 : 1.0)
          : Math.sin(this.clock * 0.9 + a.x) > 0.6 ? (a.pose === 'sit' ? 1.05 : 1.5) : (a.pose === 'sit' ? 0.6 : 0.95);
        const fwd = a.glow === 'ember' ? 0.18 : 0.3;
        gp.setXYZ(g, a.x + Math.sin(a.heading) * fwd, up, a.z + Math.cos(a.heading) * fwd);
        const flicker = a.glow === 'flame' ? 0.7 + 0.3 * Math.sin(this.clock * 31 + a.z) : a.glow === 'ember' ? 0.6 + 0.4 * Math.max(0, Math.sin(this.clock * 0.9 + a.x)) : 0.8;
        this.c.setHex(GLOW_COLOUR[a.glow]).multiplyScalar(flicker * a.shown);
        gc.setXYZ(g, this.c.r, this.c.g, this.c.b);
        g++;
      }
      if (a.smokes && !a.lying && this.random() < dt * (a.vapes ? 0.9 : 0.5)) {
        this.puff(a);
        // A vape breathes out a cloud, not a wisp: a second puff beside the first.
        if (a.vapes) this.puff(a);
      }
    }
    this.bodies.count = this.heads.count = n;
    this.bodies.visible = this.heads.visible = n > 0;
    this.glows.visible = g > 0;
    if (n) {
      this.bodies.instanceMatrix.needsUpdate = this.heads.instanceMatrix.needsUpdate = true;
      if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true;
    }
    this.glows.geometry.setDrawRange(0, g);
    if (g) gp.needsUpdate = gc.needsUpdate = true;
    this.updateSmoke(dt);
    // Keep a bounded set of figures: drop the longest unused once over budget.
    if (this.figures.size > this.budget + 6) {
      let oldest: Actor | null = null;
      for (const [a, f] of this.figures) if (!f.root.visible && (!oldest || this.lastUsed.get(a)! < this.lastUsed.get(oldest)!)) oldest = a;
      if (oldest) {
        const f = this.figures.get(oldest)!;
        this.root.remove(f.root);
        f.dispose();
        this.figures.delete(oldest);
      }
    }
  }

  private puff(a: Actor): void {
    const i = this.smokeNext;
    this.smokeNext = (i + 1) % SMOKE;
    const p = this.smoke.geometry.getAttribute('position') as BufferAttribute;
    const h = a.pose === 'crouch' ? 0.9 : a.pose === 'sit' ? 1.1 : 1.6;
    p.setXYZ(i, a.x + Math.sin(a.heading) * 0.3, h, a.z + Math.cos(a.heading) * 0.3);
    this.smokeVel[i * 3] = Math.sin(a.heading) * 0.25 + (this.random() - 0.5) * 0.1;
    this.smokeVel[i * 3 + 1] = 0.35 + this.random() * 0.2;
    this.smokeVel[i * 3 + 2] = Math.cos(a.heading) * 0.25 + (this.random() - 0.5) * 0.1;
    this.smokeAge[i] = 0;
  }

  private updateSmoke(dt: number): void {
    const p = this.smoke.geometry.getAttribute('position') as BufferAttribute;
    const c = this.smoke.geometry.getAttribute('color') as BufferAttribute;
    let live = false;
    for (let i = 0; i < SMOKE; i++) {
      const age = this.smokeAge[i];
      if (age >= 3) continue;
      live = true;
      this.smokeAge[i] = age + dt;
      p.setXYZ(i, p.getX(i) + this.smokeVel[i * 3] * dt, p.getY(i) + this.smokeVel[i * 3 + 1] * dt, p.getZ(i) + this.smokeVel[i * 3 + 2] * dt);
      const k = Math.max(0, 1 - age / 3) * Math.min(1, age * 4) * 0.55;
      c.setXYZ(i, k, k, k * 1.05);
    }
    if (live) p.needsUpdate = c.needsUpdate = true;
  }
}

/** Moves (x, z) towards (tx, tz) at `speed`; true once there. Sets heading and pose as it goes. */
export function walkTo(a: Actor, tx: number, tz: number, speed: number, dt: number): boolean {
  const dx = tx - a.x;
  const dz = tz - a.z;
  const d = Math.hypot(dx, dz);
  if (d <= speed * dt || d < 1e-4) {
    a.x = tx;
    a.z = tz;
    return true;
  }
  a.x += (dx / d) * speed * dt;
  a.z += (dz / d) * speed * dt;
  a.heading = Math.atan2(dx, dz);
  a.pose = 'walk';
  a.speed = speed;
  return false;
}

/** Fades `shown` towards on (1) or off (0) at `rate` per second. */
export function fade(a: Actor, on: boolean, dt: number, rate = 1.5): void {
  a.shown = Math.min(1, Math.max(0, a.shown + (on ? dt : -dt) * rate));
}
