/** Where the player is looking, as the sound needs it: a point on the ground, which way is screen-right, and how much is in view. */
export interface Listener {
  x: number;
  z: number;
  /** Screen-right on the ground (unit length). */
  rightX: number;
  rightZ: number;
  /** Half the view's width in metres: small when zoomed in. */
  half: number;
}

/** A placed sound's pan (-1 left to 1 right) and how near it is (0 far to 1 in the middle of the view). */
export interface Placed { pan: number; near: number }

const out: Placed = { pan: 0, near: 0 };

/**
 * Pan and nearness of a sound at (x, z) for the listener. Nearness falls off
 * as a bell curve (so nothing carries far) with distance measured against the
 * view's size, so zooming out brings far things in but each one quieter; the
 * result object is reused.
 */
export function place(l: Listener, x: number, z: number, reach = 1): Placed {
  const dx = x - l.x;
  const dz = z - l.z;
  const d = Math.hypot(dx, dz);
  const r = (6 + l.half * 0.7) * reach;
  out.near = Math.exp(-((d / r) ** 2)) * Math.min(1, 34 / l.half) ** 0.5;
  out.pan = Math.max(-0.85, Math.min(0.85, (dx * l.rightX + dz * l.rightZ) / (l.half * 1.2)));
  return out;
}

/** Nearness to a line along z at x (a river) or along x at z (a railway): the nearest point on it. */
export function placeLine(l: Listener, along: 'x' | 'z', at: number, reach = 1): Placed {
  return along === 'z' ? place(l, at, l.z, reach) : place(l, l.x, at, reach);
}

/** How close-up the view is, 0 (whole city) to 1 (a street corner): small sounds like footsteps carry only close up. */
export function closeness(l: Listener): number {
  return Math.min(1, Math.max(0, (60 - l.half) / 45));
}
