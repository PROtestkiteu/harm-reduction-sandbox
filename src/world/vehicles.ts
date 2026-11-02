import { Box3, BufferGeometry, CapsuleGeometry, CylinderGeometry, Float32BufferAttribute, Group, LatheGeometry, Mesh, SphereGeometry, Vector2, type Material, type Object3D } from 'three';
import { PALETTE } from '../config/palette';
import { glowMat, vehicleMat } from './materials';
import { solid } from './solids';
import { box } from './kit';

const headlight = glowMat(0xfff4dc, 0xfff0d0, 1.4);
const taillight = glowMat(0x7a2a2a, 0xff5a4a, 1.0);

/**
 * Daylight (0 to 1) dims driving lights to a faint glow: at full strength in
 * the sun they read as bulbs and leave sparkles in the wet-street reflections.
 */
export function setVehicleDaylight(day: number): void {
  headlight.emissiveIntensity = 1.4 * (1 - 0.85 * day);
  taillight.emissiveIntensity = 1.0 * (1 - 0.7 * day);
}
const parkedHead = vehicleMat(0xb8b8b0, 2);
const parkedTail = vehicleMat(0x6a2422, 2);
const taxiLight = glowMat(0xd8c050, 0xffd860, 0.9);

export type CarKind = 'hatch' | 'saloon' | 'van' | 'taxi';
type Form = 'hatch' | 'saloon' | 'van';

/**
 * A body type, seen from the side and from above. The body is lofted from
 * rounded cross-sections along the car: a curved flank up to the waist, then
 * a cabin that leans in (tumblehome) to a crowned roof. The plan narrows at
 * the nose and tail, so no face of the car is flat.
 */
export interface Profile {
  length: number;
  width: number;
  axles: [number, number];
  /** Roof line from nose (z = +length/2) to tail: [z, height]. */
  roof: [number, number][];
  /** Waist (window sill) height. */
  belt: number;
  /** Side windows run between these z values. */
  glass: [number, number];
  /** Door pillars between the side windows. */
  pillars: number[];
  /** Wheel radius; cars default to 0.32. */
  wheel?: number;
  /** How far the cabin leans in above the waist: 1 for cars, less for boxy vans. */
  lean?: number;
  /** An opening left in the right-hand (+x) window band, between these z values. */
  opening?: [number, number];
}

const SILL = 0.27;
const WHEEL_R = 0.32;
const ARCH = 0.41;

const PROFILES: Record<Form, Profile> = {
  hatch: {
    length: 3.9, width: 1.72, axles: [-1.22, 1.26],
    roof: [[1.95, 0.72], [1.86, 0.84], [1.0, 0.98], [0.42, 1.42], [-0.6, 1.48], [-1.35, 1.45], [-1.78, 1.14], [-1.95, 0.8]],
    belt: 0.98, glass: [-1.72, 0.95], pillars: [-0.22, -1.32],
  },
  saloon: {
    length: 4.3, width: 1.76, axles: [-1.38, 1.36],
    roof: [[2.15, 0.7], [2.06, 0.82], [1.15, 0.96], [0.52, 1.4], [-0.2, 1.45], [-0.82, 1.42], [-1.45, 1.0], [-2.08, 0.95], [-2.15, 0.74]],
    belt: 0.96, glass: [-1.4, 1.12], pillars: [-0.2],
  },
  van: {
    length: 4.6, width: 1.84, axles: [-1.55, 1.48],
    roof: [[2.3, 0.76], [2.22, 0.92], [1.76, 1.05], [1.2, 1.86], [0.6, 1.95], [-2.18, 1.96], [-2.3, 1.72]],
    belt: 1.05, glass: [0.6, 1.72], pillars: [],
  },
};

/** Roof height at z, from the profile's roof line. */
function roofAt(p: Profile, z: number): number {
  const r = p.roof;
  if (z >= r[0][0]) return r[0][1];
  for (let i = 1; i < r.length; i++) {
    if (z >= r[i][0]) {
      const t = (z - r[i][0]) / (r[i - 1][0] - r[i][0]);
      return r[i][1] + (r[i - 1][1] - r[i][1]) * t;
    }
  }
  return r[r.length - 1][1];
}

