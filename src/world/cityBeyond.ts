import { Box3, CanvasTexture, CircleGeometry, SRGBColorSpace, ConeGeometry, CylinderGeometry, TorusGeometry, Group, IcosahedronGeometry, Mesh, PlaneGeometry, Vector3, type Material, MeshLambertMaterial, type Object3D } from 'three';
import { fillCityBlock } from './infill';
import { PALETTE } from '../config/palette';
import type { Random } from '../sim/random';
import { WindowBank } from './animated';
import { bench, box, cylinder, gableRoof, add, pixelTextTexture, streetLight, tree } from './kit';
import { registerBuilding } from './cityBuildings';
import { DISTRICT, FESTIVAL, GROW, POLICE_STATION, ROAD, STADIUM, STATION_CAMP, STREETS, type Rect } from './layout';
import { buildEventGrounds, type EventGrounds } from './eventGrounds';
import { glowMat, mat, softMat } from './materials';
import { dynamic, mergeStatic } from './mergeStatic';
import { car, train as trainModel } from './vehicles';
import { acUnit, antenna, drainpipe, roofVent, satelliteDish, windowTrim } from './details';
import { riverMaterial } from './puddles';
import { BRIDGE_SPAN, bridgeSlope, bridgeY } from './bridges';
import { CAMPUS } from '../config/flavour/campus';
import { createRandom } from '../sim/random';
import { curtainWall } from './curtainWall';

const TOWER_TINTS = [0x9ab8c0, 0xa8b0bc, 0xc0aa90, 0x90a8b8];
import { instance, type Kits, type Placement } from './kits';

/**
 * The city around the district, so it no longer floats in a void:
 *
 * - east: a river in a stone embankment, with a promenade and two bridges;
 * - south: a big park with lawns, paths, a pond, a fountain and a playground;
 * - north: a train line with a station and a moving train, office towers behind;
 * - west: the old town, narrow gabled houses round a market square and a church;
 * - north-west: a wooded hill with a lookout tower;
 * - the other corners: low residential streets.
 *
 * The camera looks from the south-east, so everything east and south stays low
 * and never hides the district; height goes north and west. All of it merges
 * into a few meshes per material; only the train and lit windows move.
 */
export interface CityBeyond {
  windows: WindowBank[];
  update(dt: number): void;
  /** Swaps in the kits' trees and buildings once they have loaded, and dresses the park. */
  applyKits(kits: Kits): void;
  /** Building ids of the public hospital, the sobering-up centre and the other landmarks, for their cards. */
  landmarks: { hospital: number; sobering: number; police: number; cityHall: number; stadium: number; festival: number };
  /** Ordinary housing on the university's site, hidden while the campus pack shows the university. */
  campusSite: Object3D;
  /** The streets of the street grid out to the skyline: x holds those running along z. For the outer traffic. */
  streets: { x: Rect[]; z: Rect[] };
  /** Where the train is along x, front to back, or null while it is off the line. For the level crossings. */
  trainSpan(): readonly [number, number] | null;
  /** The festival grounds and the stadium: their lights follow what is on. */
  events: EventGrounds;
}

/** True when (x, z) is on the festival grounds (with `pad` metres round them): the park keeps its trees and bushes off it. */
const onFestival = (x: number, z: number, pad = 2) => x > FESTIVAL.x0 - pad && x < FESTIVAL.x1 + pad && z > FESTIVAL.z0 - pad && z < FESTIVAL.z1 + pad;

const EDGE = DISTRICT + 2;
/**
 * Tops of the flat ground layers, a centimetre or more apart and never
 * overlapping their neighbours, so the depth test cannot flicker between them.
 * The base ground is at -0.10 and the outskirts roads at -0.005.
 */
const LAYER = { water: -0.08, grass: -0.07, promenade: -0.06, path: -0.045 } as const;

/** A flat ground patch whose top is at `top`. */
function flat(g: Object3D, w: number, d: number, m: Material, x: number, z: number, top: number): void {
  add(g, box(w, 0.01, d, m, x, top - 0.01, z));
}
/**
 * The tallest a building may be at (x, z): low next to the district, taller
 * further out, so that from any side the camera can turn to (down to 15
 * degrees) nothing out here hides the district.
 */
export function heightCap(x: number, z: number): number {
  const d = Math.max(0, Math.max(Math.abs(x), Math.abs(z)) - DISTRICT - 2);
  return 6 + 0.3 * d;
}

/** The river runs north to south east of the district. */
const RIVER = { x0: 56 + GROW, x1: 76 + GROW };
/** The railway runs east to west north of the district. */
export const RAIL_Z = -64 - GROW;

export function buildCityBeyond(scene: Object3D, random: Random): CityBeyond {
  const g = add(scene, new Group());
  // The simple trees go in their own group: hidden when the kit's trees arrive.
  treeSpots.length = 0;
  // Kept out of the scene-wide merge (dynamic), so it can be hidden as a whole.
  treeGroup = add(scene, dynamic(new Group()));
  farTreeGroup = add(scene, dynamic(new Group()));
  const lit = Array.from({ length: 8 }, () => glowMat(0x20242a, PALETTE.warmWindow, 0.7));
  const cool = Array.from({ length: 6 }, () => glowMat(0x1e242c, PALETTE.coolWindow, 0.8));
  // The far blocks' floor bands, cut into windows by small shared textures: same draw calls as plain bands.
  const strip = (m: MeshLambertMaterial, tex: CanvasTexture) => Object.assign(m, { map: tex, emissiveMap: tex, alphaTest: 0.5 });
  const farLit = [0, 1, 2].map(() => strip(glowMat(0x20242a, PALETTE.warmWindow, 0.7), windowStrip(8, random, true)));
  const farCool = [strip(glowMat(0x1e242c, PALETTE.coolWindow, 0.8), windowStrip(8, random, true))];
  farWindows = { lit: farLit, cool: farCool, dark: new MeshLambertMaterial({ color: 0x2a3038, map: windowStrip(8, random, false), alphaTest: 0.5 }) };
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];

  // Keeps things off the roads that run on from the district into the city.
  const onRoad = (x: number, z: number, w: number, d: number) =>
    Object.values(STREETS).some((s) => {
      const q = s.road;
      const along = s.along === 'z';
      const x0 = along ? q.x0 : -400;
      const x1 = along ? q.x1 : 400;
      const z0 = along ? -400 : q.z0;
      const z1 = along ? 400 : q.z1;
      return x + w / 2 > x0 - 2 && x - w / 2 < x1 + 2 && z + d / 2 > z0 - 2 && z - d / 2 < z1 + 2;
    });

  buildRiver(g, random);
  buildPark(g, random, onRoad);
  const events = buildEventGrounds(g);
  const station = buildRailway(g);
  const landmarks = buildLandmarks(g, lit);
  const towerGlass: MeshLambertMaterial[] = [];
  const towers = buildTowers(g, random, towerGlass, onRoad);
  buildOldTown(g, random, lit, pick, onRoad);
  buildHill(g, random);
  // Every block site out to the skyline is built on, unless something already
  // stands there: a lattice of 26 m blocks with 6 m streets, heights rising
  // with distance from the district.
  // Blocks stay separate meshes (not merged into one city-wide mesh), so the
  // camera skips every block outside the view: cheap when zoomed in.
  const blocksGroup = add(scene, dynamic(new Group()));
  const { sites, streets } = lattice(towers, random);
  buildStreets(add(scene, dynamic(new Group())), streets);
  // A few sites, spread round the city, are kept for the kit's buildings; until
  // the kit loads they are built like the rest, in a group of their own.
  const kitSites: Rect[] = [];
  for (let i = sites.length - 1; i >= 0 && kitSites.length < 10; i -= 5) {
    const r = sites[i];
    if (r.x1 - r.x0 >= 14 && r.z1 - r.z0 >= 14) kitSites.push(...sites.splice(i, 1));
  }
  buildHousing(blocksGroup, random, lit, cool, sites, 3.2, 24);
  const kitFallback = add(scene, dynamic(new Group()));
  buildHousing(kitFallback, random, lit, cool, kitSites, 3.2, 24);
  kitFallback.traverse((o) => { o.castShadow = false; });
  // The university's site keeps its own housing (own random, so the rest of the city is the same either way).
  const campusSite = add(scene, dynamic(new Group()));
  const half = { x: (CAMPUS.x0 + CAMPUS.x1) / 2, z: (CAMPUS.z0 + CAMPUS.z1) / 2 };
  buildHousing(campusSite, createRandom(613), lit, cool, [
    { x0: CAMPUS.x0, x1: half.x - 2.5, z0: CAMPUS.z0, z1: half.z - 2.5 }, { x0: half.x + 2.5, x1: CAMPUS.x1, z0: CAMPUS.z0, z1: half.z - 2.5 },
    { x0: CAMPUS.x0, x1: half.x - 2.5, z0: half.z + 2.5, z1: CAMPUS.z1 }, { x0: half.x + 2.5, x1: CAMPUS.x1, z0: half.z + 2.5, z1: CAMPUS.z1 },
  ], 3.2, 24);
  campusSite.traverse((o) => { o.castShadow = false; });
  blocksGroup.traverse((o) => { o.castShadow = false; });
  // The skyline merges by 80 m cell for the same reason.
  const sky = new Map<string, Group>();
  buildSkyline((x, z) => {
    const key = `${Math.floor(x / 80)},${Math.floor(z / 80)}`;
    let cell = sky.get(key);
    if (!cell) { cell = add(scene, dynamic(new Group())); sky.set(key, cell); }
    return cell;
  }, random, lit, cool);
  for (const cell of sky.values()) {
    mergeStatic(cell);
    cell.traverse((o) => { o.castShadow = false; });
  }
  for (const t of [treeGroup, farTreeGroup]) if (t) { mergeStatic(t); t.traverse((o) => { o.castShadow = false; }); }
  const simpleTrees = treeGroup;
  treeGroup = farTreeGroup = null;
  mergeStatic(g);
  // Out here shadows would cost a second pass over the whole city for
  // almost nothing on screen: the far city does not cast them.
  g.traverse((o) => { o.castShadow = false; });

  return {
    windows: [new WindowBank(lit, 0.75, 0.05, random), new WindowBank(cool, 0.9, 0.08, random), new WindowBank(towerGlass, 0.95, 0.75, random), new WindowBank([...farLit, ...farCool], 0.8, 0.1, random)],
    update: (dt) => station.update(dt),
    landmarks: { ...landmarks, ...events.ids },
    campusSite,
    streets,
    trainSpan: () => station.span(),
    events,
    applyKits(kits) {
      // Trees: the kit's, instanced, on the simple trees' spots.
      const broad = ['CommonTree_1', 'CommonTree_2', 'CommonTree_3'].map((n) => kits.piece(n)).filter(Boolean) as Object3D[];
      const pines = ['Pine_1', 'Pine_3'].map((n) => kits.piece(n)).filter(Boolean) as Object3D[];
      if (broad.length && pines.length && simpleTrees) {
        const groups = new Map<Object3D, Placement[]>();
        for (const t of treeSpots) {
          const set = t.evergreen ? pines : broad;
          const piece = set[Math.floor(random() * set.length)];
          const list = groups.get(piece) ?? [];
          list.push({ x: t.x, y: t.y, z: t.z, rot: random() * Math.PI * 2, scale: 0.45 * t.s });
          groups.set(piece, list);
        }
        for (const [piece, at] of groups) instance(scene, piece, at);
        simpleTrees.visible = false;
      }
      // Bushes, flowers and grass through the big park, clear of its paths and pond.
      const scatter = (names: string[], count: number, scale: number) => {
        const pieces = names.map((n) => kits.piece(n)).filter(Boolean) as Object3D[];
        if (!pieces.length) return;
        const groups = new Map<Object3D, Placement[]>();
        for (let i = 0; i < count; i++) {
          const x = -44 - GROW + random() * (92 + 2 * GROW);
          const z = 52 + GROW + random() * 64;
          if (Math.abs(z - PARK_PATH_Z - 0.6) < 2.5 || Math.abs(x - 12.6) < 2.5 || Math.hypot((x - 34) / 13, (z - POND_Z) / 9) < 1) continue;
          if (Math.abs(x - (ROAD.x0 + ROAD.x1) / 2) < 6 || (x > 21 && x < 33) || onFestival(x, z)) continue;
          const piece = pieces[i % pieces.length];
          const list = groups.get(piece) ?? [];
          list.push({ x, y: LAYER.grass, z, rot: random() * Math.PI * 2, scale: scale * (0.8 + random() * 0.4) });
          groups.set(piece, list);
        }
        for (const [piece, at] of groups) instance(scene, piece, at);
      };
      scatter(['Bush_Common', 'Bush_Common_Flowers'], 70, 0.8);
      scatter(['Flower_3_Group', 'Flower_4_Group'], 90, 0.8);
      scatter(['Grass_Common_Short', 'Fern_1'], 120, 0.9);
      // Buildings: the kit's, one per kept site, sized to the site and facing its longer street side.
      const buildings = ['Building_Small_1', 'Building_Medium_2_001', 'Building_Large_2'].map((n) => kits.piece(n)).filter(Boolean) as Object3D[];
      if (buildings.length && kitSites.length) {
        const size = new Vector3();
        const groups = new Map<Object3D, Placement[]>();
        kitSites.forEach((r, i) => {
          const piece = buildings[i % buildings.length];
          new Box3().setFromObject(piece).getSize(size);
          const w = r.x1 - r.x0 - 2;
          const d = r.z1 - r.z0 - 2;
          const turn = (w >= d) !== (size.x >= size.z);
          const fw = turn ? size.z : size.x;
          const fd = turn ? size.x : size.z;
          const scale = Math.min(w / fw, d / fd, heightCap((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2) / size.y);
          const list = groups.get(piece) ?? [];
          list.push({ x: (r.x0 + r.x1) / 2, y: 0.12, z: (r.z0 + r.z1) / 2, rot: (turn ? Math.PI / 2 : 0) + (random() < 0.5 ? 0 : Math.PI), scale });
          groups.set(piece, list);
        });
        for (const [piece, at] of groups) instance(scene, piece, at);
        kitFallback.visible = false;
      }
    },
  };
}

