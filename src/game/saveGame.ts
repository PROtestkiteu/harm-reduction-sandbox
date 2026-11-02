import type { Simulation } from '../sim/simulation';
import { BASE_STAGE, stageCount } from '../config/serviceStages';
import { SERVICE_IDS, type ServiceId } from '../sim/types';
import { TRAITS, type Assignment, type Member, type TraitId } from '../sim/team';
import { SATELLITE_SERVICES, type SatelliteService, type UnitState } from '../sim/property';
import type { NeighbourhoodState } from '../sim/neighbourhood';
import { CAMPER_PATH_IDS, type CamperPath } from '../config/camperPaths';
import { QUESTS, type InstitutionId } from '../config/institutionQuests';
import { GRANT_IDS, ORG, RECRUIT, type GrantId, type RecruitId } from '../config/organisation';
import type { ApplicationState } from '../sim/organisation';
import { PROPERTY, type Point } from '../sim/property';
import { VENUE_KINDS } from '../sim/vitality';
import type { CrimeType } from '../sim/cityLife';
import { SERVICE_ACTIVITIES, type Activity } from '../config/serviceMix';
import { CAMPER_SPOTS, camperSpot } from '../world/layout';
import { isSandboxed, markSandboxed } from './sandboxed';
import type { Goals } from '../sim/goals';

/**
 * A saved game: the state that makes a run yours (time, money, staff, team,
 * upgrades, rented shops, campers, the street), not every person on the
 * street. Settings and context travel in the page's own query string.
 *
 * Saves are packed into the part of a link after '#': compressed JSON in
 * base64url. Nothing in a save is trusted: every field is checked, clamped
 * and rebuilt on load, so an edited link cannot break the game. A link from
 * someone else starts a fresh leaderboard run on top of their city.
 */
export interface SaveData {
  v: 1;
  /** Organisation name, for the leaderboard. */
  name: string;
  clock: number;
  day: number;
  year: number;
  org: { budget: number; paid: number; volunteers: number; grantIncome: number; closedDown: ServiceId[] };
  /** The services switched on (older saves: all of them). */
  on?: ServiceId[];
  /** The services ever run this game (older saves: those switched on). */
  ran?: ServiceId[];
  team: { name: string; paid: boolean; traits: TraitId[]; energy: number; assignment: Assignment; worn?: true }[];
  /** Each service's stage (see SERVICE_STAGES) and progress; older saves wrote `level` on a scale one lower. */
  upgrades: Record<string, { stage: number; progress: number }>;
  units: UnitState[];
  campers: number[];
  /** The outreach camper's specialisation, if any. */
  camperPath?: CamperPath;
  /** Steps done in each institution's side quest. */
  quests?: Partial<Record<InstitutionId, number>>;
  street: Partial<NeighbourhoodState>;
  totals: { helped: number; nights: number };
  /** The leaderboard run this save belongs to, if any. */
  run?: { id: string; ts: number; token: string; sandboxed?: true };
  /** The game used the Sandbox's free levers: it stays off the leaderboard (see sandboxed.ts). */
  sandboxed?: true;
  /** Format revision: 2 adds `more`. Saves without it load with the start values for everything in it. */
  rev?: 2;
  more?: SaveMore;
}

type Times = { readyAt: number };
type MixWeights = Partial<Record<ServiceId, Partial<Record<Activity, number>>>>;
const CRIMES: readonly CrimeType[] = ['bikeTheft', 'carBreakIn', 'pickpocket', 'graffiti', 'scuffle'];

/**
 * Everything else that carries a run on (revision 2). Deadlines are in
 * `org.now` minutes, and `now` is saved with them, so every deadline means the
 * same after a load. Fields left out (a hand-edited link) keep the start value.
 */
