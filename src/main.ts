import { QUALITY } from './render/quality';
import { Vector3, WebGLRenderer } from 'three';
import { LANG, LANG_KEY, t } from './i18n';
import { ILLUSTRATIVE } from './config/illustrative';
import { combineEffects, decodeContext, defaultContext, encodeContext, type ContextSelection } from './config/contextFactors';
import { NATIONAL_MODELS, selectionFor } from './config/nationalModels';
import { ORG } from './config/organisation';
import { CAMPER_SPOTS, camperSpot } from './world/layout';
import { exposureNow } from './sim/exposure';
import { PARAM_BY_ID, decodeSettings, defaultSettings, encodeSettings, type ParamId, type SandboxSettings } from './config/sandboxParams';
import { Crowd, type PersonState } from './agents/crowd';
import { createIsoCamera, frameCamera, worldToClient } from './render/camera';
import { CameraRig, MIN_ZOOM, PHONE_MIN_ZOOM } from './render/cameraRig';
import { Highlight, OVERLAY_LAYER } from './render/highlight';
import { ScenePipeline } from './render/scenePipeline';
import { DynamicResolution } from './render/dynamicResolution';
import { whenViewportSettled } from './render/viewportSettle';
import { CoinPops } from './render/coinPops';
import { dayFactor, nightFactor } from './sim/clock';
import { createRandom } from './sim/random';
import { Simulation } from './sim/simulation';
import { loadPeople } from './agents/humanFigure';
import { SEASON_PROFILES } from './config/seasons';
import { LOCATION_IDS, SERVICE_IDS, serviceAt, type LocationId, type ServiceId, type ServiceStatus } from './sim/types';
import { ContextSection } from './ui/contextSection';
import { Hud, type PersonCamperOffer, type PlaceAction } from './ui/hud';
import { PORTRAIT_H, PORTRAIT_W, PortraitStudio } from './render/portraitStudio';
import { describePerson } from './ui/personInfo';
import { ActionMenu } from './ui/actionMenu';
import { HumanFigure, peopleLibrary } from './agents/humanFigure';
import { randomAppearance, type Archetype } from './agents/character';
import { displayName, rename } from './ui/names';
import { Welcome } from './ui/welcome';
import { SavePanel } from './ui/savePanel';
import { GameOver } from './ui/gameOver';
import { EventPopup } from './ui/eventPopup';
import { budgetEvent, concessionEvent, pickEvent, type EventWorld, type Spectacle } from './game/majorEvents';
import { EVENT_PLACE, type EventPlace } from './config/eventPlaces';
import { CAMP_AT, EventFx, PARTY_AT } from './world/eventFx';
import { FxTags } from './ui/fxTags';
import type { InstitutionId } from './config/institutionQuests';
import { HostileMarks } from './world/hostileMarks';
import { RESUME_KEY, watchForUpdates } from './game/updates';
import { UpdateBar } from './ui/updateBar';
import { SERVICE_NAMES } from './sim/organisation';
import { loadKits } from './world/kits';
import { QueueBox } from './ui/queueBox';
import { startPresence } from './game/presence';
import { applySave, captureSave, parseSave, unpackSave, type SaveData } from './game/saveGame';
import { LiveGame, fetchGame, linkedGame, newGameAddress } from './game/liveGame';
import { GUIDE_AGAIN_MINUTES, needGuide } from './game/needGuides';
import { METER_ORDER, meterState } from './ui/needIcons';
import type { Need } from './config/needs';
import { currentRun, ensureRun, setRun, submitScore, topRuns } from './game/leaderboard';
import { LOCATION_NAMES } from './config/places';
import { PROPERTY, type SatelliteService } from './sim/property';
import { price } from './ui/money';
import { Interaction } from './ui/interaction';
import { EventFeed, HINT_ROW, hintInputId, markHintedRows } from './ui/eventFeed';
import { OrgPanel } from './ui/orgPanel';
import { Sheet } from './ui/sheet';
import { FACTOR_BY_ID } from './config/contextFactors';
import type { PolicyInfo } from './sim/simulation';
import { EVENTS, type EventId } from './config/randomEvents';
import { SandboxPanel } from './ui/sandboxPanel';
import { buildSnapshot } from './ui/snapshot';
import { aboutSection, applyShuffle, homeScreenNote, languageSection, randomSection } from './ui/sandboxTopics';
import { CityCards, PropertyView, SHOPS_FOR } from './game/cityState';
import { SelectionMarker } from './ui/selection';
import { ContextProps } from './world/contextProps';
import { DISTRICT } from './world/layout';
import { buildWorld, configureRenderer } from './world/scene';
import { setPuddleView } from './world/puddles';
import { NeighbourhoodProps } from './world/neighbourhoodProps';
import { CityProps } from './world/cityProps';
import { SeasonProps, snowyNight } from './world/seasonProps';
import { POPULATIONS, presence } from './config/populations';

document.documentElement.lang = LANG;
const canvas = document.getElementById('scene') as HTMLCanvasElement;
canvas.setAttribute('aria-label', t('Isometric neighbourhood with a drop-in centre, an outreach camper and a music club. Select a location for details.'));
const hudRoot = document.getElementById('hud') as HTMLElement;
// Portrait of the selection, bottom left: a framed live close-up with a caption.
const portraitBox = document.createElement('figure');
portraitBox.className = 'portrait';
portraitBox.hidden = true;
const portraitView = document.createElement('canvas');
portraitView.className = 'portrait-view';
portraitView.width = PORTRAIT_W;
portraitView.height = PORTRAIT_H;
const portraitCaption = document.createElement('figcaption');
portraitBox.append(portraitView, portraitCaption);
portraitBox.setAttribute('aria-hidden', 'true');
hudRoot.append(portraitBox);

// Version counter in the corner: small, quiet, never in the way of input.
const versionTag = document.createElement('p');
versionTag.className = 'version';
versionTag.textContent = `v${__APP_VERSION__}`;
hudRoot.append(versionTag);
const loading = document.getElementById('loading');

