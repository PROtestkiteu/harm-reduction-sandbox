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
import { AID_BUS, CAMPER_SPOTS, SQUAT_SPOT, moveCamper as moveCamperFrame, CROSSING, HALF, HOME_CAMPER, HOME_CLUB, LOTS, NODES, PAVE_E, PAVE_W, ROAD, VENUE_FACE, VENUES_AT_HOME, type P2 } from './layout';
import { buildBlockGround, buildOutskirts, buildStreets } from './district';
import { lightPool, setPoolDaylight } from './dressing';
import { buildInfill } from './infill';
import { updateNeon, wallClutter } from './grit';
import { buildStreetscape } from './streetscape';
import { buildClinic, buildDrugChecking, buildPharmacy, buildShelter } from './places';
import { glowMat, mat, SNOW } from './materials';
import { Weather } from './weather';
import { buildCityBeyond } from './cityBeyond';
import { setKitSeason, type Kits } from './kits';
import { buildAmbient, type AmbientKind, type VehicleInfo } from './ambient';
import type { Figure } from '../agents/character';
import { Letting, type UnitLook } from './letting';
import { allBuildings, cityBuilding, type CityBuilding } from './cityBuildings';
import { PROPERTY } from '../sim/property';
import { Expansion, type ExpansionKind, type Facing } from './expansion';
import { collectSolids, type Solids } from './solids';
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
  /** Trees, snow, light and what drifts in the air for the time of year. */
  setSeason(season: Season, profile: SeasonProfile): void;
  /** Drifting snow and leaves hold still when reduced motion is preferred. */
  setStill(still: boolean): void;
  /** Staff above (`extra`) or below (`short`) a service's usual number: its building grows or shrinks. */
  setStaffing(id: LocationId, extra: number, short: number, open: boolean): void;
  /** Building ids of the shop units the property model tracks, nearest the services first. */
  readonly shopUnits: readonly number[];
  /** What shop unit `i` shows: trading, TO LET, or a rented service's sign. */
  setUnit(i: number, look: UnitLook): void;
  /** The shops the cannabis and new-substances law allows, on fixed shopfronts. */
  setShops(kinds: readonly ShopKind[]): void;
  /** Sends an ambulance or a police car to a spot: it drives in, stops with lights flashing, then leaves. */
  dispatch(kind: 'ambulance' | 'police', x: number, z: number, reason: string): boolean;
  /** Police cars and ambulances on screen, for picking, and what each is doing. */
  vehicles(): readonly { id: number; root: Object3D }[];
  vehicle(id: number): VehicleInfo | undefined;
  /** Which of those shops a building is, if any. */
  shopAt(buildingId: number): ShopKind | null;
  /** Extra outreach campers, by spot index in CAMPER_SPOTS. */
  setExtraCampers(spots: readonly number[]): void;
  /** Shows a harm reduction point's sign on a building, or takes it down (null). */
  setPoint(building: number, look: UnitLook | null): void;
  /** The park camp at `size` (0 to 1): up to 14 tents, the first ones nearest the district. */
  setCamp(size: number): void;
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
  /** Shows the first `open` new venues' signs (partnered ones with a star). */
  setNightlife(open: number, partnered: ReadonlySet<number>): void;
  /** Building ids of the public hospital and the sobering-up centre. */
  landmarks: { hospital: number; sobering: number };
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
  /** Where the distance haze starts and is complete, in view depth. */
  setHaze(near: number, far: number): void;
  /** Crane work under way at each place, for the progress bar. */
  works(): { id: LocationId; progress: number; building: boolean }[];
  /** Ground footprints of benches, bins, posts, trees, parked cars and shelters. */
  solids: Solids;
}

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

/** Tents for the park camp, west of the park's cross path, sorted nearest the district first. */
function campTents(random: () => number): Group[] {
  const tarps = [0x3a5a7a, 0x6a7a3a, 0x8a4a3a, 0x5a5a5a, 0x7a6a4a, 0x2f5a5a];
  const out: { g: Group; z: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const g = dynamic(new Group());
    const x = -30 + (i % 5) * 4.2 + (random() - 0.5) * 1.6;
    const z = 55 + Math.floor(i / 5) * 4 + (random() - 0.5) * 1.4;
    const tent = add(g, new Mesh(new ConeGeometry(1.3, 1.4, 4), mat(tarps[i % tarps.length])), Math.PI / 4 + (random() - 0.5) * 0.5);
    tent.position.y = 0.7;
    tent.scale.set(1, 1, 1.4);
    if (i % 3 === 0) add(g, box(0.9, 0.5, 0.6, mat(0x4a4038), 1.4, 0, 0.6));
    g.position.set(x, -0.04, z);
    g.visible = false;
    out.push({ g, z });
  }
  return out.sort((a, b) => a.z - b.z).map((t) => t.g);
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
  pharmacy: { kind: 'building', front: LOTS.pharmacy.face },
  drugChecking: { kind: 'building', front: LOTS.drugChecking.face },
  shelter: { kind: 'building', front: LOTS.shelter.face },
  clinic: { kind: 'building', front: LOTS.clinic.face },
};

