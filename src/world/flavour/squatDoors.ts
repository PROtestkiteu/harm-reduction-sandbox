import { cityBuilding, frontDoor } from '../cityBuildings';
import { EDGES, NODES } from '../layout';
import type { SquatDoor } from './index';

/**
 * Where a squat's door is: its street door, on its front (the crowd uses the
 * same door for people moving in), with the wall's direction and
 * its outward normal, so people can sit along the wall either side of it.
 */
export function squatDoors(buildings: readonly number[]): SquatDoor[] {
  const out: SquatDoor[] = [];
  for (const id of buildings) {
    const b = cityBuilding(id);
    if (!b) continue;
    // The street door on its front, and that wall's outward normal.
    const { door, normal } = frontDoor(b, 0.6);
    const nx = Math.round(normal.x);
    const nz = Math.round(normal.z);
    out.push({ x: door.x, z: door.z, ax: nz !== 0 ? 1 : 0, az: nx !== 0 ? 1 : 0, nx, nz });
  }
  return out;
}

/** Half the side step walkers keep from a pavement's centreline (crowd.ts gives each up to 0.45 m). */
const BAND = 0.45;

/**
 * Whether someone of radius `r` sitting at (x, z) is clear of the crowd's
 * walking lines and of every building's footprint. Squats can stand on a
 * corner, where seats along the wall would reach round into the next building
 * or onto a busy pavement; those seats are left empty.
 */
export function seatClear(x: number, z: number, r = 0.35): boolean {
  for (const [a, b] of EDGES) {
    const p = NODES[a];
    const q = NODES[b];
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    const t = Math.max(0, Math.min(1, ((x - p.x) * dx + (z - p.z) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(x - p.x - t * dx, z - p.z - t * dz) < BAND + r) return false;
  }
  for (let id = 0; ; id++) {
    const bd = cityBuilding(id);
    if (!bd) return true;
    if (x > bd.x0 && x < bd.x1 && z > bd.z0 && z < bd.z1) return false;
  }
}
