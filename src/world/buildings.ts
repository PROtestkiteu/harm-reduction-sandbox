import { CylinderGeometry, ConeGeometry, Group, Mesh, PointLight, Vector3 } from 'three';
import { PALETTE } from '../config/palette';
import type { LocationId } from '../sim/types';
import type { Random } from '../sim/random';
import { DoorState, WindowBank, approach } from './animated';
import { add, bench, bin, box, cylinder, planter, signBoard, stanchion } from './kit';
import { acUnit, antenna, crateStack, drainpipe, fireEscape, flowerPot, railing, roofVent, satelliteDish, solarPanel, stringLights, windowTrim } from './details';
import { CAMPER, CENTER, CLUB, SPOTS } from './layout';
import { glowMat, mat, vehicleMat } from './materials';
import { dynamic, mergeStatic } from './mergeStatic';
import { mouldedVehicle, type Profile } from './vehicles';

/** Visual side of a selectable location. Simulation state drives it each frame. */
export interface LocationVisual {
  readonly id: LocationId;
  readonly root: Group;
  /** World point the HTML label hangs from (above it, or below with `labelBelow`). */
  readonly labelAnchor: Vector3;
  readonly labelBelow?: boolean;
  /** Ground footprint centre and radius for the selection ring. */
  readonly footprint: { x: number; z: number; rx: number; rz: number };
  /** 0 = service switched off and packed away, 1 = staffed and lit. */
  setServiceLevel(level: number): void;
  openDoor(): void;
  update(dt: number, time: number): void;
}

// Drop-in centre: two-storey plaster building, warm storefront, green canopy,
// covered waiting benches beside the entrance.

