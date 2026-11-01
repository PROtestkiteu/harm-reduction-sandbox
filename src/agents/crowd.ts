import { Group, Vector3, type Camera, type Object3D } from 'three';
import { MoodIcons, type Mood } from './moodIcons';
import { SEASON_PROFILES } from '../config/seasons';
import { createRandom, pick, type Random } from '../sim/random';
import type { AcuteOutcome, Intent, SimEvent, Simulation, VisitorId } from '../sim/simulation';
import type { Substance } from '../config/randomEvents';
import { WALK_IN_SERVICE_IDS, type ServiceId, type WalkInServiceId } from '../sim/types';
import type { World } from '../world/scene';
import {
  CAMPER_FRAME,
  CAMPER_QUEUE_DIR,
  CENTER_QUEUE_DIR,
  CLUB_QUEUE_DIR,
  ENTRY_NODES,
  MAIN_CROSSINGS,
  NODES,
  ROAD,
  SERVICE_NODES,
  LOTS,
  PATROL,
  SPOTS,
  STAND_QUEUE_DIR,
  VENUE_FRAME,
  VENUE_ROT,
  VENUES_AT_HOME,
  toWorld,
  groundY,
  queueSlot,
  type NodeId,
  type P2,
} from '../world/layout';
import { bus, car, CAR_COLOURS, rollWheels } from '../world/vehicles';
import type { CityHappening, PasserbyKind } from '../sim/cityLife';
import { approach } from '../world/animated';
import { speedForGap, stood, type TrafficCar } from '../world/traffic';
import { PALETTE } from '../config/palette';
import { CharacterRig, randomAppearance, type Appearance, type Archetype, type BodyState, type Figure, type Pose } from './character';
import { HumanFigure, peopleLibrary } from './humanFigure';
import { Dog } from './dog';
import type { PatrolStyle } from '../config/contextFactors';
import { nearestNode, routeTo } from './nav';
import { movingBox, pushFromBox } from '../world/solids';
import { PoliceRings, deterrenceRadius } from './policeRings';
import { cityBuilding } from '../world/cityBuildings';
import { t } from '../i18n';

/**
 * Crowd layer: turns simulation events into people walking between meaningful
 * destinations, and reports physical arrivals back to the simulation. Each
 * agent is a small state machine; long trips use the pavement graph, local
 * moves (queues, seats, counters) go straight to a spot.
 */

const MAX_PEOPLE = 84;
/** Most people waiting in the crowd outside one service. */
const MAX_CROWD = 8;
/** Distance two people keep between their centres, metres. */
const PERSONAL_SPACE = 0.62;
/** A body's radius against furniture and cars. */
const BODY_RADIUS = 0.3;
/** How far a figure may be drawn off its path to give way. */
const MAX_NUDGE = 0.9;
const MAX_CARS = 10;
/** Main-street cars start and end this far out, beyond what the camera sees, so none pops in at the district's edge. */
const CAR_RUN = 120;

export type Mode =
  | 'walking'      // on the way somewhere; `onArrive` decides what happens next
  | 'waiting'      // in a service queue or on a bench
  | 'served'       // at a counter or stand
  | 'inside'       // hidden inside a building
  | 'clubQueue'
  | 'pausing'
  | 'post'         // staff at their post
  | 'standing'     // police posted, or residents with placards
  | 'leaving';

/** Who someone is in the scene, in neutral terms. */
export type PersonRole = 'staff' | 'visitor' | 'clubgoer' | 'passerby' | 'police' | 'resident' | 'seller' | 'sleeper' | 'cleaner' | 'bouncer';
/** Roles placed by context or the street, not by a visit: they are not stopped, robbed or drawn into encounters. */
const SPECIAL_ROLES: ReadonlySet<PersonRole> = new Set(['police', 'resident', 'seller', 'sleeper', 'cleaner']);
/** Where someone is heading or what they are there for. */
export type PersonGoal = ServiceId | 'club' | 'party' | 'post' | 'exit';

/**
 * A second place a service works from: a rented shop (people go in) or an
 * extra camper (people stand at its counter). Positions are on the ground.
 */
export interface Satellite {
  service: ServiceId;
  /** Where people stand to be let in or served. */
  door: P2;
  /** Where they go once admitted; absent for a camper counter. */
  inside?: P2;
}

/** Read-only view of one person for the UI; carries no identifying detail. */
export interface PersonState {
  readonly id: number;
  readonly role: PersonRole;
  /** Everyday group they belong to; never a statement about drug use. */
  readonly archetype: Archetype;
  /** What a visitor uses, for matching tonight's events to them; never shown as a label. */
  readonly substance?: Substance;
  /** How they look (illustrative), for their painted portrait. */
  readonly look: Appearance;
  /** Resting on a bench with their belongings, not part of any flow. */
  readonly resting: boolean;
  /** No room inside: waiting in the crowd outside this service. */
  readonly crowding?: ServiceId;
  readonly mode: Mode;
  readonly goal?: PersonGoal;
  readonly service?: ServiceId;
  readonly seated: boolean;
  readonly moving: boolean;
  readonly visible: boolean;
  readonly root: Object3D;
}

interface Agent {
  id: number;
  role: PersonRole;
  resting?: boolean;
  goal?: PersonGoal;
  visitor?: VisitorId;
  rig: Figure;
  pos: P2;
  heading: number;
  speed: number;
  route: P2[];
  mode: Mode;
  pose: Pose;
  service?: ServiceId;
  staffPost?: number;
  faceHeading?: number;
  pauseLeft: number;
  offset: P2;
  /** A dog walked at heel (dog-walker population). */
  dog?: Dog;
  /** Visual give-way: where the figure is drawn relative to its path, to keep clear of others. */
  nudge: P2;
  onArrive?: () => void;
  visible: boolean;
  /** Dancing at a party: bobs in place. */
  dancing?: boolean;
  /** Turned away for lack of room: standing in the crowd outside this service. */
  crowding?: ServiceId;
  /** Served at a satellite (a rented shop or an extra camper) instead of the main site. */
  satellite?: Satellite;
  /** Waiting for the night bus. */
  waitingForBus?: boolean;
  /** Staff away from their post helping someone who collapsed. */
  responding?: boolean;
  /** How this person is doing, shown as a small icon; decided by simulation outcomes. */
  mood?: Mood;
  /** Seconds the mood icon stays up (Infinity: while in this state). */
  moodLeft: number;
  /** Pending consequence of unmet need, carried out when the person next leaves. */
  aftermath?: { hiddenUse: boolean; adverse: boolean; acute: AcuteOutcome | null };
  intoxicated?: boolean;
  /** How their body carries what they took; worked out once, the first time they are drawn. */
  body?: BodyState;
  /** Sitting on the ground (hidden spot) or lying in the recovery position (adverse placeholder). */
  ground?: 'sit' | 'lying';
}

interface Car {
  group: Group;
  z: number;
  speed: number;
  /** Half the vehicle length, for spacing. */
  half: number;
  /** Its own cruising speed: drivers differ. */
  cruise: number;
  /** The night bus stops once at the shelter. */
  stopAt?: number;
  stopLeft?: number;
  /** Its place in the city's traffic, so cross traffic sees it and it sees cross traffic. */
  rec: TrafficCar;
}

const isWalkIn = (id: ServiceId | undefined): id is WalkInServiceId => !!id && (WALK_IN_SERVICE_IDS as readonly string[]).includes(id);
const headingTo = (from: P2, to: P2) => Math.atan2(to.x - from.x, to.z - from.z);
const dist = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.z - b.z);

/** Why the police were called, by the city's incident kind. */
const CRIME_CALL: Record<string, string> = {
  scuffle: t('Called to a fight outside the club.'),
  pickpocket: t("Called because someone's phone or wallet was taken in the crowd."),
  bikeTheft: t('Called to a bike stolen from a rack in the district.'),
  carBreakIn: t('Called to a car broken into on the street.'),
};

export class Crowd {
  readonly group = new Group();
  private readonly agents = new Map<number, Agent>();
  private readonly byVisitor = new Map<VisitorId, Agent>();
  private readonly cars: Car[] = [];
  private readonly giveWayList: Agent[] = [];
  private readonly pushScratch = { x: 0, z: 0 };
  private readonly random: Random;
  private nextId = 1;
  private readonly staffQueue: { service: ServiceId; post: number; delay: number }[] = [];
  private readonly scratch = new Vector3();
  /** Context people: officers and residents with placards, kept in step with the simulation's context. */
  private readonly officers: Agent[] = [];
  /** Each officer's deterrence radius, drawn on the ground. */
  private readonly rings: PoliceRings;
  private readonly ringAt: P2[] = [];
  private squatTimer = 10;
  /** Buildings people live in without a tenancy: the derelict one and squatted shops. */
  private squats: readonly number[] = [];
  private readonly residents: Agent[] = [];
  private restingPlaced = false;
  private readonly sellers: Agent[] = [];
  private readonly sleepers: Agent[] = [];
  private sellerSpots: 'near' | 'displaced' = 'near';
  private encounterTimer = 12;
  private patrolKey = '';
  private readonly icons: MoodIcons;
  private clock = 0;

  constructor(private readonly sim: Simulation, private readonly world: World, seed: number) {
    this.random = createRandom(seed);
    world.scene.add(this.group);
    this.icons = new MoodIcons(this.group);
    this.rings = new PoliceRings(this.group);
    sim.on((e) => this.handle(e));
  }

  /** Mood icons face this camera. */
  setCamera(camera: Camera): void {
    this.icons.setCamera(camera);
  }

  get population(): number {
    return this.agents.size;
  }

  /** Current state of one person, or undefined once they have left the scene. */
  person(id: number): PersonState | undefined {
    const a = this.agents.get(id);
    return a && this.view(a);
  }

  /** Visits every person currently drawn, for picking. */
  forEachVisible(visit: (p: PersonState) => void): void {
    for (const a of this.agents.values()) if (a.visible) visit(this.view(a));
  }

  private view(a: Agent): PersonState {
    return {
      id: a.id,
      role: a.role,
      archetype: a.rig.look.style ?? 'everyday',
      substance: a.visitor !== undefined ? this.sim.substanceOf(a.visitor) : undefined,
      look: a.rig.look,
      resting: !!a.resting,
      crowding: a.crowding,
      mode: a.mode,
      goal: a.goal,
      service: a.service,
      seated: a.pose === 'sit' && !a.route.length,
      moving: a.route.length > 0,
      visible: a.visible,
      root: a.rig.root,
    };
  }

  // Simulation events