export interface SaveMore {
  /** `org.now`: minutes since the start, never wrapping. */
  now: number;
  /** Funder trust and the last day's helped per hour (sim/funders.ts); checked there on restore. */
  funders?: { trust?: number; hours?: number[]; covered?: number };
  /** The district's size and street scene (sim/growth.ts); checked there on restore. Older saves start at the first evening's. */
  growth?: { size?: number; street?: number };
  /** Petty theft and the shops' guards and shutters (sim/pettyCrime.ts); checked there on restore. */
  petty?: Partial<ReturnType<Simulation['petty']['snapshot']>>;
  /** Tonight's picket, priest or nun (sim/streetVisitors.ts). */
  visitors?: Partial<ReturnType<Simulation['visitors']['snapshot']>>;
  /** Someone in acute crisis on the street, if they are (sim/chaosDaemon.ts); checked there on restore. */
  daemon?: { since?: number | null; fails?: number; quietUntil?: number };
  /** Nightly goals, stars and the scenario (sim/goals.ts); checked there on restore. */
  goals?: Partial<ReturnType<Goals['snapshot']>>;
  /** People turned away over the whole run (the night report's count). */
  turnedAway?: number;
  org: {
    broke: boolean;
    brokeMinutes: number;
    netPerHour: number;
    steadierVolunteers: boolean;
    equipment: boolean;
    recruiting: ({ id: RecruitId } & Times)[];
    reopening: ({ id: ServiceId } & Times)[];
    /** Grant applications not idle. */
    apps: Partial<Record<GrantId, ApplicationState>>;
  };
  /** Harm reduction points in ordinary buildings. */
  points: Point[];
  /** The first camper's kerb spot (index in CAMPER_SPOTS). */
  camper: number;
  mix: { weights: MixWeights; ready: string[] };
  city: {
    favours: number;
    concessionAt: number | null;
    policeAwayUntil: number;
    policePostedUntil: number;
    campHoldUntil: number;
    clubContract: boolean;
    clubAskAgainAt: number;
    commercialChecking: boolean;
    driveUntil: number | null;
    driveAgainAt: number;
    sweepAgainAt: number;
    residentsMetUntil: number;
    meetAgainAt: number;
    warmingBus: boolean;
    coolingPoint: boolean;
    /** The outreach camper is driving to a new spot until then, and whether outreach was on before. */
    movingUntil: number | null;
    movingWasOn: boolean;
    mediaHit: { factor: number; until: number };
  };
  vitality: { level: number; venues: number; partners: number[] };
  stress: { police: number; medics: number; sobering: number };
  camp: { size: number; station: number; squat: number; stage: number };
  crisis: boolean;
  /** People left unserved in the last 24 clock hours: minutes before `now` of the oldest, then gaps (whole minutes). */
  unmet: number[];
  counts: {
    health: { acuteHarms: number; helped: number; alone: number; sterileKits: number; unsafeInjecting: number };
    checking: { samples: number; resultsReceived: number; unexpected: number; changedPlans: number; selfTests: number };
    stops: number;
    arrests: number;
    hidden: number;
    intox: number;
    harms: number;
    deaths: number;
    crime: Record<CrimeType, number>;
    responded: number;
  };
}

/** The simulation's own bookkeeping that a save carries; private there, so read and written through this one view. */
interface SimInternals {
  policeAwayUntil: number;
  policePostedUntil: number;
  movingUntil: number | null;
  movingWasOn: boolean;
  campStage: number;
  inCrisis: boolean;
  readonly unmetLog: number[];
}
const internals = (sim: Simulation) => sim as unknown as SimInternals;
/** At most this many unserved people are kept: far past the crisis's full mark, so the crisis reads the same. */
const MAX_UNMET = 200;

const num = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const int = (v: unknown, lo: number, hi: number, fallback: number) => Math.round(num(v, lo, hi, fallback));
const text = (v: unknown, max: number, fallback: string) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').slice(0, max) : fallback);
const isService = (v: unknown): v is ServiceId => typeof v === 'string' && (SERVICE_IDS as readonly string[]).includes(v);
const ASSIGN = new Set<string>(['auto', 'rest', ...SERVICE_IDS]);
const STREET_KEYS: (keyof NeighbourhoodState)[] = ['visibleUse', 'litter', 'streetMarket', 'safety', 'shopTrade', 'reputation'];
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const r1 = (v: number) => Math.round(v * 10) / 10;
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const arr = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : []);
/** A deadline in `org.now` minutes. */
const when = (v: unknown, fallback = 0) => num(v, -1e7, 1e9, fallback);
const whenOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? when(v) : null);
const flag = (v: unknown, fallback = false) => (typeof v === 'boolean' ? v : fallback);
const count = (v: unknown) => int(v, 0, 1e9, 0);

