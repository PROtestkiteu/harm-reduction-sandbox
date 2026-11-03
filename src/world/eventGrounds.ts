import { AdditiveBlending, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, TorusGeometry, Vector3, type Material, type MeshLambertMaterial, type Object3D } from 'three';
import { PALETTE } from '../config/palette';
import { add, box, cylinder, signBoard } from './kit';
import { FESTIVAL, FESTIVAL_GATE, STADIUM, STADIUM_GATE, type P2, type Rect } from './layout';
import { glowMat, mat } from './materials';
import { dynamic } from './mergeStatic';
import { registerBuilding } from './cityBuildings';

/**
 * The grounds of the city's big occasions, outside the district: the festival
 * grounds in the big park and the football stadium across the river. Built
 * once with the far city (their static parts merge with it, a draw call or so
 * per material); a festival or a match only turns their lights up and shows
 * the stage's beams. Nothing runs per frame: `set` changes a few materials
 * when a level changes.
 */
export interface EventGrounds {
  /** How far each occasion is under way, 0 (nothing on) to 1 (in full swing). */
  set(v: { festival: number; match: number }): void;
  /** Their building ids, for picking and their cards (open ground: kept out of lettings and the like). */
  ids: { festival: number; stadium: number };
}

/** A light that glows at `base` with nothing on (0: dark) and at `full` when an occasion is in full swing. */
interface Lamp { mat: MeshLambertMaterial; full: number; base?: number }

const lampsUp = (lamps: readonly Lamp[], level: number) => {
  for (const l of lamps) l.mat.emissiveIntensity = (l.base ?? 0) + (l.full - (l.base ?? 0)) * level;
};

/** Adds `m` to `g` at (x, y, z) turned by (rx, ry, rz), y first. */
function put<T extends Object3D>(g: Object3D, m: T, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): T {
  m.position.set(x, y, z);
  m.rotation.order = 'YXZ';
  m.rotation.set(rx, ry, rz);
  g.add(m);
  return m;
}

const UP = new Vector3(0, 1, 0);
const dir = new Vector3();
/** A thin straight member from `a` to `b` (both [x, y, z]): truss bracing, struts, spokes. */
function bar(g: Object3D, a: readonly number[], b: readonly number[], t: number, m: Material): void {
  dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = dir.length();
  const piece = new Mesh(new CylinderGeometry(t, t, len, 4).translate(0, len / 2, 0), m);
  piece.position.set(a[0], a[1], a[2]);
  piece.quaternion.setFromUnitVectors(UP, dir.normalize());
  g.add(piece);
}

/** A square truss tower: four chords and rungs every `step` metres, `s` across. */
function trussTower(g: Object3D, x: number, z: number, h: number, s: number, m: Material, step = 1.2): void {
  const c = s / 2;
  for (const [dx, dz] of [[-c, -c], [c, -c], [c, c], [-c, c]] as const) add(g, box(0.07, h, 0.07, m, x + dx, 0, z + dz));
  for (let y = step; y < h; y += step) {
    add(g, box(s, 0.05, 0.05, m, x, y, z - c));
    add(g, box(s, 0.05, 0.05, m, x, y, z + c));
    add(g, box(0.05, 0.05, s, m, x - c, y, z));
    add(g, box(0.05, 0.05, s, m, x + c, y, z));
  }
}

/** A horizontal box truss from x0 to x1 (along x) at height y, centred on z: four chords and zigzag bracing on its faces. */
function trussBeamX(g: Object3D, x0: number, x1: number, y: number, z: number, s: number, m: Material): void {
  for (const [dy, dz] of [[0, -s / 2], [0, s / 2], [s, -s / 2], [s, s / 2]] as const) add(g, box(x1 - x0, 0.06, 0.06, m, (x0 + x1) / 2, y + dy, z + dz));
  for (let x = x0, k = 0; x < x1 - 0.1; x += s, k++) {
    for (const dz of [-s / 2, s / 2]) bar(g, [x, y + (k % 2 ? s : 0), z + dz], [Math.min(x1, x + s), y + (k % 2 ? 0 : s), z + dz], 0.025, m);
  }
}

