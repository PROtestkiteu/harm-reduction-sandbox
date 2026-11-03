import { QUALITY } from '../render/quality';
import {
  PCFShadowMap,
  PCFSoftShadowMap,
  Box3,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Matrix4,
  Raycaster,
  ConeGeometry,
  Mesh,
  type Object3D,
  Scene,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { PALETTE } from '../config/palette';
import type { LocationId } from '../sim/types';
import type { Random } from '../sim/random';
import { WindowBank, setWindowDaylight } from './animated';
import { buildCafeBlock, buildCornerBlock } from './blocks';
import { buildCamper, buildClub, buildDropIn, type LocationVisual } from './buildings';
import {
  acUnit, antenna, beacon, bike, busShelter, drainGrate, drainpipe, fence, flowerBed, flowerBox, hedge, hydrant,
  manhole, pedestrianSignal, picnicTable, postBox, roofVent, satelliteDish, scooter, signPost, stringLights,
  advertPillar, waterTank, windowTrim,
} from './details';
import { add, bench, bin, bollard, box, cylinder, planter, signBoard, setFoliageSeason, setLampNight, streetLight, tree } from './kit';
import { setPuddleLight, tickPuddles } from './puddles';
import { AID_BUS, CAMPER_SPOTS, DISTRICT, SQUAT_SPOT, PARK_CAMP, STATION_CAMP, moveCamper as moveCamperFrame, CROSSING, HALF, HOME_CAMPER, HOME_CLUB, LOTS, NODES, PAVE_E, PAVE_W, ROAD, VENUE_FACE, VENUE_FRAME, VENUES_AT_HOME, PATROL, WALK_BAND, frontLineGap, toWorld, walkDistance, type Frame, type P2, type PlaceLot } from './layout';
import { StageProps } from './stageProps';
import type { ServiceId } from '../sim/types';
import { buildBlockGround, buildOutskirts, buildStreets } from './district';
import { lightPool, setPoolDaylight } from './dressing';
import { buildInfill } from './infill';
import { updateNeon, wallClutter } from './grit';
import { buildStreetscape } from './streetscape';
import { buildGreenery } from './greenery';
import { worshipFront, type Worship } from './worship';
import { buildClinic, buildDrugChecking, buildFootPatrol, buildPharmacyShop, buildShelter } from './places';
import { glowMat, mat, SNOW } from './materials';
import { Weather } from './weather';
import { buildCityBeyond } from './cityBeyond';
import { setKitSeason, type Kits } from './kits';
import { buildAmbient, type AmbientKind, type VehicleInfo } from './ambient';
import { Traffic } from './traffic';
import { TrafficLights } from './trafficLights';
import { ParkActivities } from './parkActivities';
import { buildMurals, type MuralSpot } from './murals';
import { campPitch } from './camps';
import { TeamBus } from './teamBus';
import type { Figure } from '../agents/character';
import { Letting, type UnitLook } from './letting';
import { OpeningFx } from './openingFx';
import { seatClear } from './flavour/squatDoors';
import { LAUNCH_SEED } from '../config/launch';
import { DistrictLife, type DistrictNow, type FrontState } from './districtLife';
import { FitOuts, type FitOutLook } from './fitOut';
import { DOOR_ALONG, allBuildings, claimLook, claimRoof, cityBuilding, frontDoor, frontFrame, registerBuilding, type CityBuilding } from './cityBuildings';
import { t } from '../i18n';
import { PROPERTY } from '../sim/property';
import { Expansion, type ExpansionKind, type Facing } from './expansion';
import { collectSolids, type Solids } from './solids';
import { Puffs } from './puffs';
import type { SeasonProfile, Season } from '../config/seasons';
import { dynamic, mergeStatic } from './mergeStatic';
import { bus, car, CAR_COLOURS, setVehicleDaylight } from './vehicles';

export interface World {
  scene: Scene;
  locations: Record<LocationId, LocationVisual>;
  club: ReturnType<typeof buildClub>;
  /** The outreach camper's van as designed and the group that drives it off. */
  camper: ReturnType<typeof buildCamper>;
  frame: {
    /** The original street: its fit sets the camera's base scale (zoom 1). */
    full: Box3;
    /** Everything the camera may show, for depth range and pan limits. */
    bounds: Box3;
  };
  /** Moves the sun's shadow frustum to cover the area in view. */
  setViewFocus(x: number, z: number, radius: number): void;
  update(dt: number, time: number): void;
  /** 0 at dusk, 1 in deep night: dims the low sun and cools the ambient light. */
  setNight(night: number, day?: number): void;
  /** The haze colour at the horizon now, as CSS hex: the page around the scene takes it. */
  hazeHex(): string;
  /** Trees, snow, light and what drifts in the air for the time of year. */
  setSeason(season: Season, profile: SeasonProfile): void;
  /** Drifting snow and leaves hold still when reduced motion is preferred. */
  setStill(still: boolean): void;
  /** Staff above (`extra`) or below (`short`) a service's usual number: its building grows or shrinks. */
  setStaffing(id: LocationId, extra: number, short: number, open: boolean): void;
  /** Each service's stage (SERVICE_STAGES): its pieces spring up beside the place; `instant` for a load. */
  setStage(id: ServiceId, stage: number, instant: boolean): void;
  /** Building ids of the shop units the property model tracks, nearest the services first. */
  readonly shopUnits: readonly number[];
  /** What shop unit `i` shows: trading, TO LET, or a rented service's sign. */
  setUnit(i: number, look: UnitLook): void;
  /** The shops the cannabis and new-substances law allows, on fixed shopfronts. */
  setShops(kinds: readonly ShopKind[]): void;
  /** City traffic waits for anyone on the road ahead (asked of the crowd). */
  setTrafficYield(ahead: (x: number, z: number, dx: number, dz: number) => boolean): void;
  /** Every vehicle on the road: the crowd's cars report here too. */
  readonly traffic: Traffic;
  /** Sends an ambulance or a police car to a spot: it drives in, stops with lights flashing, then leaves. */
  dispatch(kind: 'ambulance' | 'police' | 'fire', x: number, z: number, reason: string): boolean;
  /** Brings the rare flying saucer now (an easter egg, world/ufo.ts); for the dev checks. */
  summonUfo(): boolean;
  /** Police cars and ambulances on screen, for picking, and what each is doing. */
  vehicles(): readonly { id: number; root: Object3D }[];
  vehicle(id: number): VehicleInfo | undefined;
  /** The train's ends along x while it is on the line, else null; and the helicopter while it is up (for the sound). */
  trainSpan(): readonly [number, number] | null;
  helicopter(out: { x: number; z: number }): { x: number; z: number } | null;
  /** Which of those shops a building is, if any. */
  shopAt(buildingId: number): ShopKind | null;
  /** Extra outreach campers, by spot index in CAMPER_SPOTS. */
  setExtraCampers(spots: readonly number[]): void;
  /** Shows a harm reduction point's sign on a building, or takes it down (null). */
  setPoint(building: number, look: UnitLook | null): void;
  /** How far a building the organisation has taken over (a rented unit or a point) is fitted out, on its front; null once given back. */
  setFitOut(building: number, look: FitOutLook | null): void;
  /** The park camp at `size` and the station camp at `station` (0 to 1): up to 14 and 10 tents, nearest the district first. */
  setCamp(size: number, station: number): void;
  /** Shows the warming bus (parked, lit) and the water and shade point while they run. */
  setAid(bus: boolean, water: boolean): void;
  /** Lights up the kerb spots marked free (by index), for picking a new spot on the map; null hides them. */
  showCamperSpots(free: readonly boolean[] | null): void;
  /** The lit kerb-spot markers, for picking. */
  camperSpotMarkers(): readonly { id: number; root: Object3D }[];
  /** Parks the first camper at kerb spot `spot` (an index in CAMPER_SPOTS). */
  moveCamper(spot: number): void;
  /** Buildings where new venues open as the district thrives, in opening order. */
  nightlife: readonly number[];
  /**
   * Pavement spots outside those venues where people stand about with a drink
   * (students on a university weekend, fans after a match): a few per venue,
   * in the same opening order (`venue` is its index in `nightlife`), each clear
   * of the crowd's walking lines and the walls, `face` turned to the venue's door.
   */
  barSpots: readonly { venue: number; at: P2; face: number }[];
  /** Lights the festival grounds and the stadium: how far each occasion is under way, 0 (nothing on) to 1. */
  setHappenings(v: { festival: number; match: number }): void;
  /** The home team in town (before and through a match): its coach comes to the stadium and waits, then drives off. */
  setTeamBus(on: boolean): void;
  /**
   * The district now, for its ordinary buildings to run down or get done up
   * (world/districtLife.ts); `minute` counts game minutes and only goes up.
   * Cheap: a building's look is built the first time it needs it, and a change only swaps what is shown.
   */
  setDistrict(v: DistrictNow, minute: number): void;
  /** How an ordinary building's front looks now: run down, done up, or as it was. */
  frontState(id: number): FrontState;
  /** Shows the first `open` new venues' signs (partnered ones with a star). */
  setNightlife(open: number, partnered: ReadonlySet<number>): void;
  /** Building ids of the public hospital and the sobering-up centre. */
  landmarks: { hospital: number; sobering: number; police: number; cityHall: number; stadium: number; festival: number };
  /** The housing on the university's site (the campus flavour pack hides it). */
  campusSite: Object3D;
  /** The pharmacy's building id (a business, with its own card). */
  pharmacyShop: number;
  /** Żabka convenience stores' building ids. */
  zabkas: readonly number[];
  /** The fast food joint's building id, if one stands this launch. */
  fastFood: number | null;
  /** The bookshop's and the pizza place's building ids, if they stand this launch. */
  bookshop: number | null;
  pizza: number | null;
  /** The primary school's and the public library's building ids, if they stand this launch. */
  school: number | null;
  library: number | null;
  /** The church, synagogue and mosque, by building id (world/worship.ts). */
  worship: Map<number, Worship>;
  /** The camps' pick ids (building ids on open ground). */
  camps: { park: number; station: number };
  /** The city building that is a squat this launch, by id. */
  squat: number | null;
  /** Where people stand at the counter of the camper on `spot`. */
  camperCounter(spot: number): P2 | undefined;
  /** Extra campers, for picking: clicking one selects the outreach service. */
  pickables(): readonly Object3D[];
  /** Swaps in the Quaternius kits once loaded in the background. */
  applyKits(kits: Kits): void;
  /** Metres per screen pixel now: decides how the people out in the city are drawn. */
  setDetail(metresPerPixel: number): void;
  /** Sculpted figures for the people out in the city, once their assets are loaded. */
  setFigureFactory(make: (kind: AmbientKind) => Figure): void;
  /** The big park's sellers and patrols follow the street market (0..1) and policing (0 none). */
  setParkLife(market: number, patrol: number): void;
  /** What goes on in the big park now: joggers (0 to 4), the yoga class, a family picnic. */
  setParkActivities(v: { joggers: number; yoga: boolean; picnic: boolean }): void;
  /** Where the distance haze starts and is complete, in view depth. */
  setHaze(near: number, far: number): void;
  /** Crane work under way at each place, for the progress bar. */
  works(): { id: LocationId; progress: number; building: boolean }[];
  /** Ground footprints of benches, bins, posts, trees, parked cars and shelters. */
  solids: Solids;
  /** Exhaust and grit in the air (world/puffs.ts). */
  puffs: Puffs;
}

/** Pick id of the warming bus, clear of the ambient fleet's ids. */
const WARMING_BUS_ID = 900;
const HAZE_DAY = new Color(0xa9b5c0);
const HAZE_DUSK = new Color(0x6e6a72);
const HAZE_NIGHT = new Color(0x1c2230);

/** Where the sun sits relative to the point it lights. */
const SUN_OFFSET = new Vector3(-12, 16, 20);

/** Shops a cannabis and new-substances law can bring onto the street. */
export type ShopKind = 'medical' | 'smart' | 'coffeeshop' | 'cannabis' | 'liquor' | 'betting' | 'casino';
/** Always on the street, whatever the law: their own shopfronts come first. */
const FIXED_SHOPS: readonly ShopKind[] = ['liquor', 'betting', 'casino'];
const SHOP_KINDS: readonly ShopKind[] = [...FIXED_SHOPS, 'medical', 'smart', 'coffeeshop', 'cannabis'];
const SHOP_SIGN: Record<ShopKind, { sign: string; fg: string; bg: string }> = {
  medical: { sign: 'MEDICAL CANNABIS', fg: '#ffffff', bg: '#2f7a48' },
  smart: { sign: 'SMART SHOP', fg: '#101010', bg: '#e0d040' },
  coffeeshop: { sign: 'COFFEESHOP', fg: '#f4f0d8', bg: '#3a5a2a' },
  cannabis: { sign: 'CANNABIS STORE', fg: '#f4f0d8', bg: '#2a4a3a' },
  liquor: { sign: 'LIQUOR 24/7', fg: '#ffe8a0', bg: '#6a1e1e' },
  betting: { sign: 'BETS', fg: '#ffffff', bg: '#1e4aa8' },
  casino: { sign: 'CASINO', fg: '#ffd84a', bg: '#4a1060' },
};

/**
 * Pitches for a camp (world/camps.ts): `count` of them in rows of five from
 * (x0, z0), `dz` between rows, sorted nearest the district first (the park
 * camp grows away from it).
 */
function campTents(random: () => number, count: number, x0: number, z0: number, dz: number): Group[] {
  const out: { g: Group; z: number }[] = [];
  for (let i = 0; i < count; i++) {
    const g = campPitch(random, i);
    const x = x0 + (i % 5) * 4.2 + (random() - 0.5) * 0.9;
    const z = z0 + Math.floor(i / 5) * dz + (random() - 0.5) * 0.8;
    g.position.set(x, -0.04, z);
    g.rotation.y = (random() - 0.5) * 0.7;
    g.visible = false;
    out.push({ g, z });
  }
  return out.sort((a, b) => Math.abs(a.z) - Math.abs(b.z)).map((t) => t.g);
}

/** A shade canopy over a table of water bottles, with a sign. */
function waterPoint(): Group {
  const g = new Group();
  const canvas = mat(0x3f8a9a);
  for (const [x, z] of [[-1.3, -1], [1.3, -1], [-1.3, 1], [1.3, 1]]) add(g, cylinder(0.05, 2.3, mat(PALETTE.metal), 5, x, 0, z));
  add(g, box(2.9, 0.08, 2.3, canvas, 0, 2.3, 0));
  add(g, box(1.6, 0.75, 0.7, mat(PALETTE.canvasCream), 0, 0, 0));
  for (let i = 0; i < 6; i++) add(g, cylinder(0.05, 0.25, glowMat(0x9fd0f0, 0xc8ecff, 0.3), 6, -0.6 + i * 0.24, 0.76, (i % 2) * 0.2 - 0.1));
  const sign = signBoard('WATER + SHADE', 2.0, 0.4, '#ffffff', '#2f6a7a', 0.4);
  add(g, sign.mesh).position.set(0, 2.55, 1.16);
  return g;
}

/** Signs of the venues that open as the district thrives, in the order they open. */
const NIGHTLIFE_SIGNS = [
  { sign: 'BAR', fg: '#ffe8c0', bg: '#7a2a20' },
  { sign: 'CAFÉ', fg: '#fff4e0', bg: '#5a3a24' },
  { sign: 'CLUB', fg: '#f4d8ff', bg: '#3a1a5a' },
  { sign: 'LIVE', fg: '#e0f0ff', bg: '#1a3a6a' },
] as const;

/** Where people stand at the counter of a camper on kerb spot `spot`: 2 m to the pavement side, 1 m back from its middle. */
function counterAtSpot(spot: number): P2 {
  const s = CAMPER_SPOTS[spot];
  const c = Math.cos(s.rot);
  const n = Math.sin(s.rot);
  return { x: s.x + 2 * c - 1 * n, z: s.z - 2 * n - 1 * c };
}

/** Every kerb spot a camper can stand at this launch, by index. */
export { CAMPER_SPOTS };

/** How each place shows growth, and which way its front faces. */
const EXPANSION: Record<LocationId, { kind: ExpansionKind; front: Facing; roof?: number }> = {
  dropIn: { kind: 'building', front: VENUE_FACE.dropIn },
  outreach: { kind: 'sign', front: '+x' },
  club: { kind: 'sign', front: VENUE_FACE.club, roof: HOME_CLUB.height + 0.12 },
  footPatrol: { kind: 'sign', front: LOTS.footPatrol.face },
  drugChecking: { kind: 'building', front: LOTS.drugChecking.face },
  shelter: { kind: 'building', front: LOTS.shelter.face },
  clinic: { kind: 'building', front: LOTS.clinic.face },
};

/** Sign colour per place. */
const EXPANSION_ACCENT: Record<LocationId, number> = {
  dropIn: 0x2e7d6b, outreach: 0x2e7d6b, club: 0xb04a8a, footPatrol: 0x2e7d6b, drugChecking: 0x3a6ea8, shelter: 0xc8823a, clinic: 0xc83a3a,
};

/**
 * A Żabka: a small corner shop in the ground floor of an ordinary building,
 * flats above. A green fascia and a green-lit shopfront wrap only the corner
 * unit (about four metres along each of the two faces the camera sees), the
 * name over it, and a small frog face on the corner. Static; merged.
 */
function zabkaFront(parent: Object3D, b: CityBuilding): void {
  const g = add(parent, new Group());
  const along = Math.min(4.2, b.x1 - b.x0 - 0.5);
  const deep = Math.min(3.4, b.z1 - b.z0 - 0.5);
  const green = mat(0x1d7a3a);
  const glass = glowMat(0x1e3a2a, 0xc8ffd8, 0.45);
  // South face, from the south-east corner westwards; east face, from that corner northwards.
  add(g, box(along, 0.6, 0.12, green, b.x1 - along / 2, 2.4, b.z1 + 0.08));
  add(g, box(along - 0.3, 1.9, 0.06, glass, b.x1 - along / 2, 0.35, b.z1 + 0.04));
  add(g, box(0.12, 0.6, deep, green, b.x1 + 0.08, 2.4, b.z1 - deep / 2));
  add(g, box(0.06, 1.9, deep - 0.3, glass, b.x1 + 0.04, 0.35, b.z1 - deep / 2));
  add(g, signBoard('@ABKA', Math.min(2.6, along - 0.6), 0.48, '#ffffff', '#1d7a3a', 0.7).mesh, 0).position.set(b.x1 - along / 2, 2.46, b.z1 + 0.16);
  add(g, signBoard('@ABKA', Math.min(2.4, deep - 0.6), 0.48, '#ffffff', '#1d7a3a', 0.7).mesh, Math.PI / 2).position.set(b.x1 + 0.16, 2.46, b.z1 - deep / 2);
  // The frog face on the corner, at fascia height: small.
  const head = add(g, new Group());
  head.position.set(b.x1 + 0.12, 2.55, b.z1 + 0.12);
  head.rotation.y = Math.PI / 4;
  add(head, cylinder(0.36, 0.14, green, 14, 0, 0, 0)).rotation.x = Math.PI / 2;
  for (const ex of [-0.17, 0.17]) {
    add(head, cylinder(0.11, 0.08, mat(0xffffff), 10, ex, 0.26, 0.04)).rotation.x = Math.PI / 2;
    add(head, cylinder(0.05, 0.1, mat(0x101010), 8, ex, 0.26, 0.06)).rotation.x = Math.PI / 2;
  }
  // A parcel locker by the door.
  add(g, box(0.9, 1.7, 0.45, mat(0xe0c020), b.x1 - along - 0.6, 0.12, b.z1 + 0.25));
}

/**
 * A pizza place: a red, white and green awning over a warm-lit front, PIZZA
 * on the fascia, a big pizza disc on a bracket over the door and a scooter
 * for deliveries outside. Static; merged.
 */
function pizzaFront(parent: Object3D, b: CityBuilding): void {
  const g = add(parent, new Group());
  const w = b.x1 - b.x0;
  const cx = (b.x0 + b.x1) / 2;
  add(g, box(w + 0.14, 2.0, 0.08, glowMat(0x3a2a1a, 0xffc880, 0.7), cx, 0.35, b.z1 + 0.04));
  add(g, box(w + 0.2, 0.6, 0.12, mat(0xf2ede0), cx, 2.4, b.z1 + 0.08));
  add(g, signBoard('PIZZA', Math.min(3, w - 0.8), 0.5, '#b8202a', '#f2ede0', 0.6).mesh, 0).position.set(cx, 2.45, b.z1 + 0.16);
  // The awning in the Italian colours, striped.
  const stripes = [0x2a8a3a, 0xf2ede0, 0xc8282a];
  const n = Math.max(3, Math.floor(w / 0.5));
  for (let i = 0; i < n; i++) {
    const s = add(g, box(w / n, 0.06, 1.0, mat(stripes[i % 3]), b.x0 + (i + 0.5) * (w / n), 2.0, b.z1 + 0.5));
    s.rotation.x = 0.35;
  }
  // The pizza sign: a round crust with red sauce and white cheese spots, over the door.
  const sign = add(g, new Group());
  sign.position.set(b.x1 - 0.5, 3.4, b.z1 + 0.7);
  add(sign, box(0.05, 0.05, 0.6, mat(0x2a2a2a), 0, 0, -0.3));
  const disc = add(sign, cylinder(0.5, 0.08, mat(0xd8a050), 16, 0, -0.5, 0));
  disc.rotation.x = Math.PI / 2;
  const sauce = add(sign, cylinder(0.42, 0.09, mat(0xc0302a), 16, 0, -0.5, 0));
  sauce.rotation.x = Math.PI / 2;
  for (const [x, y] of [[0.15, -0.35], [-0.18, -0.55], [0.1, -0.7], [-0.05, -0.42]]) add(sign, cylinder(0.07, 0.1, mat(0xf0e8c8), 8, x, y, 0.01)).rotation.x = Math.PI / 2;
  // A delivery scooter at the kerb in front.
  const sc = add(g, new Group());
  sc.position.set(b.x0 + 1.2, 0.12, b.z1 + 1.6);
  add(sc, box(0.3, 0.45, 1.2, mat(0xc8282a), 0, 0.25, 0));
  add(sc, box(0.5, 0.45, 0.5, mat(0xf2ede0), 0, 0.7, -0.35));
  for (const z of [-0.45, 0.45]) add(sc, cylinder(0.2, 0.1, mat(0x1a1a1a), 10, 0, 0.2, z)).rotation.z = Math.PI / 2;
}

/** A fast food joint's dressing: a red fascia with a yellow sign on every side, a warm-lit front, a big burger on the corner. */
function fastFoodFront(parent: Object3D, b: CityBuilding): void {
  const g = add(parent, new Group());
  const w = b.x1 - b.x0;
  const d = b.z1 - b.z0;
  const cx = (b.x0 + b.x1) / 2;
  const cz = (b.z0 + b.z1) / 2;
  add(g, box(w + 0.3, 0.75, d + 0.3, glowMat(0xb8202a, 0xff3a2a, 0.45), cx, 2.45, cz));
  add(g, box(w + 0.14, 2.0, d + 0.14, glowMat(0x3a2a1a, 0xffd890, 0.7), cx, 0.35, cz));
  for (const [x, z, rot, len] of [[cx, b.z1 + 0.2, 0, w], [cx, b.z0 - 0.2, Math.PI, w], [b.x1 + 0.2, cz, Math.PI / 2, d], [b.x0 - 0.2, cz, -Math.PI / 2, d]] as const) {
    const sign = signBoard('BURGER', Math.min(3.6, len - 0.6), 0.7, '#b8202a', '#ffd23a', 0.7);
    add(g, sign.mesh, rot).position.set(x, 2.47, z);
  }
  // The burger: bun, cheese, patty, lettuce, bun, on a post at the corner.
  const burger = add(g, new Group());
  burger.position.set(b.x1 + 0.2, 3.3, b.z1 + 0.2);
  add(burger, cylinder(0.06, 0.4, mat(0x8a8a8a), 6, 0, -0.4, 0));
  for (const [r, h, y, c] of [[0.62, 0.22, 0, 0xd89040], [0.66, 0.06, 0.22, 0x5aa83a], [0.6, 0.18, 0.28, 0x5a3220], [0.66, 0.05, 0.46, 0xf2c400], [0.62, 0.32, 0.51, 0xd89040]] as const) add(burger, cylinder(r, h, mat(c), 14, 0, y, 0));
}

/** A group on a building's front wall, turned so dressing built facing +z faces the street, and the wall's length. */
function onFront(parent: Object3D, b: CityBuilding): { g: Group; width: number } {
  const f = frontFrame(b);
  const g = add(parent, new Group());
  g.position.set(f.x, 0, f.z);
  g.rotation.y = f.rot;
  return { g, width: f.width };
}

/**
 * A bookshop's dressing: a deep green fascia with BOOKS on every side, a
 * warm-lit window full of book spines, and a cart of second-hand books on the
 * pavement by the door.
 */
function bookshopFront(parent: Object3D, b: CityBuilding): void {
  const g = add(parent, new Group());
  const w = b.x1 - b.x0;
  const d = b.z1 - b.z0;
  const cx = (b.x0 + b.x1) / 2;
  const cz = (b.z0 + b.z1) / 2;
  add(g, box(w + 0.3, 0.7, d + 0.3, glowMat(0x1e3a2e, 0x2a5a42, 0.3), cx, 2.45, cz));
  add(g, box(w + 0.14, 2.0, d + 0.14, glowMat(0x3a2a1a, 0xffd8a0, 0.6), cx, 0.35, cz));
  for (const [x, z, rot, len] of [[cx, b.z1 + 0.2, 0, w], [cx, b.z0 - 0.2, Math.PI, w], [b.x1 + 0.2, cz, Math.PI / 2, d], [b.x0 - 0.2, cz, -Math.PI / 2, d]] as const) {
    const sign = signBoard('BOOKS', Math.min(3.2, len - 0.6), 0.62, '#f0e2b8', '#1e3a2e', 0.6);
    add(g, sign.mesh, rot).position.set(x, 2.5, z);
  }
  // Spines in the front window: rows of thin coloured boxes behind the glass.
  const spines = [0x8a2a2a, 0x2a4a8a, 0xc8a040, 0x3a6a3a, 0xe8e0d0, 0x5a3a6a];
  const front = onFront(g, b);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < Math.floor((front.width - 1) / 0.09); i++) {
      add(front.g, box(0.07, 0.24 + ((i * 7 + row) % 4) * 0.03, 0.05, mat(spines[(i * 5 + row * 3) % spines.length]), -front.width / 2 + 0.5 + i * 0.09, 0.55 + row * 0.42, 0.1));
    }
  }
  // The cart of second-hand books out on the pavement, beside the street door and clear of it.
  const cart = add(front.g, new Group());
  cart.position.set(front.width / 2 - DOOR_ALONG - 1.3, 0.12, 0.55);
  add(cart, box(1.1, 0.06, 0.5, mat(0x5a3e26), 0, 0.62, 0));
  for (const [x, z] of [[-0.5, -0.2], [0.5, -0.2], [-0.5, 0.2], [0.5, 0.2]]) add(cart, box(0.04, 0.62, 0.04, mat(0x3a2a1a), x, 0, z));
  for (let i = 0; i < 11; i++) add(cart, box(0.08, 0.2, 0.15, mat(spines[i % spines.length]), -0.45 + i * 0.09, 0.68, 0)).rotation.z = (i % 3 - 1) * 0.12;
}