/** Underside height: the sill, lifted into an arch over each wheel. */
function bottomAt(p: Profile, z: number): number {
  const r = p.wheel ?? WHEEL_R;
  const arch = r + ARCH - WHEEL_R;
  let b = SILL;
  for (const a of p.axles) {
    const d = Math.abs(z - a);
    if (d < arch) b = Math.max(b, r + Math.sqrt(arch * arch - d * d));
  }
  return b;
}

/** Points of one half cross-section (right side, x >= 0), bottom centre to roof centre. */
const SECTION_POINTS = 11;
function halfSection(hw: number, b: number, belt: number, top: number, lean = 1): [number, number][] {
  const waist = Math.min(belt, top - 0.03);
  const h = top - waist;
  const inset = (f: number) => hw * (1 - (1 - f) * lean);
  return [
    [0, b],
    [hw * 0.9, b],
    [hw * 0.985, b + 0.07],
    [hw, b + (waist - b) * 0.45],
    [hw * 0.985, waist - 0.07],
    [hw * 0.94, waist],
    [inset(0.9), waist + Math.min(0.03, h * 0.2)],
    [inset(0.78), waist + h * 0.86],
    [inset(0.66), top - h * 0.03],
    [hw * (lean < 1 ? 0.5 : 0.34), top],
    [0, top + Math.min(0.02, h * 0.1)],
  ];
}

const bodyCache = new Map<string, { paint: BufferGeometry; glass: BufferGeometry }>();

/**
 * Lofts the body: one closed ring of points per station along the car, smooth
 * normals, a rounded nose and tail closed with a cap. Faces inside the window
 * band, the windscreen and the rear screen go into the glass group; the rest,
 * including door pillars and the roof, is paint.
 */