  private handle(e: SimEvent): void {
    switch (e.type) {
      case 'spawnVisitor': return this.spawnVisitor(e.visitor, e.intent, e.wantsStand, e.turnsBack, e.kind);
      case 'policeStop': return this.policeStop(e.arrest);
      case 'aftermath': return this.onAftermath(e.visitor, e.hiddenUse, e.adverse, e.acute);
      case 'spawnCar': return this.spawnCar();
      case 'admitted': return this.onAdmitted(e.service, e.visitor);
      case 'served': return this.onServed(e.service, e.visitor);
      case 'leftUnserved': return this.onLeftUnserved(e.service, e.visitor);
      case 'staffCall':
        for (let i = 0; i < e.count; i++) this.staffQueue.push({ service: e.service, post: e.first + i, delay: i * 1.6 });
        return;
      case 'staffRelease': return this.releaseStaff(e.service, e.fromPost);
      case 'clubAdmitted': return this.onClubAdmitted(e.visitor);
      case 'clubLeaver': return this.spawnClubLeaver(e.intoxicated, e.acute);
      case 'city': return this.onCity(e.happening);
      case 'exposure': {
        // Found on a street bench or a park bench, where people sleep rough.
        const spot = [...RESTING_SPOTS.map((r) => r.at), ...SLEEP_SPOTS.map((r) => r.at)][Math.floor(this.random() * (RESTING_SPOTS.length + SLEEP_SPOTS.length))];
        const what = e.harm.kind === 'cold' ? t('Someone sleeping rough was found too cold to wake.') : t('Someone collapsed in the heat, badly dehydrated, with no shade or water.');
        const call = e.harm.reached ? t('Outreach staff reached them and called it in.') : t('A passer-by called it in.');
        this.world.dispatch('ambulance', spot.x, spot.z, [what, call, e.harm.died ? t('They did not survive.') : ''].filter(Boolean).join(' '));
        this.onMark?.(spot, e.harm.died ? 'skull' : 'cross');
        return;
      }
    }
  }

  private satellites: readonly Satellite[] = [];

  /** Rented shops and extra campers now working; visitors split between them and the main site. */
  /** Where the squats are now; people moving in pick one of them. */
  setSquats(buildings: readonly number[]): void {
    this.squats = buildings;
  }

  setSatellites(list: readonly Satellite[]): void {
    this.satellites = list;
  }

  /**
   * Picks a satellite for someone heading to `service`, in proportion to the
   * places the satellites add, or none (go to the main site).
   */
  private pickSatellite(service: ServiceId): Satellite | undefined {
    const options = this.satellites.filter((sat) => sat.service === service);
    if (!options.length) return undefined;
    const s = this.sim.services[service];
    const share = s.extraPlaces / Math.max(1, s.capacity || s.extraPlaces + 2);
    if (this.random() >= Math.min(0.6, share)) return undefined;
    return options[Math.floor(this.random() * options.length)];
  }

  private goToSatellite(a: Agent, sat: Satellite): void {
    a.satellite = sat;
    a.service = sat.service;
    this.walk(a, [...routeTo(a.pos, nearestNode(sat.door), a.offset), sat.door], () => {
      const result = this.sim.arrive(sat.service, a.visitor!);
      if (result === 'admitted') this.enterSatellite(a);
      // Waiting at a satellite: they stay by its door rather than join the main line.
      else if (result === 'queued') { a.mode = 'waiting'; a.faceHeading = headingTo(a.pos, sat.inside ?? sat.door); }
      else {
        a.mode = 'pausing';
        a.pauseLeft = 6 + this.random() * 6;
        a.onArrive = () => this.leaveAnywhere(a);
      }
    });
  }

  private enterSatellite(a: Agent): void {
    const sat = a.satellite!;
    a.mode = 'walking';
    a.pose = 'stand';
    if (sat.inside) this.walk(a, [sat.door, sat.inside], () => this.hide(a));
    else {
      // A camper counter: served standing at it.
      a.mode = 'served';
      a.faceHeading = headingTo(a.pos, { x: sat.door.x - 1, z: sat.door.z });
    }
  }

  private exitSatellite(a: Agent): void {
    const sat = a.satellite!;
    a.satellite = undefined;
    if (sat.inside) {
      const out = () => {
        this.show(a, sat.inside!);
        a.mode = 'walking';
        a.goal = 'exit';
        this.walk(a, [sat.door], () => this.leaveAnywhere(a));
      };
      if (a.mode === 'inside') out();
      else a.onArrive = out;
      return;
    }
    a.goal = 'exit';
    this.leaveAnywhere(a);
  }

  private spawnVisitor(visitor: VisitorId, intent: Intent, wantsStand: boolean, turnsBack: boolean, kind?: PasserbyKind): void {
    // The street is full: this person never shows up, and the sim lets go of them.
    if (this.agents.size >= MAX_PEOPLE) return this.sim.forget(visitor);
    const entry = this.entryFor(intent);
    const role: PersonRole = intent === 'passerby' ? 'passerby' : intent === 'club' ? 'clubgoer' : 'visitor';
    // Populations (calendar) bring their own look; everyone else dresses by why they are out.
    const a = this.createAgent(NODES[entry], role, { style: kind ? KIND_STYLE[kind] : this.styleFor(intent), ...(kind ? LOOKS[kind] : {}) });
    a.visitor = visitor;
    a.goal = intent === 'passerby' ? 'exit' : intent === 'club' ? (wantsStand ? 'clubHr' : 'club') : intent;
    this.byVisitor.set(visitor, a);
    if (turnsBack) {
      // Club-goers turn back from the stand; everyone else from the service they set out for.
      const service: ServiceId = intent === 'club' || intent === 'party' || intent === 'passerby' ? 'clubHr' : intent;
      return this.approachThenTurnBack(a, service);
    }
    if (intent === 'dropIn' || intent === 'outreach' || intent === 'footPatrol' || intent === 'drugChecking' || intent === 'shelter' || intent === 'clinic') {
      const sat = this.pickSatellite(intent);
      if (sat) return this.goToSatellite(a, sat);
    }
    switch (intent) {
      case 'dropIn':
        this.walk(a, routeTo(a.pos, SERVICE_NODES.dropIn, a.offset), () => this.arriveAtDropIn(a));
        break;
      case 'outreach':
        this.walk(a, routeTo(a.pos, SERVICE_NODES.outreach, a.offset), () => this.arriveAtOutreach(a));
        break;
      case 'club':
        if (wantsStand) this.walk(a, routeTo(a.pos, SERVICE_NODES.clubHr, a.offset), () => this.arriveAtStand(a));
        else this.goToClubQueue(a);
        break;
      case 'footPatrol':
      case 'drugChecking':
      case 'shelter':
      case 'clinic': {
        const id = intent;
        this.walk(a, routeTo(a.pos, SERVICE_NODES[id], a.offset), () => this.arriveAtWalkIn(a, id));
        break;
      }
      case 'party': {
        // Dances at whichever party is on, then leaves; the simulation decides whether they collapse on the way.
        const festival = this.sim.events.isActive('musicFestival');
        const centre = festival ? PARTY_AREAS.festival : PARTY_AREAS.popUp;
        const spot = { x: centre.x + (this.random() - 0.5) * centre.r * 2, z: centre.z + (this.random() - 0.5) * centre.r * 2 };
        this.walk(a, [...routeTo(a.pos, 'park', a.offset), spot], () => {
          a.mode = 'pausing';
          a.dancing = true;
          a.faceHeading = headingTo(a.pos, centre.face);
          a.pauseLeft = 60 + this.random() * 60;
          a.onArrive = () => {
            a.dancing = false;
            const acute = this.sim.partyLeave(visitor);
            if (acute) this.collapse(a, acute, () => this.leaveAnywhere(a));
            else this.leaveAnywhere(a);
          };
        });
        break;
      }
      case 'passerby': {
        const exits = ENTRY_NODES.filter((n) => n !== entry);
        if (kind === 'commuters') a.speed = 1.55;
        if (kind === 'tourists') a.speed = 0.85;
        if (kind === 'dogWalkers') a.speed = 0.8;
        // Clubbers and some students passing through join the club queue.
        if ((kind === 'clubbers' && this.random() < 0.5) || (kind === 'students' && this.random() < 0.35)) return this.goToClubQueue(a);
        if (kind === 'workers' && this.random() < 0.6) {
          // Early-shift workers wait for the night bus at the shelter.
          const at = BUS_WAIT[a.id % BUS_WAIT.length];
          a.waitingForBus = true;
          this.walk(a, [...routeTo(a.pos, 'wBack', a.offset), at], () => {
            a.mode = 'pausing';
            a.faceHeading = Math.PI / 2;
            a.pauseLeft = 150;
            a.onArrive = () => { a.waitingForBus = false; this.leave(a, pick(this.random, exits)); };
          });
          break;
        }
        if (kind === 'diners' && !this.sim.events.isActive('shopClosesEarly')) {
          const cafe = SHOP_FRONTS[1];
          this.walk(a, [...routeTo(a.pos, cafe.node, a.offset), CAFE_TABLES[a.id % CAFE_TABLES.length]], () => {
            a.mode = 'pausing';
            a.pose = 'sit';
            a.faceHeading = Math.PI;
            a.pauseLeft = 30 + this.random() * 30;
            a.onArrive = () => { a.pose = 'stand'; this.leave(a, pick(this.random, exits)); };
          });
          break;
        }
        // Some passers-by shop on the way, more when trade is good; none while the shutters are down.
        const shopsOpen = !this.sim.events.isActive('shopClosesEarly');
        if (shopsOpen && this.random() < this.sim.neighbourhood.state.shopTrade * (kind === 'tourists' ? 0.9 : 0.4)) {
          const shop = SHOP_FRONTS[a.id % SHOP_FRONTS.length];
          this.walk(a, [...routeTo(a.pos, shop.node, a.offset), shop.at], () => {
            a.mode = 'pausing';
            a.pauseLeft = 4 + this.random() * 4;
            a.faceHeading = shop.face;
            a.onArrive = () => this.leave(a, pick(this.random, exits));
          });
          break;
        }
        this.leave(a, pick(this.random, exits));
        break;
      }
    }
  }

  /** Walks most of the way, stops short, looks, and turns back: need that never reaches the service. */
  private approachThenTurnBack(a: Agent, service: ServiceId): void {
    const full = routeTo(a.pos, SERVICE_NODES[service], a.offset);
    const goal = full[full.length - 1] ?? a.pos;
    // They stop where an officer's ring begins, if one stands by the service; otherwise just short of it.
    const radius = deterrenceRadius(this.sim.context.deterrence);
    const officer = this.officers.find((o) => o.visible && dist(o.pos, goal) < radius + 3);
    const stopShort = officer ? radius + dist(officer.pos, goal) : 4.5;
    this.walk(a, shortenRoute(a.pos, full, stopShort), () => {
      this.sim.turnBack(service, a.visitor!);
      a.mode = 'pausing';
      a.pauseLeft = 1.6;
      a.faceHeading = headingTo(a.pos, goal);
      a.onArrive = () => (service === 'clubHr' ? this.goToClubQueue(a) : this.leaveAnywhere(a));
    });
  }