// ------------------------------------------------------------------ festival

/**
 * Heras fencing round `q`: mesh panels in frames on concrete feet, open for `gap` metres at x = `gateX`
 * in the north side. The mesh is a thin grey sheet in a plain colour, so it merges with the rest (a
 * see-through one would cost a draw call of its own).
 */
function heras(g: Object3D, q: Rect, gateX: number, gap: number): void {
  const mesh = mat(0x5e6264);
  const frame = mat(0x9a9ea0);
  const foot = mat(0x8a857a);
  const h = 2.0;
  const side = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 3.4));
    const ry = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      const w = len / n - 0.08;
      put(g, box(w, 0.9, 0.02, mesh), x, 0.75, z, ry);
      put(g, box(w, 0.05, 0.05, frame), x, h, z, ry);
      put(g, box(w, 0.05, 0.05, frame), x, 0.2, z, ry);
      const fx = x0 + (x1 - x0) * (i / n);
      const fz = z0 + (z1 - z0) * (i / n);
      put(g, box(0.6, 0.15, 0.25, foot), fx, 0, fz, ry);
      put(g, box(0.05, h, 0.05, frame), fx, 0, fz, ry);
    }
  };
  side(q.x0, q.z0, gateX - gap / 2, q.z0);
  side(gateX + gap / 2, q.z0, q.x1, q.z0);
  side(q.x1, q.z0, q.x1, q.z1);
  side(q.x1, q.z1, q.x0, q.z1);
  side(q.x0, q.z1, q.x0, q.z0);
}

/** A peaked marquee: white walls, a four-sided roof in `roof`, a pennant on the peak, a doorway (lit when it is on) to the north. */
function marquee(g: Object3D, x: number, z: number, w: number, d: number, roof: Material, door: Material): void {
  add(g, box(w, 2.2, d, mat(0xe8e2d4), x, 0, z));
  const peak = new Mesh(new ConeGeometry(1, 1, 4, 1).rotateY(Math.PI / 4), roof);
  peak.scale.set((w / 2) * Math.SQRT2 + 0.2, 1.8, (d / 2) * Math.SQRT2 + 0.2);
  put(g, peak, x, 2.2 + 0.9, z);
  add(g, box(1.4, 1.9, 0.05, door, x, 0, z - d / 2 - 0.03));
  add(g, box(0.04, 1.0, 0.04, mat(0x5a5a5a), x, 4.0, z));
  add(g, box(0.02, 0.35, 0.6, roof, x, 4.6, z + 0.3));
}

/** A food truck nose to the north, its serving hatch on the west side under an awning. */
function foodTruck(g: Object3D, x: number, z: number, body: Material, hatch: Material, awning: Material): void {
  const t = new Group();
  add(t, box(2.2, 2.3, 4.6, body, 0, 0.45, 0.4));
  add(t, box(2.1, 1.5, 1.4, body, 0, 0.45, -2.5));
  add(t, box(2.0, 0.6, 0.06, mat(0x22303a), 0, 1.25, -3.22));
  add(t, box(0.06, 1.0, 2.6, hatch, -1.12, 1.35, 0.6));
  add(t, box(0.9, 0.06, 3.0, awning, -1.55, 2.45, 0.6)).rotation.z = 0.35;
  const wheel = mat(0x1c1c1e);
  for (const [wx, wz] of [[-1.05, -2.3], [1.05, -2.3], [-1.05, 1.9], [1.05, 1.9]] as const) put(t, new Mesh(new CylinderGeometry(0.45, 0.45, 0.3, 10), wheel), wx, 0.45, wz, 0, 0, Math.PI / 2);
  put(g, t, x, 0, z);
}

