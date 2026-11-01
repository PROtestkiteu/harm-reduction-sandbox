import { Group, Vector3, type MeshLambertMaterial } from 'three';
import { PALETTE } from '../config/palette';
import type { Random } from '../sim/random';
import type { WalkInServiceId } from '../sim/types';
import { DoorState, WindowBank, approach } from './animated';
import { add, bench, bin, box, cylinder, planter, signBoard, stanchion, tree } from './kit';
import { acUnit, antenna, bike, drainpipe, flowerPot, roofVent, windowTrim } from './details';
import { roofClutter, wallClutter } from './grit';
import { AMBULANCE_BAY, LOTS, type P2, type PlaceLot } from './layout';
import { glowMat, mat } from './materials';
import { dynamic, mergeStatic } from './mergeStatic';
import type { LocationVisual } from './buildings';

/**
 * The four walk-in places of the wider district. Each is one parametric
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
  /** Building size in the local frame: width along the facade, depth into the lot. */
  w: number;
  d: number;
  /** A world point's position along the facade (local x). */
  along(p: P2): number;
}

function frameFor(id: WalkInServiceId, lot: PlaceLot): Frame {
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
  const { body: g, w, d } = f;
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
  add(g, box(3.4, 0.16, 1.7, mat(s.accent), doorX, 2.98, front + 0.85));
  const sign = signBoard(s.sign, Math.max(2.4, s.sign.length * 0.3), 0.72, s.signFg, s.signBg, 0.4);
  add(g, sign.mesh).position.set(doorX, 3.14, front + 1.66);

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

  return { storefront, lobby, sign: sign.material, windows: new WindowBank(mats, 1.1, 0.06, random), door: new DoorState(), doorL, doorR, doorX };
}

function visual(id: WalkInServiceId, f: Frame, lot: PlaceLot, sh: Shell, extra: (level: number, dt: number, time: number) => void): LocationVisual {
  const { x0, x1, z0, z1 } = lot.rect;
  mergeStatic(f.root);
  let level = 0;
  let target = 0;
  return {
    id,
    root: f.root,
    labelAnchor: new Vector3((x0 + x1) / 2, lot.height + 1.6, (z0 + z1) / 2),
    footprint: { x: (x0 + x1) / 2, z: (z0 + z1) / 2, rx: (x1 - x0) / 2 + 1, rz: (z1 - z0) / 2 + 1 },
    setServiceLevel: (v) => { target = v; },
    openDoor: () => sh.door.request(),
    update(dt, time) {
      level = approach(level, target, 1.6, dt);
      sh.storefront.emissiveIntensity = 0.12 + 1.0 * level;
      sh.lobby.emissiveIntensity = 0.15 + 1.2 * level;
      sh.sign.emissiveIntensity = 0.12 + 0.9 * level;
      sh.windows.update(dt, 0.15 + 0.7 * level);
      const o = sh.door.update(dt) * 0.74;
      sh.doorL.position.x = sh.doorX - 0.42 - o;
      sh.doorR.position.x = sh.doorX + 0.42 + o;
      extra(level, dt, time);
    },
  };
}

// Community pharmacy with a needle and syringe programme: green cross on a
// bracket, sharps return bin by the door, a second sign for the programme.

export function buildPharmacy(random: Random): LocationVisual {
  const lot = LOTS.pharmacy;
  const f = frameFor('pharmacy', lot);
  const sh = shell(f, lot, { wall: 0xc9c2b2, trim: 0x8f877a, accent: 0x3f8a5c, sign: 'PHARMACY', signFg: '#f2fff4', signBg: '#2f6a46', storey: 3.4 }, random);
  const g = f.body;
  const front = f.d / 2;
  const cross = glowMat(0x1f5a36, 0x5bff8f, 0.3);
  const bracket = add(g, new Group());
  bracket.position.set(sh.doorX - 3.0, 3.7, front + 0.6);
  add(bracket, box(0.08, 0.08, 0.9, mat(PALETTE.metal), 0, 0.45, -0.3));
  add(bracket, box(0.12, 0.9, 0.3, cross, 0, 0, 0.2));
  add(bracket, box(0.12, 0.3, 0.9, cross, 0, 0.3, 0.2));
  add(g, box(0.5, 0.85, 0.4, mat(0xd8b23a), sh.doorX + 1.7, 0, front + 0.35));
  add(g, box(0.36, 0.08, 0.1, mat(PALETTE.frame), sh.doorX + 1.7, 0.7, front + 0.56));
  const nsp = signBoard('NSP + NALOXONE', 3.6, 0.5, '#fff6d8', '#2f3a52', 0.3);
  add(g, nsp.mesh).position.set(sh.doorX + 4.0, 2.05, front + 0.1);
  add(g, planter(1.6, 0.5)).position.set(sh.doorX - 2.4, 0, front + 0.5);
  return visual('pharmacy', f, lot, sh, (level) => {
    cross.emissiveIntensity = 0.2 + 1.4 * level;
    nsp.material.emissiveIntensity = 0.1 + 0.6 * level;
  });
}