const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
configureRenderer(renderer);
const pipeline = new ScenePipeline(renderer);
const world = buildWorld(createRandom(ILLUSTRATIVE.seed));
const camera = createIsoCamera();
camera.layers.enable(OVERLAY_LAYER);
const sim = new Simulation(ILLUSTRATIVE.seed);
// People's assets (about 0.6 MB) load before the crowd is built (the loading screen stays up);
// if they are slow or missing the crowd uses the simple figures instead. Slow connections and
// weak phones skip them: the simple figures need no download and fewer bones each frame.
if (!QUALITY.slowNet && !QUALITY.low) await Promise.race([loadPeople(), new Promise((resolve) => setTimeout(resolve, 8000))]);
const crowd = new Crowd(sim, world, ILLUSTRATIVE.seed + 1);
crowd.setCamera(camera);
const marker = new SelectionMarker();
world.scene.add(marker.group);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
// Reduced motion: what people carry stays still (no steam, swing or drifting sigh).
crowd.setStill(reducedMotion.matches);
reducedMotion.addEventListener('change', () => crowd.setStill(reducedMotion.matches));
const hazeDir = new Vector3();
const hazePoint = new Vector3();
const rig = new CameraRig(world.frame.full.getCenter(new Vector3()), DISTRICT - 4);
// Phones (narrow, or short in landscape) see less at once: zoomed out no further than about the
// inner blocks, so the screen never fills with a tiny far city. (Closer haze was tried: in portrait
// the top of the screen is the far distance, and it fogged a tall band.)
const phone = window.matchMedia('(max-width: 760px), (max-height: 500px)');
const fitPhone = () => rig.setMinZoom(phone.matches ? PHONE_MIN_ZOOM : MIN_ZOOM);
fitPhone();
phone.addEventListener('change', () => { fitPhone(); rig.invalidate(); });
const highlight = new Highlight();
const props = new ContextProps(world.scene, world.camper, () => reducedMotion.matches);
const street = new NeighbourhoodProps(world.scene);
const cityProps = new CityProps(world.scene, () => reducedMotion.matches);
const seasonProps = new SeasonProps(world.scene, () => reducedMotion.matches);
function syncStreet(): void {
  street.set({ shopsShut: sim.events.isActive('shopClosesEarly'), litter: sim.neighbourhood.state.litter });
  cityProps.set({ party: sim.party, bikes: sim.city.bikes, graffiti: sim.city.graffiti });
  seasonProps.set(sim.calendar.date);
}
// Coins over each place where money moves: gold where it comes in, red where visits cost it.
const coins = new CoinPops(world.scene);
// The big events played out on the street: raves, raids, the camp cleared, a bad batch, the press.
const fx = new EventFx(world.scene, () => reducedMotion.matches);
const fxTags = new FxTags(hudRoot);
// What works against the selected place or person, ringed in red with a tag: a TV crew, a raid, police nearby.
const marks = new HostileMarks(world.scene, () => reducedMotion.matches);
const threatTags = new FxTags(hudRoot);
type Threat = { kind: 'threatPress' | 'threatRaid' | 'threatOfficer' | 'threatCar'; x: number; y: number; z: number; r: number };
let threats: Threat[] = [];
/**
 * Tonight's events that belong to the selection: at a place, those that play out there (or at the
 * busiest place, when it is this one) and those whose tips name its service; for a person, those
 * that affect what they use. Nothing selected (or a building, a car): all of them.
 */
function eventMatch(): ((id: EventId) => boolean) | null {
  const sel = interaction.selected;
  if (sel?.kind === 'location') {
    const service = serviceAt(sel.id);
    const busiest = sim.busiest.service;
    return (id) => {
      const at = EVENT_PLACE[id];
      return at === sel.id || (at === 'busiest' && busiest === service) || EVENTS[id].hints.some((h) => 'param' in h && h.param.startsWith(`${service}.`));
    };
  }
  if (sel?.kind === 'person') {
    const use = crowd.person(sel.id)?.substance;
    return (id) => !!use && EVENTS[id].affects.includes(use);
  }
  return null;
}

/** Finds the threats near the selection (refreshed with the HUD, a few times a second). */
function updateThreats(): void {
  const sel = interaction.selected;
  let c: { x: number; z: number } | null = null;
  if (sel?.kind === 'location') c = world.locations[sel.id].footprint;
  else if (sel?.kind === 'person') { const p = crowd.person(sel.id); if (p) c = { x: p.root.position.x, z: p.root.position.z }; }
  const list: Threat[] = [];
  if (c) {
    const near = (x: number, z: number) => Math.hypot(x - c!.x, z - c!.z) <= 26;
    for (const a of fx.active()) if ((a.kind === 'press' || a.kind === 'raid') && near(a.x, a.z)) list.push({ kind: a.kind === 'press' ? 'threatPress' : 'threatRaid', x: a.x, y: 0.6, z: a.z, r: a.kind === 'raid' ? 7 : 4 });
    for (const o of crowd.officerSpots()) if (near(o.x, o.z)) list.push({ kind: 'threatOfficer', x: o.x, y: 2.2, z: o.z, r: 1.4 });
    for (const v of world.vehicles()) {
      const p = v.root.position;
      if (world.vehicle(v.id)?.kind === 'police' && near(p.x, p.z)) list.push({ kind: 'threatCar', x: p.x, y: 2.4, z: p.z, r: 3 });
    }
  }
  threats = list;
  marks.set(list);
  placeThreatTags();
}
/** One tag per kind of threat (the nearest stands for the rest): rings mark them all. */
function placeThreatTags(): void {
  const seen = new Set<string>();
  const one = threats.filter((t) => !seen.has(t.kind) && seen.add(t.kind));
  threatTags.set(one.map((t) => ({ kind: t.kind, theme: null, ...worldToClient(new Vector3(t.x, t.y, t.z), camera, pipeline.frame) })));
}
let fxVersion = -1;
/** Name tags over the events on screen: placed when the view moves or an event starts or ends. */
function placeFxTags(): void {
  const on = fx.active();
  fxVersion = fx.version;
  fxTags.set(on.map((a) => ({ kind: a.kind, theme: a.theme, ...worldToClient(new Vector3(a.x, a.y, a.z), camera, pipeline.frame) })));
}
const anchorOf = (service: ServiceId) => world.locations[service === 'clubHr' ? 'club' : service].labelAnchor;
const footprintOf = (service: ServiceId) => world.locations[service === 'clubHr' ? 'club' : service].footprint;
/** Services whose places stand within `r` metres of `at`'s place (itself included). */
function servicesNear(at: ServiceId, r: number): ServiceId[] {
  const c = footprintOf(at);
  return SERVICE_IDS.filter((id) => { const f = footprintOf(id); return Math.hypot(f.x - c.x, f.z - c.z) <= r; });
}
/** Where an event plays out, on the ground. */
function placePoint(place: EventPlace): Vector3 {
  if (place === 'park') return new Vector3(PARTY_AT.x, 0, PARTY_AT.z);
  if (place === 'camp') return new Vector3(CAMP_AT.x, 0, CAMP_AT.z);
  const a = place === 'busiest' ? anchorOf(sim.busiest.service) : world.locations[place].labelAnchor;
  return new Vector3(a.x, 0, a.z);
}
/** Brings where an event happens into view, without locking the camera on it. */
function focusPlace(place: EventPlace | undefined): void {
  if (!place) return;
  rig.lookAt(placePoint(place));
  dirty = true;
}
function showSpectacle(s: Spectacle): void {
  const now = sim.org.now;
  switch (s.kind) {
    case 'rave': fx.setRave(s.theme); focusPlace('park'); break;
    case 'raid': fx.setRaid(footprintOf(s.at), now + s.hours * 60); sim.deterNear(servicesNear(s.at, 22), 0.5, s.hours * 60); break;
    case 'sweep': fx.setSweep(now + s.hours * 60); focusPlace('camp'); break;
    case 'alert': fx.setAlert(footprintOf(s.at), now + s.hours * 60); break;
    case 'press': fx.setPress(footprintOf(s.at), now + s.hours * 60); sim.deterNear(servicesNear(s.at, 22), 0.35, s.hours * 60); break;
    case 'coins': if (!reducedMotion.matches) for (let i = 0; i < s.count; i++) coins.pop(anchorOf(s.at), true); break;
    case 'patrol':
      for (const id of ['dropIn', 'outreach', 'drugChecking'] as const) eventWorld.dispatchTo('police', id, t('Posted near the services by the new government.'));
      break;
  }
  dirty = true;
}
// What happens to people shows where it happens: a skull, handcuffs, a red cross (none with reduced motion).
crowd.onMark = (at, icon) => { if (!reducedMotion.matches) coins.mark(at, icon); };
// City cars stop for people crossing in front of them.
world.setTrafficYield((x, z, dx, dz) => crowd.someoneAhead(x, z, dx, dz));
sim.on((e) => {
  if (e.type === 'money' && !reducedMotion.matches) coins.pop(world.locations[e.service === 'clubHr' ? 'club' : e.service].labelAnchor, e.amount > 0);

  if (e.type === 'alert') props.flashAlert(e.word);
  if (e.type === 'city' && e.happening.kind === 'crime' && e.happening.crime === 'carBreakIn') cityProps.carAlarm(sim.city.incidents.carBreakIn);
  // A grant that unlocks a context option (a licence, stable funding) changes the selection like a slider would.
  if (e.type === 'orgNotice' && e.notice.unlock) {
    const { factor, option } = e.notice.unlock;
    const index = FACTOR_BY_ID[factor].options.findIndex((o) => o.id === option);
    if (index >= 0) setContext({ ...contextSelection, [factor]: index }, null);
  }
  if (e.type === 'orgNotice') syncContextProps();
  if (e.type === 'eventStarted' || e.type === 'eventEnded') {
    syncContextProps();
    eventsDirty = true;
  }
});
// Event feed and slider hints are rebuilt at most once per frame, after the step that changed them.
let eventsDirty = true;