// ------------------------------------------------------------------ river

function buildRiver(g: Object3D, random: Random): void {
  const stone = mat(0x6e6a62);
  const paving = mat(PALETTE.pavementAlt);
  const grass = mat(PALETTE.grassDark);
  const w = RIVER.x1 - RIVER.x0;
  // Long enough to run past the widest view at both ends (traffic and boats go out to 340 m).
  const len = 690;
  // Water a hair above the ground plane, walled in by stone embankments; it mirrors the promenade lamps
  // (heads 0.85 m out on their arms from posts 1 m off the bank, every 20 m from z = -115, 4.07 m up).
  const river = add(g, dynamic(new Mesh(new PlaneGeometry(w, len).rotateX(-Math.PI / 2), riverMaterial(RIVER.x0 - 1.85, -115, 20, 4.07))));
  river.position.set((RIVER.x0 + RIVER.x1) / 2, LAYER.water, 0);
  for (const x of [RIVER.x0, RIVER.x1]) add(g, box(0.6, 0.5, len, stone, x, -0.1, 0));
  // Promenade on the city side: paving, a lamp and a tree every so often, benches facing the water.
  flat(g, RIVER.x0 - EDGE - 2.3, len, paving, (EDGE + 2 + RIVER.x0 - 0.3) / 2, 0, LAYER.promenade);
  for (let z = -150; z <= 150; z += 10) {
    if (Math.abs(z - (STREETS.north.road.z0 + STREETS.north.road.z1) / 2) < 6 || Math.abs(z - (STREETS.south.road.z0 + STREETS.south.road.z1) / 2) < 6 || Math.abs(z - RAIL_Z) < 6) continue;
    add(g, tree((z / 10) % 2 ? 0 : 3, 0.9 + random() * 0.3)).position.set(RIVER.x0 - 3.5, 0, z);
    if ((z / 10) % 2) add(g, bench(), Math.PI / 2).position.set(RIVER.x0 - 1.4, 0, z + 4);
    else add(g, streetLight(-1).group).position.set(RIVER.x0 - 1.0, 0, z + 5);
  }
  // Far bank: a strip of meadow.
  flat(g, 5.7, len, grass, RIVER.x1 + 3.15, 0, LAYER.grass);
  // Road bridges where the cross streets meet the river: low arches
  // (world/bridges.ts), tall enough at mid-span for the boats to pass under,
  // built from short deck sections along the curve, with railings and stone
  // abutments on each bank. Cars follow the same curve.
  const deck = mat(0x5a5650);
  const rail = mat(PALETTE.metal);
  const STEP = 1;
  for (const s of [STREETS.north, STREETS.south]) {
    const z0 = s.road.z0 - 2.5;
    const z1 = s.road.z1 + 2.5;
    const cz = (z0 + z1) / 2;
    for (let x = BRIDGE_SPAN.x0; x < BRIDGE_SPAN.x1; x += STEP) {
      const mx = x + STEP / 2;
      const tilt = Math.atan(bridgeSlope(mx));
      const len = STEP / Math.cos(tilt) + 0.04;
      const top = bridgeY(mx);
      const section = add(g, box(len, 0.45, z1 - z0, deck, 0, -0.45, 0));
      const holder = add(g, new Group());
      holder.position.set(mx, top, cz);
      holder.rotation.z = tilt;
      holder.add(section);
      for (const z of [z0 + 0.1, z1 - 0.1]) add(holder, box(len, 0.9, 0.08, rail, 0, 0, z - cz));
    }
    // Abutments where the arch meets each bank.
    for (const x of [RIVER.x0 - 0.3, RIVER.x1 + 0.3]) add(g, box(1.4, bridgeY(x), z1 - z0, stone, x, -0.4, cz));
  }
}

// ------------------------------------------------------------------ park

function buildPark(g: Object3D, random: Random, onRoad: (x: number, z: number, w: number, d: number) => boolean): void {
  const z0 = EDGE + 3;
  const z1 = 118 + GROW;
  const x0 = -EDGE + 2;
  // Up to the promenade, never under it: overlapping flats flicker.
  const x1 = EDGE + 1.9;
  const lawn = mat(PALETTE.grass);
  const path = mat(PALETTE.gravel);
  flat(g, x1 - x0, z1 - z0, lawn, (x0 + x1) / 2, (z0 + z1) / 2, LAYER.grass);
  // Paths: one along the park, one across, and a loop round the pond.
  flat(g, x1 - x0, 3, path, (x0 + x1) / 2, PARK_PATH_Z, LAYER.path);
  flat(g, 3, z1 - z0, path, 12, (z0 + z1) / 2, LAYER.path);
  // The pond, with a stone rim.
  const pond = add(g, new Mesh(new IcosahedronGeometry(1, 1), glowMat(0x22404c, 0x0c2028, 0.5)));
  pond.scale.set(11, 0.01, 7);
  pond.position.set(34, LAYER.path + 0.015, POND_Z);
  const rim = add(g, new Mesh(new IcosahedronGeometry(1, 1), mat(0x7a756a)));
  rim.scale.set(11.8, 0.012, 7.8);
  rim.position.set(34, LAYER.path - 0.004, POND_Z);
  // A fountain where the paths cross.
  add(g, cylinder(2.2, 0.5, mat(0x8a857a), 16, 12, -0.02, PARK_PATH_Z));
  add(g, cylinder(1.8, 0.05, glowMat(0x3a5a68, 0x1a3a48, 0.6), 16, 12, 0.46, PARK_PATH_Z));
  add(g, cylinder(0.3, 1.6, mat(0x8a857a), 8, 12, 0, PARK_PATH_Z));
  // A playground: a frame, a slide and sandpit.
  const red = mat(0xb04a3a);
  const yellow = mat(0xd0a830);
  const pz = 92 + GROW;
  flat(g, 5, 4, mat(0xc8b48a), -24, pz, LAYER.path);
  for (const x of [-26, -22]) add(g, box(0.15, 2.4, 0.15, red, x, 0, pz - 1));
  add(g, box(4.3, 0.15, 0.15, red, -24, 2.3, pz - 1));
  add(g, box(1.2, 1.6, 1.2, yellow, -23, 0, pz + 1.5));
  add(g, box(0.8, 0.1, 2.6, yellow, -21.6, 0.8, pz + 1.5)).rotation.x = -0.5;
  // Benches along the main path.
  for (let x = x0 + 6; x < x1 - 4; x += 9) if (!onRoad(x, PARK_PATH_Z + 2.6, 2, 1)) add(g, bench(), Math.PI).position.set(x, 0, PARK_PATH_Z + 2.6);
  // Trees: full ones near the district, simple far ones further out.
  for (let i = 0; i < 90; i++) {
    const x = x0 + 2 + random() * (x1 - x0 - 4);
    const z = z0 + 2 + random() * (z1 - z0 - 4);
    if (onRoad(x, z, 3, 3) || Math.abs(z - PARK_PATH_Z) < 3 || Math.abs(x - 12) < 3) continue;
    if (Math.hypot((x - 34) / 13, (z - POND_Z) / 9) < 1) continue;
    if ((x > -28 && x < -19 && z > pz - 4 && z < pz + 4) || onFestival(x, z, 3)) continue;
    if (z < 70 + GROW && i % 3 === 0) add(g, tree(pick4(random), 1 + random() * 0.4)).position.set(x, 0, z);
    else farTree(g, x, z, 1 + random() * 0.6, random);
  }
}

/** The park's long path (with the fountain where the cross path meets it) and its pond, south of the district. */
const PARK_PATH_Z = 76 + GROW;
const POND_Z = 96 + GROW;