  /**
   * Who tends to be out for each reason. Services draw from every group; the
   * mix only shifts (more ravers and students around the club and drug
   * checking, more people without stable housing at the shelter).
   */
  private styleFor(intent: Intent): Archetype {
    const mix = STYLE_MIX[intent] ?? STYLE_MIX.passerby!;
    // More visitors to the city in summer, fewer in winter.
    const tourists = SEASON_PROFILES[this.sim.season].tourists;
    return weighted(this.random, tourists === 1 ? mix : mix.map(([a, w]) => [a, a === 'tourist' ? w * tourists : w] as const));
  }

  private entryFor(intent: Intent): NodeId {
    // Everyone arrives from the district edge; club-goers mostly along the main street.
    const options: Partial<Record<Intent, NodeId[]>> = {
      club: ['wN2', 'eN2', 'wS2', 'eS2', 'nW', 'sW'],
    };
    return pick(this.random, options[intent] ?? ENTRY_NODES);
  }

  // Drop-in centre

  private arriveAtDropIn(a: Agent): void {
    const result = this.sim.arrive('dropIn', a.visitor!);
    if (result === 'admitted') this.enterDropIn(a);
    else if (result === 'queued') { a.mode = 'waiting'; a.service = 'dropIn'; }
    else this.crowdOutside(a, 'dropIn');
  }

  private enterDropIn(a: Agent): void {
    a.mode = 'walking';
    a.service = 'dropIn';
    a.pose = 'stand';
    this.walk(a, [SPOTS.centerFront, SPOTS.centerDoor, SPOTS.centerInside], () => this.hide(a));
  }

  // Outreach camper

  private arriveAtOutreach(a: Agent): void {
    const result = this.sim.arrive('outreach', a.visitor!);
    if (result === 'admitted') this.goToCounter(a);
    else if (result === 'queued') { a.mode = 'waiting'; a.service = 'outreach'; }
    else this.crowdOutside(a, 'outreach');
  }

  private goToCounter(a: Agent): void {
    const slot = this.freeCounter(a, 'outreach', SPOTS.camperCounters.length);
    a.mode = 'walking';
    a.service = 'outreach';
    a.pose = 'stand';
    a.service = 'outreach';
    a.staffPost = slot;
    this.walk(a, [SPOTS.camperCounters[slot]], () => {
      a.mode = 'served';
      a.pose = 'talk';
      a.faceHeading = -Math.PI / 2 + VENUE_ROT.outreach;
    });
  }

  // Club harm reduction stand and door queue

  private arriveAtStand(a: Agent): void {
    const result = this.sim.arrive('clubHr', a.visitor!);
    if (result === 'admitted') this.goToStandCounter(a);
    else if (result === 'queued') { a.mode = 'waiting'; a.service = 'clubHr'; }
    else {
      // Stand packed away: a brief look, then on to the club.
      a.mode = 'pausing';
      a.pauseLeft = 1.0;
      a.faceHeading = Math.PI + VENUE_ROT.club;
      a.onArrive = () => this.goToClubQueue(a);
    }
  }

  private goToStandCounter(a: Agent): void {
    const slot = this.freeCounter(a, 'clubHr', SPOTS.standCounter.length);
    a.mode = 'walking';
    a.service = 'clubHr';
    a.staffPost = slot;
    this.walk(a, [SPOTS.standCounter[slot]], () => {
      a.mode = 'served';
      a.pose = 'talk';
      a.faceHeading = Math.PI + VENUE_ROT.club;
    });
  }

  /** First counter spot no other visitor of this service is using or walking to. */
  private freeCounter(a: Agent, service: ServiceId, spots: number): number {
    const taken = new Set<number | undefined>();
    for (const o of this.agents.values()) {
      if (o !== a && !o.rig.look.staff && o.service === service && (o.mode === 'served' || (o.mode === 'walking' && o.staffPost !== undefined))) taken.add(o.staffPost);
    }
    for (let i = 0; i < spots; i++) if (!taken.has(i)) return i;
    return spots - 1;
  }

  private goToClubQueue(a: Agent): void {
    a.goal = 'club';
    a.service = undefined;
    a.staffPost = undefined;
    a.mode = 'walking';
    a.pose = 'stand';
    this.walk(a, routeTo(a.pos, SERVICE_NODES.club, a.offset), () => {
      if (this.sim.joinClubQueue(a.visitor!)) a.mode = 'clubQueue';
      else this.leaveAnywhere(a);
    });
  }

  private onClubAdmitted(visitor: VisitorId): void {
    const a = this.byVisitor.get(visitor);
    if (!a) return;
    a.mode = 'walking';
    this.walk(a, [SPOTS.clubDoor, SPOTS.clubInside], () => this.remove(a));
  }

  private spawnClubLeaver(intoxicated: boolean, acute: AcuteOutcome | null): void {
    if (this.agents.size >= MAX_PEOPLE) return;
    const a = this.createAgent(SPOTS.clubInside, 'clubgoer', { style: this.styleFor('club') });
    a.route = [SPOTS.clubDoor, SPOTS.clubExit];
    a.mode = 'walking';
    const exit = () => this.leaveAnywhere(a);
    if (acute) {
      // Collapses on the terrace after leaving; stand staff come over if they can.
      a.onArrive = () => this.walk(a, [TERRACE_COLLAPSE[a.id % TERRACE_COLLAPSE.length]], () => this.collapse(a, acute, exit));
      return;
    }
    if (!intoxicated) { a.onArrive = exit; return; }
    // Unsteady and slower; some sit down on the terrace bench for a while first.
    a.intoxicated = true;
    a.speed = 0.75;
    this.setMood(a, 'intoxicated', Infinity);
    a.onArrive = VENUES_AT_HOME && this.random() < 0.4
      ? () => this.walk(a, [TERRACE_BENCH[a.id % TERRACE_BENCH.length]], () => {
        a.mode = 'pausing';
        a.pose = 'sit';
        a.faceHeading = 0;
        a.pauseLeft = 8 + this.random() * 8;
        a.onArrive = () => { a.pose = 'stand'; exit(); };
      })
      : exit;
  }

  // Walk-in services in the wider district: queue by the door, go inside, come out.

  private arriveAtWalkIn(a: Agent, id: WalkInServiceId): void {
    const result = this.sim.arrive(id, a.visitor!);
    if (result === 'admitted') this.enterWalkIn(a, id);
    else if (result === 'queued') { a.mode = 'waiting'; a.service = id; }
    else this.crowdOutside(a, id);
  }

  private enterWalkIn(a: Agent, id: WalkInServiceId): void {
    a.mode = 'walking';
    a.service = id;
    a.pose = 'stand';
    // The foot patrol is a table on the pavement: people are served standing at it, in view.
    if (id === 'footPatrol') {
      const slot = this.freeCounter(a, 'footPatrol', PATROL.served.length);
      a.staffPost = slot;
      this.walk(a, [PATROL.served[slot]], () => {
        a.mode = 'served';
        a.pose = 'talk';
        a.faceHeading = PATROL.facing;
      });
      return;
    }
    this.walk(a, [LOTS[id].door, LOTS[id].inside], () => this.hide(a));
  }

  private exitWalkIn(a: Agent, id: WalkInServiceId): void {
    if (id === 'footPatrol') {
      a.mode = 'walking';
      a.goal = 'exit';
      a.staffPost = undefined;
      this.walk(a, [NODES[SERVICE_NODES.footPatrol]], () => this.leaveAnywhere(a));
      return;
    }
    this.show(a, LOTS[id].inside);
    a.mode = 'walking';
    a.goal = 'exit';
    this.walk(a, [LOTS[id].door, NODES[SERVICE_NODES[id]]], () => this.leaveAnywhere(a));
  }

  // Service outcomes

  private onAdmitted(service: ServiceId, visitor: VisitorId): void {
    const a = this.byVisitor.get(visitor);
    if (!a || a.mode !== 'waiting') return;
    if (a.satellite) return this.enterSatellite(a);
    if (service === 'dropIn') this.enterDropIn(a);
    else if (isWalkIn(service)) this.enterWalkIn(a, service);
    else if (service === 'outreach') this.goToCounter(a);
    else this.goToStandCounter(a);
  }

  private onServed(service: ServiceId, visitor: VisitorId): void {
    const a = this.byVisitor.get(visitor);
    if (!a) return;
    this.setMood(a, 'relieved', 12);
    if (a.satellite) return this.exitSatellite(a);
    if (service === 'dropIn') {
      const exit = () => {
        this.show(a, SPOTS.centerInside);
        a.mode = 'walking';
        a.goal = 'exit';
        this.walk(a, [SPOTS.centerDoor, SPOTS.centerFront], () => this.leaveAnywhere(a));
      };
      // Someone admitted is still walking in: let them reach the lobby first.
      if (a.mode === 'inside') exit();
      else a.onArrive = exit;
      return;
    }
    if (isWalkIn(service)) {
      // Someone admitted may still be walking in: let them reach the inside (or the table) first.
      if (a.mode === 'inside' || (service === 'footPatrol' && a.mode === 'served')) this.exitWalkIn(a, service);
      else a.onArrive = () => this.exitWalkIn(a, service);
      return;
    }
    if (service === 'clubHr') return this.goToClubQueue(a);
    this.leaveAnywhere(a);
  }

  private onLeftUnserved(service: ServiceId, visitor: VisitorId): void {
    const a = this.byVisitor.get(visitor);
    if (!a) return;
    if (service === 'clubHr') return this.goToClubQueue(a);
    this.leaveAnywhere(a);
  }

  // Staff

  private spawnStaff(service: ServiceId, post: number): void {
    const sources: Record<ServiceId, NodeId[]> = {
      dropIn: ['eN2', 'xN2'],
      outreach: ['eS2', 'xS2'],
      clubHr: ['wS2', 'sW'],
      footPatrol: ['eN2', 'wS2'],
      drugChecking: ['eN2', 'nE'],
      shelter: ['wS2', 'sW'],
      clinic: ['xS2', 'sE'],
    };
    const from = NODES[pick(this.random, sources[service])];
    const a = this.createAgent(from, 'staff');
    a.goal = 'post';
    a.service = service;
    a.staffPost = post;
    a.speed = 1.5;
    const arrive = () => {
      a.mode = 'post';
      this.sim.staffArrived(service);
    };
    if (service === 'footPatrol') {
      // On foot to the squat, then behind the table, facing the pavement.
      this.walk(a, [...routeTo(from, SERVICE_NODES.footPatrol, a.offset), PATROL.staff[Math.min(post, PATROL.staff.length - 1)]], () => { a.faceHeading = PATROL.facing + Math.PI; arrive(); });
    } else if (isWalkIn(service)) {
      const lot = LOTS[service];
      this.walk(a, [...routeTo(from, SERVICE_NODES[service], a.offset), lot.door, lot.inside], () => { this.hide(a); arrive(); });
    } else if (service === 'dropIn') {
      if (post === 0) this.walk(a, [...routeTo(from, SERVICE_NODES.dropIn, a.offset), SPOTS.centerGreeter], () => { a.faceHeading = 0.3 + VENUE_ROT.dropIn; arrive(); });
      else this.walk(a, [...routeTo(from, SERVICE_NODES.dropIn, a.offset), SPOTS.centerDoor, SPOTS.centerInside], () => { this.hide(a); arrive(); });
    } else if (service === 'outreach') {
      if (post === 0) {
        // Steps in through the rear door and appears at the service window.
        this.walk(a, [...routeTo(from, SERVICE_NODES.outreach, a.offset), SPOTS.camperRearApproach, SPOTS.camperRear], () => {
          a.pos = { ...SPOTS.camperStaffInside };
          a.faceHeading = Math.PI / 2 + VENUE_ROT.outreach;
          a.mode = 'post';
          this.sim.staffArrived(service);
        });
      } else {
        const outside = SPOTS.camperStaffOutside;
        this.walk(a, [...routeTo(from, SERVICE_NODES.outreach, a.offset), outside[Math.min(post - 1, outside.length - 1)]], () => { a.faceHeading = VENUE_ROT.outreach; arrive(); });
      }
    } else {
      this.walk(a, [...routeTo(from, SERVICE_NODES.clubHr, a.offset), SPOTS.standStaff[post]], () => { a.faceHeading = VENUE_ROT.club; arrive(); });
    }
  }