export function buildDropIn(random: Random): LocationVisual {
  const root = new Group();
  root.name = 'dropIn';
  const { x0, x1, z0, z1 } = CENTER;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const w = x1 - x0;
  const d = z1 - z0;

  add(root, box(w + 0.12, 0.45, d + 0.12, mat(PALETTE.plasterShade), cx, 0, cz));
  add(root, box(w, 6.8, d, mat(PALETTE.plaster), cx, 0, cz));
  add(root, box(w + 0.2, 0.28, d + 0.2, mat(PALETTE.centerAccent), cx, 3.45, cz));
  add(root, box(w + 0.24, 0.42, d + 0.24, mat(PALETTE.roofTrim), cx, 6.8, cz));
  add(root, box(2.2, 1.0, 1.6, mat(PALETTE.concrete), x1 - 2.2, 7.22, z0 + 1.6));
  add(root, box(0.9, 0.6, 0.9, mat(PALETTE.metal), x1 - 4.2, 7.22, z0 + 1.2));

  // Ground-floor storefront glazing shares one warm material driven by service level.
  const storefront = glowMat(PALETTE.glassDark, PALETTE.warmWindow, 0.2);
  const lobby = glowMat(PALETTE.warmWindowDim, PALETTE.warmWindow, 0.3);
  const frame = mat(PALETTE.frame);
  add(root, box(1.5, 2.1, 0.08, storefront, 3.95, 0.8, z1 + 0.02));
  add(root, box(5.9, 2.2, 0.08, storefront, 9.85, 0.75, z1 + 0.02));
  for (const x of [6.9, 8.85, 10.85, 12.8]) add(root, box(0.1, 2.3, 0.12, frame, x, 0.7, z1 + 0.04));
  add(root, box(5.9, 0.1, 0.14, frame, 9.85, 2.95, z1 + 0.04));

  // Entrance: lobby glow behind sliding glass doors.
  add(root, box(1.7, 2.45, 0.05, lobby, SPOTS.centerDoor.x, 0.45, z1 + 0.01));
  const doorGlass = mat(PALETTE.glassDark);
  const doorL = add(root, dynamic(box(0.84, 2.35, 0.06, doorGlass, SPOTS.centerDoor.x - 0.42, 0.45, z1 + 0.07)));
  const doorR = add(root, dynamic(box(0.84, 2.35, 0.06, doorGlass, SPOTS.centerDoor.x + 0.42, 0.45, z1 + 0.07)));
  add(root, box(2.0, 0.28, 0.14, frame, SPOTS.centerDoor.x, 2.8, z1 + 0.06));
  add(root, box(0.12, 2.4, 0.14, frame, SPOTS.centerDoor.x - 0.94, 0.45, z1 + 0.06));
  add(root, box(0.12, 2.4, 0.14, frame, SPOTS.centerDoor.x + 0.94, 0.45, z1 + 0.06));

  // Canopy, light strip and pixel sign over the door.
  add(root, box(3.4, 0.16, 1.7, mat(PALETTE.centerAccent), SPOTS.centerDoor.x, 2.98, z1 + 0.85));
  const strip = glowMat(0xfff1d8, PALETTE.warmWindow, 0.4);
  add(root, box(3.0, 0.05, 0.14, strip, SPOTS.centerDoor.x, 2.93, z1 + 1.6));
  const sign = signBoard('DROP-IN', 3.0, 0.72, '#fff4dc', '#2f5f53', 0.4);
  add(root, sign.mesh).position.set(SPOTS.centerDoor.x, 3.14, z1 + 1.66);

  // Upper floor windows switch independently.
  const upperMats = [0, 1, 2, 3].map(() => glowMat(PALETTE.glassDark, PALETTE.warmWindow, 0.2));
  [3.9, 5.9, 7.9, 9.9, 11.9].forEach((x, i) => {
    add(root, box(1.2, 1.45, 0.08, upperMats[i % 4], x, 4.25, z1 + 0.02));
    add(root, box(1.4, 0.1, 0.2, mat(PALETTE.concrete), x, 4.15, z1 + 0.08));
  });
  [-9.3, -11.4, -13.5].forEach((z, i) => {
    add(root, box(0.08, 1.45, 1.2, upperMats[(i + 2) % 4], x1 + 0.02, 4.25, z));
    add(root, box(0.08, 1.9, 1.5, storefront, x1 + 0.02, 0.9, z));
    add(root, box(0.2, 0.1, 1.4, mat(PALETTE.concrete), x1 + 0.08, 4.15, z));
  });
  // Street-facing west wall and the rear wall, revealed when the camera orbits.
  [-9.0, -11.0, -13.0].forEach((z, i) => {
    add(root, box(0.08, 1.45, 1.2, upperMats[(i + 1) % 4], x0 - 0.02, 4.25, z));
    add(root, windowTrim(1.2, 1.45), -Math.PI / 2).position.set(x0 - 0.02, 4.25, z);
    add(root, box(0.08, 1.6, 1.4, storefront, x0 - 0.02, 0.9, z));
    add(root, windowTrim(1.4, 1.6), -Math.PI / 2).position.set(x0 - 0.02, 0.9, z);
  });
  [4.6, 7.6, 10.6].forEach((x, i) => {
    add(root, box(1.2, 1.45, 0.08, upperMats[(i + 3) % 4], x, 4.25, z0 - 0.02));
    add(root, windowTrim(1.2, 1.45), Math.PI).position.set(x, 4.25, z0 - 0.02);
  });
  add(root, box(1.1, 2.2, 0.08, mat(PALETTE.frame), 12.2, 0.45, z0 - 0.03));
  add(root, drainpipe(6.9), Math.PI).position.set(x0 + 0.2, 0, z0 - 0.08);
  const upper = new WindowBank(upperMats, 1.25, 0.08, random);

  // Waiting area: shallow wall awning (keeps seated people visible), benches, planter.
  add(root, box(5.4, 0.12, 0.95, mat(PALETTE.canvasTeal), 9.6, 2.7, z1 + 0.47));
  add(root, box(5.4, 0.22, 0.06, mat(PALETTE.canvasCream), 9.6, 2.5, z1 + 0.95));
  add(root, bench()).position.set(8.15, 0.12, -6.95);
  add(root, bench()).position.set(10.35, 0.12, -6.95);
  add(root, planter(1.6, 0.6)).position.set(12.2, 0.12, -5.9);
  add(root, bin()).position.set(3.4, 0.12, -6.9);
  // Notice board beside the door, with pinned leaflets.
  add(root, box(0.9, 1.1, 0.06, mat(PALETTE.canvasCream), 3.95, 1.0, -7.4));
  [[3.75, 1.55, 0xb87a5a], [4.12, 1.6, 0x5f8f7f], [3.8, 1.15, 0xd2b36a], [4.15, 1.2, 0x7a8fa6]].forEach(([x, y, c]) =>
    add(root, box(0.26, 0.3, 0.02, mat(c), x, y, -7.36)));

  // Facade detail: window trim, drainpipes, wall-mounted units, entrance pots.
  [3.9, 5.9, 7.9, 9.9, 11.9].forEach((x) => add(root, windowTrim(1.2, 1.45)).position.set(x, 4.25, z1 + 0.02));
  [-9.3, -11.4, -13.5].forEach((z) => add(root, windowTrim(1.2, 1.45), Math.PI / 2).position.set(x1 + 0.02, 4.25, z));
  add(root, drainpipe(6.9)).position.set(x0 + 0.15, 0, z1 + 0.08);
  add(root, drainpipe(6.9)).position.set(x1 - 0.12, 0, z1 + 0.08);
  add(root, drainpipe(6.9), Math.PI / 2).position.set(x1 + 0.08, 0, z0 + 0.4);
  add(root, acUnit(), Math.PI / 2).position.set(x1 + 0.3, 2.35, -12.45);
  add(root, box(0.06, 0.12, 0.3, mat(PALETTE.metal), x1 + 0.06, 2.3, -12.45));
  add(root, flowerPot(0xf0d070)).position.set(4.45, 0.12, -7.2);
  add(root, flowerPot(0xe0a0b8)).position.set(6.75, 0.12, -7.2);
  add(root, box(1.5, 0.02, 0.8, mat(PALETTE.centerAccent), SPOTS.centerDoor.x, 0.12, z1 + 0.45));
  add(root, box(0.42, 0.5, 0.04, mat(PALETTE.canvasCream), 7.15, 1.45, z1 + 0.04));
  for (const [x, z] of [[3.5, -8.2], [12.2, -8.6]] as const) add(root, flowerPot(0xe8e0f0, 0.9)).position.set(x, 7.22, z);

  // Roof: parapet rail, solar array, plant equipment, dish.
  add(root, railing(w - 0.4, 0.75)).position.set(cx, 7.22, z1 - 0.15);
  add(root, railing(d - 0.4, 0.75), Math.PI / 2).position.set(x1 - 0.15, 7.22, cz);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) add(root, solarPanel()).position.set(4.0 + i * 1.15, 7.22, -13.6 + j * 1.75);
  add(root, acUnit()).position.set(9.6, 7.22, -11.4);
  add(root, acUnit()).position.set(10.6, 7.22, -11.4);
  add(root, roofVent()).position.set(7.6, 7.22, -9.0);
  add(root, roofVent()).position.set(12.6, 7.22, -14.0);
  add(root, satelliteDish(), Math.PI / 4).position.set(12.4, 7.22, -10.2);
  add(root, box(0.4, 0.15, 3.0, mat(PALETTE.metal), 8.0, 7.4, -12.7));

  const light = new PointLight(PALETTE.warmWindow, 0, 9, 1.4);
  light.position.set(SPOTS.centerDoor.x + 1.5, 2.4, z1 + 1.4);
  root.add(light);

  mergeStatic(root);
  const door = new DoorState();
  let level = 0;
  let target = 0;

  return {
    id: 'dropIn',
    root,
    labelAnchor: new Vector3(cx, 7.8, cz),
    footprint: { x: cx, z: cz + 1.6, rx: w / 2 + 1, rz: d / 2 + 2.4 },
    setServiceLevel: (v) => { target = v; },
    openDoor: () => door.request(),
    update(dt) {
      level = approach(level, target, 1.6, dt);
      storefront.emissiveIntensity = 0.12 + 1.1 * level;
      lobby.emissiveIntensity = 0.15 + 1.2 * level;
      strip.emissiveIntensity = 0.1 + 1.6 * level;
      sign.material.emissiveIntensity = 0.15 + 0.85 * level;
      light.intensity = 9 * level;
      upper.update(dt, 0.15 + 0.7 * level);
      const o = door.update(dt) * 0.74;
      doorL.position.x = SPOTS.centerDoor.x - 0.42 - o;
      doorR.position.x = SPOTS.centerDoor.x + 0.42 + o;
    },
  };
}