function bodyGeometry(key: string, p: Profile): { paint: BufferGeometry; glass: BufferGeometry } {
  const cached = bodyCache.get(key);
  if (cached) return cached;
  const half = p.length / 2;
  const arch = (p.wheel ?? WHEEL_R) + ARCH - WHEEL_R;

  // Stations: evenly along the car, denser over the wheel arches.
  const zs: number[] = [];
  for (let i = 0; i <= 22; i++) zs.push(-half + (p.length * i) / 22);
  for (const a of p.axles) for (const k of [-1, -0.85, -0.5, 0, 0.5, 0.85, 1]) zs.push(a + k * arch);
  if (p.opening) for (const z of p.opening) zs.push(z - 0.02, z + 0.02);
  zs.sort((a, b) => a - b);
  const stations = zs.filter((z, i) => i === 0 || z - zs[i - 1] > 0.03);

  interface Station { z: number; hw: number; b: number; top: number }
  const rings: Station[] = stations.map((z) => {
    const t = Math.abs(z) / half;
    return { z, hw: (p.width / 2) * (0.84 + 0.16 * Math.pow(1 - Math.pow(t, 4), 0.25)), b: bottomAt(p, z) + Math.max(0, t - 0.88) * 0.6, top: roofAt(p, z) };
  });
  // Rounded nose and tail: one more, smaller ring beyond each end.
  const tip = (s: Station, dz: number): Station => ({ z: s.z + dz, hw: s.hw * 0.9, b: s.b + 0.09, top: s.top - 0.08 });
  rings.unshift(tip(rings[0], -0.07));
  rings.push(tip(rings[rings.length - 1], 0.07));

  const pos: number[] = [];
  const ringLen = SECTION_POINTS * 2 - 2;
  for (const s of rings) {
    const right = halfSection(s.hw, s.b, p.belt, s.top, p.lean);
    const ring: [number, number][] = [...right, ...right.slice(1, -1).reverse().map(([x, y]) => [-x, y] as [number, number])];
    for (const [x, y] of ring) pos.push(x, y, s.z);
  }

  const paint: number[] = [];
  const glass: number[] = [];
  const steep = (i: number) => Math.abs(rings[i + 1].top - rings[i].top) / (rings[i + 1].z - rings[i].z) > 0.45;
  const cabin = (i: number) => Math.min(rings[i].top, rings[i + 1].top) - p.belt > 0.25;
  for (let i = 0; i < rings.length - 1; i++) {
    const zc = (rings[i].z + rings[i + 1].z) / 2;
    const sideGlass = cabin(i) && zc > p.glass[0] && zc < p.glass[1] && !p.pillars.some((pz) => Math.abs(zc - pz) < 0.07);
    // The whole windscreen and rear screen, down to the bonnet and boot.
    const screen = steep(i) && Math.max(rings[i].top, rings[i + 1].top) - p.belt > 0.06;
    for (let j = 0; j < ringLen; j++) {
      const k = (j + 1) % ringLen;
      // Row index from the bottom, the same on both sides.
      const row = j < SECTION_POINTS - 1 ? j : ringLen - 1 - j;
      const isGlass = (row === 6 && sideGlass) || (row >= 8 && screen);
      // The opening: no faces on the right side's window band there.
      if (p.opening && row === 6 && j < SECTION_POINTS - 1 && zc > p.opening[0] && zc < p.opening[1]) continue;
      const a = i * ringLen + j;
      const b = i * ringLen + k;
      const c = (i + 1) * ringLen + k;
      const d = (i + 1) * ringLen + j;
      (isGlass ? glass : paint).push(a, b, d, b, c, d);
    }
  }
  // Caps: their own vertices, so their normals stay flat-ish and separate.
  for (const [ri, flip] of [[0, true], [rings.length - 1, false]] as const) {
    const base = pos.length / 3;
    let cy = 0;
    for (let j = 0; j < ringLen; j++) {
      const o = (ri * ringLen + j) * 3;
      pos.push(pos[o], pos[o + 1], pos[o + 2]);
      cy += pos[o + 1] / ringLen;
    }
    const centre = pos.length / 3;
    pos.push(0, cy, rings[ri].z + (flip ? -0.015 : 0.015));
    for (let j = 0; j < ringLen; j++) {
      const k = (j + 1) % ringLen;
      if (flip) paint.push(centre, base + k, base + j);
      else paint.push(centre, base + j, base + k);
    }
  }

  // Normals from the whole body, so paint and glass meet smoothly; then two
  // geometries over the same vertices, one per material, so parked cars merge.
  const whole = new BufferGeometry();
  whole.setAttribute('position', new Float32BufferAttribute(pos, 3));
  whole.setIndex([...paint, ...glass]);
  whole.computeVertexNormals();
  const uv = new Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2);
  const split = (index: number[]) => {
    const g = new BufferGeometry();
    g.setAttribute('position', whole.getAttribute('position'));
    g.setAttribute('normal', whole.getAttribute('normal'));
    // Unused, but merged buckets need the same attributes as the other parts.
    g.setAttribute('uv', uv);
    g.setIndex(index);
    return g;
  };
  const out = { paint: split(paint), glass: split(glass) };
  bodyCache.set(key, out);
  return out;
}

/** A tyre with rounded shoulders, axis along x, centred on its axle (the wheel turns about it). */
const tyreGeo = new LatheGeometry(
  [[0.17, -0.11], [0.29, -0.11], [WHEEL_R, -0.06], [WHEEL_R, 0.06], [0.29, 0.11], [0.17, 0.11]].map(([x, y]) => new Vector2(x, y)),
  14,
).rotateZ(Math.PI / 2);
/** A five-sided hub cap: its flat faces catch the light, so the wheel can be seen turning. */
const hubGeo = new CylinderGeometry(0.175, 0.19, 0.2, 5).rotateZ(Math.PI / 2);

/**
 * Turns a vehicle's wheels for `distance` metres travelled (negative rolls
 * back). Cheap: four rotations; nothing for a vehicle without wheels.
 */
export function rollWheels(vehicle: Object3D, distance: number): void {
  let w = vehicle.userData.wheels as { meshes: Mesh[]; r: number } | undefined;
  if (w === undefined) {
    vehicle.traverse((o) => { if (!w && o.userData.wheels) w = o.userData.wheels; });
    vehicle.userData.wheels = w ?? null;
  }
  if (!w) return;
  const a = distance / w.r;
  for (const m of w.meshes) m.rotation.x += a;
}
const bumperGeo = new CapsuleGeometry(0.085, 1, 2, 8).rotateZ(Math.PI / 2);
const lampGeo = new SphereGeometry(1, 8, 4);
const plateGeo = new CapsuleGeometry(0.05, 0.36, 1, 4).rotateZ(Math.PI / 2).scale(1, 1, 0.25);

