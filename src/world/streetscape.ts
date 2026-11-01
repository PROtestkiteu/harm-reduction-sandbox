import { Group, type Object3D } from 'three';
import { PALETTE } from '../config/palette';
import type { Random } from '../sim/random';
import { advertPillar, busShelter, manhole, postBox, signPost } from './details';
import { cableBundle, steamVent, utilityPole, type Steam } from './grit';
import { add, bench, bin, bollard, box, tree } from './kit';
import { AID_BUS, AMBULANCE_BAY, CAMPER_SPOTS, HALF, LOTS, MAIN_CROSSINGS, ROAD, SPOTS, STREETS, type Rect } from './layout';
import { glowMat, mat } from './materials';
import { mergeStatic } from './mergeStatic';
import { solid } from './solids';
import { car, CAR_COLOURS } from './vehicles';

/**
 * Street life for the new streets: tree rows in pits along the kerbs, parked
 * cars in the kerb lanes, bus shelters, a kiosk, benches, bins and corner
 * bollards. Everything keeps clear of zebras, junctions, lamp posts, the
 * service entrances and the ambulance bay, so nothing hides a queue or a door.
 */

/** Spans along each street that must stay clear: junctions and zebras. */
const roads = Object.values(STREETS).map((s) => s.road);
const doors = [...Object.values(LOTS).map((l) => l.door), SPOTS.clubDoor, SPOTS.clubQueueHead, SPOTS.standQueueHead, SPOTS.centerDoor, SPOTS.centerQueue];

function blocked(x: number, z: number, pad: number): boolean {
  // Junctions: a point inside two roads' extended corridors.
  const inX = roads.filter((q) => z > q.z0 - pad && z < q.z1 + pad && q.x1 - q.x0 > 20);
  const inZ = roads.filter((q) => x > q.x0 - pad && x < q.x1 + pad && q.z1 - q.z0 > 20);
  if (inX.length && inZ.length) return true;
  if (x > ROAD.x0 - 3 && x < ROAD.x1 + 3 && MAIN_CROSSINGS.some((c) => z > c.z0 - pad && z < c.z1 + pad)) return true;
  if (doors.some((d) => Math.hypot(d.x - x, d.z - z) < 4.5)) return true;
  // Every kerb spot a camper can park at, and the warming bus's.
  if (CAMPER_SPOTS.some((c) => Math.hypot(c.x - x, c.z - z) < 6)) return true;
  if (Math.hypot(AID_BUS.x - x, AID_BUS.z - z) < 7) return true;
  if (AMBULANCE_BAY && Math.hypot(AMBULANCE_BAY.x - x, AMBULANCE_BAY.z - z) < 5) return true;
  // The original centre block keeps its own hand-placed street.
  return Math.abs(x) < HALF + 1 && Math.abs(z) < HALF + 1;
}

/** Positions every `step` metres along a strip's length, jittered a little. */
function along(q: Rect, axis: 'x' | 'z', step: number, random: Random, start = 0): number[] {
  const [a, b] = axis === 'x' ? [q.x0, q.x1] : [q.z0, q.z1];
  const out: number[] = [];
  for (let v = a + 3 + start; v < b - 3; v += step) out.push(v + (random() - 0.5) * 1.2);
  return out;
}

/**
 * A yellow parcel locker (paczkomat): a cabinet of small doors with a screen
 * and keypad in the middle, long along local x, its doors facing local +z.
 */
function parcelLocker(): Group {
  const g = new Group();
  const yellow = mat(0xf2c400);
  const seam = mat(0x8a7000);
  add(g, box(2.6, 1.9, 0.6, yellow, 0, 0, 0));
  add(g, box(2.7, 0.08, 0.68, mat(0x2a2a2a), 0, 1.9, 0));
  // Rows and columns of small doors, drawn as seams on the face.
  for (const x of [-0.9, -0.45, 0.45, 0.9]) add(g, box(0.02, 1.7, 0.02, seam, x, 0.1, 0.31));
  for (const y of [0.45, 0.85, 1.25, 1.6]) {
    add(g, box(0.8, 0.02, 0.02, seam, -0.85, y, 0.31));
    add(g, box(0.8, 0.02, 0.02, seam, 0.85, y, 0.31));
  }
  // The middle column: screen, keypad, a scanner light.
  add(g, box(0.6, 1.8, 0.04, mat(0x3a3a3a), 0, 0.05, 0.31));
  add(g, box(0.42, 0.3, 0.02, glowMat(0x10202a, 0x6ad0ff, 0.9), 0, 1.25, 0.34));
  add(g, box(0.3, 0.24, 0.02, mat(0x1a1a1a), 0, 0.9, 0.34));
  return g;
}