  /** Staff at `fromPost` and above leave; 0 releases everyone (service closing). */
  private releaseStaff(service: ServiceId, fromPost: number): void {
    this.staffQueue.splice(0, this.staffQueue.length, ...this.staffQueue.filter((s) => s.service !== service || s.post < fromPost));
    for (const a of this.agents.values()) {
      if (!a.rig.look.staff || a.service !== service || a.mode === 'leaving' || (a.staffPost ?? 0) < fromPost) continue;
      const wasOnPost = a.mode === 'post' || a.responding === true;
      a.responding = false;
      if (wasOnPost) this.sim.staffLeft(service);
      a.faceHeading = undefined;
      if (service === 'dropIn' && !a.visible) {
        this.show(a, SPOTS.centerInside);
        this.walk(a, [SPOTS.centerDoor, SPOTS.centerFront], () => this.leaveAnywhere(a));
        a.mode = 'leaving';
      } else if (isWalkIn(service) && !a.visible) {
        const lot = LOTS[service];
        this.show(a, lot.inside);
        this.walk(a, [lot.door, NODES[SERVICE_NODES[service]]], () => this.leaveAnywhere(a));
        a.mode = 'leaving';
      } else if (service === 'outreach' && wasOnPost && a.staffPost === 0) {
        a.pos = { ...SPOTS.camperRear };
        this.leave(a, pick(this.random, ['eN2', 'eS2'] as NodeId[]));
      } else {
        this.leave(a, pick(this.random, ENTRY_NODES));
      }
    }
  }

  // Movement helpers

  private createAgent(at: P2, role: PersonRole, look?: Partial<Appearance>): Agent {
    const base = randomAppearance(this.random, role === 'staff', look?.style ?? (role === 'resident' ? 'older' : 'everyday'), this.sim.season);
    // Context overrides (police, placards) drop the style's kit.
    const appearance = look && (look.police || look.placard) ? { ...base, ...look, kit: {} } : { ...base, ...look, style: base.style };
    // Sculpted figures when their assets have loaded; the simple figures otherwise.
    const lib = peopleLibrary();
    const rig: Figure = lib ? new HumanFigure(lib, appearance) : new CharacterRig(appearance);
    const dog = appearance.dog ? new Dog(this.nextId) : undefined;
    if (dog) rig.root.add(dog.root);
    const a: Agent = {
      id: this.nextId++,
      role,
      rig,
      pos: { x: at.x, z: at.z },
      heading: 0,
      speed: 1.05 + this.random() * 0.4,
      route: [],
      mode: 'walking',
      pose: 'stand',
      pauseLeft: 0,
      moodLeft: 0,
      offset: { x: (this.random() - 0.5) * 0.9, z: (this.random() - 0.5) * 0.9 },
      nudge: { x: 0, z: 0 },
      dog,
      visible: true,
    };
    this.agents.set(a.id, a);
    this.group.add(rig.root);
    return a;
  }

  private walk(a: Agent, route: P2[], onArrive: () => void): void {
    a.route = route.map((p) => ({ x: p.x, z: p.z }));
    a.onArrive = onArrive;
    if (a.mode !== 'leaving') a.mode = 'walking';
    a.faceHeading = undefined;
  }

  private leave(a: Agent, exit: NodeId): void {
    this.walk(a, routeTo(a.pos, exit, a.offset), () => this.remove(a));
    a.mode = 'leaving';
    a.goal = 'exit';
    a.pose = 'stand';
    // Staff keep their team so the UI can still say who is going off shift.
    if (a.role !== 'staff') a.service = undefined;
  }

  private leaveAnywhere(a: Agent): void {
    const after = a.aftermath;
    if (after) {
      a.aftermath = undefined;
      if (after.hiddenUse) return this.useInHiddenSpot(a, after.adverse, after.acute);
      if (after.adverse) return this.adverseHere(a, () => this.leaveAnywhere(a));
    }
    this.leave(a, pick(this.random, ENTRY_NODES));
  }

  /** Need went unmet: the person looks down-hearted; what follows is decided by the simulation. */
  private onAftermath(visitor: VisitorId, hiddenUse: boolean, adverse: boolean, acute: AcuteOutcome | null): void {
    const a = this.byVisitor.get(visitor);
    if (!a) return;
    this.setMood(a, 'unmet', 14);
    if (hiddenUse || adverse) a.aftermath = { hiddenUse, adverse, acute };
  }

  /**
   * Uses out of sight: walks to a hidden spot and sits on the ground for a while.
   * Where depends on policing: with officers on the street, people go further out of view.
   * Shown by posture only.
   */
  private useInHiddenSpot(a: Agent, adverse: boolean, acute: AcuteOutcome | null): void {
    const c = this.sim.context;
    const spots = c.patrol > 0 && c.patrolStyle !== 'clear' ? DEEP_SPOTS : NEAR_SPOTS;
    const spot = spots[a.id % spots.length];
    a.mode = 'leaving';
    this.walk(a, [...routeTo(a.pos, spot.node, a.offset), spot.at], () => {
      a.mode = 'pausing';
      a.ground = 'sit';
      a.pose = 'sit';
      a.faceHeading = spot.face;
      // Still the consequence of unmet need: keep the badge up so the person can be found in the dark.
      this.setMood(a, 'unmet', Infinity);
      a.pauseLeft = 14 + this.random() * 8;
      a.onArrive = () => {
        a.ground = undefined;
        a.pose = 'stand';
        this.setMood(a, 'unmet', 8);
        if (acute) this.collapse(a, acute, () => this.leaveAnywhere(a));
        else if (adverse) this.adverseHere(a, () => this.leaveAnywhere(a));
        else this.leaveAnywhere(a);
      };
    });
  }

  /** Adverse-outcome placeholder: lies in the recovery position for a while, then gets up and leaves. */
  private adverseHere(a: Agent, then: () => void): void {
    a.route = [];
    a.mode = 'pausing';
    a.ground = 'lying';
    a.pose = 'stand';
    a.pauseLeft = 15;
    this.setMood(a, 'adverse', Infinity);
    a.onArrive = () => {
      a.ground = undefined;
      this.setMood(a, 'unmet', 10);
      then();
    };
  }

  /**
   * Acute harm during a supply event (overdose, collapse). If the simulation
   * says staff reach the person, the nearest staff member of that service
   * leaves their post, stays with them, and returns; otherwise they lie alone
   * for longer. Counted by the simulation either way.
   */
  /** The club's door staff, while it is open. */
  private readonly bouncers: Agent[] = [];
  /** Seconds until a drunk club leaver next bothers someone. */
  private harassIn = 40;

  /** Two bouncers at the club door while the club is open; they go home when it shuts. */
  private syncBouncers(): void {
    const open = this.sim.clubOpen;
    if (!open) {
      for (const b of this.bouncers.splice(0)) this.leave(b, pick(this.random, ENTRY_NODES));
      return;
    }
    while (this.bouncers.length < 2 && this.agents.size < MAX_PEOPLE) {
      const i = this.bouncers.length;
      const door = SPOTS.clubDoor;
      const spot = { x: door.x + (i ? 0.9 : -0.9) * Math.cos(VENUE_ROT.club), z: door.z - (i ? 0.9 : -0.9) * Math.sin(VENUE_ROT.club) };
      const b = this.createAgent(spot, 'bouncer', { style: 'technoBlack' });
      b.mode = 'post';
      b.pose = 'stand';
      b.faceHeading = VENUE_ROT.club + Math.PI / 2;
      this.bouncers.push(b);
    }
  }

  /**
   * Now and then, while the club is open, a drunk club leaver bothers someone
   * nearby: both stop, the other person is upset, a bouncer turns to look.
   */
  private maybeHarass(dt: number): void {
    if (!this.sim.clubOpen || (this.harassIn -= dt) > 0) return;
    this.harassIn = 60 + this.random() * 90;
    for (const d of this.agents.values()) {
      // Drunk, or wired on stimulants and on edge.
      if (!(d.intoxicated || d.body === 'wired') || !d.visible || d.mode !== 'walking') continue;
      let target: Agent | undefined;
      let best = 6;
      for (const o of this.agents.values()) {
        if (o === d || !o.visible || o.role === 'police' || o.role === 'bouncer' || o.rig.look.staff || (o.mode !== 'walking' && o.mode !== 'leaving')) continue;
        const k = dist(o.pos, d.pos);
        if (k < best) { best = k; target = o; }
      }
      if (!target) continue;
      const other = target;
      this.holdFor(d, 5, headingTo(d.pos, other.pos));
      this.holdFor(other, 4, headingTo(other.pos, d.pos), () => this.setMood(other, 'adverse', 8));
      const watcher = this.bouncers[0];
      if (watcher) watcher.faceHeading = headingTo(watcher.pos, d.pos);
      this.sim.recordHarassment();
      return;
    }
  }

  /**
   * How someone's body shows what they took, decided once: visibly drunk club
   * leavers sway; half of the people using opioids fold forward and nod (and
   * walk slower); most on stimulants are tense and quick; a third on MDMA trip,
   * looking up and around. Everyone else walks as usual.
   */
  private settleBody(a: Agent): void {
    const use = a.visitor !== undefined ? this.sim.substanceOf(a.visitor) : undefined;
    const roll = (a.id * 2654435761 % 1000) / 1000;
    const body: BodyState = a.intoxicated ? 'drunk'
      : use === 'opioid' && roll < 0.5 ? 'nod'
        : (use === 'stimulant' || use === 'cocaine') && roll < 0.65 ? 'wired'
          : use === 'mdma' && roll < 0.35 ? 'trip'
            : 'normal';
    a.body = body;
    if (body === 'nod') a.speed *= 0.6;
    else if (body === 'wired') a.speed *= 1.35;
    a.rig.setBodyState(body);
  }