/** Sign colour per place. */
const EXPANSION_ACCENT: Record<LocationId, number> = {
  dropIn: 0x2e7d6b, outreach: 0x2e7d6b, club: 0xb04a8a, pharmacy: 0x3aa860, drugChecking: 0x3a6ea8, shelter: 0xc8823a, clinic: 0xc83a3a,
};

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
  const launch = (Math.random() * 0x7fffffff) | 0;
  const beyond = buildCityBeyond(scene, mulberry(29 ^ launch));
  const ambient = buildAmbient(scene, mulberry(31));
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
  const pharmacy = buildPharmacy(mulberry(41));
  const drugChecking = buildDrugChecking(mulberry(43));
  const shelter = buildShelter(mulberry(47));
  const clinic = buildClinic(mulberry(53));
  const places = [pharmacy, drugChecking, shelter, clinic];
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

  const locations: Record<LocationId, LocationVisual> = { dropIn, outreach, club, pharmacy, drugChecking, shelter, clinic };
  // Every static thing in the district merges into one mesh per material: a
  // few hundred draw calls fewer, which phones and VR headsets need. Places
  // stay separate so they can be picked and highlighted.
  for (const loc of Object.values(locations)) dynamic(loc.root);
  mergeStatic(scene);
  // Each service's building shows its staffing: a crane and cabins, boards, or a new sign.
  const expansions = Object.fromEntries(
    (Object.keys(locations) as LocationId[]).map((id) => [id, new Expansion(locations[id].root, EXPANSION_ACCENT[id], EXPANSION[id].kind, EXPANSION[id].front, locations[id].roofSign, EXPANSION[id].roof)]),
  ) as Record<LocationId, Expansion>;
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
  ambient.setHangouts(specials.filter((_, i) => FIXED_SHOPS[i] === 'liquor' || FIXED_SHOPS[i] === 'casino').map(({ b }) => ({ x: (b.x0 + b.x1) / 2, z: b.z1 + 2.5 })));
  // A squat: the ordinary building nearest the squat's kerb spot, not one of the shops, with a banner on its roof.
  const squatAt = counterAtSpot(SQUAT_SPOT);
  const taken = new Set([...shopUnits, ...specials].map(({ b }) => b.id));
  const squatBuilding = allBuildings()
    .filter((b) => !taken.has(b.id) && b.storeys >= 2)
    .map((b) => ({ b, d: Math.hypot((b.x0 + b.x1) / 2 - squatAt.x, (b.z0 + b.z1) / 2 - squatAt.z) }))
    .sort((a, c) => a.d - c.d)[0]?.b;
  const squat = squatBuilding ? squatBuilding.id : null;
  if (squatBuilding) new Letting(lettingRoot, squatBuilding, roofOf(squatBuilding)).set({ sign: 'SQUAT', fg: '#f4e8d0', bg: '#2a2a2a' });
  // Buildings kept for the venues that open as the district thrives: the next nearest ordinary ones.
  const nightlife = allBuildings()
    .filter((b) => !taken.has(b.id) && b.id !== squat && b.storeys >= 2 && Math.abs((b.x0 + b.x1) / 2) < 40 && Math.abs((b.z0 + b.z1) / 2) < 40)
    .map((b) => ({ b, d: Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) }))
    .sort((a, c) => a.d - c.d)
    .filter((_, i) => i % 3 === 1)
    .slice(0, NIGHTLIFE_SIGNS.length)
    .map(({ b }) => ({ b, sign: new Letting(lettingRoot, b, roofOf(b)), shown: '' }));
  // Harm reduction points the player opens in ordinary buildings: a sign each, made when first needed.
  const pointSigns = new Map<number, Letting>();
  // The park camp: tents of tarps and old canvas, nearest the district first.
  const tents = campTents(mulberry(71));
  for (const t of tents) scene.add(t);
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
  return {
    solids,
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
      // Shadow texels stay roughly square to world pixels: the frustum only grows when zoomed out.
      const half = Math.max(26, radius);
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
    vehicles: () => ambient.vehicles(),
    vehicle: (id) => ambient.vehicle(id),
    dispatch(kind, x, z, reason) {
      return ambient.dispatch(kind, x, z, reason);
    },
    shopAt(buildingId) {
      const i = specials.findIndex(({ b }) => b.id === buildingId);
      return i >= 0 ? shopKinds[i] : null;
    },
    setUnit(i, look) {
      lettings[i]?.set(look);
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
    nightlife: nightlife.map((n) => n.b.id),
    setNightlife(open, partnered) {
      nightlife.forEach((n, i) => {
        const key = i < open ? (partnered.has(i) ? 'p' : 'o') : '';
        if (n.shown === key) return;
        n.shown = key;
        const look = NIGHTLIFE_SIGNS[i];
        n.sign.set(key ? { ...look, sign: key === 'p' ? `${look.sign} ★` : look.sign } : 'trading');
      });
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
    setCamp(size) {
      const n = Math.round(size * tents.length);
      tents.forEach((t, i) => { if (t.visible !== i < n) t.visible = i < n; });
    },
    setAid(busOn, waterOn) {
      aid.bus.visible = busOn;
      aid.water.visible = waterOn;
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
      for (const l of lettings) l.update(dt, still);
      for (const l of shopSigns) l.update(dt, still);
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
      ambient.update(dt);
      for (const w of beyond.windows) w.update(dt, 0.4);
      for (const w of infill) w.update(dt, 0.45);
      updateNeon(time, neonLevel);
      for (const s of steam) s.update(dt);
      for (const b of blocks) b.update(dt);
      weather.update(dt, still);
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
      // Haze in the colour of the horizon the player sees: grey-blue by day, dusky, dark blue at night.
      (scene.fog as Fog).color.copy(HAZE_DUSK).lerp(HAZE_NIGHT, night).lerp(HAZE_DAY, day);
      setLampNight(night, day);
      setVehicleDaylight(day);
      setWindowDaylight(day);
      setPoolDaylight(day);
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
    lightPool(g, x + dir * 0.82, z, 6, 6);
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
const NIGHT = { sky: new Color(0x6a7ca0), ground: new Color(0x3a3430), hemi: 1.55, sun: new Color(0xa8bce0), sunIntensity: 1.15 };
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
