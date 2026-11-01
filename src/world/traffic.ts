/**
 * Every vehicle on the road, so none drives through another: each reports
 * where it is and which way it faces, and asks how much free road it has
 * ahead. "Ahead" means in its own lane (a slower car in front) or across
 * its path (a car in a crossing). When two cars meet at a crossing and each
 * has the other in its path, the one nearer the crossing goes first and the
 * other waits; ties go by id, so they never both stop.
 *
 * About forty vehicles at most, so a plain pairwise check (a few hundred
 * multiplies a frame) needs no spatial index.
 */
export interface TrafficCar {
  readonly id: number;
  x: number;
  z: number;
  /** Unit heading on the ground. */
  dx: number;
  dz: number;
  /** Half its length. */
  half: number;
  /** On the road this frame (parked off screen or waiting to set out: false). */
  active: boolean;
}

/** Half a lane: cars this far apart side by side pass each other. */
const HALF_LANE = 1.05;
/** Half a car's width. */
const HALF_WIDTH = 0.95;
/** How far ahead anyone looks, in metres. */
const LOOK = 30;

export type Light = 'green' | 'amber' | 'red';

/** A junction with traffic lights: its box, and the light for traffic along x and along z. */
export interface Signal {
  x0: number; x1: number; z0: number; z1: number;
  x: Light;
  z: Light;
}

export class Traffic {
  private readonly cars: TrafficCar[] = [];
  private readonly signals: Signal[] = [];
  private next = 0;

  addSignal(s: Signal): void {
    this.signals.push(s);
  }

  add(half: number): TrafficCar {
    const c: TrafficCar = { id: this.next++, x: 0, z: 0, dx: 0, dz: 1, half, active: false };
    this.cars.push(c);
    return c;
  }

  remove(c: TrafficCar): void {
    const i = this.cars.indexOf(c);
    if (i >= 0) this.cars.splice(i, 1);
  }

  /** Free road between `c`'s front bumper and whatever is in its way, in metres (Infinity: clear). */
  gapAhead(c: TrafficCar): number {
    let gap = Infinity;
    for (const o of this.cars) {
      if (o === c || !o.active) continue;
      const g = this.blocks(c, o);
      if (g === null) continue;
      // Both in each other's way (a crossing): the one nearer it goes on.
      const back = this.blocks(o, c);
      if (back !== null && Math.abs(c.dx * o.dx + c.dz * o.dz) < 0.7) {
        const mine = this.toCrossing(c, o);
        const theirs = this.toCrossing(o, c);
        if (mine < theirs || (mine === theirs && c.id < o.id)) continue;
      }
      if (g < gap) gap = g;
    }
    // A red light ahead is a stop line; on amber, only a car too close to stop goes on.
    for (const s of this.signals) {
      const alongX = Math.abs(c.dx) > 0.7;
      const light = alongX ? s.x : s.z;
      if (light === 'green') continue;
      const [pos, side, lo, hi, sideLo, sideHi, dir] = alongX
        ? [c.x, c.z, s.x0, s.x1, s.z0, s.z1, c.dx]
        : [c.z, c.x, s.z0, s.z1, s.x0, s.x1, c.dz];
      if (side < sideLo || side > sideHi) continue;
      const toLine = (dir > 0 ? lo - pos : pos - hi) - c.half;
      if (toLine < -0.3 || toLine > LOOK) continue;
      if (light === 'amber' && toLine < 3) continue;
      gap = Math.min(gap, toLine - 0.6);
    }
    return gap;
  }

  /** Free road from `c`'s front to `o` if `o` is in `c`'s way, else null. */
  private blocks(c: TrafficCar, o: TrafficCar): number | null {
    const rx = o.x - c.x;
    const rz = o.z - c.z;
    const along = rx * c.dx + rz * c.dz;
    if (along <= 0 || along > LOOK) return null;
    const side = Math.abs(rx * c.dz - rz * c.dx);
    const facing = o.dx * c.dx + o.dz * c.dz;
    // Oncoming: it keeps to the other lane, so the two pass.
    if (facing < -0.7) return null;
    const dot = Math.abs(facing);
    const cross = Math.sqrt(Math.max(0, 1 - dot * dot));
    // `o`'s extent across `c`'s lane and along it: its length when crossing, its width when in line.
    const across = cross * o.half + dot * HALF_WIDTH;
    if (side > HALF_LANE + across) return null;
    return along - c.half - (dot * o.half + cross * HALF_WIDTH);
  }

  /** How far `c` is from where its path meets `o`'s (its distance off `o`'s line). */
  private toCrossing(c: TrafficCar, o: TrafficCar): number {
    return Math.abs((c.x - o.x) * o.dz - (c.z - o.z) * o.dx);
  }
}

/** The speed to aim for with `gap` metres of free road ahead: stop 1.5 m short, ease off over the last 12. */
export function speedForGap(cruise: number, gap: number): number {
  return Math.min(cruise, Math.max(0, (gap - 1.5) * 1.3));
}
