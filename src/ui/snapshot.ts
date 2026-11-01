import { price } from './money';
import { t } from '../i18n';
import { ACTIVITY, SERVICE_ACTIVITIES } from '../config/serviceMix';
import { ORG } from '../config/organisation';
import { displayName } from './names';
import { CAMPER_SPOTS } from '../world/scene';
import { EXPOSURE, aidSeason } from '../sim/exposure';
import { HUSTLE } from '../config/hustles';
import { FAVOURS, type FavourId } from '../config/favours';
import { camperSpot } from '../world/layout';
import { DONATION_PER_STAFF_HOUR, INVEST } from '../sim/simulation';
import { PROPERTY } from '../sim/property';
import { LOCATION_NAMES, SERVICE_TEXT } from '../config/places';
import { PARAM_BY_ID, type ParamId } from '../config/sandboxParams';
import { formatClock, pastMidnight } from '../sim/clock';
import { formatDate } from '../sim/calendar';
import type { ClosedReason, ServiceModel, Simulation } from '../sim/simulation';
import { LOCATION_IDS, SERVICE_IDS, serviceAt, type LocationId, type ServiceId } from '../sim/types';
import type { HudSnapshot, LocationSnapshot, PlaceLevers } from './hud';

/** Builds the HUD's view of the simulation. Pure: reads state, changes nothing. */

const CLOSED_TEXT: Record<ClosedReason, string> = {
  switchedOff: t('Switched off'),
  hours: t('Opening hours over (funding or council)'),
  notPermitted: t('Not permitted (law, council or venue)'),
  outOfService: t('Out of action (event)'),
  noStaff: t('No staff available (recruit or find volunteers)'),
  closedDown: t('Closed down: the money ran out for too long (relaunch it from Your organisation)'),
};

/** Context facts shared by every service: why it is closed, and who turned back. */
function contextFacts(s: ServiceModel): [string, string][] {
  const rows: [string, string][] = [[t('Turned back'), t('{n} set out but turned back before arriving', { n: s.turnedBack })]];
  if (s.closedReason) rows.unshift([t('Closed because'), CLOSED_TEXT[s.closedReason]]);
  return rows;
}

function serviceSnapshot(id: LocationId, s: ServiceModel, sim?: Simulation): LocationSnapshot {
  const text = SERVICE_TEXT[s.id];
  return {
    name: displayName('location', id, LOCATION_NAMES[id]),
    service: text.label,
    status: s.status,
    facts: [
      [t('Capacity'), t('{n} at a time, {waiting} waiting places', { n: s.capacity, waiting: s.params.waitingSlots })],
      [t('Current visitors'), t('{n} {where}, {waiting} waiting', { n: s.inService.size, where: text.servedAt, waiting: s.queue.length })],
      [t('Staff on site'), t('{n} of {max}', { n: s.staffOnSite, max: s.params.staff })],
      ...contextFacts(s),
    ],
    metrics: { ...s.metrics },
    metricsLabel: t('Tonight so far'),
    blockedByLaw: s.closedReason === 'notPermitted',
    level: sim && { level: sim.upgrades[s.id].level, progress: sim.upgrades[s.id].progress, max: INVEST.maxLevel },
    actions: sim && {
      service: s.id,
      wanted: s.params.staff,
      staffMax: PARAM_BY_ID[`${s.id}.staff` as ParamId]?.max ?? 6,
      waiting: s.params.waitingSlots,
      waitingMax: PARAM_BY_ID[`${s.id}.waiting` as ParamId]?.max ?? 10,
      closedDown: sim.org.closedDown.has(s.id),
      reopening: sim.org.reopening.some((r) => r.id === s.id),
      budget: sim.org.budget,
      closedReason: s.closedReason,
      donations: { on: sim.donations.has(s.id), each: DONATION_PER_STAFF_HOUR, staff: s.status === 'open' ? s.staffOnSite : 0 },
      invest: { cost: INVEST.cost, level: sim.upgrades[s.id].level, progress: sim.upgrades[s.id].progress, max: INVEST.maxLevel },
      mix: mixLevers(sim, s.id),
      hustle: s.id === 'clubHr'
        ? {
          on: sim.clubContract,
          label: sim.clubContract ? t('Club pays +{price}/h', { price: price(HUSTLE.clubFeePerHour) }) : t('Ask the club to pay'),
          hint: sim.clubContract ? t('The club pays while the stand is open. Click to end the deal.') : t('The club pays {price} an hour while the stand is open, if it agrees.', { price: price(HUSTLE.clubFeePerHour) }),
        }
        : s.id === 'drugChecking'
          ? {
            on: sim.commercialChecking,
            label: sim.commercialChecking ? t('Checks sold {price}: make free', { price: price(HUSTLE.checkFee) }) : t('Sell checks {price}', { price: price(HUSTLE.checkFee) }),
            hint: t('Paid checks: a little money, but fewer people come and fewer results reach the early warning.'),
          }
          : undefined,
      campers: s.id === 'outreach' ? {
        out: sim.property.extraCampers,
        max: PROPERTY.maxExtraCampers,
        cost: PROPERTY.camperCost,
        perHour: PROPERTY.camperPerHour,
        moving: sim.outreachMoving,
        spots: CAMPER_SPOTS.map((spot, i) => ({ name: spot.name, taken: sim.property.campers.includes(i), here: i === camperSpot() })),
      } : undefined,
    },
  };
}

