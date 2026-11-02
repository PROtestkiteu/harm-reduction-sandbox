import type { Crowd, Satellite } from '../agents/crowd';
import { nearestNode } from '../agents/nav';
import type { Simulation } from '../sim/simulation';
import { PROPERTY, SATELLITE_SERVICES, type SatelliteService } from '../sim/property';
import { plural, t } from '../i18n';
import { QUESTS, type InstitutionId } from '../config/institutionQuests';
import { PARTNER_NEEDS, QUEST_NEEDS, serviceNeeds } from '../config/needs';
import type { BuildingCard, ChipState } from '../ui/hud';
import { price } from '../ui/money';
import { displayName } from '../ui/names';
import { cityBuilding, type BuildingUse } from '../world/cityBuildings';
import { DISTRICT, NODES, SQUAT_SPOT, camperSpot } from '../world/layout';
import { VENUE_KINDS, VITALITY, type VenueKind } from '../sim/vitality';
import { RESIDENTS } from '../config/residents';
import { formatClock } from '../sim/clock';

/** The new venues' names on their cards. */
const VENUE_TITLES: Record<VenueKind, string> = { bar: t('New bar'), cafe: t('New café'), club: t('New club'), live: t('Live music venue') };
import type { ShopKind, World } from '../world/scene';

/**
 * What the city around the services shows of the game: the cards for
 * ordinary buildings and emergency vehicles, and the property (rented shops,
 * extra campers) as signs, vans and places people walk to.
 */

const USE_TITLE: Record<BuildingUse, string> = {
  shopfront: t('Shopfront'),
  'flats over shops': t('Flats over shops'),
  flats: t('Block of flats'),
  tenement: t('Old block of flats'),
};
const level = (v: number, words: [string, string, string]) => (v < 0.33 ? words[0] : v < 0.66 ? words[1] : words[2]);
const percent = (v: number) => `${Math.round(v * 100)}%`;

/** What the law's shops are, on their building card. */
const SHOP_SAID: Record<ShopKind, string> = {
  medical: t('Cannabis on prescription.'),
  smart: t('Legal highs, sold untested.'),
  coffeeshop: t('Cannabis for adults, tolerated.'),
  cannabis: t('Licensed cannabis for adults.'),
  liquor: t('Open all night; drunk people outside.'),
  betting: t('Sports bets and slot machines.'),
  casino: t('Drunk crowds outside late at night.'),
};

/** Which shops each option of the cannabis and new-substances law puts on the street. */
/**
 * Which shops each option of the cannabis and new-substances law puts on the
 * street. A legal-high shop (dopalacze) trades under every law: licensed or in
 * a grey area, there is always one.
 */
export const SHOPS_FOR: Record<string, ShopKind[]> = {
  prohibited: ['smart'],
  medical: ['medical', 'smart'],
  legalHighs: ['medical', 'smart'],
  coffeeshops: ['medical', 'coffeeshop', 'smart'],
  regulated: ['medical', 'cannabis', 'smart'],
};

/** The law's shop on a building, if one is there. */
const shopKindOf = (world: World, id: number): ShopKind | undefined => world.shopAt(id) ?? undefined;
/** A point's name, as in "Open a drop-in point". */
const POINT_NAME: Record<SatelliteService, string> = {
  dropIn: t('drop-in point'),
  drugChecking: t('drug checking point'),
  footPatrol: t('needle exchange point'),
};
/** A rented shop's service, as in "Rent it and open a drop-in". */
const UNIT_NAME: Record<SatelliteService, string> = {
  dropIn: t('drop-in'),
  drugChecking: t('drug checking point'),
  footPatrol: t('needle exchange'),
};
/** What a police car or ambulance is doing now. */
const VEHICLE_STATE: Record<string, string> = {
  'On the way': t('On the way'),
  'At the scene': t('At the scene'),
  Leaving: t('Leaving'),
  'On patrol': t('On patrol'),
  'On its route': t('On its route'),
  'Held up': t('Held up in traffic'),
  Parked: t('Parked'),
};
const VEHICLE_TITLE = { police: t('Police car'), ambulance: t('Ambulance'), bus: t('City bus'), warmingBus: t('Warming bus') } as const;
const placesPlus = (n: number) => plural(n, ['+{n} place', '+{n} places'], ['+{n} miejsce', '+{n} miejsca', '+{n} miejsc']);

