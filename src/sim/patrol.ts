import { PATROL, type PatrolSpot } from '../config/patrol';

/**
 * Where the foot patrol is: at its table (null) or out at a spot until a time
 * (`org.now` minutes). Rendering-free. The simulation asks it how many people
 * the patrol reaches each step and tells it when it comes back.
 */
export class Patrol {
  spot: PatrolSpot | null = null;
  until = 0;
  /** People reached so far on this round, and the fraction carried to the next step. */
  reached = 0;
  private carry = 0;

  get out(): boolean {
    return this.spot !== null;
  }

  send(spot: PatrolSpot, now: number): void {
    this.spot = spot;
    this.until = now + PATROL.hours * 60;
    this.reached = 0;
    this.carry = 0;
  }

  /**
   * Advances by `dtMinutes`: whole people reached this step by `workers`
   * streetworkers, and whether the round is over (they walk back).
   */
  tick(dtMinutes: number, now: number, workers: number): { contacts: number; back: boolean } {
    if (!this.spot) return { contacts: 0, back: false };
    this.carry += PATROL.spots[this.spot].contacts * workers * (dtMinutes / 60);
    const contacts = Math.floor(this.carry);
    this.carry -= contacts;
    this.reached += contacts;
    if (now < this.until) return { contacts, back: false };
    this.spot = null;
    return { contacts, back: true };
  }

  snapshot(): { spot: PatrolSpot | null; until: number; reached: number } {
    return { spot: this.spot, until: Math.round(this.until), reached: this.reached };
  }

  restore(s: Partial<ReturnType<Patrol['snapshot']>> | undefined): void {
    if (!s) return;
    this.spot = s.spot && s.spot in PATROL.spots ? s.spot : null;
    if (typeof s.until === 'number' && Number.isFinite(s.until)) this.until = s.until;
    if (typeof s.reached === 'number' && Number.isFinite(s.reached)) this.reached = Math.max(0, Math.round(s.reached));
  }
}