/** World props follow the simulation's combined context. */
function syncContextProps(): void {
  syncShops();
  const c = sim.context;
  props.set({
    checkingSites: c.checkingAllowed ? c.checkingSites : [],
    collectionPoint: c.collectionPoint && c.checkingAllowed,
    publicAlerts: c.publicAlerts,
    policeCar: c.patrolStyle === 'posted' && c.patrol > 0,
    // A closed-down camper leaves the street like one without a permit.
    camperPermitted: c.outreachPermitted && !sim.org.closedDown.has('outreach'),
  });
}

let paused = false;
let speed = 1;
let dirty = true;

const hud = new Hud(hudRoot, {
  onTogglePause: () => setPaused(!paused),
  onSpeed: (s) => {
    speed = s;
    hud.setSpeed(s);
    if (paused) setPaused(false);
  },
  onService: (id, on) => {
    sim.setEnabled(id, on);
    refreshHud();
  },
  onSelect: (id) => interaction.selectLocation(id),
  onResetView: () => interaction.resetView(),
  onToggleFocus: () => interaction.toggleFocus(),
  onAction: (service, action) => queuePlaceAction(service, action),
  onBuildingAction: (action) => queueBuildingAction(action),
  onTitle: () => sandbox.setOpen(true),
  onMoney: () => openOrg(),
  onPersonCamper: () => queueOrg(() => sendCamperToSelected()),
  onMix: (service, activity, weight) => queueOrg(() => { sim.setMix(service, activity, weight); refreshHud(); }),
  onMixSetUp: (service, activity) => queueOrg(() => { sim.setUpMix(service, activity); refreshHud(); }),
  onDrive: () => queueOrg(() => { sim.startDonationDrive(); refreshHud(); }),
  onSettings: () => sandbox.setOpen(true),
  onCamperPath: (path) => { if (sim.setCamperPath(path)) { refreshOrg(); refreshHud(); } },
  onFavour: (id) => queueOrg(() => { sim.askFavour(id); syncContextProps(); refreshHud(); }),
  onAid: (kind) => queueOrg(() => {
    if (kind === 'cold') sim.warmingBus = !sim.warmingBus;
    else sim.coolingPoint = !sim.coolingPoint;
    sim.org.notice(sim.clockMinutes, kind === 'cold'
      ? (sim.warmingBus ? t('The warming bus is out on cold nights: a warm seat, hot drinks and a check on people sleeping rough.') : t('The warming bus is off the road.'))
      : (sim.coolingPoint ? t('A water and shade point is up for hot days: water, shade and a check on people outdoors.') : t('The water and shade point is packed away.')));
    refreshHud();
  }),
  onHelp: () => welcome.show(),
  onRename: (name) => {
    const sel = interaction.selected;
    if (sel?.kind === 'location') rename('location', sel.id, name);
    else if (sel?.kind === 'building') rename('building', sel.id, name);
    else if (sel?.kind === 'person') rename('person', sel.id, name);
    else return;
    refreshHud();
    interaction.refresh();
  },
});
// People out in the city beyond the district get sculpted figures when the camera is close.
{
  const lib = peopleLibrary();
  const r = createRandom(97);
  const styles: Archetype[] = ['everyday', 'everyday', 'student', 'office', 'worker', 'older', 'tourist', 'raver', 'punk', 'hiphop'];
  if (lib) world.setFigureFactory((kind) => {
    const look = randomAppearance(r, false, kind === 'seller' ? 'technoBlack' : kind === 'police' ? 'everyday' : styles[Math.floor(r() * styles.length)], sim.season);
    if (kind === 'police') return new HumanFigure(lib, { ...look, police: true, kit: {} });
    if (kind === 'seller') return new HumanFigure(lib, { ...look, kit: { ...look.kit, hood: 'up' } });
    return new HumanFigure(lib, look);
  });
}
const actionMenu = new ActionMenu(hudRoot);
// The welcome box pauses the city while it is open, and leaves a pause the player chose alone.
let pausedBeforeWelcome = false;
const welcome = new Welcome(document.body, (open) => {
  if (open) { pausedBeforeWelcome = paused; setPaused(true); }
  else if (!pausedBeforeWelcome) setPaused(false);
});
const interaction = new Interaction({
  canvas,
  overlay: hudRoot,
  camera,
  frame: () => pipeline.frame,
  world,
  crowd,
  rig,
  hud,
  highlight,
  marker,
  reducedMotion,
  buildingCard: (id) => cards.describeBuilding(id),
  personCamper: (p) => personCamperOffer(p),
  vehicleCard: (id) => cards.describeVehicle(id),
  openMenu: (x, y) => {
    // Let the column catch up with the new selection first, so the menu lists its actions.
    refreshHud();
    const { title, items } = hud.menuEntries();
    actionMenu.show(x, y, title, items);
  },
});

// Ordinary buildings' and emergency vehicles' cards, and what the city shows of the property.
const cards = new CityCards(sim, world);
const property = new PropertyView(sim, world, crowd);
function syncProperty(): void {
  property.sync();
}

function syncShops(): void {
  const f = FACTOR_BY_ID.cannabisMarket;
  world.setShops(SHOPS_FOR[f.options[contextSelection.cannabisMarket]?.id ?? 'medical'] ?? []);
}

/** The first camper drives to another free kerb spot; outreach closes while it moves. */
function moveCamperTo(spot: number): void {
  if (spot === camperSpot() || sim.property.campers.includes(spot) || sim.outreachMoving) return;
  sim.moveOutreach();
  world.moveCamper(spot);
  sim.org.notice(sim.clockMinutes, t('The outreach camper is on its way to a new spot: {spot}.', { spot: CAMPER_SPOTS[spot].name.toLowerCase() }));
  property.sync();
  refreshHud();
}

/**
 * Sending a camper to someone a camper could help (sleeping out, or using): to the free kerb spot
 * nearest them. The outreach camper goes if it is free (outreach closes while it drives); if it
 * is busy, a new one, if the money allows.
 */
function camperSpotNear(x: number, z: number): number | null {
  let best: number | null = null;
  let d = Infinity;
  CAMPER_SPOTS.forEach((s, i) => {
    if (i === camperSpot() || sim.property.campers.includes(i)) return;
    const e = Math.hypot(s.x - x, s.z - z);
    if (e < d) { d = e; best = i; }
  });
  return best;
}

