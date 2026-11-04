import { TutorialProgress, FULL_TUTORIAL_CAPABILITIES, type TutorialCapabilities } from '../game/tutorial';
import { Exposure, EXPOSURE, exposureNow, type ExposureHarm } from './exposure';
import { ServiceMix } from './serviceMix';
import { CRISIS } from '../config/crisis';
import { HUSTLE } from '../config/hustles';
import { RESIDENTS } from '../config/residents';
import { BASE_STAGE, NEW_STAGE, stageCount, stageOf } from '../config/serviceStages';
import { Reputation } from './reputation';
import { favourView } from './favourView';
import { CONCESSIONS, FAVOUR, type ConcessionId, type FavourId } from '../config/favours';
import { CAMP, Camp } from './camp';
import { ParkLife } from './parkLife';
import { QUESTS, type InstitutionId } from '../config/institutionQuests';
import { CAMPER_PATH, CAMPER_PATH_EFFECT, type CamperPath } from '../config/camperPaths';
import { CityStress, STRESS } from './cityStress';
import { VENUE_KINDS, VITALITY, Vitality, type VenueKind } from './vitality';
import { ACTIVITY, type Activity } from '../config/serviceMix';
import { Team, type Assignment, type Member } from './team';
import { Stakes, type RunOverCause } from './stakes';
import { Patrol } from './patrol';
import { happeningsAt, type Happening } from './happenings';
import { HAPPENINGS } from '../config/happenings';
import { PATROL, type PatrolSpot } from '../config/patrol';
import type { IntroId } from '../config/intro';
import type { StormReport } from './storm';
import { STORM, type StormPrep } from '../config/storm';
import { GRANT_TIER, TIER_NAMES, UNLOCK_NAMES, UNLOCK_TIER, type Unlock } from '../config/standing';
import type { SupplyId } from '../config/supplies';

/** What a donation box brings in, per staff member on shift per clock hour. ILLUSTRATIVE. */
export const DONATION_PER_STAFF_HOUR = 3;
/** What the new venues are called on the street and in the feed. */
export const VENUE_NAMES: Record<VenueKind, string> = { bar: t('bar'), cafe: t('café'), club: t('club'), live: t('live music venue') };
/** Money per coin shown over a place. */
const MONEY_LUMP = 1;

/** Investing in a service. ILLUSTRATIVE prices and rates. */
export const INVEST = {
  cost: 150,
  /** Share of the bar one investment fills. */
  step: 0.25,
  /** Upkeep per stage above the usual size, per clock hour. */
  upkeepPerLevelHour: 8,
  /** Share of the bar lost per clock hour without money. */
  decayPerHour: 0.12,
  /** Wear and tear per person served: busy places need investment to hold their level. */
  wearPerVisit: 0.003,
};

/** What each newly introduced system is, in one notice (config/intro.ts). */
const INTRO_NOTICE: Record<IntroId, string> = {
  supplies: t('New: supplies. Naloxone, kits, leaflets and blankets are now on a shelf in the Organisation sheet. Order ahead; an empty shelf means people go without.'),
  standing: t('New: standing in the city. Every person helped raises it, every person turned away and every death lowers it. Higher standing brings more donations and opens grants and new places.'),
  matching: t('New: matching. Some people need a particular skill: another language, housing help, wound care, a peer, calm. With the right worker on shift there it goes quicker; the Organisation sheet lists what was missing.'),
};

const SERVICE_LABEL: Record<ServiceId, string> = { dropIn: t('Drop-in centre'), outreach: t('Outreach camper'), clubHr: t('Club stand'), footPatrol: t('Foot patrol'), drugChecking: t('Drug checking'), shelter: t('Shelter'), clinic: t('Clinic') };
import { Property, PROPERTY, SATELLITE_NAME, UNIT_EXTRA, type SatelliteService } from './property';
import { SEASON_PROFILES } from '../config/seasons';
import type { Season } from './calendar';
import { ILLUSTRATIVE, type ServiceParams } from '../config/illustrative';
import type { SandboxSettings } from '../config/sandboxParams';
import { CHECKING, NEUTRAL_EFFECTS, type ContextEffects } from '../config/contextFactors';
import { CLUB_CLOSES, CLUB_OPENS, DAY_END, DAY_START, MORNING } from './clock';
import { personSupport, supportFit, type PersonSupport } from './personSupport';
import { ACUTE, EVENTS, INJECTING_SHARE, PROFILE_MIX, type EventId, type Profile, type Substance } from '../config/randomEvents';
import { EventEngine, combineEventEffects, type ActiveEvent, type EventMods } from './eventEngine';
import { ORG, type ApplicationContext, type GrantId, type RecruitId } from '../config/organisation';
import { Organisation, SERVICE_NAMES, type OrgNotice } from './organisation';
import { Neighbourhood } from './neighbourhood';
import { CityLife, type CityHappening, type PasserbyKind } from './cityLife';
import { PettyCrime, type Theft } from './pettyCrime';
import { StreetVisitors, type Visit } from './streetVisitors';
import { PETTY, SHOP_NAMES } from '../config/pettyCrime';
import { VISIT_NOTICE, VISITORS } from '../config/streetVisitors';
import { FUNDERS } from '../config/funders';
import { Calendar } from './calendar';
import { CALENDAR_WAVES, SEASONAL_EVENT_RATE } from '../config/populations';
import { createRandom, nextArrival, range, type Random } from './random';
import { Funders } from './funders';
import { Goals, type NightReport } from './goals';
import { scenarioById } from '../config/scenarios';
import { NIGHT_RAMP, ramp } from '../config/difficulty';
import { Growth } from './growth';
import { ChaosDaemon, DAEMON, type DaemonAnswer } from './chaosDaemon';
import { SERVICE_IDS, WALK_IN_SERVICE_IDS, type ServiceId, type ServiceStatus, type WalkInServiceId } from './types';
import { plural, t } from '../i18n';

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
  | { type: 'staffRota' }
  | { type: 'served'; service: ServiceId; visitor: VisitorId }
  | { type: 'leftUnserved'; service: ServiceId; visitor: VisitorId }
  /** Staff for posts `first` .. `first + count - 1` set out. */
  | { type: 'staffCall'; service: ServiceId; first: number; count: number }
  /** Staff at posts `fromPost` and above leave. */
  | { type: 'staffRelease'; service: ServiceId; fromPost: number }
  | { type: 'clubAdmitted'; visitor: VisitorId }
  | { type: 'clubLeaver'; intoxicated: boolean; acute: AcuteOutcome | null }
  /** Someone outdoors was harmed by the cold or the heat; an ambulance is called. */
  | { type: 'exposure'; harm: ExposureHarm }
  /** 08:00: the night just ended, scored against its goals. */
  | { type: 'nightReport'; report: NightReport }
  /** A pickpocketing or shoplifting (sim/pettyCrime.ts), for the street to show. */
  | { type: 'theft'; theft: Theft }
  /** A picket, priest or nun arrives at a service or leaves (sim/streetVisitors.ts). */
  | { type: 'visit'; what: 'arrive' | 'leave'; visit: Visit }
  /** The big crisis: warned of, begun, or over with its report (sim/storm.ts). */
  | { type: 'storm'; what: 'warned' | 'started' }
  | { type: 'storm'; what: 'ended'; report: StormReport }
  /** The project has folded: the team is gone or every starting service is shut. */
  | { type: 'runOver'; cause: RunOverCause }
  /** Money moved at a place: in (positive) or out (negative), one unit at a time, for the coins over it. */
  | { type: 'money'; service: ServiceId; amount: number };

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
export type ClosedReason = 'switchedOff' | 'closedDown' | 'hours' | 'notPermitted' | 'outOfService' | 'noStaff' | 'onPatrol';

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
  /** Fentanyl strips and reagent kits handed out: people test their own (no lab result, no early warning). */
  selfTests: number;
}

export class ServiceModel {
  /** Effective state: switched on, within opening hours and permitted. */
  enabled = true;
  /** The on/off switch in the HUD. */
  switchedOn = true;
  /**
   * Run at some point this game: its regulars know it and keep coming, even while it is switched
   * off. Nobody sets out for a service the organisation has never run.
   */
  everRun = true;
  closedReason: ClosedReason | null = null;
  /** People who set out for this service and turned back before reaching it (part of unmet need). */
  turnedBack = 0;
  /** Staff off for an event (illness); they reduce what this service asks for. */
  staffLoss = 0;
  /** Staff the organisation assigned from its pool (paid first, then volunteers). */
  assigned = 0;
  paidAssigned = 0;
  staffOnSite = 0;
  /** Places added by satellites in rented units, or extra campers. */
  extraPlaces = 0;
  /** How good tonight's crew is here: the mean of their fit (1 is ordinary). */
  skill = 1;
  readonly queue: Waiting[] = [];
  readonly inService = new Map<VisitorId, number>();
  readonly metrics = emptyMetrics();
  /** Live copy: sandbox sliders change staff, waiting places and patience. */
  readonly params: ServiceParams;

  /** Waiting places the stage adds or takes away (set with the stage's places). */
  stageWaiting = 0;
  /** Staff on shift at the usual size, and the waiting places that go with them. */
  private readonly usualStaff: number;

  constructor(readonly id: ServiceId, params: ServiceParams) {
    this.params = { ...params };
    this.usualStaff = params.staff;
  }

  /**
   * Room to wait: the usual places, one more or fewer for each person on shift
   * above or below the usual number, and what the stage adds. Not bought on its
   * own: it follows the staffing and how far the place has grown.
   */
  get waitingRoom(): number {
    return Math.max(1, this.params.waitingSlots + (this.params.staff - this.usualStaff) + this.stageWaiting);
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
    // A small first stage takes places away, but someone on site can always help one person.
    return Math.max(1, Math.floor(this.staffOnSite * this.params.capacityPerStaff * this.skill) + this.extraPlaces);
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
    footPatrol: ILLUSTRATIVE.services.footPatrol.demandPerMinute,
    drugChecking: ILLUSTRATIVE.services.drugChecking.demandPerMinute,
    shelter: ILLUSTRATIVE.services.shelter.demandPerMinute,
    clinic: ILLUSTRATIVE.services.clinic.demandPerMinute,
    party: 0,
  };
  private standInterest: number = ILLUSTRATIVE.club.standInterest;
  private clockRate: number = ILLUSTRATIVE.clockMinutesPerSecond;
  /** Whether the hours move on. Held, the time of night stays put while people go on moving. */
  cycle = true;
  /**
   * Seconds of arrivals, service and patience per real second: they follow the clock, so a faster
   * clock brings the same people per clock hour. Held, they run at the usual pace.
   */
  private get timeScale(): number {
    return this.cycle ? this.clockRate / ILLUSTRATIVE.clockMinutesPerSecond : 1;
  }

  /**
   * How fast people on the street should move against the usual: the same pace as arrivals and
   * service (`timeScale`), so a faster clock brings the same visits per clock hour, walking included.
   */
  get pace(): number {
    return this.timeScale;
  }

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
  private readonly supportProfiles = new Map<VisitorId, PersonSupport>();
  readonly health: HealthCounts = { acuteHarms: 0, helped: 0, alone: 0, sterileKits: 0, unsafeInjecting: 0 };
  readonly org: Organisation;
  private policy: PolicyInfo = { council: 1, policeAgreement: false, criminalPossession: true, funding: 'project', neighbourhood: 1, anonymous: true };
  readonly neighbourhood: Neighbourhood;
  /** Shop units that close and go to let, and the space the organisation rents. */
  readonly property: Property;
  /** What each place spends its visits on (checking, kits, naloxone, counselling, basics). */
  readonly mix = new ServiceMix();
  /** Weather harm to people outdoors, and the two remedies the organisation can run. */
  readonly exposure: Exposure;
  warmingBus = false;
  coolingPoint = false;
  /** Reputation earns favours; spending schedules one pending concession. */
  favours = 1;
  readonly reputation = new Reputation();
  private favourViewRevision = -1;
  private favourViewTutorial = false;
  private favourViewCache?: ReturnType<typeof favourView>;
  get favourView() {
    const r = this.reputation;
    const cached = this.favourViewCache;
    const tutorial = !!this.tutorial?.active;
    if (!cached || cached.score !== Math.floor(r.score) || cached.progress !== Math.floor(r.progress * 100)
      || cached.held !== this.favours || cached.owed !== (this.concessionAt !== null)
      || this.favourViewRevision !== r.revision || this.favourViewTutorial !== tutorial) {
      this.favourViewRevision = r.revision;
      this.favourViewTutorial = tutorial;
      this.favourViewCache = favourView(r, this.favours, this.concessionAt !== null, tutorial);
    }
    return this.favourViewCache!;
  }

