import { SEASON_PROFILES } from '../config/seasons';
import type { Season } from './calendar';
import { ILLUSTRATIVE, type ServiceParams } from '../config/illustrative';
import type { SandboxSettings } from '../config/sandboxParams';
import { CHECKING, NEUTRAL_EFFECTS, type ContextEffects } from '../config/contextFactors';
import { CLUB_CLOSES, CLUB_OPENS, DAY_END, DAY_START, MORNING } from './clock';
import { ACUTE, EVENTS, INJECTING_SHARE, PROFILE_MIX, type EventId, type Profile, type Substance } from '../config/randomEvents';
import { EventEngine, combineEventEffects, type ActiveEvent, type EventMods } from './eventEngine';
import { ORG, type ApplicationContext, type GrantId, type RecruitId } from '../config/organisation';
import { Organisation, type OrgNotice } from './organisation';
import { Neighbourhood } from './neighbourhood';
import { CityLife, type CityHappening, type PasserbyKind } from './cityLife';
import { Calendar } from './calendar';
import { CALENDAR_WAVES, SEASONAL_EVENT_RATE } from '../config/populations';
import { createRandom, nextArrival, range, type Random } from './random';
import { SERVICE_IDS, WALK_IN_SERVICE_IDS, type ServiceId, type ServiceStatus, type WalkInServiceId } from './types';

/**
 * Service model with no rendering knowledge. The crowd layer reports physical
 * arrivals (a person reaching a door or counter) and staff reaching their
 * posts; the simulation decides admission, waiting, service time and counts.
 */

export type VisitorId = number;
export type Intent = 'dropIn' | 'outreach' | 'club' | 'passerby' | 'party' | WalkInServiceId;

export type SimEvent =
  /** `turnsBack`: this person sets out but turns back before reaching the service (context deterrence). */
  | { type: 'spawnVisitor'; visitor: VisitorId; intent: Intent; wantsStand: boolean; turnsBack: boolean; kind?: PasserbyKind }
  /** Ordinary city life: the night bus, cleaners, street crime. */
  | { type: 'city'; happening: CityHappening }
  /** Police make a possession stop; the crowd reports back whether it happened. */
  | { type: 'policeStop'; arrest: boolean }
  /** What happens after need goes unmet: some people use in a hidden spot; the adverse placeholder may fire. */
  | { type: 'aftermath'; service: ServiceId; visitor: VisitorId; hiddenUse: boolean; adverse: boolean; acute: AcuteOutcome | null }
  /** The organisation has news: recruits, volunteers leaving, funding decisions, money running out. */
  | { type: 'orgNotice'; notice: OrgNotice }
  /** A random event started or ended. */
  | { type: 'eventStarted'; event: ActiveEvent }
  | { type: 'eventEnded'; event: ActiveEvent }
  /** A check found something unexpected and public alerts are on. */
  | { type: 'alert'; service: ServiceId; word: string }
  | { type: 'spawnCar' }
  | { type: 'admitted'; service: ServiceId; visitor: VisitorId }
  | { type: 'served'; service: ServiceId; visitor: VisitorId }
  | { type: 'leftUnserved'; service: ServiceId; visitor: VisitorId }
  /** Staff for posts `first` .. `first + count - 1` set out. */
  | { type: 'staffCall'; service: ServiceId; first: number; count: number }
  /** Staff at posts `fromPost` and above leave. */
  | { type: 'staffRelease'; service: ServiceId; fromPost: number }
  | { type: 'clubAdmitted'; visitor: VisitorId }
  | { type: 'clubLeaver'; intoxicated: boolean; acute: AcuteOutcome | null };

/** An acute harm (overdose, collapse) during a supply event, and whether staff reached the person. */
export interface AcuteOutcome {
  event: EventId;
  helpedBy: ServiceId | null;
}

/** Health counts the random events drive. Placeholders for scale, not evidence. */
export interface HealthCounts {
  acuteHarms: number;
  helped: number;
  alone: number;
  sterileKits: number;
  unsafeInjecting: number;
}

type RateId = 'dropIn' | 'outreach' | 'club' | 'passerby' | 'car' | 'leaver' | 'party' | WalkInServiceId;

export type ArrivalResult = 'admitted' | 'queued' | 'turnedAway';

/** Kept apart on purpose: none of these is derived from another. */
export interface Metrics {
  demand: number;
  attended: number;
  unmetNeed: number;
  adverse: number;
}

const emptyMetrics = (): Metrics => ({ demand: 0, attended: 0, unmetNeed: 0, adverse: 0 });

interface Waiting { visitor: VisitorId; waited: number }

/** Why a service is closed, when it is. */
export type ClosedReason = 'switchedOff' | 'closedDown' | 'hours' | 'notPermitted' | 'outOfService' | 'noStaff';

/** What the app knows about the chosen context that the combined effects do not carry. */
export interface PolicyInfo {
  /** 0 opposed, 1 tolerant, 2 supportive. */
  council: number;
  policeAgreement: boolean;
  criminalPossession: boolean;
  /** Option id of the national funding factor: volunteer, project or stable. */
  funding: string;
  /** 0 opposed, 1 mixed, 2 supportive. */
  neighbourhood: number;
  anonymous: boolean;
}

