import type { WalkInServiceId } from '../sim/types';
import { t } from '../i18n';
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

/** The club, the drop-in centre and the camper as designed, before they are placed on a site. */
export const HOME_CLUB = { x0: -14.6, x1: -8.5, z0: -8, z1: 3, height: 5.6 };
export const HOME_CENTER = { x0: 2.8, x1: 13.2, z0: -14.6, z1: -7.5 };
export const HOME_CAMPER = { x: -1.75, z0: 1.2, z1: 7.6 };

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

/**
 * A placement: the point `home` of a design maps to (x, z), turned by `rot`
 * about y (the same sense as Object3D.rotation.y).
 */
export interface Frame { x: number; z: number; rot: number; home: P2 }

export function toWorld(f: Frame, q: P2): P2 {
  const dx = q.x - f.home.x;
  const dz = q.z - f.home.z;
  const c = Math.cos(f.rot);
  const s = Math.sin(f.rot);
  return { x: f.x + dx * c + dz * s, z: f.z - dx * s + dz * c };
}
const turn = (f: Frame, d: P2): P2 => {
  const c = Math.cos(f.rot);
  const s = Math.sin(f.rot);
  return { x: d.x * c + d.z * s, z: -d.x * s + d.z * c };
};

/**
 * The six building sites of the district, each a front edge on a pavement
 * (`front` is its middle) with room `along` the street and `depth` behind it,
 * and the walk node in front of it. Every launch deals the club, the drop-in
 * and the four walk-in services out over them at random.
 */
const SITES = {
  centreWest: { front: p(-8.5, 0), face: '+x', along: 16.4, depth: 10 },
  centreEast: { front: p(8, -4.6), face: '+z', along: 10.4, depth: 10 },
  west: { front: p(-9.2, -33.5), face: '+x', along: 17, depth: 11.8 },
  north: { front: p(12, -25.6), face: '+z', along: 18, depth: 14 },
  southWest: { front: p(-9.2, 34), face: '+x', along: 18, depth: 12.8 },
  east: { front: p(20.8, 34), face: '+x', along: 18, depth: 16.8 },
} as const satisfies Record<string, { front: P2; face: '+x' | '+z'; along: number; depth: number }>;
type SiteId = keyof typeof SITES;
type Venue = 'club' | 'dropIn' | WalkInServiceId;
const VENUES: Venue[] = ['club', 'dropIn', 'pharmacy', 'drugChecking', 'shelter', 'clinic'];

/** Each design's own front middle, facing and size, as built. */
const DESIGN: Record<'club' | 'dropIn', { front: P2; face: '+x' | '+z'; along: number; depth: number }> = {
  club: { front: p(-8.5, 0), face: '+x', along: 16.4, depth: 6.3 },
  dropIn: { front: p(8, -4.6), face: '+z', along: 10.4, depth: 10 },
};

const fits = (v: Venue, site: SiteId) => v === 'club' || v === 'dropIn' ? SITES[site].along >= DESIGN[v].along && SITES[site].depth >= DESIGN[v].depth : true;

const SITE_OF: Record<Venue, SiteId> = (() => {
  const ids = Object.keys(SITES) as SiteId[];
  for (;;) {
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    if (VENUES.every((v, i) => fits(v, ids[i]))) return Object.fromEntries(VENUES.map((v, i) => [v, ids[i]])) as Record<Venue, SiteId>;
  }
})();

/** Turn from one facing to another: +z to +x is a quarter turn one way, +x to +z the other. */
const rotBetween = (from: '+x' | '+z', to: '+x' | '+z') => (from === to ? 0 : from === '+z' ? Math.PI / 2 : -Math.PI / 2);

/** Where the club and the drop-in stand this launch. */
export const VENUE_FRAME: Record<'club' | 'dropIn', Frame> = {
  club: { ...SITES[SITE_OF.club].front, rot: rotBetween(DESIGN.club.face, SITES[SITE_OF.club].face), home: DESIGN.club.front },
  dropIn: { ...SITES[SITE_OF.dropIn].front, rot: rotBetween(DESIGN.dropIn.face, SITES[SITE_OF.dropIn].face), home: DESIGN.dropIn.front },
};

/** A site's local frame: facade towards local +z, local +x along it, origin at the front middle. */
const siteFrame = (site: SiteId): Frame => ({ ...SITES[site].front, rot: rotBetween('+z', SITES[site].face), home: p(0, 0) });