function part(g: Group, geo: BufferGeometry, m: Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): Mesh {
  const mesh = new Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  g.add(mesh);
  return mesh;
}

/** Simple deterministic stream from a seed, so a car's look does not depend on spawn order. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let nextSeed = 1;

/**
 * A worn city car facing +z, pivot at ground centre: a lofted, moulded body
 * with set-in glass, rounded tyres, wrap-round bumpers, lamps, mirrors and
 * plates. Wear varies per car: a tired corner, a roof rack, a dull panel.
 */
/**
 * A moulded vehicle from a profile, facing +z with its pivot at ground
 * centre: lofted body and glass, rounded tyres, wrap-round bumpers, lamps,
 * mirrors and plates. Cars and the outreach camper share it.
 */
export function mouldedVehicle(key: string, p: Profile, paint: Material, lit: boolean, hubColour = 0x8a8a86): Group {
  const half = p.length / 2;
  const g = new Group();
  const body = bodyGeometry(key, p);
  part(g, body.paint, paint, 0, 0, 0);
  part(g, body.glass, vehicleMat(PALETTE.glassDark, 2), 0, 0, 0);

  const trim = vehicleMat(0x26262a, 0);
  const tyre = vehicleMat(PALETTE.tyre, 0);
  const hub = vehicleMat(hubColour, 1);
  const k = (p.wheel ?? WHEEL_R) / WHEEL_R;
  const wheels: Mesh[] = [];
  for (const z of p.axles) {
    for (const side of [-1, 1]) {
      const x = side * (p.width / 2 - 0.16 * k);
      // On the axle: tyre and hub turn together about it.
      part(g, tyreGeo, tyre, x, WHEEL_R * k, z, k, k, k);
      wheels.push(part(g, hubGeo, hub, x * 1.015, WHEEL_R * k, z, k, k, k));
    }
  }
  g.userData.wheels = { meshes: wheels, r: WHEEL_R * k };

  // Wrap-round bumpers, a grille, plates.
  const endW = p.width * 0.84;
  for (const s of [1, -1]) {
    part(g, bumperGeo, trim, 0, 0.4, s * (half + 0.03), endW - 0.1, 1, 1.2);
    part(g, plateGeo, vehicleMat(0xd8d4c4, 1), 0, s > 0 ? 0.5 : 0.62, s * (half + 0.11));
  }
  part(g, lampGeo, trim, 0, 0.6, half + 0.06, 0.36, 0.06, 0.03);

  // Lamps: flattened ovals set into the nose and tail corners.
  const front = roofAt(p, half) - 0.1;
  const rear = Math.min(roofAt(p, -half) - 0.14, 1.0);
  for (const side of [-1, 1]) {
    const x = side * endW * 0.36;
    part(g, lampGeo, lit ? headlight : parkedHead, x, front, half + 0.06, 0.17, 0.065, 0.05);
    part(g, lampGeo, lit ? taillight : parkedTail, x * 1.05, rear, -half - 0.06, 0.14, 0.07, 0.05);
    // Door mirrors at the front of the side glass.
    part(g, lampGeo, paint, side * (p.width * 0.47 + 0.05), p.belt + 0.06, Math.min(p.glass[1] - 0.12, half - 0.9), 0.07, 0.06, 0.05);
  }
  return g;
}

export function car(color: number, lit: boolean, kind?: CarKind): Group {
  const random = seeded(nextSeed++ * 7919);
  const type: CarKind = kind ?? (random() < 0.08 ? 'taxi' : (['hatch', 'hatch', 'saloon', 'saloon', 'van'] as const)[Math.floor(random() * 5)]);
  const form: Form = type === 'taxi' ? 'saloon' : type;
  const p = PROFILES[form];
  const paint = vehicleMat(type === 'taxi' ? 0xd8b84a : color);
  const trim = vehicleMat(0x26262a, 0);
  const g = mouldedVehicle(form, p, paint, lit, random() < 0.5 ? 0x8a8a86 : 0x3a3a3c);

  if (type === 'taxi') part(g, bumperGeo, taxiLight, 0, roofAt(p, -0.1) + 0.09, -0.1, 0.45, 1, 1.3);
  else if (form !== 'van' && random() < 0.22) {
    // Roof rails, sometimes with a box on top.
    const y = roofAt(p, -0.4) + 0.04;
    for (const x of [-0.5, 0.5]) part(g, bumperGeo, trim, x, y, -0.4, 0.03, 0.35, 0.35).rotation.y = Math.PI / 2;
    if (random() < 0.5) part(g, lampGeo, vehicleMat(0x3a4048, 1), 0, y + 0.1, -0.5, 0.46, 0.14, 0.62);
  }
  g.traverse((o) => { o.castShadow = true; });
  // A parked car (unlit) is a fixed obstacle people step round; a lit one drives, and the crowd steers
  // round it as it moves (agents/crowd.ts). Tagged, a moving car was fixed wherever it stood at build
  // time: for the pooled traffic and emergency fleet that was the middle of the square.
  if (!lit) solid(g, p.width, p.length + 0.3);
  // Tired suspension: one corner sits a touch low.
  g.rotation.z = (random() - 0.5) * 0.025;
  return g;
}