function captureMore(sim: Simulation): SaveMore {
  const o = sim.org;
  const own = internals(sim);
  const now = o.now;
  const apps: Partial<Record<GrantId, ApplicationState>> = {};
  for (const id of GRANT_IDS) if (o.applications[id].status !== 'idle') apps[id] = { ...o.applications[id] };
  // The unserved, oldest first: whole minutes before now, then the gaps between them.
  void sim.unmet24; // reading it drops the ones older than a day
  const log = own.unmetLog.slice(-MAX_UNMET).map((t) => Math.round(t));
  const unmet = log.map((t, i) => (i === 0 ? Math.round(now) - t : t - log[i - 1]));
  const c = sim.camp;
  const s = sim.cityStress;
  return {
    now: r3(now),
    funders: sim.funders.snapshot(),
    growth: sim.growth.snapshot(),
    petty: sim.petty.snapshot(),
    visitors: sim.visitors.snapshot(),
    daemon: sim.daemon.snapshot(),
    goals: sim.goals.snapshot(),
    turnedAway: sim.turnedAwayTotal,
    org: {
      broke: o.broke,
      brokeMinutes: r1(o.brokeMinutes),
      netPerHour: r1(o.netPerHour),
      steadierVolunteers: o.steadierVolunteers,
      equipment: o.equipment,
      recruiting: o.recruiting.map((r) => ({ id: r.id, readyAt: r1(r.readyAt) })),
      reopening: o.reopening.map((r) => ({ id: r.id, readyAt: r1(r.readyAt) })),
      apps,
    },
    points: sim.property.points.map((q) => ({ ...q })),
    camper: camperSpot(),
    mix: sim.mix.snapshot(),
    city: {
      favours: sim.favours,
      concessionAt: sim.concessionAt === null ? null : r1(sim.concessionAt),
      policeAwayUntil: r1(own.policeAwayUntil),
      policePostedUntil: r1(own.policePostedUntil),
      campHoldUntil: r1(sim.campHoldUntil),
      clubContract: sim.clubContract,
      clubAskAgainAt: r1(sim.clubAskAgainAt),
      commercialChecking: sim.commercialChecking,
      driveUntil: sim.driveUntil === null ? null : r1(sim.driveUntil),
      driveAgainAt: r1(sim.driveAgainAt),
      sweepAgainAt: r1(sim.sweepAgainAt),
      residentsMetUntil: r1(sim.residentsMetUntil),
      meetAgainAt: r1(sim.meetAgainAt),
      warmingBus: sim.warmingBus,
      coolingPoint: sim.coolingPoint,
      movingUntil: own.movingUntil === null ? null : r1(own.movingUntil),
      movingWasOn: own.movingWasOn,
      mediaHit: { factor: r3(sim.mediaHit.factor), until: r1(sim.mediaHit.until) },
    },
    vitality: { level: r3(sim.vitality.level), venues: sim.vitality.venues, partners: [...sim.vitality.partners] },
    stress: { police: r3(s.police), medics: r3(s.medics), sobering: r3(s.sobering) },
    camp: { size: r3(c.size), station: r3(c.station), squat: r3(c.squat), stage: own.campStage },
    crisis: own.inCrisis,
    unmet,
    counts: {
      health: { ...sim.health },
      checking: { ...sim.checking },
      stops: sim.policeStops,
      arrests: sim.arrests,
      hidden: sim.hiddenUse,
      intox: sim.intoxicatedLeavers,
      harms: sim.exposure.harms,
      deaths: sim.exposure.deaths,
      crime: { ...sim.city.incidents },
      responded: sim.city.responded,
    },
  };
}

