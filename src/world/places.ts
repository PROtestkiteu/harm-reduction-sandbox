import { Group, Vector3, type MeshLambertMaterial } from 'three';
import { PALETTE } from '../config/palette';
import type { Random } from '../sim/random';
import type { WalkInServiceId } from '../sim/types';
import { DoorState, WindowBank, approach } from './animated';
import { add, bench, bin, box, cylinder, planter, signBoard, stanchion, tree } from './kit';
import { acUnit, antenna, bike, drainpipe, flowerPot, roofVent, windowTrim } from './details';
import { roofClutter, wallClutter } from './grit';
import { AE_ALONG, AMBULANCE_BAY, LOTS, PATROL, PHARMACY_LOT, WALK_BAND, frontLineGap, type P2, type PlaceLot } from './layout';
import { registerBuilding } from './cityBuildings';
import { glowMat, mat } from './materials';
import { dynamic, mergeStatic } from './mergeStatic';
import type { LocationVisual } from './buildings';

/**
 * The walk-in places of the wider district, the foot patrol's table, and the pharmacy (a business). Each is one parametric
 * civic building (plinth, storeys, lit ground floor, sliding doors, canopy and
 * pixel sign) plus the details that make it recognisable at a glance.
 *
 * Built in a local frame where the street facade faces +z, then turned to the
 * lot's facing. Extras that live in the street (the ambulance) use world
 * coordinates on the unrotated root.
 */

interface Style {
  wall: number;
  trim: number;
  accent: number;
  sign: string;
  signFg: string;
  signBg: string;
  storey: number;
}

interface Frame {
  root: Group;
  body: Group;
  vacantRoot?: Group;
  /** Building size in the local frame: width along the facade, depth into the lot. */
  w: number;
  d: number;
  /** A world point's position along the facade (local x). */
  along(p: P2): number;
}

function frameFor(id: string, lot: PlaceLot): Frame {
  const root = new Group();
  root.name = id;
  const { x0, x1, z0, z1 } = lot.rect;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const body = add(root, new Group());
  body.position.set(cx, 0.12, cz);
  // A quarter turn maps local +z (the facade) to world +x, and local +x to world -z.
  const turned = lot.face === '+x';
  body.rotation.y = turned ? Math.PI / 2 : 0;
  return {
    root,
    body,
    w: turned ? z1 - z0 : x1 - x0,
    d: turned ? x1 - x0 : z1 - z0,
    along: (p) => (turned ? -(p.z - cz) : p.x - cx),
  };
}

/**
 * Where frontage furniture `depth` metres deep stands out from the facade:
 * `want` metres out to its middle, pulled back so it keeps clear of the
 * walking band in front, or null where even against the wall it would not.
 */
function kerbside(lot: PlaceLot): (depth: number, want: number) => number | null {
  const gap = frontLineGap(lot);
  return (depth, want) => {
    const most = gap - WALK_BAND - depth / 2;
    return most >= depth / 2 + 0.02 ? Math.min(want, most) : null;
  };
}

interface Shell {
  storefront: MeshLambertMaterial;
  lobby: MeshLambertMaterial;
  sign: MeshLambertMaterial;
  windows: WindowBank;
  door: DoorState;
  doorL: Group;
  doorR: Group;
  doorX: number;
}

