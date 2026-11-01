import { Vector3, WebGLRenderer } from 'three';
import './style.css';
import { ILLUSTRATIVE } from './config/illustrative';
import { combineEffects, decodeContext, defaultContext, encodeContext, type ContextSelection } from './config/contextFactors';
import { NATIONAL_MODELS, selectionFor } from './config/nationalModels';
import { PARAM_BY_ID, decodeSettings, defaultSettings, encodeSettings, type ParamId, type SandboxSettings } from './config/sandboxParams';
import { Crowd } from './agents/crowd';
import { createIsoCamera, frameCamera, worldToClient } from './render/camera';
import { CameraRig } from './render/cameraRig';
import { Highlight, OVERLAY_LAYER } from './render/highlight';
import { ScenePipeline } from './render/scenePipeline';
import { dayFactor, nightFactor } from './sim/clock';
import { createRandom } from './sim/random';
import { Simulation } from './sim/simulation';
import { loadPeople } from './agents/humanFigure';
import { SEASON_PROFILES } from './config/seasons';
import { LOCATION_IDS, SERVICE_IDS, serviceAt, type LocationId, type ServiceId, type ServiceStatus } from './sim/types';
import { ContextSection } from './ui/contextSection';
import { Hud, type PlaceAction } from './ui/hud';
import { PORTRAIT_H, PORTRAIT_W, paintPerson, paintPlace } from './ui/portraitArt';
import { describePerson } from './ui/personInfo';
import { LOCATION_NAMES } from './config/places';
import { Interaction } from './ui/interaction';
import { EventFeed, HINT_ROW, hintInputId, markHintedRows } from './ui/eventFeed';
import { OrgPanel } from './ui/orgPanel';
import { FACTOR_BY_ID } from './config/contextFactors';
import type { PolicyInfo } from './sim/simulation';
import type { EventId } from './config/randomEvents';
import { SandboxPanel } from './ui/sandboxPanel';
import { buildSnapshot } from './ui/snapshot';
import { SelectionMarker } from './ui/selection';
import { ContextProps } from './world/contextProps';
import { DISTRICT } from './world/layout';
import { buildWorld, configureRenderer } from './world/scene';
import { NeighbourhoodProps } from './world/neighbourhoodProps';
import { CityProps } from './world/cityProps';
import { SeasonProps, snowyNight } from './world/seasonProps';
import { POPULATIONS, presence } from './config/populations';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
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
// People's assets load before the crowd is built (the loading screen stays up);
// if they are slow or missing the crowd uses the simple figures instead.
await Promise.race([loadPeople(), new Promise((resolve) => setTimeout(resolve, 8000))]);
const crowd = new Crowd(sim, world, ILLUSTRATIVE.seed + 1);
crowd.setCamera(camera);
const marker = new SelectionMarker();
world.scene.add(marker.group);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const rig = new CameraRig(world.frame.full.getCenter(new Vector3()), DISTRICT - 4);
const highlight = new Highlight();
const props = new ContextProps(world.scene, world.locations.outreach.root, () => reducedMotion.matches);
const street = new NeighbourhoodProps(world.scene);
const cityProps = new CityProps(world.scene, () => reducedMotion.matches);
const seasonProps = new SeasonProps(world.scene, () => reducedMotion.matches);
function syncStreet(): void {
  street.set({ shopsShut: sim.events.isActive('shopClosesEarly'), litter: sim.neighbourhood.state.litter });
  cityProps.set({ party: sim.party, bikes: sim.city.bikes, graffiti: sim.city.graffiti });
  seasonProps.set(sim.calendar.date);
}
sim.on((e) => {
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
});

function setPaused(p: boolean): void {
  paused = p;
  hud.setPaused(p);
}

// Service state drives each location's visuals: staffed = lit and unfolded.
const LEVEL: Record<ServiceStatus, number> = { open: 1, closing: 0.45, opening: 0.12, closed: 0 };
function syncServiceVisuals(): void {
  for (const id of LOCATION_IDS) world.locations[id].setServiceLevel(LEVEL[sim.services[serviceAt(id)].status]);
}

function refreshHud(): void {
  hud.update(buildSnapshot(sim, crowd.population));
  interaction.refresh();
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
  onHint: (hint) => {
    sandbox.setOpen(true);
    const input = document.getElementById(hintInputId(hint));
    const row = input?.closest(HINT_ROW) as HTMLElement | null;
    if (!input || !row) return;
    // Open the topic that holds it, so it is on screen before scrolling to it.
    sandbox.reveal(input);
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
  onOpen: () => {
    sandbox.setOpen(true);
    sandbox.reveal(org.section);
    org.section.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  },
});
sandbox.mount(org.section);
feed.prependBar(org.bar);