/**
 * A civic building's dressing: a fascia with its name on every side and
 * something in its ground-floor windows; a school's are children's drawings,
 * a library's are shelves of books.
 */
function civicFront(parent: Object3D, b: CityBuilding, name: string, fascia: number, letters: string, inside: 'drawings' | 'shelves'): void {
  const g = add(parent, new Group());
  const w = b.x1 - b.x0;
  const d = b.z1 - b.z0;
  const cx = (b.x0 + b.x1) / 2;
  const cz = (b.z0 + b.z1) / 2;
  add(g, box(w + 0.3, 0.7, d + 0.3, glowMat(fascia, fascia, 0.15), cx, 2.45, cz));
  for (const [x, z, rot, len] of [[cx, b.z1 + 0.2, 0, w], [cx, b.z0 - 0.2, Math.PI, w], [b.x1 + 0.2, cz, Math.PI / 2, d], [b.x0 - 0.2, cz, -Math.PI / 2, d]] as const) {
    const bg = `#${fascia.toString(16).padStart(6, '0')}`;
    add(g, signBoard(name, Math.min(name.length * 0.62, len - 0.6), 0.62, letters, bg, 0.55).mesh, rot).position.set(x, 2.5, z);
  }
  const colours = inside === 'drawings' ? [0xe84a3a, 0xf0c830, 0x3a8ad8, 0x4ab04a, 0xe87ab8, 0xf0f0e8] : [0x8a2a2a, 0x2a4a8a, 0xc8a040, 0x3a6a3a, 0xe8e0d0, 0x5a3a6a];
  // On the front, in the ground-floor window band.
  const front = onFront(g, b);
  for (let i = 0; i < Math.floor((front.width - 1) / (inside === 'drawings' ? 0.5 : 0.09)); i++) {
    const x = -front.width / 2 + 0.5 + i * (inside === 'drawings' ? 0.5 : 0.09);
    if (inside === 'drawings') add(front.g, box(0.36, 0.3, 0.02, mat(colours[i % colours.length]), x, 1.2 + (i % 2) * 0.35, 0.06));
    else for (let row = 0; row < 3; row++) add(front.g, box(0.07, 0.24 + ((i * 7 + row) % 4) * 0.03, 0.05, mat(colours[(i * 5 + row * 3) % colours.length]), x, 0.55 + row * 0.42, 0.1));
  }
}