/** Signs a rented shop shows, per satellite service. */
const SATELLITE_SIGN: Record<SatelliteService, { sign: string; fg: string; bg: string }> = {
  dropIn: { sign: 'DROP-IN', fg: '#fff6e4', bg: '#2e7d6b' },
  drugChecking: { sign: 'DRUG CHECKING', fg: '#eafffb', bg: '#245c58' },
  footPatrol: { sign: 'NEEDLE EXCHANGE', fg: '#ffffff', bg: '#2f7a48' },
};
/** The banner on a squat's roof, the launch's derelict building or a squatted shop. */
const SQUAT_SIGN = { sign: 'SQUAT', fg: '#f4e8d0', bg: '#2a2a2a' };
/** A camper parked this close to a squat (metres) reaches the people living there. */
const SQUAT_REACH = 14;

/** Is a camper parked by the building? The first camper and the extra ones. */
function camperBy(world: World, sim: Simulation, building: number): boolean {
  const b = cityBuilding(building);
  if (!b) return false;
  return [camperSpot(), ...sim.property.campers].some((spot) => {
    const c = world.camperCounter(spot);
    return !!c && Math.hypot(Math.min(b.x1, Math.max(b.x0, c.x)) - c.x, Math.min(b.z1, Math.max(b.z0, c.z)) - c.z) < SQUAT_REACH;
  });
}

/** Cards for an ordinary building (who lives there, the neighbourhood round it) and for a police car or ambulance. */
export class CityCards {
  constructor(private readonly sim: Simulation, private readonly world: World) {}

  /** The property unit a building is, if it is one of the tracked shops (-1 otherwise). */
  unitOf(buildingId: number): number {
    return this.world.shopUnits.indexOf(buildingId);
  }

