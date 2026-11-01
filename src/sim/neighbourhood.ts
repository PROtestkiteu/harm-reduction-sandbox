import type { EventId } from '../config/randomEvents';

/**
 * The street around the services. Rendering-free. Everything moves slowly
 * (clock hours) and is driven by what the services manage or fail to do:
 * unmet need, use in hidden places, injecting without sterile equipment,
 * outreach on the street. Services themselves are never a cause of harm here;
 * the library's evidence (Hunt 2004) finds no serious public order problems
 * around supervised services, and open drug scenes and litter lower safety.
 *
 * ILLUSTRATIVE rates throughout. Shop incidents are a placeholder with no
 * library evidence.
 */
export interface NeighbourhoodState {
  /** 0..1: how much use happens in view of the street. */
  visibleUse: number;
  /** 0..1: discarded equipment in the park and corners. */
  litter: number;
  /** 0..1: sellers on the corner. */
  streetMarket: number;
  /** 0..1: how safe the street feels to residents and shoppers. */
  safety: number;
  /** 0..1: how well the corner shop and cafe trade. */
  shopTrade: number;
  /** 0..1: the services' name among people who use drugs across the city. */
  reputation: number;
  /** People sleeping rough by the drop-in tonight. */
  roughSleepers: number;
  /** Placeholder count of shop incidents (theft, damage). No library evidence. */
  shopIncidents: number;
}

/** What the simulation tells the neighbourhood each step. */
export interface NeighbourhoodInputs {
  outreachOnStreet: boolean;
  dropInOpen: boolean;
  /** Officers posted near services, or a crackdown: moves the market, does not remove it. */
  policePosted: boolean;
  crackdown: boolean;
  busyClub: boolean;
  /** A party in the park draws sellers to the crowd. */
  party: 'popUp' | 'festival' | null;
  /** Recent street incidents (theft, scuffles): weigh on how safe the street feels. */
  cityPressure: number;
  coldNight: boolean;
  /** 0 opposed, 1 mixed, 2 supportive. */
  neighbourhoodSupport: number;
  anonymous: boolean;
  lateNight: boolean;
  activeEvents: ReadonlySet<EventId>;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** Moves `value` toward `target` at `perHour` (fraction of the gap per clock hour). */
const approach = (value: number, target: number, perHour: number, hours: number) => value + (target - value) * (1 - Math.exp(-perHour * hours));

/** Per-hour rates of what happened, smoothed over about an hour. */
interface Rates { hiddenUse: number; unsafe: number; kits: number; unmet: number; attended: number; demand: number }

export class Neighbourhood {
  readonly state: NeighbourhoodState = {
    visibleUse: 0, litter: 0.05, streetMarket: 0, safety: 0.85, shopTrade: 0.85, reputation: 0.5, roughSleepers: 0, shopIncidents: 0,
  };
  private readonly rates: Rates = { hiddenUse: 0, unsafe: 0, kits: 0, unmet: 0, attended: 0, demand: 0 };
  private readonly counts: Rates = { hiddenUse: 0, unsafe: 0, kits: 0, unmet: 0, attended: 0, demand: 0 };
  private unsafeMinutes = 0;
  private incidentCarry = 0;
  /** Clock minute before which an event may not fire again. */
  private readonly cooldown = new Map<EventId, number>();
  private lastClock = -Infinity;

  constructor(private readonly random: () => number) {}

  /** Records what just happened (called by the simulation as things happen). */
  note(kind: keyof Rates, n = 1): void {
    this.counts[kind] += n;
  }

  /** How strongly the services' name pulls people from elsewhere (demand multiplier). */
  get reputationPull(): number {
    return 0.85 + 0.35 * this.state.reputation;
  }

  /** Fewer people walk through when the street feels unsafe. */
  get footfall(): number {
    return 0.6 + 0.4 * this.state.safety;
  }

  /**
   * Advances by `dtMinutes` of clock time; returns neighbourhood events to
   * start (thresholds crossed, not active, cooldown passed).
   */
  tick(clock: number, dtMinutes: number, inp: NeighbourhoodInputs): EventId[] {
    const hours = dtMinutes / 60;
    if (hours <= 0) return [];
    // The night loops from 06:00 back to 18:00: cooldowns from the last night no longer apply.
    if (clock < this.lastClock) this.cooldown.clear();
    this.lastClock = clock;
    // Smooth counts into per-hour rates over about an hour.
    for (const k of Object.keys(this.rates) as (keyof Rates)[]) {
      this.rates[k] = approach(this.rates[k], this.counts[k] / hours, 1, hours);
      this.counts[k] = 0;
    }
    const r = this.rates;
    const s = this.state;

    s.visibleUse = approach(s.visibleUse, clamp(r.hiddenUse / 6), 0.6, hours);

    // Discarded equipment builds with injecting without kits and use in hidden places; outreach clears it, kits come with disposal.
    const build = 0.035 * r.unsafe + 0.015 * r.hiddenUse;
    const clear = (inp.outreachOnStreet ? 0.35 : 0.05) + 0.01 * r.kits;
    s.litter = clamp(s.litter + (build * (1 - s.litter) - clear * s.litter) * hours);

    // A market forms where unmet need concentrates; a crackdown suppresses it for a while, then it comes back.
    let marketTarget = clamp(r.unmet / 12 + (inp.busyClub ? 0.15 : 0) + (inp.party === 'festival' ? 0.35 : inp.party === 'popUp' ? 0.25 : 0));
    if (inp.crackdown) marketTarget *= 0.3;
    s.streetMarket = approach(s.streetMarket, marketTarget, 0.5, hours);

    s.safety = clamp(1 - (0.35 * s.visibleUse + 0.3 * s.litter + 0.35 * s.streetMarket) - 0.3 * Math.min(1, inp.cityPressure) + 0.05 * (inp.neighbourhoodSupport - 1));
    s.shopTrade = approach(s.shopTrade, s.safety, 0.35, hours);

    // Reputation follows the share of demand that is met, slowly; anonymity helps.
    const met = r.demand > 0.5 ? r.attended / r.demand : s.reputation;
    s.reputation = approach(s.reputation, clamp(met * (inp.anonymous ? 1 : 0.85)), 0.08, hours);

    s.roughSleepers = inp.dropInOpen ? 0 : inp.coldNight ? 2 : inp.lateNight ? 1 : 0;

    this.incidentCarry += 0.6 * s.streetMarket * hours;
    while (this.incidentCarry >= 1) {
      this.incidentCarry -= 1;
      if (this.random() < 0.7) s.shopIncidents++;
    }

    this.unsafeMinutes = s.safety < 0.4 ? this.unsafeMinutes + dtMinutes : 0;

    const start: EventId[] = [];
    const want = (id: EventId, cond: boolean) => {
      if (!cond || inp.activeEvents.has(id) || clock < (this.cooldown.get(id) ?? -Infinity)) return;
      this.cooldown.set(id, clock + 240);
      start.push(id);
    };
    want('shopClosesEarly', s.shopTrade < 0.45);
    want('streetMarketForms', s.streetMarket > 0.5);
    want('equipmentComplaints', s.litter > 0.45);
    want('residentsPetition', this.unsafeMinutes >= 60);
    want('wordSpreads', s.reputation > 0.8);
    return start;
  }
}