/** Renderer state the world relies on: soft shadows. */
export function configureRenderer(renderer: WebGLRenderer): void {
  renderer.shadowMap.enabled = true;
  // Soft shadows cost several samples per pixel: weak phones take the plain filter.
  renderer.shadowMap.type = QUALITY.low ? PCFShadowMap : PCFSoftShadowMap;
}

export function buildWorld(random: Random): World {
  const scene = new Scene();
  scene.background = new Color(PALETTE.skyTop);
  // Distance haze: the far city fades into the sky's colour (kept in step in setNight).
  scene.fog = new Fog(PALETTE.skyTop, 520, 760);
  const outskirts = buildOutskirts(scene, mulberry(23));
  // A fresh seed each launch: the city round the district is never quite the same twice.
  const launch = LAUNCH_SEED;
  const beyond = buildCityBeyond(scene, mulberry(29 ^ launch));
  // Every vehicle on the road reports here, so none drives through another.
  const traffic = new Traffic();
  const lights = new TrafficLights(scene, traffic, beyond.trainSpan);
  const puffs = new Puffs(scene);
  const ambient = buildAmbient(scene, mulberry(31), traffic, puffs, beyond.streets);
  const teamBus = new TeamBus(scene, traffic);
  const parkActivities = new ParkActivities(scene);
  let detail = 0.2;
  buildStreets(scene, mulberry(29));
  buildBlockGround(scene, mulberry(31));
  const ground = add(scene, new Group());
  buildGround(ground, random);
  mergeStatic(ground);

  const dropIn = buildDropIn(random);
  const club = buildClub(random);
  const outreach = buildCamper();
  scene.add(dropIn.root, club.root, outreach.root);
  const footPatrol = buildFootPatrol();
  // The pharmacy is a business on its own lot: lit, clickable, not a place of yours.
  const pharmacyShop = buildPharmacyShop(mulberry(41));
  scene.add(pharmacyShop.root);
  const drugChecking = buildDrugChecking(mulberry(43));
  const shelter = buildShelter(mulberry(47));
  const clinic = buildClinic(mulberry(53));
  const places = [footPatrol, drugChecking, shelter, clinic];
  for (const p of places) scene.add(p.root);
  const infill = buildInfill(scene, mulberry(59 ^ launch));
  const steam = buildStreetscape(scene, mulberry(61));
  // The original centre-block buildings get the same roof and wall clutter as the rest.
  const clutter = add(scene, new Group());
  const cr = mulberry(67);
  add(clutter, wallClutter(5.8, 9.2, cr)).position.set(-11.85, 0.12, -9.0);
  let neonLevel = 0.8;

  const residentialWindows = buildResidential(scene, random);
  const blocks = [buildCornerBlock(random), buildCafeBlock(random)];
  for (const b of blocks) scene.add(b.root);
  buildProps(scene);
  buildParkedCars(scene);
  const lighting = buildLighting(scene);
  const weather = new Weather(scene);
  // The sun's orientation never changes: its frame, for snapping shadows to texels.
  const fromSun = new Matrix4().lookAt(SUN_OFFSET, new Vector3(), new Vector3(0, 1, 0));
  const toSun = fromSun.clone().transpose();
  const snap = new Vector3();
  let still = false;
  const sun = lighting.sun;

  const locations: Record<LocationId, LocationVisual> = { dropIn, outreach, club, footPatrol, drugChecking, shelter, clinic };
  // Every static thing in the district merges into one mesh per material: a
  // few hundred draw calls fewer, which phones and VR headsets need. Places
  // stay separate so they can be picked and highlighted.
  for (const loc of Object.values(locations)) dynamic(loc.root);
  mergeStatic(scene);
  // Each service's building shows its staffing: a crane and cabins, boards, or a new sign.
  const expansions = Object.fromEntries(
    (Object.keys(locations) as LocationId[]).map((id) => [id, new Expansion(locations[id].root, EXPANSION_ACCENT[id], EXPANSION[id].kind, EXPANSION[id].front, locations[id].roofSign, EXPANSION[id].roof)]),
  ) as Record<LocationId, Expansion>;
  // Each service's stages: a row of pieces beside the place, away from its door and queue.
  const stageRoot = add(scene, new Group());
  const lotSlots = (lot: PlaceLot) => {
    const n = lot.face === '+x' ? { x: 1, z: 0 } : { x: 0, z: 1 };
    const q = lot.queueDir;
    const rot = lot.face === '+x' ? Math.PI / 2 : 0;
    // Along the front, on the side of the door away from the queue, a little out on the pavement: as far
    // as 1.6 m past the door, less where this site's walking line runs nearer (a piece reaches about 0.9 m
    // out from its middle), never nearer the wall than 0.6 m.
    const out = Math.max(0.6, Math.min(1.6, frontLineGap(lot) - WALK_BAND - 0.9 - 0.2));
    // Every 4.4 m along, skipping any spot a walking line passes (a path in to the site's side, say).
    const spots = [-3.8, -8.2, -12.6, -17, -21.4].map((along) => ({ x: lot.door.x + q.x * (along + 1) + n.x * out, z: lot.door.z + q.z * (along + 1) + n.z * out, rot }));
    return spots.filter((s) => walkDistance(s.x, s.z) > 0.9 + WALK_BAND).slice(0, 3);
  };
  const p2 = (x: number, z: number): P2 => ({ x, z });
  const designSlots = (f: Frame, faceRot: number, pts: P2[]) => pts.map((q) => ({ ...toWorld(f, q), rot: f.rot + faceRot }));
  const stageProps: Record<ServiceId, StageProps> = {
    drugChecking: new StageProps(stageRoot, 'drugChecking', lotSlots(LOTS.drugChecking)),
    shelter: new StageProps(stageRoot, 'shelter', lotSlots(LOTS.shelter)),
    clinic: new StageProps(stageRoot, 'clinic', lotSlots(LOTS.clinic)),
    // The drop-in's front faces +z in its design; pieces stand on the square west of the door.
    dropIn: new StageProps(stageRoot, 'dropIn', designSlots(VENUE_FRAME.dropIn, 0, [p2(3.4, -5.9), p2(11.4, -2.2), p2(-0.6, -10.6)])),
    // The club's front faces +x; pieces stand north of the door, clear of the queue.
    clubHr: new StageProps(stageRoot, 'clubHr', designSlots(VENUE_FRAME.club, Math.PI / 2, [p2(-6.6, -6.2), p2(-6.6, -9.6), p2(-6.6, -12.8)])),
    // The foot patrol works by the squat: pieces beyond the staff side of its table.
    footPatrol: new StageProps(stageRoot, 'footPatrol', designSlots(PATROL.frame, -Math.PI / 2, [p2(1.6, HOME_CAMPER.z1 + 7.2), p2(1.8, HOME_CAMPER.z1 + 9.0), p2(1.6, HOME_CAMPER.z1 + 10.8)])),
    // The camper's pieces ride on the van's own root, so they move with it: behind and beside the rear.
    outreach: new StageProps(locations.outreach.root, 'outreach', [{ x: 1.6, z: 3.9, rot: Math.PI / 2 }, { x: 1.9, z: 5.6, rot: Math.PI / 2 }, { x: 0, z: 9.4, rot: 0 }]),
  };
  // Ground-floor shop units nearest the services: closed ones show TO LET, rented ones a service sign.
  const lettingRoot = new Group();
  scene.add(lettingRoot);
  // Each unit's real roof, from a ray straight down through its middle: some
  // low shops tuck under a taller neighbour's roof (skipped), and roof
  // dressing can stand above the registered height (boards sit on it).
  const meshes: Object3D[] = [];
  scene.traverse((o) => { if ((o as Mesh).isMesh) meshes.push(o); });
  const down = new Raycaster();
  const roofOf = (b: CityBuilding) => {
    down.set(new Vector3((b.x0 + b.x1) / 2, 80, (b.z0 + b.z1) / 2), new Vector3(0, -1, 0));
    return down.intersectObjects(meshes, false)[0]?.point.y ?? b.height;
  };
  const shopUnits = allBuildings()
    .map((b) => ({ b, roof: roofOf(b), d: Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) }))
    .filter(({ b, roof }) => roof < b.height + 4)
    .sort((a, c) => a.d - c.d)
    .slice(0, PROPERTY.units + SHOP_KINDS.length);
  // The next few shopfronts after the rentable units are the law's shops.
  const specials = shopUnits.splice(PROPERTY.units);
  const lettings = shopUnits.map(({ b, roof }) => new Letting(lettingRoot, b, roof));
  const shopSigns = specials.map(({ b, roof }) => new Letting(lettingRoot, b, roof));
  const shopKinds: (ShopKind | null)[] = specials.map(() => null);
  // The fixed shops go up straight away; drinkers hang about the liquor store and the casino.
  FIXED_SHOPS.forEach((kind, i) => { if (shopSigns[i]) { shopKinds[i] = kind; shopSigns[i].set(SHOP_SIGN[kind]); } });
  ambient.setHangouts(specials.filter((_, i) => FIXED_SHOPS[i] === 'liquor' || FIXED_SHOPS[i] === 'casino').map(({ b }) => frontDoor(b, 2.5).door));
  // A squat: the ordinary building nearest the squat's kerb spot, not one of the shops, with a banner on its roof.
  const squatAt = counterAtSpot(SQUAT_SPOT);
  const taken = new Set([...shopUnits, ...specials].map(({ b }) => b.id));
  const squatBuilding = allBuildings()
    .filter((b) => !taken.has(b.id) && b.storeys >= 2)
    .map((b) => ({ b, d: Math.hypot((b.x0 + b.x1) / 2 - squatAt.x, (b.z0 + b.z1) / 2 - squatAt.z) }))
    .sort((a, c) => a.d - c.d)[0]?.b;
  const squat = squatBuilding ? squatBuilding.id : null;
  // Two Żabka convenience stores near the district's edges, far apart: a green corner unit in the ground floor of an ordinary building.
  const zabkaRoot = add(scene, new Group());
  const zabkaPool = allBuildings()
    .filter((b) => !taken.has(b.id) && b.id !== squat)
    .map((b) => ({ b, roof: roofOf(b), cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2 }))
    .filter(({ b, roof, cx, cz }) => roof < b.height + 4 && Math.max(Math.abs(cx), Math.abs(cz)) > DISTRICT - 20 && Math.max(Math.abs(cx), Math.abs(cz)) < DISTRICT + 1)
    // The lowest first: a corner shop, not a tower block.
    .sort((p, q) => p.b.storeys - q.b.storeys);
  const zabkas: number[] = [];
  for (const pick of zabkaPool) {
    if (zabkas.length >= 2) break;
    const far = zabkas.every((id) => { const o = cityBuilding(id)!; return Math.hypot((o.x0 + o.x1) / 2 - pick.cx, (o.z0 + o.z1) / 2 - pick.cz) > 40; });
    if (!far) continue;
    zabkaFront(zabkaRoot, pick.b);
    zabkas.push(pick.b.id);
    taken.add(pick.b.id);
  }
  // A fast food joint nearer the middle: a low ordinary building, red and yellow, a big burger on the corner.
  const fastFoodPick = allBuildings()
    .filter((b) => !taken.has(b.id) && b.id !== squat)
    .map((b) => ({ b, d: Math.max(Math.abs((b.x0 + b.x1) / 2), Math.abs((b.z0 + b.z1) / 2)) }))
    .filter(({ d }) => d > 10 && d < 45)
    .sort((p, q) => p.b.storeys - q.b.storeys || p.d - q.d)[0];
  const fastFood = fastFoodPick ? fastFoodPick.b.id : null;
  if (fastFoodPick) {
    fastFoodFront(zabkaRoot, fastFoodPick.b);
    taken.add(fastFoodPick.b.id);
  }
  const ff = fastFoodPick && { x: (fastFoodPick.b.x0 + fastFoodPick.b.x1) / 2, z: (fastFoodPick.b.z0 + fastFoodPick.b.z1) / 2 };
  // A pizza place on a free low building, away from the fast food joint and the bookshop where it can be.
  const pizzaPool = allBuildings()
    .filter((b) => !taken.has(b.id) && b.id !== squat && b.x1 - b.x0 >= 3 && Math.max(Math.abs((b.x0 + b.x1) / 2), Math.abs((b.z0 + b.z1) / 2)) < DISTRICT - 4)
    .sort((p, q) => p.storeys - q.storeys);
  const pizzaPick = pizzaPool.find((b) => !ff || Math.hypot((b.x0 + b.x1) / 2 - ff.x, (b.z0 + b.z1) / 2 - ff.z) > 30) ?? pizzaPool[0];
  const pizza = pizzaPick ? pizzaPick.id : null;
  if (pizzaPick) {
    pizzaFront(zabkaRoot, pizzaPick);
    taken.add(pizzaPick.id);
  }
  // A bookshop on a free low building, away from the fast food joint where it can be: deep green, its window full of books.
  const bookshopPool = allBuildings()
    .filter((b) => !taken.has(b.id) && b.id !== squat)
    .map((b) => ({ b, cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2 }))
    .sort((p, q) => p.b.storeys - q.b.storeys || Math.abs(p.cz) - Math.abs(q.cz));
  // Away from the fast food joint if any such building is free, else the first free one.
  const bookshopPick = bookshopPool.find(({ cx, cz }) => !ff || Math.hypot(cx - ff.x, cz - ff.z) > 25) ?? bookshopPool[0];
  const bookshop = bookshopPick ? bookshopPick.b.id : null;
  if (bookshopPick) {
    bookshopFront(zabkaRoot, bookshopPick.b);
    taken.add(bookshopPick.b.id);
  }
  // A primary school and a public library on free buildings of two or more storeys, apart from each other.
  const civicPool = () => allBuildings()
    .filter((b) => !taken.has(b.id) && b.id !== squat)
    .map((b) => ({ b, cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2 }))
    .sort((p, q) => Number(q.b.storeys >= 2) - Number(p.b.storeys >= 2) || (q.b.x1 - q.b.x0) - (p.b.x1 - p.b.x0));
  const schoolPick = civicPool()[0];
  const school = schoolPick ? schoolPick.b.id : null;
  if (schoolPick) {
    civicFront(zabkaRoot, schoolPick.b, 'SCHOOL', 0xd8a030, '#2a2a3a', 'drawings');
    taken.add(schoolPick.b.id);
  }
  const libraryPick = civicPool().find(({ cx, cz }) => !schoolPick || Math.hypot(cx - schoolPick.cx, cz - schoolPick.cz) > 25) ?? civicPool()[0];
  const library = libraryPick ? libraryPick.b.id : null;
  if (libraryPick) {
    civicFront(zabkaRoot, libraryPick.b, 'LIBRARY', 0x3a4a6a, '#f0e8d0', 'shelves');
    taken.add(libraryPick.b.id);
  }
  // A church, a synagogue and a mosque on free buildings of two storeys or more, spread across the district.
  const worship = new Map<number, Worship>();
  for (const kind of ['church', 'synagogue', 'mosque'] as const) {
    const spots = [...worship.keys()].map((id) => cityBuilding(id)!);
    const pool = allBuildings()
      // The mosque's dome wants an open deck on a flat roof (clear of a higher end or a set-back floor); all three a building of some size, within the district.
      .filter((b) => !taken.has(b.id) && b.id !== squat && b.storeys >= 2 && b.x1 - b.x0 >= 5 && b.z1 - b.z0 >= 4.5 && (kind !== 'mosque' || (!!b.deck && b.deck.x1 - b.deck.x0 >= 4.5 && b.deck.z1 - b.deck.z0 >= 4.5)) && Math.max(Math.abs((b.x0 + b.x1) / 2), Math.abs((b.z0 + b.z1) / 2)) < 64);
    const apart = (b: CityBuilding, m: number) => spots.every((o) => Math.hypot((o.x0 + o.x1) / 2 - (b.x0 + b.x1) / 2, (o.z0 + o.z1) / 2 - (b.z0 + b.z1) / 2) > m);
    const pick = pool.find((b) => apart(b, 30)) ?? pool.find((b) => apart(b, 15));
    if (!pick) continue;
    worshipFront(zabkaRoot, pick, kind);
    worship.set(pick.id, kind);
    taken.add(pick.id);
  }
  // Ivy up some walls and evergreens by doors (world/greenery.ts): static, merged with the rest.
  buildGreenery(zabkaRoot, allBuildings().filter((b) => !taken.has(b.id) && b.id !== squat), mulberry(73));
  mergeStatic(zabkaRoot);
  // A few low-key psychedelic murals (creatures and phrases) on walls the camera sees, upper floors (shopfronts stay clear).
  const muralPool = allBuildings()
    // Upper floors only, so a shop below is fine; not the Żabkas, the fast food joint or the institutions.
    .filter((b) => !zabkas.includes(b.id) && b.id !== fastFood && b.id !== bookshop && b.id !== pizza && b.id !== school && b.id !== library && !worship.has(b.id) && !Object.values(beyond.landmarks).includes(b.id) && Math.max(Math.abs((b.x0 + b.x1) / 2), Math.abs((b.z0 + b.z1) / 2)) < 60);
  // Each mural goes on a real surface, found by a ray: walls at upper-floor height on faces the camera sees,
  // and one flat shopfront roof (flat where five points on it agree).
  const muralSpots: MuralSpot[] = [];
  const ray = new Raycaster();
  const hitOn = (b: CityBuilding, from: Vector3, dir: Vector3) => {
    ray.set(from, dir);
    const h = ray.intersectObjects(meshes, false)[0];
    return h && h.point.x > b.x0 - 1.5 && h.point.x < b.x1 + 1.5 && h.point.z > b.z0 - 1.5 && h.point.z < b.z1 + 1.5 ? h.point : null;
  };
  // Only where the default camera can see it: nothing between the wall and the viewer.
  const toViewer = new Vector3(Math.SQRT1_2, Math.tan(Math.atan(1 / Math.SQRT2)), Math.SQRT1_2).normalize();
  const inView = (p: Vector3, face: 'x' | 'z') => {
    ray.set(p.clone().add(new Vector3(face === 'x' ? 0.3 : 0, 0, face === 'z' ? 0.3 : 0)), toViewer);
    return !ray.intersectObjects(meshes, false).some((h) => h.distance < 120);
  };
  for (const b of muralPool.filter((q) => q.storeys >= 2)) {
    if (muralSpots.length >= 4) break;
    if (muralSpots.length && muralSpots.some((m) => Math.hypot(m.x - (b.x0 + b.x1) / 2, m.z - (b.z0 + b.z1) / 2) < 18)) continue;
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    const onX = b.z1 - b.z0 >= b.x1 - b.x0;
    const p = onX ? hitOn(b, new Vector3(b.x1 + 8, 5, cz), new Vector3(-1, 0, 0)) : hitOn(b, new Vector3(cx, 5, b.z1 + 8), new Vector3(0, 0, -1));
    if (p && inView(p, onX ? 'x' : 'z')) muralSpots.push(onX ? { x: p.x + 0.04, y: 5, z: p.z, face: 'x' } : { x: p.x, y: 5, z: p.z + 0.04, face: 'z' });
  }
  for (const b of muralPool.filter((q) => q.storeys === 1)) {
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    const ys = [[0, 0], [-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]].map(([dx, dz]) => hitOn(b, new Vector3(cx + dx, 60, cz + dz), new Vector3(0, -1, 0))?.y ?? -1);
    if (ys[0] > 1 && Math.max(...ys) - Math.min(...ys) < 0.05) { muralSpots.push({ x: cx, y: ys[0] + 0.03, z: cz, face: 'up' }); break; }
  }
  const muralRoot = add(scene, new Group());
  buildMurals(muralRoot, muralSpots, mulberry(79 ^ launch));
  mergeStatic(muralRoot);
  if (squatBuilding) new Letting(lettingRoot, squatBuilding, roofOf(squatBuilding)).set({ sign: 'SQUAT', fg: '#f4e8d0', bg: '#2a2a2a' });
  // Buildings kept for the venues that open as the district thrives: the next nearest ordinary ones.
  const nightlife = allBuildings()
    .filter((b) => !taken.has(b.id) && b.id !== squat && b.storeys >= 2 && Math.abs((b.x0 + b.x1) / 2) < 40 && Math.abs((b.z0 + b.z1) / 2) < 40)
    .map((b) => ({ b, d: Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) }))
    .sort((a, c) => a.d - c.d)
    .filter((_, i) => i % 3 === 1)
    .slice(0, NIGHTLIFE_SIGNS.length)
    .map(({ b }) => { const roof = roofOf(b); return { b, roof, sign: new Letting(lettingRoot, b, roof), shown: '' }; });
  // Where people stand outside each of those venues: either side of its street door, out on the pavement.
  const barSpots = nightlife.flatMap(({ b }, venue) => {
    const { door, normal } = frontDoor(b, 1.5);
    const face = Math.atan2(-normal.x, -normal.z);
    return [-1.6, -0.4, 1.4].map((along) => ({ venue, at: { x: door.x + normal.z * along, z: door.z - normal.x * along }, face }))
      .filter(({ at }) => seatClear(at.x, at.z, 0.4));
  });
  // The city's own openings and closings: balloons up from a new business, a puff of dust from one that shuts.
  const opening = new OpeningFx(scene, () => still, mulberry(97 ^ launch));
  // Buildings the organisation takes over grow their fronts level by level (world/fitOut.ts).
  const fitOuts = new FitOuts(scene, glowMat(PALETTE.glassDark, PALETTE.warmWindow, 0.8));
  // The district's ordinary buildings run down or get done up with the district (world/districtLife.ts):
  // all but the ones with a look of their own (shops, venues, the squat, civic buildings, landmarks).
  const ownLook = new Set([...taken, ...nightlife.map((n) => n.b.id), ...(squat === null ? [] : [squat]), ...Object.values(beyond.landmarks)]);
  // Pizza, Żabkas, the fast food and the like are in `taken`; the nightlife pack dresses only what is left.
  claimRoof(worship.keys());
  claimLook([...ownLook, ...zabkas, ...worship.keys(), ...[pizza, fastFood, bookshop, school, library].filter((id): id is number => id !== null && id !== undefined)]);
  const district = new DistrictLife(
    scene,
    allBuildings().filter((b) => !ownLook.has(b.id) && Math.max(Math.abs((b.x0 + b.x1) / 2), Math.abs((b.z0 + b.z1) / 2)) < DISTRICT),
    [...Object.values(LOTS).map((l) => l.door), VENUE_FRAME.club, VENUE_FRAME.dropIn],
    glowMat(PALETTE.glassDark, PALETTE.warmWindow, 0.75),
    mulberry(101 ^ launch),
    (b, to, _from, roof) => {
      if (to === 'smart') opening.opened((b.x0 + b.x1) / 2, roof, (b.z0 + b.z1) / 2);
      else if (to === 'boarded') opening.closed((b.x0 + b.x1) / 2, roof, (b.z0 + b.z1) / 2);
    },
  );
  const atRoof = (b: CityBuilding, roof: number): [number, number, number] => [(b.x0 + b.x1) / 2, roof, (b.z0 + b.z1) / 2];
  /** What each shop unit showed last, so a change can be told from the first sync. */
  const unitShown: (UnitLook | undefined)[] = [];
  let nightlifeSynced = false;
  // Harm reduction points the player opens in ordinary buildings: a sign each, made when first needed.
  const pointSigns = new Map<number, Letting>();
  // The park camp: tents of tarps and old canvas, nearest the district first.
  const tents = campTents(mulberry(71), 14, PARK_CAMP.x0 + 2.6, PARK_CAMP.z0 + 2.4, 4);
  for (const t of tents) scene.add(t);
  // The station camp: on the forecourt south of the tracks, just outside the district.
  const stationTents = campTents(mulberry(73), 10, STATION_CAMP.x0 + 4, STATION_CAMP.z0 + 2, 4);
  for (const t of stationTents) scene.add(t);
  // Both camps can be clicked for a card: their ground, registered as open ground (never let or used as a venue).
  const camps = {
    park: registerBuilding(PARK_CAMP.x0, PARK_CAMP.x1, PARK_CAMP.z0, PARK_CAMP.z1, 1.6, true),
    station: registerBuilding(STATION_CAMP.x0, STATION_CAMP.x1, STATION_CAMP.z0, STATION_CAMP.z1, 1.6, true),
  };
  // The warming bus parks on the east street; the water and shade point stands in the pocket park.
  const aid = { bus: dynamic(bus()), water: dynamic(waterPoint()) };
  aid.bus.position.set(AID_BUS.x, 0.02, AID_BUS.z);
  aid.water.position.set(6.2, 0.1, 9.0);
  aid.bus.visible = aid.water.visible = false;
  scene.add(aid.bus, aid.water);
  // Kerb-spot markers for moving the camper: a lit outline of the van's footprint and a pin above it.
  const spotMarkers = CAMPER_SPOTS.map((s) => {
    const m = dynamic(new Group());
    m.position.set(s.x, 0.05, s.z);
    m.rotation.y = s.rot;
    const glow = glowMat(0x2f7a5a, 0x7fffc0, 1.2);
    add(m, box(2.6, 0.04, 6.8, glowMat(0x1f4a3a, 0x3fd890, 0.5)));
    for (const x of [-1.3, 1.3]) add(m, box(0.12, 0.08, 6.8, glow, x, 0.01, 0));
    for (const z of [-3.4, 3.4]) add(m, box(2.6, 0.08, 0.12, glow, 0, 0.01, z));
    const pin = add(m, new Mesh(new ConeGeometry(0.6, 1.2, 12), glow));
    pin.position.y = 4.2;
    pin.rotation.x = Math.PI;
    m.visible = false;
    scene.add(m);
    return m;
  });
  // Extra campers stand at spots the player picks; each is a copy of the first,
  // turned and placed by a pivot at the van's middle.
  const campers = new Map<number, { pivot: Group; arrive: number }>();
  const counterAt = counterAtSpot;
  // Footprints tagged by the builders survive the merge on their (now empty) groups.
  const solids = collectSolids(scene);
  ambient.setSolids(solids);
  return {
    solids,
    puffs,
    scene,
    locations,
    club,
    camper: outreach,
    frame: {
      full: new Box3(new Vector3(-HALF, -1.6, -HALF), new Vector3(HALF, 7.5, HALF)),
      // Room to look round the city beyond: the river, the park, the old town and the towers.
      // Depth volume for the camera: reaches out to the far skyline so nothing near it is clipped.
      bounds: new Box3(new Vector3(-300, -0.5, -300), new Vector3(300, 60, 300)),
    },
    setViewFocus(x, z, radius) {
      // Shadow texels stay roughly square to world pixels: the frustum only grows when zoomed out,
      // in steps a quarter apart, so zooming does not resize the shadow texels every frame (which
      // made shadows on the lawns shimmer); between steps the snapping below holds them still.
      const half = 26 * 1.25 ** Math.max(0, Math.ceil(Math.log(radius / 26) / Math.log(1.25)));
      const cam = sun.shadow.camera;
      if (cam.right !== half) {
        cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
        cam.updateProjectionMatrix();
      }
      // Snap the shadow box to whole shadow texels in the sun's own frame, so
      // shadow edges hold still instead of crawling while the view pans.
      const texel = (2 * half) / sun.shadow.mapSize.x;
      snap.set(x, 0, z).applyMatrix4(toSun);
      snap.x = Math.round(snap.x / texel) * texel;
      snap.y = Math.round(snap.y / texel) * texel;
      snap.applyMatrix4(fromSun);
      sun.target.position.copy(snap);
      weather.follow(x, z);
      ambient.setView(x, z, radius, detail);
      sun.position.copy(snap).add(SUN_OFFSET);
      sun.target.updateMatrixWorld();
    },
    setStaffing(id, extra, short, open) {
      expansions[id].set(extra, short, open);
    },
    setStage(id, stage, instant) {
      stageProps[id].set(stage, instant || still);
    },
    shopUnits: shopUnits.map(({ b }) => b.id),
    setShops(kinds) {
      shopSigns.forEach((sign, i) => {
        if (i < FIXED_SHOPS.length) return;
        const kind = kinds[i - FIXED_SHOPS.length] ?? null;
        if (shopKinds[i] === kind) return;
        shopKinds[i] = kind;
        sign.set(kind ? SHOP_SIGN[kind] : 'trading');
      });
    },
    setTrafficYield: (ahead) => ambient.setYield(ahead),
    traffic,
    hazeHex: () => `#${(scene.fog as Fog).color.getHexString()}`,
    // The warming bus, when out, joins the vehicles that can be clicked.
    vehicles: () => (aid.bus.visible ? [...ambient.vehicles(), { id: WARMING_BUS_ID, root: aid.bus }] : ambient.vehicles()),
    trainSpan: () => beyond.trainSpan(),
    helicopter: (out) => ambient.helicopter(out),
    vehicle: (id) => (id === WARMING_BUS_ID
      ? aid.bus.visible ? { kind: 'warmingBus', reason: t('Your warming bus: hot drinks, blankets and a warm seat on cold nights, and a word with your team.'), state: 'Parked' } : undefined
      : ambient.vehicle(id)),
    summonUfo: () => ambient.summonUfo(),
    dispatch(kind, x, z, reason) {
      return ambient.dispatch(kind, x, z, reason);
    },
    shopAt(buildingId) {
      const i = specials.findIndex(({ b }) => b.id === buildingId);
      return i >= 0 ? shopKinds[i] : null;
    },
    setUnit(i, look) {
      lettings[i]?.set(look);
      const before = unitShown[i];
      unitShown[i] = look;
      const unit = shopUnits[i];
      if (before === undefined || !unit) return;
      const at = atRoof(unit.b, unit.roof);
      // A new business takes the unit: balloons. A shop shuts: dust. (A squat moving in gets neither.)
      if (before !== 'trading' && look === 'trading') opening.opened(...at);
      else if (before === 'trading' && look === 'toLet') opening.closed(...at);
    },
    camperCounter(spot) {
      return CAMPER_SPOTS[spot] ? counterAt(spot) : undefined;
    },
    pickables() {
      return [...campers.values()].map((c) => c.pivot);
    },
    showCamperSpots(free) {
      spotMarkers.forEach((m, i) => { m.visible = !!free?.[i]; });
    },
    camperSpotMarkers() {
      return spotMarkers.flatMap((root, id) => (root.visible ? [{ id, root }] : []));
    },
    moveCamper(spot) {
      moveCamperFrame(spot);
      outreach.relocate();
    },
    squat,
    landmarks: beyond.landmarks,
    campusSite: beyond.campusSite,
    camps,
    pharmacyShop: pharmacyShop.building,
    zabkas,
    fastFood,
    bookshop,
    pizza,
    school,
    library,
    worship,
    nightlife: nightlife.map((n) => n.b.id),
    barSpots,
    setDistrict: (v, minute) => district.set(v, minute),
    frontState: (id) => district.state(id),
    setHappenings: (v) => beyond.events.set(v),
    setTeamBus: (on) => teamBus.setMatch(on),
    setNightlife(open, partnered) {
      nightlife.forEach((n, i) => {
        const key = i < open ? (partnered.has(i) ? 'p' : 'o') : '';
        if (n.shown === key) return;
        if (nightlifeSynced && !n.shown && key) opening.opened(...atRoof(n.b, n.roof));
        else if (nightlifeSynced && n.shown && !key) opening.closed(...atRoof(n.b, n.roof));
        n.shown = key;
        const look = NIGHTLIFE_SIGNS[i];
        n.sign.set(key ? { ...look, sign: key === 'p' ? `${look.sign} ★` : look.sign } : 'trading');
      });
      nightlifeSynced = true;
    },
    setExtraCampers(spots) {
      for (const spot of spots) {
        if (campers.has(spot) || !CAMPER_SPOTS[spot]) continue;
        const s = CAMPER_SPOTS[spot];
        const pivot = new Group();
        pivot.name = 'outreach';
        pivot.position.set(s.x, 0, s.z);
        pivot.rotation.y = s.rot;
        // A copy of the van as designed, offset like the first camper's.
        add(pivot, outreach.template.clone(true)).position.copy(outreach.template.position);
        scene.add(pivot);
        campers.set(spot, { pivot, arrive: 0 });
      }
      for (const [spot, c] of campers) if (!spots.includes(spot)) { scene.remove(c.pivot); campers.delete(spot); }
    },
    setFitOut(id, look) {
      const b = cityBuilding(id);
      if (b) fitOuts.set(b, look);
    },
    setPoint(id, look) {
      let sign = pointSigns.get(id);
      if (!look) { sign?.set('trading'); return; }
      if (!sign) {
        const b = cityBuilding(id);
        if (!b) return;
        sign = new Letting(lettingRoot, b, roofOf(b));
        pointSigns.set(id, sign);
      }
      sign.set(look);
    },
    setCamp(size, station) {
      for (const [set, k] of [[tents, size], [stationTents, station]] as const) {
        const n = Math.round(k * set.length);
        set.forEach((t, i) => { if (t.visible !== i < n) t.visible = i < n; });
      }
    },
    setAid(busOn, waterOn) {
      aid.bus.visible = busOn;
      aid.water.visible = waterOn;
    },
    setParkActivities(v) {
      ambient.setJoggers(v.joggers);
      parkActivities.set(v);
    },
    setParkLife(market, patrol) {
      ambient.setParkLife(market, patrol);
    },
    applyKits(kits) {
      beyond.applyKits(kits);
    },
    setDetail(mpp) {
      detail = mpp;
    },
    setFigureFactory(make) {
      ambient.setFigureFactory(make);
    },
    setHaze(near, far) {
      const fog = scene.fog as Fog;
      fog.near = near;
      fog.far = far;
    },
    works() {
      const out: { id: LocationId; progress: number; building: boolean }[] = [];
      for (const id in expansions) {
        const w = expansions[id as LocationId].works();
        if (w) out.push({ id: id as LocationId, ...w });
      }
      return out;
    },
    update(dt, time) {
      for (const id in expansions) expansions[id as LocationId].update(dt);
      for (const id in stageProps) stageProps[id as ServiceId].update(dt, still);
      for (const l of lettings) l.update(dt, still);
      for (const l of shopSigns) l.update(dt, still);
      opening.update(dt);
      // New campers drive in from up the street and pull up at their spot.
      for (const [spot, c] of campers) {
        if (c.arrive >= 1) continue;
        c.arrive = still ? 1 : Math.min(1, c.arrive + dt / 2.5);
        const k = 1 - (1 - c.arrive) ** 3;
        // Drives in along its own length and pulls up.
        const s = CAMPER_SPOTS[spot];
        const back = (1 - k) * 30;
        c.pivot.position.set(s.x - Math.sin(s.rot) * back, 0, s.z - Math.cos(s.rot) * back);
      }
      dropIn.update(dt, time);
      club.update(dt, time);
      outreach.update(dt, time);
      for (const p of places) p.update(dt, time);
      residentialWindows.update(dt, 0.55);
      outskirts.update(dt, 0.35);
      beyond.update(dt);
      lights.update(dt);
      ambient.update(dt);
      teamBus.update(dt);
      puffs.update(dt);
      for (const w of beyond.windows) w.update(dt, 0.4);
      for (const w of infill) w.update(dt, 0.45);
      updateNeon(time, neonLevel);
      for (const s of steam) s.update(dt);
      for (const b of blocks) b.update(dt);
      weather.update(dt, still);
      if (!still) tickPuddles(dt);
    },
    setSeason(season, profile) {
      setFoliageSeason(season);
      setKitSeason(season);
      SNOW.value = profile.look.snow;
      weather.set(profile.look.drift);
      lighting.setSeason(profile.look.light, profile.look.lightStrength);
    },
    setStill(value) {
      still = value;
      for (const id in expansions) expansions[id as LocationId].setStill(value);
    },
    setNight(night, day = 0) {
      lighting.setNight(night, day);
      ambient.setNight(night);
      teamBus.setNight(night);
      // Haze in the colour of the horizon the player sees: grey-blue by day, dusky, dark blue at night.
      (scene.fog as Fog).color.copy(HAZE_DUSK).lerp(HAZE_NIGHT, night).lerp(HAZE_DAY, day);
      setLampNight(night, day);
      setVehicleDaylight(day);
      setWindowDaylight(day);
      setPoolDaylight(day);
      setPuddleLight(night, day);
      // Neon reads brighter as the night deepens and fades out in daylight.
      neonLevel = (0.8 + 0.35 * night) * (1 - 0.75 * day);
    },
  };
}