const isGrantState = (v: Record<string, unknown>): ApplicationState | null => {
  if (v.status === 'pending') return { status: 'pending', decidesAt: when(v.decidesAt) };
  if (v.status === 'approved' || v.status === 'declined') return { status: v.status, at: num(v.at, -1e9, 1e9, 0) };
  return null;
};

/** Checks and clamps revision 2's fields; anything missing gets the start value. */
function parseMore(raw: unknown): SaveMore | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const m = raw as Record<string, unknown>;
  const org = obj(m.org);
  const city = obj(m.city);
  const vit = obj(m.vitality);
  const stress = obj(m.stress);
  const camp = obj(m.camp);
  const counts = obj(m.counts);
  const health = obj(counts.health);
  const checking = obj(counts.checking);
  const crime = obj(counts.crime);
  const mix = obj(m.mix);
  const apps: Partial<Record<GrantId, ApplicationState>> = {};
  for (const id of GRANT_IDS) {
    const st = isGrantState(obj(obj(org.apps)[id]));
    if (st) apps[id] = st;
  }
  const venues = int(vit.venues, 0, VENUE_KINDS.length, 0);
  const seenPoints = new Set<number>();
  const points = arr(m.points, 40).flatMap((q): Point[] => {
    const p = obj(q);
    const building = int(p.building, 0, 1e6, -1);
    if (building < 0 || seenPoints.has(building) || !(SATELLITE_SERVICES as readonly unknown[]).includes(p.service)) return [];
    seenPoints.add(building);
    return [{ building, service: p.service as SatelliteService, level: int(p.level, 0, PROPERTY.point.maxLevel, 0) }];
  });
  const weights: MixWeights = {};
  const w = obj(mix.weights);
  for (const id of SERVICE_IDS) {
    const row = obj(w[id]);
    const out: Partial<Record<Activity, number>> = {};
    for (const a of SERVICE_ACTIVITIES[id]) if (typeof row[a] === 'number') out[a] = num(row[a], 0, 100, 0);
    weights[id] = out;
  }
  return {
    funders: obj(m.funders) as SaveMore['funders'],
    growth: obj(m.growth) as SaveMore['growth'],
    petty: obj(m.petty) as SaveMore['petty'],
    visitors: obj(m.visitors) as SaveMore['visitors'],
    daemon: obj(m.daemon) as SaveMore['daemon'],
    goals: obj(m.goals) as SaveMore['goals'],
    turnedAway: count(m.turnedAway),
    now: num(m.now, 0, 1e9, 0),
    org: {
      broke: flag(org.broke),
      brokeMinutes: num(org.brokeMinutes, 0, 1e7, 0),
      netPerHour: num(org.netPerHour, -1e5, 1e5, 0),
      steadierVolunteers: flag(org.steadierVolunteers),
      equipment: flag(org.equipment),
      recruiting: arr(org.recruiting, 20).flatMap((r) => {
        const x = obj(r);
        return typeof x.id === 'string' && x.id in RECRUIT ? [{ id: x.id as RecruitId, readyAt: when(x.readyAt) }] : [];
      }),
      reopening: arr(org.reopening, SERVICE_IDS.length).flatMap((r) => {
        const x = obj(r);
        return isService(x.id) ? [{ id: x.id, readyAt: when(x.readyAt) }] : [];
      }),
      apps,
    },
    points,
    camper: int(m.camper, -1, CAMPER_SPOTS.length - 1, -1),
    mix: { weights, ready: arr(mix.ready, 64).filter((k): k is string => typeof k === 'string' && k.length < 40) },
    city: {
      favours: int(city.favours, 0, 1, 1),
      concessionAt: whenOrNull(city.concessionAt),
      policeAwayUntil: when(city.policeAwayUntil),
      policePostedUntil: when(city.policePostedUntil),
      campHoldUntil: when(city.campHoldUntil),
      clubContract: flag(city.clubContract),
      clubAskAgainAt: when(city.clubAskAgainAt),
      commercialChecking: flag(city.commercialChecking),
      driveUntil: whenOrNull(city.driveUntil),
      driveAgainAt: when(city.driveAgainAt),
      sweepAgainAt: when(city.sweepAgainAt),
      residentsMetUntil: when(city.residentsMetUntil),
      meetAgainAt: when(city.meetAgainAt),
      warmingBus: flag(city.warmingBus),
      coolingPoint: flag(city.coolingPoint),
      movingUntil: whenOrNull(city.movingUntil),
      movingWasOn: flag(city.movingWasOn, true),
      mediaHit: { factor: num(obj(city.mediaHit).factor, 0, 2, 1), until: when(obj(city.mediaHit).until) },
    },
    vitality: {
      level: num(vit.level, 0, 1, 0.3),
      venues,
      partners: [...new Set(arr(vit.partners, VENUE_KINDS.length).map((i) => int(i, -1, venues - 1, -1)).filter((i) => i >= 0))],
    },
    stress: { police: num(stress.police, 0, 1, 0.1), medics: num(stress.medics, 0, 1, 0.1), sobering: num(stress.sobering, 0, 1, 0.1) },
    camp: { size: num(camp.size, 0, 1, 0.15), station: num(camp.station, 0, 1, 0.1), squat: num(camp.squat, 0, 1, 0.2), stage: int(camp.stage, 0, 100, 0) },
    crisis: flag(m.crisis),
    unmet: arr(m.unmet, MAX_UNMET).map((d) => int(d, 0, 24 * 60, 0)),
    counts: {
      health: { acuteHarms: count(health.acuteHarms), helped: count(health.helped), alone: count(health.alone), sterileKits: count(health.sterileKits), unsafeInjecting: count(health.unsafeInjecting) },
      checking: { samples: count(checking.samples), resultsReceived: count(checking.resultsReceived), unexpected: count(checking.unexpected), changedPlans: count(checking.changedPlans), selfTests: count(checking.selfTests) },
      stops: count(counts.stops),
      arrests: count(counts.arrests),
      hidden: count(counts.hidden),
      intox: count(counts.intox),
      harms: count(counts.harms),
      deaths: count(counts.deaths),
      crime: Object.fromEntries(CRIMES.map((k) => [k, count(crime[k])])) as Record<CrimeType, number>,
      responded: count(counts.responded),
    },
  };
}

