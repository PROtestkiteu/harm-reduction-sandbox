import { Box3, Vector3, type Ray } from 'three';

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
}

/**
 * Every ordinary building the district builds registers here, so it can be
 * clicked even though its meshes are merged. Picking tests the pointer's ray
 * against these boxes: cheap, a few hundred at most.
 */
const buildings: CityBuilding[] = [];
const box = new Box3();
const hit = new Vector3();

/** Registers a building for picking; returns its id. */
export function registerBuilding(x0: number, x1: number, z0: number, z1: number, height: number, ground = false): number {
  const storeys = Math.max(1, Math.round(height / 3));
  const area = (x1 - x0) * (z1 - z0);
  const use: BuildingUse = storeys <= 1 ? 'shopfront' : storeys === 2 ? 'flats over shops' : storeys >= 4 ? 'tenement' : 'flats';
  const homesPerFloor = Math.max(1, Math.round(area / 70));
  const households = use === 'shopfront' ? 0 : homesPerFloor * (storeys - (use === 'flats over shops' ? 1 : 0));
  buildings.push({ id: buildings.length, x0, x1, z0, z1, height, storeys, use, households: ground ? 0 : households, ground });
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