export function buildStreetscape(scene: Object3D, random: Random): Steam[] {
  const g = add(scene, new Group());
  const pit = mat(0x2e2a24);

  // Tree rows on the kerb side of each pavement, offset from the lamps.
  for (const s of Object.values(STREETS)) {
    for (const pave of s.pavements) {
      const roadSide = s.along === 'z'
        ? (pave.x1 <= s.road.x0 + 0.01 ? pave.x1 - 0.55 : pave.x0 + 0.55)
        : (pave.z1 <= s.road.z0 + 0.01 ? pave.z1 - 0.55 : pave.z0 + 0.55);
      for (const v of along(pave, s.along, 9.5, random, 4)) {
        const [x, z] = s.along === 'z' ? [roadSide, v] : [v, roadSide];
        if (blocked(x, z, 2.5)) continue;
        add(g, box(1.0, 0.13, 1.0, pit, x, 0.0, z));
        const kind = random();
        add(g, tree((kind < 0.12 ? 2 : kind < 0.3 ? 3 : kind < 0.65 ? 0 : 1) as 0 | 1 | 2 | 3, 0.75 + random() * 0.25)).position.set(x, 0.13, z);
      }
    }
  }

  // Parked cars in one kerb lane of each cross street and of the east street
  // (the other lane carries through-traffic), and in the main street's
  // parking lane outside the centre block.
  const park = (x: number, z: number, rot: number) => {
    if (blocked(x, z, 3.5)) return;
    add(g, car(CAR_COLOURS[Math.floor(random() * CAR_COLOURS.length)], false), rot).position.set(x, 0.02, z);
  };
  for (const s of [STREETS.north, STREETS.south]) {
    for (const z of [s.road.z1 - 1.0]) {
      for (const x of along(s.road, 'x', 6.2, random)) if (random() < 0.55) park(x, z, Math.PI / 2 + (z < (s.road.z0 + s.road.z1) / 2 ? Math.PI : 0));
    }
  }
  for (const x of [STREETS.east.road.x1 - 1.0]) {
    for (const z of along(STREETS.east.road, 'z', 6.2, random)) if (random() < 0.5) park(x, z, x < 26 ? Math.PI : 0);
  }
  for (const z of along(STREETS.main.road, 'z', 6.2, random)) if (Math.abs(z) > HALF + 3 && random() < 0.6) park(ROAD.parkX, z, 0);

  // Bus shelters on the cross streets, a kiosk on a corner, a post box.
  const advert = glowMat(0xe0d2b4, 0xffe0b0, 0.4);
  add(g, busShelter(advert), Math.PI).position.set(-30, 0.12, -22.4);
  add(g, busShelter(advert), 0).position.set(36, 0.12, 22.3);
  add(g, busShelter(advert), Math.PI / 2).position.set(30.6, 0.12, -34);
  const kiosk = add(g, solid(new Group(), 2.3, 1.8));
  kiosk.position.set(-12, 0.12, 22.8);
  add(kiosk, box(2.0, 2.3, 1.4, mat(0x3f5a4a), 0, 0, 0));
  add(kiosk, box(2.3, 0.2, 1.8, mat(0x2a3a30), 0, 2.3, 0.1));
  add(kiosk, box(1.5, 0.9, 0.05, glowMat(0x2c3a44, 0xffd8a0, 0.9), 0, 1.0, 0.72));
  add(kiosk, box(1.8, 0.08, 0.5, mat(PALETTE.concrete), 0, 0.95, 0.95));
  add(g, postBox()).position.set(-9.2, 0.12, 20.0);
  add(g, advertPillar(glowMat(0xe0d2b4, 0xffe0b0, 0.35))).position.set(31.2, 0.12, 12.0);
  add(g, signPost(0x3f5f9a)).position.set(22.2, 0.12, -27.5);

  // Benches and bins along the pavements, facing the road.
  for (const [x, z, r] of [[-26, -23.4, Math.PI], [-36, 23.4, 0], [10, 23.4, 0], [40, -23.4, Math.PI], [31.4, -8, -Math.PI / 2], [31.4, 30, -Math.PI / 2]] as const) {
    if (blocked(x, z, 1)) continue;
    add(g, bench(), r).position.set(x, 0.12, z);
    add(g, bin()).position.set(x + 1.2, 0.12, z);
  }

  // Bollards at the corners of every junction.
  for (const s of [STREETS.north, STREETS.south]) {
    for (const zEdge of [s.road.z0 - 0.3, s.road.z1 + 0.3]) {
      for (const xEdge of [ROAD.x0 - 0.3, ROAD.x1 + 0.3, STREETS.east.road.x0 - 0.3, STREETS.east.road.x1 + 0.3]) {
        add(g, bollard()).position.set(xEdge, 0.12, zEdge);
      }
    }
  }
  // Leaning timber utility poles on the kerb side of the new streets, with
  // cable bundles sagging from pole to pole and across the junctions.
  const poles: [number, number, number][] = [];
  for (const s of [STREETS.north, STREETS.south]) {
    const z = s.road.z1 + 0.35;
    for (const x of along(s.road, 'x', 15, random, 2)) {
      if (blocked(x, z, 2)) continue;
      add(g, utilityPole(random), Math.PI / 2).position.set(x, 0.12, z);
      poles.push([x, 6.7, z]);
    }
  }
  for (const z of along(STREETS.east.road, 'z', 15, random, 5)) {
    const x = STREETS.east.road.x0 - 0.35;
    if (blocked(x, z, 2)) continue;
    add(g, utilityPole(random)).position.set(x, 0.12, z);
    poles.push([x, 6.7, z]);
  }
  for (let i = 1; i < poles.length; i++) {
    const [a, b] = [poles[i - 1], poles[i]];
    if (Math.hypot(a[0] - b[0], a[2] - b[2]) < 22) cableBundle(g, a, b, random, 2 + Math.floor(random() * 2));
  }
  // A few bundles straight across a road, from a pole to the far kerb's building line.
  for (const [x, z] of [[-30, -16.2], [12, 16.6], [40, 16.6], [-20, -16.2]] as const) {
    const s = z < 0 ? STREETS.north : STREETS.south;
    cableBundle(g, [x, 6.4, s.road.z1 + 0.35], [x + (random() - 0.5) * 6, 7.4, s.road.z0 - 3.5], random, 2);
  }
  // Parcel lockers on the building side of the pavements near the district's edges: one per stretch, five at most.
  let lockers = 0;
  for (const st of Object.values(STREETS)) {
    for (const pave of st.pavements) {
      if (lockers >= 5) break;
      const roadIsLow = st.along === 'z' ? pave.x0 >= st.road.x1 - 0.01 : pave.z0 >= st.road.z1 - 0.01;
      // Against the buildings: the pavement's far edge from the road.
      const back = st.along === 'z' ? (roadIsLow ? pave.x1 - 0.45 : pave.x0 + 0.45) : (roadIsLow ? pave.z1 - 0.45 : pave.z0 + 0.45);
      const spots = along(pave, st.along, 4, random).filter((v) => Math.abs(v) > 30 && Math.abs(v) < 42);
      for (const v of spots) {
        const [x, z] = st.along === 'z' ? [back, v] : [v, back];
        if (blocked(x, z, 2)) continue;
        const locker = add(g, parcelLocker());
        locker.position.set(x, 0.12, z);
        // Doors towards the road.
        locker.rotation.y = st.along === 'z' ? (roadIsLow ? -Math.PI / 2 : Math.PI / 2) : (roadIsLow ? Math.PI : 0);
        lockers++;
        break;
      }
    }
  }
  mergeStatic(g);

  // Steam drifting from a handful of manholes.
  const steam: Steam[] = [];
  for (const [x, z] of [[-20, -19], [16, 19.3], [26.8, -6], [-36, 18.6], [26.4, 30]] as const) {
    add(g, manhole()).position.set(x, 0.02, z);
    steam.push(steamVent(scene, x, z, random));
  }
  return steam;
}
