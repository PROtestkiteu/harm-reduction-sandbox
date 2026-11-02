import { PETTY } from '../config/pettyCrime';
import { createRandom } from './random';

/**
 * Pickpockets and shoplifters (config/pettyCrime.ts). Rendering-free, with
 * its own random stream, so the rest of the city plays the same whether or
 * not a theft happens. Shops remember being hit: a shop hit often hires a
 * guard (fewer thefts there, some caught) and, hit more, shuts early for a night.
 */
export type TheftKind = 'pickpocket' | 'shoplifting';

export interface Theft {
  kind: TheftKind;
  /** Which shop, for shoplifting. */
  shop: number;
  /** A shop guard stopped them. */
  caught: boolean;
}

export interface PettyInputs {
  /** Clock minutes (18:00 = 1080, running on past midnight). */
  clock: number;
  /** Absolute organisation minutes, for how long a guard or shutters last. */
  now: number;
  /** Everyone out tonight against a typical evening. */
  footfall: number;
  /** The street scene, 0 to 1. */
  street: number;
  patrol: number;
  footPatrolOpen: boolean;
}

export type ShopNews = { shop: number; news: 'guard' | 'shut' };

export class PettyCrime {
  private random = createRandom(7331);
  readonly counts: Record<TheftKind, number> = { pickpocket: 0, shoplifting: 0 };
  caught = 0;
  /** Recent hits per shop, fading over about a day. */
  readonly hits: number[] = Array.from({ length: PETTY.shops }, () => 0);
  /** Until when (org minutes) each shop has a guard, and has its shutters down. */
  readonly guardUntil: number[] = Array.from({ length: PETTY.shops }, () => -1);
  readonly shutUntil: number[] = Array.from({ length: PETTY.shops }, () => -1);

  guarded(shop: number, now: number): boolean {
    return now < this.guardUntil[shop];
  }

  shut(shop: number, now: number): boolean {
    return now < this.shutUntil[shop];
  }

  /** Advances by `dtMinutes`; returns the thefts and what the shops did about them. */
  tick(dtMinutes: number, inp: PettyInputs): { thefts: Theft[]; news: ShopNews[] } {
    const thefts: Theft[] = [];
    const news: ShopNews[] = [];
    const hours = dtMinutes / 60;
    for (let i = 0; i < PETTY.shops; i++) this.hits[i] *= Math.exp(-hours / 24);
    const odds = (1 + PETTY.streetBoost * inp.street) / (1 + PETTY.policeDamp * inp.patrol) * (inp.footPatrolOpen ? 1 - PETTY.footPatrolCut : 1);
    const within = (h: readonly [number, number]) => inp.clock >= h[0] && inp.clock < h[1];
    if (within(PETTY.pickpocket.hours) && this.random() < PETTY.pickpocket.perHour * inp.footfall * odds * hours) {
      this.counts.pickpocket++;
      thefts.push({ kind: 'pickpocket', shop: -1, caught: false });
    }
    if (within(PETTY.shoplifting.hours) && this.random() < PETTY.shoplifting.perHour * odds * hours) {
      const shop = Math.floor(this.random() * PETTY.shops);
      const guarded = this.guarded(shop, inp.now);
      if (!this.shut(shop, inp.now) && (!guarded || this.random() > PETTY.guardCut)) {
        const caught = guarded && this.random() < PETTY.guardCatches;
        this.counts.shoplifting++;
        if (caught) this.caught++;
        thefts.push({ kind: 'shoplifting', shop, caught });
        const before = this.hits[shop];
        this.hits[shop] += 1;
        if (!guarded && before < PETTY.guardAfter && this.hits[shop] >= PETTY.guardAfter) {
          this.guardUntil[shop] = inp.now + PETTY.guardHours * 60;
          news.push({ shop, news: 'guard' });
        }
        if (before < PETTY.shutAfter && this.hits[shop] >= PETTY.shutAfter) {
          this.shutUntil[shop] = inp.now + PETTY.shutHours * 60;
          news.push({ shop, news: 'shut' });
        }
      }
    }
    return { thefts, news };
  }

  snapshot(): { counts: Record<TheftKind, number>; caught: number; hits: number[]; guardUntil: number[]; shutUntil: number[] } {
    return { counts: { ...this.counts }, caught: this.caught, hits: [...this.hits], guardUntil: [...this.guardUntil], shutUntil: [...this.shutUntil] };
  }

  restore(s: Partial<ReturnType<PettyCrime['snapshot']>>): void {
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
    for (const k of ['pickpocket', 'shoplifting'] as const) this.counts[k] = num(s.counts?.[k]) ?? this.counts[k];
    this.caught = num(s.caught) ?? this.caught;
    const into = (to: number[], from?: unknown) => { if (Array.isArray(from)) from.forEach((v, i) => { if (i < to.length && typeof v === 'number' && Number.isFinite(v)) to[i] = v; }); };
    into(this.hits, s.hits);
    into(this.guardUntil, s.guardUntil);
    into(this.shutUntil, s.shutUntil);
  }
}
