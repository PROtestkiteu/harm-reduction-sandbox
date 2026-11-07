import type { PatrolSpot } from '../config/patrol';

type Point = { x: number; z: number };

/** Camp dispatch belongs to the camp; guided play does not offer street dispatch. */
export function patrolMapTarget(tutorial: boolean, ground: Point | null, crisis: Point | null, camp: Point, selectedCamp = false): { spot: PatrolSpot; at: Point } | null {
  if (!ground) return null;
  if (selectedCamp) return { spot: 'camp', at: { ...camp } };
  if (tutorial) return null;
  return crisis ? { spot: 'daemon', at: { ...crisis } } : { spot: 'street', at: { ...ground } };
}
