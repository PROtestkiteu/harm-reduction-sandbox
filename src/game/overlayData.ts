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

export interface OverlayView {
  marks: GroundMark[];
  legend: LegendRow[];
}

/** Ground marks and legend for `kind`; `people` counts by role feed the Who is where legend. */
export function overlayView(kind: OverlayKind, sim: Simulation, world: World, extra: { daemon: { x: number; z: number } | null; people: Map<PersonRole, number> }): OverlayView {
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
  }
  return { marks, legend };
}