  /** Shows what happened to someone where it happened (a badge rising): set by the game. */
  onMark: ((at: P2, icon: 'skull' | 'cuffs' | 'cross') => void) | null = null;

  private collapse(a: Agent, acute: AcuteOutcome, then: () => void): void {
    this.onMark?.(a.pos, 'cross');
    // An overdose or collapse: an ambulance is called to the nearest road.
    this.world.dispatch('ambulance', a.pos.x, a.pos.z, acute.helpedBy
      ? t('Someone collapsed in the street, an overdose or a bad reaction. Staff from a service reached them and called it in.')
      : t('Someone collapsed in the street, an overdose or a bad reaction. Nobody from the services was near; a passer-by called it in.'));
    a.route = [];
    a.mode = 'pausing';
    a.ground = 'lying';
    a.pose = 'stand';
    this.setMood(a, 'adverse', Infinity);
    const responder = acute.helpedBy ? this.findResponder(acute.helpedBy) : undefined;
    a.pauseLeft = responder ? 16 : 26;
    a.onArrive = () => {
      a.ground = undefined;
      this.setMood(a, responder ? 'relieved' : 'unmet', 10);
      then();
    };
    if (!responder) return;
    const post = { ...responder.pos };
    const postFace = responder.faceHeading;
    responder.responding = true;
    responder.mode = 'walking';
    responder.speed = 2.2;
    const beside = { x: a.pos.x + 0.6, z: a.pos.z + 0.3 };
    this.walk(responder, [beside], () => {
      responder.mode = 'pausing';
      responder.pose = 'talk';
      responder.faceHeading = headingTo(responder.pos, a.pos);
      responder.pauseLeft = 12;
      responder.onArrive = () => {
        responder.pose = 'stand';
        this.walk(responder, [post], () => {
          responder.mode = 'post';
          responder.responding = false;
          responder.speed = 1.5;
          responder.faceHeading = postFace;
        });
      };
    });
  }

  /** A visible staff member at a post of this service (not the one inside the camper). */
  private findResponder(service: ServiceId): Agent | undefined {
    for (const s of this.agents.values()) {
      if (!s.rig.look.staff || s.service !== service || s.mode !== 'post' || !s.visible || s.responding) continue;
      if (service === 'outreach' && s.staffPost === 0) continue;
      return s;
    }
    return undefined;
  }

  private setMood(a: Agent, mood: Mood, seconds: number): void {
    a.mood = mood;
    a.moodLeft = seconds;
  }

  /**
   * No room (queue full) or not open yet: rather than vanish, people gather
   * in a loose crowd past the end of the line, wait a while hoping for a
   * place, then give up. Unmet demand is something you can see on the street.
   */
  private crowdOutside(a: Agent, service: ServiceId): void {
    const { at, along, door } = this.overflowArea(service);
    // A crowd of a handful reads as "full"; past that, newcomers glance over and move on.
    let waiting = 0;
    for (const o of this.agents.values()) if (o.crowding === service) waiting++;
    if (waiting >= MAX_CROWD) {
      a.mode = 'pausing';
      a.pauseLeft = 1.5;
      a.faceHeading = headingTo(a.pos, door);
      a.onArrive = () => this.leaveAnywhere(a);
      return;
    }
    // Scatter over a patch that starts past the line and widens away from it.
    const back = 0.8 + this.random() * 3.2;
    const side = (this.random() - 0.5) * (2.4 + back * 1.1);
    const spot = { x: at.x + along.x * back - along.z * side, z: at.z + along.z * back + along.x * side };
    a.crowding = service;
    // A closed door gets a shorter wait than a full one.
    const closed = this.sim.services[service].status !== 'open';
    this.walk(a, [spot], () => {
      a.mode = 'pausing';
      // Sim seconds: up to most of a clock hour at 1x before they give up.
      a.pauseLeft = closed ? 8 + this.random() * 10 : 20 + this.random() * 25;
      a.faceHeading = headingTo(a.pos, door);
      a.onArrive = () => {
        a.crowding = undefined;
        this.leaveAnywhere(a);
      };
    });
  }

  /** Where the crowd for a service gathers: the end of its line, which way it grows, and the door it watches. */
  private overflowArea(service: ServiceId): { at: P2; along: P2; door: P2 } {
    const slots = this.sim.services[service].params.waitingSlots;
    if (service === 'outreach') return { at: queueSlot(SPOTS.camperQueueHead, CAMPER_QUEUE_DIR, 0.8, slots), along: CAMPER_QUEUE_DIR, door: SPOTS.camperCounters[0] };
    if (service === 'clubHr') return { at: queueSlot(SPOTS.standQueueHead, STAND_QUEUE_DIR, 0.75, slots), along: STAND_QUEUE_DIR, door: SPOTS.standQueueHead };
    if (service === 'dropIn') return { at: SPOTS.centerQueue, along: CENTER_QUEUE_DIR, door: SPOTS.centerDoor };
    const lot = LOTS[service];
    return { at: queueSlot(lot.queueHead, lot.queueDir, 0.8, slots), along: lot.queueDir, door: lot.door };
  }

  private hide(a: Agent): void {
    a.mode = a.rig.look.staff ? a.mode : 'inside';
    a.visible = false;
    a.rig.root.visible = false;
  }

  private show(a: Agent, at: P2): void {
    a.pos = { x: at.x, z: at.z };
    a.visible = true;
    a.rig.root.visible = true;
  }

  private remove(a: Agent): void {
    this.icons.release(a.id);
    if (a.visitor !== undefined) this.sim.forget(a.visitor);
    this.agents.delete(a.id);
    if (a.visitor !== undefined) this.byVisitor.delete(a.visitor);
    this.group.remove(a.rig.root);
    a.rig.dispose();
  }

  // Context people: police and residents with placards

  /** Keeps officers and residents in step with the simulation's context; cheap when nothing changed. */
  private syncContextPeople(): void {
    const c = this.sim.context;
    const key = `${c.patrol}:${c.patrolStyle}`;
    if (key !== this.patrolKey) {
      this.patrolKey = key;
      for (const o of this.officers.splice(0)) this.leave(o, pick(this.random, ENTRY_NODES));
    }
    // Refills after an officer leaves with someone under arrest.
    while (this.officers.length < c.patrol) this.officers.push(this.spawnOfficer(this.officers.length, c.patrolStyle));
    while (this.residents.length > c.placards) this.leave(this.residents.pop()!, pick(this.random, ['xN2', 'eN2'] as NodeId[]));
    while (this.residents.length < c.placards) this.residents.push(this.spawnResident(this.residents.length));
    if (!this.restingPlaced) this.placeResting();
    this.syncStreetPeople();
  }

  /** A few people resting on street benches with their belongings, there from the start. */
  private placeResting(): void {
    this.restingPlaced = true;
    for (const spot of RESTING_SPOTS) {
      const a = this.createAgent(spot.at, 'passerby', { style: 'unhoused' });
      a.resting = true;
      a.mode = 'standing';
      a.ground = 'sit';
      a.pose = 'sit';
      a.faceHeading = spot.face;
      a.heading = spot.face;
    }
  }

  /**
   * Street people that follow the neighbourhood state: sellers where a market
   * has formed (moved, not removed, by posted police) and people sleeping rough
   * by the drop-in when it is closed.
   */
  private syncStreetPeople(): void {
    const n = this.sim.neighbourhood.state;
    const c = this.sim.context;
    const spots = c.patrol > 0 && c.patrolStyle === 'posted' ? 'displaced' : 'near';
    if (spots !== this.sellerSpots) {
      this.sellerSpots = spots;
      for (const s of this.sellers.splice(0)) this.leave(s, pick(this.random, ENTRY_NODES));
    }
    // There is always a corner where drugs change hands, however quiet; a busy market adds a second seller.
    const sellers = n.streetMarket > 0.55 ? 2 : 1;
    while (this.sellers.length > sellers) this.leave(this.sellers.pop()!, pick(this.random, ENTRY_NODES));
    while (this.sellers.length < sellers) this.sellers.push(this.spawnStreetFigure('seller', MARKET_SPOTS[spots][this.sellers.length]));
    while (this.sleepers.length > n.roughSleepers) {
      const s = this.sleepers.pop()!;
      s.ground = undefined;
      s.pose = 'stand';
      this.leave(s, pick(this.random, ENTRY_NODES));
    }
    while (this.sleepers.length < n.roughSleepers) this.sleepers.push(this.spawnStreetFigure('sleeper', SLEEP_SPOTS[this.sleepers.length]));
  }

  /** Where the police officers on foot stand now (visible ones). */
  officerSpots(): P2[] {
    return this.officers.filter((o) => o.visible).map((o) => ({ x: o.pos.x, z: o.pos.z }));
  }

  /** Someone visible within 6 m ahead of a car at (x, z) heading (dx, dz), and within 1.6 m of its path. */
  someoneAhead(x: number, z: number, dx: number, dz: number): boolean {
    for (const a of this.agents.values()) {
      if (!a.visible) continue;
      const rx = a.pos.x - x;
      const rz = a.pos.z - z;
      const along = rx * dx + rz * dz;
      if (along < 1 || along > 6) continue;
      if (Math.abs(rx * dz - rz * dx) < 1.6) return true;
    }
    return false;
  }

  /** Winter: now and then someone with their belongings walks to the squat and goes in. */
  private moveIntoSquat(dt: number): void {
    if (this.sim.season !== 'winter' || this.sim.camp.squat >= 1) return;
    this.squatTimer -= dt;
    if (this.squatTimer > 0 || this.agents.size >= MAX_PEOPLE) return;
    this.squatTimer = 25 + this.random() * 25;
    const door = this.squatDoor();
    if (!door) return;
    const a = this.createAgent(NODES[pick(this.random, ENTRY_NODES)], 'passerby', { style: 'unhoused', extra: 'backpack' });
    this.walk(a, [...routeTo(a.pos, nearestNode(door), a.offset), door], () => this.remove(a));
  }

  /** A squat's door (one of them, at random): on the wall nearest the pavement it faces. */
  private squatDoor(): P2 | null {
    const b = this.squats.length ? cityBuilding(pick(this.random, this.squats)) : undefined;
    if (!b) return null;
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    const node = NODES[nearestNode({ x: cx, z: cz })];
    const wall = { x: Math.min(b.x1, Math.max(b.x0, node.x)), z: Math.min(b.z1, Math.max(b.z0, node.z)) };
    const away = Math.hypot(node.x - wall.x, node.z - wall.z) || 1;
    return { x: wall.x + ((node.x - wall.x) / away) * 0.6, z: wall.z + ((node.z - wall.z) / away) * 0.6 };
  }

  private spawnStreetFigure(role: 'seller' | 'sleeper', spot: { node: NodeId; at: P2; face: number }): Agent {
    const a = this.createAgent(NODES[pick(this.random, ENTRY_NODES)], role, role === 'sleeper' ? { style: 'unhoused', extra: 'backpack' } : {});
    a.role = role;
    this.walk(a, [...routeTo(a.pos, spot.node, a.offset), spot.at], () => {
      a.mode = 'standing';
      a.faceHeading = spot.face;
      if (role === 'sleeper') a.pose = 'sit';
    });
    return a;
  }