function buildGround(g: Group, random: Random): void {
  const S = HALF * 2;
  // Ground between the centre block's buildings (the road and its markings
  // come from the district street network).
  add(g, box(S, 0.02, S, mat(PALETTE.soil), 0, -0.01, 0));
  const line = mat(PALETTE.asphaltLine);
  for (let x = ROAD.x0 + 0.45; x < ROAD.x1 - 0.2; x += 0.85) {
    add(g, box(0.45, 0.008, CROSSING.z1 - CROSSING.z0, line, x, 0.02, (CROSSING.z0 + CROSSING.z1) / 2));
  }
  add(g, box(2.8, 0.008, 0.22, line, -4.5, 0.02, CROSSING.z0 - 0.9));

  // Pavements laid as alternating slab rows for a restrained texture.
  const slab = (x0: number, x1: number, z0: number, z1: number, step = 1.5) => {
    for (let z = z0, i = 0; z < z1 - 0.01; z += step, i++) {
      const len = Math.min(step, z1 - z);
      add(g, box(x1 - x0, 0.12, len, mat(i % 2 ? PALETTE.pavement : PALETTE.pavementAlt), (x0 + x1) / 2, 0, z + len / 2));
    }
  };
  slab(PAVE_W.x0, PAVE_W.x1 - 0.1, -HALF, HALF);
  slab(PAVE_E.x0 + 0.1, PAVE_E.x1, -HALF, HALF);

  // Courtyard behind the residential block, drop-in forecourt and path, club terrace.
  add(g, box(6.5, 0.12, 7.0, mat(PALETTE.pavementAlt), -11.75, 0, -11.5));
  add(g, box(HALF - PAVE_E.x1, 0.12, 4.5, mat(PALETTE.pavementAlt), (PAVE_E.x1 + HALF) / 2, 0, -5.25));
  add(g, box(HALF - PAVE_E.x1, 0.121, 1.8, mat(PALETTE.pavement), (PAVE_E.x1 + HALF) / 2, 0, -4.0));
  add(g, box(HALF + PAVE_W.x0, 0.12, 5.0, mat(PALETTE.pavementAlt), (-HALF + PAVE_W.x0) / 2, 0, 5.5));

  // Green areas.
  add(g, box(HALF - PAVE_E.x1, 0.1, HALF + 3, mat(PALETTE.grass), (PAVE_E.x1 + HALF) / 2, 0, (HALF - 3) / 2));
  add(g, box(HALF + PAVE_W.x0, 0.1, HALF - 8, mat(PALETTE.grass), (-HALF + PAVE_W.x0) / 2, 0, (HALF + 8) / 2));
  add(g, box(HALF - 13.2, 0.1, 7.5, mat(PALETTE.grass), 14.1, 0, -11.25));
  add(g, box(10.4, 0.1, 0.4, mat(PALETTE.grassDark), 8, 0, -14.8));
  // The lawn's patches, clumps and wear come from the ground shader (materials.ts).

  // Gravel park paths along the walk graph.
  const path = (a: P2, b: P2, w = 1.4) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const piece = box(w, 0.11, Math.hypot(dx, dz) + w * 0.5, mat(PALETTE.gravel), (a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    add(g, piece, Math.atan2(dx, dz));
  };
  // Road furniture: manholes and kerb drains.
  for (const [x, z] of [[-3.8, -11.2], [-4.6, 7.8], [-4.0, 12.6]] as const) add(g, manhole()).position.set(x, 0.02, z);
  for (const z of [-12.5, -7.2, 1.0, 9.0, 13.5]) {
    add(g, drainGrate(), Math.PI / 2).position.set(ROAD.x0 + 0.3, 0.02, z);
    add(g, drainGrate(), Math.PI / 2).position.set(ROAD.x1 - 0.3, 0.02, z + 1.4);
  }
  // Wildflower clumps around tree bases and lawn edges.
  for (const [cx, cz] of [[11.6, 2.6], [10.2, 4.8], [10.6, 12.6], [9.4, 2.4], [12.2, 7.6], [6.4, 6.0]] as const) {
    for (let i = 0; i < 7; i++) {
      const x = cx + (random() - 0.5) * 0.9;
      const z = cz + (random() - 0.5) * 0.9;
      add(g, box(0.07, 0.16, 0.07, mat(PALETTE.foliageLight), x, 0.1, z));
      if (i % 2 === 0) add(g, box(0.12, 0.08, 0.12, mat([0xe8e0f0, 0xf0d070, 0xe0a0b8][i % 3]), x, 0.26, z));
    }
  }

  path(NODES.eJunction, NODES.park);
  path(NODES.park, { x: HALF, z: NODES.parkEast.z });
  path(NODES.park, { x: NODES.parkFront.x, z: HALF });
}

function buildResidential(scene: Scene, random: Random): WindowBank {
  const g = add(scene, new Group());
  const x0 = -14.8;
  const x1 = -8.9;
  const z0 = -14.8;
  const z1 = -9.0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const h = 9.2;
  add(g, box(x1 - x0, h, z1 - z0, mat(PALETTE.brick), cx, 0, cz));
  add(g, box(x1 - x0 + 0.2, 0.35, z1 - z0 + 0.2, mat(PALETTE.roofTrim), cx, h, cz));
  add(g, box(x1 - x0 + 0.1, 0.6, z1 - z0 + 0.1, mat(PALETTE.brickDark), cx, 0, cz));
  add(g, box(0.8, 1.4, 0.8, mat(PALETTE.brickDark), cx + 1.5, h + 0.35, cz - 1));

  const mats = Array.from({ length: 7 }, () => glowMat(PALETTE.glassDark, PALETTE.warmWindow, 0.2));
  const cool = glowMat(PALETTE.glassDark, PALETTE.coolWindow, 0.2);
  mats.push(cool);
  let k = 0;
  for (let floor = 1; floor < 3; floor++) {
    const y = floor * 3 + 0.7;
    for (const z of [-13.6, -11.9, -10.2]) {
      add(g, box(0.08, 1.4, 0.9, mats[k++ % mats.length], x1 + 0.02, y, z));
    }
    for (const x of [-13.6, -11.9, -10.2]) {
      add(g, box(0.9, 1.4, 0.08, mats[k++ % mats.length], x, y, z1 + 0.02));
      add(g, box(1.3, 0.12, 0.6, mat(PALETTE.concrete), x, y - 0.25, z1 + 0.3));
      add(g, box(1.3, 0.5, 0.05, mat(PALETTE.metal), x, y - 0.13, z1 + 0.58));
    }
  }
  // Closed ground-floor shop with roller shutter and awning.
  add(g, box(0.06, 2.0, 3.6, mat(PALETTE.concrete), x1 + 0.03, 0.6, -11.9));
  add(g, box(0.9, 0.12, 3.8, mat(PALETTE.brickDark), x1 + 0.45, 2.75, -11.9));
  add(g, box(1.0, 1.6, 0.06, glowMat(PALETTE.glassDark, PALETTE.warmWindow, 0.25), -11.9, 0.7, z1 + 0.03));

  // Brick detail: string courses, window trim, flower boxes, services.
  for (const y of [3.0, 6.0]) add(g, box(x1 - x0 + 0.08, 0.14, z1 - z0 + 0.08, mat(PALETTE.brickDark), cx, y, cz));
  for (let floor = 1; floor < 3; floor++) {
    const y = floor * 3 + 0.7;
    for (const z of [-13.6, -11.9, -10.2]) {
      add(g, windowTrim(0.9, 1.4, mat(PALETTE.frame), mat(PALETTE.concrete)), Math.PI / 2).position.set(x1 + 0.02, y, z);
      if ((floor + Math.round(z)) % 2 === 0) add(g, flowerBox(0.9, random), Math.PI / 2).position.set(x1 + 0.2, y - 0.08, z);
    }
    for (const x of [-13.6, -11.9, -10.2]) {
      add(g, windowTrim(0.9, 1.4)).position.set(x, y, z1 + 0.02);
      add(g, flowerBox(0.5, random)).position.set(x + 0.35, y - 0.13, z1 + 0.45);
    }
  }
  add(g, drainpipe(h + 0.2)).position.set(x1 - 0.12, 0, z1 + 0.08);
  // Rear walls at the diorama edge, seen when the camera orbits.
  for (let floor = 0; floor < 3; floor++) {
    const y = floor * 3 + 0.7;
    for (const v of [-13.6, -11.9, -10.2]) {
      add(g, box(0.08, 1.4, 0.9, mats[k++ % mats.length], x0 - 0.02, y, v));
      add(g, windowTrim(0.9, 1.4), -Math.PI / 2).position.set(x0 - 0.02, y, v);
      add(g, box(0.9, 1.4, 0.08, mats[k++ % mats.length], v, y, z0 - 0.02));
      add(g, windowTrim(0.9, 1.4), Math.PI).position.set(v, y, z0 - 0.02);
    }
  }
  add(g, acUnit(), Math.PI / 2).position.set(x1 + 0.3, 5.0, -12.75);
  add(g, satelliteDish(), Math.PI / 3).position.set(x1 + 0.12, 8.2, -13.0);
  add(g, waterTank()).position.set(cx - 1.4, h + 0.35, cz + 1.2);
  add(g, antenna(2.4)).position.set(cx + 0.4, h + 0.35, cz - 1.8);
  add(g, roofVent()).position.set(cx + 2.0, h + 0.35, cz + 1.8);
  for (const dz of [-0.25, 0.25]) add(g, box(0.18, 0.4, 0.18, mat(PALETTE.brick), cx + 1.5 + dz, h + 1.75, cz - 1));
  add(g, box(1.0, 0.28, 0.08, mat(PALETTE.canvasCream), -11.9, 2.45, z1 + 0.05));
  mergeStatic(g);
  return new WindowBank(mats, 1.15, 0.06, random);
}

function buildProps(scene: Scene): void {
  const g = add(scene, new Group());
  const lamps: [number, number, number][] = [
    [PAVE_W.x0 + 0.3, -9.5, 1],
    [PAVE_W.x0 + 0.3, 9.0, 1],
    [PAVE_E.x1 - 0.3, -2.2, -1],
    [PAVE_E.x1 - 0.3, 10.8, -1],
  ];
  for (const [x, z, dir] of lamps) {
    add(g, streetLight(dir).group).position.set(x, 0.12, z);
    lightPool(g, x + dir * 0.82, z, 10, 10);
  }

  // Trees kept to the edges so they never hide entrances or queues.
  const trees: [number, number, 0 | 1 | 2, number][] = [
    [10.9, 1.4, 0, 1], [7.6, 4.6, 1, 0.9], [11.3, 13.4, 0, 1.05], [14.0, 12.4, 2, 0.9],
    [-9.1, 14.2, 2, 0.8], [14.2, -10.2, 1, 0.9],
  ];
  for (const [x, z, v, s] of trees) add(g, tree(v, s)).position.set(x, 0.1, z);

  const benches: [number, number, number][] = [[10.2, 6.9, 0], [4.6, 11.4, Math.PI / 2], [-12.4, 9.2, 0]];
  for (const [x, z, r] of benches) add(g, bench(), r).position.set(x, 0.1, z);
  const bins: [number, number][] = [[2.15, 0.6], [PAVE_W.x0 + 0.35, 1.0], [8.8, 7.0], [2.1, -6.6]];
  for (const [x, z] of bins) add(g, bin()).position.set(x, 0.12, z);
  add(g, planter(2.0, 0.6), Math.PI / 2).position.set(14.2, 0.12, -5.6);

  // Bollards protect the crossing kerbs.
  for (const z of [CROSSING.z0 - 0.3, CROSSING.z1 + 0.3]) {
    add(g, bollard()).position.set(PAVE_W.x1 - 0.35, 0.12, z);
    add(g, bollard()).position.set(PAVE_E.x0 + 0.3, 0.12, z);
  }
  // Bike stands by the drop-in path, two in use.
  for (const x of [12.0, 12.8, 13.6]) add(g, box(0.06, 0.7, 0.6, mat(PALETTE.metal), x, 0.12, -3.0));
  add(g, bike(0x4f6a8a), Math.PI / 2).position.set(12.1, 0.12, -3.0);
  add(g, bike(0xa05a5a), Math.PI / 2).position.set(13.5, 0.12, -3.0);

  // Street furniture: hydrant, post box, signs, scooters, advertising pillar.
  add(g, hydrant()).position.set(2.25, 0.12, -9.6);
  add(g, postBox()).position.set(2.35, 0.12, -1.9);
  add(g, signPost(0x3f5f9a), -Math.PI / 2).position.set(PAVE_W.x1 - 0.25, 0.12, 11.5);
  add(g, signPost(0xd0d0c8)).position.set(PAVE_E.x0 + 0.25, 0.12, 9.6);
  add(g, scooter(0x5fb3a3), Math.PI / 2 + 0.2).position.set(14.5, 0.12, -2.5);
  add(g, scooter(0xd2b36a), Math.PI / 2 + 0.1).position.set(14.0, 0.12, -2.3);
  add(g, advertPillar(glowMat(0xe0d2b4, 0xffe0b0, 0.35))).position.set(-9.0, 0.1, 12.4);
  add(g, busShelter(glowMat(0xd8e4f0, 0xc8dcff, 0.6)), Math.PI / 2).position.set(-8.28, 0.12, -12.4);

  // Pedestrian signals at both kerbs of the crossing.
  const red = glowMat(0x5a2a2a, 0xff5040, 0.15);
  const green = glowMat(0x2a4a3a, 0x50e090, 1.4);
  add(g, pedestrianSignal(red, green), Math.PI / 2).position.set(PAVE_W.x1 - 0.3, 0.12, CROSSING.z1 + 0.6);
  add(g, pedestrianSignal(red, green), -Math.PI / 2).position.set(PAVE_E.x0 + 0.3, 0.12, CROSSING.z0 - 0.6);
  add(g, beacon(glowMat(0xe0a050, 0xffb040, 1.0))).position.set(PAVE_W.x1 - 0.3, 0.12, CROSSING.z0 - 0.6);
  add(g, beacon(glowMat(0xe0a050, 0xffb040, 1.0))).position.set(PAVE_E.x0 + 0.3, 0.12, CROSSING.z1 + 0.6);

  // Park: hedge, fence, flower beds, picnic table.
  add(g, hedge(5.0, () => 0.5), Math.PI / 2).position.set(3.0, 0.1, 11.9);
  add(g, fence(3.6)).position.set(5.1, 0.1, 14.75);
  add(g, fence(5.2)).position.set(12.2, 0.1, 14.75);
  add(g, flowerBed(1.8, 0.8, mulberry(7))).position.set(11.6, 0.1, 10.7);
  add(g, flowerBed(2.2, 1.0, mulberry(11))).position.set(5.4, 0.1, 2.6);
  add(g, flowerBed(1.4, 0.7, mulberry(13))).position.set(8.6, 0.1, -1.4);
  add(g, picnicTable()).position.set(5.8, 0.1, 13.5);

  // Utility cables strung across the street between rooftops.
  // Cables strung between the club's and the drop-in's roofs, when both stand where they were designed.
  if (VENUES_AT_HOME) add(g, stringLights([
    [-8.5, 5.2, -6.8, 2.8, 6.1, -9.4],
    [-8.5, 5.0, -6.4, 2.8, 5.8, -8.6],
    [-8.9, 7.8, -9.3, 2.8, 6.5, -13.8],
  ], []));
  mergeStatic(g);
}

function buildParkedCars(scene: Scene): void {
  const g = add(scene, new Group());
  const parked: [number, number][] = [[-14.4, 3], [-10.4, 0], [HOME_CAMPER.z1 + 2.5, 1], [HOME_CAMPER.z1 + 6.9, 2]];
  for (const [z, c] of parked) add(g, car(CAR_COLOURS[c], false)).position.set(ROAD.parkX, 0.02, z);
  mergeStatic(g);
}

const DUSK = { sky: new Color(0x8fa4b4), ground: new Color(0x5a4a3c), hemi: 1.8, sun: new Color(0xffb07a), sunIntensity: 2.4 };
/** Night: moonlit, blue and readable; lamps and windows still carry the warm light. */
const NIGHT = { sky: new Color(0x6a7ca0), ground: new Color(0x3a3430), hemi: 1.9, sun: new Color(0xa8bce0), sunIntensity: 1.35 };
/** Overcast city daylight: bright, a little grey, the sun high and white. */
const DAY = { sky: new Color(0xc4d0dc), ground: new Color(0x7a6c5c), hemi: 3.1, sun: new Color(0xfff4e6), sunIntensity: 3.8 };

function buildLighting(scene: Scene): { sun: DirectionalLight; setNight(night: number, day?: number): void; setSeason(tint: number, strength: number): void } {
  const hemi = new HemisphereLight(DUSK.sky, DUSK.ground, DUSK.hemi);
  scene.add(hemi);
  const sun = new DirectionalLight(DUSK.sun, DUSK.sunIntensity);
  sun.position.set(-12, 16, 20);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(QUALITY.shadowMap, QUALITY.shadowMap);
  const cam = sun.shadow.camera;
  cam.left = -26; cam.right = 26; cam.top = 26; cam.bottom = -26; cam.near = 1; cam.far = 80;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const duskBg = new Color(PALETTE.skyTop);
  const nightBg = new Color(PALETTE.skyTopNight);
  const background = scene.background as Color;
  const tint = new Color(0xffffff);
  let strength = 1;
  let lastNight = 0;
  let lastDay = 0;
  const dayBg = new Color(0x9fb0c0);
  const scratch = new Color();
  return {
    sun,
    setSeason(hex, k) {
      tint.setHex(hex);
      strength = k;
      this.setNight(lastNight, lastDay);
    },
    // Same lights, shifted: emissive windows, lamps and signs carry the scene at night.
    setNight(night, day = 0) {
      // Day to dusk first, then dusk to night.
      hemi.color.lerpColors(DUSK.sky, DAY.sky, day).lerp(NIGHT.sky, night);
      hemi.groundColor.lerpColors(DUSK.ground, DAY.ground, day).lerp(NIGHT.ground, night);
      hemi.intensity = DUSK.hemi + (DAY.hemi - DUSK.hemi) * day + (NIGHT.hemi - DUSK.hemi) * night;
      sun.color.lerpColors(DUSK.sun, DAY.sun, day).lerp(NIGHT.sun, night);
      sun.intensity = DUSK.sunIntensity + (DAY.sunIntensity - DUSK.sunIntensity) * day + (NIGHT.sunIntensity - DUSK.sunIntensity) * night;
      background.lerpColors(duskBg, scratch.copy(dayBg), day).lerp(nightBg, night);
      lastDay = day;
      // The season tints and scales the light: warm long summer evenings, cold blue winter.
      lastNight = night;
      hemi.color.multiply(tint);
      sun.color.multiply(tint);
      hemi.intensity *= strength;
      sun.intensity *= strength;
    },
  };
}

/** Seeded stream for static set dressing, so detail never shifts the sim's random sequence. */
function mulberry(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