  describeBuilding(id: number): BuildingCard {
    const { sim, world } = this;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    if (id === world.landmarks.hospital) {
      return {
        title: displayName('building', id, t('Public hospital')),
        said: t('Unreached overdoses end up here; reaching people first keeps beds free.') + this.questPart('hospital').said,
        facts: [[t('Ambulances and A&E under pressure'), pct(sim.cityStress.medics)], ...this.questPart('hospital').facts],
        actions: this.questPart('hospital').actions,
        renamable: true,
      };
    }
    const venue = world.nightlife.indexOf(id);
    if (venue >= 0 && venue < sim.vitality.venues) {
      const kind = VENUE_KINDS[venue];
      const partnered = sim.vitality.partners.has(venue);
      return {
        title: displayName('building', id, VENUE_TITLES[kind]),
        said: partnered
          ? t('Your partner: water and info here, {fee} an hour to you.', { fee: price(VITALITY.partnerFeePerHour) })
          : t('New since the street got safer. Partner up to put water and info here.'),
        facts: [['District doing well', pct(sim.vitality.level)]],
        actions: partnered ? [] : [{
          id: 'partner',
          label: t('Partner with the venue ({cost}; it pays {fee}/h)', { cost: price(VITALITY.partnerCost), fee: price(VITALITY.partnerFeePerHour) }),
          short: t('Partner with the venue.'),
          cost: VITALITY.partnerCost,
          detail: t('Harm reduction info and water in the venue; it pays {fee} an hour from then on.', { fee: price(VITALITY.partnerFeePerHour) }),
          enabled: sim.org.budget >= VITALITY.partnerCost,
          helps: PARTNER_NEEDS,
        }],
      };
    }
    if (id === world.fastFood) {
      return {
        title: displayName('building', id, t('Fast food')),
        said: t('Open late, bright and warm: club leavers and people with nowhere to go.'),
        facts: [],
        renamable: true,
      };
    }
    if (id === world.school) {
      return { title: displayName('building', id, t('Primary school')), said: t('Children\'s drawings in the windows. Quiet at night.'), facts: [], renamable: true };
    }
    if (id === world.library) {
      return { title: displayName('building', id, t('Public library')), said: t('Free to all, warm, with toilets: people with nowhere to go spend the day here.'), facts: [], renamable: true };
    }
    if (id === world.bookshop) {
      return {
        title: displayName('building', id, t('Bookshop')),
        said: t('New and second-hand books, a cart of them by the door.'),
        facts: [],
        renamable: true,
      };
    }
    if (world.zabkas.includes(id)) {
      return {
        title: displayName('building', id, t('Żabka')),
        said: t('Open late: snacks, coffee, a parcel locker.'),
        facts: [],
        renamable: true,
      };
    }
    if (id === world.pharmacyShop) {
      return {
        title: displayName('building', id, t('Pharmacy')),
        said: t('Sells syringes and naloxone few can afford; your foot patrol gives them free.'),
        facts: [],
        renamable: true,
      };
    }
    if (id === world.camps.park || id === world.camps.station) {
      const park = id === world.camps.park;
      const people = park ? sim.camp.people : sim.camp.stationPeople;
      const count = plural(people, ['{n} person', '{n} people'], ['{n} osoba', '{n} osoby', '{n} osób']);
      return {
        title: park ? t('Camp in the park') : t('Camp by the railway station'),
        said: `${people ? t('About {people} in tents.', { people: count }) : t('No tents here right now.')} ${park
          ? t('An open shelter and outreach shrink it.')
          : t('Grows in winter too. An open shelter and outreach shrink it.')}`,
        facts: [[t('Police under pressure'), pct(sim.cityStress.police)]],
        renamable: true,
      };
    }
    if (id === world.landmarks.cityHall) {
      return {
        title: displayName('building', id, t('City hall')),
        said: t('Permits, curfews and local strategy.') + this.questPart('cityHall').said,
        facts: this.questPart('cityHall').facts,
        actions: this.questPart('cityHall').actions,
        renamable: true,
      };
    }
    if (id === world.landmarks.police) {
      return {
        title: displayName('building', id, t('Police station')),
        said: t('Patrols and raids set out from here.') + this.questPart('police').said,
        facts: [[t('Police under pressure'), pct(sim.cityStress.police)], ...this.questPart('police').facts],
        actions: this.questPart('police').actions,
        renamable: true,
      };
    }
    if (id === world.landmarks.sobering) {
      return {
        title: displayName('building', id, t('Sobering-up centre')),
        said: t('Police bring in the very drunk, mostly at club closing.') + this.questPart('sobering').said,
        facts: [[t('How full it is'), pct(sim.cityStress.sobering)], [t('Police under pressure'), pct(sim.cityStress.police)], ...this.questPart('sobering').facts],
        actions: this.questPart('sobering').actions,
      };
    }
    const b = cityBuilding(id)!;
    const n = sim.neighbourhood.state;
    const residents = Math.round(b.households * 2.1);
    const unit = this.unitPart(id);
    const point = this.unitOf(id) >= 0 || shopKindOf(world, id) || id === world.squat ? {} : this.pointPart(id);
    const shop = world.shopAt(id);
    const reach = () => (camperBy(world, sim, id) || (id === world.squat && (camperSpot() === SQUAT_SPOT || sim.property.campers.includes(SQUAT_SPOT)))
      ? t('A camper outside reaches them.')
      : t('Park a camper outside to reach them.'));
    const squat = id === world.squat
      ? `${t('A squat: about {n} people, more in winter.', { n: sim.camp.squatPeople })} ${reach()}`
      : sim.property.units[this.unitOf(id)]?.kind === 'squatted'
        ? `${t('Squatted: people moved into the empty shop.')} ${reach()}`
        : undefined;
    const said = squat ?? (shop ? SHOP_SAID[shop] : undefined) ?? unit.said ?? (b.households ? t('{storeys}, {households}, about {residents}.', {
      storeys: plural(b.storeys, ['{n} storey', '{n} storeys'], ['{n} kondygnacja', '{n} kondygnacje', '{n} kondygnacji']),
      households: plural(b.households, ['{n} household', '{n} households'], ['{n} gospodarstwo domowe', '{n} gospodarstwa domowe', '{n} gospodarstw domowych']),
      residents: plural(residents, ['{n} person', '{n} people'], ['{n} osoba', '{n} osoby', '{n} osób']),
    }) : '');
    // Where people live, the project can work with them: residents' actions come first.
    const homes = b.households > 0 && id !== world.squat ? this.residentActions() : [];
    // Good, middling or bad, as the meters at the top colour them.
    const band = (v: number, goodHigh: boolean): ChipState => {
      const g = goodHigh ? v : 1 - v;
      return g >= 0.66 ? 'good' : g >= 0.33 ? 'mid' : 'bad';
    };
    return {
      title: displayName('building', id, USE_TITLE[b.use]),
      said,
      actions: [...homes, ...(unit.actions ?? point.actions ?? [])],
      facts: [
        ...(unit.fact ? [unit.fact] : []),
        ...(point.fact ? [point.fact] : []),
      ],
      chips: [
        { icon: 'safety', value: percent(n.safety), label: t('Feels safe to residents: {v}', { v: percent(n.safety) }), state: band(n.safety, true) },
        { icon: 'litter', value: level(n.litter, [t('Little'), t('Some'), t('A lot')]), label: t('Litter and discarded kit: {v}', { v: level(n.litter, [t('Little'), t('Some'), t('A lot')]) }), state: band(n.litter, false) },
        { icon: 'seen', value: level(n.visibleUse, [t('Rare'), t('Sometimes'), t('Often')]), label: t('Use seen on the street: {v}', { v: level(n.visibleUse, [t('Rare'), t('Sometimes'), t('Often')]) }), state: band(n.visibleUse, false) },
        { icon: 'shops', value: level(n.shopTrade, [t('Struggling'), t('Getting by'), t('Trading well')]), label: t('Shops nearby: {v}', { v: level(n.shopTrade, [t('Struggling'), t('Getting by'), t('Trading well')]) }), state: band(n.shopTrade, true) },
        // How the people who use them speak of the services: those who come and get served spread the word.
        { icon: 'reputation', value: level(n.reputation, [t('Poor'), t('Mixed'), t('Good')]), label: t("Your services' reputation: {v}", { v: level(n.reputation, [t('Poor'), t('Mixed'), t('Good')]) }), state: band(n.reputation, true) },
        { icon: 'rough', value: String(n.roughSleepers), label: t('Sleeping rough nearby: {n}', { n: n.roughSleepers }), state: n.roughSleepers ? 'bad' : 'good' },
      ],
    };
  }