// Drug checking service: calm teal frontage, benches and an info board for
// people waiting, a low rope line keeping the pavement clear.

export function buildDrugChecking(random: Random): LocationVisual {
  const lot = LOTS.drugChecking;
  const f = frameFor('drugChecking', lot);
  const sh = shell(f, lot, { wall: 0x9fb0ae, trim: 0x5f6f6e, accent: 0x3a8f8a, sign: 'DRUG CHECKING', signFg: '#eafffb', signBg: '#245c58', storey: 3.2 }, random);
  const g = f.body;
  const front = f.d / 2;
  for (const x of [sh.doorX + 2.6, sh.doorX + 4.4]) add(g, bench()).position.set(x, 0, front + 0.6);
  const info = signBoard('FREE + CONFIDENTIAL', 3.4, 0.45, '#eafffb', '#2a3a3a', 0.25);
  add(g, info.mesh).position.set(sh.doorX - 3.4, 1.9, front + 0.1);
  for (const x of [sh.doorX + 1.6, sh.doorX + 6.2]) add(g, stanchion()).position.set(x, 0, front + 1.2);
  add(g, flowerPot(0.7, 1.2)).position.set(sh.doorX - 1.6, 0, front + 0.4);
  add(g, bin()).position.set(sh.doorX - 5.2, 0, front + 0.5);
  return visual('drugChecking', f, lot, sh, (level) => {
    info.material.emissiveIntensity = 0.1 + 0.5 * level;
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
  add(g, bench()).position.set(sh.doorX - 2.8, 0, front + 0.6);
  for (const x of [sh.doorX + 5.0, sh.doorX + 5.8]) add(g, box(0.06, 0.7, 0.6, mat(PALETTE.metal), x, 0, front + 0.8));
  add(g, bike(0x5a7a5a), Math.PI / 2).position.set(sh.doorX + 5.0, 0, front + 0.8);
  add(g, planter(1.4, 0.6)).position.set(sh.doorX - 4.6, 0, front + 0.5);
  add(g, tree(1, 0.8)).position.set(-f.w / 2 + 1.2, 0, front + 1.4);
  return visual('shelter', f, lot, sh, (level) => {
    day.material.emissiveIntensity = 0.1 + 0.7 * level;
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
  const aeX = f.along({ x: lot.door.x, z: AMBULANCE_BAY.z });
  const aeGlow = glowMat(0x5a2a2a, 0xff5a4a, 0.3);
  add(g, box(2.6, 2.5, 0.05, glowMat(PALETTE.warmWindowDim, 0xfff0e8, 0.6), aeX, 0.45, front + 0.01));
  add(g, box(4.6, 0.2, 3.2, mat(0x9a3a34), aeX, 3.0, front + 1.6));
  for (const sx of [-2.1, 2.1]) add(g, cylinder(0.1, 3.0, mat(PALETTE.metal), 6, aeX + sx, 0, front + 3.0));
  const ae = signBoard('A&E', 1.6, 0.7, '#ffffff', '#9a2a2a', 0.6);
  add(g, ae.mesh).position.set(aeX, 3.22, front + 3.22);
  add(g, box(4.6, 0.04, 0.14, aeGlow, aeX, 2.95, front + 3.2));

  // Ambulance waiting in the bay, in world coordinates on the unrotated root.
  const amb = add(f.root, new Group());
  amb.position.set(AMBULANCE_BAY.x, 0.02, AMBULANCE_BAY.z);
  const white = mat(0xeeeeea);
  add(amb, box(2.0, 0.3, 5.2, mat(PALETTE.tyre), 0, 0.3, 0));
  add(amb, box(2.1, 2.1, 3.6, white, 0, 0.55, 0.6));
  add(amb, box(2.0, 1.5, 1.5, white, 0, 0.55, -1.9));
  add(amb, box(1.9, 0.6, 0.06, mat(PALETTE.glassDark), 0, 1.4, -2.66));
  add(amb, box(2.14, 0.22, 3.62, mat(0x2f6a3a), 0, 1.1, 0.6));
  add(amb, box(2.14, 0.16, 3.62, mat(0xd8b23a), 0, 1.32, 0.6));
  const beacon = glowMat(0x2a3a6a, 0x5a8aff, 0.2);
  for (const sx of [-0.7, 0.7]) add(amb, box(0.3, 0.16, 0.3, beacon, sx, 2.66, -1.0));
  for (const wz of [-1.6, 1.8]) for (const wx of [-0.98, 0.98]) add(amb, box(0.24, 0.7, 0.7, mat(PALETTE.tyre), wx, 0, wz));
  add(g, bench()).position.set(sh.doorX + 2.6, 0, front + 0.6);
  add(g, planter(1.6, 0.5)).position.set(sh.doorX - 2.6, 0, front + 0.5);

  return visual('clinic', f, lot, sh, (level) => {
    aeGlow.emissiveIntensity = 0.6 + 0.8 * level;
    ae.material.emissiveIntensity = 0.5 + 0.5 * level;
    beacon.emissiveIntensity = 0.2 + 1.0 * level;
  });
}