const pick4 = (random: Random) => Math.floor(random() * 4) as 0 | 1 | 2 | 3;

const crownGeo = new IcosahedronGeometry(1, 1);
const coneGeo = new ConeGeometry(1, 1, 10).translate(0, 0.5, 0);
let farCrowns: Material[] | null = null;
/** Where the near simple trees stand, so kit trees can take their places once loaded. */
const treeSpots: { x: number; y: number; z: number; s: number; evergreen: boolean }[] = [];
/** Simple trees near the district (swapped for kit trees) and far out (kept: cheap at a distance). */
let treeGroup: Object3D | null = null;
let farTreeGroup: Object3D | null = null;
/** Kit trees only this close to the district's middle: further out a simple tree looks the same and costs a tenth. */
const KIT_TREE_RANGE = 120;

/** A cheap tree: a trunk and one faceted crown. */
function farTree(_g: Object3D, x: number, z: number, s: number, random: Random, y = 0): void {
  farCrowns ??= [softMat(0x4e6a3a), softMat(0x5a7040), softMat(0x6a6a34), softMat(0x3e5a3a)];
  const near = Math.hypot(x, z) < KIT_TREE_RANGE;
  const g = (near ? treeGroup : farTreeGroup) ?? _g;
  add(g, cylinder(0.12 * s, 1.6 * s, mat(PALETTE.trunk), 6, x, y, z));
  const evergreen = random() < 0.25;
  if (near) treeSpots.push({ x, y, z, s, evergreen });
  const crown = add(g, new Mesh(evergreen ? coneGeo : crownGeo, farCrowns[Math.floor(random() * farCrowns.length)]));
  if (evergreen) { crown.scale.set(1.3 * s, 4 * s, 1.3 * s); crown.position.set(x, y + 1 * s, z); }
  else { crown.scale.set(1.6 * s, 1.4 * s, 1.6 * s); crown.position.set(x, y + 2.6 * s, z); }
  crown.castShadow = true;
}

// ------------------------------------------------------------------ railway and station

/** How far either way the railway runs: past the widest view, so the train comes and goes unseen. */
const LINE = 345;

function buildRailway(g: Object3D): { update(dt: number): void; span(): readonly [number, number] | null } {
  const ballast = mat(0x5a5048);
  const steel = mat(0x8a8a86);
  const sleeper = mat(0x4a3a30);
  // Track bed across the whole city, with two rails, crossing the river on a bridge.
  add(g, box(2 * LINE, 0.19, 5, ballast, 0, -0.1, RAIL_Z));
  for (const dz of [-0.75, 0.75]) add(g, box(2 * LINE, 0.1, 0.08, steel, 0, 0.09, RAIL_Z + dz));
  for (let x = -LINE + 2; x < LINE; x += 1.6) add(g, box(0.25, 0.05, 2.2, sleeper, x, 0.06, RAIL_Z));
  const truss = mat(0x4a5258);
  for (const dz of [-2.6, 2.6]) {
    add(g, box(RIVER.x1 - RIVER.x0 + 2, 0.3, 0.3, truss, (RIVER.x0 + RIVER.x1) / 2, 2.6, RAIL_Z + dz));
    // Posts on the banks only: the boats pass beneath (flavour/river.ts).
    for (const x of [RIVER.x0, RIVER.x1]) add(g, box(0.25, 2.8, 0.25, truss, x, 0, RAIL_Z + dz));
  }
  // Level crossing where the main road meets the line: barrier posts.
  for (const x of [ROAD.x0 - 1, ROAD.x1 + 1]) add(g, box(0.25, 1.2, 0.25, mat(0xc8c0b0), x, 0, RAIL_Z + 3.4));

  // The station: platform, a long hall with a curved glass roof, a clock tower.
  // West of the main road, clear of the east street's line north.
  const sx = -28;
  add(g, box(40, 0.5, 4, mat(PALETTE.concrete), sx, -0.03, RAIL_Z - 4.6));
  // The hall: brick, with a stone cornice and a row of tall arched windows.
  const hall = mat(0x8a5a44);
  const stone = mat(0xb8ac98);
  const hz = RAIL_Z - 12;
  add(g, box(40, 6.2, 9, hall, sx, 0, hz));
  add(g, box(40.6, 0.5, 9.6, stone, sx, 6.2, hz));
  add(g, box(40.4, 0.8, 9.4, stone, sx, 0, hz));
  const pane = glowMat(0x2a2a30, PALETTE.warmWindow, 0.55);
  for (let x = sx - 17; x <= sx + 17; x += 3.4) {
    add(g, box(1.5, 3.2, 0.06, pane, x, 1.4, hz + 4.53));
    add(g, cylinder(0.75, 0.06, pane, 10, x, 4.6, hz + 4.53)).rotation.x = Math.PI / 2;
    add(g, box(0.5, 6.2, 0.3, stone, x + 1.7, 0, hz + 4.55));
  }
  // The train shed: an arched glass roof along the hall on iron ribs, glazed gable ends.
  const vaultR = 4.6;
  const shed = glowMat(0x3a4a58, 0x9fb8e0, 0.18);
  const iron = mat(0x3a4048);
  const vault = new CylinderGeometry(vaultR, vaultR, 40, 20, 1, true, 0, Math.PI).rotateZ(Math.PI / 2);
  const roof = add(g, new Mesh(vault, shed));
  roof.position.set(sx, 6.7, hz);
  roof.scale.set(1, 0.75, 1);
  const rib = new TorusGeometry(vaultR, 0.12, 4, 18, Math.PI);
  for (let x = sx - 20; x <= sx + 20; x += 3.4) {
    const r = add(g, new Mesh(rib, iron), Math.PI / 2);
    r.position.set(x, 6.7, hz);
    r.scale.set(1, 0.75, 1);
  }
  for (const end of [-1, 1]) {
    const gable = add(g, new Mesh(new CircleGeometry(vaultR, 18, 0, Math.PI), shed), end * Math.PI / 2);
    gable.position.set(sx + end * 20, 6.7, hz);
    gable.scale.set(1, 0.75, 1);
  }
  add(g, box(40.6, 0.25, 0.25, iron, sx, 6.7, hz + vaultR));
  add(g, box(40.6, 0.25, 0.25, iron, sx, 6.7, hz - vaultR));
  // The clock tower at the west end: brick shaft, stone bands, clock faces, a pyramid roof.
  const tx = sx - 22;
  add(g, box(4, 16, 4, hall, tx, 0, hz));
  for (const y of [6.2, 11.2, 15.6]) add(g, box(4.4, 0.4, 4.4, stone, tx, y, hz));
  const face = glowMat(0xe8e0c8, 0xfff2d0, 0.8);
  add(g, cylinder(1.2, 0.2, face, 20, tx, 13.6, hz + 2.0)).rotation.x = Math.PI / 2;
  add(g, cylinder(1.2, 0.2, face, 20, tx + 2.0, 13.6, hz)).rotation.z = -Math.PI / 2;
  const spire = add(g, new Mesh(new ConeGeometry(3.1, 4.2, 4), mat(0x4a5a5a)), Math.PI / 4);
  spire.position.set(tx, 16 + 2.1, hz);
  // Platform canopy on posts.
  for (let x = sx - 18; x <= sx + 18; x += 4.5) add(g, box(0.2, 3, 0.2, steel, x, 0.45, RAIL_Z - 3.4));
  add(g, box(40, 0.15, 3.2, mat(0x4a4e52), sx, 3.4, RAIL_Z - 4.4));

  // A train: four cars that run through, stop at the platform, and go on.
  // Built facing +z; turned so it runs along +x, the lead cab first.
  const train = new Group();
  const cars = trainModel(4);
  cars.rotation.y = Math.PI / 2;
  cars.position.x = 3 * 16.4;
  train.add(cars);
  // Its length either side of its origin, so it enters and leaves wholly beyond the line's visible part.
  const ext = new Box3().setFromObject(train);
  const start = -LINE - ext.max.x - 5;
  const stop = sx - 34;
  const end = LINE - ext.min.x + 5;
  const IN = 35;
  const HALT = 12;
  const OUT = 35;
  const CYCLE = IN + HALT + OUT + 15;
  train.position.set(start, 0, RAIL_Z);
  train.userData.mover = 'train';
  g.parent!.add(dynamic(train)); // moving: kept out of the static merge
  let t = 0;
  return {
    update(dt) {
      // About a minute and a half per pass: in from beyond the view, a stop at the platform, out, a pause off the line.
      t = (t + dt) % CYCLE;
      let x: number;
      if (t < IN) x = start + (t / IN) ** 0.8 * (stop - start);
      else if (t < IN + HALT) x = stop;
      else if (t < IN + HALT + OUT) x = stop + ((t - IN - HALT) / OUT) ** 1.25 * (end - stop);
      else x = end;
      train.visible = t < IN + HALT + OUT;
      train.position.x = x;
    },
    span: () => (train.visible ? [train.position.x + ext.min.x, train.position.x + ext.max.x] as const : null),
  };
}

// ------------------------------------------------------------------ hospital and sobering-up centre

/** The public hospital across the river, east of the district; the sobering-up centre by the railway, north. */
// Between the north and south streets (roads at z -21.5..-16.5 and 16.5..21.5), its 2 m forecourt up to their kerbs, so through traffic passes it.
const HOSPITAL = { x0: 88 + GROW, x1: 124 + GROW, z0: -13.5, z1: 14.5 };
/** City hall: on the old town's edge nearest the district, facing it across the main street west. */
// South of the north street (road z -21.5..-16.5, its pavement to -14), its 2 m forecourt up to that pavement.
const CITY_HALL = { x0: -68 - GROW, x1: -54 - GROW, z0: -12, z1: 3 };
const SOBERING = { x0: 30, x1: 44, z0: -59 - GROW, z1: -51 - GROW };