/** The shared civic building: everything but the place's signature details. */
function shell(f: Frame, lot: PlaceLot, s: Style, random: Random): Shell {
  const { w, d } = f;
  const neutral = f.root.name !== 'pharmacy';
  const g = neutral ? add(f.body, dynamic(new Group())) : f.body;
  const h = lot.height;
  const front = d / 2;
  const doorX = f.along(lot.door);

  add(g, box(w + 0.12, 0.45, d + 0.12, mat(s.trim), 0, 0, 0));
  add(g, box(w, h, d, mat(s.wall), 0, 0, 0));
  add(g, box(w + 0.18, 0.22, d + 0.18, mat(s.accent), 0, s.storey + 0.1, 0));
  add(g, box(w + 0.26, 0.42, d + 0.26, mat(s.trim), 0, h, 0));

  // Ground floor: glazing either side of the entrance, lit by the service level.
  const storefront = glowMat(PALETTE.glassDark, PALETTE.warmWindow, 0.2);
  const frameMat = mat(PALETTE.frame);
  const left = -w / 2 + 0.8;
  const right = w / 2 - 0.8;
  for (const [a, b] of [[left, doorX - 1.3], [doorX + 1.3, right]]) {
    if (b - a < 0.8) continue;
    add(g, box(b - a, 2.1, 0.08, storefront, (a + b) / 2, 0.75, front + 0.02));
    add(g, box(b - a, 0.1, 0.14, frameMat, (a + b) / 2, 2.85, front + 0.04));
    for (let x = a; x <= b + 0.01; x += Math.max(1.2, (b - a) / Math.round((b - a) / 1.8))) add(g, box(0.1, 2.2, 0.12, frameMat, x, 0.7, front + 0.04));
  }

  // Entrance: lobby glow behind sliding glass doors, canopy and sign above.
  const lobby = glowMat(PALETTE.warmWindowDim, PALETTE.warmWindow, 0.3);
  add(g, box(1.7, 2.45, 0.05, lobby, doorX, 0.45, front + 0.01));
  const glass = mat(PALETTE.glassDark);
  const doorL = add(g, dynamic(new Group()));
  const doorR = add(g, dynamic(new Group()));
  add(doorL, box(0.84, 2.35, 0.06, glass, 0, 0.45, front + 0.07));
  add(doorR, box(0.84, 2.35, 0.06, glass, 0, 0.45, front + 0.07));
  doorL.position.x = doorX - 0.42;
  doorR.position.x = doorX + 0.42;
  add(g, box(2.0, 0.28, 0.14, frameMat, doorX, 2.8, front + 0.06));
  for (const sx of [-0.94, 0.94]) add(g, box(0.12, 2.4, 0.14, frameMat, doorX + sx, 0.45, front + 0.06));
  add(f.body, box(3.4, 0.16, 1.7, mat(s.accent), doorX, 2.98, front + 0.85));
  const sign = signBoard(s.sign, Math.max(2.4, s.sign.length * 0.3), 0.72, s.signFg, s.signBg, 0.4);
  add(f.body, sign.mesh).position.set(doorX, 3.14, front + 1.66);

  // Upper floors: a window grid on the facade and both side walls.
  const mats = Array.from({ length: 6 }, (_, i) => glowMat(PALETTE.glassDark, i === 5 ? PALETTE.coolWindow : PALETTE.warmWindow, 0.2));
  let k = 0;
  for (let y = s.storey + 0.9; y + 1.4 < h - 0.2; y += s.storey) {
    for (let x = -w / 2 + 1.4; x <= w / 2 - 1.2; x += 2.1) {
      add(g, box(1.1, 1.4, 0.08, mats[k++ % mats.length], x, y, front + 0.02));
      add(g, windowTrim(1.1, 1.4)).position.set(x, y, front + 0.02);
    }
    for (let z = -d / 2 + 1.4; z <= d / 2 - 1.2; z += 2.3) {
      for (const side of [-1, 1]) {
        add(g, box(0.08, 1.4, 1.1, mats[k++ % mats.length], side * (w / 2 + 0.02), y, z));
        add(g, windowTrim(1.1, 1.4), (side * Math.PI) / 2).position.set(side * (w / 2 + 0.02), y, z);
      }
    }
  }
  add(g, drainpipe(h + 0.2)).position.set(w / 2 - 0.15, 0, front + 0.08);

  // Roof plant.
  add(g, acUnit()).position.set(-w / 4, h + 0.42, -d / 4);
  add(g, roofVent()).position.set(w / 4, h + 0.42, d / 6);
  if (random() < 0.6) add(g, antenna(1.6 + random())).position.set(w / 3, h + 0.42, -d / 3);
  add(g, box(1.8, 0.9, 1.2, mat(PALETTE.concrete), -w / 6, h + 0.42, d / 5));
  roofClutter(g, 0, 0, w * 0.8, d * 0.8, h + 0.42, random);
  // Pipes, air-con and ivy on both side walls; the entrance front stays clear.
  add(g, wallClutter(d, h, random), Math.PI / 2).position.set(w / 2, 0, 0);
  add(g, wallClutter(d, h, random), -Math.PI / 2).position.set(-w / 2, 0, 0);

  if (neutral) {
    mergeStatic(g);
    const vacant = dynamic(new Group());
    vacant.name = 'vacant-' + f.root.name;
    vacant.position.copy(f.body.position);
    vacant.quaternion.copy(f.body.quaternion);
    vacant.add(g.clone(true));
    vacant.visible = false;
    f.vacantRoot = vacant;
  }
  return { storefront, lobby, sign: sign.material, windows: new WindowBank(mats, 1.1, 0.06, random), door: new DoorState(), doorL, doorR, doorX };
}