function personCamperOffer(p: PersonState): PersonCamperOffer | null {
  if (p.role !== 'sleeper' && !describePerson(p).profile) return null;
  const spot = camperSpotNear(p.root.position.x, p.root.position.z);
  const near = spot === null ? '' : CAMPER_SPOTS[spot].name.toLowerCase();
  if (spot !== null && !sim.outreachMoving && sim.services.outreach.switchedOn) {
    return { label: t('Send the camper near them'), hint: t('The outreach camper drives to {spot}; outreach closes while it moves.', { spot: near }), enabled: true };
  }
  // Outreach switched off: no camper goes anywhere until it is on again.
  if (!sim.services.outreach.switchedOn) return { label: t('Send the camper near them'), hint: t('Switch the service on to use this.'), enabled: false };
  const canBuy = spot !== null && sim.property.extraCampers < PROPERTY.maxExtraCampers;
  return {
    label: t('Send another camper near them ({price})', { price: price(PROPERTY.camperCost) }),
    hint: canBuy ? t('A new camper parks at {spot}: {price}, then {perHour} an hour.', { spot: near, price: price(PROPERTY.camperCost), perHour: price(PROPERTY.camperPerHour) }) : t('Every camper is out.'),
    enabled: canBuy && sim.org.budget >= PROPERTY.camperCost,
  };
}

function sendCamperToSelected(): void {
  const sel = interaction.selected;
  const p = sel?.kind === 'person' ? crowd.person(sel.id) : undefined;
  if (!p) return;
  const spot = camperSpotNear(p.root.position.x, p.root.position.z);
  if (spot === null) return;
  if (!sim.outreachMoving && sim.services.outreach.switchedOn) moveCamperTo(spot);
  else if (sim.sendCamper(spot)) syncProperty();
  refreshHud();
}

function queueBuildingAction(action: string): void {
  const sel = interaction.selected;
  if (sel?.kind !== 'building') return;
  const building = sel.id;
  queueOrg(() => {
    const unit = cards.unitOf(building);
    if (action.startsWith('point:')) sim.openPoint(building, action.slice(6) as SatelliteService);
    else if (action === 'pointUp') sim.upgradePoint(building);
    else if (action === 'pointClose') sim.closePoint(building);
    else if (action === 'sweep') sim.sweepForKit();
    else if (action === 'meet') sim.meetResidents();
    else if (action === 'partner') sim.partnerVenue(world.nightlife.indexOf(building));
    else if (action.startsWith('quest:')) {
      const id = action.slice(6) as InstitutionId;
      const step = sim.questStep(id);
      // Allies change how the city works with you: police by agreement, a council that backs the services.
      if (step?.finished && id === 'police') eventWorld.setFactor('policing', 'agreement');
      if (step?.finished && id === 'cityHall') eventWorld.setFactor('council', 'supportive');
      refreshOrg();
    }
    else if (unit >= 0 && action === 'release') sim.releaseUnit(unit);
    else if (unit >= 0 && action.startsWith('rent:')) sim.rentUnit(unit, action.slice(5) as SatelliteService);
    property.sync();
    refreshHud();
  });
}

function setPaused(p: boolean): void {
  paused = p;
  hud.setPaused(p);
}

// Service state drives each location's visuals: staffed = lit and unfolded.
const LEVEL: Record<ServiceStatus, number> = { open: 1, closing: 0.45, opening: 0.12, closed: 0 };
let stagesShown = false;
function syncServiceVisuals(): void {
  for (const id of LOCATION_IDS) {
    const s = sim.services[serviceAt(id)];
    world.locations[id].setServiceLevel(LEVEL[s.status]);
    // Grow with staff above the usual number, shrink below it (closed counts as short).
    const usual = ILLUSTRATIVE.services[s.id].staff;
    const onSite = s.status === 'closed' ? 0 : s.staffOnSite;
    world.setStaffing(id, onSite - usual, usual - onSite, s.status === 'open');
    // Stages show as pieces beside the place; the first sync (and a load) places them without animation.
    world.setStage(s.id, sim.upgrades[s.id].level, !stagesShown);
  }
  stagesShown = true;
}

function refreshHud(): void {
  checkGameOver();
  checkBigEvent();
  world.setParkLife(sim.neighbourhood.state.streetMarket, sim.context.patrol);
  // The warming bus and the water point are out only in the hours they work.
  const exposure = exposureNow(sim.season, sim.clockMinutes, sim.events.isActive('coldNight'));
  world.setAid(sim.warmingBus && exposure === 'cold', sim.coolingPoint && exposure === 'heat');
  world.setCamp(sim.camp.size, sim.camp.station);
  world.setParkActivities(sim.park.now);
  world.setNightlife(sim.vitality.venues, sim.vitality.partners);
  syncProperty();
  hud.update(buildSnapshot(sim, crowd.population));
  hud.setWorks(world.works().map((w) => ({ name: displayName('location', w.id, LOCATION_NAMES[w.id]), progress: w.progress, building: w.building })));
  const sel = interaction.selected;
  if (sel?.kind === 'building') hud.showBuilding(cards.describeBuilding(sel.id));
  interaction.refresh();
  updateThreats();
  feed.setFilter(eventMatch());
  sandbox.syncLive('clock', sim.clockMinutes);
  feed.refresh(sim.clockMinutes);
  syncStreet();
  sandbox.syncLive('orgBudget', sim.org.budget);
  refreshOrg();
  context.syncStats({
    turnedBack: SERVICE_IDS.reduce((n, id) => n + sim.services[id].turnedBack, 0),
    policeStops: sim.policeStops,
    arrests: sim.arrests,
    hiddenUse: sim.hiddenUse,
    intoxicatedLeavers: sim.intoxicatedLeavers,
    ...sim.health,
    street: sim.neighbourhood.state,
    city: { incidents: sim.city.incidents, responded: sim.city.responded },
    outNow: outNow(),
    checkingAllowed: sim.context.checkingAllowed,
    ...sim.checking,
  });
}

// Sandbox settings. Slider input only records the latest value per setting;
// the frame loop hands them to the simulation once, between fixed steps, so
// rapid input never races a step and never triggers more than one apply per frame.
const settings: SandboxSettings = defaultSettings();
let pending: Partial<SandboxSettings> | null = null;
const sandbox = new SandboxPanel(hudRoot, settings, {
  onChange: (id, value) => queueSetting(id, value),
  onReset: () => {
    const defaults = defaultSettings();
    sandbox.setAll(defaults);
    for (const id of Object.keys(defaults) as ParamId[]) queueSetting(id, defaults[id]);
    setContext(defaultContext(), null);
  },
  // One panel at a time in the settings' place.
  onOpen: () => orgSheet.setOpen(false),
});

// Context factors (national law down to service design) follow the same path:
// input records the selection, the next frame applies the combined effects.
let contextSelection: ContextSelection = defaultContext();
let modelId: string | null = null;
let contextPending = false;
const context = new ContextSection(contextSelection, NATIONAL_MODELS, {
  onFactor: (id, index) => {
    contextSelection = { ...contextSelection, [id]: index };
    modelId = null;
    queueContext();
  },
  onModel: (id) => {
    const model = NATIONAL_MODELS.find((m) => m.id === id);
    setContext(model ? selectionFor(model) : contextSelection, model ? model.id : null);
  },
});
sandbox.mount(context.root);

/** The three biggest populations on the street right now, as shares. */
function outNow(): string {
  const d = sim.calendar.date;
  const w = POPULATIONS.map((p) => ({ label: p.label.toLowerCase(), v: presence(p, sim.clockMinutes, d) }));
  const total = w.reduce((n, x) => n + x.v, 0) || 1;
  return w.sort((a, b) => b.v - a.v).slice(0, 3).filter((x) => x.v > 0).map((x) => `${x.label} ${Math.round((x.v / total) * 100)}%`).join(', ');
}

