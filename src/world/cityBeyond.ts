import { Box3, CircleGeometry, ConeGeometry, CylinderGeometry, TorusGeometry, Group, IcosahedronGeometry, Mesh, PlaneGeometry, Vector3, type Material, type MeshLambertMaterial, type Object3D } from 'three';
import { fillCityBlock } from './infill';
import { PALETTE } from '../config/palette';
import type { Random } from '../sim/random';
import { WindowBank } from './animated';
import { bench, box, cylinder, gableRoof, add, streetLight, tree } from './kit';
import { registerBuilding } from './cityBuildings';
import { DISTRICT, ROAD, STREETS, type Rect } from './layout';
import { glowMat, mat, softMat } from './materials';
import { dynamic, mergeStatic } from './mergeStatic';
import { train as trainModel } from './vehicles';
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
  /** Building ids of the public hospital and the sobering-up centre, for their cards. */
  landmarks: { hospital: number; sobering: number };
}

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
const RIVER = { x0: 56, x1: 76 };
/** The railway runs east to west north of the district. */
const RAIL_Z = -64;

export function buildCityBeyond(scene: Object3D, random: Random): CityBeyond {
  const g = add(scene, new Group());
  // The simple trees go in their own group: hidden when the kit's trees arrive.
  treeSpots.length = 0;
  // Kept out of the scene-wide merge (dynamic), so it can be hidden as a whole.
  treeGroup = add(scene, dynamic(new Group()));
  farTreeGroup = add(scene, dynamic(new Group()));
  const lit = Array.from({ length: 8 }, () => glowMat(0x20242a, PALETTE.warmWindow, 0.7));
  const cool = Array.from({ length: 6 }, () => glowMat(0x1e242c, PALETTE.coolWindow, 0.8));
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
  const sites = lattice(towers, random);
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
    windows: [new WindowBank(lit, 0.75, 0.05, random), new WindowBank(cool, 0.9, 0.08, random), new WindowBank(towerGlass, 0.95, 0.75, random)],
    update: (dt) => station.update(dt),
    landmarks,
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
          const x = -44 + random() * 92;
          const z = 52 + random() * 64;
          if (Math.abs(z - 76.6) < 2.5 || Math.abs(x - 12.6) < 2.5 || Math.hypot((x - 34) / 13, (z - 96) / 9) < 1) continue;
          if (Math.abs(x - (ROAD.x0 + ROAD.x1) / 2) < 6 || (x > 21 && x < 33)) continue;
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
  const water = glowMat(0x1e3440, 0x0a1a24, 0.6);
  const stone = mat(0x6e6a62);
  const paving = mat(PALETTE.pavementAlt);
  const grass = mat(PALETTE.grassDark);
  const w = RIVER.x1 - RIVER.x0;
  // Water a hair above the ground plane, walled in by stone embankments.
  flat(g, w, 260, water, (RIVER.x0 + RIVER.x1) / 2, 0, LAYER.water);
  for (const x of [RIVER.x0, RIVER.x1]) add(g, box(0.6, 0.5, 260, stone, x, -0.1, 0));
  // Promenade on the city side: paving, a lamp and a tree every so often, benches facing the water.
  flat(g, RIVER.x0 - EDGE - 2.3, 260, paving, (EDGE + 2 + RIVER.x0 - 0.3) / 2, 0, LAYER.promenade);
  for (let z = -120; z <= 120; z += 10) {
    if (Math.abs(z - (STREETS.north.road.z0 + STREETS.north.road.z1) / 2) < 6 || Math.abs(z - (STREETS.south.road.z0 + STREETS.south.road.z1) / 2) < 6 || Math.abs(z - RAIL_Z) < 6) continue;
    add(g, tree((z / 10) % 2 ? 0 : 3, 0.9 + random() * 0.3)).position.set(RIVER.x0 - 3.5, 0, z);
    if ((z / 10) % 2) add(g, bench(), Math.PI / 2).position.set(RIVER.x0 - 1.4, 0, z + 4);
    else add(g, streetLight(-1).group).position.set(RIVER.x0 - 1.0, 0, z + 5);
  }
  // Far bank: a strip of meadow.
  flat(g, 5.7, 260, grass, RIVER.x1 + 3.15, 0, LAYER.grass);
  // Road bridges where the cross streets meet the river, with railings.
  const deck = mat(0x5a5650);
  const rail = mat(PALETTE.metal);
  for (const s of [STREETS.north, STREETS.south]) {
    const z0 = s.road.z0 - 2.5;
    const z1 = s.road.z1 + 2.5;
    const cz = (z0 + z1) / 2;
    add(g, box(w + 2, 0.45, z1 - z0, deck, (RIVER.x0 + RIVER.x1) / 2, -0.08, cz));
    for (const z of [z0 + 0.1, z1 - 0.1]) add(g, box(w + 2, 0.9, 0.08, rail, (RIVER.x0 + RIVER.x1) / 2, 0.37, z));
    // Piers in the water.
    for (const x of [RIVER.x0 + w / 3, RIVER.x0 + (2 * w) / 3]) add(g, box(1.2, 0.5, z1 - z0, stone, x, -0.4, cz));
  }
}

