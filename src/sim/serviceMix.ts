import { ACTIVITY, CHECKING_BUILT_IN, MIX_DEFAULT, SERVICE_ACTIVITIES, type Activity } from '../config/serviceMix';
import { SERVICE_IDS, type ServiceId } from './types';

/** Why an activity cannot be offered at a place now. */
export type MixLock = 'law' | 'setup' | null;

/**
 * Each place's budget mix: a weight per activity it can offer, set by the
 * player, and which paid set-ups are done. Shares are the weights of the
 * activities on offer now (not locked by law or set-up), as fractions.
 */
export class ServiceMix {
  private readonly weights = {} as Record<ServiceId, Partial<Record<Activity, number>>>;
  private readonly ready = new Set<string>();

  constructor() {
    for (const id of SERVICE_IDS) {
      this.weights[id] = {};
      for (const a of SERVICE_ACTIVITIES[id]) {
        this.weights[id][a] = MIX_DEFAULT;
        if (!ACTIVITY[a].setup || (a === 'checking' && CHECKING_BUILT_IN.includes(id))) this.ready.add(`${id}:${a}`);
      }
    }
  }

  weight(id: ServiceId, a: Activity): number {
    return this.weights[id][a] ?? 0;
  }

  setWeight(id: ServiceId, a: Activity, w: number): void {
    if (a in this.weights[id]) this.weights[id][a] = Math.max(0, Math.round(w));
  }

  isSetUp(id: ServiceId, a: Activity): boolean {
    return this.ready.has(`${id}:${a}`);
  }

  markSetUp(id: ServiceId, a: Activity): void {
    this.ready.add(`${id}:${a}`);
  }

  lock(id: ServiceId, a: Activity, checkingAllowed: boolean): MixLock {
    if (a === 'checking' && !checkingAllowed) return 'law';
    if (!this.isSetUp(id, a)) return 'setup';
    return null;
  }

  /** Each offered activity's share of the visits, 0 to 1 (all 0 when nothing is on). */
  shares(id: ServiceId, checkingAllowed: boolean): Partial<Record<Activity, number>> {
    const on = SERVICE_ACTIVITIES[id].filter((a) => !this.lock(id, a, checkingAllowed));
    const total = on.reduce((n, a) => n + this.weight(id, a), 0);
    const out: Partial<Record<Activity, number>> = {};
    for (const a of SERVICE_ACTIVITIES[id]) out[a] = total > 0 && on.includes(a) ? this.weight(id, a) / total : 0;
    return out;
  }

  /**
   * How much of `a` a place offers against an even split of everything it
   * can offer: 1 at an even split, 0 when none, up to the count of
   * activities when it is all the place does. Null when the place never offers it.
   */
  relative(id: ServiceId, a: Activity, checkingAllowed: boolean): number | null {
    const list = SERVICE_ACTIVITIES[id];
    if (!list.includes(a)) return null;
    return (this.shares(id, checkingAllowed)[a] ?? 0) * list.length;
  }

  /** Visit cost and time, relative to the usual, for the mix (1 when nothing is on). */
  factors(id: ServiceId, checkingAllowed: boolean): { cost: number; time: number } {
    const s = this.shares(id, checkingAllowed);
    let cost = 0;
    let time = 0;
    let total = 0;
    for (const [a, share] of Object.entries(s) as [Activity, number][]) {
      cost += share * ACTIVITY[a].cost;
      time += share * ACTIVITY[a].time;
      total += share;
    }
    return total > 0 ? { cost, time } : { cost: 1, time: 1 };
  }
}