/** Puts revision 2's fields into the simulation (after the rest of the save). */
function applyMore(sim: Simulation, m: SaveMore): void {
  const o = sim.org;
  const own = internals(sim);
  o.now = m.now;
  sim.funders.restore(m.funders);
  sim.growth.restore(m.growth);
  if (m.petty) sim.petty.restore(m.petty);
  if (m.visitors) sim.visitors.restore(m.visitors);
  sim.daemon.restore(m.daemon);
  sim.restoreGoals(m.goals);
  sim.turnedAwayTotal = m.turnedAway ?? 0;
  o.broke = m.org.broke;
  o.brokeMinutes = m.org.brokeMinutes;
  o.netPerHour = m.org.netPerHour;
  o.steadierVolunteers = m.org.steadierVolunteers;
  o.equipment = m.org.equipment;
  o.recruiting.splice(0, o.recruiting.length, ...m.org.recruiting);
  // Only services that are closed down can be relaunching, each once.
  const reopening = m.org.reopening.filter((r, i, all) => o.closedDown.has(r.id) && all.findIndex((x) => x.id === r.id) === i);
  o.reopening.splice(0, o.reopening.length, ...reopening);
  for (const id of GRANT_IDS) o.applications[id] = m.org.apps[id] ?? { status: 'idle' };
  sim.property.points.splice(0, sim.property.points.length, ...m.points);
  sim.mix.restore(m.mix);
  const c = m.city;
  sim.favours = c.favours;
  sim.concessionAt = c.concessionAt;
  own.policeAwayUntil = c.policeAwayUntil;
  own.policePostedUntil = c.policePostedUntil;
  sim.campHoldUntil = c.campHoldUntil;
  sim.clubContract = c.clubContract;
  sim.clubAskAgainAt = c.clubAskAgainAt;
  sim.commercialChecking = c.commercialChecking;
  sim.driveUntil = c.driveUntil;
  sim.driveAgainAt = c.driveAgainAt;
  sim.sweepAgainAt = c.sweepAgainAt;
  sim.residentsMetUntil = c.residentsMetUntil;
  sim.meetAgainAt = c.meetAgainAt;
  sim.warmingBus = c.warmingBus;
  sim.coolingPoint = c.coolingPoint;
  own.movingUntil = c.movingUntil;
  own.movingWasOn = c.movingWasOn;
  Object.assign(sim.mediaHit, c.mediaHit);
  sim.vitality.level = m.vitality.level;
  sim.vitality.venues = m.vitality.venues;
  sim.vitality.partners.clear();
  for (const i of m.vitality.partners) sim.vitality.partners.add(i);
  Object.assign(sim.cityStress, m.stress);
  sim.camp.size = m.camp.size;
  sim.camp.station = m.camp.station;
  sim.camp.squat = m.camp.squat;
  own.campStage = m.camp.stage;
  own.inCrisis = m.crisis;
  const log: number[] = [];
  m.unmet.forEach((d, i) => log.push(i === 0 ? Math.round(m.now) - d : log[i - 1] + d));
  own.unmetLog.splice(0, own.unmetLog.length, ...log);
  const k = m.counts;
  Object.assign(sim.health, k.health);
  Object.assign(sim.checking, k.checking);
  sim.policeStops = k.stops;
  sim.arrests = k.arrests;
  sim.hiddenUse = k.hidden;
  sim.intoxicatedLeavers = k.intox;
  sim.exposure.harms = k.harms;
  sim.exposure.deaths = k.deaths;
  Object.assign(sim.city.incidents, k.crime);
  sim.city.responded = k.responded;
}