  /** Sweeping for used kit and meeting the residents: each with its cost, or when it can go again. */
  private residentActions(): NonNullable<BuildingCard['actions']> {
    const { sim } = this;
    const at = (minute: number) => formatClock(sim.org.clockAt(minute, sim.clockMinutes));
    const sweepWait = sim.org.now < sim.sweepAgainAt;
    const metNow = sim.org.now < sim.residentsMetUntil;
    const meetWait = sim.org.now < sim.meetAgainAt;
    return [
      {
        id: 'sweep',
        label: sweepWait ? t('Next sweep for used kit from {time}', { time: at(sim.sweepAgainAt) }) : t('Sweep for used kit ({price})', { price: price(RESIDENTS.sweepCost) }),
        short: sweepWait ? t('Sweep again later.') : t('Sweep for used kit.'),
        cost: RESIDENTS.sweepCost,
        detail: t('The team picks up about half the used needles and kit in courtyards and stairwells.'),
        enabled: !sweepWait && sim.org.budget >= RESIDENTS.sweepCost,
        helps: ['district'],
      },
      {
        id: 'meet',
        label: metNow ? t('Residents met: next round from {time}', { time: at(sim.meetAgainAt) }) : meetWait ? t('Next door-knocking from {time}', { time: at(sim.meetAgainAt) }) : t('Meet the residents ({price})', { price: price(RESIDENTS.meetCost) }),
        short: meetWait ? t('Meet them again later.') : t('Meet the residents.'),
        cost: RESIDENTS.meetCost,
        detail: t('Door-knocking: residents learn whom to call and the street feels safer for {h} h.', { h: RESIDENTS.meetHours }),
        enabled: !meetWait && sim.org.budget >= RESIDENTS.meetCost,
        helps: ['district'],
      },
    ];
  }

  /**
   * An institution's side quest on its card: how far along, what the last step
   * taught (with its source), and the next step as a reply.
   */
  private questPart(id: InstitutionId): { said: string; facts: [string, string][]; actions: NonNullable<BuildingCard['actions']> } {
    const q = QUESTS[id];
    const done = this.sim.quests[id];
    const last = q.steps[done - 1];
    const next = q.steps[done];
    const learnt = last ? ` ${last.lesson} (${last.evidence?.ref ?? ''})` : '';
    return {
      said: next ? ` ${q.title}: ${q.goal}${learnt}` : ` ${q.done}${learnt}`,
      facts: [[t('Allies'), next ? t('{done} of {all} steps', { done, all: q.steps.length }) : t('Yes')]],
      actions: next ? [{ id: `quest:${id}`, label: next.cost ? t('{step} ({price})', { step: next.label, price: price(next.cost) }) : next.label, short: next.short, cost: next.cost, detail: q.goal, enabled: this.sim.org.budget >= next.cost, helps: QUEST_NEEDS[id] }] : [],
    };
  }