  /** Now and then someone walking past stops briefly with a seller. Nothing is counted. */
  private streetEncounters(dt: number): void {
    if (!this.sellers.length || (this.encounterTimer -= dt) > 0) return;
    this.encounterTimer = 10 + this.random() * 15;
    const seller = this.sellers.find((s) => s.mode === 'standing');
    if (!seller) return;
    for (const a of this.agents.values()) {
      if (SPECIAL_ROLES.has(a.role) || a.rig.look.staff || a.visitor === undefined || !a.visible || (a.mode !== 'walking' && a.mode !== 'leaving')) continue;
      if (dist(a.pos, seller.pos) > 5) continue;
      this.holdFor(a, 3, headingTo(a.pos, seller.pos));
      return;
    }
  }

  private spawnOfficer(i: number, style: PatrolStyle): Agent {
    // Officers walk in from the district edge along the main street.
    const from = NODES[i % 2 ? 'eN2' : 'wN2'];
    const a = this.createAgent(from, 'police', { police: true, top: PALETTE.policeVest, bottom: PALETTE.policeVest, extra: 'none' });
    a.speed = 1.1;
    if (style === 'posted') {
      // Posted at the drop-in path and by the outreach camper, watching who comes.
      const posts = policePosts();
      const post = posts[i % posts.length];
      this.walk(a, [...routeTo(a.pos, post.node, a.offset), post.at], () => { a.mode = 'standing'; a.faceHeading = post.face; });
    } else {
      this.patrol(a, style === 'beat' ? BEAT : CLEAR_BEAT, i % 2);
    }
    return a;
  }

  private patrol(a: Agent, beat: readonly NodeId[], step: number): void {
    const next = beat[step % beat.length];
    this.walk(a, routeTo(a.pos, next, a.offset), () => {
      a.mode = 'pausing';
      a.pauseLeft = 2 + this.random() * 3;
      a.onArrive = () => this.patrol(a, beat, step + 1);
    });
  }

  private spawnResident(i: number): Agent {
    const spot = PLACARD_SPOTS[i % PLACARD_SPOTS.length];
    const a = this.createAgent(NODES[i % 2 ? 'xN2' : 'eN2'], 'resident', { placard: true, extra: 'none' });
    this.walk(a, [...routeTo(a.pos, SERVICE_NODES.dropIn, a.offset), spot], () => { a.mode = 'standing'; a.faceHeading = Math.PI + VENUE_ROT.dropIn; });
    return a;
  }

  /** A possession stop: an officer and the nearest person walking past pause together. Counted only if it happens. */
  private policeStop(arrest: boolean): void {
    for (const o of this.officers) {
      if (!o.visible || o.mode === 'leaving') continue;
      let best: Agent | undefined;
      let bestD = 6;
      for (const a of this.agents.values()) {
        if (a.role === 'police' || a.role === 'resident' || a.rig.look.staff || a.visitor === undefined || !a.visible || (a.mode !== 'walking' && a.mode !== 'leaving')) continue;
        const d = dist(a.pos, o.pos);
        if (d < bestD) { best = a; bestD = d; }
      }
      if (!best) continue;
      const person = best;
      if (arrest) {
        // Both walk off to the district edge together; a replacement officer comes on duty.
        this.officers.splice(this.officers.indexOf(o), 1);
        const exit = pick(this.random, ENTRY_NODES);
        person.aftermath = undefined;
        this.onMark?.(person.pos, 'cuffs');
        this.holdFor(person, 4, headingTo(person.pos, o.pos), () => { this.setMood(person, 'unmet', Infinity); this.leave(person, exit); });
        this.holdFor(o, 4.6, headingTo(o.pos, person.pos), () => this.leave(o, exit));
      } else {
        this.holdFor(person, 4, headingTo(person.pos, o.pos));
        this.holdFor(o, 4, headingTo(o.pos, person.pos));
      }
      this.sim.recordPoliceStop(arrest);
      return;
    }
  }

  /** Pauses an agent where it is, then resumes exactly what it was doing (or runs `then`). */
  private holdFor(a: Agent, seconds: number, face: number, then?: () => void): void {
    const route = a.route;
    const next = a.onArrive;
    const mode = a.mode;
    a.route = [];
    a.mode = 'pausing';
    a.pauseLeft = seconds;
    a.pose = 'talk';
    a.faceHeading = face;
    a.onArrive = () => {
      a.pose = 'stand';
      if (then) { a.faceHeading = undefined; return then(); }
      a.route = route;
      a.onArrive = next;
      a.faceHeading = mode === 'standing' ? face : undefined;
      if (mode === 'leaving' || mode === 'standing') a.mode = mode;
    };
  }

  // Cars

  private spawnCar(): void {
    if (this.cars.length >= MAX_CARS) return;
    const last = this.cars[this.cars.length - 1];
    if (last && last.z < -CAR_RUN + 6 + last.half) return;
    const group = car(pick(this.random, CAR_COLOURS), true);
    group.position.set(ROAD.laneX, 0.02, -CAR_RUN);
    this.world.scene.add(group);
    this.cars.push({ group, z: -CAR_RUN, speed: 5.5, half: 2, cruise: 4.5 + this.random() * 2.8, rec: this.world.traffic.add(2.2) });
  }

  // City life: night bus, cleaners, street incidents

  private onCity(h: CityHappening): void {
    if (h.kind === 'bus') return this.spawnBus();
    if (h.kind === 'cleaners') return this.spawnCleaners();
    this.onCrime(h.crime, h.responded);
  }

  private spawnBus(): void {
    // One night bus on the street at a time: the next waits for this one to be gone.
    if (this.cars.some((c) => c.stopAt !== undefined)) return;
    const last = this.cars[this.cars.length - 1];
    if (last && last.z < -CAR_RUN + 8 + last.half) return;
    const group = bus();
    const z = -CAR_RUN - 2.5;
    group.position.set(ROAD.laneX, 0.02, z);
    this.world.scene.add(group);
    this.cars.push({ group, z, speed: 5, half: 4.5, cruise: 5, stopAt: BUS_STOP_Z, stopLeft: 7, rec: this.world.traffic.add(5.2) });
  }

  /** The bus is at the stop: people waiting board, and a few people get off. */
  private busArrived(): void {
    for (const a of this.agents.values()) {
      if (!a.waitingForBus) continue;
      a.waitingForBus = false;
      a.pauseLeft = 0;
      a.onArrive = undefined;
      a.mode = 'leaving';
      this.walk(a, [{ x: ROAD.x0 + 0.2, z: BUS_STOP_Z + 1.5 }], () => this.remove(a));
      a.mode = 'leaving';
    }
    const off = Math.floor(this.random() * 3);
    for (let i = 0; i < off && this.agents.size < MAX_PEOPLE; i++) {
      const a = this.createAgent({ x: ROAD.x0 + 0.2, z: BUS_STOP_Z + 1.5 + i * 0.4 }, 'passerby');
      this.leave(a, pick(this.random, ENTRY_NODES));
    }
  }

  /** Council cleaners sweep the park corners at 05:00 (the simulation clears discarded equipment and graffiti). */
  private spawnCleaners(): void {
    for (let i = 0; i < 2; i++) {
      const a = this.createAgent(NODES[i ? 'parkFront' : 'pathEast'], 'cleaner', { staff: true, vestColour: 0xe8862a });
      a.role = 'cleaner';
      a.speed = 0.9;
      const corners = i ? [{ x: 9.6, z: 13.6 }, { x: 4.2, z: 12.6 }] : [{ x: 14.2, z: 14.0 }, { x: 12.4, z: 9.8 }];
      this.walk(a, [...routeTo(a.pos, 'park', a.offset), ...corners], () => this.leave(a, pick(this.random, ['parkEast', 'parkFront'] as NodeId[])));
    }
  }

  /** Street incidents: a scuffle at the club exit, a pickpocketing victim, and officers walking over. Theft, alarms and graffiti are world props. */
  private onCrime(crime: string, responded: boolean): void {
    let site: P2 = SPOTS.clubExit;
    if (responded) this.world.dispatch('police', site.x, site.z, CRIME_CALL[crime] ?? t('Called to an incident in the district.'));
    if (crime === 'scuffle') {
      const near = [...this.agents.values()].filter((a) => !SPECIAL_ROLES.has(a.role) && !a.rig.look.staff && a.visible && (a.mode === 'walking' || a.mode === 'leaving') && dist(a.pos, SPOTS.clubExit) < 7).slice(0, 2);
      if (near.length === 2) {
        site = near[0].pos;
        this.holdFor(near[0], 5, headingTo(near[0].pos, near[1].pos));
        this.holdFor(near[1], 5, headingTo(near[1].pos, near[0].pos));
        this.setMood(near[0], 'unmet', 8);
        this.setMood(near[1], 'unmet', 8);
      }
    } else if (crime === 'pickpocket') {
      const victim = [...this.agents.values()].find((a) => !SPECIAL_ROLES.has(a.role) && !a.rig.look.staff && a.visible && a.mode !== 'inside' && (a.mode === 'clubQueue' || a.dancing));
      if (victim) {
        site = victim.pos;
        this.setMood(victim, 'unmet', 10);
      }
    } else if (crime === 'bikeTheft') site = { x: -8.9, z: 11 };
    else if (crime === 'carBreakIn') site = { x: ROAD.parkX + 1.4, z: 10.1 };
    if (!responded) return;
    // The nearest patrolling officer walks over, stays a moment, then resumes the beat.
    const officer = this.officers.filter((o) => o.mode !== 'leaving' && o.mode !== 'standing').sort((p, q) => dist(p.pos, site) - dist(q.pos, site))[0];
    if (!officer) return;
    const beat = this.sim.context.patrolStyle === 'beat' ? BEAT : CLEAR_BEAT;
    this.walk(officer, [{ x: site.x + 0.8, z: site.z + 0.4 }], () => {
      officer.mode = 'pausing';
      officer.pose = 'talk';
      officer.faceHeading = headingTo(officer.pos, site);
      officer.pauseLeft = 6;
      officer.onArrive = () => { officer.pose = 'stand'; this.patrol(officer, beat, 0); };
    });
  }

  /** Which main-street zebras have someone on them or about to step out. */
  private busyCrossings(): boolean[] {
    const busy = MAIN_CROSSINGS.map(() => false);
    for (const a of this.agents.values()) {
      if (!a.visible || (a.mode !== 'walking' && a.mode !== 'leaving')) continue;
      if (a.pos.x < ROAD.x0 - 0.9 || a.pos.x > ROAD.x1 + 0.9) continue;
      MAIN_CROSSINGS.forEach((c, i) => {
        if (busy[i] || a.pos.z < c.z0 - 0.6 || a.pos.z > c.z1 + 0.6) return;
        const next = a.route[0];
        if (a.pos.x > ROAD.x0 - 0.1 && a.pos.x < ROAD.x1 + 0.1) busy[i] = true;
        else if (next && (next.x - a.pos.x) * (a.pos.x - (ROAD.x0 + ROAD.x1) / 2) < 0 && Math.abs(next.z - a.pos.z) < 1.2) busy[i] = true;
      });
    }
    return busy;
  }