  /** When city hall will ask for its concession (`org.now` minutes), or null when nothing is owed. */
  concessionAt: number | null = null;
  /** Police keep away from the services until this time. */
  private policeAwayUntil = 0;
  /** An officer is posted by the services until this time (a concession). */
  private policePostedUntil = 0;
  private policeState = 0;
  /** No clearing of the park camp until this time. */
  campHoldUntil = 0;
  /** The club pays for the stand while it is open. */
  clubContract = false;
  /** The club said no: it can be asked again from this time (`org.now` minutes). */
  clubAskAgainAt = 0;
  /** The drug checking service sells its checks: a little money, less public good. */
  commercialChecking = false;
  /** A donation drive runs until this time (`org.now` minutes), or null. */
  driveUntil: number | null = null;
  /** The next drive can start from this time (`org.now` minutes): people do not give twice in a day. */
  driveAgainAt = 0;
  /** Game minute from which the next sweep for discarded kit can go out. */
  sweepAgainAt = 0;
  /** Residents were met: safer-feeling street until this minute; the next round from `meetAgainAt`. */
  residentsMetUntil = 0;
  meetAgainAt = 0;
  /** How well the district is doing: grows with harm reduction that works, opens new venues. */
  readonly vitality = new Vitality();
  /** How many people the district holds against the first evening, and how much of it is street scene (sim/growth.ts). */
  readonly growth = new Growth();
  /** Someone in acute crisis roaming the street, when things are bad (sim/chaosDaemon.ts). */
  readonly daemon = new ChaosDaemon();
  /** The street scene's band last announced (0 calm, 1 growing, 2 crisis), and whether all-shut was said. */
  private streetBand = 0;
  private allShutSaid = false;
  /** Pressure on the city's police, ambulances and sobering-up centre. */
  readonly cityStress = new CityStress();
  /** The tent camp in the big park. */
  readonly camp = new Camp();
  private campStage = 0;
  /** When each person in the last 24 clock hours left without being served (`org.now` minutes). */
  private readonly unmetLog: number[] = [];
  private inCrisis = false;

  /** People who left without being served in the last 24 clock hours. */
  get unmet24(): number {
    const since = this.org.now - 24 * 60;
    let drop = 0;
    while (drop < this.unmetLog.length && this.unmetLog[drop] < since) drop++;
    if (drop) this.unmetLog.splice(0, drop);
    return this.unmetLog.length;
  }

  /**
   * How deep the crisis is, from unmet need over the last day: 0 below
   * CRISIS.calm, 1 at CRISIS.full and above. A crisis feeds itself: more
   * random events, warier funders, more harm outdoors (illustrative).
   */
  /** How many more people in trouble come to the services: 1 when calm (see CRISIS.demandSurge). */
  get surge(): number {
    const s = this.cityStress;
    const stretched = Math.max(0, (Math.max(s.police, s.medics, s.sobering) - CRISIS.surgeFrom) / (1 - CRISIS.surgeFrom));
    return 1 + CRISIS.demandSurge * this.crisis + CRISIS.stressSurge * stretched;
  }

  get crisis(): number {
    const turnedAway = (this.unmet24 - CRISIS.calm) / (CRISIS.full - CRISIS.calm);
    const s = this.cityStress;
    const stretched = (Math.max(s.police, s.medics, s.sobering) - CRISIS.stressFrom) / (CRISIS.stressFull - CRISIS.stressFrom);
    return Math.min(1, Math.max(0, turnedAway, stretched) * ramp(NIGHT_RAMP.crisis, this.totals.nights));
  }

  /** A camper (the first or an extra one) stands by the squat: its residents come to the counter. */
  squatCovered = false;
  /** Joggers, the yoga class, a family picnic: what goes on in the big park, and what spoils it. */
  readonly park = new ParkLife();
  /** Steps done in each institution's side quest. */
  readonly quests: Record<InstitutionId, number> = { police: 0, cityHall: 0, hospital: 0, sobering: 0 };
  /** What the outreach camper specialises in, if anything. */
  camperPath: CamperPath | null = null;
  /** Per service: extra turning back from something on the street nearby, and until when. */
  private readonly localDeterrence = new Map<ServiceId, { extra: number; until: number }>();
  /** Pickpockets and shoplifters, and the shops that answer them (its own random stream). */
  readonly petty = new PettyCrime();
  /** A picket, priest or nun at a service tonight, for or against (its own random stream). */
  readonly visitors = new StreetVisitors();
  /** The outreach camper is driving to a new spot: closed until then (in `org.now` minutes). */
  private movingUntil: number | null = null;
  private movingWasOn = true;
  /** The people behind the staff numbers: qualities, energy, morale and who works where. */
  readonly team: Team;
  private readonly previousRota = new Map<Member, ServiceId | null>();
  /** Morale's consequences, standing, supplies, the big crisis, matching and the run's end (sim/stakes.ts). */
  readonly stakes: Stakes;
  /** The foot patrol at its table or out at a spot (sim/patrol.ts). */
  readonly patrol = new Patrol();
  /** Festival weekends, home matches and university weekends off on now (sim/happenings.ts), worked out each step. */
  private tonight: Happening[] = [];
  /** Which happenings have been announced tonight (id and day of the year). */
  private readonly happeningSaid = new Set<string>();
  private happeningDay = -1;

  /** What regular happening is on now, how far along and how big a crowd: for the world to draw. */
  happenings(): readonly Happening[] {
    return this.tonight;
  }

  /** People out against the usual for `flow` from tonight's happenings (1 with none on). */
  private happeningDemand(flow: 'passerby' | 'club' | 'drugChecking'): number {
    let f = 1;
    for (const h of this.tonight) f *= 1 + ((HAPPENINGS[h.id].demand[flow] ?? 1) - 1) * h.crowd;
    return f;
  }

  /** Tonight's happenings: worked out from the date and clock, announced as they begin, loading the city's services. */
  private tickHappenings(dtMinutes: number): void {
    const before = this.tonight.length;
    // A new evening: last night's announcements are forgotten.
    if (this.happeningDay !== this.calendar.date.dayOfYear) { this.happeningDay = this.calendar.date.dayOfYear; this.happeningSaid.clear(); }
    this.tonight = happeningsAt(this.calendar.date, this.clockMinutes);
    for (const h of this.tonight) {
      const info = HAPPENINGS[h.id];
      const key = h.id;
      if (!this.happeningSaid.has(key)) {
        this.happeningSaid.add(key);
        this.org.notice(this.clockMinutes, info.begins);
      }
      for (const meter of ['police', 'medics', 'sobering'] as const) {
        const load = info.load[meter];
        if (load) this.cityStress.bump(meter, h.id, load * h.crowd * (dtMinutes / 60));
      }
    }
    // Arrivals follow the crowd: re-time them when a happening starts or ends.
    if (this.tonight.length !== before) for (const id of ['passerby', 'club', 'drugChecking'] as const) this.timers[id] = nextArrival(this.random, this.rate(id));
  }
  /** This game so far, for saves and the leaderboard: people served and nights run. */
  readonly totals = { helped: 0, nights: 0 };
  /** How far funders trust the project, from the last day's results (multiplies project funding, grant odds and drives). */
  readonly funders = new Funders();
  /** The night's goals, stars over the run and the scenario being played, if any. */
  readonly goals = new Goals();
  /** People turned away at a door over the whole run (the night report counts tonight's). */
  turnedAwayTotal = 0;
  private goalsBegun = false;