/**
 * The first camper's spot from the last applied save, handed to the app once:
 * the scene, not the simulation, parks the camper (see `world.moveCamper`).
 */
let loadedCamper: number | null = null;
export function takeLoadedCamperSpot(): number | null {
  const spot = loadedCamper;
  loadedCamper = null;
  return spot;
}

export function captureSave(sim: Simulation, name: string, run?: SaveData['run']): SaveData {
  const o = sim.org;
  const street: Partial<NeighbourhoodState> = {};
  for (const k of STREET_KEYS) street[k] = Math.round(sim.neighbourhood.state[k] * 1000) / 1000;
  return {
    v: 1,
    name,
    clock: Math.round(sim.clockMinutes),
    day: sim.calendar.dayOfYear,
    year: sim.calendar.year,
    org: { budget: Math.round(o.budget), paid: o.paid, volunteers: o.volunteers, grantIncome: o.grantIncome, closedDown: [...o.closedDown] },
    on: SERVICE_IDS.filter((id) => sim.services[id].switchedOn),
    ran: SERVICE_IDS.filter((id) => sim.services[id].everRun),
    team: sim.team.members.map((m) => ({ name: m.name, paid: m.paid, traits: [...m.traits], energy: Math.round(m.energy * 100) / 100, assignment: m.assignment, ...(m.worn ? { worn: true as const } : {}) })),
    upgrades: Object.fromEntries(SERVICE_IDS.map((id) => [id, { stage: sim.upgrades[id].level, progress: Math.round(sim.upgrades[id].progress * 1000) / 1000 }])),
    units: sim.property.units.map((u) => ({ ...u })),
    campers: [...sim.property.campers],
    camperPath: sim.camperPath ?? undefined,
    quests: { ...sim.quests },
    street,
    totals: { ...sim.totals },
    run,
    sandboxed: isSandboxed() || undefined,
    rev: 2,
    more: captureMore(sim),
  };
}

