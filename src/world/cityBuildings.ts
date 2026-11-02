import { Box3, Vector3, type Ray } from 'three';
import { NODES, SIDE_NORMAL, SIDE_ROT, crossesRoad, nearestNodeTo, type NodeId, type P2, type Side } from './layout';

/** What an ordinary building is used for, judged from its size and street. */
export type BuildingUse = 'shopfront' | 'flats over shops' | 'flats' | 'tenement';

/** An ordinary (not playable) building, for picking and its info card. */
export interface CityBuilding {
  readonly id: number;
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly height: number;
  readonly storeys: number;
  readonly use: BuildingUse;
  /** Households, from floor area and storeys (illustrative). */
  readonly households: number;
  /** Kept out of lettings, venues and harm reduction points: open ground (a tent camp) or a fixed business (the pharmacy). */
  readonly ground?: boolean;
  /** The side its front, street door and shopfronts face, when the builder knows its street. */
  readonly front?: Side;
  /** Its roof, when the builder knows it: flat (with a parapet), pitched (tiles, ridge along the longer side) or mansard. */
  readonly roof?: RoofKind;
}

export type RoofKind = 'flat' | 'pitched' | 'mansard';

/**
 * Every ordinary building the district builds registers here, so it can be
 * clicked even though its meshes are merged. Picking tests the pointer's ray
 * against these boxes: cheap, a few hundred at most.
 */
const buildings: CityBuilding[] = [];
const box = new Box3();
const hit = new Vector3();

/** Registers a building for picking; returns its id. */
export function registerBuilding(x0: number, x1: number, z0: number, z1: number, height: number, ground = false, front?: Side, roof?: RoofKind): number {
  const storeys = Math.max(1, Math.round(height / 3));
  const area = (x1 - x0) * (z1 - z0);
  const use: BuildingUse = storeys <= 1 ? 'shopfront' : storeys === 2 ? 'flats over shops' : storeys >= 4 ? 'tenement' : 'flats';
  const homesPerFloor = Math.max(1, Math.round(area / 70));
  const households = use === 'shopfront' ? 0 : homesPerFloor * (storeys - (use === 'flats over shops' ? 1 : 0));
  buildings.push({ id: buildings.length, x0, x1, z0, z1, height, storeys, use, households: ground ? 0 : households, ground, front, roof });
  return buildings.length - 1;
}

/** Every ordinary building (camps and fixed businesses left out). */
export function allBuildings(): readonly CityBuilding[] {
  return buildings.filter((b) => !b.ground);
}

export function cityBuilding(id: number): CityBuilding | undefined {
  return buildings[id];
}

/** The nearest building the ray hits, and how far along the ray. */
export function pickBuilding(ray: Ray): { building: CityBuilding; distance: number } | null {
  let best: { building: CityBuilding; distance: number } | null = null;
  for (const b of buildings) {
    box.min.set(b.x0, 0, b.z0);
    box.max.set(b.x1, b.height + 0.12, b.z1);
    if (!ray.intersectBox(box, hit)) continue;
    const distance = hit.distanceTo(ray.origin);
    if (!best || distance < best.distance) best = { building: b, distance };
  }
  return best;
}

/** How far along the front wall, from its middle towards its right-hand end, the street door is built (infill.ts). */
export const DOOR_ALONG = 1.0;

/**
 * The side a building's front is on: the one it was built with, or for a
 * building without one, the side the nearest walkway point lies beyond.
 */
export function frontSide(b: CityBuilding): Side {
  if (b.front) return b.front;
  const node = NODES[nearestNodeTo({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 })];
  if (node.x <= b.x0 || node.x >= b.x1) return node.x >= b.x1 ? '+x' : '-x';
  return node.z >= (b.z0 + b.z1) / 2 ? '+z' : '-z';
}

/**
 * Where people go in at a building's street door, `out` metres out from the
 * wall, with the wall's outward normal. A building built with a front has its
 * door drawn there; one without gets the point on its wall nearest the walkway.
 */