function clubSnapshot(sim: Simulation): LocationSnapshot {
  const c = sim.club;
  const stand = sim.services.clubHr;
  const club = serviceSnapshot('club', stand, sim);
  club.facts = [
    [t('Venue'), t('Open, {n} of {max} inside, {queue} queuing', { n: c.inside, max: c.capacity, queue: c.queue.length })],
    [t('Stand capacity'), t('{n} at a time', { n: stand.capacity })],
    [t('At the stand'), t('{n} talking, {waiting} waiting', { n: stand.inService.size, waiting: stand.queue.length })],
    [t('Staff on site'), t('{n} of {max}', { n: stand.staffOnSite, max: stand.params.staff })],
    [t('Door (venue)'), t('{n} let in, {adverse} adverse (placeholder)', { n: c.entered, adverse: c.adverse })],
    ...contextFacts(stand),
  ];
  club.metricsLabel = t('Stand, tonight so far');
  return club;
}

/** A place's budget mix for the side menu: sliders, shares, locks and the visit cost it comes to. */
function mixLevers(sim: Simulation, id: ServiceId): PlaceLevers['mix'] {
  const allowed = sim.context.checkingAllowed;
  const shares = sim.mix.shares(id, allowed);
  return {
    visitCost: (ORG.visitCost[id] ?? 0) * sim.mix.factors(id, allowed).cost,
    items: SERVICE_ACTIVITIES[id].map((a) => ({
      id: a,
      label: ACTIVITY[a].label,
      does: ACTIVITY[a].does,
      weight: sim.mix.weight(id, a),
      share: shares[a] ?? 0,
      lock: sim.mix.lock(id, a, allowed),
      setupCost: ACTIVITY[a].setup ?? 0,
    })),
  };
}

export function buildSnapshot(sim: Simulation, people: number): HudSnapshot {
  const locations = {} as Record<LocationId, LocationSnapshot>;
  for (const id of LOCATION_IDS) locations[id] = id === 'club' ? clubSnapshot(sim) : serviceSnapshot(id, sim.services[serviceAt(id)], sim);
  const enabled = {} as Record<ServiceId, boolean>;
  // Switches show what the person chose; context may still keep a service closed.
  for (const id of SERVICE_IDS) enabled[id] = sim.services[id].switchedOn;
  // The date turns at midnight, though the simulation's day runs from evening to evening.
  const date = pastMidnight(sim.clockMinutes) ? sim.calendar.dateAfter(1) : sim.calendar.date;
  // This season's aid for people outdoors: the warming bus in winter or on a cold night, water and shade in summer.
  const coldNight = sim.events.isActive('coldNight');
  const aidKind: 'cold' | 'heat' | null = aidSeason('cold', sim.season, coldNight) ? 'cold' : aidSeason('heat', sim.season, coldNight) ? 'heat' : null;
  const aid = aidKind && {
    kind: aidKind,
    on: aidKind === 'cold' ? sim.warmingBus : sim.coolingPoint,
    perHour: aidKind === 'cold' ? EXPOSURE.warmingBusPerHour : EXPOSURE.coolingPointPerHour,
  };
  return { clock: `${formatDate(date)} · ${formatClock(sim.clockMinutes)}`, clockMinutes: sim.clockMinutes, people, enabled, locations, money: { budget: sim.org.budget, perHour: sim.org.netPerHour }, aid: aid || undefined, unmet: { day: sim.unmet24, crisis: sim.crisis },
    stress: { police: sim.cityStress.police, medics: sim.cityStress.medics, sobering: sim.cityStress.sobering, district: sim.vitality.level },
    favours: { held: sim.favours, owed: sim.concessionAt !== null, items: (Object.keys(FAVOURS) as FavourId[]).map((id) => ({ id, label: FAVOURS[id].label })) },
    drive: { until: sim.driveUntil === null ? null : formatClock(sim.org.clockAt(sim.driveUntil, sim.clockMinutes)), cost: HUSTLE.driveCost, hours: HUSTLE.driveHours } };
}
