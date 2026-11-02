import { FLAVOUR_CRIMES, POLICE_DAMP, type FlavourCrime } from '../config/flavour/crime';
import { createRandom } from './random';

/**
 * The street crime flavour pack's clock: decides when each kind happens.
 * Rendering-free and outside the simulation: it has its own random stream and
 * writes nothing back, so the model plays the same with the pack on or off.
 */
export class FlavourCrimes {
  private readonly random = createRandom(4111);
  private last = -1;

  /** Advances by `dtMinutes` of clock time at `clock`; returns the crimes that happened. */
  tick(dtMinutes: number, clock: number, patrol: number): FlavourCrime[] {
    const out: FlavourCrime[] = [];
    if (dtMinutes <= 0) return out;
    const hours = dtMinutes / 60;
    const damp = 1 / (1 + POLICE_DAMP * patrol);
    for (const id of Object.keys(FLAVOUR_CRIMES) as FlavourCrime[]) {
      const c = FLAVOUR_CRIMES[id];
      if (clock < c.hours[0] || clock >= c.hours[1]) continue;
      if (this.random() < c.rate * damp * hours) out.push(id);
    }
    this.last = clock;
    return out;
  }

  get clock(): number {
    return this.last;
  }
}