/** What the simulation needs from the selection beyond combined effects. */
function policyFor(selection: ContextSelection): PolicyInfo {
  const optionId = (id: keyof ContextSelection) => FACTOR_BY_ID[id].options[selection[id]].id;
  return {
    council: selection.council,
    policeAgreement: optionId('policing') === 'agreement',
    criminalPossession: optionId('law') === 'criminal' || optionId('law') === 'discretionary',
    funding: optionId('funding'),
    neighbourhood: selection.neighbourhood,
    anonymous: optionId('anonymity') === 'anonymous',
  };
}

function setContext(selection: ContextSelection, model: string | null): void {
  contextSelection = selection;
  modelId = model;
  context.setAll(selection, model);
  queueContext();
}

function queueContext(): void {
  contextPending = true;
  dirty = true;
}

// Random events: manual triggers wait for the next frame like slider input.
const pendingTriggers: EventId[] = [];
const feed = new EventFeed(hud.eventsSlot, {
  onTrigger: (id) => {
    pendingTriggers.push(id);
    dirty = true;
  },
  onFocus: (id) => focusPlace(EVENT_PLACE[id]),
  onHint: (hint) => {
    const input = document.getElementById(hintInputId(hint));
    const row = input?.closest(HINT_ROW) as HTMLElement | null;
    if (!input || !row) return;
    // Open the panel and topic that hold it, so it is on screen before scrolling to it.
    if (org.section.contains(input)) {
      orgSheet.setOpen(true);
      input.closest('details')?.setAttribute('open', '');
    } else {
      sandbox.setOpen(true);
      sandbox.reveal(input);
    }
    input.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    input.focus({ preventScroll: true });
    row.classList.remove('hint-flash');
    void row.offsetWidth;
    row.classList.add('hint-flash');
    window.setTimeout(() => row.classList.remove('hint-flash'), 1600);
  },
});

// Organisation: actions queue like triggers and apply between simulation steps.
const pendingOrg: (() => void)[] = [];
const queueOrg = (action: () => void) => {
  pendingOrg.push(action);
  dirty = true;
};
const org = new OrgPanel({
  onRecruit: (id) => queueOrg(() => sim.recruit(id)),
  onLetGo: () => queueOrg(() => sim.letGo()),
  onApply: (id) => queueOrg(() => sim.applyFor(id)),
  onReopen: (id) => queueOrg(() => { sim.reopen(id); syncContextProps(); }),
  onAssign: (member, to) => queueOrg(() => sim.assignMember(member, to)),
  onOpen: () => openOrg(),
});
// The organisation has its own sheet, opened from the money in the top bar or the organisation bar.
const orgSheet = new Sheet(hudRoot, org.section, { label: t('Organisation'), onOpen: () => sandbox.setOpen(false) });
function openOrg(): void {
  orgSheet.setOpen(true);
}

// Saves, shared links and the leaderboard.
const SAVE_KEY = 'hrp-save';
const orgName = () => displayName('org', 'name', t('Your organisation'));
const savePanel = new SavePanel({
  saveHere: () => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(captureSave(sim, orgName(), currentRun()))); } catch { /* storage blocked */ }
  },
  hasSaved: () => {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  },
  loadHere: () => {
    let save: SaveData | null = null;
    try { save = parseSave(JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null')); } catch { /* unreadable: nothing to load */ }
    if (!save) return;
    const s = save;
    // Your own save carries your run on.
    queueOrg(() => { applySave(sim, s); setRun(s.run); afterLoad(); });
  },
  submit: async () => {
    const run = await ensureRun();
    const rank = await submitScore(run, orgName(), sim.totals.helped, sim.totals.nights);
    return t('Sent. {name} is number {rank}.', { name: orgName(), rank });
  },
  score: () => ({ name: orgName(), helped: sim.totals.helped, nights: sim.totals.nights }),
  top: (signal) => topRuns(signal),
});
sandbox.mount(savePanel.section);
// Randomize (a new season, or a new city) and About, in the sandbox menu.
const setDateClock = (v: { date: number; clock: number }) => {
  settings.date = v.date;
  settings.clock = v.clock;
  queueSetting('date', v.date);
  queueSetting('clock', v.clock);
  sandbox.setAll(settings);
};
sandbox.addAction(t('How it works'), () => welcome.show());
sandbox.mount(randomSection(setDateClock));
const homeNote = homeScreenNote();
if (homeNote) sandbox.mount(homeNote);
sandbox.mount(languageSection((lang) => {
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* storage blocked: the address bar carries it */ }
  const query = new URLSearchParams(location.search);
  query.set('lang', lang);
  history.replaceState(history.state, '', `${location.pathname}?${query}${location.hash}`);
  reloadKeepingGame();
}));
sandbox.mount(aboutSection(__APP_VERSION__));

/** The run ends when the money is gone: the city pauses and the run's numbers are shown. */
const gameOver = new GameOver(document.body, {
  submit: async () => {
    const run = await ensureRun();
    const rank = await submitScore(run, orgName(), sim.totals.helped, sim.totals.nights);
    return t('Sent. {name} is number {rank}.', { name: orgName(), rank });
  },
  // A new page is a new game; settings in the address stay, a shared save does not.
  restart: () => { location.href = newGameAddress(); },
});
// Big events: every 10 to 25 game hours one may stop the clock and ask for a decision.
const eventRandom = createRandom((Math.random() * 0x7fffffff) | 0);
// The first decision comes early (2 to 4 hours in); after that every 10 to 25 hours.
let nextBigEvent = 2 * 60 + eventRandom() * 2 * 60;
let nextBudgetWarning = 0;
let pausedBeforeEvent = false;
const eventPopup = new EventPopup(document.body, (open) => {
  if (open) { pausedBeforeEvent = paused; setPaused(true); }
  else { if (!pausedBeforeEvent) setPaused(false); refreshOrg(); refreshHud(); }
});
const eventWorld: EventWorld = {
  sim,
  random: eventRandom,
  dispatchTo: (kind, service, reason) => {
    const at = world.locations[service === 'clubHr' ? 'club' : service].labelAnchor;
    world.dispatch(kind, at.x + (eventRandom() - 0.5) * 8, at.z + (eventRandom() - 0.5) * 8, reason);
  },
  show: (s) => showSpectacle(s),
  factor: (id) => FACTOR_BY_ID[id as keyof typeof FACTOR_BY_ID]?.options[contextSelection[id as keyof ContextSelection]]?.id ?? '',
  setFactor: (id, option) => {
    const f = FACTOR_BY_ID[id as keyof typeof FACTOR_BY_ID];
    const index = f?.options.findIndex((o) => o.id === option) ?? -1;
    if (index >= 0) setContext({ ...contextSelection, [id]: index }, null);
  },
};
/** When each meter's guide last showed (org minutes). */
const guidedAt: Partial<Record<Need, number>> = {};
function checkBigEvent(): void {
  if (eventPopup.open || gameOver.open) return;
  // City hall's concession comes as soon as it is due.
  if (sim.concessionDue) {
    const ids = ['postedOfficer', 'cleanUp', 'camperOff'] as const;
    const event = concessionEvent(ids[Math.floor(eventRandom() * ids.length)]);
    focusPlace(event.place);
    event.opening?.(eventWorld);
    eventPopup.show(event, sim.org.budget, (choice) => choice.apply(eventWorld));
    return;
  }
  // A city meter gone red: a guide to what eases it, the first time and then at most once a game day.
  for (const need of METER_ORDER) {
    const v = need === 'district' ? sim.vitality.level : sim.cityStress[need];
    if (meterState(need, v) !== 'high' || sim.org.now < (guidedAt[need] ?? -Infinity) + GUIDE_AGAIN_MINUTES) continue;
    guidedAt[need] = sim.org.now;
    const guide = needGuide(need, sim.busiest.service, (id) => interaction.selectLocation(id));
    focusPlace(guide.place);
    eventPopup.show(guide, sim.org.budget, (choice) => choice.apply(eventWorld));
    return;
  }
  // Money running out: a pause with suggestions, at most every 8 clock hours.
  if (sim.org.budget < 150 && sim.org.netPerHour < 0 && !sim.org.broke && sim.org.now >= nextBudgetWarning) {
    nextBudgetWarning = sim.org.now + 8 * 60;
    eventPopup.show(budgetEvent(eventWorld, (id) => SERVICE_NAMES[id]), sim.org.budget, (choice) => choice.apply(eventWorld));
    return;
  }
  if (sim.org.now < nextBigEvent) return;
  nextBigEvent = sim.org.now + 10 * 60 + eventRandom() * 15 * 60;
  const event = pickEvent(eventWorld);
  if (event) { focusPlace(event.place); event.opening?.(eventWorld); }
  if (event) eventPopup.show(event, sim.org.budget, (choice) => choice.apply(eventWorld));
}