// ------------------------------------------------------------------ park

function buildPark(g: Object3D, random: Random, onRoad: (x: number, z: number, w: number, d: number) => boolean): void {
  const z0 = EDGE + 3;
  const z1 = 118;
  const x0 = -EDGE + 2;
  // Up to the promenade, never under it: overlapping flats flicker.
  const x1 = EDGE + 1.9;
  const lawn = mat(PALETTE.grass);
  const path = mat(PALETTE.gravel);
  flat(g, x1 - x0, z1 - z0, lawn, (x0 + x1) / 2, (z0 + z1) / 2, LAYER.grass);
  // Paths: one along the park, one across, and a loop round the pond.
  flat(g, x1 - x0, 3, path, (x0 + x1) / 2, 76, LAYER.path);
  flat(g, 3, z1 - z0, path, 12, (z0 + z1) / 2, LAYER.path);
  // The pond, with a stone rim.
  const pond = add(g, new Mesh(new IcosahedronGeometry(1, 1), glowMat(0x22404c, 0x0c2028, 0.5)));
  pond.scale.set(11, 0.01, 7);
  pond.position.set(34, LAYER.path + 0.015, 96);
  const rim = add(g, new Mesh(new IcosahedronGeometry(1, 1), mat(0x7a756a)));
  rim.scale.set(11.8, 0.012, 7.8);
  rim.position.set(34, LAYER.path - 0.004, 96);
  // A fountain where the paths cross.
  add(g, cylinder(2.2, 0.5, mat(0x8a857a), 16, 12, -0.02, 76));
  add(g, cylinder(1.8, 0.05, glowMat(0x3a5a68, 0x1a3a48, 0.6), 16, 12, 0.46, 76));
  add(g, cylinder(0.3, 1.6, mat(0x8a857a), 8, 12, 0, 76));
  // A playground: a frame, a slide and sandpit.
  const red = mat(0xb04a3a);
  const yellow = mat(0xd0a830);
  flat(g, 5, 4, mat(0xc8b48a), -24, 92, LAYER.path);
  for (const x of [-26, -22]) add(g, box(0.15, 2.4, 0.15, red, x, 0, 91));
  add(g, box(4.3, 0.15, 0.15, red, -24, 2.3, 91));
  add(g, box(1.2, 1.6, 1.2, yellow, -23, 0, 93.5));
  add(g, box(0.8, 0.1, 2.6, yellow, -21.6, 0.8, 93.5)).rotation.x = -0.5;
  // Benches along the main path.
  for (let x = x0 + 6; x < x1 - 4; x += 9) if (!onRoad(x, 78.6, 2, 1)) add(g, bench(), Math.PI).position.set(x, 0, 78.6);
  // Trees: full ones near the district, simple far ones further out.
  for (let i = 0; i < 90; i++) {
    const x = x0 + 2 + random() * (x1 - x0 - 4);
    const z = z0 + 2 + random() * (z1 - z0 - 4);
    if (onRoad(x, z, 3, 3) || Math.abs(z - 76) < 3 || Math.abs(x - 12) < 3) continue;
    if (Math.hypot((x - 34) / 13, (z - 96) / 9) < 1) continue;
    if (x > -28 && x < -19 && z > 88 && z < 96) continue;
    if (z < 70 && i % 3 === 0) add(g, tree(pick4(random), 1 + random() * 0.4)).position.set(x, 0, z);
    else farTree(g, x, z, 1 + random() * 0.6, random);
  }
}

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