  private updateCars(dt: number): void {
    const busy = this.busyCrossings();
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      const front = c.z + c.half;
      let target = c.cruise;
      // Give way at the first busy zebra ahead.
      MAIN_CROSSINGS.forEach((x, k) => {
        const stopLine = x.z0 - 1.2;
        if (busy[k] && front < stopLine + 0.1 && front > stopLine - 9) target = Math.min(target, Math.max(0, (stopLine - front) * 1.2));
      });
      if (c.stopAt !== undefined && c.stopLeft !== undefined && c.stopLeft > 0) {
        // The bus pulls in at the shelter, waits, then goes on.
        const toStop = c.stopAt - c.z;
        if (toStop < 0.3) {
          if (c.speed < 0.2 && c.stopLeft === 7) this.busArrived();
          if (c.speed < 0.2) c.stopLeft -= dt;
          target = 0;
        } else target = Math.min(target, toStop * 1.2);
      }
      // Anyone in the lane just ahead (at a zebra or not): stop short of them. Someone in the
      // parking lane (by the camper, say) is beside the car, not in its way.
      for (const a of this.agents.values()) {
        if (!a.visible || Math.abs(a.pos.x - ROAD.laneX) > 1.6) continue;
        const gap = a.pos.z - front;
        if (gap > -0.5 && gap < 7) target = Math.min(target, Math.max(0, (gap - 1.5) * 1.2));
      }
      const ahead = this.cars[i - 1];
      if (ahead) target = Math.min(target, Math.max(0, (ahead.z - c.z - ahead.half - c.half - 2) * 1.5));
      // Cross traffic on the side streets: wait for it at the junction.
      Object.assign(c.rec, { x: ROAD.laneX, z: c.z, dx: 0, dz: 1, active: true });
      const gap = this.world.traffic.gapAhead(c.rec);
      target = Math.min(target, speedForGap(c.cruise, gap));
      c.speed = gap < 1.2 ? 0 : approach(c.speed, target, 3, dt);
      stood(c.rec, c.speed, dt);
      c.z += c.speed * dt;
      rollWheels(c.group, c.speed * dt);
      c.group.position.z = c.z;
    }
    while (this.cars.length && this.cars[0].z > CAR_RUN) {
      const gone = this.cars.shift()!;
      this.world.scene.remove(gone.group);
      this.world.traffic.remove(gone.rec);
    }
  }

  // Per-frame update

  update(dt: number): void {
    this.clock += dt;
    this.syncContextPeople();
    this.moveIntoSquat(dt);
    this.ringAt.length = 0;
    for (const o of this.officers) if (o.visible && o.mode !== 'leaving') this.ringAt.push(o.pos);
    this.rings.update(this.ringAt, deterrenceRadius(this.sim.context.deterrence));
    this.streetEncounters(dt);
    this.syncBouncers();
    this.maybeHarass(dt);
    for (const s of this.staffQueue) s.delay -= dt;
    for (let i = this.staffQueue.length - 1; i >= 0; i--) {
      const s = this.staffQueue[i];
      if (s.delay <= 0) {
        this.staffQueue.splice(i, 1);
        this.spawnStaff(s.service, s.post);
      }
    }
    this.assignQueueSpots();
    this.updateCars(dt);
    this.giveWay(dt);

    const doorDrop = SPOTS.centerDoor;
    const doorClub = SPOTS.clubDoor;
    for (const a of this.agents.values()) {
      this.step(a, dt);
      // Walked off the edge during this step: removed (glow released); placing them now would bring the glow back for good.
      if (!this.agents.has(a.id)) continue;
      if (!a.visible) { this.icons.release(a.id); continue; }
      if (dist(a.pos, doorDrop) < 1.3 && a.route.length) this.world.locations.dropIn.openDoor();
      if (dist(a.pos, doorClub) < 1.2 && a.route.length) this.world.locations.club.openDoor();
      if (a.route.length) for (const id of WALK_IN_SERVICE_IDS) if (dist(a.pos, LOTS[id].door) < 1.3) this.world.locations[id].openDoor();
      this.place(a, dt);
    }
  }

  /** Keep queued people on their slots as the line moves up. */
  private assignQueueSpots(): void {
    const dropOrder = this.sim.services.dropIn.queueOrder();
    const outOrder = this.sim.services.outreach.queueOrder();
    const standOrder = this.sim.services.clubHr.queueOrder();
    const clubOrder = this.sim.club.queue;
    for (const a of this.agents.values()) {
      // Satellite visitors wait at their own door, not in the main line.
      if (a.visitor === undefined || a.satellite) continue;
      let spot: P2 | undefined;
      let face = 0;
      let pose: Pose = 'stand';
      if (a.mode === 'waiting' && a.service === 'dropIn') {
        const i = dropOrder.indexOf(a.visitor);
        if (i < 0) continue;
        const seats = SPOTS.centerSeats;
        spot = i < seats.length ? seats[i] : SPOTS.centerStanding[(i - seats.length) % SPOTS.centerStanding.length];
        pose = i < seats.length ? 'sit' : 'stand';
        face = (i < seats.length ? 0 : Math.PI * 0.9) + VENUE_ROT.dropIn;
      } else if (a.mode === 'waiting' && a.service === 'outreach') {
        const i = outOrder.indexOf(a.visitor);
        if (i < 0) continue;
        spot = queueSlot(SPOTS.camperQueueHead, CAMPER_QUEUE_DIR, 0.8, i);
        face = Math.PI + VENUE_ROT.outreach;
      } else if (a.mode === 'waiting' && a.service === 'clubHr') {
        const i = standOrder.indexOf(a.visitor);
        if (i < 0) continue;
        spot = queueSlot(SPOTS.standQueueHead, STAND_QUEUE_DIR, 0.75, i);
        face = -Math.PI / 2 + VENUE_ROT.club;
      } else if (a.mode === 'waiting' && isWalkIn(a.service)) {
        const lot = LOTS[a.service];
        const i = this.sim.services[a.service].queueOrder().indexOf(a.visitor);
        if (i < 0) continue;
        spot = queueSlot(lot.queueHead, lot.queueDir, 0.8, i);
        face = headingTo(spot, lot.door);
      } else if (a.mode === 'clubQueue') {
        const i = clubOrder.indexOf(a.visitor);
        if (i < 0) continue;
        spot = queueSlot(SPOTS.clubQueueHead, CLUB_QUEUE_DIR, 0.72, i);
        face = Math.PI + VENUE_ROT.club;
      } else {
        continue;
      }
      const goal = a.route[a.route.length - 1] ?? a.pos;
      if (dist(goal, spot) > 0.05) {
        a.route = [{ x: spot.x, z: spot.z }];
        a.pose = 'stand';
      } else if (a.route.length === 0) {
        a.pose = pose;
        a.faceHeading = face;
      }
    }
  }

  private step(a: Agent, dt: number): void {
    if (a.mode === 'pausing') {
      a.pauseLeft -= dt;
      if (a.pauseLeft <= 0) {
        const next = a.onArrive;
        a.onArrive = undefined;
        a.mode = 'walking';
        next?.();
      }
    } else if (a.route.length) {
      const target = a.route[0];
      const dx = target.x - a.pos.x;
      const dz = target.z - a.pos.z;
      const d = Math.hypot(dx, dz);
      const move = a.speed * dt;
      if (d <= move) {
        a.pos = { x: target.x, z: target.z };
        a.route.shift();
      } else {
        a.pos = { x: a.pos.x + (dx / d) * move, z: a.pos.z + (dz / d) * move };
      }
      if (d > 0.02) a.heading = turn(a.heading, Math.atan2(dx, dz), 10, dt);
      if (!a.route.length && a.onArrive && a.mode !== 'clubQueue' && a.mode !== 'waiting') {
        const cb = a.onArrive;
        a.onArrive = undefined;
        cb();
      }
    }
    if (a.faceHeading !== undefined && !a.route.length) a.heading = turn(a.heading, a.faceHeading, 5, dt);
    const moving = a.route.length > 0;
    if (a.body === undefined) this.settleBody(a);
    a.rig.update(dt, moving ? 'walk' : a.dancing ? 'dance' : a.pose === 'walk' ? 'stand' : a.pose, a.speed);
    a.dog?.update(dt, moving, false);
  }

  /**
   * Keeps bodies from passing through each other, street furniture and
   * moving cars. Only where a figure is drawn moves (a smoothed nudge off its
   * path); routes, queues and the simulation are untouched, so nothing here
   * can change an outcome. People who are seated, lying or at a post are
   * anchored: they push others but are not pushed. O(n^2) over at most
   * MAX_PEOPLE, plus a grid lookup each: well under a tenth of a millisecond.
   */
  private giveWay(dt: number): void {
    const list = this.giveWayList;
    list.length = 0;
    for (const a of this.agents.values()) if (a.visible) list.push(a);
    const push = this.pushScratch;
    // Resolve overlaps over a few frames; never more than fully in one step.
    const gain = Math.min(1, dt * 30);
    const relax = Math.max(0, 1 - dt * 1.6);
    const cars = this.cars.map((c) => movingBox(c.group.position.x, c.group.position.z, c.group.rotation.y, 2.0, 4.8));
    for (const a of list) {
      const anchored = this.anchored(a);
      if (anchored) {
        a.nudge.x *= relax;
        a.nudge.z *= relax;
        continue;
      }
      push.x = 0;
      push.z = 0;
      const ax = a.pos.x + a.nudge.x;
      const az = a.pos.z + a.nudge.z;
      const walking = a.route.length > 0;
      // Other people: about 0.32 m of personal space each.
      for (const b of list) {
        if (b === a) continue;
        const dx = ax - (b.pos.x + b.nudge.x);
        const dz = az - (b.pos.z + b.nudge.z);
        const d2 = dx * dx + dz * dz;
        if (d2 >= PERSONAL_SPACE * PERSONAL_SPACE || d2 < 1e-8) continue;
        const d = Math.sqrt(d2);
        // An anchored or standing person holds their place; the walker steps round.
        const share = this.anchored(b) ? 1 : walking && b.route.length === 0 ? 0.8 : 0.5;
        const depth = (PERSONAL_SPACE - d) * share;
        push.x += (dx / d) * depth;
        push.z += (dz / d) * depth;
      }
      // Furniture and parked cars, except in the last metre of a walk (to reach a seat).
      const end = a.route[a.route.length - 1];
      const arriving = end && Math.hypot(end.x - a.pos.x, end.z - a.pos.z) < 1;
      if (!arriving) this.world.solids.push(ax, az, BODY_RADIUS, push);
      for (const c of cars) pushFromBox(c, ax, az, BODY_RADIUS, push);
      a.nudge.x = a.nudge.x * relax + push.x * gain;
      a.nudge.z = a.nudge.z * relax + push.z * gain;
      const n = Math.hypot(a.nudge.x, a.nudge.z);
      if (n > MAX_NUDGE) {
        a.nudge.x *= MAX_NUDGE / n;
        a.nudge.z *= MAX_NUDGE / n;
      }
    }
  }

  /** Seated, lying, inside the camper or at a staff post: held in place. */
  private anchored(a: Agent): boolean {
    if (a.ground) return true;
    if (a.pose === 'sit' && !a.route.length) return true;
    return a.mode === 'post' && !a.route.length;
  }

  private place(a: Agent, dt: number): void {
    const root: Object3D = a.rig.root;
    const inCamper = a.rig.look.staff && a.service === 'outreach' && a.staffPost === 0 && a.mode === 'post';
    const seated = a.pose === 'sit' && !a.route.length;
    // Dancing: the sculpted figures dance; the simple figures bob to the beat instead.
    const bob = a.dancing && a.rig instanceof CharacterRig ? Math.abs(Math.sin(this.clock * 6 + a.id)) * 0.12 : 0;
    const lift = (a.ground === 'lying' ? 0.18 : a.ground === 'sit' ? -0.3 : seated ? 0.17 : 0) + bob;
    const y = inCamper ? 0.64 : groundY(a.pos.x, a.pos.z) + lift;
    let x = a.pos.x + a.nudge.x;
    let z = a.pos.z + a.nudge.z;
    if (a.intoxicated && a.route.length) {
      // Unsteady gait: a slow sideways sway across the walking direction.
      const sway = Math.sin(this.clock * 2.4 + a.id) * 0.16;
      x += Math.cos(a.heading) * sway;
      z -= Math.sin(a.heading) * sway;
    }
    this.scratch.set(x, y, z);
    root.position.copy(this.scratch);
    root.rotation.y = a.heading;
    root.rotation.z = a.ground === 'lying' ? Math.PI / 2 : 0;

    if (a.mood && a.moodLeft > 0) {
      a.moodLeft -= dt;
      this.icons.show(a.id, a.mood, root.position, a.ground === 'lying' ? 0.9 : 2.25);
    } else if (a.mood) {
      a.mood = undefined;
      this.icons.release(a.id);
    }
  }
}

