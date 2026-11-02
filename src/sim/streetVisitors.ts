import { VISITORS, type Stance, type VisitorKind } from '../config/streetVisitors';
import { createRandom, range } from './random';
import { SERVICE_IDS, type ServiceId } from './types';

/**
 * Tonight's visitors with a view (config/streetVisitors.ts): a picket, a
 * priest or a nun at one of the services, for harm reduction or against it.
 * Rendering-free, on its own random stream. While they are there, more (or
 * fewer) of the people heading to that service turn back.
 */
export interface Visit {
  kind: VisitorKind;
  stance: Stance;
  at: ServiceId;
  /** Clock minutes they arrive and leave. */
  from: number;
  to: number;
}

export class StreetVisitors {
  private random = createRandom(9157);
  /** Tonight's visit, if any (planned at dusk, it may not have started yet). */
  visit: Visit | null = null;
  private lastClock = Infinity;
  private announced = false;

  /** Present now. */
  here(clock: number): Visit | null {
    const v = this.visit;
    return v && clock >= v.from && clock < v.to ? v : null;
  }

  /** Extra turning back at `id` now (negative: fewer turn back). */
  deterAt(id: ServiceId, clock: number): number {
    const v = this.here(clock);
    return v && v.at === id ? VISITORS.deter[v.stance][v.kind] : 0;
  }

  /** Advances to `clock`; returns the visit when it arrives or leaves. `open` says which services are open now. */
  tick(clock: number, open: (id: ServiceId) => boolean): { what: 'arrive' | 'leave'; visit: Visit } | null {
    // A new evening (the clock loops at 18:00): plan tonight's visit, if any.
    if (clock < this.lastClock) {
      this.visit = null;
      this.announced = false;
      if (this.random() < VISITORS.chance) {
        let r = this.random();
        let kind: VisitorKind = 'picket';
        for (const [k, w] of Object.entries(VISITORS.kinds) as [VisitorKind, number][]) if ((r -= w) < 0) { kind = k; break; }
        const from = range(this.random, VISITORS.arrive);
        this.visit = { kind, stance: this.random() < VISITORS.support ? 'support' : 'oppose', at: VISITORS.places[0], from, to: from + range(this.random, VISITORS.stay) };
      }
    }
    this.lastClock = clock;
    const v = this.visit;
    if (!v) return null;
    if (!this.announced && clock >= v.from && clock < v.to) {
      // They go where the doors are open; with none open, they do not come tonight.
      const at = VISITORS.places.find(open);
      if (!at) { this.visit = null; return null; }
      v.at = at;
      this.announced = true;
      return { what: 'arrive', visit: v };
    }
    if (this.announced && clock >= v.to) {
      this.visit = null;
      return { what: 'leave', visit: v };
    }
    return null;
  }

  snapshot(): { visit: Visit | null; announced: boolean } {
    return { visit: this.visit && { ...this.visit }, announced: this.announced };
  }

  restore(s: Partial<ReturnType<StreetVisitors['snapshot']>>): void {
    const v = s.visit;
    const ok = !!v && typeof v === 'object' && v.kind in VISITORS.kinds && (v.stance === 'support' || v.stance === 'oppose')
      && SERVICE_IDS.includes(v.at) && Number.isFinite(v.from) && Number.isFinite(v.to);
    if (v === null || ok) this.visit = v && { kind: v.kind, stance: v.stance, at: v.at, from: v.from, to: v.to };
    if (typeof s.announced === 'boolean') this.announced = s.announced;
    // A loaded game carries on tonight: no new evening is planned until the clock loops.
    this.lastClock = -Infinity;
  }
}