function visual(id: WalkInServiceId, f: Frame, lot: PlaceLot, sh: Shell, extra: (level: number, dt: number, time: number, shut: boolean) => void): LocationVisual {
  const { x0, x1, z0, z1 } = lot.rect;
  mergeStatic(f.root);
  let level = 0;
  let target = 0;
  let shut = false;
  return {
    id,
    root: f.root,
    vacantRoot: f.vacantRoot,
    labelAnchor: new Vector3((x0 + x1) / 2, lot.height + 1.6, (z0 + z1) / 2),
    footprint: { x: (x0 + x1) / 2, z: (z0 + z1) / 2, rx: (x1 - x0) / 2 + 1, rz: (z1 - z0) / 2 + 1 },
    setServiceLevel: (v) => { target = v; },
    setShut: (v) => { shut = v; },
    openDoor: () => sh.door.request(),
    update(dt, time) {
      level = approach(level, target, 1.6, dt);
      // Shut for good: no night glow left, every window dark.
      const base = shut ? 0 : 1;
      sh.storefront.emissiveIntensity = 0.12 * base + 1.0 * level;
      sh.lobby.emissiveIntensity = 0.15 * base + 1.2 * level;
      sh.sign.emissiveIntensity = 0.12 * base + 0.9 * level;
      sh.windows.update(dt, 0.15 + 0.7 * level, shut);
      const o = sh.door.update(dt) * 0.74;
      sh.doorL.position.x = sh.doorX - 0.42 - o;
      sh.doorR.position.x = sh.doorX + 0.42 + o;
      extra(level, dt, time, shut);
    },
  };
}

// The community pharmacy: one of the neighbourhood's businesses, not a service of yours. A
// green cross on a bracket and a sharps bin by the door; it sells syringes, at a price few
// people who inject can pay. Lit as any shop in the evening; clickable for its card.

export function buildPharmacyShop(random: Random): { root: Group; building: number } {
  const lot = PHARMACY_LOT;
  const f = frameFor('pharmacy', lot);
  const sh = shell(f, lot, { wall: 0xc9c2b2, trim: 0x8f877a, accent: 0x3f8a5c, sign: 'PHARMACY', signFg: '#f2fff4', signBg: '#2f6a46', storey: 3.4 }, random);
  const g = f.body;
  const front = f.d / 2;
  const cross = glowMat(0x1f5a36, 0x5bff8f, 1.2);
  const bracket = add(g, new Group());
  bracket.position.set(sh.doorX - 3.0, 3.7, front + 0.6);
  add(bracket, box(0.08, 0.08, 0.9, mat(PALETTE.metal), 0, 0.45, -0.3));
  add(bracket, box(0.12, 0.9, 0.3, cross, 0, 0, 0.2));
  add(bracket, box(0.12, 0.3, 0.9, cross, 0, 0.3, 0.2));
  // Out front, clear of the walking line however near this site's runs.
  const out = kerbside(lot);
  const binAt = out(0.4, 0.35);
  if (binAt !== null) add(g, box(0.5, 0.85, 0.4, mat(0xd8b23a), sh.doorX + 1.7, 0, front + binAt));
  const potAt = out(0.5, 0.5);
  if (potAt !== null) add(g, planter(1.6, 0.5)).position.set(sh.doorX - 2.4, 0, front + potAt);
  // A shop in the evening: lit at a steady level, nothing to animate.
  sh.storefront.emissiveIntensity = 0.9;
  sh.lobby.emissiveIntensity = 1.0;
  sh.sign.emissiveIntensity = 0.8;
  mergeStatic(f.root);
  const { x0, x1, z0, z1 } = lot.rect;
  return { root: f.root, building: registerBuilding(x0, x1, z0, z1, lot.height, true) };
}