function buildLandmarks(g: Object3D, lit: MeshLambertMaterial[]): { hospital: number; sobering: number; police: number; cityHall: number } {
  const white = mat(0xdadcd8);
  const trim = mat(0x8a929a);
  const red = glowMat(0x9a2a2a, 0xff4a3a, 0.6);
  // Windows one by one, framed, on the faces the camera sees (+z front, +x side); every third or so dark.
  const unlit = mat(0x23262c);
  const windows = (x0: number, x1: number, z0: number, z1: number, rows: readonly number[], spacing: number, w: number, h: number, bars: boolean, framed = true) => {
    let k = 0;
    const pane = () => (k++ % 3 === 1 ? unlit : lit[k % lit.length]);
    for (const y of rows) {
      for (let x = x0 + spacing / 2; x < x1 - 0.5; x += spacing) {
        add(g, box(w, h, 0.06, pane(), x, y, z1 + 0.02));
        if (framed) add(g, windowTrim(w, h)).position.set(x, y, z1 + 0.03);
        else add(g, box(w + 0.3, 0.08, 0.2, trim, x, y - 0.1, z1 + 0.1));
        if (bars) for (let b = -w / 2 + 0.2; b < w / 2; b += 0.24) add(g, box(0.04, h, 0.04, mat(0x2a2c30), x + b, y, z1 + 0.12));
      }
      for (let z = z0 + spacing / 2; z < z1 - 0.5; z += spacing) {
        add(g, box(0.06, h, w, pane(), x1 + 0.02, y, z));
        if (framed) add(g, windowTrim(w, h), Math.PI / 2).position.set(x1 + 0.03, y, z);
        else add(g, box(0.2, 0.08, w + 0.3, trim, x1 + 0.1, y - 0.1, z));
        if (bars) for (let b = -w / 2 + 0.2; b < w / 2; b += 0.24) add(g, box(0.04, h, 0.04, mat(0x2a2c30), x1 + 0.12, y, z + b));
      }
    }
  };

  // Hospital: a three-storey podium along the south street with a glazed half-round atrium at the
  // entrance, a finned ward tower stepping back at the top under a raised helipad, a lower east wing
  // with a sawtooth of rooflights, a glass bridge between them, the A&E canopy facing the river,
  // and the boiler house's chimney. Ribbon glazing round every face, lit in a clinical white.
  const h = HOSPITAL;
  const cx = (h.x0 + h.x1) / 2;
  const cz = (h.z0 + h.z1) / 2;
  add(g, box(h.x1 - h.x0 + 4, 0.22, h.z1 - h.z0 + 4, mat(PALETTE.pavement), cx, -0.1, cz));
  const ward = glowMat(0x2a3440, 0xd8f0ff, 0.55);
  // The far city's own warm window light (already a draw call, and it flickers with the rest).
  const warm = lit[0];
  const darkGlass = mat(0x2a3038);
  /** A white block with a band of glazing per floor round all four faces, a dark plinth and a parapet. */
  const block = (x0: number, x1: number, z0: number, z1: number, floors: number, y0 = 0, groundGlass = false) => {
    const w = x1 - x0;
    const d = z1 - z0;
    const bx = (x0 + x1) / 2;
    const bz = (z0 + z1) / 2;
    const top = y0 + floors * 3.6;
    add(g, box(w, top - y0, d, white, bx, y0, bz));
    if (y0 === 0) add(g, box(w + 0.12, 0.9, d + 0.12, trim, bx, 0, bz));
    for (let f = 0; f < floors; f++) {
      const ground = f === 0 && y0 === 0;
      const band = ground && groundGlass ? warm : (f + Math.round(x0)) % 3 === 1 ? darkGlass : ward;
      add(g, box(w + 0.08, ground ? 2.6 : 1.7, d + 0.08, band, bx, y0 + f * 3.6 + (ground ? 0.9 : 1.2), bz));
    }
    add(g, box(w + 0.4, 0.6, d + 0.4, trim, bx, top, bz));
    return top;
  };
  // The podium, with the hospital's name over the entrance and plant on its roof.
  const podTop = block(h.x0, h.x1, h.z0 + 16.5, h.z1, 3, 0, true);
  const name = new MeshLambertMaterial({ map: pixelTextTexture('CITY HOSPITAL', '#ffffff', '#2a5a8a'), emissive: 0xffffff, emissiveIntensity: 0.6, emissiveMap: pixelTextTexture('CITY HOSPITAL', '#ffffff', '#2a5a8a') });
  add(g, box(9, 1.0, 0.1, name, cx + 4, podTop - 1.2, h.z1 + 0.25));
  for (const [x, z] of [[cx - 6, h.z1 - 4], [cx - 1, h.z1 - 6], [cx + 10, h.z1 - 4]] as const) add(g, acUnit()).position.set(x, podTop + 0.6, z);
  add(g, box(5, 1.8, 3, mat(0xb8bcc0), cx + 14, podTop + 0.6, h.z1 - 6));
  // The atrium: a glazed half drum out on the south front, ribbed, a flat disc for a roof.
  const ax = cx + 4;
  const atrium = new Mesh(new CylinderGeometry(4.2, 4.2, 8.6, 18, 1, true, -Math.PI / 2, Math.PI), warm);
  atrium.position.set(ax, 4.3, h.z1);
  g.add(atrium);
  const disc = new Mesh(new CylinderGeometry(4.5, 4.5, 0.4, 18, 1, false, -Math.PI / 2, Math.PI), trim);
  disc.position.set(ax, 8.8, h.z1);
  g.add(disc);
  for (let k = 0; k <= 6; k++) {
    const a = (k / 6) * Math.PI;
    add(g, box(0.16, 8.6, 0.16, white, ax + Math.cos(a) * 4.25, 0, h.z1 + Math.sin(a) * 4.25));
  }
  // The ward tower: seven storeys with vertical fins on every face, the top two set back, a raised helipad.
  const tw = { x0: h.x0 + 2, x1: h.x0 + 16, z0: h.z0 + 1, z1: h.z0 + 16.5 };
  const lowTop = block(tw.x0, tw.x1, tw.z0, tw.z1, 5);
  const fin = mat(0xc8ccd0);
  for (let x = tw.x0 + 0.75; x < tw.x1; x += 1.5) for (const z of [tw.z0 - 0.25, tw.z1 + 0.25]) add(g, box(0.16, lowTop - 1, 0.5, fin, x, 0.9, z));
  for (let z = tw.z0 + 0.75; z < tw.z1; z += 1.5) for (const x of [tw.x0 - 0.25, tw.x1 + 0.25]) add(g, box(0.5, lowTop - 1, 0.16, fin, x, 0.9, z));
  const towerTop = block(tw.x0 + 2, tw.x1 - 2, tw.z0 + 2, tw.z1 - 2, 2, lowTop + 0.6);
  // The helipad on four legs above the roof: a deck, the H, lamps round its edge, a stair down.
  const padX = (tw.x0 + tw.x1) / 2;
  const padZ = (tw.z0 + tw.z1) / 2;
  for (const [dx, dz] of [[-3, -3], [3, -3], [3, 3], [-3, 3]] as const) add(g, box(0.4, 2.2, 0.4, mat(0x6a7078), padX + dx, towerTop + 0.6, padZ + dz));
  add(g, cylinder(5.6, 0.35, mat(0x4a5058), 20, padX, towerTop + 2.8, padZ));
  add(g, cylinder(4.6, 0.02, mat(0xd8d8d0), 20, padX, towerTop + 3.16, padZ));
  add(g, cylinder(4.3, 0.03, mat(0x4a5058), 20, padX, towerTop + 3.17, padZ));
  for (const dx of [-1.2, 1.2]) add(g, box(0.5, 0.05, 3.6, mat(0xf0f0f0), padX + dx, towerTop + 3.2, padZ));
  add(g, box(2.4, 0.05, 0.5, mat(0xf0f0f0), padX, towerTop + 3.2, padZ));
  const padLamp = glowMat(0x3a2a1a, 0xffc040, 1.0);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    add(g, box(0.25, 0.2, 0.25, padLamp, padX + Math.cos(a) * 5.4, towerTop + 3.15, padZ + Math.sin(a) * 5.4));
  }
  add(g, box(1.2, 2.6, 2.2, white, tw.x1 - 2.6, towerTop + 0.6, padZ + 4));
  // Red crosses high on the tower, south and east.
  for (const [x, z, r] of [[padX, tw.z1 + 0.5, 0], [tw.x1 + 0.5, padZ, Math.PI / 2]] as const) {
    const cross = add(g, new Group(), r);
    cross.position.set(x, lowTop - 5, z);
    add(cross, box(3.4, 1.1, 0.3, red, 0, 1.15, 0));
    add(cross, box(1.1, 3.4, 0.3, red, 0, 0, 0));
  }
  // The east wing: four storeys, a sawtooth of rooflights along it.
  const ew = { x0: h.x0 + 20, x1: h.x1, z0: h.z0 + 1, z1: h.z0 + 15 };
  const eastTop = block(ew.x0, ew.x1, ew.z0, ew.z1, 4);
  const roofGlass = ward;
  for (let x = ew.x0 + 2; x < ew.x1 - 1; x += 3) {
    add(g, gableRoof(2.6, ew.z1 - ew.z0 - 3, 1.4, mat(0x8a929a))).position.set(x, eastTop + 0.6, (ew.z0 + ew.z1) / 2);
    add(g, box(0.1, 1.0, ew.z1 - ew.z0 - 3.2, roofGlass, x + 0.7, eastTop + 0.7, (ew.z0 + ew.z1) / 2)).rotation.z = -0.9;
  }
  // The glass bridge from the tower to the east wing at the second floor, and a little garden below it.
  add(g, box(ew.x0 - tw.x1 + 0.4, 3.0, 3.2, warm, (tw.x1 + ew.x0) / 2, 7.4, h.z0 + 7));
  add(g, box(ew.x0 - tw.x1 + 0.6, 0.4, 3.4, trim, (tw.x1 + ew.x0) / 2, 10.4, h.z0 + 7));
  add(g, box(ew.x0 - tw.x1, 0.13, 6, mat(PALETTE.grass), (tw.x1 + ew.x0) / 2, 0, h.z0 + 2.5));
  add(g, tree(1, 0.7)).position.set((tw.x1 + ew.x0) / 2, 0.12, h.z0 + 2.5);
  // A&E on the west front, facing the river: a canopy on columns out over the ambulance bays.
  const aeZ = h.z0 + 21;
  add(g, box(4.2, 0.4, 9, trim, h.x0 - 2.1, 3.6, aeZ));
  for (const dz of [-4, 0, 4]) add(g, cylinder(0.18, 3.6, white, 8, h.x0 - 3.9, 0, aeZ + dz));
  add(g, box(0.1, 2.6, 4, ward, h.x0 - 0.06, 0.4, aeZ));
  const ae = new MeshLambertMaterial({ map: pixelTextTexture('A&E', '#ffffff', '#b8202a'), emissive: 0xffffff, emissiveIntensity: 0.8, emissiveMap: pixelTextTexture('A&E', '#ffffff', '#b8202a') });
  add(g, box(0.1, 1.0, 2.6, ae, h.x0 - 4.25, 4.0, aeZ));
  const bay = mat(0xd8b020);
  for (const dz of [-3, 3]) {
    add(g, box(3.4, 0.02, 0.12, bay, h.x0 - 2.1, 0.13, aeZ + dz - 1.4));
    add(g, box(3.4, 0.02, 0.12, bay, h.x0 - 2.1, 0.13, aeZ + dz + 1.4));
  }
  // The boiler house in the north-east corner and its tall chimney, banded red and white at the top.
  add(g, box(6, 5, 4, mat(0x9a948a), h.x1 - 3, 0, h.z0 + 2));
  add(g, cylinder(0.9, 32, mat(0xa8a49c), 10, h.x1 - 1.5, 0, h.z0 + 0.8));
  for (const [y, c] of [[28, 0xb8302a], [29.5, 0xe8e8e0], [31, 0xb8302a]] as const) add(g, cylinder(0.95, 1.5, mat(c), 10, h.x1 - 1.5, y, h.z0 + 0.8));
  const hospital = registerBuilding(h.x0, h.x1, h.z0, h.z1, 24);
  // Sobering-up centre: a two-storey municipal block, barred windows, a canopy over the door, a blue lamp.
  const s = SOBERING;
  const sx = (s.x0 + s.x1) / 2;
  const sz = (s.z0 + s.z1) / 2;
  add(g, box(s.x1 - s.x0 + 3, 0.22, s.z1 - s.z0 + 3, mat(PALETTE.pavement), sx, -0.1, sz));
  add(g, box(s.x1 - s.x0, 6.4, s.z1 - s.z0, mat(0xb8b0a0), sx, 0, sz));
  add(g, box(s.x1 - s.x0 + 0.1, 0.8, s.z1 - s.z0 + 0.1, mat(0x8a8276), sx, 0, sz));
  add(g, box(s.x1 - s.x0 + 0.4, 0.45, s.z1 - s.z0 + 0.4, trim, sx, 6.4, sz));
  windows(s.x0, s.x1, s.z0, s.z1, [1.3, 4.1], 2.3, 1.1, 1.3, true);
  // The door, a canopy on two posts, the sign and the lamp.
  add(g, box(1.8, 2.4, 0.2, mat(0x3a3a3a), sx, 0, s.z1 + 0.05));
  add(g, box(3.2, 0.18, 1.8, trim, sx, 2.7, s.z1 + 0.9));
  for (const dx of [-1.4, 1.4]) add(g, cylinder(0.06, 2.7, trim, 6, sx + dx, 0, s.z1 + 1.7));
  const soberSign = new MeshLambertMaterial({ map: pixelTextTexture('SOBERING', '#ffffff', '#2a4a8a'), emissive: 0xffffff, emissiveIntensity: 0.5, emissiveMap: pixelTextTexture('SOBERING', '#ffffff', '#2a4a8a') });
  add(g, box(3.6, 0.6, 0.08, soberSign, sx, 3.1, s.z1 + 0.06));
  add(g, box(0.5, 0.5, 0.5, glowMat(0x2a3a7a, 0x5a8aff, 1.2), sx + 2.3, 2.8, s.z1 + 0.3));
  for (const x of [s.x0 + 0.2, s.x1 - 0.2]) add(g, drainpipe(6.5)).position.set(x, 0, s.z1 + 0.08);
  for (const [x, z] of [[sx - 3, sz], [sx + 3, sz - 1]] as const) add(g, roofVent()).position.set(x, 6.85, z);
  add(g, bench()).position.set(sx - 4, 0, s.z1 + 1.2);
  const sobering = registerBuilding(s.x0, s.x1, s.z0, s.z1, 6.4);

  // Police station: three storeys of grey stone on a dark plinth, a blue band, a porch with
  // steps and the POLICE sign, roof plant and a radio mast, a flag, patrol cars out front.
  const p = POLICE_STATION;
  const px = (p.x0 + p.x1) / 2;
  const bz0 = p.z0;
  const bz1 = p.z1 - 2;
  const bz = (bz0 + bz1) / 2;
  const stoneGrey = mat(0x8a8e92);
  const policeBlue = mat(0x1e3a7a);
  add(g, box(p.x1 - p.x0 + 3, 0.22, p.z1 - p.z0 + 3, mat(PALETTE.pavement), px, -0.1, (p.z0 + p.z1) / 2));
  add(g, box(p.x1 - p.x0, 9.2, bz1 - bz0, stoneGrey, px, 0, bz));
  add(g, box(p.x1 - p.x0 + 0.12, 1.0, bz1 - bz0 + 0.12, mat(0x4a4e54), px, 0, bz));
  add(g, box(p.x1 - p.x0 + 0.1, 0.4, bz1 - bz0 + 0.1, policeBlue, px, 3.05, bz));
  add(g, box(p.x1 - p.x0 + 0.4, 0.5, bz1 - bz0 + 0.4, trim, px, 9.2, bz));
  // A low parapet round the roof.
  for (const [w, d, x, z] of [[p.x1 - p.x0, 0.2, px, bz0 + 0.1], [p.x1 - p.x0, 0.2, px, bz1 - 0.1], [0.2, bz1 - bz0, p.x0 + 0.1, bz], [0.2, bz1 - bz0, p.x1 - 0.1, bz]] as const) add(g, box(w, 0.6, d, trim, x, 9.7, z));
  windows(p.x0, p.x1, bz0, bz1, [1.5, 4.2, 6.9], 2.2, 1.0, 1.4, false);
  // The porch: a box out from the front, glass doors, steps, the sign above, blue lamps either side.
  add(g, box(4.2, 3.4, 1.4, stoneGrey, px, 0, bz1 + 0.7));
  add(g, box(4.5, 0.3, 1.7, trim, px, 3.4, bz1 + 0.75));
  add(g, box(2.2, 2.4, 0.06, glowMat(0x2a3440, PALETTE.warmWindow, 0.7), px, 0.25, bz1 + 1.42));
  for (const [y, d] of [[0, 2.6], [0.12, 2.2]] as const) add(g, box(3.2, 0.12, 0.6, mat(0xb8b4aa), px, y, bz1 + d));
  const sign = new MeshLambertMaterial({ map: pixelTextTexture('POLICE', '#ffffff', '#1a3a8a'), emissive: 0xffffff, emissiveIntensity: 0.6, emissiveMap: pixelTextTexture('POLICE', '#ffffff', '#1a3a8a') });
  add(g, box(3.6, 0.8, 0.1, sign, px, 2.55, bz1 + 1.45));
  const blue = glowMat(0x1a2a6a, 0x4a7aff, 1.4);
  for (const dx of [-2.6, 2.6]) {
    add(g, cylinder(0.05, 2.4, trim, 6, px + dx, 0, bz1 + 1.5));
    add(g, box(0.4, 0.4, 0.4, blue, px + dx, 2.4, bz1 + 1.5));
  }
  // On the roof: plant, a radio mast and a dish.
  for (const [x, z] of [[p.x0 + 2.5, bz], [p.x0 + 5, bz - 1.5]] as const) add(g, acUnit()).position.set(x, 9.7, z);
  add(g, antenna(5)).position.set(p.x1 - 2, 9.7, bz0 + 1.5);
  add(g, satelliteDish()).position.set(p.x1 - 4, 9.7, bz + 1);
  add(g, drainpipe(9.4)).position.set(p.x1 - 0.2, 0, bz1 + 0.08);
  // A flagpole at the corner.
  add(g, cylinder(0.06, 7, mat(0xd0d0d0), 6, p.x1 + 0.6, 0, p.z1 - 1.4));
  add(g, box(0.04, 0.9, 1.4, mat(0xe8e4dc), p.x1 + 0.6, 6.0, p.z1 - 0.65));
  add(g, box(0.045, 0.45, 1.4, mat(0xc0302a), p.x1 + 0.6, 6.0, p.z1 - 0.65));
  // Two patrol cars parked along the front, either side of the porch, a light bar on each.
  for (const x of [p.x0 + 2.4, p.x1 - 2.4]) {
    const c = add(g, car(0xeef0f2, false, 'saloon'), Math.PI / 2);
    c.position.set(x, 0, p.z1 + 0.3);
    add(c, box(1.0, 0.14, 0.32, blue, 0, 1.45, 0));
    add(c, box(0.04, 0.3, 3.2, policeBlue, 0.92, 0.45, 0));
  }
  const police = registerBuilding(p.x0, p.x1, bz0, bz1, 9.2);

  // City hall: pale stone, three storeys, a columned portico and steps facing east to the district, a flag.
  const ch = CITY_HALL;
  const hx = (ch.x0 + ch.x1) / 2;
  const hz = (ch.z0 + ch.z1) / 2;
  const pale = mat(0xd8d0bc);
  add(g, box(ch.x1 - ch.x0 + 4, 0.22, ch.z1 - ch.z0 + 4, mat(PALETTE.pavement), hx, -0.1, hz));
  add(g, box(ch.x1 - ch.x0, 11, ch.z1 - ch.z0, pale, hx, 0, hz));
  add(g, box(ch.x1 - ch.x0 + 0.2, 1.2, ch.z1 - ch.z0 + 0.2, mat(0xa89e88), hx, 0, hz));
  add(g, box(ch.x1 - ch.x0 + 0.6, 0.7, ch.z1 - ch.z0 + 0.6, trim, hx, 11, hz));
  windows(ch.x0, ch.x1, ch.z0, ch.z1, [2.2, 5.4, 8.4], 2.4, 1.1, 1.8, false);
  // Portico on the east face: steps, six columns, a pediment band, the sign.
  for (const [y, d] of [[0, 3.2], [0.15, 2.6], [0.3, 2.0]] as const) add(g, box(d, 0.15, 8, mat(0xc8c0ac), ch.x1 + d / 2, y, hz));
  for (let i = 0; i < 6; i++) add(g, cylinder(0.32, 7.2, pale, 10, ch.x1 + 1.8, 0.45, hz - 3.5 + i * 1.4));
  add(g, box(2.6, 0.9, 8.6, pale, ch.x1 + 1.5, 7.6, hz));
  const hall = new MeshLambertMaterial({ map: pixelTextTexture('CITY HALL', '#2a2a30', '#e8e0cc'), emissive: 0xffffff, emissiveIntensity: 0.25, emissiveMap: pixelTextTexture('CITY HALL', '#2a2a30', '#e8e0cc') });
  add(g, box(0.1, 0.6, 4.4, hall, ch.x1 + 2.82, 7.75, hz));
  add(g, box(0.1, 2.6, 2.2, glowMat(0x2a3440, PALETTE.warmWindow, 0.8), ch.x1 + 0.06, 0.45, hz));
  add(g, cylinder(0.06, 6, mat(0xd0d0d0), 6, hx, 11.7, hz));
  add(g, box(0.04, 1.0, 1.6, mat(0xf4f0e8), hx, 16.4, hz + 0.8));
  add(g, box(0.045, 0.5, 1.6, mat(0xc8202a), hx, 16.4, hz + 0.8));
  const cityHall = registerBuilding(ch.x0, ch.x1, ch.z0, ch.z1, 11);
  return { hospital, sobering, police, cityHall };
}