/** The ground a venue of `along` by `depth` covers on a site, behind its front edge. */
function rectOn(site: SiteId, along: number, depth: number): Rect {
  const { front, face } = SITES[site];
  return face === '+x'
    ? r(front.x - depth, front.x, front.z - along / 2, front.z + along / 2)
    : r(front.x - along / 2, front.x + along / 2, front.z - depth, front.z);
}

const HEIGHT: Record<WalkInServiceId, number> = { pharmacy: 7.2, drugChecking: 6.4, shelter: 9.6, clinic: 10.8 };
function lotFor(id: WalkInServiceId): PlaceLot {
  const site = SITE_OF[id];
  const f = siteFrame(site);
  const along = Math.min(SITES[site].along, 13);
  // On the centre's east site a walk-in leaves the forecourt and its path clear.
  const depth = site === 'centreEast' ? 7.1 : Math.min(SITES[site].depth, 12);
  return {
    rect: rectOn(site, along, depth),
    face: SITES[site].face,
    height: HEIGHT[id],
    door: toWorld(f, p(-1, 0.2)),
    inside: toWorld(f, p(-1, -2.5)),
    queueHead: toWorld(f, p(0.3, 1.0)),
    queueDir: turn(f, p(1, 0)),
  };
}

export const LOTS: Record<WalkInServiceId, PlaceLot> = {
  pharmacy: lotFor('pharmacy'),
  drugChecking: lotFor('drugChecking'),
  shelter: lotFor('shelter'),
  clinic: lotFor('clinic'),
};

/** The ground every venue covers this launch: other buildings keep clear of it. */
export const VENUE_RECTS: readonly Rect[] = [
  rectOn(SITE_OF.club, DESIGN.club.along, DESIGN.club.depth),
  rectOn(SITE_OF.dropIn, DESIGN.dropIn.along, DESIGN.dropIn.depth),
  ...Object.values(LOTS).map((l) => l.rect),
];

/** Which way the club's and the drop-in's fronts face this launch. */
export const VENUE_FACE = { club: SITES[SITE_OF.club].face, dropIn: SITES[SITE_OF.dropIn].face };

/** True when the club and the drop-in stand where they were designed: the street's cables run between them. */
export const VENUES_AT_HOME = SITE_OF.club === 'centreWest' && SITE_OF.dropIn === 'centreEast';

/** The A&E entrance and its ambulance bay, in the clinic's site frame. */
export const AE_ALONG = 4;
/** Where the ambulance waits outside A&E: only the east street has a lane for it. */
export const AMBULANCE_BAY: P2 | null = SITE_OF.clinic === 'east' ? toWorld(siteFrame('east'), p(AE_ALONG, 4.6)) : null;

/**
 * Where an outreach camper can stand: kerbside spots off the traffic lane.
 * `x`, `z` is the van's middle; `rot` turns it so the counter faces the pavement.
 */
const CAMPER_SITES: readonly { name: string; x: number; z: number; rot: number }[] = [
  { name: t('Main street, by the centre'), x: HOME_CAMPER.x, z: (HOME_CAMPER.z0 + HOME_CAMPER.z1) / 2, rot: 0 },
  { name: t('Main street, north end'), x: HOME_CAMPER.x, z: -31.6, rot: 0 },
  { name: t('Main street, south end'), x: HOME_CAMPER.x, z: 32.4, rot: 0 },
  { name: t('North street, by the north lot'), x: 14, z: -17.9, rot: -Math.PI / 2 },
  { name: t('South street, by the park'), x: 12, z: 20.1, rot: -Math.PI / 2 },
  { name: t('East street, towards the river'), x: 28.1, z: -6, rot: 0 },
];
const CAMPER_AT = Math.floor(Math.random() * CAMPER_SITES.length);
/** One kerb spot, not the camper's, is in front of a squat this launch. */
export const SQUAT_SPOT = (CAMPER_AT + 1 + Math.floor(Math.random() * (CAMPER_SITES.length - 1))) % CAMPER_SITES.length;
/**
 * Every kerb spot, by a fixed index for this launch: the first camper stands
 * at one (`camperSpot`), extra campers at others.
 */
export const CAMPER_SPOTS: readonly { name: string; x: number; z: number; rot: number }[] = CAMPER_SITES.map((spot, i) =>
  i === SQUAT_SPOT ? { ...spot, name: t('By the squat, {street}', { street: spot.name.split(',')[0] }) } : spot);