/** A small Ferris wheel turning in the x-y plane: two A-frames, twin rims, spokes, a gondola on each spoke, bulbs round the rim. */
function ferrisWheel(g: Object3D, x: number, z: number, r: number, bulbs: Material): void {
  const steel = mat(0xd8d8d8);
  const hub = r + 1.2;
  for (const s of [-1, 1]) {
    bar(g, [x - r * 0.55, 0, z + s * 1.5], [x, hub, z + s * 0.75], 0.12, steel);
    bar(g, [x + r * 0.55, 0, z + s * 1.5], [x, hub, z + s * 0.75], 0.12, steel);
    put(g, new Mesh(new TorusGeometry(r, 0.09, 4, 36), steel), x, hub, z + s * 0.55);
    put(g, new Mesh(new TorusGeometry(r * 0.45, 0.06, 4, 24), steel), x, hub, z + s * 0.55);
  }
  const n = 12;
  const cars = [mat(0xc84a3a), mat(0x3a7ac8), mat(0xe0b030)];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const px = x + Math.cos(a) * r;
    const py = hub + Math.sin(a) * r;
    for (const s of [-1, 1]) bar(g, [x, hub, z + s * 0.55], [px, py, z + s * 0.55], 0.04, steel);
    // The gondola hangs below its pivot.
    add(g, box(0.06, 0.3, 0.06, steel, px, py - 0.25, z));
    add(g, box(0.9, 0.8, 0.9, cars[i % 3], px, py - 1.05, z));
    const b = (i + 0.5) / n * Math.PI * 2;
    add(g, box(0.16, 0.16, 0.16, bulbs, x + Math.cos(b) * r, hub + Math.sin(b) * r - 0.08, z + 0.66));
    add(g, box(0.16, 0.16, 0.16, bulbs, x + Math.cos(b) * r, hub + Math.sin(b) * r - 0.08, z - 0.66));
  }
  put(g, cylinder(0.5, 1.6, steel, 10), x, hub, z - 0.8, 0, Math.PI / 2);
  add(g, box(1.4, 2.2, 1.2, cars[0], x + r * 0.75, 0, z - 2.6));
}

