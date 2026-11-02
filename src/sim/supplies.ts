import { SUPPLIES, SUPPLY_IDS, type SupplyId } from '../config/supplies';

/**
 * The shelf: naloxone, kits, leaflets and blankets (config/supplies.ts).
 * Rendering-free. Orders are paid when placed and arrive after their delivery
 * time; one delivery per item is on the way at a time.
 */
export class Supplies {
  readonly stock = Object.fromEntries(SUPPLY_IDS.map((id) => [id, SUPPLIES[id].start])) as Record<SupplyId, number>;
  readonly standing = Object.fromEntries(SUPPLY_IDS.map((id) => [id, SUPPLIES[id].standing])) as Record<SupplyId, boolean>;
  /** Arrival time (`org.now` minutes) of the batch on its way, per item. */
  readonly arriving: Partial<Record<SupplyId, number>> = {};
  /** Units used and wanted with an empty shelf, since the start (for the panel and bots). */
  readonly used = Object.fromEntries(SUPPLY_IDS.map((id) => [id, 0])) as Record<SupplyId, number>;
  readonly shortfall = Object.fromEntries(SUPPLY_IDS.map((id) => [id, 0])) as Record<SupplyId, number>;

  /** Takes one unit if there is one; counts the shortfall if not. */
  use(id: SupplyId): boolean {
    if (this.stock[id] <= 0) {
      this.shortfall[id]++;
      return false;
    }
    this.stock[id]--;
    this.used[id]++;
    return true;
  }

  has(id: SupplyId, n = 1): boolean {
    return this.stock[id] >= n;
  }

  /** Takes `n` units at once (a street warning), or none. */
  take(id: SupplyId, n: number): boolean {
    if (this.stock[id] < n) return false;
    this.stock[id] -= n;
    this.used[id] += n;
    return true;
  }

  /** Places an order through `pay`; false when one is already on its way or the money is not there. */
  order(id: SupplyId, now: number, pay: (cost: number) => boolean): boolean {
    if (this.arriving[id] !== undefined || !pay(SUPPLIES[id].price)) return false;
    this.arriving[id] = now + SUPPLIES[id].deliveryMinutes;
    return true;
  }

  /** Deliveries in, and standing orders placed. Returns what arrived, and standing orders that could not be paid. */
  tick(now: number, pay: (cost: number) => boolean): { arrived: SupplyId[]; unpaid: SupplyId[] } {
    const arrived: SupplyId[] = [];
    const unpaid: SupplyId[] = [];
    for (const id of SUPPLY_IDS) {
      const at = this.arriving[id];
      if (at !== undefined && now >= at) {
        delete this.arriving[id];
        this.stock[id] += SUPPLIES[id].batch;
        arrived.push(id);
      }
      if (this.standing[id] && this.arriving[id] === undefined && this.stock[id] < SUPPLIES[id].reorderAt && !this.order(id, now, pay)) unpaid.push(id);
    }
    return { arrived, unpaid };
  }

  snapshot(): { stock: Record<SupplyId, number>; standing: Record<SupplyId, boolean>; arriving: Partial<Record<SupplyId, number>> } {
    return { stock: { ...this.stock }, standing: { ...this.standing }, arriving: { ...this.arriving } };
  }

  restore(s: Partial<ReturnType<Supplies['snapshot']>> | undefined): void {
    if (!s) return;
    for (const id of SUPPLY_IDS) {
      const n = s.stock?.[id];
      if (typeof n === 'number' && Number.isFinite(n)) this.stock[id] = Math.max(0, Math.round(n));
      const on = s.standing?.[id];
      if (typeof on === 'boolean') this.standing[id] = on;
      const at = s.arriving?.[id];
      if (typeof at === 'number' && Number.isFinite(at)) this.arriving[id] = at;
      else delete this.arriving[id];
    }
  }
}