// The streetworkers' foot patrol: no building, a folding table on the pavement by the squat with
// kits, naloxone and a sharps bin, a lantern and a small sign. The base stays visible off shift.

export function buildFootPatrol(): LocationVisual {
  const lot = LOTS.footPatrol;
  const root = new Group();
  root.name = 'footPatrol';
  const kit = add(root, dynamic(new Group()));
  const at = (q: P2, y = 0) => new Vector3(q.x, 0.12 + y, q.z);
  // The served face towards staff; the table and sign face back towards visitors.
  const turn = PATROL.facing + Math.PI;
  const table = add(kit, new Group());
  table.position.copy(at(PATROL.table));
  table.rotation.y = turn;
  add(table, box(1.6, 0.05, 0.7, mat(0xe8e4dc), 0, 0.72, 0));
  for (const [x, z] of [[-0.7, -0.28], [0.7, -0.28], [-0.7, 0.28], [0.7, 0.28]] as const) add(table, box(0.04, 0.72, 0.04, mat(PALETTE.metal), x, 0, z));
  // On the table: kit boxes, a naloxone pouch, leaflets; under it, rucksacks.
  for (const [x, c] of [[-0.45, 0x3a7ac8], [-0.1, 0x3a7ac8], [0.3, 0xc8402a]] as const) add(table, box(0.28, 0.16, 0.22, mat(c), x, 0.77, 0.05));
  add(table, box(0.3, 0.02, 0.22, mat(0xf0ead0), 0.6, 0.77, 0.1));
  for (const x of [-0.5, 0.45]) add(table, box(0.34, 0.45, 0.25, mat(0x2a3a2a), x, 0, -0.55));
  // A yellow sharps bin at the end of the table and a lantern on it.
  add(table, box(0.32, 0.5, 0.3, mat(0xe8c020), 1.05, 0, 0));
  const lantern = glowMat(0x6a5a3a, 0xffd890, 1.6);
  add(table, box(0.14, 0.24, 0.14, lantern, -0.72, 0.77, -0.2));
  // A small sign on a pole: what the patrol hands out.
  const sign = signBoard('NEEDLES  NALOXONE', 2.4, 0.42, '#ffffff', '#2e7d6b', 0.5, 'pixel', true);
  sign.mesh.name = 'footPatrolSign';
  dynamic(sign.mesh);
  add(table, cylinder(0.03, 2.1, mat(PALETTE.metal), 5, -0.95, 0, -0.3));
  add(table, sign.mesh).position.set(-0.95, 2.1, -0.3);
  const { x0, x1, z0, z1 } = lot.rect;
  let level = 0;
  let target = 0;
  return {
    id: 'footPatrol',
    root,
    roofSign: sign.mesh,
    labelAnchor: at(PATROL.table, 3.2),
    footprint: { x: (x0 + x1) / 2, z: (z0 + z1) / 2, rx: (x1 - x0) / 2 + 1, rz: (z1 - z0) / 2 + 1 },
    setServiceLevel: (v) => { target = v; },
    openDoor: () => {},
    update(dt) {
      level = approach(level, target, 1.6, dt);
      lantern.emissiveIntensity = 0.4 + 1.4 * level;
      sign.material.emissiveIntensity = 0.1 + 0.6 * level;
    },
  };
}