function refreshOrg(): void {
  org.update({ org: sim.org, services: sim.services, clock: sim.clockMinutes, incomePerHour: sim.fundingIncome, applicationContext: sim.applicationContext() });
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
  dirty = true;
}

// `?set=` mirrors settings that differ from the defaults, written at most every 400 ms.
let urlTimer = 0;
/** Painted portraits, generated once per person or place and kept. */
const portraits = new Map<string, ImageData>();
let portraitKey = '';
/** Painted portraits are off until they are redrawn to a good enough standard. */
const PORTRAITS_ON = false;

/** Keeps the portrait on the current selection; true when it changed. */
function syncPortrait(): boolean {
  if (!PORTRAITS_ON) return false;
  const sel = interaction.selected;
  const person = sel?.kind === 'person' ? crowd.person(sel.id) : undefined;
  // A person who has left clears the portrait.
  const key = sel && (sel.kind === 'location' || person) ? `${sel.kind}:${sel.id}` : '';
  const card = person ? describePerson(person) : null;
  const caption = card ? card.title : sel?.kind === 'location' ? LOCATION_NAMES[sel.id] : '';
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
    if (person) paintPerson(ctx, person.look, seed);
    else if (sel?.kind === 'location') paintPlace(ctx, sel.id, seed);
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
    else if (action === 'moreWaiting') bump(`${service}.waiting`, 2, 10);
    else if (action === 'hire') { sim.recruit('hirePaid'); bump(`${service}.staff`, 1, 6); }
    else if (action === 'volunteer') { sim.recruit('volunteerDrive'); bump(`${service}.staff`, 1, 6); }
    else if (action === 'relaunch') { sim.reopen(service); syncContextProps(); }
    refreshHud();
  });
}

function scheduleUrlUpdate(): void {
  clearTimeout(urlTimer);
  urlTimer = window.setTimeout(() => {
    const query = new URLSearchParams(location.search);
    for (const key of ['set', 'ctx', 'model']) query.delete(key);
    // Appended unescaped so the link stays readable; ids and numbers need no escaping.
    const encoded = encodeSettings(settings);
    const ctx = modelId ? `model=${modelId}` : encodeContext(contextSelection) && `ctx=${encodeContext(contextSelection)}`;
    const search = [query.toString(), encoded && `set=${encoded}`, ctx].filter(Boolean).join('&');
    history.replaceState(history.state, '', `${location.pathname}${search ? `?${search}` : ''}${location.hash}`);
  }, 400);
}

function layout(): void {
  pipeline.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  rig.invalidate();
}

/** Re-aims the camera for the current orbit angles; cheap, no render-target changes. */
function applyView(): void {
  const frame = pipeline.frame;
  // Portrait screens start a little closer so people stay legible.
  const zoom = frame.cssW / frame.cssH < 0.8 ? 1.3 : 1;
  const framing = frameCamera(camera, world.frame.full, frame, hud.insets(), zoom * rig.zoom, rig.view, rig.focus, world.frame.bounds);
  // Shadows only need to cover what is on screen.
  world.setViewFocus(rig.focus.x, rig.focus.z, ((camera.right - camera.left) / 2) * 1.4);
  pipeline.setCameraDepth(framing.near, framing.far, framing.worldPerPixel, rig.view.elevationDeg);
  pipeline.setSkyShift(rig.view.azimuthDeg);
  const points = {} as Record<LocationId, { x: number; y: number; below?: boolean }>;
  for (const id of LOCATION_IDS) {
    const loc = world.locations[id];
    points[id] = { ...worldToClient(loc.labelAnchor, camera, frame), below: loc.labelBelow };
  }
  hud.placeLabels(points);
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
for (const id of SERVICE_IDS) if (off.includes(id)) sim.services[id].switchedOn = false;
// `?view=azimuth,elevation` (degrees) opens at a saved camera angle.
const [az, el] = (params.get('view') ?? '').split(',').map(Number);
if (Number.isFinite(az) && Number.isFinite(el)) rig.setView({ azimuthDeg: az, elevationDeg: el });
// `?set=cars:4,dropIn.staff:3` starts with sandbox settings (see src/config/sandboxParams.ts).
const fromUrl = decodeSettings(params.get('set'));
Object.assign(settings, fromUrl);
sandbox.setAll(settings);
sim.configure(fromUrl);
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
syncNight();
refreshHud();
pipeline.render(world.scene, camera);
loading?.remove();
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  // Diagnostics for local profiling only; stripped from production builds.
  Object.assign(window, { __sandbox: { renderer, pipeline, world, camera, sim, crowd, rig, interaction, props, street, cityProps, syncEvents: () => { eventsDirty = true; syncEvents(); refreshOrg(); syncStreet(); } } });
}