function buildRailway(g: Object3D): { update(dt: number): void } {
  const ballast = mat(0x5a5048);
  const steel = mat(0x8a8a86);
  const sleeper = mat(0x4a3a30);
  // Track bed across the whole city, with two rails, crossing the river on a bridge.
  add(g, box(400, 0.19, 5, ballast, 0, -0.1, RAIL_Z));
  for (const dz of [-0.75, 0.75]) add(g, box(400, 0.1, 0.08, steel, 0, 0.09, RAIL_Z + dz));
  for (let x = -198; x < 200; x += 1.6) add(g, box(0.25, 0.05, 2.2, sleeper, x, 0.06, RAIL_Z));
  const truss = mat(0x4a5258);
  for (const dz of [-2.6, 2.6]) {
    add(g, box(RIVER.x1 - RIVER.x0 + 2, 0.3, 0.3, truss, (RIVER.x0 + RIVER.x1) / 2, 2.6, RAIL_Z + dz));
    for (let x = RIVER.x0; x <= RIVER.x1; x += 4) add(g, box(0.25, 2.8, 0.25, truss, x, 0, RAIL_Z + dz));
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
  train.position.set(-220, 0, RAIL_Z);
  g.parent!.add(dynamic(train)); // moving: kept out of the static merge
  let t = 0;
  const run = 260; // metres from start to end
  return {
    update(dt) {
      // About a minute and a half per pass: in, a stop at the platform, out, a pause off screen.
      t = (t + dt) % 90;
      const stopAt = sx - 34 + 220; // distance where the train's middle meets the platform
      let d: number;
      if (t < 25) d = (t / 25) ** 0.8 * stopAt;
      else if (t < 37) d = stopAt;
      else if (t < 62) d = stopAt + ((t - 37) / 25) ** 1.25 * (run + 220 - stopAt);
      else d = -400;
      train.visible = d > -1;
      train.position.x = -220 + Math.max(0, d);
    },
  };
}

// ------------------------------------------------------------------ hospital and sobering-up centre

/** The public hospital across the river, east of the district; the sobering-up centre by the railway, north. */
const HOSPITAL = { x0: 88, x1: 124, z0: -30, z1: 2 };
const SOBERING = { x0: 30, x1: 44, z0: -59, z1: -51 };

function buildLandmarks(g: Object3D, lit: MeshLambertMaterial[]): { hospital: number; sobering: number } {
  const white = mat(0xdadcd8);
  const trim = mat(0x8a929a);
  const red = glowMat(0x9a2a2a, 0xff4a3a, 0.6);
  // Hospital: a long main block, a taller ward wing with a helipad, an A&E canopy facing the river.
  const h = HOSPITAL;
  const cx = (h.x0 + h.x1) / 2;
  const cz = (h.z0 + h.z1) / 2;
  add(g, box(h.x1 - h.x0 + 4, 0.22, h.z1 - h.z0 + 4, mat(PALETTE.pavement), cx, -0.1, cz));
  add(g, box(h.x1 - h.x0, 12, 14, white, cx, 0, h.z1 - 7));
  add(g, box(16, 24, h.z1 - h.z0 - 10, white, h.x0 + 10, 0, h.z0 + (h.z1 - h.z0 - 10) / 2));
  for (const [x, z, w, d, top] of [[cx, h.z1 - 7, h.x1 - h.x0, 14, 12], [h.x0 + 10, h.z0 + (h.z1 - h.z0 - 10) / 2, 16, h.z1 - h.z0 - 10, 24]] as const) {
    add(g, box(w + 0.4, 0.5, d + 0.4, trim, x, top, z));
    for (let y = 1.4; y < top - 1; y += 3.2) add(g, box(w + 0.06, 1.1, d + 0.06, lit[Math.floor(y) % 2], x, y, z));
  }
  add(g, cylinder(4, 0.2, mat(0x4a5058), 16, h.x0 + 10, 24.5, h.z0 + 8));
  add(g, box(5, 0.05, 1, mat(0xf0f0f0), h.x0 + 10, 24.72, h.z0 + 8));
  add(g, box(1, 0.05, 5, mat(0xf0f0f0), h.x0 + 10, 24.72, h.z0 + 8));
  add(g, box(10, 0.3, 4, mat(0x9a3a34), h.x0 - 1, 3.2, h.z1 - 3));
  add(g, box(3.4, 3.4, 0.4, red, h.x0 + 18, 12.6, h.z1 + 0.1));
  add(g, box(1.1, 3.4, 0.45, white, h.x0 + 18, 12.6, h.z1 + 0.1));
  add(g, box(3.4, 1.1, 0.45, white, h.x0 + 18, 13.75, h.z1 + 0.1));
  const hospital = registerBuilding(h.x0, h.x1, h.z0, h.z1, 24);
  // Sobering-up centre: a plain two-storey municipal block with a blue lamp and barred windows.
  const s = SOBERING;
  const sx = (s.x0 + s.x1) / 2;
  const sz = (s.z0 + s.z1) / 2;
  add(g, box(s.x1 - s.x0 + 3, 0.22, s.z1 - s.z0 + 3, mat(PALETTE.pavement), sx, -0.1, sz));
  add(g, box(s.x1 - s.x0, 6.4, s.z1 - s.z0, mat(0xb8b0a0), sx, 0, sz));
  add(g, box(s.x1 - s.x0 + 0.3, 0.4, s.z1 - s.z0 + 0.3, trim, sx, 6.4, sz));
  for (const y of [1.2, 4.2]) add(g, box(s.x1 - s.x0 - 1, 1.1, s.z1 - s.z0 + 0.06, lit[2], sx, y, sz));
  add(g, box(1.6, 2.4, 0.2, mat(0x3a3a3a), sx, 0, s.z1 + 0.05));
  add(g, box(0.5, 0.5, 0.5, glowMat(0x2a3a7a, 0x5a8aff, 1.2), sx + 1.4, 2.8, s.z1 + 0.3));
  const sobering = registerBuilding(s.x0, s.x1, s.z0, s.z1, 6.4);
  return { hospital, sobering };
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
    for (let z = -96 + oz; z >= -150 + oz; z -= 26) {
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
  const sqx = -78;
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
  const cx = -118;
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
    if (!onRoad(-91, z, 76, 11)) add(g, box(78, 0.14, 11.5, pave, -91, -0.12, z));
    flat(g, 78, 2.2, cobbles, -91, z + 6.6, LAYER.path);
  }
  for (let z = -46; z <= 48; z += 13) {
    for (let x = -54; x >= -128; x -= 4.6) {
      const w = 4.2;
      const d = 9;
      if (onRoad(x, z, w, d)) continue;
      if (Math.abs(x - sqx) < 15 && Math.abs(z - sqz) < 13) continue;
      if (Math.abs(x - cx) < 13 && Math.abs(z - cz) < 18) continue;
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
  const cx = -100;
  const cz = -100;
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
const MASS_WALLS = [0x9a8a78, 0xa8987e, 0x8a7a6a, 0xb0a088, 0x7a6e62, 0x9a7a6a, 0x8a8a7e];
const MASS_ROOFS = [0x6a3a30, 0x4a4440, 0x5a3a34];
let massCount = 0;

/**
 * A plain building for the far city: a wall box, a trim, sometimes a gable
 * roof, and one band of windows per floor wrapped round all four faces (one
 * box, some floors lit). Seen from afar it reads as a city block; it costs a
 * few dozen triangles.
 */
function massing(g: Object3D, x: number, z: number, w: number, d: number, floors: number, random: Random, lit: Material[], cool: Material[]): void {
  const k = massCount++;
  const h = floors * 3;
  add(g, box(w, h, d, mat(MASS_WALLS[k % MASS_WALLS.length]), x, -0.1, z));
  add(g, box(w + 0.3, 0.3, d + 0.3, mat(0x5a524a), x, h - 0.1, z));
  if (floors <= 5 && random() < 0.6) add(g, gableRoof(d, w + 0.2, 2.4, mat(MASS_ROOFS[k % MASS_ROOFS.length])), Math.PI / 2).position.set(x, h - 0.1, z);
  for (let f = 0; f < floors; f++) {
    // Two warm and one cool window material for the whole far city: a few draw calls per cell.
    const m = random() < 0.35 ? (random() < 0.8 ? lit[(k + f) % 2] : cool[0]) : mat(0x26282c);
    add(g, box(w + 0.06, 1.0, d + 0.06, m, x, f * 3 + 1.1, z));
  }
}

function buildSkyline(cellAt: (x: number, z: number) => Object3D, random: Random, lit: Material[], cool: Material[]): void {
  const ox = random() * 20;
  const oz = random() * 20;
  for (let x = -260 + ox; x <= 260; x += 20) {
    for (let z = -260 + oz; z <= 260; z += 20) {
      if (Math.abs(x) < 170 && Math.abs(z) < 170) continue;
      if (x > RIVER.x0 - 4 && x < RIVER.x1 + 4) continue;
      if (Math.abs(z - RAIL_Z) < 6) continue;
      if (random() < 0.1) continue;
      const floors = Math.max(2, Math.min(3 + Math.floor(random() * 6), Math.floor(heightCap(x, z) / 3)));
      massing(cellAt(x, z), x, z, 11 + random() * 5, 11 + random() * 5, floors, random, lit, cool);
    }
  }
}

/** Ground already taken by something else, with a little margin. */
const TAKEN: Rect[] = [
  { x0: -49, x1: 49, z0: -49, z1: 49 }, // the district
  { x0: 47, x1: 82, z0: -400, z1: 400 }, // promenade, river, far bank
  { x0: -47, x1: 49, z0: 49, z1: 120 }, // the big park
  { x0: -134, x1: -52, z0: -50, z1: 52 }, // the old town and the church
  { x0: -52, x1: -4, z0: -84, z1: -60 }, // the station
  { x0: -400, x1: 400, z0: RAIL_Z - 4, z1: RAIL_Z + 4 }, // the railway
  { x0: -142, x1: -58, z0: -142, z1: -58 }, // the hill
  { x0: HOSPITAL.x0 - 3, x1: HOSPITAL.x1 + 3, z0: HOSPITAL.z0 - 3, z1: HOSPITAL.z1 + 3 }, // the public hospital
  { x0: SOBERING.x0 - 2, x1: SOBERING.x1 + 2, z0: SOBERING.z0 - 2, z1: SOBERING.z1 + 2 }, // the sobering-up centre
];

/** Block sites on a regular lattice out to the skyline, clear of roads and of TAKEN ground. */
function lattice(extra: readonly Rect[], random: Random): Rect[] {
  // The four roads out of the district split the city into strips; each strip
  // is cut into blocks that fit it exactly, so no strip is left as a sliver of
  // empty ground. Block and street sizes vary each launch.
  const main = STREETS.main.road;
  const east = STREETS.east.road;
  const north = STREETS.north.road;
  const south = STREETS.south.road;
  const xStrips: [number, number][] = [[-168, main.x0 - 2.5], [main.x1 + 2.5, east.x0 - 2.5], [east.x1 + 2.5, 170]];
  const zStrips: [number, number][] = [[-168, north.z0 - 2.5], [north.z1 + 2.5, south.z0 - 2.5], [south.z1 + 2.5, 170]];
  const cut = ([a, b]: [number, number]): [number, number][] => {
    const street = 4 + random() * 2;
    const target = 17 + random() * 9;
    const n = Math.max(1, Math.round((b - a + street) / (target + street)));
    const w = (b - a - street * (n - 1)) / n;
    return Array.from({ length: n }, (_, i) => [a + i * (w + street), a + i * (w + street) + w] as [number, number]);
  };
  const xs = xStrips.flatMap(cut);
  const zs = zStrips.flatMap(cut);
  const hit = (r: Rect, q: Rect) => r.x0 < q.x1 && r.x1 > q.x0 && r.z0 < q.z1 && r.z1 > q.z0;
  const big = (r: Rect) => r.x1 - r.x0 >= 7 && r.z1 - r.z0 >= 7;
  let sites: Rect[] = [];
  for (const [x0, x1] of xs) for (const [z0, z1] of zs) sites.push({ x0, x1, z0, z1 });
  // Ground already taken (the river, the park, the towers...) cuts a site into
  // the free pieces round it; every piece big enough to build on is kept.
  for (const t of [...TAKEN, ...extra]) {
    sites = sites.flatMap((r) => {
      if (!hit(r, t)) return [r];
      const mx0 = Math.max(r.x0, t.x0);
      const mx1 = Math.min(r.x1, t.x1);
      return [
        { ...r, x1: t.x0 },
        { ...r, x0: t.x1 },
        { x0: mx0, x1: mx1, z0: r.z0, z1: t.z0 },
        { x0: mx0, x1: mx1, z0: t.z1, z1: r.z1 },
      ].filter((p) => p.x1 > p.x0 && p.z1 > p.z0 && big(p));
    });
  }
  return sites;
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
const NEAR_DETAIL = 95;

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