/** Drug checking at the stand. Stated intentions, not observed behaviour. */
export interface CheckingCounts {
  samples: number;
  resultsReceived: number;
  unexpected: number;
  changedPlans: number;
}

export class ServiceModel {
  /** Effective state: switched on, within opening hours and permitted. */
  enabled = true;
  /** The on/off switch in the HUD. */
  switchedOn = true;
  closedReason: ClosedReason | null = null;
  /** People who set out for this service and turned back before reaching it (part of unmet need). */
  turnedBack = 0;
  /** Staff off for an event (illness); they reduce what this service asks for. */
  staffLoss = 0;
  /** Staff the organisation assigned from its pool (paid first, then volunteers). */
  assigned = 0;
  paidAssigned = 0;
  staffOnSite = 0;
  readonly queue: Waiting[] = [];
  readonly inService = new Map<VisitorId, number>();
  readonly metrics = emptyMetrics();
  /** Live copy: sandbox sliders change staff, waiting places and patience. */
  readonly params: ServiceParams;

  constructor(readonly id: ServiceId, params: ServiceParams) {
    this.params = { ...params };
  }

  /** Staff this service asks for: the slider, minus anyone off sick. */
  get requested(): number {
    return Math.max(0, this.params.staff - this.staffLoss);
  }

  /** Staff expected on shift now. */
  get rota(): number {
    return this.assigned;
  }

  get capacity(): number {
    if (this.staffOnSite === 0) return 0;
    return Math.max(1, Math.floor(this.staffOnSite * this.params.capacityPerStaff));
  }

  get status(): ServiceStatus {
    if (this.enabled) return this.staffOnSite > 0 ? 'open' : 'opening';
    return this.staffOnSite > 0 || this.inService.size > 0 ? 'closing' : 'closed';
  }

  /** Visitor ids in queue order; index 0 is next. */
  queueOrder(): VisitorId[] {
    return this.queue.map((w) => w.visitor);
  }
}

export interface VenueState {
  readonly name: string;
  inside: number;
  capacity: number;
  readonly queue: VisitorId[];
  arrivals: number;
  entered: number;
  adverse: number;
}

export class Simulation {
  readonly services: Record<ServiceId, ServiceModel>;
  readonly club: VenueState;
  clockMinutes: number = ILLUSTRATIVE.clockStartMinutes;
  private readonly random: Random;
  private readonly listeners = new Set<(e: SimEvent) => void>();
  private nextVisitor = 1;
  private readonly timers: Record<RateId, number>;
  /** Live arrival rates per minute; sandbox sliders change them. */
  private readonly rates: Record<RateId, number> = {
    dropIn: ILLUSTRATIVE.services.dropIn.demandPerMinute,
    outreach: ILLUSTRATIVE.services.outreach.demandPerMinute,
    club: ILLUSTRATIVE.club.arrivalsPerMinute,
    passerby: ILLUSTRATIVE.passersbyPerMinute,
    car: ILLUSTRATIVE.carsPerMinute,
    leaver: ILLUSTRATIVE.club.leaversPerMinute,
    pharmacy: ILLUSTRATIVE.services.pharmacy.demandPerMinute,
    drugChecking: ILLUSTRATIVE.services.drugChecking.demandPerMinute,
    shelter: ILLUSTRATIVE.services.shelter.demandPerMinute,
    clinic: ILLUSTRATIVE.services.clinic.demandPerMinute,
    party: 0,
  };
  private standInterest: number = ILLUSTRATIVE.club.standInterest;
  private clockRate: number = ILLUSTRATIVE.clockMinutesPerSecond;
  /** Whether the hours move on. Held, the time of night stays put while people go on moving. */
  cycle = true;
  /** Clock minutes per real second right now: zero while the cycle is held. */
  private get minuteRate(): number {
    return this.cycle ? this.clockRate : 0;
  }
  private started = false;
  /** Combined context effects (law, policing, funding, council, neighbourhood, venue, design), with event overrides applied. */
  context: ContextEffects = { ...NEUTRAL_EFFECTS };
  private baseContext: ContextEffects = { ...NEUTRAL_EFFECTS };
  readonly events: EventEngine;
  private mods: EventMods = combineEventEffects([]);
  private readonly profiles = new Map<VisitorId, Profile>();
  readonly health: HealthCounts = { acuteHarms: 0, helped: 0, alone: 0, sterileKits: 0, unsafeInjecting: 0 };
  readonly org: Organisation;
  private policy: PolicyInfo = { council: 1, policeAgreement: false, criminalPossession: true, funding: 'project', neighbourhood: 1, anonymous: true };
  readonly neighbourhood: Neighbourhood;
  readonly city: CityLife;
  readonly calendar = new Calendar();
  /** Calendar waves already started tonight. */
  private readonly wavesTonight = new Set<string>();
  /** Paid staff assigned across services (they draw wages). */
  private paidOnShift = 0;
  readonly checking: CheckingCounts = { samples: 0, resultsReceived: 0, unexpected: 0, changedPlans: 0 };
  /** Possession stops that took place in the scene, and how many ended in arrest. */
  policeStops = 0;
  arrests = 0;
  /** People whose need went unmet who then used in a hidden spot. */
  hiddenUse = 0;
  /** Club leavers who were visibly intoxicated. */
  intoxicatedLeavers = 0;
  private stopTimer = 20;
  /** People still to arrive in a party's opening crowd, one per step. */
  private partyBurst = 0;
  private doorTimer = 2;

