import { Vector3, type Camera } from 'three';

/**
 * Whether something on the ground could show on screen, so traffic sets out
 * and leaves only where nobody sees it: vehicles, boats and walkers appear
 * and vanish off screen, never in view. A test projects a few points with the
 * camera's current matrices; nothing runs per frame unless a mover asks.
 */
let camera: Camera | null = null;
const v = new Vector3();
/** A touch past the screen edge, in clip space, so a mirror or a bumper never peeks in. */
const MARGIN = 1.06;

export function watchCamera(c: Camera): void {
  camera = c;
}

/**
 * True when a body at (x, z) facing (dx, dz), `half` long either way and `h`
 * tall, may be on screen. Without a camera yet, everything counts as seen.
 */
export function inView(x: number, z: number, dx = 0, dz = 0, half = 0, h = 4, y = 0): boolean {
  if (!camera) return true;
  for (let end = -1; end <= 1; end += 2) {
    for (let k = 0; k <= 1; k++) {
      v.set(x + dx * half * end, y + k * h, z + dz * half * end).project(camera);
      if (Math.abs(v.x) < MARGIN && Math.abs(v.y) < MARGIN) return true;
    }
  }
  return false;
}