// ------------------------------------------------------------------ business district

/** Builds the office towers; returns their footprints (with forecourts) for the blocks to build round. */
function buildTowers(g: Object3D, random: Random, towerGlass: MeshLambertMaterial[], onRoad: (x: number, z: number, w: number, d: number) => boolean): Rect[] {
  const footprints: Rect[] = [];
  const glass = [mat(0x2a3440), mat(0x34404c), mat(0x3a3e44)];
  const trim = mat(0x5a6068);
  const lobby = glowMat(0x2a3440, PALETTE.warmWindow, 0.6);
  const plaza = mat(0x9a948a);
  let k = 0;
  // The cluster's grid shifts each launch, and a tower or two is missing.
  const ox = (random() - 0.5) * 16;
  const oz = (random() - 0.5) * 12;
  for (let x = -55 + ox; x <= 55 + ox; x += 26) {
    for (let z = -96 - GROW + oz; z >= -150 - GROW + oz; z -= 26) {
      if (random() < 0.15) continue;
      const w = 9.5 + random() * 2;
      const d = 9.5 + random() * 2;
      if (onRoad(x, z, w, d)) continue;
      // Each tower stands on its own paved forecourt.
      flat(g, w + 3, d + 3, plaza, x, z, LAYER.path);
      footprints.push({ x0: x - w / 2 - 2, x1: x + w / 2 + 2, z0: z - d / 2 - 2, z1: z + d / 2 + 2 });
      // Tallest in the middle of the cluster, stepping down at its edges.
      // Capped from the tower's side nearest the district.
      const h = Math.min(heightCap(x, z + d / 2), 18 + random() * 14 + Math.max(0, 22 - Math.abs(x + 4) * 0.5));
      // Curtain walls in a few tints: blue-green, steel grey, bronze.
      const tint = TOWER_TINTS[Math.floor(random() * TOWER_TINTS.length)];
      // Some towers step back two thirds of the way up.
      const setback = h > 22 && random() < 0.5;
      const lowH = setback ? Math.round(h * 0.62) : h;
      const skin = curtainWall(tint, (w + d) / 2, lowH, random);
      towerGlass.push(skin);
      add(g, box(w, lowH, d, skin, x, 0, z));
      let topW = w;
      let topD = d;
      if (setback) {
        topW = w * 0.74;
        topD = d * 0.74;
        add(g, box(w + 0.3, 0.45, d + 0.3, trim, x, lowH, z));
        const upper = curtainWall(tint, (topW + topD) / 2, h - lowH, random);
        towerGlass.push(upper);
        add(g, box(topW, h - lowH, topD, upper, x, lowH, z));
      }
      // A podium two floors high with a lit lobby, a little wider than the shaft.
      add(g, box(w + 1.2, 6.4, d + 1.2, trim, x, 0, z));
      add(g, box(w - 1, 3.4, 0.06, lobby, x, 0.4, z + d / 2 + 0.63));
      add(g, box(0.06, 3.4, d - 1, lobby, x + w / 2 + 0.63, 0.4, z));
      // Corner piers, to give the glass box an edge.
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(g, box(0.35, lowH - 6.4, 0.35, trim, x + cx * w / 2, 6.4, z + cz * d / 2));
      // A stepped crown with plant rooms, and a mast on some.
      add(g, box(topW + 0.4, 0.5, topD + 0.4, trim, x, h, z));
      add(g, box(topW * 0.6, 2.4, topD * 0.6, glass[k++ % glass.length], x, h + 0.5, z));
      add(g, box(topW * 0.6 + 0.3, 0.3, topD * 0.6 + 0.3, trim, x, h + 2.9, z));
      if (random() < 0.4) add(g, box(0.15, 6, 0.15, trim, x + w / 6, h + 3.2, z - d / 6));
    }
  }
  return footprints;
}