/** Checks and clamps every field of untrusted input; returns null if it is not a save at all. */
export function parseSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object' || (raw as { v?: unknown }).v !== 1) return null;
  const r = raw as Record<string, unknown>;
  const org = (r.org ?? {}) as Record<string, unknown>;
  const team = Array.isArray(r.team) ? r.team.slice(0, 40) : [];
  const units = Array.isArray(r.units) ? r.units.slice(0, 16) : [];
  const upgrades = (r.upgrades ?? {}) as Record<string, { stage?: unknown; level?: unknown; progress?: unknown }>;
  const street = (r.street ?? {}) as Record<string, unknown>;
  const totals = (r.totals ?? {}) as Record<string, unknown>;
  const run = r.run as Record<string, unknown> | undefined;
  return {
    v: 1,
    name: text(r.name, 40, ''),
    clock: num(r.clock, 18 * 60, 42 * 60 - 1, 19 * 60),
    day: int(r.day, 0, 364, 257),
    year: int(r.year, 2027, 2100, 2027),
    org: {
      budget: num(org.budget, -100000, 1000000, 1500),
      paid: int(org.paid, 0, 40, 4),
      volunteers: int(org.volunteers, 0, 40, 2),
      grantIncome: num(org.grantIncome, 0, 2000, 0),
      closedDown: (Array.isArray(org.closedDown) ? org.closedDown : []).filter(isService),
    },
    on: Array.isArray(r.on) ? SERVICE_IDS.filter((id) => (r.on as unknown[]).includes(id)) : [...SERVICE_IDS],
    team: team.map((t) => {
      const m = (t ?? {}) as Record<string, unknown>;
      const traits = (Array.isArray(m.traits) ? m.traits : []).filter((x): x is TraitId => typeof x === 'string' && x in TRAITS).slice(0, 3);
      return {
        name: text(m.name, 24, 'Worker') || 'Worker',
        paid: m.paid === true,
        traits,
        energy: num(m.energy, 0, 1, 0.8),
        assignment: (typeof m.assignment === 'string' && ASSIGN.has(m.assignment) ? m.assignment : 'auto') as Assignment,
        ...(m.worn === true ? { worn: true as const } : {}),
      };
    }),
    upgrades: Object.fromEntries(SERVICE_IDS.map((id) => {
      const u = upgrades[id];
      // An older save's level 1 was the usual size, which is stage 2 now.
      const stage = u?.stage !== undefined ? int(u.stage, 1, stageCount(id), BASE_STAGE) : int(u?.level, 1, 3, 1) + 1;
      return [id, { stage: Math.min(stage, stageCount(id)), progress: num(u?.progress, 0, 1, 0.3) }];
    })),
    units: units.map((u): UnitState => {
      const k = (u ?? {}) as Record<string, unknown>;
      if (k.kind === 'vacant') return { kind: 'vacant', since: num(k.since, -1e9, 1e9, 0) };
      if (k.kind === 'squatted') return { kind: 'squatted', since: num(k.since, -1e9, 1e9, 0) };
      if (k.kind === 'rented' && typeof k.service === 'string' && (SATELLITE_SERVICES as readonly string[]).includes(k.service)) return { kind: 'rented', service: k.service as SatelliteService };
      return { kind: 'trading' };
    }),
    campers: [...new Set((Array.isArray(r.campers) ? r.campers : []).map((c) => int(c, 0, 9, -1)).filter((c) => c >= 0))].slice(0, 5),
    camperPath: (CAMPER_PATH_IDS as readonly unknown[]).includes(r.camperPath) ? r.camperPath as CamperPath : undefined,
    quests: Object.fromEntries((Object.keys(QUESTS) as InstitutionId[]).map((k) => [k, int((r.quests as Record<string, unknown> | undefined)?.[k], 0, QUESTS[k].steps.length, 0)])),
    street: Object.fromEntries(STREET_KEYS.map((k) => [k, num(street[k], 0, 1, 0.5)])),
    totals: { helped: int(totals.helped, 0, 1e9, 0), nights: int(totals.nights, 0, 1e6, 0) },
    run: run && typeof run.id === 'string' && typeof run.token === 'string' && typeof run.ts === 'number'
      ? { id: run.id.slice(0, 40), ts: run.ts, token: run.token.slice(0, 128), ...(run.sandboxed === true ? { sandboxed: true as const } : {}) }
      : undefined,
    sandboxed: r.sandboxed === true || undefined,
    rev: r.more ? 2 : undefined,
    more: parseMore(r.more),
  };
}