// Club: dark box with restrained neon strip, side entrance with a swinging
// door, roped queue lane, and a pop-up harm reduction stand on the terrace.

export function buildClub(random: Random): LocationVisual & { setVenueBeat(level: number): void } {
  const root = new Group();
  root.name = 'club';
  const { x0, x1, z0, z1, height } = CLUB;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const w = x1 - x0;
  const d = z1 - z0;
  const doorZ = SPOTS.clubDoor.z;

  add(root, box(w + 0.1, 0.4, d + 0.1, mat(PALETTE.clubTrim), cx, 0, cz));
  add(root, box(w, height, d, mat(PALETTE.clubWall), cx, 0, cz));
  add(root, box(w + 0.24, 0.36, d + 0.24, mat(PALETTE.clubTrim), cx, height, cz));
  add(root, box(1.8, 0.9, 1.4, mat(PALETTE.metal), cx - 1.2, height + 0.36, cz - 2.5));
  add(root, box(1.2, 0.7, 1.2, mat(PALETTE.concrete), cx + 1.4, height + 0.36, cz + 2.8));

  const neon = glowMat(0x8a4a74, PALETTE.clubMagenta, 0.9);
  add(root, box(0.06, 0.12, d - 0.4, neon, x1 + 0.03, 4.75, cz));
  add(root, box(w - 0.4, 0.12, 0.06, neon, cx, 4.75, z1 + 0.03));

  // Small high windows pulse slowly with the music, in two restrained hues.
  const winA = glowMat(0x2a2840, PALETTE.clubMagenta, 0.6);
  const winB = glowMat(0x2a2840, PALETTE.clubTeal, 0.6);
  [-6.6, -5.0, 0.2, 1.7].forEach((z, i) => add(root, box(0.08, 0.7, 0.8, i % 2 ? winA : winB, x1 + 0.02, 3.45, z)));
  [-13.4, -11.5, -9.7].forEach((x, i) => add(root, box(0.8, 0.7, 0.08, i % 2 ? winB : winA, x, 3.45, z1 + 0.02)));

  // Posters on the street-facing wall.
  [0xb87a5a, 0x5a7aa0, 0xa0a06a].forEach((c, i) => add(root, box(0.9, 1.25, 0.05, mat(c), -13.3 + i * 1.6, 0.9, z1 + 0.03)));

  // Entrance.
  const doorway = glowMat(0x5a2f4a, 0xff9ac8, 0.9);
  add(root, box(0.05, 2.4, 1.6, doorway, x1 + 0.01, 0.4, doorZ));
  const hinge = add(root, dynamic(new Group()));
  hinge.position.set(x1 + 0.05, 0.4, doorZ - 0.8);
  add(hinge, box(0.08, 2.35, 1.58, mat(PALETTE.frame), 0, 0, 0.79));
  add(root, box(0.16, 0.32, 2.0, mat(PALETTE.clubTrim), x1 + 0.06, 2.8, doorZ));
  add(root, box(1.3, 0.14, 2.6, mat(PALETTE.clubTrim), x1 + 0.65, 3.0, doorZ));
  const canopyGlow = glowMat(0xffd6ea, PALETTE.clubMagenta, 1.2);
  add(root, box(0.1, 0.05, 2.4, canopyGlow, x1 + 1.25, 2.95, doorZ));
  const sign = signBoard('CLUB', 1.9, 0.62, '#ffe6f2', '#2a2238', 0.9);
  add(root, sign.mesh, Math.PI / 2).position.set(x1 + 0.08, 3.3, doorZ);

  // Queue lane: stanchions with ropes along the kerb side of the pavement.
  const rope = mat(0x7a3a5e);
  const ropeX = -6.4;
  const posts = [-1.9, -0.25, 1.4, 3.05];
  posts.forEach((z) => add(root, stanchion()).position.set(ropeX, 0.12, z));
  add(root, box(0.04, 0.04, posts[posts.length - 1] - posts[0], rope, ropeX, 0.95, (posts[0] + posts[posts.length - 1]) / 2));

  const doorLight = new PointLight(0xe58ac0, 6, 7, 1.5);
  doorLight.position.set(x1 + 1.1, 2.5, doorZ);
  root.add(doorLight);

  // Harm reduction stand: a pop-up gazebo that unfolds when staffed.
  const stand = add(root, dynamic(new Group()));
  stand.name = 'clubStand';
  const sx = (SPOTS.standStaff[0].x + SPOTS.standStaff[1].x) / 2;
  const sz = 5.0;
  stand.position.set(sx, 0.12, sz);
  const legs: Mesh[] = [];
  for (const [lx, lz] of [[-1.3, -0.75], [1.3, -0.75], [-1.3, 0.75], [1.3, 0.75]]) legs.push(add(stand, cylinder(0.05, 1, mat(PALETTE.metal), 4, lx, 0, lz)));
  const roof = add(stand, new Group());
  const pyramid = new Mesh(new ConeGeometry(1, 0.6, 4).rotateY(Math.PI / 4).translate(0, 0.3, 0), mat(PALETTE.canvasTeal));
  pyramid.scale.set(1.95, 1, 1.2);
  pyramid.castShadow = true;
  roof.add(pyramid);
  add(roof, box(2.75, 0.24, 1.7, mat(PALETTE.canvasTeal), 0, -0.24, 0));
  const table = add(stand, box(2.4, 0.82, 0.6, mat(PALETTE.canvasCream), 0, 0, 0.3));
  const items = add(stand, new Group());
  items.position.set(0, 0.82, 0.3);
  const waterMat = glowMat(0x9fc8e0, 0x9fd8f0, 0.35);
  add(items, new Mesh(new CylinderGeometry(0.15, 0.15, 0.45, 6).translate(0, 0.22, 0), waterMat)).position.set(-0.85, 0, 0);
  add(items, box(0.5, 0.35, 0.14, mat(PALETTE.staffVest), 0.1, 0, -0.08));
  add(items, box(0.3, 0.06, 0.22, mat(0xe8d07a), 0.75, 0, 0.05));
  const info = signBoard('INFO', 0.9, 0.32, '#f4fff9', '#2f6e66', 0.5);
  add(stand, info.mesh).position.set(0, 0.42, 0.61);
  const standLight = new PointLight(0xc8f0e4, 0, 6, 1.4);
  standLight.position.set(0, 2.0, 0.6);
  stand.add(standLight);
  add(root, planter(2.2, 0.6)).position.set(-13.3, 0.12, 7.4);
  add(root, bin()).position.set(-8.9, 0.12, 4.0);

  // Terrace festoon lights from the club wall to a timber pole by the planter.
  const pole: [number, number] = [-14.1, 7.95];
  add(root, box(0.14, 3.9, 0.14, mat(PALETTE.timber), pole[0], 0.12, pole[1]));
  const bulbs = [glowMat(0xffe8b0, 0xffc47a, 1.3), glowMat(0xffd0e4, 0xe88ab8, 1.1), glowMat(0xd0f0e8, 0x7ad0c0, 1.1)];
  add(root, stringLights([
    [-9.0, 4.3, z1 + 0.05, pole[0], 3.95, pole[1]],
    [-11.6, 4.5, z1 + 0.05, pole[0], 3.95, pole[1]],
    [-14.3, 4.3, z1 + 0.05, pole[0], 3.95, pole[1]],
  ], bulbs));

  // Club detail: fire escape, drainpipes, vents, crates, rooftop plant.
  add(root, fireEscape(height)).position.set(-14.05, 0, z1);
  add(root, drainpipe(height + 0.3)).position.set(x1 - 0.12, 0, z1 + 0.08);
  add(root, drainpipe(height + 0.3), Math.PI / 2).position.set(x1 + 0.08, 0, z0 + 0.3);
  for (const z of [-6.0, -4.6]) add(root, box(0.06, 0.45, 0.7, mat(PALETTE.metal), x1 + 0.03, 1.1, z));
  for (const z of [-6.0, -4.6]) for (let y = 1.16; y < 1.5; y += 0.1) add(root, box(0.08, 0.03, 0.64, mat(PALETTE.frame), x1 + 0.04, y, z));
  add(root, crateStack(random), Math.PI / 2).position.set(x1 + 0.3, 0.12, z0 + 0.6);
  add(root, box(0.5, 0.5, 4.2, mat(PALETTE.metal), cx - 1.2, height + 0.36, cz + 0.4));
  add(root, roofVent()).position.set(cx + 1.6, height + 0.36, cz - 1.2);
  add(root, roofVent()).position.set(cx - 2.4, height + 0.36, cz + 3.6);
  add(root, antenna(2.2)).position.set(cx + 2.2, height + 0.36, cz - 4.2);
  for (let i = 0; i < 3; i++) add(root, box(0.5, 0.7, 0.05, mat([0xd06aa8, 0x58c2b8, 0xd2b36a][i]), -13.25 + i * 1.6, 2.25, z1 + 0.04));

  mergeStatic(root);
  const door = new DoorState();
  // Back walls: high vents, a fire exit and rooftop access ladder.
  for (const z of [-6.0, -2.0, 1.6]) add(root, box(0.06, 0.5, 0.8, mat(PALETTE.metal), x0 - 0.03, 3.6, z));
  add(root, box(0.08, 2.2, 1.2, mat(PALETTE.clubTrim), x0 - 0.04, 0.4, -4.0));
  add(root, box(0.1, 0.12, 1.4, glowMat(0x6a3a3a, 0x60e090, 0.8), x0 - 0.06, 2.75, -4.0));
  for (const x of [-13.0, -10.4]) add(root, box(0.8, 0.5, 0.06, mat(PALETTE.metal), x, 3.6, z0 - 0.03));
  add(root, drainpipe(height + 0.3), -Math.PI / 2).position.set(x0 - 0.08, 0, z0 + 0.3);
  const windowBank = new WindowBank([winA, winB], 1.0, 0.35, random);
  let level = 0;
  let target = 0;
  let beat = 1;

  return {
    id: 'club',
    root,
    labelAnchor: new Vector3(cx, height + 1.2, cz),
    footprint: { x: cx + 1, z: cz + 2, rx: w / 2 + 1.6, rz: d / 2 + 2.8 },
    setServiceLevel: (v) => { target = v; },
    setVenueBeat: (v) => { beat = v; },
    openDoor: () => door.request(1.1),
    update(dt, time) {
      level = approach(level, target, 1.4, dt);
      const pulse = 0.5 + 0.5 * Math.sin(time * 2.1);
      neon.emissiveIntensity = 0.65 + 0.25 * pulse * beat;
      windowBank.update(dt, 0.7 * beat);
      hinge.rotation.y = door.update(dt) * 1.25;
      doorLight.intensity = 5 + 2.5 * door.openness;
      // Stand unfolds: legs extend, roof rises, table items appear, light comes on.
      const h = 0.95 + 1.35 * level;
      legs.forEach((l) => { l.scale.y = h; });
      roof.position.y = h;
      table.scale.y = 0.35 + 0.65 * level;
      items.position.y = 0.82 * table.scale.y;
      items.scale.setScalar(Math.max(0.001, level));
      info.material.emissiveIntensity = 0.05 + 0.6 * level;
      standLight.intensity = 6 * level;
    },
  };
}