/** Officer posts near service entrances (visible-deterrence policing). */
const policePosts = () => [
  { node: SERVICE_NODES.dropIn, at: toWorld(VENUE_FRAME.dropIn, { x: 3.9, z: -3.3 }), face: Math.PI / 2 + VENUE_ROT.dropIn },
  // The camper can move: its post is worked out where it stands now.
  { node: SERVICE_NODES.outreach, at: toWorld(CAMPER_FRAME, { x: 2.1, z: 6.4 }), face: -Math.PI / 2 + VENUE_ROT.outreach },
];
/** A beat past every service, and one that keeps clear of their entrances. */
const BEAT: readonly NodeId[] = ['wTerrace', 'wCross', 'pathCenter', 'eCamper', 'eJunction', 'eCross', 'wClub'];
const CLEAR_BEAT: readonly NodeId[] = ['wBack', 'wCross', 'eCross', 'eBack'];
/** Out-of-view corners for use after unmet need: near the services, or further out when police are about. */
const NEAR_SPOTS: readonly { node: NodeId; at: P2; face: number }[] = [
  { node: 'park', at: { x: 4.2, z: 12.6 }, face: Math.PI / 2 },
  { node: 'park', at: { x: 9.6, z: 13.8 }, face: Math.PI },
];
const DEEP_SPOTS: readonly { node: NodeId; at: P2; face: number }[] = [
  { node: 'wFront', at: { x: -13.4, z: 13.9 }, face: Math.PI / 2 },
  { node: 'parkEast', at: { x: 14.4, z: 14.2 }, face: Math.PI },
];
/** Where club leavers collapse on the terrace, in view of the stand. */
const TERRACE_COLLAPSE: readonly P2[] = [{ x: -9.4, z: 8.6 }, { x: -10.6, z: 9.8 }, { x: -8.7, z: 10.4 }].map((q) => toWorld(VENUE_FRAME.club, q));
/** Where sellers stand: by the park corner, or displaced to the far corner when police are posted. */
const MARKET_SPOTS: Record<'near' | 'displaced', readonly { node: NodeId; at: P2; face: number }[]> = {
  near: [{ node: 'eJunction', at: { x: 2.3, z: 8.6 }, face: -Math.PI / 2 }, { node: 'eJunction', at: { x: 2.4, z: 9.5 }, face: -Math.PI / 2 }],
  displaced: [{ node: 'wFront', at: { x: -8.0, z: 13.4 }, face: Math.PI / 2 }, { node: 'wFront', at: { x: -8.1, z: 14.2 }, face: Math.PI / 2 }],
};
/** Benches by the drop-in path and the park where people sleep rough when the drop-in is closed. */
const SLEEP_SPOTS: readonly { node: NodeId; at: P2; face: number }[] = [
  { node: 'park', at: { x: 10.2, z: 7.25 }, face: 0 },
  { node: 'park', at: { x: 4.95, z: 11.4 }, face: Math.PI / 2 },
];
/** Shopfronts: the corner shop (faces the street) and the cafe (faces the park). */
const SHOP_FRONTS: readonly { node: NodeId; at: P2; face: number }[] = [
  { node: 'wFront', at: { x: -9.9, z: 12.2 }, face: -Math.PI / 2 },
  { node: 'park', at: { x: 13.6, z: 7.9 }, face: Math.PI },
];
/** Party areas in the park: a pop-up by the paths, the festival in front of its stage. */
const PARTY_AREAS = {
  popUp: { x: 8.0, z: 11.6, r: 1.6, face: { x: 8.0, z: 9.9 } },
  festival: { x: 9.2, z: 10.8, r: 2.4, face: { x: 11.0, z: 12.6 } },
};
/** Which everyday group each population dresses as. */
const KIND_STYLE: Record<PasserbyKind, Archetype> = {
  residents: 'older', dogWalkers: 'everyday', commuters: 'office', diners: 'everyday', workers: 'worker',
  clubbers: 'raver', students: 'student', tourists: 'tourist', fans: 'everyday',
};
/** How each population looks: students carry backpacks, tourists bags and bright clothes, fans team scarves, dog walkers a dog. */
const LOOKS: Partial<Record<PasserbyKind, Partial<Appearance>>> = {
  students: { extra: 'backpack' },
  tourists: { extra: 'bag', top: 0xe8a33c },
  fans: { extra: 'scarf', accent: 0xb02a3a, top: 0xb02a3a },
  dogWalkers: { dog: true },
  commuters: { extra: 'bag', top: 0x4a4e5e },
  workers: { extra: 'jacket', accent: 0x5a6a4a },
};
/** Night bus stop on the west pavement by the shelter. */
const BUS_STOP_Z = -12.4;
const BUS_WAIT: readonly P2[] = [{ x: -7.4, z: -12.9 }, { x: -7.4, z: -11.9 }, { x: -7.0, z: -12.4 }];
/** Cafe tables outside on the park side. */
const CAFE_TABLES: readonly P2[] = [{ x: 12.65, z: 7.25 }, { x: 13.55, z: 7.25 }, { x: 13.95, z: 7.25 }, { x: 14.85, z: 7.25 }];
/** Terrace bench spots where intoxicated club leavers sit down. */
const TERRACE_BENCH: readonly P2[] = [{ x: -12.8, z: 9.4 }, { x: -12.0, z: 9.4 }];
/** Street benches (see streetscape) where a few people rest with their belongings. */
const RESTING_SPOTS: readonly { at: P2; face: number }[] = [
  { at: { x: -26, z: -23.4 }, face: Math.PI },
  { at: { x: -36, z: 23.4 }, face: 0 },
  { at: { x: 31.4, z: 30 }, face: -Math.PI / 2 },
];

type Mix = readonly (readonly [Archetype, number])[];
const NIGHT_OUT: Mix = [
  ['raver', 3], ['technoBlack', 3], ['queerRave', 1.6], ['punk', 1.2], ['goth', 0.8], ['hiphop', 1.4], ['metal', 0.6],
  ['student', 2.5], ['everyday', 2.5], ['tourist', 1.2], ['worker', 0.6], ['office', 0.6],
];
const MIXED: Mix = [['everyday', 4], ['student', 1.5], ['worker', 1.5], ['older', 1.5], ['unhoused', 2], ['office', 1], ['raver', 1], ['tourist', 0.6]];
const STYLE_MIX: Partial<Record<Intent, Mix>> = {
  club: NIGHT_OUT,
  drugChecking: [['raver', 3], ['technoBlack', 2], ['queerRave', 1], ['punk', 0.8], ['student', 3], ['everyday', 3], ['worker', 1], ['office', 1], ['unhoused', 1], ['tourist', 0.6]],
  shelter: [['unhoused', 8], ['everyday', 1.5], ['older', 1], ['worker', 0.5]],
  dropIn: [['unhoused', 3], ['everyday', 3], ['older', 1], ['worker', 1], ['student', 1], ['raver', 0.6], ['punk', 0.8]],
  outreach: [['unhoused', 4], ['everyday', 2], ['raver', 1], ['punk', 1], ['worker', 1], ['older', 0.6]],
  footPatrol: MIXED,
  clinic: MIXED,
  passerby: [['tourist', 2], ['office', 2], ['worker', 2], ['student', 2], ['older', 1.5], ['everyday', 3], ['raver', 0.8], ['unhoused', 0.8], ['punk', 0.6], ['goth', 0.4], ['hiphop', 0.8], ['metal', 0.4], ['technoBlack', 0.5]],
};

function weighted<T>(random: () => number, mix: readonly (readonly [T, number])[]): T {
  let total = 0;
  for (const [, w] of mix) total += w;
  let r = random() * total;
  for (const [v, w] of mix) if ((r -= w) <= 0) return v;
  return mix[mix.length - 1][0];
}

/** Where residents with placards stand, beside the drop-in path. */
const PLACARD_SPOTS: readonly P2[] = [{ x: 4.4, z: -2.9 }, { x: 5.3, z: -2.7 }, { x: 7.1, z: -2.9 }, { x: 8.0, z: -2.75 }].map((q) => toWorld(VENUE_FRAME.dropIn, q));

/** Cuts `metres` off the end of a route, so a walker stops short of the destination. */
function shortenRoute(start: P2, route: P2[], metres: number): P2[] {
  const pts = [start, ...route];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  let keep = Math.max(total * 0.5, total - metres);
  const out: P2[] = [];
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (keep <= d) {
      const t = d > 0 ? keep / d : 0;
      out.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * t });
      return out;
    }
    keep -= d;
    out.push(pts[i]);
  }
  return out;
}

function turn(current: number, target: number, rate: number, dt: number): number {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * (1 - Math.exp(-rate * dt));
}