  /** A police car or ambulance: why it came and what it is doing now; undefined once it has gone. */
  describeVehicle(id: number): BuildingCard | undefined {
    const v = this.world.vehicle(id);
    if (!v) return undefined;
    return {
      title: VEHICLE_TITLE[v.kind],
      said: v.reason,
      facts: [[t('Now'), VEHICLE_STATE[v.state] ?? v.state]],
      renamable: false,
    };
  }

  /**
   * Any ordinary building in the district can take a harm reduction point:
   * opened small (level 0), grown level by level. Drug checking only where
   * the law allows it.
   */
  private pointPart(id: number): Pick<BuildingCard, 'actions'> & { fact?: [string, string] } {
    const { sim } = this;
    const b = cityBuilding(id);
    if (!b || Math.abs((b.x0 + b.x1) / 2) > DISTRICT || Math.abs((b.z0 + b.z1) / 2) > DISTRICT) return {};
    const p = PROPERTY.point;
    const q = sim.property.pointAt(id);
    if (q) {
      return {
        fact: [t('Harm reduction point'), t('{point}, level {level}', { point: POINT_NAME[q.service], level: q.level })],
        actions: [
          ...(q.level < p.maxLevel ? [{ id: 'pointUp', label: t('Grow the point to level {level} ({price}; {places})', { level: q.level + 1, price: price(p.upgrade), places: placesPlus(p.placesPerLevel) }), short: t('Grow the point.'), cost: p.upgrade, detail: t('{places} for the {point}, and a little more rent.', { places: placesPlus(p.placesPerLevel), point: POINT_NAME[q.service] }), enabled: sim.org.budget >= p.upgrade && sim.services[q.service].switchedOn, helps: serviceNeeds(q.service) }] : []),
          { id: 'pointClose', label: t('Close the point.'), short: t('Close the point.'), enabled: true },
        ],
      };
    }
    const allowed = sim.context.checkingAllowed;
    return {
      actions: SATELLITE_SERVICES.map((s) => ({
        id: `point:${s}`,
        label: s === 'drugChecking' && !allowed
          ? t('A drug checking point: not allowed by law.')
          : t('Open a {point} ({fitOut}, then {rent}/h; {places}).', { point: POINT_NAME[s], fitOut: price(p.fitOut), rent: price(p.rentPerHour), places: placesPlus(p.placesAtZero) }),
        short: t('Open a {point}.', { point: POINT_NAME[s] }),
        cost: p.fitOut,
        detail: t('{places} for the {point}, then {rent} an hour in rent.', { places: placesPlus(p.placesAtZero), point: POINT_NAME[s], rent: price(p.rentPerHour) }),
        // Only for services switched on: a point adds places to its service.
        enabled: sim.org.budget >= p.fitOut && (s !== 'drugChecking' || allowed) && sim.services[s].switchedOn,
        helps: serviceNeeds(s),
      })),
    };
  }

  /** A shop unit's part of the card: trading, to let (with rent options) or rented by the project. */
  private unitPart(id: number): Pick<BuildingCard, 'actions'> & { said?: string; fact?: [string, string] } {
    const { sim } = this;
    const i = this.unitOf(id);
    const u = i >= 0 ? sim.property.units[i] : undefined;
    if (!u) return {};
    if (u.kind === 'trading') return { fact: [t('Shop'), t('Trading')] };
    if (u.kind === 'squatted') return { fact: [t('Shop'), t('Empty, squatted')] };
    const cost = t('{fitOut}, then {rent} an hour', { fitOut: price(PROPERTY.fitOut), rent: price(PROPERTY.rentPerHour) });
    if (u.kind === 'vacant') {
      return {
        said: t('Closed, to let.'),
        fact: [t('Shop'), t('Closed, to let')],
        actions: SATELLITE_SERVICES.map((s) => ({
          id: `rent:${s}`,
          label: t('Rent it and open a {unit} ({cost}; {places}).', { unit: UNIT_NAME[s], cost, places: placesPlus(PROPERTY.satellitePlaces) }),
          short: t('Open a {point}.', { point: POINT_NAME[s] }),
          cost: PROPERTY.fitOut,
          detail: t('{places} for the {unit}, then {rent} an hour in rent.', { places: placesPlus(PROPERTY.satellitePlaces), unit: UNIT_NAME[s], rent: price(PROPERTY.rentPerHour) }),
          enabled: sim.org.budget >= PROPERTY.fitOut && sim.services[s].switchedOn,
          helps: serviceNeeds(s),
        })),
      };
    }
    return {
      said: t('Yours: a {unit}, {rent} an hour.', { unit: UNIT_NAME[u.service], rent: price(PROPERTY.rentPerHour) }),
      fact: [t('Shop'), t('Rented: {unit}', { unit: UNIT_NAME[u.service] })],
      actions: [{ id: 'release', label: t('Give the unit back.'), short: t('Give the unit back.'), enabled: true }],
    };
  }
}