  constructor(seed: number = ILLUSTRATIVE.seed) {
    this.random = createRandom(seed);
    this.events = new EventEngine(this.random);
    this.org = new Organisation(this.random, (notice) => this.emit({ type: 'orgNotice', notice }));
    this.neighbourhood = new Neighbourhood(this.random);
    this.city = new CityLife(this.random);
    const p = ILLUSTRATIVE.services;
    this.services = {
      dropIn: new ServiceModel('dropIn', p.dropIn),
      outreach: new ServiceModel('outreach', p.outreach),
      clubHr: new ServiceModel('clubHr', p.clubHr),
      pharmacy: new ServiceModel('pharmacy', p.pharmacy),
      drugChecking: new ServiceModel('drugChecking', p.drugChecking),
      shelter: new ServiceModel('shelter', p.shelter),
      clinic: new ServiceModel('clinic', p.clinic),
    };
    this.club = {
      name: ILLUSTRATIVE.club.name,
      inside: ILLUSTRATIVE.club.initialInside,
      capacity: ILLUSTRATIVE.club.capacity,
      queue: [],
      arrivals: 0,
      entered: 0,
      adverse: 0,
    };
    this.timers = {
      dropIn: this.random() * 4,
      outreach: this.random() * 4,
      club: this.random() * 2,
      passerby: this.random() * 3,
      car: 3 + this.random() * 6,
      leaver: 5 + this.random() * 10,
      pharmacy: this.random() * 6,
      drugChecking: this.random() * 6,
      shelter: this.random() * 6,
      clinic: this.random() * 6,
      party: Infinity,
    };
  }

