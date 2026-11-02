import { t } from '../i18n';
import { LOCATION_NAMES } from '../config/places';
import type { Simulation } from '../sim/simulation';
import { LOCATION_IDS, serviceAt, type LocationId } from '../sim/types';
import type { PersonRole } from '../agents/crowd';
import { cityBuilding } from '../world/cityBuildings';
import { CAMPER_SPOTS } from '../world/layout';
import type { World } from '../world/scene';
import type { GroundMark } from '../world/mapOverlays';
import type { LegendRow, OverlayKind } from '../ui/mapLayers';
import { displayName } from '../ui/names';
import { QUESTS, type InstitutionId } from '../config/institutionQuests';
import { CRIME_SITES } from '../config/flavour/crime';
import { SATELLITE_NAME } from '../sim/property';

/**
 * What each map overlay shows, read from the simulation and the world: the
 * ground marks and the legend's lines. Pure: changes nothing. "Who is where"
 * moves with the people every frame, so only its legend comes from here; its
 * dots are placed by the caller from the crowd.
 */

const GOOD = 0x5fbf7a;
const BUSY = 0xe0a030;
const OVER = 0xe0503c;
const SHUT = 0x8a8278;

/** Colours of the people on the map, by what they are out for. */
export const ROLE_COLOUR: Partial<Record<PersonRole, number>> = {
  visitor: 0x3cc8c8,
  clubgoer: 0xb070e0,
  resident: 0x7fc070,
  police: 0x4a7aff,
  staff: 0xedb300,
  passerby: 0xb8b0a0,
  seller: 0xe06a3a,
  sleeper: 0x9a7a5a,
};
export const OTHER_COLOUR = 0x6a645c;
const ROLE_LABEL: Partial<Record<PersonRole, string>> = {
  visitor: t('Coming to your services'),
  clubgoer: t('Out at the club'),
  resident: t('Residents'),
  police: t('Police'),
  staff: t('Your staff'),
  passerby: t('Passers-by'),
  seller: t('Selling drugs'),
  sleeper: t('Sleeping rough'),
};

/** How far each service reaches, in metres: ILLUSTRATIVE, for the Reach overlay only. */
const REACH: Record<LocationId, number> = { dropIn: 14, outreach: 16, club: 10, footPatrol: 24, drugChecking: 10, shelter: 12, clinic: 12 };
const REACH_COLOUR: Record<LocationId, number> = { dropIn: 0xedb300, outreach: 0x3cc8c8, club: 0xb070e0, footPatrol: 0x7fc070, drugChecking: 0x4a9aff, shelter: 0xe08a5a, clinic: 0xe06a8a };

const name = (id: LocationId) => displayName('location', id, LOCATION_NAMES[id]);
const pct = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100);
/** A strain meter's colour: calm, stretched, overwhelmed. */
const strain = (v: number) => (v >= 0.7 ? OVER : v >= 0.4 ? BUSY : GOOD);
const MINE = 0xedb300;
const POLICE = 0x4a7aff;

/** The middle of a building of the city, if it is drawn. */
function centre(id: number): { x: number; z: number } | undefined {
  const b = cityBuilding(id);
  return b ? { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 } : undefined;
}

/**
 * Marks on a building of the city: a disc on the ground around it, and a ring
 * just over its roof, out past the corners. The ring shows where the ground is
 * hidden (behind the blocks in front, or under the outskirts' land).
 */
function overBuilding(marks: GroundMark[], id: number, color: number, alpha: number, pad = 2): boolean {
  const b = cityBuilding(id);
  if (!b) return false;
  const x = (b.x0 + b.x1) / 2;
  const z = (b.z0 + b.z1) / 2;
  const half = Math.hypot(b.x1 - b.x0, b.z1 - b.z0) / 2;
  marks.push({ x, z, r: half + pad, color, alpha });
  marks.push({ x, z, r: half + 0.6, color, alpha: 0.9, ring: true, y: b.height + 0.4 });
  return true;
}

const INSTITUTION: Record<InstitutionId, string> = { police: t('Police station'), hospital: t('Public hospital'), sobering: t('Sobering-up centre'), cityHall: t('City hall') };

