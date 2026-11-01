import { ACUTE, EVENT_IDS, EVENTS, type EventEffects, type EventId, type Substance } from '../config/randomEvents';
import type { Random } from './random';
import { SERVICE_IDS, type ServiceId } from './types';

/** One running event and what has happened during it. Counts are kept per event for the feed. */
export interface ActiveEvent {
  id: EventId;
  startedAt: number;
  endsAt: number;
  /** Clock minutes when a drug check first found it (supply events), or null. */
  detectedAt: number | null;
  /** A public alert went out. */
  alerted: boolean;
  acuteHarms: number;
  helped: number;
  alone: number;
}

/**
 * Schedules random events on the scene clock and answers risk questions.
 * Rendering-free and owns no other simulation state: the simulation applies
 * the consequences (boosts, crackdown policing, harms).
 */
export class EventEngine {
  readonly active: ActiveEvent[] = [];
  /** Finished events, newest first, kept short for the feed. */
  readonly recent: ActiveEvent[] = [];
  /** Frequency multiplier from the sandbox (0 turns random starts off; manual triggers still work). */
  frequency = 1;

  constructor(private readonly random: Random) {}

  isActive(id: EventId): boolean {
    return this.active.some((e) => e.id === id);
  }

  get(id: EventId): ActiveEvent | undefined {
    return this.active.find((e) => e.id === id);
  }

  /** Advances by `dtMinutes` of clock time; returns events that started and ended. */
  tick(clock: number, dtMinutes: number, seasonal: (id: EventId) => number = () => 1): { started: ActiveEvent[]; ended: ActiveEvent[] } {
    const started: ActiveEvent[] = [];
    const ended: ActiveEvent[] = [];
    for (let i = this.active.length - 1; i >= 0; i--) {
      if (clock >= this.active[i].endsAt || clock < this.active[i].startedAt) ended.push(...this.finish(i));
    }
    if (this.frequency > 0) {
      for (const id of EVENT_IDS) {
        const def = EVENTS[id];
        if (def.perHour <= 0 || this.isActive(id)) continue;
        let rate = def.perHour * this.frequency * seasonal(id);
        if (id === 'opioidContamination' && this.isActive('crackdown')) rate *= ACUTE.crackdownContamination;
        if (this.random() < rate * (dtMinutes / 60)) started.push(this.start(id, clock));
      }
    }
    return { started, ended };
  }

  /** Starts an event now (random schedule or a manual trigger). */
  start(id: EventId, clock: number): ActiveEvent {
    const existing = this.get(id);
    if (existing) return existing;
    const e: ActiveEvent = { id, startedAt: clock, endsAt: clock + EVENTS[id].durationMinutes, detectedAt: null, alerted: false, acuteHarms: 0, helped: 0, alone: 0 };
    this.active.push(e);
    return e;
  }

  /** Ends an event early (a pop-up shut down by police). */
  end(id: EventId): ActiveEvent | undefined {
    const i = this.active.findIndex((e) => e.id === id);
    return i < 0 ? undefined : this.finish(i)[0];
  }

  /** The active supply event affecting this substance, if any. */
  supplyEventFor(substance: Substance): ActiveEvent | undefined {
    return this.active.find((e) => EVENTS[e.id].affects.includes(substance));
  }

  /** Chance of an acute harm for someone using `substance` now. */
  acuteRisk(substance: Substance, alone: boolean): { risk: number; event?: ActiveEvent } {
    const event = this.supplyEventFor(substance);
    if (!event) return { risk: 0 };
    let risk = ACUTE.base * EVENTS[event.id].riskMultiplier * (alone ? ACUTE.aloneMultiplier : 1);
    if (event.alerted) risk *= 1 - ACUTE.alertAvoidance;
    return { risk: Math.min(1, risk), event };
  }

  private finish(index: number): ActiveEvent[] {
    const [e] = this.active.splice(index, 1);
    this.recent.unshift(e);
    this.recent.length = Math.min(this.recent.length, 4);
    return [e];
  }
}

type DemandKey = 'dropIn' | 'outreach' | 'club' | 'passerby';

/** All active events' modifiers, combined: multipliers multiply, losses add, flags OR, earliest closing wins. */
export interface EventMods {
  demand: Record<DemandKey, number>;
  patience: Record<ServiceId, number>;
  serviceTime: Record<ServiceId, number>;
  staffLoss: Record<ServiceId, number>;
  outOfService: ReadonlySet<ServiceId>;
  checkingDown: boolean;
  kitsOut: boolean;
  closesAt: number | null;
  deterrence: number;
  posted: boolean;
  labCollected: number;
  placards: number;
  party: 'popUp' | 'festival' | null;
  scuffles: number;
  checkingBoost: number;
  hiddenUse: number;
}

const perService = (v: number) => Object.fromEntries(SERVICE_IDS.map((id) => [id, v])) as Record<ServiceId, number>;

export function combineEventEffects(active: readonly ActiveEvent[]): EventMods {
  const m: EventMods = {
    demand: { dropIn: 1, outreach: 1, club: 1, passerby: 1 },
    patience: perService(1), serviceTime: perService(1), staffLoss: perService(0),
    outOfService: new Set(), checkingDown: false, kitsOut: false, closesAt: null, deterrence: 0, posted: false, labCollected: 1, placards: 0, party: null, scuffles: 1, checkingBoost: 1, hiddenUse: 1,
  };
  const out = new Set<ServiceId>();
  let pass = 1;
  for (const a of active) {
    const e: EventEffects = EVENTS[a.id].effects;
    for (const [k, v] of Object.entries(e.demand ?? {}) as [DemandKey, number][]) m.demand[k] *= v;
    for (const [k, v] of Object.entries(e.patience ?? {}) as [ServiceId, number][]) m.patience[k] *= v;
    for (const [k, v] of Object.entries(e.serviceTime ?? {}) as [ServiceId, number][]) m.serviceTime[k] *= v;
    for (const [k, v] of Object.entries(e.staffLoss ?? {}) as [ServiceId, number][]) m.staffLoss[k] += v;
    for (const id of e.outOfService ?? []) out.add(id);
    if (e.checkingDown) m.checkingDown = true;
    if (e.kitsOut) m.kitsOut = true;
    if (e.closesAt !== undefined) m.closesAt = m.closesAt === null ? e.closesAt : Math.min(m.closesAt, e.closesAt);
    if (e.deterrence) pass *= 1 - e.deterrence;
    if (e.posted) m.posted = true;
    if (e.labCollected !== undefined) m.labCollected *= e.labCollected;
    if (e.placards) m.placards = Math.max(m.placards, e.placards);
    if (e.party && m.party !== 'festival') m.party = e.party;
    if (e.scuffles) m.scuffles *= e.scuffles;
    if (e.checkingBoost) m.checkingBoost *= e.checkingBoost;
    if (e.hiddenUse) m.hiddenUse *= e.hiddenUse;
  }
  m.outOfService = out;
  m.deterrence = 1 - pass;
  return m;
}
