import { nearestNode } from '../../agents/nav';
import { cityBuilding } from '../cityBuildings';
import { NODES } from '../layout';
import type { SquatDoor } from './index';

/**
 * Where a squat's door is: on the wall nearest the pavement it faces (the
 * crowd uses the same rule for people moving in), with the wall's direction and
 * its outward normal, so people can sit along the wall either side of it.
 */
export function squatDoors(buildings: readonly number[]): SquatDoor[] {
  const out: SquatDoor[] = [];
  for (const id of buildings) {
    const b = cityBuilding(id);
    if (!b) continue;
    const node = NODES[nearestNode({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 })];
    const wall = { x: Math.min(b.x1, Math.max(b.x0, node.x)), z: Math.min(b.z1, Math.max(b.z0, node.z)) };
    // The face the door is on: whichever side the pavement point lies beyond.
    const onX = node.x <= b.x0 || node.x >= b.x1;
    const nx = onX ? Math.sign(node.x - wall.x) || 1 : 0;
    const nz = onX ? 0 : Math.sign(node.z - wall.z) || 1;
    out.push({ x: wall.x + nx * 0.6, z: wall.z + nz * 0.6, ax: nz !== 0 ? 1 : 0, az: nx !== 0 ? 1 : 0, nx, nz });
  }
  return out;
}