// Outreach camper: high-roof van parked in the lane, service hatch and awning
// on the pavement side, folding table outside.

/** The camper's side profile: a high-roof panel van, about 6.4 m long. */
const CAMPER_MID = 4.45;
const CAMPER_BODY: Profile = {
  length: 6.4, width: 2.2, axles: [-2.15, 2.05], wheel: 0.38, lean: 0.25,
  roof: [[3.2, 0.82], [3.08, 1.02], [2.7, 1.18], [2.15, 2.2], [1.75, 2.95], [1.4, 3.05], [-3.1, 3.08], [-3.2, 2.85]],
  belt: 1.3, glass: [1.5, 2.6], pillars: [],
  opening: [2.9 - CAMPER_MID, 4.9 - CAMPER_MID],
};

export function buildCamper(): LocationVisual {
  const root = new Group();
  root.name = 'outreach';
  root.position.set(CAMPER.x, 0.02, 0);
  const body = vehicleMat(PALETTE.camperBody);
  const zMid = 3.65;

  // Moulded high-roof van on the same loft as the street's cars, with the
  // service window left open on the pavement side (z 2.9..4.9).
  const van = add(root, mouldedVehicle('camper', CAMPER_BODY, body, false));
  van.position.z = CAMPER_MID;
  const stripe = mat(PALETTE.camperStripe);
  add(root, box(0.03, 0.22, 5.4, stripe, 1.105, 0.9, 4.2));
  add(root, box(0.03, 0.22, 5.4, stripe, -1.105, 0.9, 4.2));
  const interior = glowMat(PALETTE.warmWindowDim, PALETTE.outreachGlow, 0.2);
  add(root, box(0.04, 1.6, 2.4, interior, -0.95, 1.2, 3.9));
  add(root, box(1.9, 0.08, 4.6, mat(PALETTE.timber), 0, 1.25, 3.9));
  add(root, box(0.4, 0.07, 2.0, mat(PALETTE.timber), 1.26, 1.3, 3.9));

  // Rear ladder, roof vent and skylight.
  for (const x of [-0.75, -0.35]) add(root, box(0.04, 2.3, 0.04, mat(PALETTE.metal), x, 0.75, CAMPER.z0 - 0.1));
  for (let y = 1.0; y < 3.0; y += 0.32) add(root, box(0.44, 0.03, 0.04, mat(PALETTE.metal), -0.55, y, CAMPER.z0 - 0.1));
  add(root, box(0.7, 0.16, 0.7, mat(PALETTE.concrete), -0.3, 3.1, 1.9));
  add(root, box(0.6, 0.1, 0.9, glowMat(PALETTE.glassDark, PALETTE.outreachGlow, 0.1), -0.3, 3.1, 5.2));

  // Roof sign readable over the awning.
  const sign = signBoard('OUTREACH', 2.7, 0.5, '#fff6e4', '#3c7a72', 0.4);
  add(root, sign.mesh, Math.PI / 2).position.set(0.7, 3.18, 3.9);

  // Hatch hinged at the top of the window, swings up to shade the counter.
  const hatch = add(root, dynamic(new Group()));
  hatch.position.set(1.07, 2.82, 3.9);
  add(hatch, box(0.05, 1.48, 2.06, body, 0, -1.48, 0));

  // Awning: cassette fixed to the roof edge, fabric rolls out to the pavement.
  add(root, box(0.16, 0.16, 5.0, mat(PALETTE.metal), 1.16, 2.86, 3.7));
  const awning = add(root, dynamic(new Group()));
  awning.position.set(1.16, 2.9, 3.7);
  const fabric = add(awning, new Group());
  fabric.rotation.z = -0.1;
  add(fabric, box(2.1, 0.06, 4.8, mat(PALETTE.canvasTeal), 1.05, 0, 0));
  add(fabric, box(0.06, 0.22, 4.8, mat(PALETTE.canvasCream), 2.08, -0.22, 0));
  const awningLegs = [1.6, 5.8].map((z) => add(root, dynamic(cylinder(0.035, 2.72, mat(PALETTE.metal), 4, 3.2, 0.02, z))));

  // Folding table with leaflets and water outside the rear of the van.
  add(root, box(0.6, 0.75, 1.1, mat(PALETTE.canvasCream), 2.15, 0.1, 2.3));
  const tableItems = add(root, dynamic(new Group()));
  tableItems.position.set(2.15, 0.85, 2.3);
  add(tableItems, box(0.3, 0.32, 0.4, mat(PALETTE.staffVest), 0, 0, -0.2));
  add(tableItems, cylinder(0.12, 0.38, glowMat(0x9fc8e0, 0x9fd8f0, 0.3), 6, 0, 0, 0.3));

  const light = new PointLight(PALETTE.outreachGlow, 0, 8, 1.4);
  light.position.set(2.0, 2.3, 3.9);
  root.add(light);
  mergeStatic(root);

  let level = 0;
  let target = 0;

  return {
    id: 'outreach',
    root,
    labelAnchor: new Vector3(CAMPER.x - 0.6, 0.1, CAMPER.z1 + 2.2),
    labelBelow: true,
    footprint: { x: CAMPER.x + 1.2, z: zMid + 0.6, rx: 2.8, rz: 4.2 },
    setServiceLevel: (v) => { target = v; },
    openDoor: () => {},
    update(dt) {
      level = approach(level, target, 1.3, dt);
      hatch.rotation.z = level * 1.45;
      fabric.scale.x = Math.max(0.04, level);
      const legsOut = Math.max(0, (level - 0.85) / 0.15);
      awningLegs.forEach((l) => { l.scale.y = Math.max(0.001, legsOut); });
      tableItems.scale.setScalar(Math.max(0.001, level));
      interior.emissiveIntensity = 0.1 + 1.1 * level;
      sign.material.emissiveIntensity = 0.15 + 0.7 * level;
      light.intensity = 8 * level;
    },
  };
}