function checkGameOver(): void {
  // Out of money is a warning first: services close one by one, and the run ends after the last.
  if (gameOver.open || sim.org.brokeMinutes < ORG.gameOverAfter) return;
  setPaused(true);
  gameOver.show(orgName(), sim.totals.nights, sim.totals.helped);
}

/** After any load: the world, the panels and the crowd's destinations follow the new state. */
function afterLoad(): void {
  syncProperty();
  // A loaded game's stages appear in place, not growing one by one.
  stagesShown = false;
  syncServiceVisuals();
  refreshOrg();
  refreshHud();
}

/** Saves the game to its address while it is played; set up once the start has decided which game this is. */
let live: LiveGame | null = null;
/** How often (real seconds) the game saves to its address, when anything changed. */
const LIVE_SAVE_SECONDS = 20;

/**
 * The address names the game (`?g=`). This browser's own game carries on, run
 * and all; someone else's opens as their city with your fresh leaderboard run,
 * saved under a new address of your own. No `g`: a new game and a new run.
 * An old-style link with '#g=' opens a city the same way as someone else's.
 */
async function startGame(): Promise<void> {
  const gid = linkedGame();
  const own = gid !== null && LiveGame.owns(gid);
  if (!own) setRun(undefined);
  // Back from an update reload: the same run, as it was a moment ago.
  let resume: SaveData | null = null;
  try {
    resume = parseSave(JSON.parse(sessionStorage.getItem(RESUME_KEY) ?? 'null'));
    sessionStorage.removeItem(RESUME_KEY);
  } catch { /* storage blocked or unreadable: a fresh start */ }
  if (resume) {
    const s = resume;
    setRun(s.run);
    queueOrg(() => {
      applySave(sim, s);
      sim.org.notice(sim.clockMinutes, t('Updated to the new version. Your game carries on where it was.'));
      afterLoad();
    });
  }
  // The address's game, as it was last saved (an update reload already has a newer state).
  const linked = !resume && gid ? await fetchGame(gid) : null;
  // Our game did not load: this is a fresh start, so a fresh leaderboard run too.
  if (own && !linked && !resume) setRun(undefined);
  if (linked) {
    queueOrg(() => {
      applySave(sim, linked);
      if (own) sim.org.notice(sim.clockMinutes, t('Your game carries on where you left it.'));
      else {
        sim.totals.helped = 0;
        sim.totals.nights = 0;
        sim.org.notice(sim.clockMinutes, linked.name ? t('Opened a shared city from {name}. Your own leaderboard run starts now.', { name: linked.name }) : t('Opened a shared city. Your own leaderboard run starts now.'));
      }
      afterLoad();
    });
  }
  // The leaderboard ticket stays in this browser: a save anyone can open never carries it.
  // Carry on writing to our own game only when it loaded (or an update reload resumed it): a
  // fresh start must never overwrite it, so a game that did not load gets a new address.
  live = new LiveGame(own && (linked || resume) ? gid : null, () => captureSave(sim, orgName()));
  window.setInterval(() => live?.save(), LIVE_SAVE_SECONDS * 1000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) live?.flush(); });
  window.addEventListener('pagehide', () => live?.flush());
  const code = location.hash.startsWith('#g=') ? location.hash.slice(3) : '';
  // A fresh game: say where it starts and how it grows.
  if (!resume && !linked && !code) {
    queueOrg(() => sim.org.notice(sim.clockMinutes, t('You start with three services: the drop-in, the outreach camper and the club stand. Open more under Services once the money comes in steadily.')));
  }
  if (code) {
    const save = await unpackSave(code);
    // Drop the save from the address bar, so a refresh starts clean and the link is not re-applied.
    history.replaceState(history.state, '', `${location.pathname}${location.search}`);
    if (save) {
      queueOrg(() => {
        applySave(sim, save);
        sim.totals.helped = 0;
        sim.totals.nights = 0;
        sim.org.notice(sim.clockMinutes, (save.name ? t('Opened a shared city from {name}. Your own leaderboard run starts now.', { name: save.name }) : t('Opened a shared city. Your own leaderboard run starts now.')));
        afterLoad();
      });
    }
  }
  try { await ensureRun(); } catch { /* leaderboard offline: the game plays the same */ }
}
feed.prependBar(org.bar);

// A newer version on the server: offer a reload that keeps the game; in a background tab, just do it.
function reloadKeepingGame(): void {
  writeUrl();
  try { sessionStorage.setItem(RESUME_KEY, JSON.stringify(captureSave(sim, orgName(), currentRun()))); } catch { /* storage blocked: reload anyway */ }
  location.reload();
}
watchForUpdates(() => {
  if (document.hidden) return reloadKeepingGame();
  new UpdateBar(hudRoot, reloadKeepingGame);
  document.addEventListener('visibilitychange', () => { if (document.hidden && !eventPopup.open) reloadKeepingGame(); });
});

function refreshOrg(): void {
  savePanel.sync();
  org.update({ org: sim.org, stress: { police: sim.cityStress.police, medics: sim.cityStress.medics, sobering: sim.cityStress.sobering, district: sim.vitality.level }, services: sim.services, clock: sim.clockMinutes, incomePerHour: sim.fundingIncome, runningPerHour: sim.runningPerHour, payroll: sim.payroll, applicationContext: sim.applicationContext(), team: sim.team });
}

function syncEvents(): void {
  if (!eventsDirty) return;
  eventsDirty = false;
  feed.setEvents(sim.events.active, sim.events.recent, sim.clockMinutes);
  markHintedRows(sim.events.active);
}

function queueSetting(id: ParamId, value: number): void {
  (pending ??= {})[id] = value;
  // Paused scenes do not render every frame; make sure the next one applies it.
  dirty = true;
}

function applyPending(): void {
  while (pendingTriggers.length) sim.triggerEvent(pendingTriggers.shift()!);
  if (pendingOrg.length) {
    while (pendingOrg.length) pendingOrg.shift()!();
    refreshOrg();
  }
  syncEvents();
  if (!pending && !contextPending) return;
  if (pending) {
    const changes = pending;
    pending = null;
    Object.assign(settings, changes);
    sim.configure(changes);
  }
  if (contextPending) {
    contextPending = false;
    sim.setPolicy(policyFor(contextSelection));
    sim.setContext(combineEffects(contextSelection));
    syncContextProps();
  }
  syncSeason();
  syncNight();
  refreshHud();
  scheduleUrlUpdate();
}