export function frontDoor(b: CityBuilding, out: number): { door: P2; normal: P2 } {
  const cx = (b.x0 + b.x1) / 2;
  const cz = (b.z0 + b.z1) / 2;
  if (!b.front) {
    const node = NODES[nearestNodeTo({ x: cx, z: cz })];
    const wall = { x: Math.min(b.x1, Math.max(b.x0, node.x)), z: Math.min(b.z1, Math.max(b.z0, node.z)) };
    const away = Math.hypot(node.x - wall.x, node.z - wall.z) || 1;
    const normal = { x: (node.x - wall.x) / away, z: (node.z - wall.z) / away };
    return { door: { x: wall.x + normal.x * out, z: wall.z + normal.z * out }, normal };
  }
  const normal = SIDE_NORMAL[b.front];
  // Along the front to its right as seen from the street: the local +x of a design facing +z, turned to the front.
  const right = { x: normal.z, z: -normal.x };
  const half = (normal.x ? b.z1 - b.z0 : b.x1 - b.x0) / 2;
  const depth = (normal.x ? b.x1 - b.x0 : b.z1 - b.z0) / 2;
  const along = Math.max(0, half - DOOR_ALONG);
  return { door: { x: cx + right.x * along + normal.x * (depth + out), z: cz + right.z * along + normal.z * (depth + out) }, normal };
}

/**
 * A frame on a building's front wall for dressing built facing +z: (x, z) the
 * wall's middle at ground level, `rot` its turn about y, `width` the wall's length.
 */
export function frontFrame(b: CityBuilding): { x: number; z: number; rot: number; width: number } {
  const side = frontSide(b);
  const n = SIDE_NORMAL[side];
  const depth = (n.x ? b.x1 - b.x0 : b.z1 - b.z0) / 2;
  return { x: (b.x0 + b.x1) / 2 + n.x * depth, z: (b.z0 + b.z1) / 2 + n.z * depth, rot: SIDE_ROT[side], width: n.x ? b.z1 - b.z0 : b.x1 - b.x0 };
}

/** True when walking straight from `a` to `b` keeps out of every building and, if `zebras`, crosses no road away from a zebra. */
function clearWalk(a: P2, b: P2, zebras: boolean): boolean {
  if (zebras && crossesRoad(a, b)) return false;
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.4);
  for (let i = 1; i < steps; i++) {
    const x = a.x + ((b.x - a.x) * i) / steps;
    const z = a.z + ((b.z - a.z) * i) / steps;
    for (const o of buildings) if (!o.ground && x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1) return false;
  }
  return true;
}

/** How far out from the door the approach comes in along the pavement. */
const KERB = 1.6;
/** A way in to a door: from walk node `node` through `way`, the door last. */
export interface DoorApproach { node: NodeId; way: P2[] }
const approaches = new Map<number, DoorApproach>();

/**
 * The way in to a building's street door from the walk graph: the walk node
 * to come from and the points to walk through after it, ending at the door
 * (`out` metres from the wall). It comes along the pavement in front, round one
 * corner where a straight line from the node would cut through buildings,
 * crossing roads at zebras where it can and straight over where it cannot.
 * Fixed once the city is built, so it is worked out once per building.
 */
export function doorApproach(b: CityBuilding, out: number): DoorApproach {
  const key = b.id * 16 + Math.round(out * 10);
  const known = approaches.get(key);
  if (known) return known;
  const { door, normal } = frontDoor(b, out);
  const kerb = { x: door.x + normal.x * KERB, z: door.z + normal.z * KERB };
  const id = nearestNodeTo(kerb);
  const node = NODES[id];
  const corners = [{ x: node.x, z: kerb.z }, { x: kerb.x, z: node.z }];
  let way = [kerb, door];
  for (const zebras of [true, false]) {
    if (clearWalk(node, kerb, zebras)) break;
    const corner = corners.find((c) => clearWalk(node, c, zebras) && clearWalk(c, kerb, zebras));
    if (corner) { way = [corner, kerb, door]; break; }
  }
  const approach = { node: id, way };
  approaches.set(key, approach);
  return approach;
}
