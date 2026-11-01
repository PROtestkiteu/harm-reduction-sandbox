import { LOCATION_NAMES, SERVICE_TEXT } from '../config/places';
import { PARAM_BY_ID, type ParamId } from '../config/sandboxParams';
import { formatClock, pastMidnight } from '../sim/clock';
import { formatDate } from '../sim/calendar';
import type { ClosedReason, ServiceModel, Simulation } from '../sim/simulation';
import { LOCATION_IDS, SERVICE_IDS, serviceAt, type LocationId, type ServiceId } from '../sim/types';
import type { HudSnapshot, LocationSnapshot } from './hud';

/** Builds the HUD's view of the simulation. Pure: reads state, changes nothing. */

const CLOSED_TEXT: Record<ClosedReason, string> = {
  switchedOff: 'Switched off',
  hours: 'Opening hours over (funding or council)',
  notPermitted: 'Not permitted (law, council or venue)',
  outOfService: 'Out of action (event)',
  noStaff: 'No staff available (recruit or find volunteers)',
  closedDown: 'Closed down: the money ran out for too long (relaunch it from Your organisation)',
};

/** Context facts shared by every service: why it is closed, and who turned back. */
function contextFacts(s: ServiceModel): [string, string][] {
  const rows: [string, string][] = [['Turned back', `${s.turnedBack} set out but turned back before arriving`]];
  if (s.closedReason) rows.unshift(['Closed because', CLOSED_TEXT[s.closedReason]]);
  return rows;
}

function serviceSnapshot(id: LocationId, s: ServiceModel, sim?: Simulation): LocationSnapshot {
  const text = SERVICE_TEXT[s.id];
  return {
    name: LOCATION_NAMES[id],
    service: text.label,
    status: s.status,
    facts: [
      ['Capacity', `${s.capacity} at a time, ${s.params.waitingSlots} waiting places`],
      ['Current visitors', `${s.inService.size} ${text.servedAt}, ${s.queue.length} waiting`],
      ['Staff on site', `${s.staffOnSite} of ${s.params.staff}`],
      ...contextFacts(s),
    ],
    metrics: { ...s.metrics },
    metricsLabel: 'Tonight so far',
    actions: sim && {
      service: s.id,
      wanted: s.params.staff,
      staffMax: PARAM_BY_ID[`${s.id}.staff` as ParamId]?.max ?? 6,
      waiting: s.params.waitingSlots,
      waitingMax: PARAM_BY_ID[`${s.id}.waiting` as ParamId]?.max ?? 10,
      closedDown: sim.org.closedDown.has(s.id),
      reopening: sim.org.reopening.some((r) => r.id === s.id),
      budget: sim.org.budget,
    },
  };
}

function clubSnapshot(sim: Simulation): LocationSnapshot {
  const c = sim.club;
  const stand = sim.services.clubHr;
  const club = serviceSnapshot('club', stand, sim);
  club.facts = [
    ['Venue', `Open, ${c.inside} of ${c.capacity} inside, ${c.queue.length} queuing`],
    ['Stand capacity', `${stand.capacity} at a time`],
    ['At the stand', `${stand.inService.size} talking, ${stand.queue.length} waiting`],
    ['Staff on site', `${stand.staffOnSite} of ${stand.params.staff}`],
    ['Door (venue)', `${c.entered} let in, ${c.adverse} adverse (placeholder)`],
    ...contextFacts(stand),
  ];
  club.metricsLabel = 'Stand, tonight so far';
  return club;
}

export function buildSnapshot(sim: Simulation, people: number): HudSnapshot {
  const locations = {} as Record<LocationId, LocationSnapshot>;
  for (const id of LOCATION_IDS) locations[id] = id === 'club' ? clubSnapshot(sim) : serviceSnapshot(id, sim.services[serviceAt(id)], sim);
  const enabled = {} as Record<ServiceId, boolean>;
  // Switches show what the person chose; context may still keep a service closed.
  for (const id of SERVICE_IDS) enabled[id] = sim.services[id].switchedOn;
  // The date turns at midnight, though the simulation's day runs from evening to evening.
  const date = pastMidnight(sim.clockMinutes) ? sim.calendar.dateAfter(1) : sim.calendar.date;
  return { clock: `${formatDate(date)} · ${formatClock(sim.clockMinutes)}`, clockMinutes: sim.clockMinutes, people, enabled, locations };
}
