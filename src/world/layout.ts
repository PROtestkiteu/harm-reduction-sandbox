/**
 * District layout in metres: a 3x3-block neighbourhood about 90 m across.
 * The camera looks from +x/+z, so every facade that carries activity faces +x
 * or +z.
 *
 *   centre block (the original street, -15..15): club and harm reduction stand,
 *     drop-in centre, outreach camper, pocket park
 *   main street: one-way, along z at x -6..-0.5, through the whole district
 *   north and south cross streets along x; east street along z at x 24..29.5
 *   north-west: community pharmacy with needle and syringe programme
 *   north-middle: drug checking service
 *   south-west: night shelter and day centre
 *   south-middle: clinic (opioid treatment) with an A&E entrance on the east street
 */

export interface P2 { x: number; z: number }
const p = (x: number, z: number): P2 => ({ x, z });

/** The original street's half size; the camera's scale reference. */
export const HALF = 15;
/** District half size: the built area runs from -DISTRICT to DISTRICT. */
export const DISTRICT = 45;
/** Where walkers and cars appear and vanish, just past the district edge. */
export const EDGE = 46.5;

export interface Rect { x0: number; x1: number; z0: number; z1: number }
const r = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x0, x1, z0, z1 });

export const ROAD = { x0: -6, x1: -0.5, laneX: -4.4, parkX: -1.75 };
export const PAVE_W = { x0: -8.5, x1: -6 };
export const PAVE_E = { x0: -0.5, x1: 2.5 };
/** The centre zebra across the main street. */
export const CROSSING = { x0: -6, x1: -0.5, z0: -5, z1: -3 };

/**
 * Streets as road rects plus the pavement strips on each side. The main
 * street keeps the original centre-block geometry; the others are new.
 */
export const STREETS = {
  main: { road: r(ROAD.x0, ROAD.x1, -DISTRICT, DISTRICT), pavements: [r(PAVE_W.x0, PAVE_W.x1, -DISTRICT, DISTRICT), r(PAVE_E.x0, PAVE_E.x1, -DISTRICT, DISTRICT)], along: 'z' },
  north: { road: r(-DISTRICT, DISTRICT, -21.5, -16.5), pavements: [r(-DISTRICT, DISTRICT, -24, -21.5), r(-DISTRICT, DISTRICT, -16.5, -15)], along: 'x' },
  south: { road: r(-DISTRICT, DISTRICT, 16.5, 21.5), pavements: [r(-DISTRICT, DISTRICT, 15, 16.5), r(-DISTRICT, DISTRICT, 21.5, 24)], along: 'x' },
  east: { road: r(24, 29.5, -DISTRICT, DISTRICT), pavements: [r(21.5, 24, -DISTRICT, DISTRICT), r(29.5, 32, -DISTRICT, DISTRICT)], along: 'z' },
} as const satisfies Record<string, { road: Rect; pavements: Rect[]; along: 'x' | 'z' }>;

/** Zebra crossings on the main street, where cars give way (z ranges). */
export const MAIN_CROSSINGS: readonly { z0: number; z1: number }[] = [
  { z0: CROSSING.z0, z1: CROSSING.z1 },
  { z0: -23.75, z1: -21.75 },
  { z0: 21.75, z1: 23.75 },
];

/** Blocks between the streets, as ground rects. The centre block is the original street. */
export const BLOCKS = {
  nw: r(-DISTRICT, PAVE_W.x0, -DISTRICT, -24),
  nm: r(PAVE_E.x1, 21.5, -DISTRICT, -24),
  ne: r(32, DISTRICT, -DISTRICT, -24),
  cw: r(-DISTRICT, -HALF, -15, 15),
  cm: r(HALF, 21.5, -15, 15),
  ce: r(32, DISTRICT, -15, 15),
  sw: r(-DISTRICT, PAVE_W.x0, 24, DISTRICT),
  sm: r(PAVE_E.x1, 21.5, 24, DISTRICT),
  se: r(32, DISTRICT, 24, DISTRICT),
} as const satisfies Record<string, Rect>;

export const PAVEMENT_TOP = 0.12;
export const ROAD_TOP = 0.02;

const inRect = (x: number, z: number, q: Rect) => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1;