// ------------------------------------------------------------------ old town

function buildOldTown(g: Object3D, random: Random, lit: Material[], pick: <T>(items: readonly T[]) => T, onRoad: (x: number, z: number, w: number, d: number) => boolean): void {
  const walls = [0xc8a86a, 0xb87a5a, 0xd0c09a, 0x8aa0a0, 0xc89090, 0xa8b07a, 0xe0d0b0].map(mat);
  const roofs = [mat(0x8a4a3a), mat(0x6a3a30), mat(0x5a4a44)];
  const cobbles = mat(0x6e6658);
  // Cobbled square with market stalls.
  const sqx = -78 - GROW;
  const sqz = 4;
  flat(g, 26, 22, cobbles, sqx, sqz, LAYER.path);
  const awnings = [0xb04a3a, 0x2e7d6b, 0xd0a830, 0x3a6ea8].map(mat);
  for (let i = 0; i < 8; i++) {
    const x = sqx - 9 + (i % 4) * 6;
    const z = sqz - 4 + Math.floor(i / 4) * 8;
    add(g, box(3.2, 0.9, 1.6, mat(PALETTE.timber), x, 0, z));
    add(g, box(3.6, 0.1, 2.2, awnings[i % awnings.length], x, 2.2, z));
    for (const dx of [-1.6, 1.6]) add(g, box(0.08, 2.2, 0.08, mat(0x3a3a3a), x + dx, 0, z + 0.9));
  }
  // The church: nave, transept, a tower with a spire.
  const stone = mat(0x9a9080);
  // Far enough west that the tower and spire never stand in front of the district.
  const cx = -118 - GROW;
  const cz = -26;
  add(g, box(10, 12, 26, stone, cx, 0, cz));
  add(g, gableRoof(10, 26, 6, roofs[1])).position.set(cx, 12, cz);
  add(g, box(22, 10, 8, stone, cx, 0, cz + 2));
  add(g, box(6, 30, 6, stone, cx, 0, cz + 15));
  const spire = add(g, new Mesh(new ConeGeometry(4, 16, 4).translate(0, 8, 0), mat(0x3e5a52)));
  spire.position.set(cx, 30, cz + 15);
  spire.rotation.y = Math.PI / 4;
  add(g, cylinder(1.4, 0.2, glowMat(0xe8e0c8, 0xfff2d0, 0.6), 16, cx, 22, cz + 18.05)).rotation.x = Math.PI / 2;
  // Narrow gabled houses in rows along lanes, gables to the street: stone
  // ground floors with shopfronts, framed windows, string courses, chimneys.
  const sill = mat(0xd8d0c0);
  const frameMat = mat(0x3a3430);
  const groundStone = [mat(0x7a7064), mat(0x8a8072), mat(0x6a6258)];
  const awningsTown = [0x8a2a2a, 0x2e5a4a, 0x8a6a2a, 0x2a3a5a].map(mat);
  const dark = mat(0x1e2024);
  let k = 0;
  // Pavement under each row of houses and cobbled lanes between the rows.
  const pave = mat(PALETTE.pavement);
  for (let z = -46; z <= 48; z += 13) {
    if (!onRoad(-91 - GROW, z, 76, 11)) add(g, box(78, 0.14, 11.5, pave, -91 - GROW, -0.12, z));
    flat(g, 78, 2.2, cobbles, -91 - GROW, z + 6.6, LAYER.path);
  }
  for (let z = -46; z <= 48; z += 13) {
    for (let x = -54 - GROW; x >= -128 - GROW; x -= 4.6) {
      const w = 4.2;
      const d = 9;
      if (onRoad(x, z, w, d)) continue;
      if (Math.abs(x - sqx) < 15 && Math.abs(z - sqz) < 13) continue;
      if (Math.abs(x - cx) < 13 && Math.abs(z - cz) < 18) continue;
      if (x + w / 2 > CITY_HALL.x0 - 1.5 && x - w / 2 < CITY_HALL.x1 + 1.5 && z + d / 2 > CITY_HALL.z0 - 1.5 && z - d / 2 < CITY_HALL.z1 + 1.5) continue;
      const floors = Math.max(2, Math.min(2 + Math.floor(random() * 3), Math.floor((heightCap(x + 2, z) - 3.4) / 2.8) + 1));
      const h = 3.4 + (floors - 1) * 2.8;
      const front = z + d / 2;
      add(g, box(w, h, d, pick(walls), x, 0, z));
      add(g, box(w + 0.08, 3.2, d + 0.08, pick(groundStone), x, 0, z));
      add(g, gableRoof(d, w + 0.3, 2.6 + random() * 1.4, pick(roofs)), Math.PI / 2).position.set(x, h, z);
      // Cornice under the eaves and a string course over the ground floor.
      add(g, box(w + 0.3, 0.22, d + 0.3, sill, x, h - 0.22, z));
      add(g, box(w + 0.16, 0.14, d + 0.16, sill, x, 3.2, z));
      // Ground floor: a shopfront (lit or not) or a door and a window.
      if (random() < 0.55) {
        add(g, box(2.8, 1.9, 0.06, random() < 0.6 ? lit[k++ % lit.length] : dark, x - 0.3, 0.6, front + 0.05));
        const aw = add(g, box(3.2, 0.08, 1.0, pick(awningsTown), x - 0.3, 2.7, front + 0.55));
        aw.rotation.x = 0.25;
      } else {
        add(g, box(1.0, 2.2, 0.06, frameMat, x + 1.2, 0.12, front + 0.05));
        add(g, box(1.2, 1.3, 0.06, random() < 0.4 ? lit[k++ % lit.length] : dark, x - 0.8, 0.9, front + 0.05));
      }
      // Upper floors: two framed windows with sills on the street face, one on the side.
      for (let f = 1; f < floors; f++) {
        const y = 3.4 + (f - 1) * 2.8 + 0.6;
        for (const dx of [-0.95, 0.95]) {
          add(g, box(0.95, 1.35, 0.06, frameMat, x + dx, y - 0.05, front + 0.03));
          add(g, box(0.8, 1.2, 0.07, random() < 0.32 ? lit[k++ % lit.length] : dark, x + dx, y, front + 0.04));
          add(g, box(1.05, 0.08, 0.2, sill, x + dx, y - 0.1, front + 0.1));
        }
        add(g, box(0.07, 1.2, 0.8, random() < 0.25 ? lit[k++ % lit.length] : dark, x + w / 2 + 0.04, y, z + 1.5));
      }
      if (random() < 0.6) add(g, box(0.5, 1.4, 0.5, mat(0x6a4a3e), x + (random() - 0.5) * 2, h + 1.2, z - 1.5));
    }
  }
}

// ------------------------------------------------------------------ hill