// Drug checking service: calm teal frontage, benches and an info board for
// people waiting, a low rope line keeping the pavement clear.

export function buildDrugChecking(random: Random): LocationVisual {
  const lot = LOTS.drugChecking;
  const f = frameFor('drugChecking', lot);
  const sh = shell(f, lot, { wall: 0x9fb0ae, trim: 0x5f6f6e, accent: 0x3a8f8a, sign: 'DRUG CHECKING', signFg: '#eafffb', signBg: '#245c58', storey: 3.2 }, random);
  const g = f.body;
  const front = f.d / 2;
  // Out front, clear of the walking line however near this site's runs.
  const out = kerbside(lot);
  const benchAt = out(0.5, 0.6);
  if (benchAt !== null) for (const x of [sh.doorX + 2.6, sh.doorX + 4.4]) add(g, bench()).position.set(x, 0, front + benchAt);
  const info = signBoard('FREE + CONFIDENTIAL', 3.4, 0.45, '#eafffb', '#2a3a3a', 0.25);
  add(g, info.mesh).position.set(sh.doorX - 3.4, 1.9, front + 0.1);
  const ropeAt = out(0.3, 1.2);
  if (ropeAt !== null) for (const x of [sh.doorX + 1.6, sh.doorX + 6.2]) add(g, stanchion()).position.set(x, 0, front + ropeAt);
  const potAt = out(0.7, 0.4);
  if (potAt !== null) add(g, flowerPot(0.7, 1.2)).position.set(sh.doorX - 1.6, 0, front + potAt);
  const binAt = out(0.6, 0.5);
  if (binAt !== null) add(g, bin()).position.set(sh.doorX - 5.2, 0, front + binAt);
  return visual('drugChecking', f, lot, sh, (level, _dt, _time, shut) => {
    info.material.emissiveIntensity = (shut ? 0 : 0.1) + 0.5 * level;
  });
}

// Night shelter and day centre: taller brick building, benches, bike rack
// and planted tubs along the front; a second sign for the day centre.

export function buildShelter(random: Random): LocationVisual {
  const lot = LOTS.shelter;
  const f = frameFor('shelter', lot);
  const sh = shell(f, lot, { wall: PALETTE.brick, trim: PALETTE.brickDark, accent: 0x8a6a3a, sign: 'SHELTER', signFg: '#fff1d8', signBg: '#5a3a28', storey: 3.2 }, random);
  const g = f.body;
  const front = f.d / 2;
  const day = signBoard('DAY CENTRE', 2.8, 0.5, '#fff1d8', '#3a2f3a', 0.3);
  add(g, day.mesh).position.set(sh.doorX + 3.6, 2.15, front + 0.1);
  // Against the wall and out front, clear of the walking line however near this site's runs.
  const out = kerbside(lot);
  const benchAt = out(0.5, 0.3);
  if (benchAt !== null) add(g, bench()).position.set(sh.doorX - 2.8, 0, front + benchAt);
  const rackAt = out(0.6, 0.8);
  if (rackAt !== null) {
    for (const x of [sh.doorX + 5.0, sh.doorX + 5.8]) add(g, box(0.06, 0.7, 0.6, mat(PALETTE.metal), x, 0, front + rackAt));
    add(g, bike(0x5a7a5a), Math.PI / 2).position.set(sh.doorX + 5.0, 0, front + rackAt);
  }
  const potAt = out(0.6, 0.32);
  if (potAt !== null) add(g, planter(1.4, 0.6)).position.set(sh.doorX - 4.6, 0, front + potAt);
  const treeAt = out(0.6, 1.4);
  if (treeAt !== null) add(g, tree(1, 0.8)).position.set(-f.w / 2 + 1.2, 0, front + treeAt);
  return visual('shelter', f, lot, sh, (level, _dt, _time, shut) => {
    day.material.emissiveIntensity = (shut ? 0 : 0.1) + 0.7 * level;
  });
}