/** Puts a checked save into a freshly started simulation. */
export function applySave(sim: Simulation, s: SaveData): void {
  sim.clockMinutes = s.clock;
  sim.calendar.dayOfYear = s.day;
  sim.calendar.year = s.year;
  const o = sim.org;
  o.budget = s.org.budget;
  o.paid = s.org.paid;
  o.volunteers = s.org.volunteers;
  o.grantIncome = s.org.grantIncome;
  // Older saves did not say: out of money below the line where the game enters it (see Organisation.tick).
  o.broke = s.more ? s.more.org.broke : o.budget < ORG.brokeBelow;
  sim.camperPath = s.camperPath ?? null;
  for (const k of Object.keys(QUESTS) as InstitutionId[]) sim.quests[k] = s.quests?.[k] ?? 0;
  o.closedDown.clear();
  for (const id of s.org.closedDown) o.closedDown.add(id);
  for (const id of SERVICE_IDS) {
    const svc = sim.services[id];
    svc.switchedOn = (s.on ?? SERVICE_IDS).includes(id);
    svc.everRun = svc.switchedOn || (s.ran ?? []).includes(id);
  }
  // The team: rebuilt from the save, then trimmed or grown to the head counts.
  const members = sim.team.members;
  members.length = 0;
  s.team.forEach((t, i) => {
    const m: Member = { id: i + 1, name: t.name, paid: t.paid, traits: t.traits, energy: t.energy, assignment: t.assignment, workingAt: null, worn: t.worn === true };
    members.push(m);
  });
  (sim.team as unknown as { nextId: number }).nextId = s.team.length + 1;
  for (const id of SERVICE_IDS) sim.upgrades[id] = { level: s.upgrades[id].stage, progress: s.upgrades[id].progress };
  sim.property.units.splice(0, sim.property.units.length, ...s.units.slice(0, sim.property.units.length));
  sim.property.campers.splice(0, sim.property.campers.length, ...s.campers);
  Object.assign(sim.neighbourhood.state, s.street);
  sim.totals.helped = s.totals.helped;
  sim.totals.nights = s.totals.nights;
  if (s.more) applyMore(sim, s.more);
  // The scene parks the first camper; a spot another camper holds is left as it is.
  loadedCamper = s.more && s.more.camper >= 0 && !s.campers.includes(s.more.camper) ? s.more.camper : null;
  if (s.sandboxed || s.run?.sandboxed) markSandboxed();
  sim.refreshAfterLoad();
}

// ------------------------------------------------------------------ links

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer()) as Uint8Array<ArrayBuffer>;
}

/**
 * A save as plain base64url JSON, at once (no compression): for the live game,
 * whose last save must go out while the page is closing, with no time to wait.
 */
export function encodeSave(s: SaveData): string {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Reads `encodeSave`'s text; null for anything that is not a valid save. */
export function decodeSave(code: string): SaveData | null {
  if (!code || code.length > 12000 || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
  try {
    return parseSave(JSON.parse(new TextDecoder().decode(fromB64url(code))));
  } catch {
    return null;
  }
}

/** Packs a save into the text after '#g=' in a link. */
export async function packSave(s: SaveData): Promise<string> {
  return b64url(await pipe(new TextEncoder().encode(JSON.stringify(s)), new CompressionStream('deflate-raw')));
}

/** Unpacks a link's save; null for anything that is not a valid save (or too big to be one). */
export async function unpackSave(code: string): Promise<SaveData | null> {
  if (!code || code.length > 12000 || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
  try {
    const bytes = await pipe(fromB64url(code), new DecompressionStream('deflate-raw'));
    if (bytes.length > 60000) return null;
    return parseSave(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