/** A police car or an ambulance with a light bar whose lamps flash while it is responding. */
export interface EmergencyVehicle {
  group: Group;
  /** Flashing on or off; call `tick` every frame. */
  flashing: boolean;
  tick(dt: number): void;
}

export function emergencyVehicle(kind: 'police' | 'ambulance'): EmergencyVehicle {
  const ambulance = kind === 'ambulance';
  const g = car(ambulance ? 0xe8e4dc : 0x1e2a4a, true, ambulance ? 'van' : 'saloon');
  g.rotation.z = 0;
  const p = PROFILES[ambulance ? 'van' : 'saloon'];
  // The car's real top (the moulded roof crowns above its profile line): the bar sits on it, not in it.
  g.updateMatrixWorld(true);
  const roof = new Box3().setFromObject(g).max.y - g.position.y - 0.01;
  // Livery: a band along each side (yellow-green and red for the ambulance, white and blue for police).
  const band = vehicleMat(ambulance ? 0x9ac83a : 0xe8e8e4, 1);
  const band2 = vehicleMat(ambulance ? 0xc83a32 : 0x2a5ab8, 1);
  for (const x of [-p.width / 2 - 0.01, p.width / 2 + 0.01]) {
    g.add(box(0.02, 0.22, p.length * 0.8, band, x, 0.62, 0));
    g.add(box(0.02, 0.1, p.length * 0.8, band2, x, 0.86, 0));
  }
  // The light bar: two lamps that alternate when flashing.
  const left = glowMat(0x1e2a6a, 0x3a6aff, 0);
  const right = glowMat(ambulance ? 0x6a1e1e : 0x1e2a6a, ambulance ? 0xff3a2a : 0x3a6aff, 0);
  // A thin base plate on the roof, the two lamps on top of it, a dark divider between them.
  g.add(box(1.16, 0.05, 0.32, vehicleMat(0x2a2a2e, 1), 0, roof, -0.2));
  g.add(box(0.5, 0.15, 0.28, left, -0.29, roof + 0.05, -0.2));
  g.add(box(0.5, 0.15, 0.28, right, 0.29, roof + 0.05, -0.2));
  g.add(box(0.08, 0.15, 0.28, vehicleMat(0x2a2a2e, 1), 0, roof + 0.05, -0.2));
  let t = 0;
  const v: EmergencyVehicle = {
    group: g,
    flashing: false,
    tick(dt) {
      t += dt;
      const on = v.flashing ? 1 : 0;
      const phase = Math.floor(t * 6) % 2;
      left.emissiveIntensity = on * (phase ? 2.4 : 0.15);
      right.emissiveIntensity = on * (phase ? 0.15 : 2.4);
    },
  };
  return v;
}

export const CAR_COLOURS = [PALETTE.carRed, PALETTE.carBlue, PALETTE.carGrey, 0x5a6a4a, 0xc8c2b4, 0x6a5a48, 0x3a4a5a];

/** A single-deck city bus: tall, long and nearly flat-fronted, on the same loft as the cars. */
const BUS: Profile = {
  length: 9.0, width: 2.4, axles: [-3.0, 2.9], wheel: 0.48, lean: 0.12,
  roof: [[4.5, 1.0], [4.42, 1.6], [4.3, 2.75], [4.1, 2.95], [-4.3, 2.95], [-4.5, 2.7]],
  belt: 1.15, glass: [-4.1, 4.25], pillars: [-2.6, -1.0, 0.6, 2.2],
};

