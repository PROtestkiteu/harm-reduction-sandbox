import type { Simulation } from '../sim/simulation';
import { SERVICE_IDS, type ServiceId } from '../sim/types';
import { TRAITS, type Assignment, type Member, type TraitId } from '../sim/team';
import { SATELLITE_SERVICES, type SatelliteService, type UnitState } from '../sim/property';
import type { NeighbourhoodState } from '../sim/neighbourhood';

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
  team: { name: string; paid: boolean; traits: TraitId[]; energy: number; assignment: Assignment }[];
  upgrades: Record<string, { level: number; progress: number }>;
  units: UnitState[];
  campers: number[];
  street: Partial<NeighbourhoodState>;
  totals: { helped: number; nights: number };
  /** The leaderboard run this save belongs to, if any. */
  run?: { id: string; ts: number; token: string };
}

const num = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const int = (v: unknown, lo: number, hi: number, fallback: number) => Math.round(num(v, lo, hi, fallback));
const text = (v: unknown, max: number, fallback: string) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').slice(0, max) : fallback);
const isService = (v: unknown): v is ServiceId => typeof v === 'string' && (SERVICE_IDS as readonly string[]).includes(v);
const ASSIGN = new Set<string>(['auto', 'rest', ...SERVICE_IDS]);
const STREET_KEYS: (keyof NeighbourhoodState)[] = ['visibleUse', 'litter', 'streetMarket', 'safety', 'shopTrade', 'reputation'];

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
    team: sim.team.members.map((m) => ({ name: m.name, paid: m.paid, traits: [...m.traits], energy: Math.round(m.energy * 100) / 100, assignment: m.assignment })),
    upgrades: Object.fromEntries(SERVICE_IDS.map((id) => [id, { level: sim.upgrades[id].level, progress: Math.round(sim.upgrades[id].progress * 1000) / 1000 }])),
    units: sim.property.units.map((u) => ({ ...u })),
    campers: [...sim.property.campers],
    street,
    totals: { ...sim.totals },
    run,
  };
}

/** Checks and clamps every field of untrusted input; returns null if it is not a save at all. */
export function parseSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object' || (raw as { v?: unknown }).v !== 1) return null;
  const r = raw as Record<string, unknown>;
  const org = (r.org ?? {}) as Record<string, unknown>;
  const team = Array.isArray(r.team) ? r.team.slice(0, 40) : [];
  const units = Array.isArray(r.units) ? r.units.slice(0, 16) : [];
  const upgrades = (r.upgrades ?? {}) as Record<string, { level?: unknown; progress?: unknown }>;
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
    team: team.map((t) => {
      const m = (t ?? {}) as Record<string, unknown>;
      const traits = (Array.isArray(m.traits) ? m.traits : []).filter((x): x is TraitId => typeof x === 'string' && x in TRAITS).slice(0, 3);
      return {
        name: text(m.name, 24, 'Worker') || 'Worker',
        paid: m.paid === true,
        traits,
        energy: num(m.energy, 0, 1, 0.8),
        assignment: (typeof m.assignment === 'string' && ASSIGN.has(m.assignment) ? m.assignment : 'auto') as Assignment,
      };
    }),
    upgrades: Object.fromEntries(SERVICE_IDS.map((id) => [id, { level: int(upgrades[id]?.level, 1, 3, 1), progress: num(upgrades[id]?.progress, 0, 1, 0.3) }])),
    units: units.map((u): UnitState => {
      const k = (u ?? {}) as Record<string, unknown>;
      if (k.kind === 'vacant') return { kind: 'vacant', since: num(k.since, -1e9, 1e9, 0) };
      if (k.kind === 'rented' && typeof k.service === 'string' && (SATELLITE_SERVICES as readonly string[]).includes(k.service)) return { kind: 'rented', service: k.service as SatelliteService };
      return { kind: 'trading' };
    }),
    campers: [...new Set((Array.isArray(r.campers) ? r.campers : []).map((c) => int(c, 0, 9, -1)).filter((c) => c >= 0))].slice(0, 5),
    street: Object.fromEntries(STREET_KEYS.map((k) => [k, num(street[k], 0, 1, 0.5)])),
    totals: { helped: int(totals.helped, 0, 1e9, 0), nights: int(totals.nights, 0, 1e6, 0) },
    run: run && typeof run.id === 'string' && typeof run.token === 'string' && typeof run.ts === 'number'
      ? { id: run.id.slice(0, 40), ts: run.ts, token: run.token.slice(0, 128) }
      : undefined,
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
  o.broke = o.budget <= 0;
  o.closedDown.clear();
  for (const id of s.org.closedDown) o.closedDown.add(id);
  // The team: rebuilt from the save, then trimmed or grown to the head counts.
  const members = sim.team.members;
  members.length = 0;
  s.team.forEach((t, i) => {
    const m: Member = { id: i + 1, name: t.name, paid: t.paid, traits: t.traits, energy: t.energy, assignment: t.assignment, workingAt: null, worn: false };
    members.push(m);
  });
  (sim.team as unknown as { nextId: number }).nextId = s.team.length + 1;
  for (const id of SERVICE_IDS) sim.upgrades[id] = { ...s.upgrades[id] };
  sim.property.units.splice(0, sim.property.units.length, ...s.units.slice(0, sim.property.units.length));
  sim.property.campers.splice(0, sim.property.campers.length, ...s.campers);
  Object.assign(sim.neighbourhood.state, s.street);
  sim.totals.helped = s.totals.helped;
  sim.totals.nights = s.totals.nights;
  sim.refreshAfterLoad();
}

// ------------------------------------------------------------------ links

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer()) as Uint8Array<ArrayBuffer>;
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