  on(listener: (e: SimEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(e: SimEvent): void {
    for (const l of this.listeners) l(e);
  }

  /** Called once after listeners attach so staff for enabled services set out. */
  start(): void {
    this.reallocate();
    this.started = true;
    for (const id of SERVICE_IDS) if (this.services[id].enabled) this.emit({ type: 'staffCall', service: id, first: 0, count: this.services[id].rota });
  }

  /**
   * Applies sandbox settings between fixed steps. Changes take effect live:
   * arrival timers are redrawn for new rates (exact for Poisson arrivals),
   * staff walk on or off, and nobody already waiting or inside is evicted.
   */
  configure(changes: Partial<SandboxSettings>): void {
    for (const [key, value] of Object.entries(changes) as [keyof SandboxSettings, number][]) {
      switch (key) {
        case 'clock': this.clockMinutes = value; break;
        case 'clockSpeed': this.clockRate = value; break;
        case 'dayCycle': this.cycle = value > 0; break;
        case 'passersby': this.setRate('passerby', value); break;
        case 'cars': this.setRate('car', value); break;
        case 'clubArrivals': this.setRate('club', value); break;
        case 'venueCapacity': this.club.capacity = value; break;
        case 'dropIn.demand': this.setRate('dropIn', value); break;
        case 'outreach.demand': this.setRate('outreach', value); break;
        case 'clubHr.interest': this.standInterest = value; break;
        case 'eventFrequency': this.events.frequency = value; break;
        case 'date': this.calendar.dayOfYear = value - 1; this.wavesTonight.clear(); break;
        case 'calendarPace': this.calendar.pace = value; break;
        case 'orgBudget':
          this.org.budget = value;
          // Setting the budget by hand also settles whether the organisation is out of money.
          this.org.broke = value <= 0;
          if (!this.org.broke) {
            this.org.brokeMinutes = 0;
            const e = this.events.end('fundsRunningOut');
            if (e) { this.eventsChanged(); this.emit({ type: 'eventEnded', event: e }); }
          } else this.triggerEvent('fundsRunningOut');
          this.applyContext();
          break;
        case 'dropIn.staff': case 'outreach.staff': case 'clubHr.staff':
        case 'pharmacy.staff': case 'drugChecking.staff': case 'shelter.staff': case 'clinic.staff':
          this.setStaff(serviceOf(key), value); break;
        case 'dropIn.waiting': case 'outreach.waiting': case 'clubHr.waiting':
        case 'pharmacy.waiting': case 'drugChecking.waiting': case 'shelter.waiting': case 'clinic.waiting':
          this.services[serviceOf(key)].params.waitingSlots = value; break;
        case 'dropIn.patience': case 'outreach.patience': case 'clubHr.patience':
        case 'pharmacy.patience': case 'drugChecking.patience': case 'shelter.patience': case 'clinic.patience':
          this.services[serviceOf(key)].params.patienceSeconds = value; break;
        default: { const unhandled: never = key; throw new Error(`Unhandled sandbox setting ${String(unhandled)}`); }
      }
    }
  }

  /** The time of year, from tonight's date. */
  get season(): Season {
    return this.calendar.date.season;
  }

  private setRate(id: RateId, perMinute: number): void {
    if (this.rates[id] === perMinute) return;
    this.rates[id] = perMinute;
    this.timers[id] = nextArrival(this.random, this.rate(id));
  }

  /** Live rate including event boosts (a cold night, a big night at the club). */
  private rate(id: RateId): number {
    // The club is shut from six in the morning until the evening.
    if (id === 'club' && this.clockMinutes >= CLUB_CLOSES && this.clockMinutes < CLUB_OPENS) return 0;
    // Party arrivals follow whichever party is on (illustrative per minute).
    if (id === 'party') return this.mods.party === 'festival' ? 14 : this.mods.party === 'popUp' ? 6 : 0;
    // Events boost the original flows; walk-in services keep their own rate.
    const boost = id in this.mods.demand ? this.mods.demand[id as keyof typeof this.mods.demand] : 1;
    // The street feeds back: a good name pulls people from elsewhere; an unsafe-feeling street has fewer passers-by.
    const n = this.neighbourhood;
    const d = this.calendar.date;
    const street = id === 'dropIn' || id === 'outreach' ? n.reputationPull
      : id === 'passerby' ? n.footfall * this.city.footfall(this.clockMinutes, d)
      : id === 'club' ? this.city.clubPull(this.clockMinutes, d)
      : 1;
    // Seasonal demand for the services (illustrative); passers-by and the club follow the calendar above.
    const sd = SEASON_PROFILES[this.season].demand;
    const seasonal = id === 'dropIn' ? sd.dropIn : id === 'outreach' ? sd.outreach : id === 'shelter' ? sd.shelter : 1;
    return this.rates[id] * boost * street * seasonal;
  }

  private setStaff(id: ServiceId, staff: number): void {
    this.services[id].params.staff = staff;
    this.reallocate();
  }

  /**
   * Shares the organisation's available people out across services that can
   * open, in priority order (drop-in, outreach, stand), paid staff first.
   * A service nobody can staff closes as short of staff. Then opens, closes
   * and re-staffs services to match.
   */
  private reallocate(): void {
    const avail = this.org.available;
    let paidLeft = avail.paid;
    let volLeft = avail.volunteers;
    let paidTotal = 0;
    const plan = {} as Record<ServiceId, { reason: ClosedReason | null; assigned: number; paid: number }>;
    for (const id of SERVICE_IDS) {
      const s = this.services[id];
      let reason = this.closedReason(id);
      let paid = 0;
      let vol = 0;
      if (!reason) {
        paid = Math.min(s.requested, paidLeft);
        paidLeft -= paid;
        vol = Math.min(s.requested - paid, volLeft);
        volLeft -= vol;
        if (paid + vol === 0) reason = 'noStaff';
      }
      paidTotal += paid;
      plan[id] = { reason, assigned: paid + vol, paid };
    }
    this.paidOnShift = paidTotal;
    for (const id of SERVICE_IDS) this.applyPlan(id, plan[id]);
  }

  private applyPlan(id: ServiceId, p: { reason: ClosedReason | null; assigned: number; paid: number }): void {
    const s = this.services[id];
    const wasOpen = s.enabled;
    const before = s.assigned;
    s.closedReason = p.reason;
    s.enabled = p.reason === null;
    s.assigned = p.assigned;
    s.paidAssigned = p.paid;
    if (!this.started) return;
    if (!wasOpen && s.enabled) {
      this.emit({ type: 'staffCall', service: id, first: 0, count: s.assigned });
    } else if (wasOpen && !s.enabled) {
      // Closing: people still waiting leave without service.
      for (const w of s.queue.splice(0)) this.recordUnmet(s, w.visitor);
      this.emit({ type: 'staffRelease', service: id, fromPost: 0 });
    } else if (s.enabled && s.assigned > before) {
      this.emit({ type: 'staffCall', service: id, first: before, count: s.assigned - before });
    } else if (s.enabled && s.assigned < before) {
      this.emit({ type: 'staffRelease', service: id, fromPost: s.assigned });
    }
  }

  /** Context the app knows beyond the combined effects (for funding decisions and income). */
  setPolicy(policy: PolicyInfo): void {
    this.policy = policy;
  }

  recruit(id: RecruitId): void {
    if (this.org.recruit(id, this.clockMinutes)) this.reallocate();
  }

  letGo(): void {
    this.org.letGo(this.clockMinutes);
    this.reallocate();
  }

  /** Relaunches a service that closed down when the money ran out. */
  reopen(id: ServiceId): void {
    this.org.reopen(id, this.clockMinutes);
  }

  applyFor(id: GrantId): void {
    this.org.apply(id, this.clockMinutes);
  }

  /** The party on in the park, if any. */
  get party(): 'popUp' | 'festival' | null {
    return this.mods.party;
  }

  /** Income per clock hour from the national funding option (grants come on top). */
  get fundingIncome(): number {
    return ORG.incomePerHour[this.policy.funding] ?? 0;
  }

  applicationContext(): ApplicationContext {
    return {
      // A residents' petition makes the council harder to win over.
      council: this.events.isActive('residentsPetition') ? Math.max(0, this.policy.council - 1) : this.policy.council,
      policeAgreement: this.policy.policeAgreement,
      publicAlerts: this.context.publicAlerts,
      checksDone: this.checking.samples,
      criminalPossession: this.policy.criminalPossession,
    };
  }

  /** Starts an event now, from the event feed. */
  triggerEvent(id: EventId): void {
    if (this.events.isActive(id)) return;
    const e = this.events.start(id, this.clockMinutes);
    this.eventsChanged();
    this.emit({ type: 'eventStarted', event: e });
  }

  /** Recomputes event modifiers and applies them: rates, rota, context overrides. */
  private eventsChanged(): void {
    const before = this.mods;
    this.mods = combineEventEffects(this.events.active);
    if (before.party !== this.mods.party) {
      this.timers.party = nextArrival(this.random, this.rate('party'));
      // A party starts with a crowd already arriving.
      this.partyBurst = this.mods.party === 'festival' ? 14 : this.mods.party === 'popUp' ? 6 : 0;
    }
    for (const id of ['dropIn', 'outreach', 'club', 'passerby'] as const) {
      if (before.demand[id] !== this.mods.demand[id]) this.timers[id] = nextArrival(this.random, this.rate(id));
    }
    for (const id of SERVICE_IDS) this.services[id].staffLoss = this.mods.staffLoss[id];
    this.applyContext();
  }

  private applyContext(): void {
    const c: ContextEffects = { ...this.baseContext };
    const m = this.mods;
    if (m.posted) {
      c.patrol = Math.max(c.patrol, 2);
      c.patrolStyle = 'posted';
    }
    c.deterrence = 1 - (1 - c.deterrence) * (1 - m.deterrence);
    if (m.closesAt !== null) c.closesAt = c.closesAt === null ? m.closesAt : Math.min(c.closesAt, m.closesAt);
    // Without money there are no analyses or kits.
    if (m.checkingDown || this.org.broke) c.checkingAllowed = false;
    c.placards = Math.max(c.placards, m.placards);
    this.context = c;
    this.reallocate();
  }

  /**
   * A partygoer leaves the party. During a supply shock affecting what they
   * took they may collapse; outreach staff reach them if the camper is open.
   */
  partyLeave(visitor: VisitorId): AcuteOutcome | null {
    return this.acuteFor(this.profiles.get(visitor), false, 'outreach', ACUTE.reachedByStaff.terrace);
  }

  /** Clears a person's profile once they have left the scene. */
  forget(visitor: VisitorId): void {
    this.profiles.delete(visitor);
  }

  private drawProfile(mix: Partial<Record<Substance, number>>): Profile {
    let r = this.random();
    let substance: Substance = 'none';
    for (const [k, share] of Object.entries(mix) as [Substance, number][]) {
      if ((r -= share) <= 0) { substance = k; break; }
    }
    const injects = (substance === 'opioid' || substance === 'stimulant') && this.random() < INJECTING_SHARE;
    return { substance, injects };
  }

  /** An injecting person did not get sterile equipment; repeated exposure can seed a cluster. */
  private unsafeInjecting(): void {
    this.health.unsafeInjecting++;
    this.neighbourhood.note('unsafe');
    if (!this.events.isActive('infectionCluster') && this.random() < ACUTE.clusterPerUnsafeEpisode * Math.max(0.25, this.events.frequency)) {
      this.triggerEvent('infectionCluster');
    }
  }

  /** Decides an acute harm during a supply event, and whether staff of `responder` reach the person. */
  private acuteFor(profile: Profile | undefined, alone: boolean, responder: ServiceId, reach: number): AcuteOutcome | null {
    if (!profile) return null;
    const { risk, event } = this.events.acuteRisk(profile.substance, alone);
    if (!event || this.random() >= risk) return null;
    const s = this.services[responder];
    const canReach = s.enabled && s.staffOnSite > 0;
    // Reaching someone in time uses naloxone or first-aid supplies, which cost money.
    const helped = canReach && this.random() < reach * (this.mods.kitsOut ? 0.5 : 1) && this.org.spend(ORG.costs.overdoseResponse);
    event.acuteHarms++;
    this.health.acuteHarms++;
    if (helped) { event.helped++; this.health.helped++; } else { event.alone++; this.health.alone++; }
    return { event: event.id, helpedBy: helped ? responder : null };
  }

  /** The HUD switch. The service opens only if hours and permissions allow it too. */
  setEnabled(id: ServiceId, on: boolean): void {
    this.services[id].switchedOn = on;
    this.reallocate();
  }

  /** Applies combined context effects; services open or close as permissions and hours change. */
  setContext(effects: ContextEffects): void {
    this.baseContext = effects;
    this.applyContext();
  }

  private closedReason(id: ServiceId): ClosedReason | null {
    const c = this.context;
    if (!this.services[id].switchedOn) return 'switchedOff';
    if (this.org.closedDown.has(id)) return 'closedDown';
    if (this.mods.outOfService.has(id)) return 'outOfService';
    if ((id === 'outreach' && !c.outreachPermitted) || (id === 'clubHr' && !c.standPermitted)) return 'notPermitted';
    // The dedicated drug checking service can only operate where checking is legal.
    if (id === 'drugChecking' && !c.checkingAllowed) return 'notPermitted';
    // Closing time means closed overnight, until the morning.
    if (c.closesAt !== null && this.clockMinutes >= c.closesAt && this.clockMinutes < MORNING) return 'hours';
    // The club stand works the club's hours.
    if (id === 'clubHr' && this.clockMinutes >= CLUB_CLOSES && this.clockMinutes < CLUB_OPENS) return 'hours';
    return null;
  }

  /** True when hours, permissions or switches changed what can open since the last allocation. */
  private openingChanged(): boolean {
    for (const id of SERVICE_IDS) {
      const s = this.services[id];
      const current = s.closedReason === 'noStaff' ? null : s.closedReason;
      if (this.closedReason(id) !== current) return true;
    }
    return false;
  }

  staffArrived(id: ServiceId): void {
    this.services[id].staffOnSite++;
  }

  staffLeft(id: ServiceId): void {
    const s = this.services[id];
    s.staffOnSite = Math.max(0, s.staffOnSite - 1);
  }

  /** A person who set out for the service turned back before reaching it. */
  turnBack(id: ServiceId, visitor: VisitorId): void {
    const s = this.services[id];
    s.metrics.demand++;
    s.turnedBack++;
    this.recordUnmet(s, visitor, false);
  }

  /** The crowd carried out a possession stop. */
  recordPoliceStop(arrest: boolean): void {
    this.policeStops++;
    if (arrest) this.arrests++;
  }

  /** A person physically reached the service point. */
  arrive(id: ServiceId, visitor: VisitorId): ArrivalResult {
    const s = this.services[id];
    s.metrics.demand++;
    if (s.status !== 'open') {
      this.recordUnmet(s, visitor, false);
      return 'turnedAway';
    }
    if (s.queue.length === 0 && s.inService.size < s.capacity) {
      this.admit(s, visitor, false);
      return 'admitted';
    }
    if (s.queue.length < s.params.waitingSlots) {
      s.queue.push({ visitor, waited: 0 });
      return 'queued';
    }
    this.recordUnmet(s, visitor, false);
    return 'turnedAway';
  }

  /** A club-goer reached the end of the door queue. Returns false if the queue is full. */
  joinClubQueue(visitor: VisitorId): boolean {
    this.club.arrivals++;
    if (this.club.queue.length >= ILLUSTRATIVE.club.queueSlots) return false;
    this.club.queue.push(visitor);
    return true;
  }

  tick(dt: number): void {
    this.clockMinutes += dt * this.minuteRate;
    // A full day, 18:00 round to 18:00; then the next evening begins.
    if (this.clockMinutes >= DAY_END) {
      this.clockMinutes -= DAY_END - DAY_START;
      // A new evening: the calendar moves on and tonight's waves can start again.
      this.calendar.nextNight();
      this.wavesTonight.clear();
    }
    const date = this.calendar.date;
    const { started, ended } = this.events.tick(this.clockMinutes, dt * this.minuteRate, (id) => SEASONAL_EVENT_RATE[id]?.[date.season] ?? 1);
    // Calendar waves: dated happenings start in their window, once a night, and end when it closes.
    for (const w of CALENDAR_WAVES) {
      if (this.wavesTonight.has(w.event) || !w.when(date) || this.clockMinutes < w.from || this.clockMinutes >= w.to) continue;
      this.wavesTonight.add(w.event);
      if (this.events.isActive(w.event)) continue;
      const e = this.events.start(w.event, this.clockMinutes);
      e.endsAt = w.to;
      started.push(e);
    }
    // Events lead to others: an after-party when a festival ends, displacement after a crackdown.
    for (const e of ended) {
      if (e.id === 'musicFestival' && this.random() < 0.6 && !this.events.isActive('popUpParty')) started.push(this.events.start('popUpParty', this.clockMinutes));
      if (e.id === 'crackdown' && !this.events.isActive('afterCrackdown')) started.push(this.events.start('afterCrackdown', this.clockMinutes));
    }
    const active = new Set(this.events.active.map((e) => e.id));
    const out = this.services.outreach;
    for (const id of this.neighbourhood.tick(this.clockMinutes, dt * this.minuteRate, {
      outreachOnStreet: out.enabled && out.staffOnSite > 0,
      dropInOpen: this.services.dropIn.enabled,
      policePosted: this.context.patrol > 0 && this.context.patrolStyle === 'posted',
      crackdown: active.has('crackdown'),
      busyClub: active.has('busyNight'),
      party: this.mods.party,
      cityPressure: this.city.pressure,
      coldNight: active.has('coldNight'),
      neighbourhoodSupport: this.policy.neighbourhood,
      anonymous: this.policy.anonymous,
      lateNight: this.clockMinutes >= 25 * 60,
      activeEvents: active,
    })) started.push(this.events.start(id, this.clockMinutes));
    // Posted police shut an unlicensed pop-up down within about half an hour.
    if (this.mods.party === 'popUp' && this.context.patrol > 0 && this.context.patrolStyle === 'posted' && this.random() < (dt * this.minuteRate) / 30) {
      const e = this.events.end('popUpParty');
      if (e) ended.push(e);
    }
    const leaverRate = this.rate('leaver');
    for (const happening of this.city.tick(dt * this.minuteRate, {
      clock: this.clockMinutes,
      crowd: this.club.queue.length + (this.mods.party === 'festival' ? 40 : this.mods.party === 'popUp' ? 15 : 0),
      intoxicatedPerHour: intoxicationShare(this.clockMinutes) * leaverRate * 60,
      standStaffed: this.services.clubHr.enabled && this.services.clubHr.staffOnSite > 0,
      patrol: this.context.patrol,
      councilCleans: this.policy.council > 0,
      party: this.mods.party,
      scuffleMultiplier: this.mods.scuffles,
    })) {
      // Council cleaners clear most discarded equipment along with the graffiti.
      if (happening.kind === 'cleaners') this.neighbourhood.state.litter *= 0.3;
      this.emit({ type: 'city', happening });
    }
    if (started.length || ended.length) {
      this.eventsChanged();
      for (const e of started) this.emit({ type: 'eventStarted', event: e });
      for (const e of ended) this.emit({ type: 'eventEnded', event: e });
    }
    if (this.openingChanged()) this.reallocate();
    const income = this.fundingIncome;
    const wasBroke = this.org.broke;
    if (this.org.tick(this.clockMinutes, dt * this.minuteRate, income, this.paidOnShift, this.applicationContext())) {
      if (this.org.broke !== wasBroke) {
        // The money warning opens when the budget runs out and closes when it recovers.
        if (this.org.broke) this.triggerEvent('fundsRunningOut');
        else {
          const e = this.events.end('fundsRunningOut');
          if (e) { this.eventsChanged(); this.emit({ type: 'eventEnded', event: e }); }
        }
        this.applyContext();
      } else this.reallocate();
    }
    if (this.context.possessionStops && this.context.patrol > 0 && (this.stopTimer -= dt) <= 0) {
      this.emit({ type: 'policeStop', arrest: this.random() < ILLUSTRATIVE.people.arrestShare });
      this.stopTimer = nextArrival(this.random, ILLUSTRATIVE.policeStopsPerMinutePerOfficer * this.context.patrol);
    }
    this.tickArrivals(dt);
    for (const id of SERVICE_IDS) this.tickService(this.services[id], dt);
    this.tickClub(dt);
  }

  private tickArrivals(dt: number): void {
    const t = this.timers;
    const spawn = (intent: Intent, wantsStand = false) => {
      const seeksService = intent === 'dropIn' || intent === 'outreach' || wantsStand || (WALK_IN_SERVICE_IDS as readonly string[]).includes(intent);
      const turnsBack = seeksService && this.random() < this.context.deterrence;
      const visitor = this.nextVisitor++;
      const mix = intent === 'club' || intent === 'party' ? PROFILE_MIX.club : intent === 'passerby' ? PROFILE_MIX.passerby : PROFILE_MIX.service;
      this.profiles.set(visitor, this.drawProfile(mix));
      const kind = intent === 'passerby' ? this.city.passerbyKind(this.clockMinutes, this.calendar.date) : undefined;
      this.emit({ type: 'spawnVisitor', visitor, intent, wantsStand, turnsBack, kind });
    };

    if ((t.dropIn -= dt) <= 0) { spawn('dropIn'); t.dropIn = nextArrival(this.random, this.rate('dropIn')); }
    if ((t.outreach -= dt) <= 0) { spawn('outreach'); t.outreach = nextArrival(this.random, this.rate('outreach')); }
    for (const id of WALK_IN_SERVICE_IDS) {
      if ((t[id] -= dt) <= 0) { spawn(id); t[id] = nextArrival(this.random, this.rate(id)); }
    }
    if ((t.club -= dt) <= 0) {
      spawn('club', this.random() < this.standInterest);
      t.club = nextArrival(this.random, this.rate('club'));
    }
    if ((t.passerby -= dt) <= 0) { spawn('passerby'); t.passerby = nextArrival(this.random, this.rate('passerby')); }
    if ((t.party -= dt) <= 0) { spawn('party'); t.party = nextArrival(this.random, this.rate('party')); }
    if (this.partyBurst > 0) { this.partyBurst--; spawn('party'); }
    if ((t.car -= dt) <= 0) { this.emit({ type: 'spawnCar' }); t.car = nextArrival(this.random, this.rate('car')); }
    if ((t.leaver -= dt) <= 0) {
      if (this.club.inside > 0) {
        this.club.inside--;
        const intoxicated = this.random() < intoxicationShare(this.clockMinutes);
        if (intoxicated) this.intoxicatedLeavers++;
        // Leavers who took an affected substance can collapse on the terrace; stand staff may reach them.
        const acute = this.acuteFor(this.drawProfile(PROFILE_MIX.club), false, 'clubHr', ACUTE.reachedByStaff.terrace);
        this.emit({ type: 'clubLeaver', intoxicated, acute });
      }
      t.leaver = nextArrival(this.random, this.rate('leaver'));
    }
  }

  private tickService(s: ServiceModel, dt: number): void {
    for (const [visitor, remaining] of s.inService) {
      const left = remaining - dt;
      if (left <= 0) {
        s.inService.delete(visitor);
        const c = this.context;
        // The drug checking service always checks; other services only where the context puts checking.
        const checks = s.id === 'drugChecking' || c.checkingSites.includes(s.id);
        if (c.checkingAllowed && checks && this.random() < Math.min(1, ILLUSTRATIVE.checkingShare[s.id] * this.mods.checkingBoost)) this.recordCheck(s.id, visitor);
        if (s.id !== 'clubHr' && this.profiles.get(visitor)?.injects) {
          // Kits cost money; with none in stock or no money, the person leaves without them.
          if (this.mods.kitsOut || !this.org.spend(ORG.costs.sterileKit)) this.unsafeInjecting();
          else {
            this.health.sterileKits++;
            this.neighbourhood.note('kits');
          }
        }
        this.emit({ type: 'served', service: s.id, visitor });
      } else {
        s.inService.set(visitor, left);
      }
    }
    if (s.status === 'open') {
      while (s.queue.length > 0 && s.inService.size < s.capacity) this.admit(s, s.queue.shift()!.visitor, true);
    }
    for (let i = s.queue.length - 1; i >= 0; i--) {
      const w = s.queue[i];
      w.waited += dt;
      if (w.waited > s.params.patienceSeconds * this.mods.patience[s.id]) {
        s.queue.splice(i, 1);
        this.recordUnmet(s, w.visitor);
      }
    }
  }

  private tickClub(dt: number): void {
    const c = this.club;
    this.doorTimer -= dt;
    if (this.doorTimer <= 0 && c.queue.length > 0 && c.inside < c.capacity) {
      const visitor = c.queue.shift()!;
      c.inside++;
      c.entered++;
      if (this.random() < ILLUSTRATIVE.adverse.perClubEntry * ILLUSTRATIVE.adverse.serviceContactMultiplier) c.adverse++;
      this.emit({ type: 'clubAdmitted', visitor });
      this.doorTimer = range(this.random, ILLUSTRATIVE.club.doorIntervalSeconds);
    }
  }

  /**
   * A sample is checked. During a supply event, a sample of the affected
   * substance always shows it: the event counts as detected, and with public
   * alerts on, an alert names it and lowers risk for everyone affected.
   */
  private recordCheck(service: ServiceId, visitor: VisitorId): void {
    const c = this.checking;
    if (!this.org.spend(this.context.turnaround === 'lab' ? ORG.costs.labCheck : ORG.costs.onsiteCheck)) return;
    c.samples++;
    if (this.context.turnaround === 'lab' && this.random() >= CHECKING.labCollected.value * this.mods.labCollected) return;
    c.resultsReceived++;
    const substance = this.profiles.get(visitor)?.substance ?? 'none';
    const event = this.events.supplyEventFor(substance);
    if (!event && this.random() >= CHECKING.unexpected.value) return;
    c.unexpected++;
    if (event && event.detectedAt === null) event.detectedAt = this.clockMinutes;
    if (this.context.publicAlerts) {
      // The first public alert about a batch sends people to check their own.
      if (event && !event.alerted) {
        event.alerted = true;
        this.triggerEvent('checkingRush');
      }
      this.emit({ type: 'alert', service, word: event ? EVENTS[event.id].boardWord : 'ALERT' });
    }
    if (this.random() < CHECKING.changePlans.value) c.changedPlans++;
  }

  private admit(s: ServiceModel, visitor: VisitorId, notify: boolean): void {
    s.metrics.attended++;
    if (s.id !== 'clubHr') {
      this.neighbourhood.note('attended');
      this.neighbourhood.note('demand');
    }
    s.inService.set(visitor, range(this.random, s.params.serviceSeconds) * this.mods.serviceTime[s.id]);
    if (notify) this.emit({ type: 'admitted', service: s.id, visitor });
  }

  private recordUnmet(s: ServiceModel, visitor: VisitorId, notify = true): void {
    s.metrics.unmetNeed++;
    const adverse = this.random() < ILLUSTRATIVE.adverse.perUnmetNeed * ILLUSTRATIVE.adverse.serviceContactMultiplier;
    if (adverse) s.metrics.adverse++;
    // Only people who came for the drop-in or the outreach camper are modelled as using nearby afterwards.
    const hiddenUse = s.id !== 'clubHr' && this.random() < Math.min(1, ILLUSTRATIVE.people.hiddenUseShare * this.mods.hiddenUse);
    if (hiddenUse) {
      this.hiddenUse++;
      this.neighbourhood.note('hiddenUse');
    }
    if (s.id !== 'clubHr') {
      this.neighbourhood.note('unmet');
      this.neighbourhood.note('demand');
    }
    const profile = this.profiles.get(visitor);
    if (s.id !== 'clubHr' && profile?.injects) this.unsafeInjecting();
    // Using alone in a hidden spot during a supply event: outreach may find the person in time.
    const acute = hiddenUse ? this.acuteFor(profile, true, 'outreach', ACUTE.reachedByStaff.hidden) : null;
    if (notify) this.emit({ type: 'leftUnserved', service: s.id, visitor });
    this.emit({ type: 'aftermath', service: s.id, visitor, hiddenUse, adverse, acute });
  }
}

/** Visible intoxication among club leavers rises through the night (illustrative curve). */
function intoxicationShare(clockMinutes: number): number {
  const p = ILLUSTRATIVE.people.intoxication;
  // By day, after the club has shut, little visible intoxication is left.
  if (clockMinutes >= CLUB_CLOSES) return p.early * 0.3;
  const t = Math.min(1, Math.max(0, (clockMinutes - DAY_START - 60) / (6 * 60)));
  return p.early + (p.late - p.early) * t;
}

const serviceOf = (key: `${ServiceId}.${string}`): ServiceId => key.slice(0, key.indexOf('.')) as ServiceId;