export interface OverlayView {
  marks: GroundMark[];
  legend: LegendRow[];
}

/** Ground marks and legend for `kind`; `people` counts by role feed the Who is where legend. */
export function overlayView(kind: OverlayKind, sim: Simulation, world: World, extra: { daemon: { x: number; z: number } | null; people: Map<PersonRole, number>; policeWhy: string | null }): OverlayView {
  const marks: GroundMark[] = [];
  const legend: LegendRow[] = [];
  if (kind === 'load') {
    for (const id of LOCATION_IDS) {
      const s = sim.services[serviceAt(id)];
      const f = world.locations[id].footprint;
      const open = s.status === 'open';
      const queue = s.queue.length;
      const room = Math.max(1, s.waitingRoom);
      const load = open ? Math.max(queue / room, s.inService.size / Math.max(1, s.capacity) * 0.8, s.turnedBack > 0 ? 0.6 : 0) : 0;
      const color = !open ? SHUT : load >= 0.85 ? OVER : load >= 0.5 ? BUSY : GOOD;
      marks.push({ x: f.x, z: f.z, r: Math.max(f.rx, f.rz) + 2.5, color, alpha: open ? 0.28 + 0.25 * Math.min(1, load) : 0.18 });
      marks.push({ x: f.x, z: f.z, r: Math.max(f.rx, f.rz) + 2.5, color, alpha: 0.85, ring: true });
      legend.push({ color, text: open
        ? t('{name}: {queue} of {room} waiting, {inside} inside, {back} turned back', { name: name(id), queue, room, inside: s.inService.size, back: s.turnedBack })
        : t('{name}: closed', { name: name(id) }), minor: !open });
    }
  } else if (kind === 'people') {
    const order = Object.keys(ROLE_COLOUR) as PersonRole[];
    let others = 0;
    for (const [role, n] of extra.people) if (!ROLE_COLOUR[role]) others += n;
    for (const role of order) {
      const n = extra.people.get(role) ?? 0;
      if (n) legend.push({ color: ROLE_COLOUR[role], text: `${ROLE_LABEL[role]}: ${n}` });
    }
    if (others) legend.push({ color: OTHER_COLOUR, text: t('Others: {n}', { n: others }) });
  } else if (kind === 'street') {
    const street = sim.growth.street;
    const camp = (id: number, size: number) => {
      const b = cityBuilding(id);
      if (!b || size <= 0.02) return;
      marks.push({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, r: 5 + 9 * size, color: OVER, alpha: 0.12 + 0.35 * size });
    };
    camp(world.camps.park, sim.camp.size);
    camp(world.camps.station, sim.camp.station);
    const squats = [...(world.squat === null ? [] : [world.squat]), ...sim.property.squats.map((i) => world.shopUnits[i])];
    for (const id of squats) {
      const b = cityBuilding(id);
      if (b) marks.push({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, r: 4 + 5 * sim.camp.squat, color: BUSY, alpha: 0.2 + 0.3 * sim.camp.squat });
    }
    // The boarded fronts of a spiralling street, as the chaos pack draws them.
    const chaos = world.scene.getObjectByName('chaos')?.userData.fronts as readonly { x: number; z: number }[] | undefined;
    if (chaos && street > 0.15) for (const f of chaos) marks.push({ x: f.x, z: f.z, r: 3, color: OVER, alpha: 0.15 + 0.35 * street });
    if (extra.daemon) marks.push({ x: extra.daemon.x, z: extra.daemon.z, r: 4.5, color: OVER, alpha: 0.9, ring: true });
    legend.push(
      { text: t('Street scene: {pct}%. The district: {size} times the first night.', { pct: Math.round(street * 100), size: sim.growth.size.toFixed(1) }) },
      { color: OVER, text: t('Tent camps: park {park}%, station {station}%', { park: Math.round(sim.camp.size * 100), station: Math.round(sim.camp.station * 100) }) },
      { color: BUSY, text: t('Squats: {n}, {pct}% full', { n: squats.length, pct: Math.round(sim.camp.squat * 100) }) },
      ...(extra.daemon ? [{ color: OVER, ring: true, text: t('Someone in acute crisis') }] : []),
    );
  } else if (kind === 'reach') {
    for (const id of LOCATION_IDS) {
      const s = sim.services[serviceAt(id)];
      if (s.status !== 'open') continue;
      const f = world.locations[id].footprint;
      const at = [{ x: f.x, z: f.z }];
      if (id === 'outreach') for (const i of sim.property.extraCampers ? sim.property.campers : []) { const c = CAMPER_SPOTS[i]; if (c) at.push({ x: c.x, z: c.z }); }
      for (const p of at) {
        marks.push({ x: p.x, z: p.z, r: REACH[id], color: REACH_COLOUR[id], alpha: 0.1 });
        marks.push({ x: p.x, z: p.z, r: REACH[id], color: REACH_COLOUR[id], alpha: 0.8, ring: true });
      }
      legend.push({ color: REACH_COLOUR[id], ring: true, text: name(id) });
    }
    legend.push({ text: legend.length ? t('Rings are illustrative: how far each open service reaches people.') : t('No service is open now.') });
  } else if (kind === 'police') {
    // The station, every officer out (dots, placed by the caller), and your doors they stand at or keep clear of.
    const s = sim.cityStress.police;
    overBuilding(marks, world.landmarks.police, strain(s), 0.2 + 0.3 * s, 3);
    const style = sim.context.patrolStyle;
    const posted = sim.context.patrol > 0 && style === 'posted';
    for (const id of LOCATION_IDS) {
      if (sim.services[serviceAt(id)].status !== 'open') continue;
      const f = world.locations[id].footprint;
      marks.push({ x: f.x, z: f.z, r: Math.max(f.rx, f.rz) + 3, color: posted ? OVER : GOOD, alpha: 0.75, ring: true });
    }
    const steps = QUESTS.police.steps.length;
    legend.push(
      { color: POLICE, text: t('Officers out: {n}', { n: extra.people.get('police') ?? 0 }) },
      { color: strain(s), text: t('Police station: {pct}% stretched', { pct: pct(s) }), at: centre(world.landmarks.police) },
      { color: posted ? OVER : GOOD, ring: true, text: posted ? t('Your open doors: officers posted at them') : t('Your open doors: no officers posted') },
      ...(extra.policeWhy ? [{ text: extra.policeWhy }] : []),
      { text: t('Police agreement: {done} of {steps} steps done', { done: sim.quests.police, steps }) },
    );
  } else if (kind === 'city') {
    // The city's own services your work takes the load off, and how far each side quest has come.
    const load: Record<InstitutionId, number | null> = { police: sim.cityStress.police, hospital: sim.cityStress.medics, sobering: sim.cityStress.sobering, cityHall: null };
    for (const id of Object.keys(INSTITUTION) as InstitutionId[]) {
      const v = load[id];
      const color = v === null ? MINE : strain(v);
      overBuilding(marks, world.landmarks[id], color, v === null ? 0.25 : 0.2 + 0.3 * v, 3);
      const steps = QUESTS[id].steps.length;
      const quest = t('{done} of {steps} steps', { done: sim.quests[id], steps });
      legend.push({ color, at: centre(world.landmarks[id]), text: v === null
        ? t('{name}: {quest}', { name: INSTITUTION[id], quest })
        : t('{name}: {pct}% stretched, {quest}', { name: INSTITUTION[id], pct: pct(v), quest }) });
    }
    legend.push({ text: t('People turned away end up here. Side quests are done in each building.') });
  } else if (kind === 'shops') {
    // The shop units you can rent, the corner shops the thieves work, and your points in ordinary buildings.
    const now = sim.org.now;
    const tally = { trading: 0, vacant: 0, squatted: 0, rented: 0 };
    sim.property.units.forEach((u, i) => {
      const id = world.shopUnits[i];
      if (id === undefined) return;
      tally[u.kind]++;
      const color = u.kind === 'trading' ? GOOD : u.kind === 'vacant' ? SHUT : u.kind === 'squatted' ? OVER : MINE;
      overBuilding(marks, id, color, 0.3, 1.5);
    });
    let guarded = 0;
    let shut = 0;
    CRIME_SITES.shoplifting.forEach((site, i) => {
      const isShut = sim.petty.shut(i, now);
      const isGuarded = !isShut && sim.petty.guarded(i, now);
      if (isShut) shut++;
      if (isGuarded) guarded++;
      const hot = Math.min(1, sim.petty.hits[i] / 4);
      marks.push({ x: site.at.x, z: site.at.z, r: 3 + 2 * hot, color: isShut ? OVER : isGuarded || hot > 0.4 ? BUSY : GOOD, alpha: 0.25 + 0.3 * hot });
      marks.push({ x: site.at.x, z: site.at.z, r: 3 + 2 * hot, color: isShut ? OVER : isGuarded || hot > 0.4 ? BUSY : GOOD, alpha: 0.85, ring: true });
    });
    for (const q of sim.property.points) overBuilding(marks, q.building, MINE, 0.35, 1.5);
    const c = sim.petty.counts;
    legend.push(
      { text: t('Shop trade: {pct}%. Street safety: {safe}%.', { pct: pct(sim.neighbourhood.state.shopTrade), safe: pct(sim.neighbourhood.state.safety) }) },
      { color: GOOD, text: t('Shop units trading: {n}', { n: tally.trading }) },
      { color: SHUT, text: t('Empty, to rent: {n}', { n: tally.vacant }) },
      { color: OVER, text: t('Squatted: {n}', { n: tally.squatted }) },
      { color: MINE, text: t('Yours: {n} rented, {points} points', { n: tally.rented, points: sim.property.points.length }) },
      { color: BUSY, ring: true, text: t('Corner shops: {guarded} with a guard, {shut} shut early', { guarded, shut }) },
      { text: t('Thefts so far: {pick} pickpocketing, {shop} shoplifting, {caught} caught', { pick: c.pickpocket, shop: c.shoplifting, caught: sim.petty.caught }) },
    );
  } else if (kind === 'staff') {
    // Every place you run, its satellites and extra campers: who is on shift against who is needed.
    let short = 0;
    for (const id of LOCATION_IDS) {
      const s = sim.services[serviceAt(id)];
      const f = world.locations[id].footprint;
      const open = s.status === 'open';
      const need = Math.max(1, s.params.staff);
      const have = s.staffOnSite;
      const color = !open ? SHUT : have >= need ? GOOD : have >= need / 2 ? BUSY : OVER;
      if (open && have < need) short++;
      marks.push({ x: f.x, z: f.z, r: Math.max(f.rx, f.rz) + 2, color, alpha: open ? 0.35 : 0.15 });
      marks.push({ x: f.x, z: f.z, r: Math.max(f.rx, f.rz) + 2, color, alpha: 0.85, ring: true });
      if (id === 'outreach' && open) for (const i of sim.property.campers) { const c = CAMPER_SPOTS[i]; if (c) marks.push({ x: c.x, z: c.z, r: 4, color, alpha: 0.85, ring: true }); }
      legend.push({ color, minor: !open, at: open ? { x: f.x, z: f.z } : undefined, text: open
        ? t('{name}: {have} of {need} on shift', { name: name(id), have, need })
        : t('{name}: closed', { name: name(id) }) });
    }
    sim.property.units.forEach((u, i) => { if (u.kind === 'rented' && world.shopUnits[i] !== undefined) overBuilding(marks, world.shopUnits[i], MINE, 0.3, 1.5); });
    for (const q of sim.property.points) overBuilding(marks, q.building, MINE, 0.3, 1.5);
    const sats = sim.property.points.length + sim.property.units.filter((u) => u.kind === 'rented').length;
    if (sats) legend.push({ color: MINE, text: t('Satellites ({kinds}): {n}, staffed by their main service', { n: sats, kinds: [...new Set([...sim.property.points.map((q) => q.service), ...sim.property.units.flatMap((u) => (u.kind === 'rented' ? [u.service] : []))])].map((k) => SATELLITE_NAME[k]).join(', ') }) });
    legend.unshift({ text: short ? t('Open places short of staff: {n}.', { n: short }) : t('Every open place has its people.') });
  }
  return { marks, legend };
}