export function groundY(x: number, z: number): number {
  for (const s of Object.values(STREETS)) if (inRect(x, z, s.road)) return ROAD_TOP;
  return PAVEMENT_TOP;
}

export const CLUB = { x0: -14.6, x1: -8.5, z0: -8, z1: 3, height: 5.6 };
export const CENTER = { x0: 2.8, x1: 13.2, z0: -14.6, z1: -7.5 };
export const CAMPER = { x: -1.75, z0: 1.2, z1: 7.6 };

/**
 * Lots of the new ecosystem places. `face` is the street-facing side that
 * carries the entrance; `door`, `inside` and `queueHead` are walk targets.
 */
export interface PlaceLot {
  rect: Rect;
  face: '+x' | '+z';
  height: number;
  door: P2;
  inside: P2;
  queueHead: P2;
  queueDir: P2;
}

export const LOTS = {
  pharmacy: { rect: r(-21, -9.2, -37, -26), face: '+x', height: 7.2, door: p(-9.0, -30.5), inside: p(-11.5, -30.5), queueHead: p(-8.0, -29.4), queueDir: p(0, 1) },
  drugChecking: { rect: r(5, 17, -38, -25.6), face: '+z', height: 6.4, door: p(8.5, -25.4), inside: p(8.5, -28), queueHead: p(9.8, -24.7), queueDir: p(1, 0) },
  shelter: { rect: r(-22, -9.2, 27, 40), face: '+x', height: 9.6, door: p(-9.0, 32), inside: p(-11.5, 32), queueHead: p(-8.0, 33.2), queueDir: p(0, 1) },
  clinic: { rect: r(4, 20.8, 26, 42), face: '+x', height: 10.8, door: p(21.0, 30), inside: p(18.5, 30), queueHead: p(22.0, 28.8), queueDir: p(0, -1) },
} as const satisfies Record<string, PlaceLot>;

/** Where the ambulance waits outside A&E, in the east street's west lane. */
export const AMBULANCE_BAY = p(25.4, 37.5);

export const SPOTS = {
  clubDoor: p(-8.3, -2.4),
  clubInside: p(-10.2, -2.4),
  clubQueueHead: p(-7.15, -1.5),
  clubExit: p(-7.3, -3.4),

  // A third staff member (sandbox lever) works from the back of the gazebo.
  standStaff: [p(-11.75, 4.55), p(-10.45, 4.55), p(-11.1, 3.95)],
  standCounter: [p(-11.75, 5.95), p(-10.45, 5.95), p(-11.1, 6.6)],
  standQueueHead: p(-9.3, 6.4),

  centerDoor: p(5.6, -7.4),
  centerInside: p(5.6, -9.4),
  centerFront: p(5.6, -5.6),
  centerGreeter: p(4.2, -6.7),
  centerSeats: [p(7.75, -6.85), p(8.55, -6.85), p(9.95, -6.85), p(10.75, -6.85)],
  centerStanding: [p(7.4, -5.5), p(8.3, -5.3), p(9.4, -5.45), p(10.4, -5.3)],

  camperCounters: [p(0.2, 3.9), p(0.2, 2.85)],
  camperQueueHead: p(0.25, 5.05),
  camperStaffInside: p(-1.55, 3.9),
  /** Outdoor posts for staff 1 and up; post 0 works inside the camper. */
  camperStaffOutside: [p(0.4, 1.4), p(1.3, 1.6), p(2.0, 2.4)],
} as const;

/** Queue slot positions run from a head spot along a direction. */
export function queueSlot(head: P2, dir: P2, spacing: number, index: number): P2 {
  return { x: head.x + dir.x * spacing * index, z: head.z + dir.z * spacing * index };
}
export const CLUB_QUEUE_DIR = p(0, 1);
export const CAMPER_QUEUE_DIR = p(0, 1);
export const STAND_QUEUE_DIR = p(1, 0.35);

// Walkable graph. Long journeys follow pavement centrelines and cross roads at
// zebras; short moves inside an area (queues, seats, counters) go straight to a spot.

const W = -7.25; // main street, west pavement
const E = 1.75; // main street, east pavement
const NN = -22.75; // north cross street, north pavement
const NS = -15.75; // north cross street, south pavement
const SN = 15.75; // south cross street, north pavement
const SS = 22.75; // south cross street, south pavement
const X = 22.75; // east street, west pavement