let lastSeasonKey = '';
/**
 * Applies tonight's season to the world and the street reflections, once per
 * change. Snow falls only on snowy winter nights (by date); other winter
 * nights keep old snow on roofs and ledges.
 */
function syncSeason(): void {
  const date = sim.calendar.date;
  const snowy = snowyNight(date);
  const key = `${sim.season}|${snowy}`;
  if (key === lastSeasonKey) return;
  lastSeasonKey = key;
  const base = SEASON_PROFILES[sim.season];
  const look = sim.season === 'winter' ? { ...base.look, snow: snowy ? 1 : 0.3, drift: snowy ? ('snow' as const) : ('none' as const) } : base.look;
  world.setSeason(sim.season, { ...base, look });
  pipeline.setWetness(look.wetness);
  dirty = true;
}

let lastNight = -1;
let lastDay = -1;
let pageHaze = '';
const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]') ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'theme-color' }));
function syncNight(): void {
  const night = nightFactor(sim.clockMinutes, sim.calendar.sunset);
  const day = dayFactor(sim.clockMinutes, sim.calendar.sunset);
  // Quantized so the light only changes when the picture can show it.
  const q = Math.round(night * 64) / 64;
  const d = Math.round(day * 64) / 64;
  if (q === lastNight && d === lastDay) return;
  lastNight = q;
  lastDay = d;
  world.setNight(q, d);
  pipeline.setNight(q, d);
  // The HUD follows the scene: dark at night even on a light-mode device (see style.css).
  const scene = q > 0.5 ? 'night' : 'day';
  if (document.documentElement.dataset.scene !== scene) document.documentElement.dataset.scene = scene;
  // The page behind the scene takes the horizon's colour, so phone browsers tint their bars to match.
  const haze = world.hazeHex();
  if (haze !== pageHaze) {
    pageHaze = haze;
    document.documentElement.style.setProperty('--page', haze);
    themeColor.content = haze;
  }
  dirty = true;
}

// `?set=` mirrors settings that differ from the defaults, written at most every 400 ms.
let urlTimer = 0;
/** Painted portraits, generated once per person or place and kept. */
const portraits = new Map<string, ImageData>();
let portraitKey = '';
/** Painted from each person's own model in a separate studio; made on first selection. */
let studio: PortraitStudio | null = null;

/** Keeps the portrait on the selected person; true when it changed. */
function syncPortrait(): boolean {
  const sel = interaction.selected;
  const person = sel?.kind === 'person' ? crowd.person(sel.id) : undefined;
  // Only people have portraits; one who has left clears it.
  const key = person ? `person:${sel!.id}` : '';
  const card = person ? describePerson(person) : null;
  const caption = card ? card.profile?.name ?? card.title : '';
  const sub = card ? card.subtitle : '';
  if (portraitCaption.dataset.text !== caption + sub) {
    portraitCaption.dataset.text = caption + sub;
    portraitCaption.replaceChildren(caption, ...(sub ? [Object.assign(document.createElement('span'), { className: 'portrait-sub', textContent: sub })] : []));
  }
  if (key === portraitKey) return false;
  portraitKey = key;
  portraitBox.hidden = !key;
  if (!key) return false;
  let image = portraits.get(key);
  if (!image) {
    const ctx = portraitView.getContext('2d')!;
    const seed = [...key].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0;
    studio ??= new PortraitStudio(renderer);
    studio.portrait(person!.root, person!.look.height, seed, ctx);
    image = ctx.getImageData(0, 0, PORTRAIT_W, PORTRAIT_H);
    portraits.set(key, image);
    if (portraits.size > 60) portraits.delete(portraits.keys().next().value!);
  } else portraitView.getContext('2d')!.putImageData(image, 0, 0);
  return false;
}

/**
 * Actions from the conversation column, at the selected place. Like the
 * organisation's, they queue and apply between simulation steps. Staff and
 * waiting places go through the same settings as the sandbox sliders, so the
 * panel, the URL and the simulation stay in step.
 */
function queuePlaceAction(service: ServiceId, action: PlaceAction): void {
  queueOrg(() => {
    const bump = (key: string, by: number, max: number) => {
      const current = key.endsWith('.staff') ? sim.services[service].params.staff : sim.services[service].params.waitingSlots;
      const id = key as ParamId;
      const limit = PARAM_BY_ID[id]?.max ?? max;
      const value = Math.min(limit, current + by);
      if (value === current) return;
      sim.configure({ [key]: value } as Partial<SandboxSettings>);
      if (PARAM_BY_ID[id]) {
        settings[id] = value;
        sandbox.syncLive(id, value);
        scheduleUrlUpdate();
      }
    };
    if (action === 'moreStaff') bump(`${service}.staff`, 1, 6);
    else if (action === 'hire') { sim.recruit('hirePaid'); bump(`${service}.staff`, 1, 6); }
    else if (action === 'volunteer') { sim.recruit('volunteerDrive'); bump(`${service}.staff`, 1, 6); }
    else if (action === 'relaunch') { sim.reopen(service); syncContextProps(); }
    else if (action.startsWith('camper:')) {
      const spot = Number(action.slice(7));
      if (spot !== camperSpot()) sim.sendCamper(spot);
      syncProperty();
    } else if (action === 'move') {
      // Picked on the map: free kerb spots light up; the next click chooses one or cancels.
      const free = CAMPER_SPOTS.map((_, i) => i !== camperSpot() && !sim.property.campers.includes(i));
      world.showCamperSpots(free);
      interaction.startPlacing(() => world.camperSpotMarkers(), (spot) => queueOrg(() => moveCamperTo(spot)), () => { world.showCamperSpots(null); dirty = true; });
    }
    else if (action === 'invest') sim.invest(service);
    else if (action === 'hustle') {
      if (service === 'clubHr') { if (sim.clubContract) sim.endClubContract(); else sim.proposeClubContract(); }
      else if (service === 'drugChecking') sim.setCommercialChecking(!sim.commercialChecking);
    }
    refreshHud();
  });
}

function scheduleUrlUpdate(): void {
  clearTimeout(urlTimer);
  urlTimer = window.setTimeout(writeUrl, 400);
}
/** Writes the settings into the address bar now. */
function writeUrl(): void {
  clearTimeout(urlTimer);
  {
    const query = new URLSearchParams(location.search);
    for (const key of ['set', 'ctx', 'model']) query.delete(key);
    // Appended unescaped so the link stays readable; ids and numbers need no escaping.
    const encoded = encodeSettings(settings);
    const ctx = modelId ? `model=${modelId}` : encodeContext(contextSelection) && `ctx=${encodeContext(contextSelection)}`;
    const search = [query.toString(), encoded && `set=${encoded}`, ctx].filter(Boolean).join('&');
    history.replaceState(history.state, '', `${location.pathname}${search ? `?${search}` : ''}${location.hash}`);
  }
}

function layout(): void {
  // The canvas's own size: installed on a phone it runs under the status bar and the home bar,
  // past what the window reports.
  pipeline.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, (window.devicePixelRatio || 1) * resolution.scale);
  rig.invalidate();
}

// Render scale drops on slow frames and recovers when there is room (render/dynamicResolution.ts).
const resolution = new DynamicResolution(QUALITY.minScale, layout);

