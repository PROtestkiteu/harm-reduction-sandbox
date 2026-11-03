import { BufferGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, Vector3, type Material, type Object3D } from 'three';
import { add, box, cylinder } from './kit';
import { clothMat, glowMat, mat } from './materials';
import { dynamic, mergeStatic } from './mergeStatic';

/**
 * A pitch in a rough-sleepers' camp, as people really live in one: a cheap
 * dome tent with a tarp thrown over it, a ridge tent, a blue tarp strung
 * as a lean-to, or a cardboard shelter on a pallet; and round it what they
 * keep: a shopping trolley of bags, bin bags, a camping chair, a milk crate,
 * water bottles, a gas stove, an umbrella, a bike, a line of washing, the
 * odd lantern, on trodden mud. Every pitch is dealt from `random`, built
 * once and merged (one draw for its fabric and gear, one for the metal and
 * wood, one more where a lantern glows), and toggled as the camp grows.
 * About 3.6 by 3.4 m round its origin.
 */

const TENT = [0x3a5a8a, 0x6a7a3a, 0x8a4a30, 0x6a6a66, 0x2f6a6a, 0x4a5a3a, 0x5a4a6a, 0x8a7a3a] as const;
const TARP = [0x2f5a9a, 0x3a6a42, 0x8e8e88, 0x2f5a9a] as const;
const BAG = [0x2a3a6a, 0x6a2424, 0x343434, 0x3a5a3a, 0x6a5a3a] as const;
const BLANKET = [0x7a5a3a, 0x5a3a4a, 0x3a4a5a, 0x8a7a5a] as const;
const CARDBOARD = 0x9a7a4e;
const MUD = 0x2e2a22;
const METAL = 0x8a8c8e;
const WOOD = 0x7a6040;

/** Geometry shared by every pitch (merging copies it). */
let shapes: {
  dome: BufferGeometry; door: BufferGeometry; ridge: BufferGeometry; bag: BufferGeometry; patch: BufferGeometry;
  brolly: BufferGeometry; wheel: BufferGeometry; jug: BufferGeometry;
} | null = null;
const geo = () => (shapes ??= {
  dome: new SphereGeometry(1, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2),
  door: new CircleGeometry(0.5, 8, 0, Math.PI),
  // A triangular prism lying along x, ridge up, 1 high and about 1.7 wide on the ground: the ridge tent's shape.
  ridge: new CylinderGeometry(1, 1, 1, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).translate(0, 0.5, 0).scale(1, 2 / 3, 1),
  bag: new SphereGeometry(1, 6, 4),
  patch: new CircleGeometry(1, 9).rotateX(-Math.PI / 2),
  brolly: new ConeGeometry(1, 0.35, 8, 1, true),
  wheel: new TorusGeometry(0.3, 0.025, 4, 12),
  jug: new CylinderGeometry(0.11, 0.12, 0.34, 6).translate(0, 0.17, 0),
});

/** One glow for every lantern in the camps (a battery lantern's cold light). */
let lanternGlow: Material | null = null;

type R = () => number;
const UP = new Vector3(0, 1, 0);
const dir = new Vector3();
const pickOf = <T>(random: R, list: readonly T[]): T => list[Math.floor(random() * list.length)];

function mesh(parent: Object3D, g: BufferGeometry, m: Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): Mesh {
  const o = new Mesh(g, m);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  o.castShadow = o.receiveShadow = true;
  parent.add(o);
  return o;
}