let camperAt = CAMPER_AT;
/** The kerb spot the first camper stands at now. */
export const camperSpot = (): number => camperAt;
/** Where the outreach camper parks now; moving it changes this in place. */
export const CAMPER_FRAME: Frame = { ...CAMPER_SPOTS[CAMPER_AT], home: p(HOME_CAMPER.x, (HOME_CAMPER.z0 + HOME_CAMPER.z1) / 2) };
/** How far each moved venue is turned, for people who face something there. */
export const VENUE_ROT = { club: VENUE_FRAME.club.rot, dropIn: VENUE_FRAME.dropIn.rot, outreach: CAMPER_FRAME.rot };

/** Spots as designed, in the designs' own coordinates. */
export const HOME_SPOTS = {
  clubDoor: p(-8.3, -2.4),
  clubInside: p(-10.2, -2.4),
  clubQueueHead: p(-7.15, -1.5),
  clubExit: p(-7.3, -3.4),

  // A third staff member (sandbox lever) works from the back of the gazebo.
  standStaff: [p(-11.75, 4.55), p(-10.45, 4.55), p(-11.1, 3.95)],
  standCounter: [p(-11.75, 5.95), p(-10.45, 5.95), p(-11.1, 6.6)],
  standQueueHead: p(-9.3, 6.4),
  /** Where club-goers come off the street to the stand. */
  standApproach: p(-9.6, 7.6),

  centerDoor: p(5.6, -7.4),
  centerInside: p(5.6, -9.4),
  centerFront: p(5.6, -5.6),
  centerGreeter: p(4.2, -6.7),
  centerSeats: [p(7.75, -6.85), p(8.55, -6.85), p(9.95, -6.85), p(10.75, -6.85)],
  centerStanding: [p(7.4, -5.5), p(8.3, -5.3), p(9.4, -5.45), p(10.4, -5.3)],
  centerQueue: p(9.6, -5.0),

  camperCounters: [p(0.2, 3.9), p(0.2, 2.85)],
  camperQueueHead: p(0.25, 5.05),
  camperStaffInside: p(-1.55, 3.9),
  /** Outdoor posts for staff 1 and up; post 0 works inside the camper. */
  camperStaffOutside: [p(0.4, 1.4), p(1.3, 1.6), p(2.0, 2.4)],
  /** The camper's back door, and the pavement point staff walk to before it. */
  camperRear: p(HOME_CAMPER.x + 0.6, HOME_CAMPER.z0 - 0.5),
  camperRearApproach: p(0.6, HOME_CAMPER.z0 - 0.6),
} as const;

const club = (q: P2) => toWorld(VENUE_FRAME.club, q);
const drop = (q: P2) => toWorld(VENUE_FRAME.dropIn, q);
const van = (q: P2) => toWorld(CAMPER_FRAME, q);
const H = HOME_SPOTS;

/** Walk targets where everything stands this launch. */
export const SPOTS = {
  clubDoor: club(H.clubDoor),
  clubInside: club(H.clubInside),
  clubQueueHead: club(H.clubQueueHead),
  clubExit: club(H.clubExit),
  standStaff: H.standStaff.map(club),
  standCounter: H.standCounter.map(club),
  standQueueHead: club(H.standQueueHead),
  standApproach: club(H.standApproach),
  centerDoor: drop(H.centerDoor),
  centerInside: drop(H.centerInside),
  centerFront: drop(H.centerFront),
  centerGreeter: drop(H.centerGreeter),
  centerSeats: H.centerSeats.map(drop),
  centerStanding: H.centerStanding.map(drop),
  centerQueue: drop(H.centerQueue),
  camperCounters: H.camperCounters.map(van),
  camperQueueHead: van(H.camperQueueHead),
  camperStaffInside: van(H.camperStaffInside),
  camperStaffOutside: H.camperStaffOutside.map(van),
  camperRear: van(H.camperRear),
  camperRearApproach: van(H.camperRearApproach),
};

/** Queue slot positions run from a head spot along a direction. */
export function queueSlot(head: P2, dir: P2, spacing: number, index: number): P2 {
  return { x: head.x + dir.x * spacing * index, z: head.z + dir.z * spacing * index };
}
export const CLUB_QUEUE_DIR = turn(VENUE_FRAME.club, p(0, 1));
export const CAMPER_QUEUE_DIR = turn(CAMPER_FRAME, p(0, 1));
export const STAND_QUEUE_DIR = turn(VENUE_FRAME.club, p(1, 0.35));
export const CENTER_QUEUE_DIR = turn(VENUE_FRAME.dropIn, p(1, 0.15));

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
  wPharm: p(W, SITES.west.front.z),
  wN2: p(W, -EDGE),
  eN: p(E, NN),
  eN2: p(E, -EDGE),
  wS: p(W, SS),
  wShelter: p(W, SITES.southWest.front.z),
  wS2: p(W, EDGE),
  eS: p(E, SS),
  eS2: p(E, EDGE),

  // North cross street.
  nW: p(-EDGE, NN),
  nCheck: p(SITES.north.front.x, NN),
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
  clinicFront: p(X, SITES.east.front.z),
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