export const NODES = {
  // Centre block, as before.
  wBack: p(W, NS),
  wCross: p(W, -4),
  wClub: p(W, -2.4),
  wTerrace: p(W, 5.2),
  wFront: p(W, SN),
  terrace: p(-9.6, 7.6),
  eBack: p(E, NS),
  eCross: p(1.2, -4),
  eCamper: p(E, 3.6),
  eJunction: p(E, 7.2),
  eFront: p(E, SN),
  pathCenter: p(5.6, -4),
  centerFront: p(5.6, -5.6),
  pathEast: p(X, -4),
  park: p(7.2, 8.4),
  parkEast: p(X, 9.2),
  parkFront: p(8.2, SN),

  // Main street north and south of the centre block.
  wN: p(W, NN),
  wPharm: p(W, LOTS.pharmacy.door.z),
  wN2: p(W, -EDGE),
  eN: p(E, NN),
  eN2: p(E, -EDGE),
  wS: p(W, SS),
  wShelter: p(W, LOTS.shelter.door.z),
  wS2: p(W, EDGE),
  eS: p(E, SS),
  eS2: p(E, EDGE),

  // North cross street.
  nW: p(-EDGE, NN),
  nCheck: p(LOTS.drugChecking.door.x, NN),
  nEast: p(X, NN),
  nE: p(EDGE, NN),
  nsEast: p(X, NS),

  // South cross street.
  sW: p(-EDGE, SS),
  sEast: p(X, SS),
  sE: p(EDGE, SS),
  snEast: p(X, SN),

  // East street, west pavement.
  xN2: p(X, -EDGE),
  clinicFront: p(X, LOTS.clinic.door.z),
  xS2: p(X, EDGE),
} as const;

export type NodeId = keyof typeof NODES;

export const EDGES: [NodeId, NodeId][] = [
  // Centre block.
  ['wBack', 'wCross'], ['wCross', 'wClub'], ['wClub', 'wTerrace'], ['wTerrace', 'wFront'], ['wTerrace', 'terrace'],
  ['wCross', 'eCross'],
  ['eBack', 'eCross'], ['eCross', 'eCamper'], ['eCamper', 'eJunction'], ['eJunction', 'eFront'],
  ['eCross', 'pathCenter'], ['pathCenter', 'centerFront'], ['pathCenter', 'pathEast'],
  ['eJunction', 'park'], ['park', 'parkEast'], ['park', 'parkFront'],
  // Main street: pavements, plus zebras across the cross streets and across the main road.
  ['wN2', 'wPharm'], ['wPharm', 'wN'], ['wN', 'wBack'], ['wN', 'eN'], ['eN2', 'eN'], ['eN', 'eBack'],
  ['wFront', 'wS'], ['wS', 'wShelter'], ['wShelter', 'wS2'], ['wS', 'eS'], ['eFront', 'eS'], ['eS', 'eS2'],
  // North cross street pavements.
  ['nW', 'wN'], ['eN', 'nCheck'], ['nCheck', 'nEast'], ['nEast', 'nE'], ['eBack', 'nsEast'],
  // South cross street pavements.
  ['sW', 'wS'], ['eS', 'sEast'], ['sEast', 'sE'], ['eFront', 'parkFront'], ['parkFront', 'snEast'],
  // East street, west pavement, crossing both cross streets.
  ['xN2', 'nEast'], ['nEast', 'nsEast'], ['nsEast', 'pathEast'], ['pathEast', 'parkEast'], ['parkEast', 'snEast'],
  ['snEast', 'sEast'], ['sEast', 'clinicFront'], ['clinicFront', 'xS2'],
];

export const ENTRY_NODES: NodeId[] = ['wN2', 'eN2', 'wS2', 'eS2', 'nW', 'nE', 'sW', 'sE', 'xN2', 'xS2'];

export const SERVICE_NODES = {
  dropIn: 'centerFront',
  outreach: 'eCamper',
  clubHr: 'terrace',
  club: 'wClub',
  pharmacy: 'wPharm',
  drugChecking: 'nCheck',
  shelter: 'wShelter',
  clinic: 'clinicFront',
} as const satisfies Record<string, NodeId>;