function festivalGrounds(g: Object3D): { lamps: Lamp[]; beams: Object3D } {
  const q = FESTIVAL;
  const lamps: Lamp[] = [];
  const lamp = (color: number, emissive: number, full: number, base = 0) => {
    const m = glowMat(color, emissive, base);
    lamps.push({ mat: m, full, base });
    return m;
  };
  const truss = mat(0xb8bcc0);
  const black = mat(0x1e1e22);
  const cz = (q.z0 + q.z1) / 2;
  // Every lit material is its own draw call, so the grounds share a few: warm bulbs, cool movers, the screen.
  const warmLamp = lamp(0x3a3020, 0xffd890, 1.6);
  const coolLamp = lamp(0x1a2a2a, 0x7af0ff, 1.8);
  // Trampled grass with straw spread over the muddy patches.
  add(g, box(q.x1 - q.x0 - 2, 0.02, q.z1 - q.z0 - 2, mat(0x56603a), (q.x0 + q.x1) / 2, -0.06, cz));
  for (const [dx, dz, w, d] of [[2, -3, 5, 3], [8, 2.5, 4, 2.4], [-4, 3.5, 3, 2]] as const) add(g, box(w, 0.02, d, mat(0xb8a060), (q.x0 + q.x1) / 2 + dx, -0.04, cz + dz)).rotation.y = 0.4;
  heras(g, q, FESTIVAL_GATE.x, 6);

  // The gate: two truss towers, a truss beam across with the lit banner, flags on poles either side.
  const gx = FESTIVAL_GATE.x;
  for (const dx of [-3.4, 3.4]) trussTower(g, gx + dx, q.z0, 5, 0.5, truss);
  trussBeamX(g, gx - 3.65, gx + 3.65, 5, q.z0, 0.5, truss);
  const banner = signBoard('FESTIVAL', 6, 1.0, '#fff4d0', '#5a2a6a', 0);
  lamps.push({ mat: banner.material, full: 1.2, base: 0.25 });
  add(g, banner.mesh, Math.PI).position.set(gx, 3.8, q.z0 - 0.35);
  const flagColours = [0xc84a8a, 0x3ac8c8, 0xe0b030, 0x8a5ac8];
  [-6, -5, 5, 6].forEach((dx, i) => {
    add(g, cylinder(0.04, 6.5, mat(0x9a9a9a), 4, gx + dx, 0, q.z0 - 0.6));
    add(g, box(0.03, 1.8, 0.7, mat(flagColours[i]), gx + dx, 4.4, q.z0 - 0.25));
  });

  // The stage at the west end, facing east: a deck on a skirt with a thrust, four truss towers,
  // a truss grid over them and an arched black roof on the grid.
  const sx = q.x0 + 4.2;
  const sw = 6;
  const sd = 13;
  add(g, box(sw, 1.4, sd, black, sx, 0, cz));
  add(g, box(2, 0.7, 4, black, sx + sw / 2 + 1, 0, cz));
  const tops = 8.2;
  for (const [dx, dz] of [[-sw / 2, -sd / 2], [-sw / 2, sd / 2], [sw / 2, -sd / 2], [sw / 2, sd / 2]] as const) trussTower(g, sx + dx, cz + dz, tops, 0.45, truss);
  for (const z of [cz - sd / 2, cz + sd / 2]) trussBeamX(g, sx - sw / 2, sx + sw / 2, tops, z, 0.45, truss);
  for (const x of [sx - sw / 2, sx + sw / 2]) for (const [dy, dx] of [[0, -0.22], [0, 0.22], [0.45, -0.22], [0.45, 0.22]] as const) add(g, box(0.06, 0.06, sd, truss, x + dx, tops + dy, cz));
  // The roof: half a cylinder lying along z on the grid, flattened a little.
  const roof = new Mesh(new CylinderGeometry(sw / 2 + 0.6, sw / 2 + 0.6, sd + 1.2, 14, 1, true, -Math.PI / 2, Math.PI), mat(0x24242a));
  put(g, roof, sx, tops + 0.45, cz, 0, Math.PI / 2).scale.set(1, 1, 0.55);
  // The LED wall at the back: panels with seams between them.
  const screen = lamp(0x101018, 0xc87aff, 1.5, 0.05);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) add(g, box(0.08, 1.2, 1.4, screen, sx - sw / 2 + 0.5, 2.1 + r * 1.25, cz - 4.4 + c * 1.76));
  // Line arrays hung either side, curving under as real ones do, and stacks of subs on the ground.
  for (const dz of [-sd / 2 - 1.1, sd / 2 + 1.1]) {
    add(g, box(0.06, 1.2, 0.06, truss, sx + sw / 2 - 0.4, tops - 1.2, cz + dz));
    for (let k = 0; k < 6; k++) add(g, box(0.9, 0.42, 1.0, black, sx + sw / 2 - 0.4 + k * 0.07, tops - 1.6 - k * 0.45, cz + dz)).rotation.z = -k * 0.06;
    for (let k = 0; k < 2; k++) add(g, box(1.2, 0.9, 1.2, black, sx + sw / 2 + 0.6, k * 0.9, cz + dz));
  }
  // Lamps and moving heads along the front truss.
  for (let k = 0; k < 9; k++) add(g, box(0.35, 0.45, 0.35, k % 2 ? coolLamp : warmLamp, sx + sw / 2, tops - 0.5, cz - 5.4 + k * 1.35));
  // Front of house: the mixing desk under a small tent in the middle of the arena.
  const fohX = q.x0 + 17;
  for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [1.2, 1.2], [-1.2, 1.2]] as const) add(g, box(0.06, 2.3, 0.06, truss, fohX + dx, 0, cz + dz));
  put(g, new Mesh(new ConeGeometry(1.9, 1.0, 4, 1).rotateY(Math.PI / 4), black), fohX, 2.8, cz);
  add(g, box(1.8, 1.0, 0.9, black, fohX, 0, cz));
  add(g, box(1.6, 0.1, 0.7, coolLamp, fohX, 1.0, cz));

  // Marquees along the south fence (a bar and a chill-out tent), food trucks between them, picnic tables in front.
  marquee(g, q.x0 + 13, q.z1 - 3, 5, 4, mat(0xc84a3a), warmLamp);
  marquee(g, q.x0 + 25.5, q.z1 - 3, 5, 4, mat(0x3a6ac8), warmLamp);
  ([[0xe0b030, 0x2e7d6b], [0x2e7d6b, 0xd04a3a], [0xd8d8d0, 0x3a6ea8]] as const).forEach(([body, aw], i) => foodTruck(g, q.x0 + 17.4 + i * 2.8, q.z1 - 3.4, mat(body), warmLamp, mat(aw)));
  const wood = mat(0x7a5a3a);
  for (const dx of [16, 19.2, 22.4]) {
    const x = q.x0 + dx;
    const z = q.z1 - 8.2;
    add(g, box(1.8, 0.08, 0.8, wood, x, 0.72, z));
    for (const s of [-0.6, 0.6]) add(g, box(1.8, 0.06, 0.3, wood, x, 0.42, z + s));
  }

  // The Ferris wheel in the north-east corner, by the gate.
  ferrisWheel(g, q.x1 - 5, q.z0 + 5.5, 4.2, warmLamp);

  // Festoon lights round the arena: a pole every 6 m, a sagging string of bulbs between neighbours.
  const poles: P2[] = [];
  for (let x = q.x0 + 9; x <= q.x1 - 11; x += 6) poles.push({ x, z: q.z0 + 1.2 });
  for (let x = q.x1 - 11; x >= q.x0 + 9; x -= 6) poles.push({ x, z: q.z1 - 6.2 });
  poles.forEach((p, i) => {
    add(g, cylinder(0.05, 4, mat(0x6a5a48), 4, p.x, 0, p.z));
    const next = poles[(i + 1) % poles.length];
    if (Math.hypot(next.x - p.x, next.z - p.z) > 8) return;
    for (let k = 1; k < 8; k++) {
      const t = k / 8;
      add(g, box(0.12, 0.12, 0.12, warmLamp, p.x + (next.x - p.x) * t, 3.9 - Math.sin(t * Math.PI) * 0.6, p.z + (next.z - p.z) * t));
    }
  });

  // Coloured beams off the stage, shown only while a festival is on.
  const beams = dynamic(new Group());
  beams.visible = false;
  const cone = new ConeGeometry(2.4, 26, 10, 1, true).translate(0, -13, 0);
  for (const [colour, dz, tilt] of [[0xc87aff, -4, 0.35], [0x4ff0ff, 0, -0.3], [0xffb03a, 4, 0.25]] as const) {
    const beam = new Mesh(cone, new MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false }));
    beam.position.set(sx + sw / 2, tops, cz + dz);
    beam.rotation.set(tilt, 0, Math.PI + 0.55);
    beams.add(beam);
  }
  g.add(beams);
  return { lamps, beams };
}