function buildHill(g: Object3D, random: Random): void {
  const grass = [softMat(0x4e6a3a), softMat(0x587240), softMat(0x62783e)];
  const cx = -100 - GROW;
  const cz = -100 - GROW;
  // A heightfield that eases into the ground on every side (no rim), with an
  // uneven outline and shoulders, so it reads as a hill and not a dome.
  const radiusAt = (a: number) => 37 * (1 + 0.09 * Math.sin(3 * a + 0.7) + 0.05 * Math.cos(5 * a + 1.9));
  const heightAt = (x: number, z: number) => {
    const dx = x - cx;
    const dz = z - cz;
    const u = Math.hypot(dx, dz) / radiusAt(Math.atan2(dz, dx));
    if (u >= 1) return -0.12;
    const bump = (1 - u * u) ** 2;
    const shoulders = 1 + 0.12 * Math.sin(x * 0.13 + 1.3) * Math.cos(z * 0.11 + 0.4);
    return 13 * bump * shoulders - 0.12;
  };
  const land = new PlaneGeometry(96, 96, 64, 64);
  land.rotateX(-Math.PI / 2);
  const pos = land.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i) + cx, pos.getZ(i) + cz));
  land.computeVertexNormals();
  const dome = add(g, new Mesh(land, grass[1]));
  dome.position.set(cx, 0, cz);
  dome.receiveShadow = true;
  // A footpath winding up, as a lighter band.
  for (let t = 0; t < 1; t += 0.02) {
    const a = t * Math.PI * 3.2;
    const rr = 32 * (1 - t);
    const px = cx + Math.cos(a) * rr;
    const pz = cz + Math.sin(a) * rr * 0.88;
    add(g, box(1.6, 0.06, 1.6, mat(PALETTE.gravel), px, heightAt(px, pz) - 0.02, pz)).rotation.y = a;
  }
  for (let i = 0; i < 46; i++) {
    const a = random() * Math.PI * 2;
    const rr = 6 + random() * 26;
    const x = cx + Math.cos(a) * rr;
    const z = cz + Math.sin(a) * rr * 0.88;
    farTree(g, x, z, 1 + random() * 0.5, random, heightAt(x, z) - 0.2);
  }
  // A lattice lookout tower on top.
  const steel = mat(0x6a6e72);
  const top = heightAt(cx + 4, cz + 3) - 0.3;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(g, box(0.25, 14, 0.25, steel, cx + 4 + dx, top, cz + 3 + dz));
  for (let y = top + 2; y < top + 14; y += 3) add(g, box(2.4, 0.15, 2.4, steel, cx + 4, y, cz + 3));
  add(g, box(3.2, 0.3, 3.2, steel, cx + 4, top + 14, cz + 3));
}

// ------------------------------------------------------------------ housing

/**
 * The rest of the city, far off: plain masses with a scatter of lit windows,
 * out to the horizon, where the haze takes them. Tall behind the district
 * (north and west), low in front of it. Cheap: a few materials, merged.
 */
// Brick, ochre and plaster rather than seven greys: the far city reads as streets of different houses.
const MASS_WALLS = [0x9a8a78, 0x8a4a3c, 0xa8865a, 0x6a3e34, 0xb8ae9a, 0x7a7670, 0x7e5e4a];
const MASS_ROOFS = [0x6a3a30, 0x4a4440, 0x5a3a34];
let massCount = 0;

/**
 * A strip of windows for the far blocks' floor bands: `n` windows across, the gaps
 * see-through (alpha), so the wall shows between them. Lit bands vary each
 * window's brightness, a few left dark. At a distance the mipmaps blur a band
 * back into one strip, as the eye would.
 */