/**
 * The property as the city shows it: signs on the shop units, extra campers
 * at their kerb spots, and both as places the crowd walks to. Only changes
 * reach the world and the crowd.
 */
export class PropertyView {
  private readonly unitShown: string[] = [];
  private campersShown = '';
  private pointsShown = new Map<number, string>();
  private satelliteKey = '';
  private squatsShown = '';

  constructor(private readonly sim: Simulation, private readonly world: World, private readonly crowd: Crowd) {}

  sync(): void {
    const { sim, world } = this;
    // A camper parked by the squat reaches the people living there.
    // Squats: the launch's derelict building, and any shop people have moved into.
    const squats = [...(world.squat === null ? [] : [world.squat]), ...sim.property.squats.map((i) => world.shopUnits[i])];
    sim.squatCovered = camperSpot() === SQUAT_SPOT || sim.property.campers.includes(SQUAT_SPOT) || squats.some((b) => camperBy(world, sim, b));
    sim.property.units.forEach((u, i) => {
      const key = u.kind === 'rented' ? u.service : u.kind;
      if (this.unitShown[i] === key) return;
      this.unitShown[i] = key;
      world.setUnit(i, u.kind === 'trading' ? 'trading' : u.kind === 'vacant' ? 'toLet' : u.kind === 'squatted' ? SQUAT_SIGN : SATELLITE_SIGN[u.service]);
    });
    const squatKey = squats.join(',');
    if (squatKey !== this.squatsShown) {
      this.squatsShown = squatKey;
      this.crowd.setSquats(squats);
    }
    // Points' signs: new ones go up, closed ones come down.
    const now = new Map(sim.property.points.map((q) => [q.building, `${q.service}:${q.level}`]));
    for (const [b, key] of now) if (this.pointsShown.get(b) !== key) world.setPoint(b, SATELLITE_SIGN[sim.property.pointAt(b)!.service]);
    for (const b of this.pointsShown.keys()) if (!now.has(b)) world.setPoint(b, null);
    this.pointsShown = now;
    const spots = sim.property.campers.join(',');
    if (spots !== this.campersShown) {
      this.campersShown = spots;
      world.setExtraCampers(sim.property.campers);
    }
    const key = `${this.unitShown.join(',')}|${this.campersShown}|${[...now.keys()].join(',')}`;
    if (key !== this.satelliteKey) {
      this.satelliteKey = key;
      this.crowd.setSatellites(this.satellites());
    }
  }

  /** Rented shops and extra campers as places people walk to. */
  private satellites(): Satellite[] {
    const out: Satellite[] = [];
    const rentedShops = this.sim.property.units.flatMap((u, i) => (u.kind === 'rented' ? [{ building: this.world.shopUnits[i], service: u.service }] : []));
    for (const { building, service } of [...rentedShops, ...this.sim.property.points]) {
      const b = cityBuilding(building);
      if (!b) continue;
      // The door faces the nearest pavement: the nearest walkway point, pulled onto the wall.
      const cx = (b.x0 + b.x1) / 2;
      const cz = (b.z0 + b.z1) / 2;
      const node = NODES[nearestNode({ x: cx, z: cz })];
      const wall = { x: Math.min(b.x1, Math.max(b.x0, node.x)), z: Math.min(b.z1, Math.max(b.z0, node.z)) };
      const away = Math.hypot(node.x - wall.x, node.z - wall.z) || 1;
      const door = { x: wall.x + ((node.x - wall.x) / away) * 0.8, z: wall.z + ((node.z - wall.z) / away) * 0.8 };
      out.push({ service, door, inside: { x: cx, z: cz } });
    }
    for (const spot of this.sim.property.campers) {
      const counter = this.world.camperCounter(spot);
      if (counter) out.push({ service: 'outreach', door: counter });
    }
    return out;
  }
}