/** The street node in front of each site. */
const SITE_NODE: Record<SiteId, NodeId> = { centreWest: 'wClub', centreEast: 'pathCenter', west: 'wPharm', north: 'nCheck', southWest: 'wShelter', east: 'clinicFront' };
const nodeFor = (v: Venue): NodeId => {
  // The designs' own approaches where they stand at home.
  if (v === 'dropIn' && SITE_OF.dropIn === 'centreEast') return 'centerFront';
  return SITE_NODE[SITE_OF[v]];
};
/**
 * True when walking straight from `a` to `b` would cross a road away from a
 * zebra: people walk to a crossing instead.
 */
export function crossesRoad(a: P2, b: P2): boolean {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.5);
  for (let i = 1; i < steps; i++) {
    const x = a.x + ((b.x - a.x) * i) / steps;
    const z = a.z + ((b.z - a.z) * i) / steps;
    for (const s of Object.values(STREETS)) {
      const r = s.road;
      if (x <= r.x0 || x >= r.x1 || z <= r.z0 || z >= r.z1) continue;
      // On a zebra is fine: that is where people cross.
      const onMainZebra = s === STREETS.main && MAIN_CROSSINGS.some((c) => z >= c.z0 - 0.3 && z <= c.z1 + 0.3);
      if (!onMainZebra) return true;
    }
  }
  return false;
}

/** The walk node nearest a point that can reach it without crossing a road; the nearest of all if none can. */
export function nearestNodeTo(q: P2): NodeId {
  let best: NodeId | null = null;
  let bestD = Infinity;
  let any: NodeId = 'wCross';
  let anyD = Infinity;
  for (const id of Object.keys(NODES) as NodeId[]) {
    const d = Math.hypot(NODES[id].x - q.x, NODES[id].z - q.z);
    if (d < anyD) { anyD = d; any = id; }
    if (d < bestD && !crossesRoad(NODES[id], q)) { bestD = d; best = id; }
  }
  return best ?? any;
}

export const SERVICE_NODES: Record<'dropIn' | 'outreach' | 'clubHr' | 'club' | WalkInServiceId, NodeId> = {
  dropIn: nodeFor('dropIn'),
  outreach: nearestNodeTo(SPOTS.camperCounters[0]),
  clubHr: SITE_OF.club === 'centreWest' ? 'terrace' : nodeFor('club'),
  club: nodeFor('club'),
  pharmacy: nodeFor('pharmacy'),
  drugChecking: nodeFor('drugChecking'),
  shelter: nodeFor('shelter'),
  clinic: nodeFor('clinic'),
};

/**
 * Parks the first camper at kerb spot `i`: its frame, walk targets, queue
 * direction and street node all follow, in place, so everything that reads
 * them picks up the new spot.
 */
export function moveCamper(i: number): void {
  const spot = CAMPER_SPOTS[i];
  if (!spot) return;
  camperAt = i;
  CAMPER_FRAME.x = spot.x;
  CAMPER_FRAME.z = spot.z;
  CAMPER_FRAME.rot = spot.rot;
  SPOTS.camperCounters = H.camperCounters.map(van);
  SPOTS.camperQueueHead = van(H.camperQueueHead);
  SPOTS.camperStaffInside = van(H.camperStaffInside);
  SPOTS.camperStaffOutside = H.camperStaffOutside.map(van);
  SPOTS.camperRear = van(H.camperRear);
  SPOTS.camperRearApproach = van(H.camperRearApproach);
  Object.assign(CAMPER_QUEUE_DIR, turn(CAMPER_FRAME, p(0, 1)));
  VENUE_ROT.outreach = CAMPER_FRAME.rot;
  SERVICE_NODES.outreach = nearestNodeTo(SPOTS.camperCounters[0]);
}

/** Where the warming bus parks: the east street's kerb lane, clear of the camper spots. */
export const AID_BUS = p(28.1, 12);