function windowStrip(n: number, random: Random, lit: boolean): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = n * 16;
  c.height = 16;
  const g = c.getContext('2d')!;
  for (let i = 0; i < n; i++) {
    const v = lit ? (random() < 0.3 ? 40 : 150 + Math.floor(random() * 105)) : 200;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(i * 16 + 3, 2, 10, 12);
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** The far blocks' window materials: set once per city by buildCityBeyond. */
let farWindows: { lit: MeshLambertMaterial[]; cool: MeshLambertMaterial[]; dark: Material } | null = null;

/** Trim, plinths and rooftop plant of the far blocks: one shared colour, so they merge with the cornices. */
const MASS_TRIM = 0x5a524a;

/**
 * One box of a far building: walls `floors` storeys high from `y0`, a band of
 * windows per floor (skipping the ground floor when it is a shop), and a
 * cornice on top.
 */
function massPart(g: Object3D, x: number, z: number, w: number, d: number, y0: number, floors: number, wall: Material, k: number, shop: boolean, random: Random, lit: Material[], cool: Material[]): void {
  const h = floors * 3;
  add(g, box(w, h, d, wall, x, y0 - 0.1, z));
  add(g, box(w + 0.3, 0.3, d + 0.3, mat(MASS_TRIM), x, y0 + h - 0.1, z));
  for (let f = shop && y0 === 0 ? 1 : 0; f < floors; f++) {
    // Two warm and one cool window material for the whole far city: a few draw calls per cell.
    // With window strips the bands read as rows of windows; without them (never here), plain bands.
    const fw = farWindows;
    const m = random() < 0.35
      ? (random() < 0.8 ? (fw ? fw.lit[(k + f) % fw.lit.length] : lit[(k + f) % 2]) : (fw ? fw.cool[0] : cool[0]))
      : (fw ? fw.dark : mat(0x26282c));
    add(g, box(w + 0.06, 1.0, d + 0.06, m, x, y0 + f * 3 + 1.1, z));
  }
}

/**
 * A far building: a plain block, a block with its top floors set back, or two
 * wings of different heights; some with a lit shop floor on a stone plinth,
 * a gable or plant and a water tank on the roof. Every piece shares the far
 * city's few materials, so a cell still merges into a handful of draw calls.
 */
function massing(g: Object3D, x: number, z: number, w: number, d: number, floors: number, random: Random, lit: Material[], cool: Material[]): void {
  const k = massCount++;
  const h = floors * 3;
  const wall = mat(MASS_WALLS[Math.floor(random() * MASS_WALLS.length)]);
  const shop = floors >= 2 && random() < 0.45;
  const form = random();
  let flatTop = h;
  if (floors >= 5 && form < 0.35) {
    // The top two floors set back from the street, as rebuilt blocks often are.
    massPart(g, x, z, w, d, 0, floors - 2, wall, k, shop, random, lit, cool);
    massPart(g, x, z - d * 0.12, w * 0.72, d * 0.66, (floors - 2) * 3, 2, wall, k + 1, false, random, lit, cool);
  } else if (floors >= 3 && form < 0.7) {
    // Two wings side by side, the lower one a storey or two down.
    const alongX = random() < 0.5;
    const split = 0.55 + random() * 0.15;
    const low = Math.max(1, floors - 1 - Math.floor(random() * 2));
    const [a, b] = alongX ? [w * split, w * (1 - split)] : [d * split, d * (1 - split)];
    const mid = alongX ? x - w / 2 : z - d / 2;
    if (alongX) {
      massPart(g, mid + a / 2, z, a, d, 0, floors, wall, k, shop, random, lit, cool);
      massPart(g, mid + a + b / 2, z, b, d, 0, low, wall, k + 1, shop, random, lit, cool);
    } else {
      massPart(g, x, mid + a / 2, w, a, 0, floors, wall, k, shop, random, lit, cool);
      massPart(g, x, mid + a + b / 2, w, b, 0, low, wall, k + 1, shop, random, lit, cool);
    }
    // The lower wing of a low house under a pitched roof.
    if (low <= 4 && random() < 0.5) {
      const roof = mat(MASS_ROOFS[k % MASS_ROOFS.length]);
      if (alongX) add(g, gableRoof(b + 0.2, d + 0.2, 2.0, roof), 0).position.set(mid + a + b / 2, low * 3 - 0.1, z);
      else add(g, gableRoof(b + 0.2, w + 0.2, 2.0, roof), Math.PI / 2).position.set(x, low * 3 - 0.1, mid + a + b / 2);
    }
  } else {
    massPart(g, x, z, w, d, 0, floors, wall, k, shop, random, lit, cool);
    if (floors <= 5 && random() < 0.6) {
      // A gable with its ridge along the longer side.
      const alongX = w >= d;
      add(g, gableRoof(alongX ? d : w, (alongX ? w : d) + 0.2, 2.4, mat(MASS_ROOFS[k % MASS_ROOFS.length])), alongX ? Math.PI / 2 : 0).position.set(x, h - 0.1, z);
      flatTop = -1;
    }
  }
  // A shop floor: a stone plinth a little proud of the wall, its windows lit.
  if (shop) {
    add(g, box(w + 0.14, 3.0, d + 0.14, mat(MASS_TRIM), x, -0.1, z));
    const fw = farWindows;
    add(g, box(w + 0.2, 1.5, d + 0.2, fw ? fw.lit[k % fw.lit.length] : lit[k % 2], x, 0.5, z));
  }
  // Plant on a flat roof: a lift housing or a water tank.
  if (flatTop > 0 && random() < 0.55) {
    const px = x + (random() - 0.5) * w * 0.4;
    const pz = z + (random() - 0.5) * d * 0.4;
    const top = floors >= 5 && form < 0.35 ? h : flatTop;
    if (random() < 0.5) add(g, box(2.2, 1.6, 1.8, mat(MASS_TRIM), px, top + 0.2, pz));
    else add(g, cylinder(0.9, 1.7, mat(MASS_TRIM), 6, px, top + 0.2, pz));
  }
}

function buildSkyline(cellAt: (x: number, z: number) => Object3D, random: Random, lit: Material[], cool: Material[]): void {
  const ox = random() * 20;
  const oz = random() * 20;
  for (let x = -260 - GROW + ox; x <= 260 + GROW; x += 20) {
    for (let z = -260 - GROW + oz; z <= 260 + GROW; z += 20) {
      if (Math.abs(x) < 170 + GROW && Math.abs(z) < 170 + GROW) continue;
      // Clear of the water, the track and the four through roads (out to the horizon) by the widest half house (8 m) and its jitter.
      if (x > RIVER.x0 - 12 && x < RIVER.x1 + 12) continue;
      if (Math.abs(z - RAIL_Z) < 12) continue;
      if ([STREETS.main, STREETS.north, STREETS.south, STREETS.east].some((st) => (st.along === 'z' ? x + 10 > st.road.x0 - 3 && x - 10 < st.road.x1 + 3 : z + 10 > st.road.z0 - 3 && z - 10 < st.road.z1 + 3))) continue;
      if (random() < 0.1) continue;
      const floors = Math.max(2, Math.min(3 + Math.floor(random() * 6), Math.floor(heightCap(x, z) / 3)));
      // Off the lattice by a metre or so, so the far rows do not read as a grid.
      massing(cellAt(x, z), x + (random() - 0.5) * 3, z + (random() - 0.5) * 3, 11 + random() * 5, 11 + random() * 5, floors, random, lit, cool);
    }
  }
}

/** Ground already taken by something else, with a little margin. */
const TAKEN: Rect[] = [
  { x0: -DISTRICT - 4, x1: DISTRICT + 4, z0: -DISTRICT - 4, z1: DISTRICT + 4 }, // the district
  { x0: DISTRICT + 2, x1: 82 + GROW, z0: -400, z1: 400 }, // promenade, river, far bank
  { x0: -DISTRICT - 2, x1: DISTRICT + 4, z0: DISTRICT + 4, z1: 120 + GROW }, // the big park
  { x0: -134 - GROW, x1: -52 - GROW, z0: -50, z1: 52 }, // the old town and the church
  { x0: -52, x1: -4, z0: -84 - GROW, z1: -60 - GROW }, // the station
  { x0: -400, x1: 400, z0: RAIL_Z - 4, z1: RAIL_Z + 4 }, // the railway
  { x0: -142 - GROW, x1: -58 - GROW, z0: -142 - GROW, z1: -58 - GROW }, // the hill
  { x0: HOSPITAL.x0 - 3, x1: HOSPITAL.x1 + 3, z0: HOSPITAL.z0 - 3, z1: HOSPITAL.z1 + 3 }, // the public hospital
  { x0: SOBERING.x0 - 2, x1: SOBERING.x1 + 2, z0: SOBERING.z0 - 2, z1: SOBERING.z1 + 2 }, // the sobering-up centre
  { x0: STATION_CAMP.x0 - 2, x1: STATION_CAMP.x1 + 2, z0: STATION_CAMP.z0, z1: STATION_CAMP.z1 + 1 }, // the station forecourt and its camp
  { x0: POLICE_STATION.x0 - 2, x1: POLICE_STATION.x1 + 2, z0: POLICE_STATION.z0, z1: POLICE_STATION.z1 + 2 }, // the police station
  CAMPUS, // the university (or, with its pack off, the housing kept for its site)
  { x0: STADIUM.x0 - 6, x1: STADIUM.x1 + 6, z0: STADIUM.z0 - 6, z1: STADIUM.z1 + 6 }, // the football stadium and its forecourt
];

/** Cuts every rect round the taken ground, keeping the free pieces `keep` accepts. */
function carve(rects: Rect[], taken: readonly Rect[], keep: (r: Rect) => boolean): Rect[] {
  const hit = (r: Rect, q: Rect) => r.x0 < q.x1 && r.x1 > q.x0 && r.z0 < q.z1 && r.z1 > q.z0;
  let out = rects;
  for (const t of taken) {
    out = out.flatMap((r) => {
      if (!hit(r, t)) return [r];
      const mx0 = Math.max(r.x0, t.x0);
      const mx1 = Math.min(r.x1, t.x1);
      return [
        { ...r, x1: t.x0 },
        { ...r, x0: t.x1 },
        { x0: mx0, x1: mx1, z0: r.z0, z1: t.z0 },
        { x0: mx0, x1: mx1, z0: t.z1, z1: r.z1 },
      ].filter((q) => q.x1 > q.x0 && q.z1 > q.z0 && keep(q));
    });
  }
  return out;
}

/**
 * Block sites on a regular lattice out to the skyline, clear of roads and of TAKEN ground, and
 * the streets between them (so the district's roads carry on into a street grid, not bare ground).
 */
function lattice(extra: readonly Rect[], random: Random): { sites: Rect[]; streets: { x: Rect[]; z: Rect[] } } {
  // The four roads out of the district split the city into strips; each strip
  // is cut into blocks that fit it exactly, so no strip is left as a sliver of
  // empty ground. Block and street sizes vary each launch.
  const main = STREETS.main.road;
  const east = STREETS.east.road;
  const north = STREETS.north.road;
  const south = STREETS.south.road;
  const xStrips: [number, number][] = [[-168 - GROW, main.x0 - 2.5], [main.x1 + 2.5, east.x0 - 2.5], [east.x1 + 2.5, 170 + GROW]];
  const zStrips: [number, number][] = [[-168 - GROW, north.z0 - 2.5], [north.z1 + 2.5, south.z0 - 2.5], [south.z1 + 2.5, 170 + GROW]];
  const cut = ([a, b]: [number, number]): [number, number][] => {
    const street = 4 + random() * 2;
    const target = 17 + random() * 9;
    const n = Math.max(1, Math.round((b - a + street) / (target + street)));
    const w = (b - a - street * (n - 1)) / n;
    return Array.from({ length: n }, (_, i) => [a + i * (w + street), a + i * (w + street) + w] as [number, number]);
  };
  const xCuts = xStrips.map(cut);
  const zCuts = zStrips.map(cut);
  const xs = xCuts.flat();
  const zs = zCuts.flat();
  const sites: Rect[] = [];
  for (const [x0, x1] of xs) for (const [z0, z1] of zs) sites.push({ x0, x1, z0, z1 });
  const taken = [...TAKEN, ...extra];
  // The street between each pair of neighbouring blocks in a strip, the length of the lattice.
  const gaps = (cuts: [number, number][][]) => cuts.flatMap((c) => c.slice(1).map((q, i) => [c[i][1], q[0]] as [number, number]));
  const [lo, hi] = [-168 - GROW, 170 + GROW];
  return {
    // Ground already taken (the river, the park, the towers...) cuts a site into
    // the free pieces round it; every piece big enough to build on is kept.
    sites: carve(sites, taken, (r) => r.x1 - r.x0 >= 7 && r.z1 - r.z0 >= 7),
    // Streets stop at taken ground too; a stub shorter than a car is dropped.
    streets: {
      x: carve(gaps(xCuts).map(([x0, x1]) => ({ x0, x1, z0: lo, z1: hi })), taken, (r) => r.z1 - r.z0 >= 6),
      z: carve(gaps(zCuts).map(([z0, z1]) => ({ x0: lo, x1: hi, z0, z1 })), taken, (r) => r.x1 - r.x0 >= 6),
    },
  };
}

/** Asphalt down every street of the lattice, with dashed centre lanes that skip the junctions. */
function buildStreets(g: Object3D, streets: { x: Rect[]; z: Rect[] }): void {
  const road = mat(0x2e2f31);
  const line = mat(0xd8d0b8);
  // Merged by 60 m cell, so the camera still skips the cells out of view.
  const cells = new Map<string, Group>();
  const cellAt = (x: number, z: number) => {
    const key = `${Math.floor(x / 60)},${Math.floor(z / 60)}`;
    let cell = cells.get(key);
    if (!cell) { cell = add(g, new Group()); cells.set(key, cell); }
    return cell;
  };
  const inside = (x: number, z: number, list: Rect[]) => list.some((r) => x > r.x0 - 1 && x < r.x1 + 1 && z > r.z0 - 1 && z < r.z1 + 1);
  for (const r of streets.x) {
    const cx = (r.x0 + r.x1) / 2;
    // Split into 60 m runs so each lands in its own cell.
    for (let z = r.z0; z < r.z1; z += 60) {
      const z1 = Math.min(r.z1, z + 60);
      const cell = cellAt(cx, (z + z1) / 2);
      add(cell, box(r.x1 - r.x0, 0.02, z1 - z, road, cx, -0.025, (z + z1) / 2));
      for (let d = z + 2; d < z1 - 1.5; d += 5) if (!inside(cx, d, streets.z)) add(cell, box(0.12, 0.004, 2.2, line, cx, -0.007, d));
    }
  }
  for (const r of streets.z) {
    const cz = (r.z0 + r.z1) / 2;
    for (let x = r.x0; x < r.x1; x += 60) {
      const x1 = Math.min(r.x1, x + 60);
      const cell = cellAt((x + x1) / 2, cz);
      // A hair lower than the cross streets, so the two never fight where they meet.
      add(cell, box(x1 - x, 0.02, r.z1 - r.z0, road, (x + x1) / 2, -0.027, cz));
      for (let d = x + 2; d < x1 - 1.5; d += 5) if (!inside(d, cz, streets.x)) add(cell, box(2.2, 0.004, 0.12, line, d, -0.007, cz));
    }
  }
  for (const cell of cells.values()) mergeStatic(cell);
}

const KIOSK_AWNINGS = [0x2e7d6b, 0xb04a3a, 0xd0a830, 0x3a6ea8, 0x7a4a8a];
/** A small street kiosk: a box with a counter, an awning and a lit window. */
function kiosk(g: Object3D, x: number, z: number, random: Random): void {
  const k = add(g, new Group());
  k.position.set(x, 0.12, z);
  k.rotation.y = Math.floor(random() * 4) * (Math.PI / 2);
  add(k, box(1.6, 2.1, 1.3, mat(0xd8d0c0), 0, 0, 0));
  add(k, box(1.4, 0.6, 0.05, glowMat(0x3a3020, 0xffd8a0, 0.5), 0, 1.1, 0.66));
  add(k, box(1.6, 0.08, 0.4, mat(0x6a5a48), 0, 0.95, 0.8));
  add(k, box(1.9, 0.08, 0.9, mat(KIOSK_AWNINGS[Math.floor(random() * KIOSK_AWNINGS.length)]), 0, 2.0, 0.6)).rotation.x = 0.25;
}

/** Blocks closer than this to the district's middle get detailed buildings; further out, plain massing. */
const NEAR_DETAIL = 95 + GROW;

function buildHousing(g: Object3D, random: Random, lit: MeshLambertMaterial[], cool: MeshLambertMaterial[], blocks: readonly Rect[], minH: number, maxH: number): void {
  const pave = mat(PALETTE.pavement);
  // Blocks merge by 60 m cell: a handful of draw calls per cell, and the
  // camera still skips cells out of view.
  const cells = new Map<string, Group>();
  const cellAt = (x: number, z: number) => {
    const key = `${Math.floor(x / 60)},${Math.floor(z / 60)}`;
    let cell = cells.get(key);
    if (!cell) { cell = add(g, new Group()); cells.set(key, cell); }
    return cell;
  };
  for (const b of blocks) {
    const cell = cellAt((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
    // A pavement slab for the block to stand on, level with the district's.
    add(cell, box(b.x1 - b.x0 + 3, 0.22, b.z1 - b.z0 + 3, pave, (b.x0 + b.x1) / 2, -0.1, (b.z0 + b.z1) / 2));
    // Capped by the block's corner nearest the district.
    const nx = Math.abs(b.x0) < Math.abs(b.x1) ? b.x0 : b.x1;
    const nz = Math.abs(b.z0) < Math.abs(b.z1) ? b.z0 : b.z1;
    const cap = Math.max(3.2, heightCap(Math.sign(b.x0) === Math.sign(b.x1) ? nx : 0, Math.sign(b.z0) === Math.sign(b.z1) ? nz : 0));
    const lo = Math.min(minH, cap);
    const hi = Math.min(maxH, cap);
    if (Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) < NEAR_DETAIL) fillCityBlock(cell, b, lit, random, lo, hi, false);
    else {
      // Far from the district: plain buildings on a grid of lots, the same height range.
      const nx = Math.max(1, Math.round((b.x1 - b.x0) / 12));
      const nz = Math.max(1, Math.round((b.z1 - b.z0) / 12));
      const lw = (b.x1 - b.x0) / nx;
      const ld = (b.z1 - b.z0) / nz;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          const floors = Math.max(1, Math.round((lo + random() * (hi - lo)) / 3));
          massing(cell, b.x0 + (i + 0.5) * lw, b.z0 + (j + 0.5) * ld, lw - 1.2, ld - 1.2, floors, random, lit, cool);
        }
      }
    }
    // Now and then a kiosk on the corner of the pavement: papers, snacks, flowers.
    if (random() < 0.45) kiosk(cell, random() < 0.5 ? b.x0 - 0.6 : b.x1 + 0.6, random() < 0.5 ? b.z0 - 0.6 : b.z1 + 0.6, random);
  }
  for (const cell of cells.values()) mergeStatic(cell);
}
