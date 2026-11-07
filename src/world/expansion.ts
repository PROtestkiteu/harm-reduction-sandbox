import { Box3, Group, type Mesh, type MeshLambertMaterial, type Object3D } from 'three';
import { add, box, signBoard } from './kit';
import { glowMat, mat } from './materials';

/** Which way a building's front faces, in world axes. */
export type Facing = '+x' | '-x' | '+z' | '-z';

/** How a place shows growth: a crane for a building, a new sign for a van or stand. */
export type ExpansionKind = 'building' | 'sign';

const MAX_CABINS = 2;
const MAX_BOARDS = 3;
const cabinWall = mat(0xd8d2c4);
const cabinTrim = mat(0x3a4048);
const craneYellow = mat(0xe0b024);
const craneDark = mat(0x2a2c30);
const steel = mat(0x8a9096);
const plank = mat(0x9a7448);
const plywood = mat(0xb89a68);

/** One crane trip: deliver a cabin to the roof, or take one away. */
interface Job { cabin: number; deliver: boolean }

/** Seconds of each part of a crane trip once the crane stands. */
const LOWER = 0.8;
const HOIST = 0.9;
const SLEW = 1.4;
const SET = 0.9;
const TRIP = LOWER + HOIST + SLEW + SET;
/** Seconds for the crane to go up, or to fold away. */
const RAISE = 1.2;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (v: number) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Shortest turn from angle a to b. */
const turn = (a: number, b: number, t: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
/** A drop that lands and bounces twice. */
const bounce = (v: number) => {
  const t = clamp01(v);
  if (t < 0.6) return (t / 0.6) ** 2;
  if (t < 0.85) { const u = (t - 0.725) / 0.125; return 1 - 0.12 * (1 - u * u); }
  const u = (t - 0.925) / 0.075;
  return 1 - 0.03 * (1 - u * u);
};

/**
 * A service's building shows how it is doing, the way a street would.
 *
 * Buildings: with more staff than usual, a tower crane goes up beside it,
 * scaffolding climbs the front, and the crane lifts a prefab cabin onto the
 * roof, one per extra person up to two. When staff drop back, the crane comes
 * and lifts the cabin off again. Running short while open, boards go up over
 * the front one at a time and come down once staffing recovers.
 *
 * Signs (the camper): opening drops a new sign onto the roof, which bounces
 * and flickers on. Closing flickers it out and lifts it away. Extra staff put
 * out a sandwich board.
 *
 * Idle, all of this costs nothing.
 */
export class Expansion {
  private readonly kind: ExpansionKind;
  private still = false;

  // Building parts.
  private readonly cabins: Group[] = [];
  private readonly cabinAt: { x: number; z: number }[] = [];
  private cabinCount = 0;
  private cabinTarget = 0;
  private readonly jobs: Job[] = [];
  private job: Job | null = null;
  private jobT = 0;
  private readonly crane = new Group();
  private readonly slew = new Group();
  private readonly trolley = new Group();
  private readonly cable: Mesh;
  private readonly hook = new Group();
  private readonly load = new Group();
  private readonly scaffold = new Group();
  private craneUp = 0;
  private craneX = 0;
  private craneZ = 0;
  private craneTop = 0;
  private roofY = 0;
  private pickupAngle = 0;
  private pickupR = 0;
  private readonly boards: { group: Group; grown: number; target: number }[] = [];
  /** Seconds of crane work done and planned, for the progress bar. */
  private workDone = 0;
  private workTotal = 0;
  private building = true;

  // Sign parts.
  private sign: Object3D = new Group();
  private signBaseY = 0;
  /** False when animating a sign the place already has (its glow stays the place's own). */
  private ownSign = true;
  private readonly signFace: MeshLambertMaterial;
  private signOpen = false;
  private signT = 1;
  private readonly aboard = new Group();
  private aboardGrown = 0;
  private aboardTarget = 0;

  private readonly windows = glowMat(0x2c3640, 0xffd8a0, 1.1);
  private settled = true;

  constructor(root: Object3D, accent: number, kind: ExpansionKind, front: Facing, roofSign?: Object3D, roofY?: number) {
    this.kind = kind;
    // Root groups are never turned, only moved: their bounds, less the offset, are local.
    root.updateMatrixWorld(true);
    const b = new Box3().setFromObject(root);
    const min = root.worldToLocal(b.min.clone());
    const max = root.worldToLocal(b.max.clone());
    const cx = (min.x + max.x) / 2;
    const cz = (min.z + max.z) / 2;
    const w = max.x - min.x;
    const d = max.z - min.z;
    // Rooftop lights and aerials can stand well above the roof itself.
    this.roofY = roofY ?? max.y;
    // Front and side, as unit steps in world axes.
    const fx = front === '+x' ? 1 : front === '-x' ? -1 : 0;
    const fz = front === '+z' ? 1 : front === '-z' ? -1 : 0;
    const halfFront = fx !== 0 ? w / 2 : d / 2;
    const halfSide = fx !== 0 ? d / 2 : w / 2;
    const sx = -fz; // the side axis, a quarter turn from the front
    const sz = fx;

    this.signFace = glowMat(accent, 0xfff4dc, 0);
    if (kind === 'sign') {
      this.cable = box(0.01, 0.01, 0.01, steel);
      if (roofSign) {
        // Animate the place's authored sign in its own parent and frame.
        this.sign = roofSign;
        this.signBaseY = roofSign.position.y;
        this.ownSign = false;
        // It starts in place: closing lifts it off, opening drops it back.
        this.signOpen = true;
      } else {
        this.signFace = this.buildSign(root, cx, cz, accent, front);
      }
      this.buildSandwichBoard(root, cx + fx * (halfFront + 1.2) + sx * 1.6, cz + fz * (halfFront + 1.2) + sz * 1.6, fx, fz);
      return;
    }

    // Cabins sit side by side along the roof's longer side.
    const alongX = w >= d;
    const span = Math.max(w, d);
    for (let i = 0; i < MAX_CABINS; i++) {
      const offset = (i - (MAX_CABINS - 1) / 2) * Math.min(3.2, span / MAX_CABINS);
      const x = alongX ? cx + offset : cx;
      const z = alongX ? cz : cz + offset;
      const g = add(root, this.cabinMesh());
      g.position.set(x, this.roofY, z);
      if (!alongX) g.rotation.y = Math.PI / 2;
      g.visible = false;
      this.cabins.push(g);
      this.cabinAt.push({ x, z });
    }

    // The crane stands off the back corner, clear of the street in front.
    this.craneX = cx - fx * (halfFront + 1.6) + sx * (halfSide - 1);
    this.craneZ = cz - fz * (halfFront + 1.6) + sz * (halfSide - 1);
    this.craneTop = this.roofY + 6;
    const reach = Math.max(...this.cabinAt.map((c) => Math.hypot(c.x - this.craneX, c.z - this.craneZ))) + 1.5;
    this.pickupR = Math.min(reach - 0.5, 4.5);
    // Loads come off the ground behind the crane, away from the building.
    this.pickupAngle = Math.atan2(fz, -fx);
    this.buildCrane(root, reach);
    this.cable = this.trolley.children[1] as Mesh;
    this.buildScaffold(root, cx, cz, fx, fz, halfFront, halfSide);
    this.buildBoards(root, cx, cz, fx, fz, halfFront, halfSide);
  }

  /** Snap to the end state instead of animating (reduced motion). */
  setStill(still: boolean): void {
    this.still = still;
  }

  /** Staff above (`extra`) or below (`short`) the usual number, and whether it is open. */
  set(extra: number, short: number, open: boolean): void {
    if (this.kind === 'sign') {
      if (open !== this.signOpen) { this.signOpen = open; this.signT = 0; this.settled = false; }
      const a = open && extra > 0 ? 1 : 0;
      if (a !== this.aboardTarget) { this.aboardTarget = a; this.settled = false; }
      return;
    }
    const n = Math.max(0, Math.min(MAX_CABINS, Math.round(extra)));
    if (n !== this.cabinTarget) {
      this.cabinTarget = n;
      this.settled = false;
      // Queue trips from where the roof will be once queued trips finish.
      let planned = this.cabinCount;
      if (this.job) planned += this.job.deliver ? 1 : -1;
      for (const j of this.jobs) planned += j.deliver ? 1 : -1;
      const queued = this.jobs.length;
      while (planned < n) this.jobs.push({ cabin: planned++, deliver: true });
      while (planned > n) this.jobs.push({ cabin: --planned, deliver: false });
      const added = this.jobs.length - queued;
      if (added > 0) {
        // A fresh start counts the crane going up and coming down too.
        if (!this.job && queued === 0 && this.craneUp === 0) { this.workDone = 0; this.workTotal = 2 * RAISE; }
        this.workTotal += added * TRIP;
        this.building = n > this.cabinCount;
      }
    }
    const boards = open ? Math.max(0, Math.min(MAX_BOARDS, Math.round(short))) : 0;
    this.boards.forEach((p, i) => {
      const t = i < boards ? 1 : 0;
      if (p.target !== t) { p.target = t; this.settled = false; }
    });
  }

  /** Crane work under way: 0 to 1, and whether it adds to the building. Null when the crane is away. */
  works(): { progress: number; building: boolean } | null {
    if (this.kind === 'sign' || (this.craneUp === 0 && !this.job && this.jobs.length === 0)) return null;
    return { progress: this.workTotal > 0 ? this.workDone / this.workTotal : 0, building: this.building };
  }

  /** Advances the animation. Returns true while anything moves. */
  update(dt: number): boolean {
    if (this.settled) return false;
    if (this.still) dt = 1000;
    const moving = this.kind === 'sign' ? this.updateSign(dt) : this.updateBuilding(dt);
    if (!moving) this.settled = true;
    return moving;
  }

  // ---------------------------------------------------------------- building

  private updateBuilding(dt: number): boolean {
    let moving = false;
    if (!this.job && this.jobs.length > 0) { this.job = this.jobs.shift()!; this.jobT = 0; }
    // The crane and scaffolding stand while there is work, and fold away after.
    const wantUp = this.job ? 1 : 0;
    if (this.craneUp !== wantUp) {
      this.craneUp = wantUp > this.craneUp ? Math.min(1, this.craneUp + dt / RAISE) : Math.max(0, this.craneUp - dt / RAISE);
      moving = true;
    }
    if (moving || this.job) this.workDone = Math.min(this.workTotal, this.workDone + dt);
    const up = ease(this.craneUp);
    this.crane.visible = this.scaffold.visible = this.craneUp > 0;
    this.crane.scale.set(1, Math.max(0.001, up), 1);
    this.scaffold.scale.set(1, Math.max(0.001, ease(this.craneUp * 1.2 - 0.2)), 1);

    if (this.job && this.craneUp >= 1) {
      this.jobT += dt;
      moving = true;
      this.runTrip(this.job, Math.min(this.jobT, TRIP));
      if (this.jobT >= TRIP) {
        this.cabinCount += this.job.deliver ? 1 : -1;
        this.job = null;
        this.load.visible = false;
        if (this.jobs.length > 0) { this.job = this.jobs.shift()!; this.jobT = 0; }
      }
    } else if (!this.job) {
      this.parkHook();
    }

    // Cabins settle on their jacks after being set down.
    for (const c of this.cabins) {
      if (c.visible && c.scale.y !== 1) {
        c.scale.y = Math.min(1, c.scale.y + dt * 0.6);
        moving = true;
      }
    }

    this.boards.forEach((p, i) => {
      const before = p.grown;
      // Each board waits for the one before, like someone nailing them up in turn.
      const rate = dt * 3;
      const prevDone = i === 0 || this.boards[i - 1].grown > 0.7 || p.target === 0;
      if (prevDone) p.grown = p.target > p.grown ? Math.min(1, p.grown + rate) : Math.max(0, p.grown - rate * 1.5);
      if (p.grown !== before) moving = true;
      p.group.visible = p.grown > 0;
      // Swing in from a tilt, and drop when taken down.
      const k = ease(p.grown);
      p.group.rotation.z = (1 - k) * (i % 2 ? 0.6 : -0.6);
      p.group.position.y = p.target > 0 ? 0 : -(1 - k) * 0.8;
      p.group.scale.setScalar(Math.max(0.001, p.target > 0 ? 0.6 + 0.4 * k : 1));
    });
    return moving;
  }

  /** One crane trip at time t: lower the hook, hoist, swing across, set down. */
  private runTrip(job: Job, t: number): void {
    const target = this.cabinAt[job.cabin];
    const dx = target.x - this.craneX;
    const dz = target.z - this.craneZ;
    const roofAngle = Math.atan2(-dz, dx);
    const roofR = Math.hypot(dx, dz);
    const top = this.craneTop - 1.4;
    const ground = 0.1;
    // Where the trip starts and ends.
    const fromAngle = job.deliver ? this.pickupAngle : roofAngle;
    const toAngle = job.deliver ? roofAngle : this.pickupAngle;
    const fromR = job.deliver ? this.pickupR : roofR;
    const toR = job.deliver ? roofR : this.pickupR;
    const fromY = job.deliver ? ground : this.roofY;
    const toY = job.deliver ? this.roofY : ground;
    const cabin = this.cabins[job.cabin];

    let angle = fromAngle;
    let r = fromR;
    let y = top;
    let carrying = false;
    if (t < LOWER) {
      y = lerp(top, fromY + 0.05, ease(t / LOWER));
      // Taking a cabin away: it stays on the roof until the hook reaches it.
      if (!job.deliver) cabin.visible = true;
    } else if (t < LOWER + HOIST) {
      carrying = true;
      y = lerp(fromY, top - 2.4, ease((t - LOWER) / HOIST));
    } else if (t < LOWER + HOIST + SLEW) {
      carrying = true;
      const k = ease((t - LOWER - HOIST) / SLEW);
      angle = turn(fromAngle, toAngle, k);
      r = lerp(fromR, toR, k);
      y = top - 2.4;
    } else {
      const k = ease((t - LOWER - HOIST - SLEW) / SET);
      angle = toAngle;
      r = toR;
      y = lerp(top - 2.4, toY, Math.min(1, k * 1.15));
      carrying = k < 0.87;
      if (!carrying && job.deliver && !cabin.visible) {
        cabin.visible = true;
        cabin.scale.y = 0.9;
      }
    }
    if (carrying && !job.deliver) cabin.visible = false;
    this.load.visible = carrying;
    // The load turns with the jib, like a load hung from one hook.
    if (carrying) this.load.rotation.y = cabin.rotation.y + (angle - toAngle);
    this.pose(angle, r, y);
  }

  private parkHook(): void {
    this.pose(this.pickupAngle, this.pickupR, this.craneTop - 1.4);
  }

  /** Jib angle, trolley reach and hook height (world y). */
  private pose(angle: number, r: number, y: number): void {
    this.slew.rotation.y = angle;
    this.trolley.position.x = r;
    const drop = Math.max(0.2, this.craneTop - 0.2 - y);
    this.cable.scale.y = drop;
    this.cable.position.y = -drop;
    this.hook.position.y = -drop;
  }

  private cabinMesh(): Group {
    const g = new Group();
    add(g, box(2.6, 2.2, 2.0, cabinWall, 0, 0, 0));
    add(g, box(2.7, 0.12, 2.1, cabinTrim, 0, 2.2, 0));
    add(g, box(1.6, 0.6, 0.04, this.windows, -0.2, 1.1, 1.01));
    add(g, box(0.5, 1.6, 0.04, cabinTrim, 0.95, 0.1, 1.01));
    return g;
  }

  private buildCrane(root: Object3D, reach: number): void {
    const c = add(root, this.crane);
    c.position.set(this.craneX, 0, this.craneZ);
    c.visible = false;
    const top = this.craneTop;
    // Base ballast, a lattice mast (four legs and cross rungs) and the cab.
    add(c, box(2, 0.6, 2, craneDark, 0, 0, 0));
    for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) add(c, box(0.08, top, 0.08, craneYellow, x, 0, z));
    for (let y = 1; y < top - 0.5; y += 1.2) {
      add(c, box(0.66, 0.06, 0.06, craneYellow, 0, y, 0.3));
      add(c, box(0.66, 0.06, 0.06, craneYellow, 0, y, -0.3));
      add(c, box(0.06, 0.06, 0.66, craneYellow, 0.3, y + 0.6, 0));
      add(c, box(0.06, 0.06, 0.66, craneYellow, -0.3, y + 0.6, 0));
    }
    const s = add(c, this.slew);
    s.position.y = top;
    add(s, box(0.9, 0.8, 0.8, craneDark, 0.2, -0.1, 0.55));
    add(s, box(0.3, 1.4, 0.3, craneYellow, 0, 0.7, 0));
    // Jib out front, counter-jib with its weights behind.
    add(s, box(reach, 0.3, 0.4, craneYellow, reach / 2, 0.6, 0));
    add(s, box(3, 0.3, 0.4, craneYellow, -1.5, 0.6, 0));
    add(s, box(1, 0.9, 0.7, craneDark, -2.6, 0.1, 0));
    const t = add(s, this.trolley);
    t.position.set(this.pickupR, 0.55, 0);
    add(t, box(0.5, 0.15, 0.5, craneDark, 0, 0, 0));
    // A cable of unit length, stretched to the hook's drop.
    add(t, box(0.04, 1, 0.04, craneDark, 0, -1, 0));
    const h = add(t, this.hook);
    add(h, box(0.25, 0.25, 0.25, craneDark, 0, -0.25, 0));
    // The hung load: the same cabin, with slings.
    const l = add(h, this.load);
    l.position.y = -2.7;
    add(l, this.cabinMesh());
    for (const sx of [-1, 1]) add(l, box(0.03, 0.06, 0.03, craneDark, sx * 1.1, 2.3, 0)).scale.y = 8;
    l.visible = false;
  }

  private buildScaffold(root: Object3D, cx: number, cz: number, fx: number, fz: number, halfFront: number, halfSide: number): void {
    const g = add(root, this.scaffold);
    g.position.set(cx + fx * (halfFront + 0.6), 0, cz + fz * (halfFront + 0.6));
    g.rotation.y = Math.atan2(fx, fz);
    g.visible = false;
    const width = halfSide * 2 - 0.6;
    const height = this.roofY + 0.6;
    // Standards (uprights) every couple of metres, two deep.
    for (let x = -width / 2; x <= width / 2 + 0.01; x += width / Math.max(1, Math.round(width / 2.2))) {
      add(g, box(0.07, height, 0.07, steel, x, 0, -0.3));
      add(g, box(0.07, height, 0.07, steel, x, 0, 0.3));
    }
    // Ledgers and a plank deck at each lift, with a guard rail.
    for (let y = 2; y < height; y += 2) {
      add(g, box(width, 0.08, 0.7, plank, 0, y, 0));
      add(g, box(width, 0.05, 0.05, steel, 0, y + 1, 0.3));
    }
  }

  private buildBoards(root: Object3D, cx: number, cz: number, fx: number, fz: number, halfFront: number, halfSide: number): void {
    const facing = Math.atan2(fx, fz);
    const usable = Math.min(halfSide * 2 - 2, 9);
    for (let i = 0; i < MAX_BOARDS; i++) {
      const along = (i - (MAX_BOARDS - 1) / 2) * (usable / MAX_BOARDS);
      // Place each board on the ground-floor front, a hand's width proud of the wall.
      const holder = add(root, new Group());
      holder.position.set(cx + fx * (halfFront + 0.08) - fz * along, 0.6, cz + fz * (halfFront + 0.08) + fx * along);
      holder.rotation.y = facing;
      const g = add(holder, new Group());
      add(g, box(1.6, 1.8, 0.05, plywood, 0, 0, 0));
      add(g, box(1.9, 0.14, 0.05, plank, 0, 0.9, 0.04)).rotation.z = 0.7;
      add(g, box(1.9, 0.14, 0.05, plank, 0, 0.9, 0.04)).rotation.z = -0.7;
      g.visible = false;
      this.boards.push({ group: g, grown: 0, target: 0 });
    }
  }

  // ---------------------------------------------------------------- sign

  private buildSign(root: Object3D, cx: number, cz: number, accent: number, front: Facing): MeshLambertMaterial {
    const s = add(root, this.sign);
    this.signBaseY = this.roofY;
    s.position.set(cx, this.roofY, cz);
    // The frontage determines reading direction, independently of the roof aspect ratio.
    s.rotation.y = front === '+x' ? Math.PI / 2 : front === '-x' ? -Math.PI / 2 : front === '-z' ? Math.PI : 0;
    add(s, box(0.06, 0.5, 0.06, craneDark, -0.9, 0, 0));
    add(s, box(0.06, 0.5, 0.06, craneDark, 0.9, 0, 0));
    // A readable board on both sides, rather than two featureless emissive panels.
    const board = signBoard('INFO', 2.4, 0.7, '#fff4dc', '#' + accent.toString(16).padStart(6, '0'), 0, 'pixel', true);
    add(s, board.mesh).position.y = 0.5;
    s.visible = false;
    return board.material;
  }

  private buildSandwichBoard(root: Object3D, x: number, z: number, fx: number, fz: number): void {
    const g = add(root, this.aboard);
    g.position.set(x, 0.12, z);
    g.rotation.y = Math.atan2(fx, fz) + 0.3;
    for (const sz of [-1, 1]) {
      const leaf = add(g, box(0.6, 0.9, 0.03, plywood, 0, 0, 0));
      leaf.position.z = sz * 0.14;
      leaf.rotation.x = sz * -0.28;
      add(g, box(0.5, 0.5, 0.01, this.signFace, 0, 0.3, sz * 0.165)).rotation.x = sz * -0.28;
    }
    g.visible = false;
  }

  private updateSign(dt: number): boolean {
    let moving = false;
    if (this.signT < 1) {
      this.signT = Math.min(1, this.signT + dt / 1.8);
      moving = true;
      const t = this.signT;
      const s = this.sign;
      s.visible = true;
      if (this.signOpen) {
        // Drop in from above and bounce, then flicker on.
        const fall = bounce(t / 0.55);
        s.position.y = this.signBaseY + (1 - fall) * 5;
        s.rotation.x = (1 - fall) * 0.25;
        const lit = t < 0.55 ? 0 : t < 0.62 ? 1 : t < 0.68 ? 0.1 : t < 0.74 ? 1 : t < 0.78 ? 0.3 : 1;
        if (this.ownSign) this.signFace.emissiveIntensity = lit * 1.2;
      } else {
        // Flicker out, tip and lift away.
        const lit = t < 0.08 ? 0.3 : t < 0.14 ? 1 : t < 0.2 ? 0.1 : 0;
        if (this.ownSign) this.signFace.emissiveIntensity = lit * 1.2;
        const k = ease((t - 0.3) / 0.7);
        s.rotation.x = Math.min(1, t / 0.3) * -0.18;
        s.position.y = this.signBaseY + k * 5;
        if (t >= 1) s.visible = false;
      }
    }
    const before = this.aboardGrown;
    this.aboardGrown = this.aboardTarget > this.aboardGrown ? Math.min(1, this.aboardGrown + dt * 2.5) : Math.max(0, this.aboardGrown - dt * 2.5);
    if (this.aboardGrown !== before) moving = true;
    this.aboard.visible = this.aboardGrown > 0;
    // Pops open like a sandwich board being set down.
    this.aboard.scale.set(1, Math.max(0.001, bounce(this.aboardGrown)), 1);
    return moving;
  }
}