// Clinic with an A&E entrance: pale four-storey block, the clinic door on the
// east street and, further along, a red-lit A&E canopy with an ambulance bay.

export function buildClinic(random: Random): LocationVisual {
  const lot = LOTS.clinic;
  const f = frameFor('clinic', lot);
  const sh = shell(f, lot, { wall: 0xd6d8d8, trim: 0x9a9fa6, accent: 0x4f6f9a, sign: 'CLINIC', signFg: '#f4f8ff', signBg: '#334a73', storey: 3.6 }, random);
  const g = f.body;
  const front = f.d / 2;

  // A&E entrance: its own lit doorway, red canopy and sign.
  const aeX = AE_ALONG;
  const aeGlow = glowMat(0x5a2a2a, 0xff5a4a, 0.3);
  add(g, box(2.6, 2.5, 0.05, glowMat(PALETTE.warmWindowDim, 0xfff0e8, 0.6), aeX, 0.45, front + 0.01));
  add(g, box(4.6, 0.2, 3.2, mat(0x9a3a34), aeX, 3.0, front + 1.6));
  for (const sx of [-2.1, 2.1]) add(g, cylinder(0.1, 3.0, mat(PALETTE.metal), 6, aeX + sx, 0, front + 3.0));
  const ae = signBoard('A&E', 1.6, 0.7, '#ffffff', '#9a2a2a', 0.6);
  add(g, ae.mesh).position.set(aeX, 3.22, front + 3.22);
  add(g, box(4.6, 0.04, 0.14, aeGlow, aeX, 2.95, front + 3.2));

  // Ambulance waiting in the bay, in world coordinates on the unrotated root,
  // where the street has a lane for it.
  const beacon = glowMat(0x2a3a6a, 0x5a8aff, 0.2);
  if (AMBULANCE_BAY) {
    const amb = add(f.root, new Group());
    amb.position.set(AMBULANCE_BAY.x, 0.02, AMBULANCE_BAY.z);
    amb.rotation.y = lot.face === '+x' ? 0 : Math.PI / 2;
    const white = mat(0xeeeeea);
    add(amb, box(2.0, 0.3, 5.2, mat(PALETTE.tyre), 0, 0.3, 0));
    add(amb, box(2.1, 2.1, 3.6, white, 0, 0.55, 0.6));
    add(amb, box(2.0, 1.5, 1.5, white, 0, 0.55, -1.9));
    add(amb, box(1.9, 0.6, 0.06, mat(PALETTE.glassDark), 0, 1.4, -2.66));
    add(amb, box(2.14, 0.22, 3.62, mat(0x2f6a3a), 0, 1.1, 0.6));
    add(amb, box(2.14, 0.16, 3.62, mat(0xd8b23a), 0, 1.32, 0.6));
    for (const sx of [-0.7, 0.7]) add(amb, box(0.3, 0.16, 0.3, beacon, sx, 2.66, -1.0));
    for (const wz of [-1.6, 1.8]) for (const wx of [-0.98, 0.98]) add(amb, box(0.24, 0.7, 0.7, mat(PALETTE.tyre), wx, 0, wz));
  }
  // Out front, clear of the walking line however near this site's runs.
  const out = kerbside(lot);
  const benchAt = out(0.5, 0.6);
  if (benchAt !== null) add(g, bench()).position.set(sh.doorX + 2.6, 0, front + benchAt);
  const potAt = out(0.5, 0.5);
  if (potAt !== null) add(g, planter(1.6, 0.5)).position.set(sh.doorX - 2.6, 0, front + potAt);

  return visual('clinic', f, lot, sh, (level) => {
    aeGlow.emissiveIntensity = 0.6 + 0.8 * level;
    ae.material.emissiveIntensity = 0.5 + 0.5 * level;
    beacon.emissiveIntensity = 0.2 + 1.0 * level;
  });
}
