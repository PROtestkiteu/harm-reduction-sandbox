import { price } from './money';
import { t } from '../i18n';
import { ACTIVITY, SERVICE_ACTIVITIES } from '../config/serviceMix';
import { ORG } from '../config/organisation';
import { displayName } from './names';
import { CAMPER_SPOTS } from '../world/scene';
import { EXPOSURE, aidSeason } from '../sim/exposure';
import { HUSTLE } from '../config/hustles';
import { camperSpot } from '../world/layout';
import { INVEST } from '../sim/simulation';
import { stageCount, stageOf } from '../config/serviceStages';
import { PROPERTY } from '../sim/property';
import { LOCATION_NAMES, SERVICE_TEXT } from '../config/places';
import { PARAM_BY_ID, type ParamId } from '../config/sandboxParams';
import { formatClock, pastMidnight } from '../sim/clock';
import { formatDate } from '../sim/calendar';
import type { ServiceModel, Simulation } from '../sim/simulation';
import { LOCATION_IDS, SERVICE_IDS, serviceAt, type LocationId, type ServiceId } from '../sim/types';
import type { HudSnapshot, LocationSnapshot, PlaceLevers } from './hud';

/** Builds the HUD's view of the simulation. Pure: reads state, changes nothing. */


/**
 * Closed, said in two words: for now (it opens again by itself) or for good
 * (until the player switches it on, relaunches it or the law changes).
 */
function closedNote(s: ServiceModel): LocationSnapshot['closed'] {
  if (s.status !== 'closed' || !s.closedReason) return undefined;
  switch (s.closedReason) {
    case 'hours': return { text: s.id === 'clubHr' ? t('Closed till evening') : t('Closed till morning'), lasting: false };
    case 'noStaff':
    case 'outOfService': return { text: t('Closed for now'), lasting: false };
    // Switched off is the player's own choice and shows on the card's Open up reply: nothing to say.
    case 'switchedOff': return { text: t('Switched off'), lasting: true, ownChoice: true };
    case 'closedDown': return { text: t('Shut down'), lasting: true };
    case 'notPermitted': return { text: t('Not permitted'), lasting: true };
    // The foot patrol walked off to a spot (sim/patrol.ts): back at its table in a few hours.
    case 'onPatrol': return { text: t('Out on patrol'), lasting: false };
  }
}


type Chip = LocationSnapshot['chips'][number];
/** Who is being helped, who waits, staff on site, and who turned back: as icon chips. */
function serviceChips(s: ServiceModel, servedAt: string): Chip[] {
  return [
    { icon: 'inside', value: `${s.inService.size}/${s.capacity}`, label: t('{n} {where}, {cap} at a time', { n: s.inService.size, where: servedAt, cap: s.capacity }) },
    { icon: 'queue', value: `${s.queue.length}/${s.waitingRoom}`, label: t('{n} waiting, {waiting} waiting places', { n: s.queue.length, waiting: s.waitingRoom }) },
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
    closed: closedNote(s),
    chips: serviceChips(s, text.servedAt),
    // The stage it has grown to, of how many, as the first fact.
    // Why it is closed is said once, under the name; the facts keep the stage.
    facts: sim ? [[t('Stage'), t('{stage} ({n} of {max})', { stage: stageOf(s.id, sim.upgrades[s.id].level).label, n: sim.upgrades[s.id].level, max: stageCount(s.id) })]] : [],
    metrics: { ...s.metrics },
    metricsLabel: t('Tonight so far'),
    blockedByLaw: s.closedReason === 'notPermitted',
    level: sim && { level: sim.upgrades[s.id].level, progress: sim.upgrades[s.id].progress, max: stageCount(s.id) },
    actions: sim && {
      service: s.id,
      wanted: s.params.staff,
      staffMax: PARAM_BY_ID[`${s.id}.staff` as ParamId]?.max ?? 6,
      closedDown: sim.org.closedDown.has(s.id),
      reopening: sim.org.reopening.some((r) => r.id === s.id),
      budget: sim.org.budget,
      closedReason: s.closedReason,
      invest: { cost: INVEST.cost, level: sim.upgrades[s.id].level, progress: sim.upgrades[s.id].progress, max: stageCount(s.id), stage: stageOf(s.id, sim.upgrades[s.id].level).label, next: sim.upgrades[s.id].level < stageCount(s.id) ? stageOf(s.id, sim.upgrades[s.id].level + 1) : null },
      mix: mixLevers(sim, s.id),
      hustle: s.id === 'clubHr'
        ? sim.clubContract
          ? { on: true, enabled: true, short: t('End the club deal.'), label: t('Club pays +{price}/h', { price: price(HUSTLE.clubFeePerHour) }), hint: t('The club pays while the stand is open. Click to end the deal.') }
          : sim.org.now < sim.clubAskAgainAt
            ? { on: false, enabled: false, short: t('Club refused: ask later ({chance}%).', { chance: Math.round(sim.clubAcceptChance * 100) }), label: t('The club said no: ask again later ({chance}% yes)', { chance: Math.round(sim.clubAcceptChance * 100) }), hint: t('The club turned the stand down for now. It can be asked again in a few hours.') }
            : { on: false, enabled: true, short: t('Ask the club to pay ({chance}%).', { chance: Math.round(sim.clubAcceptChance * 100) }), label: t('Ask the club to pay ({chance}% yes)', { chance: Math.round(sim.clubAcceptChance * 100) }), hint: t('The club may say no. If it agrees, it pays {price} an hour while the stand is open. Fewer say yes while the street is in crisis.', { price: price(HUSTLE.clubFeePerHour) }) }
        // Charging only makes sense where there are lab checks to charge for.
        : s.id === 'drugChecking' && sim.context.checkingAllowed
          ? {
            on: sim.commercialChecking,
            enabled: true,
            short: sim.commercialChecking ? t('Make checks free.') : t('Charge for checks.'),
            label: sim.commercialChecking ? t('Checking charged {price}: make it free', { price: price(HUSTLE.checkFee) }) : t('Charge {price} for checking', { price: price(HUSTLE.checkFee) }),
            hint: t('Charging for drug checking: a little money, but fewer people come and fewer results reach the early warning.'),
          }
          : undefined,
      path: s.id === 'outreach' ? { current: sim.camperPath } : undefined,
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
    favours: sim.favourView };
}

/** A donation drive, for the organisation sheet: running until a time, resting until one, or ready. */
export interface DriveView { until: string | null; again: string | null; cost: number; hours: number; min: number; max: number }
export function driveView(sim: Simulation): DriveView {
  return {
    until: sim.driveUntil === null ? null : formatClock(sim.org.clockAt(sim.driveUntil, sim.clockMinutes)),
    again: sim.driveUntil === null && sim.org.now < sim.driveAgainAt ? formatClock(sim.org.clockAt(sim.driveAgainAt, sim.clockMinutes)) : null,
    cost: HUSTLE.driveCost, hours: HUSTLE.driveHours, min: HUSTLE.driveMin, max: HUSTLE.driveMax,
  };
}
