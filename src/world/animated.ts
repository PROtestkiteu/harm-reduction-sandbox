import type { MeshLambertMaterial } from 'three';

/** Frame-rate independent exponential approach. */
export function approach(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

/** Door that opens on request and closes again after a hold time. */
export class DoorState {
  openness = 0;
  private hold = 0;

  request(holdSeconds = 1.4): void {
    this.hold = Math.max(this.hold, holdSeconds);
  }

  update(dt: number): number {
    this.hold = Math.max(0, this.hold - dt);
    this.openness = approach(this.openness, this.hold > 0 ? 1 : 0, 7, dt);
    return this.openness;
  }
}

/**
 * A set of window materials whose lights switch on and off at random, slow
 * intervals. `occupancy` (0..1) biases how many are lit, so a staffed building
 * reads as busier without any window snapping in unison.
 */
export class WindowBank {
  private readonly lit: boolean[];
  private readonly timers: number[];
  private readonly current: number[];

  constructor(
    private readonly mats: MeshLambertMaterial[],
    private readonly onIntensity: number,
    private readonly offIntensity: number,
    private readonly random: () => number,
  ) {
    this.lit = mats.map(() => random() < 0.5);
    this.timers = mats.map(() => 2 + random() * 10);
    this.current = mats.map((_, i) => (this.lit[i] ? onIntensity : offIntensity));
  }

  update(dt: number, occupancy: number): void {
    for (let i = 0; i < this.mats.length; i++) {
      this.timers[i] -= dt;
      if (this.timers[i] <= 0) {
        this.lit[i] = this.random() < 0.15 + occupancy * 0.75;
        this.timers[i] = 4 + this.random() * 14;
      }
      this.current[i] = approach(this.current[i], this.lit[i] ? this.onIntensity : this.offIntensity, 3, dt);
      // By day nobody's lights read against the sun: the on/off difference fades out, so groups of
      // windows sharing a material never blink together in daylight; they twinkle from dusk on.
      const off = this.offIntensity;
      this.mats[i].emissiveIntensity = off + (this.current[i] - off) * (1 - windowDaylight);
    }
  }
}

/** Daylight (0 to 1): window lights fade out in daylight; they glow at dusk and night. */
let windowDaylight = 0;
export function setWindowDaylight(day: number): void {
  windowDaylight = day;
}