/** Night bus facing +z, pivot at ground centre, about 9 m long, with lit windows. */
export function bus(): Group {
  const paint = vehicleMat(0x3f6f9a);
  const g = mouldedVehicle('bus', BUS, paint, true, 0x8a8a86);
  // Dark glass split into windows by mullions; the lit saloon shows as a warm
  // ceiling strip, so the band never washes out to white in daylight.
  for (let z = -3.6; z <= 3.8; z += 1.25) for (const x of [-1.18, 1.18]) g.add(box(0.05, 1.5, 0.12, paint, x, 1.2, z));
  g.add(box(2.1, 0.1, 8.0, BUS_GLASS, 0, 2.62, 0));
  g.traverse((o) => { o.castShadow = true; });
  // Buses only ever drive: never a fixed obstacle (see car()).
  return g;
}
const BUS_GLASS = glowMat(0x2f3a52, 0xffe2b0, 0.35);

/** Regional train cars: a cab car with a raked nose, and plain middle cars. */
const TRAIN_CAB: Profile = {
  length: 16, width: 2.9, axles: [-6.1, 5.6], wheel: 0.46, lean: 0.06,
  roof: [[8, 1.0], [7.85, 1.9], [7.2, 3.35], [6.4, 3.7], [-7.9, 3.7], [-8, 3.45]],
  belt: 1.25, glass: [-7.3, 6.9], pillars: [-4.6, -3.4, 2.4, 3.6],
};
const TRAIN_CAR: Profile = {
  length: 16, width: 2.9, axles: [-6.1, 6.1], wheel: 0.46, lean: 0.06,
  roof: [[8, 3.45], [7.9, 3.7], [-7.9, 3.7], [-8, 3.45]],
  belt: 1.25, glass: [-7.3, 7.3], pillars: [-4.6, -3.4, 3.4, 4.6],
};
const TRAIN_GLASS = glowMat(0x26303c, 0xffe2b0, 0.3);

/**
 * A regional train facing +z: `cars` cars, cab cars at both ends, pivot at
 * the ground centre of the first car's middle; cars follow towards -z.
 */
export function train(cars: number): Group {
  const g = new Group();
  const paint = vehicleMat(0xd8d4c8);
  const stripe = vehicleMat(0x2e7d6b, 1);
  const dark = vehicleMat(0x2a2c30, 1);
  for (let i = 0; i < cars; i++) {
    const cab = i === 0 || i === cars - 1;
    const car = mouldedVehicle(cab ? 'trainCab' : 'trainCar', cab ? TRAIN_CAB : TRAIN_CAR, paint, i === 0, 0x3a3a3c);
    car.traverse((o) => { o.castShadow = true; });
    // Window mullions on both sides, so the glass reads as a row of windows; a lamp-lit
    // saloon shows as a warm strip along the ceiling.
    for (let z = -7; z <= 7; z += 1.5) for (const x of [-1.46, 1.46]) car.add(box(0.05, 1.9, 0.14, paint, x, 1.3, z));
    car.add(box(2.6, 0.12, 14.2, TRAIN_GLASS, 0, 3.15, 0));
    // The last cab car runs backwards, nose to the rear.
    if (i === cars - 1 && i > 0) car.rotation.y = Math.PI;
    car.position.z = -i * 16.4;
    // Livery stripe under the windows, skirts over the bogies, a gangway to the next car.
    car.add(box(2.94, 0.28, 15.2, stripe, 0, 0.92, 0));
    car.add(box(2.7, 0.45, 15.4, dark, 0, 0.18, 0));
    if (i < cars - 1) car.add(box(1.6, 2.6, 0.5, dark, 0, 0.7, i === cars - 1 ? 8.1 : -8.1));
    g.add(car);
  }
  // A pantograph on the lead car's roof.
  const pan = new Group();
  pan.position.set(0, 3.7, -2);
  pan.add(box(0.08, 0.9, 0.08, dark, -0.4, 0, 0), box(0.08, 0.9, 0.08, dark, 0.4, 0, 0));
  pan.add(box(1.6, 0.06, 0.12, dark, 0, 0.9, 0));
  g.add(pan);
  return g;
}
