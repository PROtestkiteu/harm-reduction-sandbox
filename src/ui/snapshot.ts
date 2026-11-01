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

/** Why a place is closed, when it is: the one fact worth a sentence. */
function contextFacts(s: ServiceModel): [string, string][] {
  return s.closedReason ? [[t('Closed because'), CLOSED_TEXT[s.closedReason]]] : [];
}

type Chip = LocationSnapshot['chips'][number];
/** Who is being helped, who waits, staff on site, and who turned back: as icon chips. */
function serviceChips(s: ServiceModel, servedAt: string): Chip[] {
  return [
    { icon: 'inside', value: `${s.inService.size}/${s.capacity}`, label: t('{n} {where}, {cap} at a time', { n: s.inService.size, where: servedAt, cap: s.capacity }) },
    { icon: 'queue', value: `${s.queue.length}/${s.params.waitingSlots}`, label: t('{n} waiting, {waiting} waiting places', { n: s.queue.length, waiting: s.params.waitingSlots }) },
    { icon: 'staff', value: `${s.staffOnSite}/${s.params.staff}`, label: t('Staff on site: {n} of {max}', { n: s.staffOnSite, max: s.params.staff }) },
    { icon: 'back', value: String(s.turnedBack), label: t('{n} set out but turned back before arriving', { n: s.turnedBack }) },
  ];
}

function serviceSnapshot(id: LocationId, s: ServiceModel, sim?: Simulation): LocationSnapshot {
  const text = SERVICE_TEXT[s.id];
  return {
    name: displayName('location', id, LOCATION_NAMES[id]),
    service: text.label,
    status: s.status,
    chips: serviceChips(s, text.servedAt),
    facts: contextFacts(s),
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
  club.chips = [
    { icon: 'venue', value: `${c.inside}/${c.capacity}`, label: t('Venue: open, {n} of {max} inside, {queue} queuing', { n: c.inside, max: c.capacity, queue: c.queue.length }) },
    { icon: 'door', value: String(c.entered), label: t('Door (venue): {n} let in, {adverse} adverse (placeholder)', { n: c.entered, adverse: c.adverse }) },
    ...serviceChips(stand, SERVICE_TEXT.clubHr.servedAt),
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