/** Re-aims the camera for the current orbit angles; cheap, no render-target changes. */
function applyView(): void {
  const frame = pipeline.frame;
  // Portrait screens start a little closer so people stay legible.
  const zoom = frame.cssW / frame.cssH < 0.8 ? 1.3 : 1;
  const framing = frameCamera(camera, world.frame.full, frame, hud.insets(), zoom * rig.zoom, rig.view, rig.focus, world.frame.bounds);
  // Shadows only need to cover what is on screen.
  world.setDetail(framing.worldPerPixel);
  coins.setPixelSize(framing.worldPerPixel);
  world.setViewFocus(rig.focus.x, rig.focus.z, ((camera.right - camera.left) / 2) * 1.4);
  // Haze starts well past the view's focus, so only the far city fades.
  camera.getWorldDirection(hazeDir);
  setPuddleView(hazeDir);
  const focusDepth = hazePoint.set(rig.focus.x, 0, rig.focus.z).sub(camera.position).dot(hazeDir);
  world.setHaze(focusDepth + 150, focusDepth + 330);
  pipeline.setCameraDepth(framing.near, framing.far, framing.worldPerPixel, rig.view.elevationDeg);
  pipeline.setSkyShift(rig.view.azimuthDeg);
  const points = {} as Record<LocationId, { x: number; y: number; below?: boolean }>;
  for (const id of LOCATION_IDS) {
    const loc = world.locations[id];
    points[id] = { ...worldToClient(loc.labelAnchor, camera, frame), below: loc.labelBelow };
  }
  hud.placeLabels(points);
  placeFxTags();
  placeThreatTags();
  hud.setViewChanged(!rig.atDefault);
  interaction.viewChanged();
  dirty = true;
}

// Pointer, touch and keyboard interaction lives in `ui/interaction.ts`; only Space is global here.
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.code === 'Space') { e.preventDefault(); setPaused(!paused); }
});

let resizeFrame = 0;
const observer = new ResizeObserver(() => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(layout);
});
observer.observe(document.body);

// Main loop. Simulation and crowd advance in fixed small steps; the frame only
// redraws when something moved or the HUD asked for it.
const STEP = 1 / 30;
let last = performance.now();
let sceneTime = 0;
let hudTimer = 0;

function frame(now: number): void {
  // Only steady frames count: a hidden tab or a stall says nothing about render cost.
  if (now - last < 100) resolution.sample(now - last, (now - last) / 1000);
  const realDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  applyPending();
  if (!paused) {
    let remaining = realDt * speed;
    while (remaining > 1e-6) {
      const dt = Math.min(STEP, remaining);
      remaining -= dt;
      sim.tick(dt);
      crowd.update(dt);
      syncServiceVisuals();
      world.update(dt, sceneTime);
      sceneTime += dt;
    }
    syncNight();
    props.update(realDt * speed);
    street.update(realDt * speed);
    cityProps.update(realDt * speed);
    fx.update(realDt * speed, sim.org.now, sim.party === 'popUp');
    if (fx.version !== fxVersion) placeFxTags();
    marks.update(realDt);
    seasonProps.update(realDt * speed);
    dirty = true;
    hudTimer -= realDt;
    if (hudTimer <= 0) {
      refreshHud();
      hudTimer = 0.25;
    }
  }
  if (interaction.frame()) dirty = true;
  if (rig.step(realDt, reducedMotion.matches)) applyView();
  if (marker.update(realDt, reducedMotion.matches)) dirty = true;
  if (coins.update(realDt)) dirty = true;
  syncPortrait();
  if (dirty) {
    pipeline.render(world.scene, camera, interaction.highlightFlags);
    dirty = false;
  }
  requestAnimationFrame(frame);
}

hud.setPaused(false);
hud.setSpeed(speed);
// `?off=dropIn,outreach,clubHr` starts with those services switched off (shareable scenarios).
const params = new URLSearchParams(location.search);
const off = params.get('off')?.split(',') ?? [];
for (const id of SERVICE_IDS) if (off.includes(id)) sim.services[id].switchedOn = sim.services[id].everRun = false;
// `?view=azimuth,elevation` (degrees) opens at a saved camera angle.
const [az, el] = (params.get('view') ?? '').split(',').map(Number);
if (Number.isFinite(az) && Number.isFinite(el)) rig.setView({ azimuthDeg: az, elevationDeg: el });
// `?set=cars:4,dropIn.staff:3` starts with sandbox settings (see src/config/sandboxParams.ts).
const fromUrl = decodeSettings(params.get('set'));
Object.assign(settings, fromUrl);
sandbox.setAll(settings);
sim.configure(fromUrl);
// After the address's settings: a "New city" click picked this page's season and time.
applyShuffle(setDateClock);
syncSeason();
world.setStill(reducedMotion.matches);
reducedMotion.addEventListener('change', () => world.setStill(reducedMotion.matches));
// `?model=nl` starts from a national model; `?ctx=law:criminal,policing:visible` sets factors directly.
const urlModel = NATIONAL_MODELS.find((m) => m.id === params.get('model'));
contextSelection = urlModel ? selectionFor(urlModel) : decodeContext(params.get('ctx'));
modelId = urlModel?.id ?? null;
context.setAll(contextSelection, modelId);
sim.setPolicy(policyFor(contextSelection));
sim.setContext(combineEffects(contextSelection));
syncContextProps();
// Settle props (for example a camper without a permit) before the first frame.
props.update(10);
syncStreet();
sim.start();
layout();
rig.step(0, true);
applyView();
// Warm the scene briefly so the first frame already shows staff at work.
for (let i = 0; i < 90 * 30; i++) {
  sim.tick(STEP);
  crowd.update(STEP);
  syncServiceVisuals();
  world.update(STEP, sceneTime);
  sceneTime += STEP;
}
// Every game starts with something mild going on, so the first night is never empty.
const STARTING_TROUBLE = ['staffIllness', 'kitShortage', 'busyNight', 'withdrawalWave', 'streetMarketForms', 'equipmentComplaints'] as const;
sim.triggerEvent(sim.season === 'winter' && eventRandom() < 0.5 ? 'coldNight' : STARTING_TROUBLE[Math.floor(eventRandom() * STARTING_TROUBLE.length)]);
syncNight();
refreshHud();
// The framing reserves room for the HUD (hud.insets), which only now holds tonight's events and
// options: re-aim, or the next re-aim (any resize) slides the scene up by the sheet's new height.
applyView();
pipeline.render(world.scene, camera);
// Installed on an iPhone the page gets its full height just after launch: the loading screen stays
// up until then, so the first frame shown is already framed for the whole screen. One more re-aim
// for whatever the HUD settled into meanwhile, drawn by the main loop before the screen lifts.
// The welcome (a modal, drawn above everything) opens with the game, not over the loading screen.
void whenViewportSettled(canvas).then(() => {
  applyView();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    loading?.remove();
    welcome.showIfNew();
  }));
});
void startGame();
// The Quaternius kits load after the first frame, so a phone is never kept waiting for them.
// The scenery kits are 2 MB: skipped on weak phones and slow or data-saving connections.
if (QUALITY.kits) void loadKits().then((kits) => { if (kits) world.applyKits(kits); });

// The player gate: queue when the server is short of memory, a time limit while busy.
let pausedBeforeQueue = false;
const queueBox = new QueueBox(document.body, (blocked) => {
  if (blocked) { pausedBeforeQueue = paused; setPaused(true); }
  else if (!pausedBeforeQueue) setPaused(false);
}, () => { /* time up: the box explains; the score can still be sent */ });
startPresence((gate) => {
  if (gate.state === 'queue') queueBox.queued(gate.position);
  else queueBox.playing(gate.until);
});
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  // Diagnostics for local profiling only; stripped from production builds.
  Object.assign(window, { __sandbox: { renderer, pipeline, world, camera, sim, crowd, rig, interaction, actionMenu, props, street, cityProps, syncEvents: () => { eventsDirty = true; syncEvents(); refreshOrg(); syncStreet(); } } });
}