  /** After loading a save: the night's goals as they were (the save's own night start). */
  restoreGoals(g: Parameters<Goals['restore']>[0]): void {
    this.goals.restore(g, scenarioById);
    if (g?.start) this.goalsBegun = true;
  }
  /**
   * Each service's stage (1 to its last, see SERVICE_STAGES) and progress toward the next (0..1): money in
   * fills it, going broke drains it. The starting services begin at their usual size, the rest small.
   */
  readonly upgrades = Object.fromEntries(SERVICE_IDS.map((id) => [id, { level: ORG.startServices.includes(id) ? BASE_STAGE : NEW_STAGE, progress: 0.3 }])) as Record<ServiceId, { level: number; progress: number }>;
  /** The stage wear cannot take a service below: where it started. */
  private readonly stageFloor = Object.fromEntries(SERVICE_IDS.map((id) => [id, ORG.startServices.includes(id) ? BASE_STAGE : NEW_STAGE])) as Record<ServiceId, number>;
  readonly city: CityLife;
  readonly calendar = new Calendar();
  /** Calendar waves already started tonight. */
  private readonly wavesTonight = new Set<string>();
  readonly checking: CheckingCounts = { samples: 0, resultsReceived: 0, unexpected: 0, changedPlans: 0, selfTests: 0 };
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
    this.exposure = new Exposure(this.random);
    this.org = new Organisation(this.random, (notice) => this.emit({ type: 'orgNotice', notice }));
    this.neighbourhood = new Neighbourhood(this.random);
    this.property = new Property(this.random);
    this.team = new Team(seed);
    this.stakes = new Stakes(seed, this.team, this.org, (text) => this.org.notice(this.clockMinutes, text));
    this.city = new CityLife(this.random);
    const p = ILLUSTRATIVE.services;
    this.services = {
      dropIn: new ServiceModel('dropIn', p.dropIn),
      outreach: new ServiceModel('outreach', p.outreach),
      clubHr: new ServiceModel('clubHr', p.clubHr),
      footPatrol: new ServiceModel('footPatrol', p.footPatrol),
      drugChecking: new ServiceModel('drugChecking', p.drugChecking),
      shelter: new ServiceModel('shelter', p.shelter),
      clinic: new ServiceModel('clinic', p.clinic),
    };
    for (const id of SERVICE_IDS) this.services[id].switchedOn = this.services[id].everRun = ORG.startServices.includes(id);
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
      footPatrol: this.random() * 6,
      drugChecking: this.random() * 6,
      shelter: this.random() * 6,
      clinic: this.random() * 6,
      party: Infinity,
    };
    // Each service's places follow its starting stage from the first minute (a later service starts small).
    this.syncExtraPlaces();
  }

  tutorial: TutorialProgress | null = null;

  get tutorialCapabilities(): TutorialCapabilities { return this.tutorial?.capabilities ?? FULL_TUTORIAL_CAPABILITIES; }
  tutorialAllowsService(id: ServiceId): boolean { return this.tutorial?.allowsService(id) ?? true; }

  startTutorial(): void {
    this.tutorial = new TutorialProgress();
    this.stakes.hardcore = false;
    this.stakes.runOver = null;
    this.goals.scenario = null;
    this.org.paid = 2;
    this.org.volunteers = 0;
    this.org.budget = 400;
    this.camp.size = Math.max(0.2, this.camp.size);
    this.club.inside = 0;
    for (const id of SERVICE_IDS) {
      const service = this.services[id];
      service.switchedOn = service.everRun = id === 'footPatrol';
      service.params.staff = id === 'footPatrol' ? 2 : 1;
    }
    this.applyTutorialReward();
    this.reallocate();
  }

  tutorialInspectCamp(): void { this.tutorial?.inspectCamp(); this.applyTutorialReward(); }
  tutorialOpenPatrol(): void { this.tutorial?.openPatrol(); this.applyTutorialReward(); }
  tutorialReviewSkills(): void { this.tutorial?.reviewSkills(); this.applyTutorialReward(); }

  private applyTutorialReward(): void {
    const tutorial = this.tutorial;
    if (!tutorial?.claimReward()) return;
    if (tutorial.active) {
      this.org.budget += 300;
      this.org.paid = Math.max(this.org.paid, tutorial.capabilities.services.length + 1);
      this.org.equipment = true;
      if (tutorial.stage === 'nightlife' && (this.clockMinutes >= CLUB_CLOSES && this.clockMinutes < CLUB_OPENS)) this.clockMinutes = CLUB_OPENS;
      for (const id of tutorial.capabilities.services) this.timers[id === 'clubHr' ? 'club' : id] = nextArrival(this.random, this.rate(id === 'clubHr' ? 'club' : id));
      this.org.broke = false;
      for (const id of ['naloxone', 'kits', 'leaflets', 'blankets'] as const) this.stakes.supplies.stock[id] = Math.max(60, this.stakes.supplies.stock[id]);
    } else {
      for (const id of Object.keys(this.timers) as RateId[]) this.timers[id] = nextArrival(this.random, this.rate(id));
    }
    this.reallocate();
  }

  /** The tutorial advances only the active neighbourhood's services, not an unseen full city. */
  private tickTutorial(dt: number): void {
    const tutorial = this.tutorial!;
    const minutes = dt * this.minuteRate;
    const before = this.clockMinutes;
    this.clockMinutes += minutes;
    this.org.now += minutes;
    if (!this.goalsBegun) {
      this.goalsBegun = true;
      this.goals.begin(this.totals.helped, this.turnedAwayTotal, this.deaths, this.org.budget);
    }
    this.goals.tick(minutes, false);
    if (before < MORNING && this.clockMinutes >= MORNING) {
      const report = this.goals.end(this.totals.nights, this.totals.helped, this.turnedAwayTotal, this.deaths, this.org.budget, this.totals.helped, false);
      this.totals.nights++;
      // Check before notifying UI; a report must occur after entering the final stage.
      tutorial.night((['outreach', 'dropIn', 'clubHr'] as const).every((id) => {
        const service = this.services[id];
        // The club closes naturally at 06:00; remember its staffed evening at the 08:00 report.
        return tutorial.nightServices.includes(id) && service.switchedOn && !this.org.closedDown.has(id);
      }));
      this.applyTutorialReward();
      this.emit({ type: 'nightReport', report });
    }
    if (this.clockMinutes >= DAY_END) {
      this.clockMinutes -= DAY_END - DAY_START;
      this.calendar.nextNight();
    }
    this.tickPatrol(minutes);
    this.org.budget = Math.max(0, this.org.budget - (this.payroll + this.runningPerHour) * minutes / 60);
    const exhausted = this.team.members.every((m) => m.energy < 0.15 || m.morale < 0.15);
    if ((this.org.budget < 50 || exhausted || this.org.closedDown.size > 0 || this.org.paid < tutorial.capabilities.services.length + 1) && tutorial.recover(this.org.now)) {
      this.org.budget = Math.max(300, this.org.budget);
      this.org.notice(this.clockMinutes, t('Tutorial support: emergency funds and a rested team keep the next lesson within reach.'));
      this.org.paid = Math.max(tutorial.capabilities.services.length + 1, this.org.paid);
      this.team.sync(this.org.paid, this.org.volunteers);
      for (const member of this.team.members) {
        member.energy = Math.max(0.65, member.energy);
        member.morale = Math.max(0.65, member.morale);
        if (member.assignment === 'rest') member.assignment = 'auto';
      }
      for (const id of tutorial.capabilities.services) this.org.closedDown.delete(id);
      this.reallocate();
    }
    const rota = this.team.tick(minutes / 60, false, { unpaid: false, steadier: true, drain: 1 });
    if (rota || this.openingChanged()) this.reallocate();
    else this.updateSkill();
    const paced = dt * this.timeScale;
    this.tickArrivals(paced);
    for (const id of tutorial.capabilities.services) this.tickService(this.services[id], paced);
    if (tutorial.capabilities.stress) this.tickClub(paced);
    tutorial.observeOperational((['outreach', 'dropIn', 'clubHr'] as const).filter((id) => this.services[id].status === 'open' && this.services[id].assigned > 0));
    this.applyTutorialReward();
  }

  on(listener: (e: SimEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(e: SimEvent): void {
    if (e.type === 'served' && this.tutorial?.active) { this.tutorial.served(e.service); this.applyTutorialReward(); }
    this.cityStress.note(e);
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
      if (this.tutorial?.active) {
        const service = key.slice(0, key.indexOf('.')) as ServiceId;
        const staffing = key.endsWith('.staff') && this.tutorialCapabilities.staff && this.tutorialAllowsService(service);
        const capacity = key.endsWith('.waiting') && this.tutorialCapabilities.maintenance && this.tutorialAllowsService(service);
        if (key !== 'clockSpeed' && !staffing && !capacity) continue;
      }
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
        case 'footPatrol.staff': case 'drugChecking.staff': case 'shelter.staff': case 'clinic.staff':
          this.setStaff(serviceOf(key), value); break;
        case 'dropIn.waiting': case 'outreach.waiting': case 'clubHr.waiting':
        case 'footPatrol.waiting': case 'drugChecking.waiting': case 'shelter.waiting': case 'clinic.waiting':
          this.services[serviceOf(key)].params.waitingSlots = value; break;
        case 'dropIn.patience': case 'outreach.patience': case 'clubHr.patience':
        case 'footPatrol.patience': case 'drugChecking.patience': case 'shelter.patience': case 'clinic.patience':
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
    if (this.tutorial?.active) {
      if ((SERVICE_IDS as readonly string[]).includes(id) && !this.tutorialAllowsService(id as ServiceId)) return 0;
      if (['passerby', 'car', 'party', 'leaver'].includes(id)) return 0;
      if (id === 'club' && !this.tutorialCapabilities.services.includes('clubHr')) return 0;
    }
    // The club is shut from six in the morning until the evening.
    if (id === 'club' && this.clockMinutes >= CLUB_CLOSES && this.clockMinutes < CLUB_OPENS) return 0;
    // Party arrivals follow whichever party is on (illustrative per minute).
    if (id === 'party') return this.mods.party === 'festival' ? 14 : this.mods.party === 'popUp' ? 6 : 0;
    if (id === 'outreach' && this.camperPath === 'nightlife') return this.baseRate(id) * CAMPER_PATH_EFFECT.nightlifeDemand;
    return this.baseRate(id);
  }

  private baseRate(id: RateId): number {
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
    // People living in a squat come to a camper parked by it (illustrative).
    const squat = id === 'outreach' ? (this.squatCovered ? 1.5 * (1 + CAMP.squatDemand * this.camp.squat) : 1) * (1 + CAMP.outreachDemand * this.camp.outdoors) : 1;
    // Paying for a check puts some people off.
    const fee = id === 'drugChecking' && this.commercialChecking ? HUSTLE.commercialDemand : 1;
    // A thriving district brings more people out, and more people needing the services.
    const v = id === 'passerby' || id === 'club' ? this.vitality.footfall * (1 + 0.15 * this.vitality.venues) : this.vitality.demand;
    // The district grows either way (sim/growth.ts): everyone out at night with its size, and the
    // low-threshold services with its street scene too. Neglect also brings people to the door now:
    // more of them in a crisis and while the city is stretched.
    // Traffic grows only a little with the district (most of it is passing through) and a crisis does not
    // bring more cars: with the people's growth and surge on it, the main street jammed solid.
    const grown = id === 'car' ? 1 + 0.2 * (this.growth.size - 1)
      : id === 'passerby' || id === 'club' || id === 'party' || id === 'drugChecking' || id === 'leaver' ? this.growth.size : this.growth.streetNeed;
    const need = id === 'passerby' || id === 'club' || id === 'party' || id === 'car' || id === 'leaver' ? 1 : this.surge;
    // The big crisis brings far more people in trouble to the low-threshold doors.
    const storm = this.stakes.storm.phase === 'peak' && (id === 'dropIn' || id === 'outreach' || id === 'footPatrol' || id === 'shelter' || id === 'clinic')
      ? 1 + STORM.demand * this.stakes.storm.severity : 1;
    // A festival, a home match or a university weekend off brings more people out.
    const crowd = id === 'passerby' || id === 'club' || id === 'drugChecking' ? this.happeningDemand(id) : 1;
    return this.rates[id] * boost * street * seasonal * squat * fee * v * grown * need * storm * crowd;
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
    // Draw up the rota from named people: pinned workers go where they were
    // sent, then the rest fill each service's request, paid first, best fit first.
    this.team.sync(this.org.paid, this.org.volunteers);
    const pool = this.team.available(!this.org.broke);
    for (const m of this.team.members) m.workingAt = null;
    const reasons = {} as Record<ServiceId, ClosedReason | null>;
    const crew = {} as Record<ServiceId, Member[]>;
    for (const id of SERVICE_IDS) {
      reasons[id] = this.closedReason(id);
      crew[id] = [];
    }
    // A foot patrol out on the street keeps its crew: the table is shut, the work goes on.
    const crewed = (id: ServiceId) => !reasons[id] || reasons[id] === 'onPatrol';
    for (const m of pool) if (m.assignment !== 'auto' && m.assignment !== 'rest' && crewed(m.assignment)) crew[m.assignment].push(m);
    const free = pool.filter((m) => m.assignment === 'auto');
    for (const id of SERVICE_IDS) {
      if (!crewed(id)) continue;
      const s = this.services[id];
      if (!free.length || crew[id].length >= s.requested) continue;
      // A small sample of today's actual queues refines the ordinary best-fit rota.
      const demand = [...s.queue.slice(0, 8).map((waiting) => waiting.visitor), ...[...s.inService.keys()].slice(0, 4)]
        .map((visitor) => this.supportOf(visitor)).filter((support): support is PersonSupport => !!support);
      const fit = new Map(free.map((member) => [member, Team.fit(member, id) + (demand.length
        ? .15 * demand.reduce((sum, support) => sum + supportFit(member, support), 0) / demand.length : 0)]));
      while (crew[id].length < s.requested && free.length) {
        free.sort((a, b) => Number(b.paid) - Number(a.paid) || fit.get(b)! - fit.get(a)!);
        crew[id].push(free.shift()!);
      }
    }
    for (const id of SERVICE_IDS) {
      const c = crew[id];
      for (const m of c) m.workingAt = id;
      const paid = c.filter((m) => m.paid).length;
      const reason = reasons[id] ?? (c.length === 0 ? 'noStaff' : null);
      this.applyPlan(id, { reason, assigned: c.length, paid });
    }
    this.updateSkill();
    const changed = this.previousRota.size !== this.team.members.length || this.team.members.some((member) =>
      !this.previousRota.has(member) || this.previousRota.get(member) !== member.workingAt);
    if (changed) {
      this.previousRota.clear();
      for (const member of this.team.members) this.previousRota.set(member, member.workingAt);
      if (this.started) this.emit({ type: 'staffRota' });
    }
  }

  /** Each service's crew quality, from who works there and how tired they are. */
  private updateSkill(): void {
    for (const id of SERVICE_IDS) {
      let sum = 0;
      let n = 0;
      for (const m of this.team.members) if (m.workingAt === id) { sum += Team.fit(m, id); n++; }
      this.services[id].skill = n ? sum / n : 1;
    }
  }

  /** Sends a named worker to a service, to rest, or back to automatic placement. */
  assignMember(id: number, to: Assignment): void {
    if (to !== 'auto' && to !== 'rest' && !this.tutorialAllowsService(to)) return;
    if (this.team.assign(id, to)) this.reallocate();
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
    if (this.tutorial?.active && !this.tutorialCapabilities.staff) return;
    if (this.org.recruit(id, this.clockMinutes)) this.reallocate();
  }

  letGo(): void {
    if (this.tutorial?.active && !this.tutorialCapabilities.staff) return;
    this.org.letGo(this.clockMinutes);
    this.reallocate();
  }

  /** Closes a place down by choice to save money: no running costs or staff there until relaunched. */
  closeDownPlace(id: ServiceId): void {
    if (!this.tutorialAllowsService(id) || (this.tutorial?.active && !this.tutorialCapabilities.maintenance)) return;
    if (this.org.closedDown.has(id)) return;
    this.org.closedDown.add(id);
    this.reallocate();
    this.org.notice(this.clockMinutes, t('The {service} has closed down to save money. People who came there now go without.', { service: SERVICE_NAMES[id] }));
  }

  /** Takes a place down one level of investment: less upkeep, fewer places. */
  downgrade(id: ServiceId): void {
    if (!this.tutorialAllowsService(id) || (this.tutorial?.active && !this.tutorialCapabilities.maintenance)) return;
    const u = this.upgrades[id];
    if (u.level <= this.stageFloor[id]) return;
    u.level--;
    u.progress = 0;
    this.syncExtraPlaces();
    this.org.notice(this.clockMinutes, t('The {service} is scaled back a level: less upkeep, fewer places.', { service: SERVICE_NAMES[id] }));
  }

  /** Rents a vacant shop unit and opens a satellite of `service` in it. */
  rentUnit(unit: number, service: SatelliteService): boolean {
    if (this.tutorial?.active) return false;
    if (this.property.units[unit]?.kind !== 'vacant' || !this.services[service].switchedOn) return false;
    if (!this.unlocked('rentUnit')) return false;
    if (!this.org.spend(PROPERTY.fitOut, false)) {
      this.org.notice(this.clockMinutes, t('Not enough money to fit out the unit.'));
      return false;
    }
    this.property.rent(unit, service);
    this.org.notice(this.clockMinutes, t('Rented an empty shop: a {name} opens there.', { name: SATELLITE_NAME[service] }));
    this.syncExtraPlaces();
    return true;
  }

  /** Fits a rented unit out one level further: more places, a little more rent, and from level 2 its service's extra. */
  upgradeUnit(unit: number): boolean {
    if (this.tutorial?.active) return false;
    const u = this.property.units[unit];
    if (u?.kind !== 'rented' || u.level >= PROPERTY.unit.maxLevel || !this.services[u.service].switchedOn) return false;
    if (!this.org.spend(PROPERTY.unit.upgrade, false)) {
      this.org.notice(this.clockMinutes, t('Not enough money to fit out the unit further.'));
      return false;
    }
    this.property.upgradeUnit(unit);
    if (u.level === 2) this.org.notice(this.clockMinutes, t('The {name} unit now has: {extra}. {said}', { name: SATELLITE_NAME[u.service], extra: UNIT_EXTRA[u.service].name, said: UNIT_EXTRA[u.service].said }));
    this.syncExtraPlaces();
    return true;
  }

  /** Gives a rented unit back. */
  releaseUnit(unit: number): void {
    if (this.tutorial?.active) return;
    this.property.release(unit, this.org.now);
    this.syncExtraPlaces();
  }

  /** Opens a harm reduction point in an ordinary building (level 0); checking only where the law allows it. */
  openPoint(building: number, service: SatelliteService): boolean {
    if (this.tutorial?.active) return false;
    // A point adds places to a service; while that service is switched off they would stand empty.
    if (!this.services[service].switchedOn) return false;
    if (!this.unlocked('openPoint')) return false;
    if (service === 'drugChecking' && !this.context.checkingAllowed) {
      this.org.notice(this.clockMinutes, t('The law does not allow drug checking here.'));
      return false;
    }
    if (!this.org.spend(PROPERTY.point.fitOut, false)) {
      this.org.notice(this.clockMinutes, t('Not enough money to open a point.'));
      return false;
    }
    this.property.openPoint(building, service);
    this.org.notice(this.clockMinutes, t('A small {name} point opens in the building.', { name: SATELLITE_NAME[service].replace(/ point$/, '') }));
    this.syncExtraPlaces();
    return true;
  }

  upgradePoint(building: number): boolean {
    if (this.tutorial?.active) return false;
    const q = this.property.pointAt(building);
    if (!q || q.level >= PROPERTY.point.maxLevel || !this.services[q.service].switchedOn) return false;
    if (!this.org.spend(PROPERTY.point.upgrade, false)) {
      this.org.notice(this.clockMinutes, t('Not enough money to grow the point.'));
      return false;
    }
    const ok = this.property.upgradePoint(building);
    if (ok) this.syncExtraPlaces();
    return ok;
  }

  closePoint(building: number): void {
    if (this.tutorial?.active) return;
    const q = this.property.closePoint(building);
    if (q) this.org.notice(this.clockMinutes, t('The {name} point has closed.', { name: SATELLITE_NAME[q.service].replace(/ point$/, '') }));
    this.syncExtraPlaces();
  }

  /** Whether the project's standing opens `u`; says what is needed when it does not. */
  unlocked(u: Unlock): boolean {
    if (this.tutorial?.active && !this.tutorialCapabilities.organisation) return false;
    if (this.stakes.allows(u)) return true;
    this.org.notice(this.clockMinutes, t('Not yet: {what} needs a standing of {tier}.', { what: UNLOCK_NAMES[u], tier: TIER_NAMES[UNLOCK_TIER[u]] }));
    return false;
  }

  /** Where the foot patrol can go now (config/patrol.ts): a camp, a party, the club's exit, the longest queue, the person in crisis. */
  patrolSpots(): PatrolSpot[] {
    if (this.tutorial?.active) return this.tutorialCapabilities.dispatch ? ['camp'] : [];
    const out: PatrolSpot[] = [];
    if (this.camp.size > 0.05) out.push('camp');
    if (this.mods.party) out.push('party');
    out.push('busiest');
    if (this.clockMinutes < CLUB_CLOSES) out.push('club');
    if (this.daemon.active) out.push('daemon');
    out.push('street');
    return out;
  }

  /** Whether the foot patrol can be sent out now: open, staffed, at its table. */
  get patrolReady(): boolean {
    const s = this.services.footPatrol;
    return !this.patrol.out && s.enabled && s.assigned > 0;
  }

  /** Sends the foot patrol from its table to `spot` for a few hours. */
  sendPatrol(spot: PatrolSpot, at: { x: number; z: number } | null = null): boolean {
    if (!this.patrolReady || !this.patrolSpots().includes(spot)) return false;
    if (!this.org.spend(PATROL.cost, false)) {
      this.org.notice(this.clockMinutes, t('Not enough money to send the foot patrol out.'));
      return false;
    }
    for (const m of this.team.members) if (m.workingAt === 'footPatrol') m.energy = Math.max(0, m.energy - PATROL.walk);
    this.patrol.send(spot, this.org.now, at);
    this.org.notice(this.clockMinutes, t('The foot patrol is out at {spot} for {hours} hours.', { spot: PATROL.spots[spot].label, hours: PATROL.hours }));
    // Reaching the person in crisis: two streetworkers walk up and talk.
    if (spot === 'daemon' && this.daemon.active) {
      const ok = this.daemon.answer('talk', this.org.now);
      this.org.notice(this.clockMinutes, ok ? t('The foot patrol talked the person in crisis down and walked them to the clinic.') : t('The person in crisis would not listen to the patrol and ran off.'));
    }
    this.reallocate();
    return true;
  }

  /** The foot patrol's hour out: people reached, kits and leaflets handed out, load off the city's meters. */
  private tickPatrol(dtMinutes: number): void {
    if (!this.patrol.out) return;
    const spot = this.patrol.spot!;
    const workers = this.team.members.filter((m) => m.workingAt === 'footPatrol').length;
    const { contacts, back } = this.patrol.tick(dtMinutes, this.org.now, workers * this.services.footPatrol.skill);
    for (let i = 0; i < contacts; i++) {
      this.totals.helped++;
      this.funders.helped();
      this.services.footPatrol.metrics.attended++;
      this.stakes.admitted('footPatrol', this.crisis);
      this.neighbourhood.note('attended');
      if (this.stakes.supplies.use('kits')) this.health.sterileKits++;
      this.stakes.supplies.use('leaflets');
    }
    const eases = PATROL.spots[spot].eases as Partial<Record<'police' | 'medics' | 'sobering', number>>;
    for (const meter of ['police', 'medics', 'sobering'] as const) this.cityStress.relieve(meter, (eases[meter] ?? 0) * (dtMinutes / 60));
    if (spot === 'camp' && this.tutorial?.active) { this.tutorial.patrol(contacts, back); this.applyTutorialReward(); }
    if (back) {
      this.org.notice(this.clockMinutes, plural(this.patrol.reached, ['The foot patrol is back at its table: it reached {n} person out there.', 'The foot patrol is back at its table: it reached {n} people out there.'], ['Patrol pieszy wrócił do stolika: dotarł do {n} osoby.', 'Patrol pieszy wrócił do stolika: dotarł do {n} osób.', 'Patrol pieszy wrócił do stolika: dotarł do {n} osób.']));
      this.reallocate();
    }
  }

  /** Prepares for the coming storm (config/storm.ts). */
  prepareStorm(p: StormPrep): boolean {
    if (this.tutorial?.active) return false;
    const ok = this.stakes.prepare(p);
    if (ok && p === 'standby' && this.stakes.storm.phase === 'peak') this.reallocate();
    return ok;
  }

  /** Orders a batch of supplies. */
  orderSupply(id: SupplyId): boolean {
    if (this.tutorial?.active && !this.tutorialCapabilities.organisation) return false;
    return this.stakes.order(id);
  }

  setStandingOrder(id: SupplyId, on: boolean): void {
    if (this.tutorial?.active && !this.tutorialCapabilities.organisation) return;
    this.stakes.supplies.standing[id] = on;
  }

  /** Every death this run: the weather, and people turned away in a storm. */
  get deaths(): number {
    return this.exposure.deaths + this.stakes.deaths;
  }

  /** Sends another outreach camper out to spot `spot` (an index the world defines). */
  sendCamper(spot: number): boolean {
    if (this.tutorial?.active) return false;
    if (this.property.extraCampers >= PROPERTY.maxExtraCampers || this.property.campers.includes(spot)) return false;
    if (!this.services.outreach.switchedOn) return false;
    if (!this.unlocked('extraCamper')) return false;
    if (!this.org.spend(PROPERTY.camperCost, false)) {
      this.org.notice(this.clockMinutes, t('Not enough money for another camper.'));
      return false;
    }
    this.property.campers.push(spot);
    this.org.notice(this.clockMinutes, t('Another outreach camper is on the road.'));
    this.syncExtraPlaces();
    return true;
  }

  private syncExtraPlaces(): void {
    for (const id of Object.keys(this.services) as ServiceId[]) {
      const stage = stageOf(id, this.upgrades[id].level);
      // Emergency beds at the drop-in while a storm is on.
      const beds = id === 'dropIn' && this.stakes.storm.phase === 'peak' && this.stakes.storm.prepared.has('beds') ? STORM.prepare.beds.places : 0;
      this.services[id].extraPlaces = this.property.extraPlaces(id) + stage.places + beds;
      // A bigger place has room for more to wait; a small first stage less.
      this.services[id].stageWaiting = stage.places;
    }
  }

  /** After a saved game is applied: places, rota and crew quality follow the loaded state. */
  refreshAfterLoad(): void {
    for (const id of SERVICE_IDS) this.unlockStages(id);
    this.syncExtraPlaces();
    this.reallocate();
  }

  /** Puts money into a service: fills its level bar, and at 100% it goes up a level. */
  invest(id: ServiceId): boolean {
    if (!this.tutorialAllowsService(id) || (this.tutorial?.active && !this.tutorialCapabilities.maintenance)) return false;
    const u = this.upgrades[id];
    const last = stageCount(id);
    if (u.level >= last && u.progress >= 1) return false;
    if (!this.services[id].switchedOn) return false;
    if (!this.org.spend(INVEST.cost, false)) {
      this.org.notice(this.clockMinutes, t('Not enough money to invest.'));
      return false;
    }
    u.progress += INVEST.step;
    if (u.progress >= 1 && u.level < last) {
      u.level++;
      u.progress -= 1;
      const stage = stageOf(id, u.level);
      this.org.notice(this.clockMinutes, t('{service} grows: {stage}. {does}', { service: SERVICE_LABEL[id], stage: stage.label, does: stage.does }));
      this.unlockStages(id);
      this.syncExtraPlaces();
    }
    u.progress = Math.min(1, u.progress);
    return true;
  }

  /** What a service's stages so far set up in its mix (a spectrometer makes lab checking possible there). */
  private unlockStages(id: ServiceId): void {
    // Only stages built in play: a service that starts at its usual size buys its equipment as before.
    for (let i = this.stageFloor[id] + 1; i <= this.upgrades[id].level; i++) for (const a of stageOf(id, i).unlocks ?? []) this.mix.markSetUp(id, a);
  }

  /**
   * Upkeep for upgraded services; without money the bars drain, and an empty
   * bar costs a level.
   */
  private tickUpgrades(dtMinutes: number): void {
    const hours = dtMinutes / 60;
    if (hours <= 0) return;
    // Upkeep for every stage beyond the usual size.
    const upkeep = SERVICE_IDS.reduce((n, id) => n + Math.max(0, this.upgrades[id].level - BASE_STAGE), 0) * INVEST.upkeepPerLevelHour * hours;
    const paid = upkeep <= 0 || this.org.spend(upkeep);
    for (const id of SERVICE_IDS) {
      const neglected = this.org.broke || !paid || this.org.closedDown.has(id);
      if (neglected) this.wear(id, INVEST.decayPerHour * hours);
    }
  }

  /** Takes from a service's level bar; an empty bar costs a level. */
  private wear(id: ServiceId, amount: number): void {
    const u = this.upgrades[id];
    u.progress -= amount;
    if (u.progress >= 0) return;
    if (u.level > this.stageFloor[id]) {
      u.level--;
      u.progress += 1;
      this.org.notice(this.clockMinutes, t('{service} is back to {stage}: worn out and short of money.', { service: SERVICE_LABEL[id], stage: stageOf(id, u.level).label }));
      this.syncExtraPlaces();
    } else u.progress = 0;
  }

  /**
   * `base + per x` the average, over the places that can offer it, of how much
   * of `a` they offer against an even split (1 = even).
   */
  private mixAverage(a: Activity, base: number, per: number): number {
    let sum = 0;
    let n = 0;
    for (const id of SERVICE_IDS) {
      const r = this.mix.relative(id, a, this.context.checkingAllowed);
      if (r === null) continue;
      sum += r;
      n++;
    }
    return base + per * (n ? sum / n : 1);
  }

  /** Sets one activity's share of a place's visits (percent); the rest keep their proportions. */
  setMix(id: ServiceId, a: Activity, percent: number): void {
    if (!this.tutorialAllowsService(id) || (this.tutorial?.active && !this.tutorialCapabilities.stress)) return;
    // A service switched off spends nothing, so there is nothing to divide.
    if (!this.services[id].switchedOn) return;
    this.mix.setShare(id, a, percent, this.context.checkingAllowed);
  }

  /** Pays a place's one-off set-up for an activity (checking equipment). */
  setUpMix(id: ServiceId, a: Activity): boolean {
    if (!this.tutorialAllowsService(id) || (this.tutorial?.active && !this.tutorialCapabilities.stress)) return false;
    const cost = ACTIVITY[a].setup ?? 0;
    if (this.mix.isSetUp(id, a)) return true;
    if (!this.services[id].switchedOn) return false;
    if (!this.org.spend(cost, false)) {
      this.org.notice(this.clockMinutes, t('Not enough money to set up {activity} here.', { activity: ACTIVITY[a].label.toLowerCase() }));
      return false;
    }
    this.mix.markSetUp(id, a);
    this.org.notice(this.clockMinutes, t('{activity} is set up at the {service}.', { activity: ACTIVITY[a].label, service: SERVICE_NAMES[id] }));
    return true;
  }

  /** Police are keeping their distance (a favour from city hall). */
  get policeAway(): boolean {
    return this.org.now < this.policeAwayUntil;
  }

  /** The place with the longest queue now, and its length. */
  get busiest(): { service: ServiceId; queue: number } {
    let best: { service: ServiceId; queue: number } = { service: 'dropIn', queue: 0 };
    for (const id of SERVICE_IDS) if (this.services[id].queue.length > best.queue) best = { service: id, queue: this.services[id].queue.length };
    return best;
  }

  /** A police raid: `arrests` stops that end in arrest, then a crackdown on the street. */
  raid(arrests: number): void {
    for (let i = 0; i < arrests; i++) this.emit({ type: 'policeStop', arrest: true });
    this.triggerEvent('crackdown');
  }

  /**
   * The player answers the person in crisis: outreach staff talk them down, the
   * crisis team comes, or the police take them. Pays the price, rolls the odds,
   * and says what happened (for the box and the feed). Null when nobody is
   * roaming or the money is short.
   */
  answerDaemon(a: DaemonAnswer): string | null {
    if (!this.daemon.active) return null;
    const cost = DAEMON[a].cost;
    if (cost > this.org.budget) return null;
    this.org.budget -= cost;
    if (a === 'police') {
      this.cityStress.bump('police', 'daemon', DAEMON.police.load);
      this.neighbourhood.state.reputation = Math.max(0, this.neighbourhood.state.reputation - DAEMON.police.reputation);
    }
    const ok = this.daemon.answer(a, this.org.now);
    const text = ok
      ? a === 'talk' ? t('Your outreach staff talked them down: water, a quiet corner, then a lift to the clinic.')
        : a === 'crisisTeam' ? t('The crisis team calmed them and took them somewhere safe to come down.')
          : t('The police took them in. The street is quieter; the people who saw it trust you a little less.')
      : a === 'talk' ? t('They would not listen and ran off down the street, more worked up.')
        : a === 'crisisTeam' ? t('The crisis team could not get near: they bolted.')
          : t('They slipped away from the police and are still out there.');
    this.org.notice(this.clockMinutes, text);
    return text;
  }

  /** Uses the favour held: done now, and city hall will ask for a concession later. */
  askFavour(id: FavourId): boolean {
    if (this.tutorial?.active && !this.tutorialCapabilities.organisation) return false;
    if (!this.favourView.items.find(item => item.id === id)?.available) return false;
    this.favours--;
    const [lo, hi] = FAVOUR.askAfterHours;
    this.concessionAt = this.org.now + (lo + this.random() * (hi - lo)) * 60;
    if (id === 'funding') this.org.budget += this.reputation.funding;
    else if (id === 'police') { this.policeAwayUntil = this.org.now + this.reputation.policeHours * 60; this.applyContext(); }
    else this.campHoldUntil = this.org.now + this.reputation.campHours * 60;
    this.org.notice(this.clockMinutes, t('{done} City hall will want something back.', { done: this.favourView.items.find(item => item.id === id)!.label }));
    return true;
  }

  /** City hall's concession is due now (the big-event pop-up asks it). */
  get concessionDue(): boolean {
    return this.concessionAt !== null && this.org.now >= this.concessionAt;
  }

  /** Settle the pending request once; new favours come only from reputation. */
  answerConcession(id: ConcessionId, agree: boolean): string {
    if (this.concessionAt === null) return '';
    this.concessionAt = null;
    if (!agree) {
      Object.assign(this.mediaHit, { factor: 0.8, until: this.org.now + 2 * 24 * 60 });
      return t('City hall remembers your refusal. Funders are a little cooler for two days.');
    }
    if (id === 'postedOfficer') { this.policePostedUntil = this.org.now + FAVOUR.policeHours * 60; this.applyContext(); }
    else if (id === 'cleanUp') this.org.spend(FAVOUR.cleanUpCost, false);
    else this.moveOutreach(FAVOUR.camperOffHours * 60);
    return t('{agree} Reputation earns your next favour.', { agree: CONCESSIONS[id].agree });
  }

  /** Partners with a new venue: harm reduction info and water there; the venue pays by the hour. */
  partnerVenue(i: number): boolean {
    if (this.tutorial?.active) return false;
    if (i >= this.vitality.venues || this.vitality.partners.has(i)) return false;
    if (!this.unlocked('partnerVenue')) return false;
    if (!this.org.spend(VITALITY.partnerCost, false)) {
      this.org.notice(this.clockMinutes, t('Not enough money to set up the partnership.'));
      return false;
    }
    this.vitality.partners.add(i);
    this.org.notice(this.clockMinutes, t('Partnership with the {venue}: harm reduction info and water there, and the venue pays {fee} an hour.', { venue: VENUE_NAMES[VENUE_KINDS[i]], fee: VITALITY.partnerFeePerHour }));
    return true;
  }

  /** Chance the club agrees to pay for the stand now: warier while the street is in crisis. */
  get clubAcceptChance(): number {
    return HUSTLE.clubAccepts * (1 - 0.5 * this.crisis);
  }

  /** Asks the club to pay for the stand; it may say no. */
  proposeClubContract(): boolean {
    if (this.clubContract) return true;
    if (this.org.now < this.clubAskAgainAt || !this.services.clubHr.switchedOn) return false;
    if (this.random() >= this.clubAcceptChance) {
      this.clubAskAgainAt = this.org.now + HUSTLE.clubAskAgain;
      this.org.notice(this.clockMinutes, t('The club would not pay for the stand this time. Ask again in a few hours.'));
      return false;
    }
    this.clubContract = true;
    this.org.notice(this.clockMinutes, t('The club pays {fee} an hour while the stand is open.', { fee: HUSTLE.clubFeePerHour }));
    return true;
  }

  endClubContract(): void {
    if (!this.clubContract) return;
    this.clubContract = false;
    this.org.notice(this.clockMinutes, t('The club no longer pays for the stand.'));
  }

  /** Sells checks at the drug checking service, or stops. */
  setCommercialChecking(on: boolean): void {
    if (this.commercialChecking === on) return;
    // Charging starts only where checks are running; stopping is always possible.
    if (on && !this.services.drugChecking.switchedOn) return;
    this.commercialChecking = on;
    this.org.notice(this.clockMinutes, on
      ? t('Drug checking now charges {fee} a check. Fewer people come, and fewer results reach the early warning.', { fee: HUSTLE.checkFee })
      : t('Drug checking is free again.'));
  }

  /** A team sweeps the blocks' courtyards and stairwells for used needles and kit. */
  sweepForKit(): boolean {
    if (this.tutorial?.active && !this.tutorialCapabilities.organisation) return false;
    if (this.org.now < this.sweepAgainAt) return false;
    if (!this.org.spend(RESIDENTS.sweepCost, false)) {
      this.org.notice(this.clockMinutes, t('Not enough money for a sweep.'));
      return false;
    }
    this.neighbourhood.sweep(RESIDENTS.sweepShare);
    this.vitality.lift(RESIDENTS.sweepDistrict);
    this.sweepAgainAt = this.org.now + RESIDENTS.sweepCooldownHours * 60;
    this.org.notice(this.clockMinutes, t('The team swept courtyards and stairwells for used kit.'));
    return true;
  }

  /** Door-knocking in the blocks: who the project is and a number to call. */
  meetResidents(): boolean {
    if (this.tutorial?.active && !this.tutorialCapabilities.organisation) return false;
    if (this.org.now < this.meetAgainAt) return false;
    if (!this.org.spend(RESIDENTS.meetCost, false)) {
      this.org.notice(this.clockMinutes, t('Not enough money to meet the residents.'));
      return false;
    }
    this.residentsMetUntil = this.org.now + RESIDENTS.meetHours * 60;
    this.vitality.lift(RESIDENTS.meetDistrict);
    this.meetAgainAt = this.org.now + RESIDENTS.meetCooldownHours * 60;
    this.org.notice(this.clockMinutes, t('The team knocked on doors in the blocks: residents now know whom to call.'));
    return true;
  }

  /** A donation drive: staff and volunteers collect for a few hours; donation boxes bring in more meanwhile. */
  startDonationDrive(): boolean {
    if (this.tutorial?.active && !this.tutorialCapabilities.organisation) return false;
    if (this.driveUntil !== null || this.org.now < this.driveAgainAt) return false;
    if (!this.org.spend(HUSTLE.driveCost, false)) {
      this.org.notice(this.clockMinutes, t('Not enough money to run a donation drive.'));
      return false;
    }
    this.driveUntil = this.org.now + HUSTLE.driveHours * 60;
    this.org.notice(this.clockMinutes, t('A donation drive is on for {hours}: collection tins out, donation boxes doubled.', { hours: plural(HUSTLE.driveHours, ['{n} hour', '{n} hours'], ['{n} godzinę', '{n} godziny', '{n} godzin']) }));
    return true;
  }

  private endDonationDrive(): void {
    this.driveUntil = null;
    this.driveAgainAt = this.org.now + HUSTLE.driveCooldownHours * 60;
    // A good name brings more in; a crisis on the street brings less.
    const pull = this.neighbourhood.reputationPull * (1 - 0.6 * this.crisis) * this.funders.trust * this.stakes.giving;
    const raised = Math.round((HUSTLE.driveMin + this.random() * (HUSTLE.driveMax - HUSTLE.driveMin)) * Math.max(0.3, Math.min(1.5, pull)));
    this.org.budget += raised;
    this.org.notice(this.clockMinutes, t('The donation drive raised {amount}.', { amount: raised }));
    // The tins come back to the drop-in: a shower of coins there, one per 40 raised (at most ten).
    for (let i = 0; i < Math.min(10, Math.ceil(raised / 40)); i++) this.emit({ type: 'money', service: 'dropIn', amount: 1 });
  }

  /** The camper drives to a new spot: outreach closes for `minutes`, then opens again if it was on. */
  moveOutreach(minutes = 20): void {
    if (this.tutorial?.active) return;
    if (this.movingUntil === null) this.movingWasOn = this.services.outreach.switchedOn;
    this.movingUntil = this.org.now + minutes;
    this.setEnabled('outreach', false);
  }

  get outreachMoving(): boolean {
    return this.movingUntil !== null;
  }

  private tickExposure(dtMinutes: number): void {
    const coldNight = this.events.isActive('coldNight');
    const kind = exposureNow(this.season, this.clockMinutes, coldNight);
    // The remedies cost money only while they have work to do.
    const cost = ((this.warmingBus && kind === 'cold' ? EXPOSURE.warmingBusPerHour : 0) + (this.coolingPoint && kind === 'heat' ? EXPOSURE.coolingPointPerHour : 0)) * (dtMinutes / 60);
    const paid = cost <= 0 || this.org.spend(cost);
    const harm = this.exposure.tick(dtMinutes, {
      season: this.season,
      clock: this.clockMinutes,
      coldNight,
      dropInOpen: this.services.dropIn.status === 'open',
      outreachOpen: this.services.outreach.status === 'open',
      warmingBus: this.warmingBus && paid,
      coolingPoint: this.coolingPoint && paid,
      // More food, drinks and warmth in the places' mix, fewer people harmed outdoors.
      deathFactor: 1 + STRESS.medicsDeaths * this.cityStress.medics,
      mixFactor: Math.max(0.5, 1.2 - 0.2 * this.mixAverage('basics', 0, 1)) * (1 + CRISIS.harmBoost * this.crisis) * (1 + CAMP.harm * this.camp.outdoors),
    });
    if (!harm) return;
    if (harm.died) this.stakes.death();
    const found = harm.kind === 'cold'
      ? harm.reached ? t('Outreach staff found someone too cold to wake.') : t('A passer-by found someone too cold to wake.')
      : harm.reached ? t('Outreach staff found someone collapsed in the heat, badly dehydrated.') : t('A passer-by found someone collapsed in the heat, badly dehydrated.');
    this.org.notice(this.clockMinutes, `${found} ${harm.died ? t('The ambulance came, but they died.') : t('The ambulance took them to hospital.')}`);
    this.emit({ type: 'exposure', harm });
  }

  /** Pickpockets, shoplifters and the shops' answer; a picket, priest or nun at a service. */
  private tickStreetPeople(dtMinutes: number): void {
    const { thefts, news } = this.petty.tick(dtMinutes, {
      clock: this.clockMinutes,
      now: this.org.now,
      footfall: this.city.footfall(this.clockMinutes, this.calendar.date),
      street: this.growth.street,
      patrol: this.context.patrol,
      footPatrolOpen: this.services.footPatrol.status === 'open',
    });
    for (const theft of thefts) {
      // The police take the report: more of it when a guard holds someone for them.
      this.cityStress.bump('police', 'theft', PETTY.stress * (theft.caught ? 1.5 : 1));
      this.city.pressure += PETTY.pressure;
      this.emit({ type: 'theft', theft });
    }
    for (const n of news) {
      this.org.notice(this.clockMinutes, n.news === 'guard'
        ? t('After a run of thefts, {shop} has hired a security guard for its door.', { shop: SHOP_NAMES[n.shop] })
        : t('Hit again, {shop} pulls its shutters down early tonight. The street is darker for it.', { shop: SHOP_NAMES[n.shop] }));
    }
    const change = this.visitors.tick(this.clockMinutes, (id) => this.services[id].status === 'open' || this.services[id].status === 'opening');
    if (change) {
      const { what, visit } = change;
      if (what === 'arrive') {
        if (visit.stance === 'support') this.funders.trust = Math.min(FUNDERS.max, this.funders.trust + VISITORS.supportTrust);
        this.org.notice(this.clockMinutes, VISIT_NOTICE[visit.stance][visit.kind](SERVICE_NAMES[visit.at]));
      }
      this.emit({ type: 'visit', what, visit });
    }
  }

  private tickProperty(dtMinutes: number): void {
    const cost = this.property.costPerHour * (dtMinutes / 60);
    const paid = cost <= 0 || this.org.spend(cost);
    // People who need a roof: those sleeping out, and a squat already full.
    const housing = Math.min(1, this.camp.outdoors + 0.5 * this.camp.squat);
    // What fitted-out units bring to the street (UNIT_EXTRA): less kit dropped, fewer in the camp, a better name.
    const extras = this.property.extras;
    const hours = dtMinutes / 60;
    const street = this.neighbourhood.state;
    if (extras.footPatrol) street.litter = Math.max(0, street.litter * (1 - UNIT_EXTRA.footPatrol.perHour * extras.footPatrol * hours));
    if (extras.dropIn) this.camp.size = Math.max(0, this.camp.size - UNIT_EXTRA.dropIn.perHour * extras.dropIn * hours);
    if (extras.drugChecking) street.reputation = Math.min(1, street.reputation + UNIT_EXTRA.drugChecking.perHour * extras.drugChecking * hours);
    for (const e of this.property.tick(dtMinutes, this.org.now, this.neighbourhood.state.shopTrade, paid, housing)) {
      if (e.kind === 'closed') this.org.notice(this.clockMinutes, t('A shop on the street has closed. The unit is to let.'));
      else if (e.kind === 'reopened') this.org.notice(this.clockMinutes, t('A new business has taken an empty shop.'));
      else if (e.kind === 'squatted') this.org.notice(this.clockMinutes, t('People with nowhere else to go have moved into an empty shop: a new squat.'));
      else if (e.kind === 'evicted') this.org.notice(this.clockMinutes, t('A new business has taken a squatted shop; the people living there have moved on.'));
      else if (e.kind === 'pointLost') this.org.notice(this.clockMinutes, t('Rent unpaid: a {name} point has closed.', { name: SATELLITE_NAME[e.service].replace(/ point$/, '') }));
      else this.org.notice(this.clockMinutes, t('Rent unpaid: the {name} in the rented shop has closed.', { name: SATELLITE_NAME[e.service] }));
    }
    if (!paid) this.syncExtraPlaces();
  }

  reopen(id: ServiceId): void {
    if (!this.tutorialAllowsService(id)) return;
    this.org.reopen(id, this.clockMinutes);
  }

  applyFor(id: GrantId): boolean {
    if (this.tutorial?.active && !this.tutorialCapabilities.organisation) return false;
    const tier = GRANT_TIER[id] ?? 0;
    if (this.stakes.needsTier(tier)) {
      this.org.notice(this.clockMinutes, t('Funders will not read this application yet: it needs a standing of {tier}.', { tier: TIER_NAMES[tier] }));
      return false;
    }
    return this.org.apply(id, this.clockMinutes);
  }

  /** The party on in the park, if any. */
  get party(): 'popUp' | 'festival' | null {
    return this.mods.party;
  }

  /** Income per clock hour from the national funding option (grants come on top). */
  get fundingIncome(): number {
    const club = (this.clubContract && this.services.clubHr.status === 'open' ? HUSTLE.clubFeePerHour : 0) + this.vitality.partners.size * VITALITY.partnerFeePerHour;
    const boxes = this.donationIncome * (this.driveUntil !== null ? HUSTLE.driveBoxes : 1);
    // A bigger district brings bigger budgets: funders pay for the need they see.
    return (ORG.incomePerHour[this.policy.funding] ?? 0) * this.funders.trust * this.growth.funding + boxes + club;
  }

  /** Money moved at each place, not yet shown as a coin. */
  private readonly flowAcc: Partial<Record<ServiceId, number>> = {};

  /** Adds `amount` to a place's money flow; every unit, in or out, becomes one 'money' event. */
  private flow(id: ServiceId, amount: number): void {
    let acc = (this.flowAcc[id] ?? 0) + amount;
    while (Math.abs(acc) >= MONEY_LUMP) {
      const lump = Math.sign(acc) * MONEY_LUMP;
      acc -= lump;
      this.emit({ type: 'money', service: id, amount: lump });
    }
    this.flowAcc[id] = acc;
  }

  /** Income that accrues by the hour at each place: donation boxes (doubled in a drive) and the club's fee for the stand. */
  private tickPlaceIncome(dtMinutes: number): void {
    const hours = dtMinutes / 60;
    const drive = this.driveUntil !== null ? HUSTLE.driveBoxes : 1;
    for (const id of SERVICE_IDS) {
      const box = this.boxPerHour(id);
      if (box > 0) this.flow(id, box * drive * hours);
    }
    if (this.clubContract && this.services.clubHr.status === 'open') this.flow('clubHr', HUSTLE.clubFeePerHour * hours);
  }

  /**
   * Every open place has a donation box out (no switch): what it brings in per clock hour grows with
   * the staff on shift (someone to talk to, and to thank) and with how many people pass by now, on
   * a thriving street and at a busy hour. ILLUSTRATIVE.
   */
  private boxPerHour(id: ServiceId): number {
    const s = this.services[id];
    if (s.status !== 'open') return 0;
    return s.staffOnSite * DONATION_PER_STAFF_HOUR * this.footfallNow * this.stakes.giving;
  }

  /** How many people are out on the street now: a thriving district at a busy hour (1 is ordinary). */
  private get footfallNow(): number {
    return this.vitality.footfall * this.city.footfall(this.clockMinutes, this.calendar.date);
  }

  /**
   * Running costs per clock hour. Every place not closed down pays its base (rent, heating,
   * insurance), staffed or not; an open place also wears faster while the street is busier than
   * usual (more cleaning, supplies, repairs), the cost side of the fuller donation box.
   */
  /**
   * Paid staff drawing a wage: everyone employed, on shift or not (closing the doors does not stop
   * the salaries). Out of money, paid staff stay home unpaid until the budget recovers.
   */
  get payroll(): number {
    return this.org.broke ? 0 : this.org.paid;
  }

  get runningPerHour(): number {
    const surplus = Math.max(0, this.footfallNow - 1);
    let total = 0;
    for (const id of SERVICE_IDS) {
      if (!this.tutorialAllowsService(id) || this.org.closedDown.has(id)) continue;
      total += ORG.runningPerPlace * (1 + (this.services[id].status === 'open' ? ORG.footfallStrain * surplus : 0));
    }
    return total;
  }

  /** The starting services the player has switched off (not closed down for lack of money): funders notice. */
  get servicesClosedByPlayer(): number {
    let n = 0;
    for (const id of ORG.startServices) if (!this.services[id].switchedOn && !this.org.closedDown.has(id)) n++;
    return n;
  }

  get donationIncome(): number {
    return SERVICE_IDS.reduce((n, id) => n + this.boxPerHour(id), 0);
  }

  applicationContext(): ApplicationContext {
    return {
      // A residents' petition makes the council harder to win over.
      council: this.events.isActive('residentsPetition') ? Math.max(0, this.policy.council - 1) : this.policy.council,
      policeAgreement: this.policy.policeAgreement,
      publicAlerts: this.context.publicAlerts,
      checksDone: this.checking.samples,
      criminalPossession: this.policy.criminalPossession,
      reputation: this.funders.trust * (this.camperPath === 'social' ? CAMPER_PATH_EFFECT.socialReputation : 1) * (this.org.now < this.mediaHit.until ? this.mediaHit.factor : 1) * this.mixAverage('counselling', 0.9, 0.1) * (1 - CRISIS.grantCut * this.crisis) * (1 - STRESS.policeGrantCut * this.cityStress.police),
    };
  }

  /** After a media attack: grant chances multiplied by `factor` until `until` (organisation minutes). */
  readonly mediaHit = { factor: 1, until: 0 };

  /** A media storm: funders hesitate for `nights` nights, and answering it costs the team time and energy. */
  /**
   * Takes the next step of an institution's side quest: pays for it and
   * returns what it taught, or null if it cannot be paid (or is all done).
   * `finished` is true on the last step.
   */
  questStep(id: InstitutionId): { lesson: string; finished: boolean } | null {
    if (this.tutorial?.active && !this.tutorialCapabilities.organisation) return null;
    const q = QUESTS[id];
    const done = this.quests[id];
    const step = q.steps[done];
    if (!step || !this.org.spend(step.cost, false)) return null;
    this.quests[id] = done + 1;
    const finished = done + 1 === q.steps.length;
    if (finished && id === 'police') this.applyContext();
    this.org.notice(this.clockMinutes, finished ? `${step.lesson} ${q.done}` : step.lesson);
    return { lesson: step.lesson, finished };
  }

  /**
   * Why officers stand posted by the services now, and until when (clock minutes; null when it lasts
   * as long as the city's policing does): a favour keeping them away, an event, a deal with city hall,
   * or the city's policing itself. For the officer's card and the tag over them.
   */
  policeStatus(): { reason: 'away' | 'agreement' | 'event' | 'concession' | 'policy' | 'none'; until: number | null; event?: string } {
    const clock = (t: number) => this.org.clockAt(t, this.clockMinutes);
    if (this.org.now < this.policeAwayUntil) return { reason: 'away', until: clock(this.policeAwayUntil) };
    const posted = this.events.active.filter((e) => EVENTS[e.id].effects.posted);
    const style = this.context.patrolStyle;
    if (this.allied('police') && style !== 'posted') return { reason: 'agreement', until: null };
    if (posted.length) {
      const last = posted.reduce((a, b) => (b.endsAt > a.endsAt ? b : a));
      return { reason: 'event', until: last.endsAt, event: EVENTS[last.id].label };
    }
    if (this.org.now < this.policePostedUntil) return { reason: 'concession', until: clock(this.policePostedUntil) };
    return this.context.patrol > 0 && style === 'posted' ? { reason: 'policy', until: null } : { reason: 'none', until: null };
  }

  /** Whether an institution's side quest is complete. */
  allied(id: InstitutionId): boolean {
    return this.quests[id] >= QUESTS[id].steps.length;
  }

  /** What a visitor uses, for how they look on the street (read only). */
  substanceOf(visitor: VisitorId): Substance | undefined {
    return this.profiles.get(visitor)?.substance;
  }

  /** The same live support priorities are shown on the person card and used on admission. */
  supportOf(visitor: VisitorId): PersonSupport | undefined {
    const profile = this.profiles.get(visitor);
    if (!profile) return undefined;
    let support = this.supportProfiles.get(visitor);
    if (!support) { support = personSupport(visitor, profile); this.supportProfiles.set(visitor, support); }
    return support;
  }

  /** Whether the club is open now (its door staff are out). */
  get clubOpen(): boolean {
    return !(this.clockMinutes >= CLUB_CLOSES && this.clockMinutes < CLUB_OPENS);
  }

  /** A drunk club leaver bothered someone in the street: the street feels a little less safe. */
  recordHarassment(): void {
    const st = this.neighbourhood.state;
    st.safety = Math.max(0, st.safety - 0.004);
  }

  /** Specialises the camper (or changes its path): pays for the kit and training. False if it cannot pay. */
  setCamperPath(path: CamperPath): boolean {
    if (!this.tutorialAllowsService('outreach') || (this.tutorial?.active && !this.tutorialCapabilities.organisation)) return false;
    if (this.camperPath === path || !this.services.outreach.switchedOn) return false;
    if (!this.org.spend(CAMPER_PATH[path].cost, false)) return false;
    this.camperPath = path;
    return true;
  }

  /**
   * Something on the street near these services (a TV crew at the door, a raid)
   * makes more of the people heading there turn back, by `extra`, for `minutes`.
   */
  deterNear(services: readonly ServiceId[], extra: number, minutes: number): void {
    for (const id of services) this.localDeterrence.set(id, { extra, until: this.org.now + minutes });
  }

  /** Extra turning back at `id` from something nearby, now. */
  private localDeter(id: ServiceId): number {
    const visit = this.visitors.deterAt(id, this.clockMinutes);
    const d = this.localDeterrence.get(id);
    if (!d) return visit;
    if (this.org.now >= d.until) { this.localDeterrence.delete(id); return visit; }
    return d.extra + visit;
  }

  mediaAttack(factor: number, nights: number, energy: number): void {
    this.mediaHit.factor = factor;
    this.mediaHit.until = this.org.now + nights * 24 * 60;
    for (const m of this.team.members) m.energy = Math.max(0, m.energy - energy);
    this.reallocate();
  }

  /** Starts an event now, from the event feed. */
  triggerEvent(id: EventId): void {
    if (this.tutorial?.active) return;
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
    // A favour keeps police away; a concession posts an officer by the services.
    if (this.org.now < this.policePostedUntil) {
      c.patrol = Math.max(c.patrol, 2);
      c.patrolStyle = 'posted';
      c.deterrence = Math.max(c.deterrence, 0.5);
    }
    if (this.org.now < this.policeAwayUntil) {
      c.patrol = Math.min(c.patrol, 1);
      c.patrolStyle = 'clear';
      c.deterrence = 0;
    }
    // The police agreement (the side quest at the station, finished): patrols keep clear of the entrances.
    if (this.allied('police') && c.patrolStyle === 'posted') {
      c.patrolStyle = 'clear';
      c.deterrence *= 0.4;
    }
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
    this.supportProfiles.delete(visitor);
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
    // More naloxone and first aid in the place's mix, more people reached in time.
    const nalox = this.mix.relative(responder, 'naloxone', this.context.checkingAllowed);
    const mixReach = nalox === null ? 1 : Math.min(1.4, 0.4 + 0.6 * nalox);
    // Reaching someone in time takes a dose of naloxone from the shelf (config/supplies.ts).
    const helped = canReach && this.random() < reach * mixReach * (this.mods.kitsOut ? 0.5 : 1) && this.stakes.supplies.use('naloxone');
    if (!helped) this.stakes.overdoseAlone();
    event.acuteHarms++;
    this.health.acuteHarms++;
    if (helped) { event.helped++; this.health.helped++; } else { event.alone++; this.health.alone++; }
    return { event: event.id, helpedBy: helped ? responder : null };
  }

  /** The HUD switch. The service opens only if hours and permissions allow it too. */
  setEnabled(id: ServiceId, on: boolean): void {
    if (!this.tutorialAllowsService(id)) return;
    this.services[id].switchedOn = on;
    if (on) this.services[id].everRun = true;
    this.reallocate();
  }

  /** Applies combined context effects; services open or close as permissions and hours change. */
  setContext(effects: ContextEffects): void {
    this.baseContext = effects;
    this.applyContext();
  }

  private closedReason(id: ServiceId): ClosedReason | null {
    if (!this.tutorialAllowsService(id)) return 'switchedOff';
    const c = this.context;
    if (!this.services[id].switchedOn) return 'switchedOff';
    if (this.tutorial?.active) {
      if (this.org.closedDown.has(id)) return 'closedDown';
      if (id === 'footPatrol' && this.patrol.out) return 'onPatrol';
      return id === 'clubHr' && this.outsideHours(id) ? 'hours' : null;
    }
    if (this.org.closedDown.has(id)) return 'closedDown';
    if (this.mods.outOfService.has(id)) return 'outOfService';
    // Out on the street: the table is shut, the same people are at work elsewhere.
    if (id === 'footPatrol' && this.patrol.out) return 'onPatrol';
    if ((id === 'outreach' && !c.outreachPermitted) || (id === 'clubHr' && !c.standPermitted)) return 'notPermitted';
    // Where lab checking is not allowed the checking service stays open: test kits and advice (its mix locks checking).
    if (this.outsideHours(id)) return 'hours';
    return null;
  }

  /** Closing time means closed overnight, until the morning; the club stand works the club's hours. */
  private outsideHours(id: ServiceId): boolean {
    const closesAt = this.tutorial?.active ? null : this.context.closesAt;
    if (closesAt !== null && this.clockMinutes >= closesAt && this.clockMinutes < MORNING) return true;
    return id === 'clubHr' && this.clockMinutes >= CLUB_CLOSES && this.clockMinutes < CLUB_OPENS;
  }

  /**
   * Whether people set out for a service now: one the organisation runs (or ran, see `everRun`),
   * within its opening hours. People know the hours; they do not queue at a door that opens at 08:00.
   */
  private expected(id: ServiceId): boolean {
    return this.tutorialAllowsService(id) && this.services[id].everRun && !this.outsideHours(id);
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
    if (!this.tutorialAllowsService(id)) return;
    this.services[id].staffOnSite++;
  }

  staffLeft(id: ServiceId): void {
    const s = this.services[id];
    s.staffOnSite = Math.max(0, s.staffOnSite - 1);
  }

  /**
   * A person who set out for the service turned back before reaching it (put off by police nearby).
   * Their need still goes unmet, but the service never saw them: it does not count toward the crisis.
   */
  turnBack(id: ServiceId, visitor: VisitorId): void {
    if (!this.tutorialAllowsService(id)) return;
    const s = this.services[id];
    s.metrics.demand++;
    s.turnedBack++;
    this.recordUnmet(s, visitor, false, false);
  }

  /** The crowd carried out a possession stop. */
  recordPoliceStop(arrest: boolean): void {
    this.policeStops++;
    if (arrest) this.arrests++;
  }

  /** A person physically reached the service point. */
  arrive(id: ServiceId, visitor: VisitorId): ArrivalResult {
    if (!this.tutorialAllowsService(id)) return 'turnedAway';
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
    if (s.queue.length < s.waitingRoom) {
      s.queue.push({ visitor, waited: 0 });
      return 'queued';
    }
    this.recordUnmet(s, visitor, false);
    return 'turnedAway';
  }

  /** A club-goer reached the end of the door queue. Returns false if the queue is full. */
  joinClubQueue(visitor: VisitorId): boolean {
    if (this.tutorial?.active && !this.tutorialCapabilities.stress) return false;
    this.club.arrivals++;
    if (this.club.queue.length >= ILLUSTRATIVE.club.queueSlots) return false;
    this.club.queue.push(visitor);
    return true;
  }

  tick(dt: number): void {
    if (this.tutorial?.active) { this.tickTutorial(dt); return; }
    const before = this.clockMinutes;
    this.clockMinutes += dt * this.minuteRate;
    // A night is done in the morning: it counts for the leaderboard then, not at the next evening.
    if (!this.goalsBegun) {
      this.goalsBegun = true;
      this.goals.begin(this.totals.helped, this.turnedAwayTotal, this.deaths, this.org.budget);
    }
    const stretched = Math.max(this.cityStress.police, this.cityStress.medics, this.cityStress.sobering) >= 0.7;
    this.goals.tick(dt * this.minuteRate, stretched);
    if (before < MORNING && this.clockMinutes >= MORNING) {
      const report = this.goals.end(this.totals.nights, this.totals.helped, this.turnedAwayTotal, this.deaths, this.org.budget, this.totals.helped, this.stakes.runOver !== null);
      this.stakes.nightBegins();
      report.district = { size: this.growth.size, street: this.growth.street };
      this.totals.nights++;
      this.emit({ type: 'nightReport', report });
    }
    // A full day, 18:00 round to 18:00; then the next evening begins.
    if (this.clockMinutes >= DAY_END) {
      this.clockMinutes -= DAY_END - DAY_START;
      this.events.shiftClock(DAY_END - DAY_START);
      // A new evening: the calendar moves on and tonight's waves can start again.
      this.calendar.nextNight();
      this.wavesTonight.clear();
    }
    const date = this.calendar.date;
    // A crisis brings more trouble: random events come more often.
    const crisisRate = 1 + CRISIS.eventBoost * this.crisis;
    const { started, ended } = this.events.tick(this.clockMinutes, dt * this.minuteRate, (id) => (SEASONAL_EVENT_RATE[id]?.[date.season] ?? 1) * crisisRate);
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
      residentsMet: this.org.now < this.residentsMetUntil,
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
    this.tickStreetPeople(dt * this.minuteRate);
    if (started.length || ended.length) {
      this.eventsChanged();
      for (const e of started) this.emit({ type: 'eventStarted', event: e });
      for (const e of ended) this.emit({ type: 'eventEnded', event: e });
    }
    this.tickProperty(dt * this.minuteRate);
    this.tickUpgrades(dt * this.minuteRate);
    this.tickExposure(dt * this.minuteRate);
    this.tickPlaceIncome(dt * this.minuteRate);
    if (this.driveUntil !== null && this.org.now >= this.driveUntil) this.endDonationDrive();
    // When a favour's police arrangement or a concession's posted officer ends, the street goes back to the usual.
    const policeNow = (this.org.now < this.policeAwayUntil ? 1 : 0) + (this.org.now < this.policePostedUntil ? 2 : 0);
    if (policeNow !== this.policeState) { this.policeState = policeNow; this.applyContext(); }
    this.camp.tick(dt * this.minuteRate, {
      season: this.season,
      shelterOpen: this.services.shelter.status === 'open',
      outreachOpen: this.services.outreach.status === 'open',
      crisis: this.crisis,
      shelterCrowded: Math.min(1, this.services.shelter.queue.length / this.services.shelter.waitingRoom),
      referrals: this.camperPath === 'social' && this.services.outreach.status === 'open' ? CAMPER_PATH_EFFECT.socialCampShrink : 0,
    });
    // Partnerships with A&E and the izba: they recover from a busy night sooner.
    this.cityStress.tick(dt * this.minuteRate, this.camp.outdoors, this.crisis, { medics: this.allied('hospital') ? 1.35 : 1, sobering: this.allied('sobering') ? 1.35 : 1 });
    const park = this.park.tick({ clock: this.clockMinutes, season: this.season, camp: this.camp.size, market: this.neighbourhood.state.streetMarket }, this.calendar.dayOfYear);
    for (const n of park.notices) this.org.notice(this.clockMinutes, n);
    if (park.reputation) {
      const st = this.neighbourhood.state;
      st.reputation = Math.max(0, st.reputation - park.reputation);
      st.safety = Math.max(0, st.safety - park.safety);
    }
    this.cityStress.sobering = Math.max(0, this.cityStress.sobering - this.vitality.partners.size * VITALITY.partnerEasesSobering * (dt * this.minuteRate) / 60);
    const s = this.cityStress;
    this.growth.tick(dt * this.minuteRate, { vitality: this.vitality.level, crisis: this.crisis, unmet24: this.unmet24, broke: this.org.broke, camp: this.camp.size });
    this.goals.size = this.growth.size;
    // The street scene crossing a band is news: growing, in crisis, or easing back.
    const streetBand = this.growth.street >= 0.7 ? 2 : this.growth.street >= 0.3 ? 1 : 0;
    if (streetBand !== this.streetBand) {
      const up = streetBand > this.streetBand;
      // A little hysteresis: easing is said only once well below the band's edge.
      if (up || this.growth.street < (streetBand === 1 ? 0.6 : 0.22)) {
        this.org.notice(this.clockMinutes, up
          ? streetBand === 2 ? t('The street is in crisis: boarded-up shops, fires and fights. Calm nights with the services open will slowly turn it round.') : t('The street scene is growing: more people sleeping rough and using outdoors. Keep the low-threshold services open and staffed.')
          : t('The street scene is easing.'));
        this.streetBand = streetBand;
      }
    }
    // Someone in acute crisis: turns up when the street is bad, loads the city while they roam, ends badly if left.
    const daemonNews = this.daemon.tick(dt * this.minuteRate, this.org.now, { street: this.growth.street, crisis: this.crisis, nights: this.totals.nights });
    if (this.daemon.active) {
      const h = (dt * this.minuteRate) / 60;
      const d = DAEMON.perHour;
      this.cityStress.bump('police', 'daemon', d.police * h);
      this.cityStress.bump('medics', 'daemon', d.medics * h);
      const st = this.neighbourhood.state;
      st.safety = Math.max(0, st.safety - d.safety * h);
      st.reputation = Math.max(0, st.reputation - d.reputation * h);
    }
    if (daemonNews?.kind === 'arrived') {
      this.org.notice(this.clockMinutes, t('Someone in acute crisis is roaming the street: wired, sleepless, frightened and frightening. The police and the medics are being called. Tap them to act.'));
    } else if (daemonNews?.kind === 'endedAlone') {
      const e = DAEMON.ending;
      this.cityStress.bump('medics', 'daemon', e.medics);
      this.cityStress.bump('police', 'daemon', e.police);
      this.neighbourhood.state.reputation = Math.max(0, this.neighbourhood.state.reputation - e.reputation);
      this.org.notice(this.clockMinutes, daemonNews.arrest
        ? t('Nobody reached the person in crisis: the police held them down and took them in. People saw it.')
        : t('Nobody reached the person in crisis: they collapsed in the street and the ambulance took them.'));
    }
    // Everything the organisation started with shut for money: said once, with the way back.
    const allShut = this.org.closedDown.size >= ORG.closeDownAfter.length;
    if (allShut && !this.allShutSaid) this.org.notice(this.clockMinutes, t('Everything is shut for lack of money. The street scene grows while you rebuild: funding still comes in, so relaunch once it allows.'));
    this.allShutSaid = allShut;
    const venueChange = this.vitality.tick(dt * this.minuteRate, { crisis: this.crisis, unmet24: this.unmet24, stress: (s.police + s.medics + s.sobering) / 3, safety: this.neighbourhood.state.safety });
    if (venueChange) {
      const kind = VENUE_KINDS[venueChange > 0 ? this.vitality.venues - 1 : this.vitality.venues];
      this.org.notice(this.clockMinutes, venueChange > 0
        ? t('The street is doing well: a new {venue} has opened. More people come out at night, and it could use harm reduction.', { venue: VENUE_NAMES[kind] })
        : t('Things got worse on the street: the {venue} has closed.', { venue: VENUE_NAMES[kind] }));
      for (const id of ['passerby', 'club'] as const) this.timers[id] = nextArrival(this.random, this.rate(id));
    }
    // The feed hears when the camp crosses a size, either way.
    const stage = this.camp.size >= CAMP.sweepAt ? 2 : this.camp.size >= 0.3 ? 1 : 0;
    if (stage !== this.campStage) {
      const grew = stage > this.campStage;
      this.campStage = stage;
      this.org.notice(this.clockMinutes, grew
        ? t('The camp in the park is growing: about {people} in tents now.', { people: plural(this.camp.people, ['{n} person', '{n} people'], ['{n} osoba', '{n} osoby', '{n} osób']) }) + (stage === 2 ? ' ' + t('Neighbours are complaining to the council.') : '')
        : t('The camp in the park is shrinking: about {people} left in tents.', { people: plural(this.camp.people, ['{n} person', '{n} people'], ['{n} osoba', '{n} osoby', '{n} osób']) }));
    }
    const inCrisis = this.crisis > 0;
    if (inCrisis !== this.inCrisis) {
      this.inCrisis = inCrisis;
      this.org.notice(this.clockMinutes, !inCrisis
        ? t('The crisis is easing: fewer people are being turned away.')
        : this.unmet24 >= CRISIS.calm
          ? t('Crisis on the street: {people} turned away in a day. More trouble, warier funders, more harm outdoors until fewer are turned away.', { people: plural(this.unmet24, ['{n} person', '{n} people'], ['{n} osoba', '{n} osoby', '{n} osób']) })
          : t("Crisis: the city's services are at breaking point. More trouble, warier funders, more harm outdoors until the pressure eases."));
    }
    if (this.movingUntil !== null && this.org.now >= this.movingUntil) {
      this.movingUntil = null;
      this.setEnabled('outreach', this.movingWasOn);
      this.org.notice(this.clockMinutes, t('The outreach camper has parked at its new spot.'));
    }
    const late = this.clockMinutes >= 24 * 60 && this.clockMinutes < MORNING;
    this.tickPatrol(dt * this.minuteRate);
    this.tickHappenings(dt * this.minuteRate);
    const stormOn = this.stakes.storm.phase === 'peak';
    let rota = this.team.tick((dt * this.minuteRate) / 60, late, { unpaid: this.org.broke && this.org.paid > 0, steadier: this.org.steadierVolunteers, drain: stormOn ? STORM.drain : 1 });
    const outreach = this.services.outreach;
    const stakes = this.stakes.tick(dt * this.minuteRate, {
      nights: this.totals.nights, clock: this.clockMinutes, season: this.season, shut: this.org.closedDown.size >= ORG.closeDownAfter.length,
      outreachOnStreet: (outreach.enabled && outreach.staffOnSite > 0) || this.services.footPatrol.staffOnSite > 0 || this.patrol.out,
    });
    rota ||= stakes.rota;
    if (stakes.extraPlaces) this.syncExtraPlaces();
    for (const n of stakes.news) {
      if (n.kind === 'stormWarned') this.emit({ type: 'storm', what: 'warned' });
      else if (n.kind === 'stormStarted') {
        this.org.notice(this.clockMinutes, this.stakes.storm.kind === 'badBatch'
          ? t('The bad batch is on the street. People in trouble are coming to every door.')
          : t('The deep freeze has set in. People are coming in from the cold to every door.'));
        this.emit({ type: 'storm', what: 'started' });
        for (const id of ['dropIn', 'outreach', 'footPatrol', 'shelter', 'clinic'] as const) this.timers[id] = nextArrival(this.random, this.rate(id));
      } else if (n.kind === 'stormEnded') {
        const r = n.report;
        this.org.notice(this.clockMinutes, t('The storm is over: {helped} helped, {away} turned away, {deaths} died, {saved} caught in time by outreach.', { helped: r.helped, away: r.turnedAway, deaths: r.deaths, saved: r.saved }));
        this.emit({ type: 'storm', what: 'ended', report: r });
        for (const id of ['dropIn', 'outreach', 'footPatrol', 'shelter', 'clinic'] as const) this.timers[id] = nextArrival(this.random, this.rate(id));
      }
      else if (n.kind === 'stormDeaths') {
        const bad = this.stakes.storm.kind === 'badBatch';
        if (n.died) this.org.notice(this.clockMinutes, bad
          ? plural(n.died, ['Someone the services could not reach overdosed alone on the bad batch and died.', '{n} people the services could not reach overdosed alone on the bad batch and died.'], ['Osoba, do której nie dotarły służby, przedawkowała w samotności złą partię i zmarła.', '{n} osoby, do których nie dotarły służby, przedawkowały w samotności złą partię i zmarły.', '{n} osób, do których nie dotarły służby, przedawkowało w samotności złą partię i zmarło.'])
          : plural(n.died, ['Someone with nowhere warm to go died in the freeze.', '{n} people with nowhere warm to go died in the freeze.'], ['Osoba bez ciepłego schronienia zmarła na mrozie.', '{n} osoby bez ciepłego schronienia zmarły na mrozie.', '{n} osób bez ciepłego schronienia zmarło na mrozie.']));
        if (n.saved) this.org.notice(this.clockMinutes, plural(n.saved, ['Outreach reached someone in time with the supplies it carried.', 'Outreach reached {n} people in time with the supplies it carried.'], ['Streetworkerzy dotarli na czas do jednej osoby z zapasami, które mieli przy sobie.', 'Streetworkerzy dotarli na czas do {n} osób z zapasami, które mieli przy sobie.', 'Streetworkerzy dotarli na czas do {n} osób z zapasami, które mieli przy sobie.']));
      } else if (n.kind === 'gift') for (let i = 0; i < Math.min(8, Math.ceil(n.amount / 40)); i++) this.emit({ type: 'money', service: 'dropIn', amount: 1 });
      else if (n.kind === 'introduced') this.org.notice(this.clockMinutes, INTRO_NOTICE[n.what]);
      else this.emit({ type: 'runOver', cause: n.cause });
    }
    if (rota) this.reallocate();
    else this.updateSkill();
    if (this.openingChanged()) this.reallocate();
    if (!this.tutorial?.active) this.favours = this.reputation.tick(dt * this.minuteRate, this.neighbourhood.state.reputation, this.funders.trust, this.favours);
    const band = this.funders.tick(dt * this.minuteRate, this.neighbourhood.state.reputation, this.servicesClosedByPlayer, this.growth.size);
    if (band) this.org.notice(this.clockMinutes, band === 'wary'
      ? t('Funders are getting wary: fewer people helped this past day. Project money and grant chances are down until results pick up.')
      : band === 'confident'
        ? t('Funders are pleased with the past day\'s work: project money and grant chances are up.')
        : t('Funders are back to their usual confidence.'));
    const income = this.fundingIncome;
    const wasBroke = this.org.broke;
    if (this.org.tick(this.clockMinutes, dt * this.minuteRate, income, this.payroll, this.applicationContext(), this.runningPerHour)) {
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
    const paced = dt * this.timeScale;
    if (this.context.possessionStops && this.context.patrol > 0 && (this.stopTimer -= paced) <= 0) {
      this.emit({ type: 'policeStop', arrest: this.random() < ILLUSTRATIVE.people.arrestShare });
      this.stopTimer = nextArrival(this.random, ILLUSTRATIVE.policeStopsPerMinutePerOfficer * this.context.patrol);
    }
    this.tickArrivals(paced);
    for (const id of SERVICE_IDS) this.tickService(this.services[id], paced);
    this.tickClub(paced);
  }

  private tickArrivals(dt: number): void {
    const t = this.timers;
    const spawn = (intent: Intent, wantsStand = false) => {
      if (this.tutorial?.active) {
        if ((SERVICE_IDS as readonly string[]).includes(intent) && !this.tutorialAllowsService(intent as ServiceId)) return;
        if (intent === 'passerby' || intent === 'party' || (intent === 'club' && !this.tutorialCapabilities.stress)) return;
      }
      const seeksService = intent === 'dropIn' || intent === 'outreach' || wantsStand || (WALK_IN_SERVICE_IDS as readonly string[]).includes(intent);
      const local = seeksService ? this.localDeter(intent === 'party' || intent === 'club' || intent === 'passerby' ? 'clubHr' : wantsStand ? 'clubHr' : (intent as ServiceId)) : 0;
      const turnsBack = seeksService && this.random() < 1 - (1 - this.context.deterrence) * (1 - local);
      const visitor = this.nextVisitor++;
      const mix = intent === 'club' || intent === 'party' ? PROFILE_MIX.club : intent === 'passerby' ? PROFILE_MIX.passerby : PROFILE_MIX.service;
      this.profiles.set(visitor, this.drawProfile(mix));
      const kind = intent === 'passerby' ? this.city.passerbyKind(this.clockMinutes, this.calendar.date) : undefined;
      this.emit({ type: 'spawnVisitor', visitor, intent, wantsStand, turnsBack, kind });
    };

    if ((t.dropIn -= dt) <= 0) { if (this.expected('dropIn')) spawn('dropIn'); t.dropIn = nextArrival(this.random, this.rate('dropIn')); }
    if ((t.outreach -= dt) <= 0) { if (this.expected('outreach')) spawn('outreach'); t.outreach = nextArrival(this.random, this.rate('outreach')); }
    for (const id of WALK_IN_SERVICE_IDS) {
      if ((t[id] -= dt) <= 0) { if (this.expected(id)) spawn(id); t[id] = nextArrival(this.random, this.rate(id)); }
    }
    if ((t.club -= dt) <= 0) {
      spawn('club', this.random() < this.standInterest && this.expected('clubHr'));
      t.club = nextArrival(this.random, this.rate('club'));
    }
    if ((t.passerby -= dt) <= 0) { spawn('passerby'); t.passerby = nextArrival(this.random, this.rate('passerby')); }
    if ((t.party -= dt) <= 0) { spawn('party'); t.party = nextArrival(this.random, this.rate('party')); }
    if (this.partyBurst > 0) { this.partyBurst--; spawn('party'); }
    if ((t.car -= dt) <= 0 && !this.tutorial?.active) { this.emit({ type: 'spawnCar' }); t.car = nextArrival(this.random, this.rate('car')); }
    if ((t.leaver -= dt) <= 0 && !this.tutorial?.active) {
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
        // The place's budget mix scales how often checking happens there (and lets places check that otherwise would not).
        const checkMix = this.mix.relative(s.id, 'checking', c.checkingAllowed);
        const checks = s.id === 'drugChecking' || c.checkingSites.includes(s.id) || (checkMix ?? 0) > 0;
        const night = s.id === 'outreach' && this.camperPath === 'nightlife';
        if (c.checkingAllowed && checks && this.random() < Math.min(1, ILLUSTRATIVE.checkingShare[s.id] * this.mods.checkingBoost * (checkMix ?? 1) * (night ? CAMPER_PATH_EFFECT.nightlifeChecking : 1))) this.recordCheck(s.id, visitor);
        // Test strips and reagent kits: legal or not, people can test their own.
        const kitsMix = this.mix.relative(s.id, 'kits', c.checkingAllowed);
        if (kitsMix && this.random() < Math.min(1, 0.5 * kitsMix * (night ? CAMPER_PATH_EFFECT.nightlifeKits : 1)) && this.stakes.supplies.use('kits')) this.selfTest(visitor);
        // Leaflets go out on the street and at the stand while there are any.
        if (s.id === 'outreach' || s.id === 'footPatrol' || s.id === 'clubHr') this.stakes.supplies.use('leaflets');
        if (s.id !== 'clubHr' && this.profiles.get(visitor)?.injects) {
          // Kits cost money; with none in stock, no money, or kits not in this place's mix, the person leaves without them.
          const kitMix = this.mix.relative(s.id, 'needles', c.checkingAllowed);
          // A health camper makes its kits go further: only some visits take one from the shelf.
          const spares = s.id === 'outreach' && this.camperPath === 'health' && this.random() >= CAMPER_PATH_EFFECT.healthKitCost;
          if (this.mods.kitsOut || (kitMix !== null && this.random() >= kitMix) || !(spares || this.stakes.supplies.use('kits'))) this.unsafeInjecting();
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
  /** Someone takes a test kit: no lab result or early warning, but a strip or a reagent can still change their plans. */
  private selfTest(visitor: VisitorId): void {
    this.checking.selfTests++;
    const substance = this.profiles.get(visitor)?.substance ?? 'none';
    const event = this.events.supplyEventFor(substance);
    if (event && this.random() < CHECKING.changePlans.value * 0.6) this.checking.changedPlans++;
  }

  private recordCheck(service: ServiceId, visitor: VisitorId): void {
    const c = this.checking;
    if (!this.org.spend(this.context.turnaround === 'lab' ? ORG.costs.labCheck : ORG.costs.onsiteCheck)) return;
    c.samples++;
    if (this.context.turnaround === 'lab' && this.random() >= CHECKING.labCollected.value * this.mods.labCollected) return;
    c.resultsReceived++;
    // Charged-for checking: the client pays, but results seldom reach the early warning and there is less advice.
    const sold = this.commercialChecking && service === 'drugChecking';
    if (sold) { this.org.budget += HUSTLE.checkFee; this.flow('drugChecking', HUSTLE.checkFee); }
    const substance = this.profiles.get(visitor)?.substance ?? 'none';
    const event = this.events.supplyEventFor(substance);
    if (!event && this.random() >= CHECKING.unexpected.value) return;
    c.unexpected++;
    const warns = !sold || this.random() < HUSTLE.commercialWarning;
    if (warns && event && event.detectedAt === null) event.detectedAt = this.clockMinutes;
    if (warns && this.context.publicAlerts) {
      // The first public alert about a batch sends people to check their own.
      if (event && !event.alerted) {
        event.alerted = true;
        this.triggerEvent('checkingRush');
      }
      this.emit({ type: 'alert', service, word: event ? EVENTS[event.id].boardWord : 'ALERT' });
    }
    if (this.random() < CHECKING.changePlans.value * (sold ? HUSTLE.commercialAdvice : 1)) c.changedPlans++;
  }

  private admit(s: ServiceModel, visitor: VisitorId, notify: boolean): void {
    s.metrics.attended++;
    this.totals.helped++;
    this.funders.helped();
    // Every visit costs money and wears the place; unpaid, it wears twice as fast.
    const mix = this.mix.factors(s.id, this.context.checkingAllowed);
    // In a crisis people come in a worse state: more dressings, more supplies, longer care.
    const cost = (ORG.visitCost[s.id] ?? 0) * mix.cost * (1 + CRISIS.visitCostBoost * this.crisis);
    const paid = cost <= 0 || this.org.spend(cost);
    if (paid && cost > 0) this.flow(s.id, -cost);
    this.wear(s.id, INVEST.wearPerVisit * (paid ? 1 : 2));
    if (s.id !== 'clubHr') {
      this.neighbourhood.note('attended');
      this.neighbourhood.note('demand');
    }
    // Someone who needs a particular skill is quicker with the right worker, much slower without.
    const match = this.stakes.admitted(s.id, this.crisis, this.supportOf(visitor));
    s.inService.set(visitor, range(this.random, s.params.serviceSeconds) * this.mods.serviceTime[s.id] * mix.time * match);
    if (notify) this.emit({ type: 'admitted', service: s.id, visitor });
  }

  private recordUnmet(s: ServiceModel, visitor: VisitorId, notify = true, reachedDoor = true): void {
    s.metrics.unmetNeed++;
    if (reachedDoor) {
      this.unmetLog.push(this.org.now);
      this.turnedAwayTotal++;
      // In a crisis nobody is simply gone: they come back worse off, and the team patches them up at the door.
      const doorstep = CRISIS.doorstepCost * this.crisis;
      if (doorstep > 0 && this.org.spend(doorstep)) this.flow(s.id, -doorstep);
      this.stakes.turnedAway(s.id);
    }
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
    const reach = ACUTE.reachedByStaff.hidden + (this.camperPath === 'health' ? CAMPER_PATH_EFFECT.healthReach : 0) + (this.patrol.out ? PATROL.reach : 0);
    const acute = hiddenUse ? this.acuteFor(profile, true, 'outreach', reach) : null;
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