/** A thin straight piece from (x0, y0, z0) to (x1, y1, z1): a pole, a guy line, a bar. */
function rod(parent: Object3D, m: Material, t: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Mesh {
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  const len = Math.hypot(dx, dy, dz);
  const o = add(parent, box(t, len, t, m, 0, 0, 0));
  o.geometry = o.geometry.clone().translate(0, -len / 2, 0);
  o.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  o.quaternion.setFromUnitVectors(UP, dir.set(dx / len, dy / len, dz / len));
  o.castShadow = false;
  return o;
}

/** A sleeping bag or a rolled blanket, lying along x. */
function sleepingBag(g: Group, random: R, x: number, z: number, rot: number): void {
  const s = add(g, new Group(), rot);
  s.position.set(x, 0, z);
  const c = clothMat(pickOf(random, BAG));
  mesh(s, geo().bag, c, 0, 0.1, 0, 0.95, 0.13, 0.36);
  mesh(s, geo().bag, c, 0.78, 0.13, 0, 0.22, 0.14, 0.33);
  // A blanket over the foot end, a pillow of clothes at the head.
  if (random() < 0.6) add(s, box(0.8, 0.04, 0.8, clothMat(pickOf(random, BLANKET)), -0.45, 0.17, 0)).rotation.y = (random() - 0.5) * 0.6;
  mesh(s, geo().bag, clothMat(pickOf(random, BLANKET)), -0.95, 0.12, 0, 0.2, 0.1, 0.28);
}

/** A cheap pop-up dome, often with a tarp thrown over against the rain. */
function domeTent(g: Group, random: R): void {
  const colour = pickOf(random, TENT);
  const w = 1.05 + random() * 0.25;
  const h = 0.95 + random() * 0.2;
  mesh(g, geo().dome, clothMat(colour), 0, 0, 0, w * 1.15, h, w);
  // The door: a darker half-oval, unzipped and hanging open now and then.
  const door = mesh(g, geo().door, clothMat(0x1a1a1c), 0, 0.02, w * 0.98, 0.9, 1.15, 1);
  door.rotation.x = -0.25;
  if (random() < 0.5) add(g, box(0.5, 0.75, 0.03, clothMat(colour), 0.62, 0, w * 0.95)).rotation.y = 0.7;
  // Guy lines to pegs, a fly that has seen better days.
  const line = mat(0xb8b8b0);
  for (const [px, pz] of [[1.75, 1.2], [-1.75, 1.15], [1.7, -1.2], [-1.7, -1.25]] as const) rod(g, line, 0.012, px * 0.55 * w, h * 0.55, pz * 0.55 * w, px * w, 0.02, pz * w);
  if (random() < 0.4) {
    // Draped over the back half and hanging down both sides, weighed down with a brick at a corner.
    const tarp = clothMat(pickOf(random, TARP));
    const lean = (random() - 0.5) * 0.3;
    for (const side of [-1, 1]) {
      const half = add(g, box(1.5 * w, 0.03, 0.95 * w, tarp, side * 0.42 * w, h * 0.58, -0.45 * w));
      half.rotation.set(0, lean, -side * 0.62);
    }
    add(g, box(0.22, 0.1, 0.1, mat(0x8a4a3a), 1.0 * w, 0, -0.9 * w));
  }
}

/** A ridge tent, its flysheet patched with tape and a second tarp. */
function ridgeTent(g: Group, random: R): void {
  const colour = pickOf(random, TENT);
  const len = 2.1 + random() * 0.4;
  const h = 1.0 + random() * 0.15;
  mesh(g, geo().ridge, clothMat(colour), 0, 0, 0, len, h, 0.85);
  const fly = clothMat(0x1a1a1c);
  mesh(g, geo().door, fly, len / 2 + 0.01, 0.02, 0, 0.75, 1.05, 1).rotation.y = Math.PI / 2;
  // Patches of grey tape across the roof.
  for (let i = 0; i < 3; i++) {
    const p = add(g, box(0.24, 0.02, 0.06, clothMat(0x9a9a92), (random() - 0.5) * len * 0.7, h * 0.5, 0.36 + random() * 0.08));
    p.rotation.set(-0.95, random() * 1.2, 0);
  }
  const pole = mat(METAL);
  for (const x of [-len / 2, len / 2]) rod(g, pole, 0.03, x, 0, 0, x, h + 0.08, 0);
  if (random() < 0.5) {
    // A second tarp over one slope where it leaks.
    const over = add(g, box(len * 0.6, 0.03, 0.9, clothMat(pickOf(random, TARP)), -len * 0.15, h * 0.5, 0.33));
    over.rotation.x = 0.86;
  }
}

/** A blue tarp strung from two poles to the ground, a mattress under it. */
function leanTo(g: Group, random: R): void {
  const wood = mat(WOOD);
  const top = 1.45 + random() * 0.25;
  for (const x of [-1.1, 1.1]) rod(g, wood, 0.05, x, 0, -0.75, x + (random() - 0.5) * 0.1, top, -0.75);
  rod(g, mat(0xb8b8b0), 0.015, -1.1, top - 0.02, -0.75, 1.1, top - 0.02, -0.75);
  const tarp = add(g, box(2.5, 0.03, 2.05, clothMat(pickOf(random, TARP)), 0, (top) / 2, 0.08));
  tarp.rotation.x = Math.atan2(top, 1.7);
  // Back and one side walled with cardboard against the wind.
  add(g, box(0.04, 0.9, 1.4, clothMat(CARDBOARD), -1.18, 0, 0)).rotation.y = 0.12;
  add(g, box(0.9, 0.04, 1.9, clothMat(0x6a5a4a), 0, 0, 0.1));
  sleepingBag(g, random, 0.05, 0.15, (random() - 0.5) * 0.3);
}

/** Flattened boxes on a pallet, a duvet and a sleeping bag: a bed in a doorway or under a hedge. */
function cardboard(g: Group, random: R): void {
  const wood = mat(WOOD);
  // The pallet: slats on three runners.
  for (const z of [-0.5, 0, 0.5]) add(g, box(1.9, 0.08, 0.1, wood, 0, 0, z));
  for (let i = 0; i < 7; i++) add(g, box(0.12, 0.03, 1.15, wood, -0.85 + i * 0.283, 0.08, 0));
  const board = clothMat(CARDBOARD);
  add(g, box(2.0, 0.03, 1.2, board, 0.05, 0.11, 0.02)).rotation.y = 0.04;
  // Boxes stood up round the head end as walls, one fallen in.
  add(g, box(0.05, 0.75, 1.1, board, -1.0, 0.1, 0)).rotation.z = 0.12;
  add(g, box(1.0, 0.7, 0.05, board, -0.5, 0.1, -0.6)).rotation.x = -0.1;
  if (random() < 0.6) add(g, box(0.8, 0.05, 0.6, board, 0.7, 0.05, 0.9)).rotation.set(0.4, 0.3, 0);
  sleepingBag(g, random, 0.1, 0, 0);
  // A duvet half off the bed.
  add(g, box(1.1, 0.06, 1.0, clothMat(pickOf(random, BLANKET)), 0.45, 0.17, 0.25)).rotation.set(0.15, 0.2, 0.05);
}

/** A supermarket trolley, full of bags. */
function trolley(g: Group, random: R, x: number, z: number, rot: number): void {
  const t = add(g, new Group(), rot);
  t.position.set(x, 0, z);
  const wire = mat(METAL);
  for (const [px, pz] of [[-0.42, -0.26], [0.42, -0.26], [-0.42, 0.26], [0.42, 0.26]] as const) {
    rod(t, wire, 0.025, px, 0.1, pz, px * (px < 0 ? 1.1 : 1), 0.85, pz);
    add(t, cylinder(0.05, 0.05, mat(0x1a1a1a), 6, px, 0, pz)).rotation.x = Math.PI / 2;
  }
  // The basket's rims and floor, the handle.
  for (const y of [0.42, 0.85]) {
    for (const pz of [-0.27, 0.27]) rod(t, wire, 0.02, -0.46, y, pz, 0.44, y, pz);
    for (const px of [-0.46, 0.44]) rod(t, wire, 0.02, px, y, -0.27, px, y, 0.27);
  }
  rod(t, mat(0xc83a2a), 0.04, -0.55, 0.98, -0.3, -0.55, 0.98, 0.3);
  for (let i = 0; i < 3; i++) mesh(t, geo().bag, clothMat(pickOf(random, [0x1a1a1a, 0x2a4a8a, 0xd8d0c0, 0x6a2424])), -0.15 + i * 0.16, 0.8 + random() * 0.15, (random() - 0.5) * 0.25, 0.22, 0.2, 0.2);
}

/** Two or three bin bags of clothes and things, knotted at the top. */
function binBags(g: Group, random: R, x: number, z: number): void {
  const n = 2 + Math.floor(random() * 2);
  for (let i = 0; i < n; i++) {
    const c = clothMat(random() < 0.7 ? 0x161618 : pickOf(random, [0x2a4a8a, 0x3a5a3a]));
    const s = 0.28 + random() * 0.08;
    const bx = x + (i - n / 2) * 0.42 + (random() - 0.5) * 0.1;
    const bz = z + (random() - 0.5) * 0.3;
    mesh(g, geo().bag, c, bx, s * 0.85, bz, s, s * 0.85, s * 0.9);
    mesh(g, geo().bag, c, bx, s * 1.7, bz, 0.06, 0.09, 0.06);
  }
}

/** A folding camping chair, a bit sagged. */
function chair(g: Group, random: R, x: number, z: number, rot: number): void {
  const c = add(g, new Group(), rot);
  c.position.set(x, 0, z);
  const leg = mat(0x2a2a2c);
  rod(c, leg, 0.03, -0.25, 0, -0.22, 0.25, 0.45, 0.22);
  rod(c, leg, 0.03, 0.25, 0, -0.22, -0.25, 0.45, 0.22);
  rod(c, leg, 0.03, -0.25, 0, 0.22, 0.25, 0.45, -0.22);
  rod(c, leg, 0.03, 0.25, 0, 0.22, -0.25, 0.45, -0.22);
  const seat = clothMat(pickOf(random, [0x2a4a7a, 0x3a5a3a, 0x7a2a2a]));
  add(c, box(0.5, 0.04, 0.45, seat, 0, 0.4, 0)).rotation.x = 0.08;
  add(c, box(0.5, 0.5, 0.04, seat, 0, 0.45, -0.24)).rotation.x = -0.25;
}

/** A milk crate (sat on, or full of tins), water bottles and a camping stove. */
function kitchen(g: Group, random: R, x: number, z: number): void {
  const crate = clothMat(pickOf(random, [0x2a5a9a, 0xc0a030, 0xb03028, 0x3a7a3a]));
  add(g, box(0.38, 0.04, 0.38, crate, x, 0, z));
  for (const [dx, dz, w, d] of [[0, -0.18, 0.38, 0.03], [0, 0.18, 0.38, 0.03], [-0.18, 0, 0.03, 0.38], [0.18, 0, 0.03, 0.38]] as const) add(g, box(w, 0.3, d, crate, x + dx, 0, z + dz));
  // On it, the stove and a pot.
  add(g, cylinder(0.11, 0.09, mat(0x3a6a9a), 8, x, 0.31, z));
  add(g, cylinder(0.12, 0.12, mat(0x9a9a98), 8, x, 0.42, z));
  const n = 1 + Math.floor(random() * 3);
  const water = clothMat(0x6a9ab0);
  for (let i = 0; i < n; i++) mesh(g, geo().jug, water, x + 0.35 + i * 0.22, 0, z + (random() - 0.5) * 0.2);
  // A few cans and a bag of rubbish beside it.
  for (let i = 0; i < 3; i++) add(g, cylinder(0.035, 0.11, mat(pickOf(random, [0xc8c8c0, 0xb03028, 0x2a6a3a])), 6, x - 0.3 + (random() - 0.5) * 0.3, 0, z + 0.25 + random() * 0.2)).rotation.z = random() < 0.5 ? Math.PI / 2 : 0;
}

/** A golf umbrella, open, propped against the tent. */
function umbrella(g: Group, random: R, x: number, z: number): void {
  const u = add(g, new Group(), random() * Math.PI);
  u.position.set(x, 0, z);
  const tilt = 0.35 + random() * 0.3;
  rod(u, mat(0x2a2a2c), 0.025, 0, 0, 0, Math.sin(tilt) * 1.2, Math.cos(tilt) * 1.2, 0);
  const top = mesh(u, geo().brolly, clothMat(pickOf(random, [0x1a1a1c, 0x2a3a7a, 0x8a2a2a])), Math.sin(tilt) * 1.2, Math.cos(tilt) * 1.2, 0, 0.75, 1, 0.75);
  top.rotation.z = -tilt;
}

/** A bike with a basket, leant on its side. */
function bike(g: Group, random: R, x: number, z: number, rot: number): void {
  const b = add(g, new Group(), rot);
  b.position.set(x, 0, z);
  const frame = mat(pickOf(random, [0x3a4a6a, 0x6a2a2a, 0x2a2a2a]));
  const tyre = mat(0x141414);
  for (const px of [-0.52, 0.52]) mesh(b, geo().wheel, tyre, px, 0.31, 0);
  rod(b, frame, 0.03, -0.52, 0.31, 0, 0, 0.32, 0);
  rod(b, frame, 0.03, 0, 0.32, 0, 0.42, 0.72, 0);
  rod(b, frame, 0.03, -0.52, 0.31, 0, -0.12, 0.72, 0);
  rod(b, frame, 0.03, -0.12, 0.72, 0, 0.42, 0.72, 0);
  rod(b, frame, 0.03, 0, 0.32, 0, -0.14, 0.82, 0);
  rod(b, frame, 0.03, 0.42, 0.72, 0, 0.52, 0.31, 0);
  add(b, box(0.22, 0.05, 0.1, mat(0x1a1a1a), -0.16, 0.82, 0));
  rod(b, mat(0x2a2a2a), 0.025, 0.4, 0.9, -0.22, 0.4, 0.9, 0.22);
  rod(b, frame, 0.03, 0.42, 0.72, 0, 0.4, 0.9, 0);
  b.rotation.x = 0.12;
}

/** A line of washing between two poles. */
function washing(g: Group, random: R, x: number, z: number): void {
  const w = mat(WOOD);
  const h = 1.25;
  rod(g, w, 0.04, x - 0.8, 0, z, x - 0.8, h + 0.05, z);
  rod(g, w, 0.04, x + 0.8, 0, z, x + 0.8, h + 0.05, z);
  rod(g, mat(0xb8b8b0), 0.012, x - 0.8, h, z, x + 0.8, h, z);
  for (let i = 0; i < 3; i++) {
    const c = clothMat(pickOf(random, [0xc8c0b0, 0x3a4a6a, 0x8a3a3a, 0x5a6a4a, 0xd8d0c0]));
    const cw = 0.3 + random() * 0.18;
    add(g, box(cw, 0.4 + random() * 0.25, 0.02, c, x - 0.5 + i * 0.5, h - 0.6, z));
  }
}

/**
 * One camp pitch, dealt from `random` (`i` keeps neighbours different): a
 * shelter, trodden mud round it, and three to six of the things people keep.
 */
export function campPitch(random: R, i: number): Group {
  const g = dynamic(new Group());
  const pitch = new Group();
  g.add(pitch);
  // Mud trodden round the pitch, a darker patch at the door.
  mesh(pitch, geo().patch, clothMat(MUD), 0, 0.045, 0.2, 1.9, 1, 1.6);
  mesh(pitch, geo().patch, clothMat(0x24201a), 0.2, 0.05, 1.1, 0.8, 1, 0.5);
  const kind = (i + Math.floor(random() * 4)) % 4;
  [domeTent, ridgeTent, leanTo, cardboard][kind](pitch, random);
  const things = [
    () => trolley(pitch, random, 1.45, 0.9 + random() * 0.4, -0.4 + random() * 0.8),
    () => binBags(pitch, random, -1.35, 1.05),
    () => chair(pitch, random, 0.9, 1.45, Math.PI + (random() - 0.5) * 0.8),
    () => kitchen(pitch, random, -0.7, 1.45),
    () => umbrella(pitch, random, -1.5, -0.6),
    () => bike(pitch, random, 0.2, -1.45, (random() - 0.5) * 0.4),
    () => washing(pitch, random, 0.1, -1.55),
  ];
  // Keep the bike and the washing apart: both stand behind the shelter.
  const pick = things.filter((_, k) => random() < (k === 6 ? 0.25 : 0.5));
  if (pick.length < 3) pick.push(things[1], things[3]);
  for (const f of pick.slice(0, 6)) f();
  // A battery lantern on a third of them.
  if (random() < 0.34) {
    lanternGlow ??= glowMat(0xd8e8f0, 0xcfe4ff, 1.4);
    add(pitch, box(0.1, 0.18, 0.1, lanternGlow, -0.35, 0.02, 1.05));
  }
  mergeStatic(pitch);
  return g;
}