// ------------------------------------------------------------------ stadium

/** A point on a rounded rectangle (a superellipse) of half-sizes a, b at parameter t. */
function superellipse(a: number, b: number, t: number, n = 5): [number, number] {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [a * Math.sign(c) * Math.abs(c) ** (2 / n), b * Math.sign(s) * Math.abs(s) ** (2 / n)];
}

function stadium(g: Object3D): Lamp[] {
  const q = STADIUM;
  const lamps: Lamp[] = [];
  const lamp = (color: number, emissive: number, full: number, base = 0) => {
    const m = glowMat(color, emissive, base);
    lamps.push({ mat: m, full, base });
    return m;
  };
  const cx = (q.x0 + q.x1) / 2;
  const cz = (q.z0 + q.z1) / 2;
  const concrete = mat(0x9a958c);
  const concreteDark = mat(0x6e6a64);
  const seatWhite = mat(0xb8b4ac);
  const seatRed = mat(0x9a2a2a);
  const seatBlue = mat(0x2a4a8a);
  const membrane = mat(0xdcdcd8);
  const steel = mat(0x8a9098);
  const clubRed = mat(0xa82a2a);
  const glass = mat(0x8aa8b8);
  // Forecourt round it (its top at 0.12); everything inside stands on it.
  add(g, box(q.x1 - q.x0 + 8, 0.22, q.z1 - q.z0 + 8, mat(PALETTE.pavement), cx, -0.1, cz));
  const top = 0.12;

  // The pitch: mown stripes, the markings, goals with nets, dugouts. It glows a little under the floodlights.
  const grass = lamp(0x2f6a2e, 0x6ad06a, 0.35);
  const grassDark = lamp(0x2a5e2a, 0x5ac05a, 0.35);
  const ai = (q.x1 - q.x0) / 2 - 9;
  const bi = (q.z1 - q.z0) / 2 - 8;
  const stripes = 10;
  for (let i = 0; i < stripes; i++) add(g, box((2 * ai) / stripes, 0.04, 2 * bi, i % 2 ? grassDark : grass, cx - ai + (i + 0.5) * ((2 * ai) / stripes), top, cz));
  const chalk = mat(0xe8e8e0);
  const px = ai - 2.5;
  const pz = bi - 2.5;
  const line = (x: number, z: number, w: number, d: number) => add(g, box(w, 0.05, d, chalk, x, top + 0.01, z));
  line(cx, cz - pz, 2 * px, 0.14);
  line(cx, cz + pz, 2 * px, 0.14);
  line(cx - px, cz, 0.14, 2 * pz);
  line(cx + px, cz, 0.14, 2 * pz);
  line(cx, cz, 0.14, 2 * pz);
  put(g, new Mesh(new TorusGeometry(3.6, 0.07, 3, 32), chalk), cx, top + 0.05, cz, 0, Math.PI / 2);
  const net = mat(0xc8c8c0);
  for (const side of [-1, 1]) {
    // Penalty area and goal area.
    const gxp = cx + side * px;
    line(gxp - side * 3.2, cz, 0.14, 8.6);
    line(gxp - side * 1.6, cz - 4.3, 3.2, 0.14);
    line(gxp - side * 1.6, cz + 4.3, 3.2, 0.14);
    line(gxp - side * 1.1, cz, 0.14, 4.2);
    line(gxp - side * 0.55, cz - 2.1, 1.1, 0.14);
    line(gxp - side * 0.55, cz + 2.1, 1.1, 0.14);
    // The goal: posts, crossbar and a net sloping back.
    for (const dz of [-1.8, 1.8]) add(g, box(0.1, 1.9, 0.1, chalk, gxp, top, cz + dz));
    add(g, box(0.1, 0.1, 3.7, chalk, gxp, top + 1.9, cz));
    put(g, box(0.02, 2.0, 3.6, net), gxp + side * 0.55, top, cz, 0, 0, side * 0.35);
  }
  for (const dx of [-5, 5]) {
    add(g, box(3.4, 0.5, 0.6, mat(0x3a3a40), cx + dx, top, cz + bi - 0.8));
    put(g, new Mesh(new CylinderGeometry(0.8, 0.8, 3.4, 8, 1, true, 0, Math.PI), glass), cx + dx, top + 0.6, cz + bi - 0.8, 0, 0, Math.PI / 2);
  }

  // The bowl: a ring of segments round a rounded-rectangle plan, each with four tiers of seats
  // stepping up away from the pitch, a concourse wall behind with the club's band, piers outside,
  // and a membrane roof cantilevered on ribs, a lamp under its leading edge.
  const ao = (q.x1 - q.x0) / 2 - 0.6;
  const bo = (q.z1 - q.z0) / 2 - 0.6;
  const n = 64;
  const gateT = Math.atan2((STADIUM_GATE.z - cz) / bo, (STADIUM_GATE.x - cx) / ao);
  // One lamp material (one draw call) for the floodlights, the roof's lamps and the turnstiles.
  const flood = lamp(0x3a3a3a, 0xf4f8ff, 2.2);
  const mouth = mat(0x1a1a1c);
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * Math.PI * 2;
    const t1 = ((i + 1) / n) * Math.PI * 2;
    const tm = (t0 + t1) / 2;
    const [ix, iz] = superellipse(ai + 0.6, bi + 0.6, tm);
    const [ox, oz] = superellipse(ao, bo, tm);
    const [o0x, o0z] = superellipse(ao, bo, t0);
    const [o1x, o1z] = superellipse(ao, bo, t1);
    const chord = Math.hypot(o1x - o0x, o1z - o0z) + 0.15;
    const depth = Math.hypot(ox - ix, oz - iz);
    const ux = (ox - ix) / depth;
    const uz = (oz - iz) / depth;
    const ry = Math.atan2(ux, uz);
    const at = (s: number): [number, number] => [cx + ix + ux * s, cz + iz + uz * s];
    const off = Math.abs(((tm - gateT) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
    const gate = off < (Math.PI * 2) / n;
    // Seats: four tiers, the lowest in white, the club's red above with blue blocks.
    for (let k = 0; k < 4; k++) {
      if (gate && k < 2) continue;
      const from = (k * depth) / 4.6;
      const span = depth - from - 0.9;
      const [x, z] = at(from + span / 2);
      const seat = k === 0 ? seatWhite : Math.floor(i / 8) % 3 === 2 ? seatBlue : seatRed;
      put(g, box(chord * (0.75 + 0.25 * (from / depth)), 1.0 + k * 2.3, span, seat), x, top, z, ry);
    }
    // The dark mouth of a stairway every fourth segment, in the second tier.
    if (i % 4 === 0 && !gate) {
      const [x, z] = at(depth / 4.6 - 0.1);
      put(g, box(1.0, 1.3, 0.3, mouth), x, top + 2.0, z, ry);
    }
    const [wx, wz] = at(depth - 0.45);
    put(g, box(chord, 12.5, 0.9, concrete), wx, top, wz, ry);
    put(g, box(chord + 0.02, 1.3, 0.95, clubRed), wx, top + 9.2, wz, ry);
    if (i % 2 === 0) {
      const [fx, fz] = at(depth + 0.2);
      put(g, box(0.5, 13.6, 1.0, concreteDark), fx, top, fz, ry);
    }
    const roofDepth = depth * 0.72;
    const [rx, rz] = at(depth - roofDepth / 2);
    put(g, box(chord + 0.1, 0.18, roofDepth, membrane), rx, top + 13.2, rz, ry, -0.1);
    if (i % 2 === 0) {
      const [bx, bz] = at(depth - 0.2);
      const [ex, ez] = at(depth - roofDepth);
      bar(g, [bx, top + 13.3, bz], [ex, top + 14.2, ez], 0.12, steel);
      bar(g, [bx, top + 16.4, bz], [(bx + ex) / 2, top + 13.9, (bz + ez) / 2], 0.06, steel);
      add(g, box(0.25, 3.0, 0.25, steel, bx, top + 13.4, bz));
      const [lx, lz] = at(depth - roofDepth + 0.6);
      add(g, box(0.5, 0.25, 0.5, flood, lx, top + 13.2, lz));
    }
  }

  // Stair towers at the four corners: drums ringed with windows, a cap on each.
  const towerWin = lamp(0x2a3440, PALETTE.warmWindow, 0.9, 0.35);
  for (const t of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    const [x, z] = superellipse(ao + 2.4, bo + 2.4, t);
    add(g, cylinder(2.2, 14, concrete, 14, cx + x, top, cz + z));
    for (let y = 2; y < 13; y += 2.6) add(g, cylinder(2.25, 0.5, towerWin, 14, cx + x, top + y, cz + z));
    add(g, cylinder(2.5, 0.4, concreteDark, 14, cx + x, top + 14, cz + z));
  }

  // The gate: two pylons through the lower bowl, a canopy, turnstiles, the name over the top.
  const [gx0, gz0] = superellipse(ao + 0.8, bo + 0.8, gateT);
  const gx = cx + gx0;
  const gz = cz + gz0;
  // Facing out of the bowl at the gate.
  const gr = Math.atan2(gx0, gz0);
  const across = { x: Math.cos(gr), z: -Math.sin(gr) };
  const out = { x: Math.sin(gr), z: Math.cos(gr) };
  for (const s of [-1, 1]) put(g, box(1.2, 8.5, 1.6, concreteDark), gx + across.x * s * 3.4, top, gz + across.z * s * 3.4, gr);
  put(g, box(8, 0.35, 3.2, steel), gx + out.x * 0.8, top + 4.2, gz + out.z * 0.8, gr);
  const name = signBoard('STADIUM', 7, 1.1, '#ffffff', '#2a4a8a', 0);
  lamps.push({ mat: name.material, full: 1.1, base: 0.3 });
  put(g, name.mesh, gx + out.x * 0.9, top + 6.4, gz + out.z * 0.9, gr);
  for (let k = -2; k <= 2; k++) put(g, box(0.4, 1.1, 0.4, flood), gx + across.x * k * 1.1 + out.x * 1.4, top, gz + across.z * k * 1.1 + out.z * 1.4, gr);

  // The scoreboard on the north stand's roof, facing the pitch.
  const score = lamp(0x101018, 0xffd84a, 1.3);
  const [sx0, sz0] = superellipse(ao, bo, -Math.PI / 2);
  add(g, box(9, 3.6, 0.5, mat(0x2a2a30), cx + sx0, top + 14.5, cz + sz0 + 1.2));
  add(g, box(8.4, 3.0, 0.1, score, cx + sx0, top + 14.8, cz + sz0 + 1.48));
  for (const dx of [-3.5, 3.5]) add(g, box(0.2, 2.2, 0.2, steel, cx + sx0 + dx, top + 12.5, cz + sz0 + 1.2));

  // Floodlights: a tapering mast outside each corner, a lattice head of lamps tilted down to the pitch.
  for (const t of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    const [x0, z0] = superellipse(ao + 6, bo + 6, t);
    const x = cx + x0;
    const z = cz + z0;
    const h = 30;
    put(g, new Mesh(new CylinderGeometry(0.28, 0.7, h, 8).translate(0, h / 2, 0), steel), x, 0, z);
    const head = put(g, new Group(), x, h, z, Math.atan2(cx - x, cz - z), 0.55);
    add(head, box(5.2, 0.12, 0.12, steel, 0, 0, 0));
    add(head, box(5.2, 0.12, 0.12, steel, 0, 3.0, 0));
    for (const dx of [-2.6, 2.6]) add(head, box(0.12, 3.1, 0.12, steel, dx, 0, 0));
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) add(head, box(0.62, 0.5, 0.3, flood, -2.1 + c * 0.84, 0.25 + r * 0.7, 0.12));
    // Rungs of a service ladder up the mast.
    for (let y = 1; y < h - 1; y += 1.5) add(g, box(0.5, 0.05, 0.05, steel, x, y, z + 0.75));
  }
  return lamps;
}

/** Builds both grounds into `g` (the far city's group, merged with it). */
export function buildEventGrounds(g: Object3D): EventGrounds {
  const fest = festivalGrounds(g);
  const ground = stadium(g);
  let shown = { festival: -1, match: -1 };
  const ids = {
    festival: registerBuilding(FESTIVAL.x0, FESTIVAL.x1, FESTIVAL.z0, FESTIVAL.z1, 8, true),
    stadium: registerBuilding(STADIUM.x0, STADIUM.x1, STADIUM.z0, STADIUM.z1, 14, true),
  };
  return {
    ids,
    set(v) {
      if (v.festival !== shown.festival) {
        lampsUp(fest.lamps, v.festival);
        fest.beams.visible = v.festival > 0.5;
      }
      if (v.match !== shown.match) lampsUp(ground, v.match);
      shown = { festival: v.festival, match: v.match };
    },
  };
}
