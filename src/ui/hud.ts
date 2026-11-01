import { CAMPER_PATH, CAMPER_PATH_IDS, type CamperPath } from '../config/camperPaths';
import { ACTIVITY, MIX_MAX, type Activity } from '../config/serviceMix';
import type { FavourId } from '../config/favours';
import { ORG, RECRUIT } from '../config/organisation';
import { price } from './money';
import { SERVICE_TEXT } from '../config/places';
import type { Insets } from '../render/camera';
import { LOCATION_IDS, SERVICE_IDS, serviceAt, type LocationId, type ServiceId, type ServiceStatus } from '../sim/types';
import type { PersonCard } from './personInfo';
import { NAME_MAX } from './names';
import { METRIC_KEYS, MetricTrend, sparkPoints, TREND_BUCKET_MINUTES, TREND_BUCKETS, type MetricKey } from './trends';
import { LOCALE, plural, t } from '../i18n';

export interface HudCallbacks {
  onTogglePause(): void;
  onSpeed(speed: number): void;
  onService(id: ServiceId, on: boolean): void;
  /** A location label was activated; `null` closes the selection. */
  onSelect(id: LocationId | null): void;
  onResetView(): void;
  /** Zoom onto the selection, or back out; follow or unfollow a person. */
  onToggleFocus(): void;
  /** Something to do at the selected place: applied between simulation steps. */
  onAction(service: ServiceId, action: PlaceAction): void;
  /** Open the welcome box again. */
  onHelp(): void;
  /** Give the selected place or building a new display name (empty: back to its own). */
  onRename(name: string): void;
  /** One of the selected building's own actions (rent it, give it back). */
  onBuildingAction(action: string): void;
  /** Changes how much a place spends on one activity. */
  onMix(service: ServiceId, activity: Activity, weight: number): void;
  /** Pays a place's one-off set-up for an activity. */
  onMixSetUp(service: ServiceId, activity: Activity): void;
  /** Uses the favour held with city hall. */
  onFavour(id: FavourId): void;
  /** Specialise the outreach camper (or change its path). */
  onCamperPath(path: CamperPath): void;
  /** Starts a donation drive. */
  onDrive(): void;
  /** Opens the Settings menu (phones reach it from the replies). */
  onSettings(): void;
  /** Start or stop this season's aid: the warming bus, or water and shade. */
  onAid(kind: 'cold' | 'heat'): void;
}

/** What can be done at a place, free or paid from the organisation's budget. */
export type PlaceAction = 'moreStaff' | 'moreWaiting' | 'hire' | 'volunteer' | 'relaunch' | 'camper' | 'move' | 'path' | 'mix' | 'hustle' | 'invest' | 'donations' | `camper:${number}`;

/** The selected place's levers, for its action replies. */
/** One activity in a place's budget mix. */
export interface MixItem {
  id: Activity;
  label: string;
  does: string;
  /** Slider value, 0 to MIX_MAX. */
  weight: number;
  /** Share of visits now, 0 to 1. */
  share: number;
  /** Not on offer now: not allowed by law, or needs a paid set-up first. */
  lock: 'law' | 'setup' | null;
  setupCost: number;
}

export interface PlaceLevers {
  service: ServiceId;
  wanted: number;
  staffMax: number;
  waiting: number;
  waitingMax: number;
  closedDown: boolean;
  reopening: boolean;
  budget: number;
  /** Why it is closed now, if it is: decides which replies can still help. */
  closedReason?: string | null;
  /** Donation box: out or not, what each staff member on shift brings in per hour, and how many are on shift. */
  donations: { on: boolean; each: number; staff: number };
  /** Investing: cost, level and progress. */
  invest: { cost: number; level: number; progress: number; max: number };
  /** A side income this place can bring in (the club's fee for the stand, sold checks), on or off. */
  hustle?: { label: string; hint: string; on: boolean };
  /** The budget mix: what visits here are spent on, and the visit cost it comes to. */
  mix: { visitCost: number; items: MixItem[] };
  /** Outreach only: extra campers out, the most allowed, and their costs. */
  campers?: { out: number; max: number; cost: number; perHour: number; moving: boolean; spots: { name: string; taken: boolean; here: boolean }[] };
  /** The camper's specialisation: the current one, if any (outreach only). */
  path?: { current: CamperPath | null };
}

export interface LocationSnapshot {
  name: string;
  service: string;
  status: ServiceStatus;
  /** Counts as icon chips: `value` on screen, `label` the full sentence (tooltip and screen readers). */
  chips: { icon: ChipIcon; value: string; label: string }[];
  /** Things worth a sentence (why it is closed). */
  facts: [string, string][];
  metrics: { demand: number; attended: number; unmetNeed: number; adverse: number };
  metricsLabel: string;
  actions?: PlaceLevers;
  /** Closed by law, council or venue rules (not by anything the player runs): shown in red. */
  blockedByLaw?: boolean;
  /** Investment: level 1 to 3 and progress to the next (0..1). */
  level?: { level: number; progress: number; max: number };
}

export interface HudSnapshot {
  clock: string;
  /** Scene clock in minutes, used to bucket the trend sparklines. */
  clockMinutes?: number;
  people: number;
  locations: Record<LocationId, LocationSnapshot>;
  enabled: Record<ServiceId, boolean>;
  /** Money available now and how it is moving per clock hour. */
  money?: { budget: number; perHour: number };
  /** People turned away in the last 24 clock hours, and how deep the crisis it feeds is (0 to 1). */
  unmet?: { day: number; crisis: number };
  /** Pressure on the city's police, medics and sobering-up centre, 0 to 1 each. */
  stress?: { police: number; medics: number; sobering: number; district: number };
  /** Favours with city hall: held (0 or 1), whether city hall is owed one, and what can be asked. */
  favours?: { held: number; owed: boolean; items: { id: FavourId; label: string }[] };
  /** A donation drive: running until a clock time, or what starting one costs. */
  drive?: { until: string | null; cost: number; hours: number };
  /** In winter (or on a cold night) the warming bus, in summer water and shade: on or off, and the running cost. */
  aid?: { kind: 'cold' | 'heat'; on: boolean; perHour: number };
}

export const STATUS_TEXT: Record<ServiceStatus, string> = {
  open: t('Open'),
  opening: t('Opening: staff on the way'),
  closing: t('Closing: staff leaving'),
  closed: t('Closed'),
};

const METRIC_LABELS: Record<MetricKey, { name: string; hint: string }> = {
  demand: { name: t('Demand'), hint: t('People who came looking for the service') },
  attended: { name: t('Attended'), hint: t('People who were seen or served') },
  unmetNeed: { name: t('Unmet'), hint: t('People who left without being served, because it was full, closed or the wait ran long') },
  adverse: { name: t('Adverse'), hint: t('Adverse outcomes: a neutral placeholder count with no assumed effect of any service') },
};

export const SPEEDS = [1, 4, 16] as const;
const SPARK_W = 56;
const SPARK_H = 14;
const SVG_NS = 'http://www.w3.org/2000/svg';
const NARROW = '(max-width: 760px)';

/** Small icons for the city-service meters, drawn in the text colour: a police badge, a medical cross, a bed, a house. */
const STRESS_ICONS: Record<'police' | 'medics' | 'sobering' | 'district', string> = {
  police: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1l6 2.2v4.3c0 3.6-2.6 6.3-6 7.5-3.4-1.2-6-3.9-6-7.5V3.2z"/></svg>',
  medics: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M6 1.5h4v4.5h4.5v4H10v4.5H6V10H1.5V6H6z"/></svg>',
  sobering: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M1 4h2v5h12v5h-2v-2H3v2H1zm3 1.5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM7 6h6.5a1.5 1.5 0 0 1 1.5 1.5V8H7z"/></svg>',
  district: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.5l6.5 5.5H13v7.5H9.5V10h-3v4.5H3V7H1.5z"/></svg>',
};

/** A place's counts as icons: people being helped, people waiting, staff, people who turned back, the venue's crowd, the door. */
export type ChipIcon = 'inside' | 'queue' | 'staff' | 'back' | 'venue' | 'door';
const CHIP_ICONS: Record<ChipIcon, string> = {
  inside: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5.5 2.5a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zm5.5 1a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM1 13.5c0-2.9 2-4.8 4.5-4.8S10 10.6 10 13.5zm10-.1c0-1.4-.4-2.6-1.1-3.6.4-.1.7-.2 1.1-.2 2.2 0 4 1.6 4 3.8z"/></svg>',
  queue: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 1.5h8v1.5h-1v1.6c0 1.4-.8 2.5-2 3.4 1.2.9 2 2 2 3.4V13h1v1.5H4V13h1v-1.6c0-1.4.8-2.5 2-3.4-1.2-.9-2-2-2-3.4V3H4zm2.5 1.5v1.6c0 .9.6 1.7 1.5 2.4.9-.7 1.5-1.5 1.5-2.4V3z"/></svg>',
  staff: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.5a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2zM2.5 14.5c0-3.2 2.4-5.6 5.5-5.6s5.5 2.4 5.5 5.6zm4.8-4v1.3H6v1.4h1.3v1.3h1.4v-1.3H10v-1.4H8.7v-1.3z"/></svg>',
  back: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M6 2L1.5 6 6 10V7.5h4a2.5 2.5 0 0 1 0 5H6V14h4a4 4 0 0 0 0-8H6z"/></svg>',
  venue: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M13.5 1.5v9.2a2.3 2.3 0 1 1-1.5-2.1V4.6L6.5 5.9v6.8a2.3 2.3 0 1 1-1.5-2.1V3.3z"/></svg>',
  door: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M3 1.5h8.5V14.5H13V16H1.5v-1.5H3zm6.2 6a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z"/></svg>',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Writes text only when it changed, so per-tick refreshes cause no layout work. */
function setText(e: HTMLElement, text: string): void {
  if (e.textContent !== text) e.textContent = text;
}

function setAttr(e: Element, name: string, value: string): void {
  if (e.getAttribute(name) !== value) e.setAttribute(name, value);
}

function button(cls: string, text?: string): HTMLButtonElement {
  const b = el('button', cls, text);
  b.type = 'button';
  return b;
}

interface MetricRow { value: HTMLElement; line: SVGPolylineElement }

/** What the column currently describes. */
type Mode = { kind: 'location'; id: LocationId } | { kind: 'person' } | { kind: 'building' } | null;

/** An ordinary building's card: what it is, and figures for it and the neighbourhood. */
export interface BuildingCard {
  title: string;
  said: string;
  facts: [string, string][];
  /** Things to do here (rent a closed shop, give it back). */
  actions?: { id: string; label: string; short: string; enabled: boolean }[];
  /** False for things with no name of their own to change (a passing police car). */
  renamable?: boolean;
}

const BUILDING_SLOTS = 4;

/**
 * HUD laid out like a conversation: a borderless dark column on the right
 * (a bottom sheet on phones) where the selected place or person speaks,
 * numbered reply options for every control underneath, and a full-width bar
 * to pause or continue the night. World labels and tooltips are plain
 * shadowed text over the scene.
 */
export class Hud {
  private readonly root: HTMLElement;
  private readonly header: HTMLElement;
  private readonly column: HTMLElement;
  /** Where the events feed sits: under the clock, in the column's free space. */
  readonly eventsSlot: HTMLElement;
  private readonly options: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly log: HTMLElement;
  private readonly idle: HTMLElement;
  private readonly speaker: HTMLElement;
  private readonly said: HTMLElement;
  private readonly aside: HTMLElement;
  private readonly locationView: HTMLElement;
  private readonly buildingView: HTMLElement;
  private readonly facts: HTMLElement;
  private readonly chips: HTMLElement;
  private chipKeys = '';
  private readonly metricsLabel: HTMLElement;
  private readonly metrics = {} as Record<MetricKey, MetricRow>;
  private readonly personNote: HTMLElement;
  private readonly profileView: HTMLElement;
  private readonly foldBtn: HTMLButtonElement;
  private folded = false;
  /** Where the replies started when last unfolded, so framing holds still while folded. */
  private optionsTopUnfolded = 0;
  private readonly continueBtn: HTMLButtonElement;
  private readonly continueLabel: HTMLSpanElement;
  private readonly worksFill: HTMLSpanElement;
  private readonly worksText: HTMLSpanElement;
  private readonly speedBtn: HTMLButtonElement;
  private readonly money: HTMLElement;
  private readonly unmet: HTMLElement;
  private readonly crisisLine: HTMLElement;
  private readonly stressRow: HTMLElement;
  private readonly stressFill = {} as Record<'police' | 'medics' | 'sobering' | 'district', HTMLElement>;
  private readonly stressMeters = {} as Record<'police' | 'medics' | 'sobering' | 'district', HTMLElement>;
  private speed: number = SPEEDS[0];
  private readonly switches = {} as Record<ServiceId, HTMLButtonElement>;
  private readonly switchState = {} as Record<ServiceId, HTMLElement>;
  private readonly switchOpts = {} as Record<ServiceId, HTMLElement>;
  private readonly reviewOpt: HTMLElement;
  private readonly aidOpt: HTMLElement;
  private readonly driveOpt: HTMLElement;
  private readonly configureOpt: HTMLElement;
  private readonly favourOpt: HTMLElement;
  private readonly favourBtn: HTMLButtonElement;
  private readonly favourLong: HTMLElement;
  private readonly favourOpts: { li: HTMLLIElement; long: HTMLElement; id: string }[] = [];
  private favourOpen = false;
  private readonly driveBtn: HTMLButtonElement;
  private readonly driveLong: HTMLElement;
  private readonly aidBtn: HTMLButtonElement;
  private readonly aidLong: HTMLElement;
  private readonly reviewName: HTMLElement;
  private readonly reviewShort: HTMLElement;
  private readonly backOpt: HTMLElement;
  private servicesOpen = false;
  private readonly focusOpt: HTMLElement;
  private readonly staffGroupBtn: HTMLButtonElement;
  private readonly staffGroupLong: HTMLElement;
  private readonly staffGroupOpt: HTMLLIElement;
  private readonly topBar: HTMLElement;
  private staffOpen = false;
  private camperOpen = false;
  private pathOpen = false;
  private readonly pathOpts: { li: HTMLLIElement; button: HTMLButtonElement; long: HTMLElement; short: HTMLElement; id: CamperPath }[] = [];
  private mixOpen = false;
  /** One row per activity slot: a labelled slider, its share, and a set-up button when it needs one. */
  private readonly mixRows: { li: HTMLLIElement; label: HTMLLabelElement; input: HTMLInputElement; out: HTMLOutputElement; note: HTMLElement; setup: HTMLButtonElement; id: Activity | null; editingUntil: number }[] = [];
  private readonly spotOpts: { li: HTMLLIElement; button: HTMLButtonElement; long: HTMLElement; short: HTMLElement }[] = [];
  private readonly actionOpts = {} as Record<PlaceAction, { li: HTMLLIElement; button: HTMLButtonElement; label: HTMLElement; short: HTMLElement }>;
  private readonly focusBtn: HTMLButtonElement;
  private readonly focusLong: HTMLElement;
  private readonly focusShort: HTMLElement;
  private readonly leaveOpt: HTMLElement;
  private readonly renameBtn: HTMLButtonElement;
  /** Whether the open building card's subject can be renamed. */
  private renamable = true;
  private renameInput: HTMLInputElement | null = null;
  private readonly buildingOpts: { li: HTMLLIElement; button: HTMLButtonElement; long: HTMLElement; short: HTMLElement; id: string }[] = [];
  private readonly resetOpt: HTMLElement;
  private readonly labels = {} as Record<LocationId, HTMLButtonElement>;
  private readonly labelWidths = {} as Record<LocationId, number>;
  private readonly trends = {} as Record<LocationId, MetricTrend>;
  private labelPoints: Record<LocationId, { x: number; y: number; below?: boolean }> | null = null;
  private mode: Mode = null;
  private lastSnapshot: HudSnapshot | null = null;
  private factKeys = '';
  private headerBottom = 0;

  constructor(root: HTMLElement, cb: HudCallbacks) {
    this.root = root;
    for (const id of LOCATION_IDS) this.trends[id] = new MetricTrend();

    this.header = el('header', 'hud-header');
    // "How it works" lives in the Settings menu.
    const subtitle = el('p', 'subtitle', t('Help people stay alive without going bankrupt.'));
    this.header.append(el('h1', undefined, t('Harm reduction project')), subtitle);

    this.column = el('aside', 'column');
    this.column.setAttribute('aria-label', t('Details and controls'));
    const top = el('div', 'column-top');
    this.clock = el('span', 'clock', '19:40');
    this.clock.setAttribute('aria-label', t('Scene clock'));
    // One toggle beside the clock steps through the speeds.
    this.speedBtn = button('speed-toggle', '1x');
    this.speedBtn.addEventListener('click', () => cb.onSpeed(SPEEDS[(SPEEDS.indexOf(this.speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length]));
    const time = el('div', 'column-time');
    time.append(this.clock, this.speedBtn);
    // Money on hand, always in view: everything priced is greyed out when it runs short.
    this.money = el('span', 'money');
    this.money.setAttribute('role', 'status');
    // People turned away show as pressure on the city's services (the meters); a crisis gets its own red
    // section above tonight's events: what it is, how many were turned away, what it costs.
    this.unmet = el('section', 'crisis-box');
    this.unmet.setAttribute('role', 'status');
    this.unmet.hidden = true;
    this.crisisLine = el('span', 'crisis-line');
    this.unmet.append(el('strong', 'crisis-title', t('Crisis')), this.crisisLine);
    const right = el('div', 'column-right');
    right.append(this.money);
    top.append(time, right);
    // Phones: a handle folds the sheet down to the clock and the Pause bar.
    this.foldBtn = button('sheet-handle');
    this.foldBtn.setAttribute('aria-expanded', 'true');
    this.foldBtn.setAttribute('aria-label', t('Fold the panel away'));
    // The handle is a swipe: down folds the sheet, up opens it; the sheet follows the finger. A short tap toggles.
    let drag: { id: number; y: number; dy: number } | null = null;
    let swiped = false;
    this.foldBtn.addEventListener('pointerdown', (e) => {
      drag = { id: e.pointerId, y: e.clientY, dy: 0 };
      swiped = false;
      this.foldBtn.setPointerCapture(e.pointerId);
    });
    this.foldBtn.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dy = e.clientY - drag.y;
      // Only the open sheet slides with the finger (downwards); a folded one just waits for the release.
      if (!this.folded && drag.dy > 0) {
        this.column.style.transition = 'none';
        this.column.style.transform = `translateY(${Math.min(drag.dy, this.column.offsetHeight * 0.8)}px)`;
      }
    });
    const release = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dy = drag.dy;
      drag = null;
      this.column.style.transition = '';
      this.column.style.transform = '';
      if (Math.abs(dy) < 24) return;
      swiped = true;
      this.setFolded(dy > 0);
    };
    this.foldBtn.addEventListener('pointerup', release);
    this.foldBtn.addEventListener('pointercancel', release);
    this.foldBtn.addEventListener('click', () => {
      if (swiped) { swiped = false; return; }
      this.setFolded(!this.folded);
    });
    this.eventsSlot = el('div', 'column-events');

    // The conversation: who or what is selected, speaking in plain sentences.
    this.log = el('div', 'log');
    this.log.setAttribute('aria-live', 'polite');
    this.idle = el('p', 'idle', t('Pick a place, a person or an action.'));
    const line = el('p', 'line');
    this.speaker = el('span', 'speaker');
    this.said = el('span', 'said');
    this.renameBtn = button('rename-pencil');
    this.renameBtn.setAttribute('aria-label', t('Rename'));
    this.renameBtn.title = t('Rename');
    this.renameBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm17.7-10.2a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
    line.append(this.speaker, this.renameBtn, this.said);
    this.aside = el('p', 'aside');
    this.locationView = el('div', 'location-view');
    this.chips = el('ul', 'chips');
    this.chips.setAttribute('role', 'list');
    this.facts = el('dl', 'facts place-facts');
    this.metricsLabel = el('p', 'check');
    const metrics = el('dl', 'metrics');
    for (const key of METRIC_KEYS) {
      const row = el('div', `metric metric-${key}`);
      row.title = METRIC_LABELS[key].hint;
      const value = el('dd', 'metric-value', '0');
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${SPARK_W} ${SPARK_H}`);
      svg.setAttribute('class', 'spark');
      svg.setAttribute('aria-hidden', 'true');
      const polyline = document.createElementNS(SVG_NS, 'polyline');
      svg.append(polyline);
      row.append(value, el('dt', undefined, METRIC_LABELS[key].name), svg);
      metrics.append(row);
      this.metrics[key] = { value, line: polyline };
    }
    this.locationView.append(
      this.chips,
      this.facts,
      this.metricsLabel,
      metrics,
      el('p', 'note metrics-note', t('Lines: last {min} min. Illustrative counts.', { min: TREND_BUCKET_MINUTES * TREND_BUCKETS })),
    );
    this.profileView = el('div', 'profile');
    this.personNote = el('p', 'note', t('People here are archetypes drawn from research on people who use drugs. Each figure is illustrative, not a real person.'));
    this.buildingView = el('dl', 'facts building-facts');
    this.log.append(this.idle, line, this.aside, this.locationView, this.buildingView, this.profileView, this.personNote);

    // Replies: every control is a numbered option; number keys choose them.
    this.options = el('ol', 'options');
    const opt = (child: HTMLElement) => {
      const li = el('li');
      li.append(child);
      this.options.append(li);
      return li;
    };
    this.focusBtn = button('opt');
    this.focusLong = el('span', 'long');
    this.focusShort = el('span', 'short');
    this.focusShort.setAttribute('aria-hidden', 'true');
    this.focusBtn.append(this.focusLong, this.focusShort);
    this.focusBtn.addEventListener('click', () => cb.onToggleFocus());
    this.focusOpt = opt(this.focusBtn);
    // Staffing actions fold under one reply, so the list stays short.
    this.staffGroupBtn = button('opt group');
    this.staffGroupLong = el('span', 'long');
    const groupShort = el('span', 'short', t('Staffing.'));
    groupShort.setAttribute('aria-hidden', 'true');
    this.staffGroupBtn.append(this.staffGroupLong, groupShort);
    this.staffGroupBtn.setAttribute('aria-expanded', 'false');
    this.staffGroupBtn.addEventListener('click', () => {
      this.staffOpen = !this.staffOpen;
      setAttr(this.staffGroupBtn, 'aria-expanded', String(this.staffOpen));
      if (this.mode?.kind === 'location') this.renderActions(this.lastSnapshot?.locations[this.mode.id].actions);
    });
    this.staffGroupOpt = opt(this.staffGroupBtn);
    this.staffGroupOpt.hidden = true;
    // Things to do at the selected place: free, or paid from the budget.
    for (const action of ACTIONS) {
      const b = button('opt');
      const long = el('span', 'long');
      const short = el('span', 'short', ACTION_SHORT[action]);
      short.setAttribute('aria-hidden', 'true');
      b.append(long, short);
      b.addEventListener('click', () => {
        const levers = this.mode?.kind === 'location' ? this.lastSnapshot?.locations[this.mode.id].actions : undefined;
        if (action === 'camper' || action === 'mix' || action === 'path') {
          // Opens a list (spots, paths, or the budget mix sliders) instead of acting at once.
          if (action === 'camper') this.camperOpen = !this.camperOpen;
          else if (action === 'path') this.pathOpen = !this.pathOpen;
          else this.mixOpen = !this.mixOpen;
          if (levers) this.renderActions(levers);
          return;
        }
        if (levers) cb.onAction(levers.service, action);
      });
      this.actionOpts[action] = { li: opt(b), button: b, label: long, short };
      if (STAFF_ACTIONS.includes(action)) this.actionOpts[action].li.classList.add('nested');
    }
    // The selected building's own actions, filled per card.
    for (let i = 0; i < BUILDING_SLOTS; i++) {
      const b = button('opt');
      const long = el('span', 'long');
      const short = el('span', 'short');
      short.setAttribute('aria-hidden', 'true');
      b.append(long, short);
      const slot = { li: opt(b), button: b, long, short, id: '' };
      slot.li.hidden = true;
      b.addEventListener('click', () => { if (slot.id) cb.onBuildingAction(slot.id); });
      this.buildingOpts.push(slot);
    }
    // Where another camper can go: one reply per spot, shown under 'Send another camper'.
    for (let i = 0; i < MAX_SPOTS; i++) {
      const b = button('opt');
      const long = el('span', 'long');
      const short = el('span', 'short');
      short.setAttribute('aria-hidden', 'true');
      b.append(long, short);
      b.addEventListener('click', () => {
        const levers = this.mode?.kind === 'location' ? this.lastSnapshot?.locations[this.mode.id].actions : undefined;
        if (levers) cb.onAction(levers.service, `camper:${i}`);
        this.camperOpen = false;
      });
      const li = opt(b);
      li.classList.add('nested', 'nested-2');
      li.hidden = true;
      this.spotOpts.push({ li, button: b, long, short });
    }
    // Spots sit right under the camper reply.
    this.actionOpts.camper.li.after(...this.spotOpts.map((o) => o.li));
    // The camper's specialisations, right under 'Specialise'.
    for (const id of CAMPER_PATH_IDS) {
      const b = button('opt');
      const long = el('span', 'long');
      const short = el('span', 'short', `${CAMPER_PATH[id].short}.`);
      short.setAttribute('aria-hidden', 'true');
      b.append(long, short);
      b.title = CAMPER_PATH[id].does;
      b.addEventListener('click', () => { cb.onCamperPath(id); this.pathOpen = false; });
      const li = opt(b);
      li.classList.add('nested', 'nested-2');
      li.hidden = true;
      this.pathOpts.push({ li, button: b, long, short, id });
    }
    this.actionOpts.path.li.after(...this.pathOpts.map((o) => o.li));
    // Budget mix: one slider per activity, right under its reply.
    for (let i = 0; i < MIX_SLOTS; i++) {
      const li = el('li', 'mix-row');
      li.classList.add('nested');
      li.hidden = true;
      const inputId = `mix-${i}`;
      const label = el('label');
      label.htmlFor = inputId;
      const out = el('output');
      out.htmlFor.add(inputId);
      const input = el('input');
      input.type = 'range';
      input.id = inputId;
      input.min = '0';
      input.max = String(MIX_MAX);
      input.step = '1';
      const note = el('span', 'mix-note');
      const setup = button('opt mix-setup');
      setup.hidden = true;
      const row = { li, label, input, out, note, setup, id: null as Activity | null, editingUntil: 0 };
      input.addEventListener('input', () => {
        row.editingUntil = performance.now() + 1200;
        const levers = this.mode?.kind === 'location' ? this.lastSnapshot?.locations[this.mode.id].actions : undefined;
        if (levers && row.id) cb.onMix(levers.service, row.id, Number(input.value));
      });
      setup.addEventListener('click', () => {
        const levers = this.mode?.kind === 'location' ? this.lastSnapshot?.locations[this.mode.id].actions : undefined;
        if (levers && row.id) cb.onMixSetUp(levers.service, row.id);
      });
      li.append(label, out, input, note, setup);
      this.mixRows.push(row);
    }
    this.actionOpts.mix.li.after(...this.mixRows.map((r) => r.li));

    // "0. Back." heads the replies whenever something is selected: back to the overview.
    const leave = button('opt', t('Back.'));
    leave.setAttribute('aria-label', t('Close details (Escape)'));
    leave.addEventListener('click', () => cb.onSelect(null));
    this.leaveOpt = opt(leave);
    this.leaveOpt.classList.add('zero');
    this.options.prepend(this.leaveOpt);
    // A pencil beside the name renames whatever is selected: place, building or person.
    this.renameBtn.addEventListener('click', () => this.startRename(cb));
    // Services sit behind one reply so the list stays short; the selected
    // place's own switch is offered directly.
    const review = button('opt');
    this.reviewName = el('span', 'long');
    this.reviewShort = el('span', 'short');
    this.reviewShort.setAttribute('aria-hidden', 'true');
    review.append(this.reviewName, this.reviewShort);
    review.addEventListener('click', () => this.setServicesOpen(true));
    this.reviewOpt = opt(review);
    // This season's aid for people outdoors, offered when nothing is selected.
    this.aidBtn = button('opt');
    this.aidLong = el('span', 'long');
    const aidShort = el('span', 'short', t('Aid.'));
    aidShort.setAttribute('aria-hidden', 'true');
    this.aidBtn.append(this.aidLong, aidShort);
    this.aidBtn.addEventListener('click', () => { const k = this.lastSnapshot?.aid?.kind; if (k) cb.onAid(k); });
    this.aidOpt = opt(this.aidBtn);
    // A donation drive, offered when nothing is selected.
    this.driveBtn = button('opt');
    this.driveLong = el('span', 'long');
    const driveShort = el('span', 'short', t('Drive.'));
    driveShort.setAttribute('aria-hidden', 'true');
    this.driveBtn.append(this.driveLong, driveShort);
    this.driveBtn.addEventListener('click', () => cb.onDrive());
    this.driveOpt = opt(this.driveBtn);

    // A favour with city hall: one reply that opens the favours on offer.
    this.favourBtn = button('opt group');
    this.favourLong = el('span', 'long');
    const favourShort = el('span', 'short', t('Favour.'));
    favourShort.setAttribute('aria-hidden', 'true');
    this.favourBtn.append(this.favourLong, favourShort);
    this.favourBtn.addEventListener('click', () => {
      this.favourOpen = !this.favourOpen;
      queueMicrotask(() => this.syncDrill());
      if (this.lastSnapshot) this.update(this.lastSnapshot);
    });
    this.favourOpt = opt(this.favourBtn);
    for (let i = 0; i < 3; i++) {
      const b = button('opt');
      const long = el('span', 'long');
      b.append(long);
      const o = { li: opt(b), long, id: '' };
      o.li.classList.add('nested');
      o.li.hidden = true;
      b.addEventListener('click', () => { if (o.id) cb.onFavour(o.id as FavourId); this.favourOpen = false; });
      this.favourOpts.push(o);
    }
    // Phones: Settings is the last reply here (with a gear, not a number) instead of a button over the scene.
    const configure = button('opt configure-opt', t('Settings'));
    configure.addEventListener('click', () => cb.onSettings());
    this.configureOpt = opt(configure);
    this.configureOpt.classList.add('phone-only');
    const back = button('opt', t('Back.'));
    back.addEventListener('click', () => this.setServicesOpen(false));
    this.backOpt = opt(back);
    this.backOpt.classList.add('zero');
    for (const id of SERVICE_IDS) {
      // The name picks the place (the camera goes there); only the ON/OFF switch at the end turns it on or off.
      const b = button('opt switch');
      b.dataset.service = id;
      const name = el('span', 'name');
      const short = el('span', 'short', SERVICE_TEXT[id].short);
      short.setAttribute('aria-hidden', 'true');
      name.append(el('span', 'long', SERVICE_TEXT[id].label), short);
      b.append(name);
      b.addEventListener('click', () => { this.servicesOpen = false; cb.onSelect(id === 'clubHr' ? 'club' : id); });
      const toggle = button('svc-toggle');
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('aria-label', SERVICE_TEXT[id].label);
      const state = el('span', 'state');
      toggle.append(state);
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        cb.onService(id, toggle.getAttribute('aria-checked') !== 'true');
      });
      this.switches[id] = toggle;
      this.switchState[id] = state;
      this.switchOpts[id] = opt(b);
      this.switchOpts[id].classList.add('svc-row');
      this.switchOpts[id].append(toggle);
    }
    const reset = button('opt');
    const resetShort = el('span', 'short', t('Overview.'));
    resetShort.setAttribute('aria-hidden', 'true');
    reset.append(el('span', 'long', t('Back to the overview.')), resetShort);
    reset.setAttribute('aria-label', t('Back to the overview'));
    reset.title = t('R. Right-drag or two-finger drag to orbit.');
    reset.addEventListener('click', () => cb.onResetView());
    this.resetOpt = opt(reset);
    this.resetOpt.hidden = true;

    this.continueBtn = button('continue');
    this.continueLabel = el('span', 'continue-label', t('Pause'));
    this.worksFill = el('span', 'works-fill');
    this.worksText = el('span', 'works-text');
    this.worksFill.hidden = this.worksText.hidden = true;
    this.continueBtn.append(this.worksFill, this.continueLabel, this.worksText);
    this.continueBtn.addEventListener('click', () => cb.onTogglePause());

    // City services under pressure: three small meters under the top line.
    // The meters sit in their own size container, so their grid follows the room they have.
    this.stressRow = el('div', 'stress-wrap');
    const meters = el('div', 'stress-row');
    meters.setAttribute('role', 'group');
    meters.setAttribute('aria-label', t('City services under pressure'));
    this.stressRow.append(meters);
    for (const [key, name, hint] of [
      ['police', t('Police'), t('Incidents, stops, the camp and people turned away from a bed keep police busy; an overstretched force makes the council lean on funders.')],
      ['medics', t('Medics'), t('Overdoses nobody reached, people harmed outdoors and people turned away from services fill ambulances and A&E; overstretched, fewer survive.')],
      ['district', t('District'), t('How well the district is doing: harm reduction that works brings more people out and new venues.')],
      ['sobering', t('Sobering'), t('Drunk club leavers taken to the sobering-up centre (izba wytrzeźwień), more of them when the club service turns people away.')],
    ] as const) {
      const m = el('span', 'stress');
      m.dataset.key = key;
      m.title = `${name}: ${hint}`;
      m.setAttribute('aria-label', name);
      const bar = el('span', 'stress-bar');
      const fill = el('span', 'stress-fill');
      bar.append(fill);
      // An icon per service, coloured by how stretched it is; the name is in the tooltip.
      const icon = el('span', 'stress-icon');
      icon.innerHTML = STRESS_ICONS[key];
      m.append(icon, el('span', 'stress-name', name), bar);
      this.stressMeters[key] = m;
      meters.append(m);
      this.stressFill[key] = fill;
    }
    this.column.append(this.foldBtn, top, this.stressRow, this.unmet, this.eventsSlot, this.log, this.options, this.continueBtn);
    // Phones: the clock, money and meters live in a block at the top of the screen; the sheet keeps the rest.
    this.topBar = el('div', 'top-bar');
    const placeIndicators = () => {
      if (window.matchMedia(NARROW).matches) {
        if (top.parentElement !== this.topBar) this.topBar.append(top, this.stressRow);
      } else if (top.parentElement !== this.column) {
        this.foldBtn.after(top, this.stressRow);
      }
      this.headerBottom = 0;
    };
    placeIndicators();
    window.matchMedia(NARROW).addEventListener('change', placeIndicators);

    const labelLayer = el('div', 'labels');
    for (const id of LOCATION_IDS) {
      const b = button('loc-label');
      b.dataset.location = id;
      const bar = el('span', 'level-bar');
      bar.append(el('span', 'level-fill'));
      b.append(el('span', 'dot'), el('span', 'loc-name'), bar);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        cb.onSelect(this.mode?.kind === 'location' && this.mode.id === id ? null : id);
      });
      this.labels[id] = b;
      this.labelWidths[id] = 0;
      labelLayer.append(b);
    }

    root.append(labelLayer, this.header, this.topBar, this.column);
    // Label widths depend on the web fonts, which arrive after first layout.
    void document.fonts.ready.then(() => {
      for (const id of LOCATION_IDS) this.labelWidths[id] = 0;
      if (this.labelPoints) this.placeLabels(this.labelPoints);
    });
    // On phones the sheet grows and shrinks with what it shows: labels it now
    // covers are hidden straight away, not on the next camera move.
    new ResizeObserver(() => { if (this.labelPoints) this.placeLabels(this.labelPoints); }).observe(this.column);
    this.render();
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  /** Number keys pick the visible numbered option, as in a conversation. */
  private onKey(e: KeyboardEvent): void {
    if (e.altKey || e.ctrlKey || e.metaKey || !/^[0-9]$/.test(e.key)) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
    const visible = [...this.options.children].filter((li) => !(li as HTMLElement).hidden);
    // 0 is Back; the numbers count the other replies.
    const li = e.key === '0' ? visible.find((v) => v.classList.contains('zero')) : visible.filter((v) => !v.classList.contains('zero'))[Number(e.key) - 1];
    const target = li?.querySelector<HTMLButtonElement>('button.opt') ?? null;
    if (!target) return;
    e.preventDefault();
    target.click();
  }

  setPaused(paused: boolean): void {
    setText(this.continueLabel, paused ? t('Continue') : t('Pause'));
    setAttr(this.continueBtn, 'aria-pressed', String(paused));
    setAttr(this.continueBtn, 'aria-label', paused ? t('Continue the simulation (Space)') : t('Pause the simulation (Space)'));
  }

  /** Building work under way, shown as a fill across the Pause bar. Empty hides it. */
  setWorks(works: readonly { name: string; progress: number; building: boolean }[]): void {
    const on = works.length > 0;
    this.worksFill.hidden = this.worksText.hidden = !on;
    if (!on) return;
    const w = works[0];
    const pct = Math.round(100 * Math.min(1, Math.max(0, w.progress)));
    this.worksFill.style.transform = `scaleX(${pct / 100})`;
    const vars = { name: w.name, pct, more: works.length - 1 };
    setText(this.worksText, works.length > 1
      ? (w.building ? t('Extending: {name}, {pct}% (+{more} more)', vars) : t('Scaling down: {name}, {pct}% (+{more} more)', vars))
      : (w.building ? t('Extending: {name}, {pct}%', vars) : t('Scaling down: {name}, {pct}%', vars)));
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    setText(this.speedBtn, `${speed}x`);
    const next = SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length];
    setAttr(this.speedBtn, 'aria-label', t('Speed {speed}x. Switch to {next}x', { speed, next }));
    this.speedBtn.dataset.fast = String(speed > 1);
  }

  /** Offers the overview option only while the camera is away from it. */
  setViewChanged(changed: boolean): void {
    // Zooming back out is the wheel, a pinch or Escape: no reply needed for it.
    void changed;
  }

  /** Reflects whether the camera is zoomed onto (or following) the selection. */
  setFocused(focused: boolean, person = false): void {
    const text = person ? (focused ? t('Stop following.') : t('Follow them.')) : focused ? t('Step back.') : t('Take a closer look.');
    const short = person ? (focused ? t('Unfollow.') : t('Follow.')) : focused ? t('Step back.') : t('Look closer.');
    setText(this.focusLong, text);
    setText(this.focusShort, short);
    setAttr(this.focusBtn, 'aria-label', text);
    setAttr(this.focusBtn, 'aria-pressed', String(focused));
    setAttr(this.focusBtn, 'title', focused ? t('Back to the overview (F)') : person ? t('Keep the camera on this person (F)') : t('Zoom in here (F, or double-click)'));
  }

  /** Label button for a location, for keyboard focus moves. */
  labelFor(id: LocationId): HTMLButtonElement {
    return this.labels[id];
  }

  showLocation(id: LocationId | null): void {
    // A different place starts with its staffing folded.
    if (this.mode?.kind !== 'location' || this.mode.id !== id) {
      this.staffOpen = false;
      this.camperOpen = false;
      this.pathOpen = false;
      this.mixOpen = false;
      setAttr(this.staffGroupBtn, 'aria-expanded', 'false');
    }
    this.mode = id ? { kind: 'location', id } : null;
    for (const l of LOCATION_IDS) setAttr(this.labels[l], 'aria-pressed', String(l === id));
    this.render();
    if (this.lastSnapshot) this.update(this.lastSnapshot);
  }

  /** Shows an ordinary building and the neighbourhood around it. */
  showBuilding(card: BuildingCard): void {
    const renamable = card.renamable !== false;
    if (this.renamable !== renamable) {
      this.renamable = renamable;
      if (!this.renameInput) this.renameBtn.hidden = !renamable;
    }
    if (this.mode?.kind !== 'building') {
      this.mode = { kind: 'building' };
      for (const l of LOCATION_IDS) setAttr(this.labels[l], 'aria-pressed', 'false');
      this.render();
    }
    setText(this.speaker, card.title);
    setText(this.said, card.said);
    if (this.said.dataset.alert) delete this.said.dataset.alert;
    this.buildingOpts.forEach((o, i) => {
      const a = card.actions?.[i];
      o.id = a?.id ?? '';
      const hidden = !a || this.servicesOpen;
      if (o.li.hidden !== hidden) o.li.hidden = hidden;
      if (!a) return;
      setText(o.long, a.label);
      setText(o.short, a.short);
      if (o.button.disabled === a.enabled) o.button.disabled = !a.enabled;
    });
    const text = card.facts.map(([k, v]) => `${k}:${v}`).join('|');
    if (this.buildingView.dataset.text !== text) {
      this.buildingView.dataset.text = text;
      this.buildingView.replaceChildren(...card.facts.flatMap(([k, v]) => [el('dt', undefined, k), el('dd', undefined, v)]));
    }
  }

  /** Shows the person. `card` null means they have left the scene. */
  showPerson(card: PersonCard | null, following: boolean, lastTitle?: string): void {
    if (this.mode?.kind !== 'person') {
      this.mode = { kind: 'person' };
      for (const l of LOCATION_IDS) setAttr(this.labels[l], 'aria-pressed', 'false');
      this.render();
    }
    const role = card ? card.role : 'left';
    if (this.column.dataset.role !== role) this.column.dataset.role = role;
    setText(this.speaker, card?.title ?? lastTitle ?? t('Person'));
    setText(this.said, card ? `${card.activity}.` : t('Walked out of the scene.'));
    if (this.said.dataset.alert) delete this.said.dataset.alert;
    const camera = !card ? '' : following ? ' ' + (card.inView ? t('The camera follows.') : t('Out of view inside; the camera waits.')) : '';
    setText(this.aside, card ? `${card.subtitle}.${camera}` : t('Gone. The camera returns to the overview.'));
    // Only following a person stays a reply; looking closer is a double-click or pinch.
    this.focusOpt.hidden = !card;
    const pr = card?.profile;
    const key = pr?.name ?? '';
    if (this.profileView.dataset.key !== key) {
      this.profileView.dataset.key = key;
      this.profileView.hidden = !pr;
      if (pr) {
        const facts = el('dl', 'facts');
        facts.append(el('dt', undefined, t('Often uses')), el('dd', undefined, pr.uses), el('dt', undefined, t('Main risks')), el('dd', undefined, pr.risks));
        this.profileView.replaceChildren(el('h3', 'profile-name', pr.name), el('p', 'profile-blurb', pr.blurb), facts, el('p', 'note', pr.source));
      } else this.profileView.replaceChildren();
    }
  }

  tooltipFor(id: LocationId, part?: 'stand'): { title: string; body: string; status: ServiceStatus } | null {
    const loc = this.lastSnapshot?.locations[id];
    if (!loc) return null;
    const status = STATUS_TEXT[loc.status];
    if (part === 'stand') return { title: loc.service, body: status, status: loc.status };
    return { title: loc.name, body: `${loc.service}: ${status}`, status: loc.status };
  }

  placeLabels(points: Record<LocationId, { x: number; y: number; below?: boolean }>): void {
    this.labelPoints = points;
    if (!this.headerBottom) this.headerBottom = Math.max(this.header.getBoundingClientRect().bottom, this.topBar.getBoundingClientRect().bottom);
    const narrow = window.matchMedia(NARROW).matches;
    const rect = this.column.getBoundingClientRect();
    const columnLeft = narrow ? window.innerWidth : rect.left;
    // On phones the sheet covers the bottom; labels below its top would sit under it.
    // Its top edge fades in over the first 52px, so labels stop above the solid part.
    const floor = narrow ? rect.top + 40 : window.innerHeight - 8;
    // The selected place claims its spot first; labels that would overlap a
    // placed one are tucked away (still laid out, so their width stays known).
    const order = this.mode?.kind === 'location' ? [this.mode.id, ...LOCATION_IDS.filter((l) => l !== (this.mode as { id: LocationId }).id)] : LOCATION_IDS;
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (const id of order) {
      const { x, y, below } = points[id];
      const label = this.labels[id];
      // Widths only change with the text, so measure once instead of every re-aim.
      if (!this.labelWidths[id]) this.labelWidths[id] = label.offsetWidth;
      const half = this.labelWidths[id] / 2;
      const cx = Math.min(columnLeft - 8 - half, Math.max(8 + half, x));
      // Anchors out of view (when zoomed in) hide their label rather than pile up at an edge.
      const off = (below ? y : y - 40) < this.headerBottom || (below ? y + 40 : y) > floor || x < -half || x > columnLeft + half;
      if (label.hidden !== off) label.hidden = off;
      const box = { x0: cx - half, x1: cx + half, y0: below ? y : y - 30, y1: below ? y + 30 : y };
      const tucked = !off && placed.some((p) => p.x0 < box.x1 && p.x1 > box.x0 && p.y0 < box.y1 && p.y1 > box.y0);
      if (!off && !tucked) placed.push(box);
      if ((label.dataset.tucked === 'true') !== tucked) label.dataset.tucked = String(tucked);
      label.style.transform = `translate(${Math.round(cx)}px, ${Math.round(y)}px) translate(-50%, ${below ? '0%' : '-100%'})`;
    }
  }

  /**
   * The replies shown right now, for the action menu: one entry per option
   * row with a single button (the speed row and the like stay in the column).
   */
  menuEntries(): { title: string; items: { label: string; disabled: boolean; run(): void }[] } {
    // The menu lists staffing actions directly, so open the group while reading the rows.
    const wasOpen = this.staffOpen;
    const loc = this.mode?.kind === 'location' ? this.lastSnapshot?.locations[this.mode.id].actions : undefined;
    const opened = !!loc && !wasOpen && !this.staffGroupBtn.disabled;
    if (opened) { this.staffOpen = true; this.renderActions(loc); }
    const items = [...this.options.children]
      .filter((li) => li !== this.staffGroupOpt)
      .filter((li): li is HTMLLIElement => li instanceof HTMLLIElement && !li.hidden)
      .map((li) => li.querySelectorAll('button'))
      .filter((buttons) => buttons.length === 1)
      .map(([b]) => ({
        // Switches say their state, as the column's ON / OFF does.
        label: (b.querySelector('.long')?.textContent || b.getAttribute('aria-label') || b.textContent || '').trim()
          + (b.getAttribute('role') === 'switch' ? (b.getAttribute('aria-checked') === 'true' ? t(': on (switch off)') : t(': off (switch on)')) : ''),
        disabled: b.disabled,
        run: () => b.click(),
      }))
      .filter((i) => i.label);
    if (opened) { this.staffOpen = false; this.renderActions(loc); }
    return { title: this.mode ? this.speaker.textContent ?? '' : t('The neighbourhood'), items };
  }

  /** Swaps the speaker's name for a text field; Enter or leaving it saves, Escape cancels. */
  private startRename(cb: HudCallbacks): void {
    if (this.renameInput) return this.renameInput.focus();
    const input = el('input', 'rename');
    input.type = 'text';
    input.maxLength = NAME_MAX;
    input.value = this.speaker.textContent ?? '';
    input.setAttribute('aria-label', t('New name (leave empty for the original)'));
    this.renameInput = input;
    this.speaker.hidden = true;
    this.renameBtn.hidden = true;
    this.speaker.after(input);
    let done = false;
    const finish = (save: boolean) => {
      if (done) return;
      done = true;
      if (save) cb.onRename(input.value);
      input.remove();
      this.renameInput = null;
      this.speaker.hidden = false;
      this.renameBtn.hidden = !this.mode || (this.mode.kind === 'building' && !this.renamable);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
    input.focus();
    input.select();
  }

  /** Folds the phone sheet down to the clock and Pause bar, or opens it again. */
  setFolded(folded: boolean): void {
    if (this.folded === folded) return;
    this.folded = folded;
    if (folded) this.column.dataset.folded = 'true';
    else delete this.column.dataset.folded;
    setAttr(this.foldBtn, 'aria-expanded', String(!folded));
    setAttr(this.foldBtn, 'aria-label', folded ? t('Open the panel') : t('Fold the panel away'));
  }

  /** CSS-pixel areas the HUD covers; the camera frames the scene around them. */
  insets(): Insets {
    const vh = window.innerHeight;
    this.headerBottom = Math.max(this.header.getBoundingClientRect().bottom, this.topBar.getBoundingClientRect().bottom);
    const top = this.headerBottom + 6;
    if (!window.matchMedia(NARROW).matches) {
      return { top: Math.min(top, 72), right: window.innerWidth - this.column.getBoundingClientRect().left, bottom: 8, left: 0 };
    }
    // Phones: the column is a bottom sheet. Reserve room for the conversation
    // and for the reply rows a selection adds, so the framing never has to
    // change (and the scene never jumps) when something is selected.
    if (!this.folded) this.optionsTopUnfolded = this.options.getBoundingClientRect().top;
    const optionsTop = this.optionsTopUnfolded;
    const rowsToCome = this.focusOpt.hidden ? 44 : 0;
    return { top, right: 0, bottom: vh - optionsTop + 150 + rowsToCome, left: 0 };
  }

  update(s: HudSnapshot): void {
    if (!this.lastSnapshot) requestAnimationFrame(() => this.root.classList.add('hud-ready'));
    this.lastSnapshot = s;
    setText(this.clock, s.clock);
    if (s.money) {
      const b = Math.round(s.money.budget);
      const rate = Math.round(s.money.perHour);
      setText(this.money, t('{money} {rate}/h', { money: b.toLocaleString(LOCALE), rate: `${rate >= 0 ? '+' : '−'}${Math.abs(rate)}` }));
      setAttr(this.money, 'aria-label', rate >= 0 ? t('Money {money}, up {rate} an hour', { money: b, rate: Math.abs(rate) }) : t('Money {money}, down {rate} an hour', { money: b, rate: Math.abs(rate) }));
      const state = b < 150 ? 'low' : rate < 0 ? 'falling' : 'ok';
      if (this.money.dataset.state !== state) this.money.dataset.state = state;
    }
    if (s.unmet) {
      const { day, crisis } = s.unmet;
      const away = plural(day, ['{n} person turned away in the last 24 hours', '{n} people turned away in the last 24 hours'], ['{n} osoba odesłana w ciągu ostatnich 24 godzin', '{n} osoby odesłane w ciągu ostatnich 24 godzin', '{n} osób odesłanych w ciągu ostatnich 24 godzin']);
      setText(this.crisisLine, t('{away}. More trouble on the street, warier funders, more harm outdoors until fewer are turned away.', { away }));
      setAttr(this.unmet, 'aria-label', t('{away}, crisis', { away }));
      const state = crisis >= 0.5 ? 'crisis' : 'rising';
      if (this.unmet.hidden !== (crisis <= 0)) this.unmet.hidden = crisis <= 0;
      if (this.unmet.dataset.state !== state) this.unmet.dataset.state = state;
    }
    if (s.stress) {
      for (const key of ['police', 'medics', 'sobering', 'district'] as const) {
        const v = s.stress[key];
        const f = this.stressFill[key];
        const w = `${Math.round(v * 100)}%`;
        if (f.style.width !== w) f.style.width = w;
        const state = key === 'district' ? 'good' : v >= 0.7 ? 'high' : v >= 0.4 ? 'mid' : 'low';
        if (f.dataset.state !== state) { f.dataset.state = state; this.stressMeters[key].dataset.state = state; }
      }
    }
    const aid = s.aid;
    if (aid) {
      const perHour = price(aid.perHour);
      setText(this.aidLong, aid.kind === 'cold' ? (aid.on ? t('Warming bus out: stop') : t('Warming bus {price}/h', { price: perHour })) : (aid.on ? t('Water and shade out: stop') : t('Water and shade {price}/h', { price: perHour })));
      this.aidBtn.title = aid.kind === 'cold' ? t('A warming bus on cold nights: fewer people harmed outdoors.') : t('Water and shade on hot days: fewer people harmed outdoors.');
      setAttr(this.aidBtn, 'aria-pressed', String(aid.on));
    }
    const d = s.drive;
    if (d) {
      setText(this.driveLong, d.until ? t('Donation drive until {time}', { time: d.until }) : t('Donation drive {price}', { price: price(d.cost) }));
      this.driveBtn.title = plural(d.hours, ['{n} hour of collecting on the street; donation boxes doubled meanwhile.', '{n} hours of collecting on the street; donation boxes doubled meanwhile.'], ['{n} godzina zbiórki na ulicy; w tym czasie puszki zbierają podwójnie.', '{n} godziny zbiórki na ulicy; w tym czasie puszki zbierają podwójnie.', '{n} godzin zbiórki na ulicy; w tym czasie puszki zbierają podwójnie.']);
      const off = d.until !== null || (s.money?.budget ?? 0) < d.cost;
      if (this.driveBtn.disabled !== off) this.driveBtn.disabled = off;
    }
    const f = s.favours;
    if (f) {
      setText(this.favourLong, f.held ? t('Ask city hall a favour') : f.owed ? t('City hall is owed a favour') : t('No favour with city hall'));
      this.favourBtn.title = f.held ? t('One favour now; city hall asks something back later.') : t("Agree to city hall's next request to earn a favour.");
      if (this.favourBtn.disabled === !!f.held) this.favourBtn.disabled = !f.held;
      if (!f.held) this.favourOpen = false;
      setAttr(this.favourBtn, 'aria-expanded', String(this.favourOpen));
      this.favourOpts.forEach((o, i) => {
        const item = f.items[i];
        o.id = item?.id ?? '';
        if (item) setText(o.long, item.label);
      });
    }
    const favourHidden = !f || this.servicesOpen || this.mode !== null;
    if (this.favourOpt.hidden !== favourHidden) this.favourOpt.hidden = favourHidden;
    this.favourOpts.forEach((o) => { const h = favourHidden || !this.favourOpen || !o.id; if (o.li.hidden !== h) o.li.hidden = h; });
    const driveHidden = !d || this.servicesOpen || this.mode !== null;
    if (this.driveOpt.hidden !== driveHidden) this.driveOpt.hidden = driveHidden;
    const aidHidden = !aid || this.servicesOpen || this.mode !== null;
    if (this.aidOpt.hidden !== aidHidden) this.aidOpt.hidden = aidHidden;
    const on = SERVICE_IDS.filter((id) => s.enabled[id]).length;
    setText(this.reviewName, t('Services ({on}/{all}).', { on, all: SERVICE_IDS.length }));
    setText(this.reviewShort, t('Services ({on}/{all}).', { on, all: SERVICE_IDS.length }));
    for (const id of SERVICE_IDS) {
      setAttr(this.switches[id], 'aria-checked', String(s.enabled[id]));
      if (this.switchOpts[id].dataset.on !== String(s.enabled[id])) this.switchOpts[id].dataset.on = String(s.enabled[id]);
      setText(this.switchState[id], s.enabled[id] ? t('On') : t('Off'));
    }
    let renamed = false;
    for (const id of LOCATION_IDS) {
      const loc = s.locations[id];
      if (s.clockMinutes !== undefined) this.trends[id].sample(s.clockMinutes, loc.metrics);
      const label = this.labels[id];
      const name = label.querySelector('.loc-name') as HTMLElement;
      if (name.textContent !== loc.name) {
        name.textContent = loc.name;
        this.labelWidths[id] = 0;
        renamed = true;
      }
      if (label.dataset.status !== loc.status) label.dataset.status = loc.status;
      if (loc.level) {
        // The bar under the name: progress to the next level; empty means a downgrade is near.
        const p = loc.level.progress.toFixed(3);
        if (label.style.getPropertyValue('--progress') !== p) label.style.setProperty('--progress', p);
        const lv = String(loc.level.level);
        if (label.dataset.level !== lv) label.dataset.level = lv;
      }
      setAttr(label, 'aria-label', t('{name}, {service} {status}. Show details', { name: loc.name, service: loc.service, status: STATUS_TEXT[loc.status].toLowerCase() }));
    }
    // A new name changes the label width, so re-clamp it against the screen edge.
    if (renamed && this.labelPoints) this.placeLabels(this.labelPoints);
    if (this.mode?.kind !== 'location') return;
    const loc = s.locations[this.mode.id];
    setText(this.speaker, loc.name);
    setText(this.said, `${loc.service}: ${loc.blockedByLaw ? t('not permitted') : STATUS_TEXT[loc.status].toLowerCase()}.`);
    const law = String(!!loc.blockedByLaw);
    if (this.said.dataset.alert !== law) this.said.dataset.alert = law;
    if (this.column.dataset.status !== loc.status) this.column.dataset.status = loc.status;
    this.renderLocation(loc, this.trends[this.mode.id]);
    this.renderActions(loc.actions);
  }

  /** Action replies for the selected place: labels carry the current numbers and costs. */
  private renderActions(a: PlaceLevers | undefined): void {
    queueMicrotask(() => this.syncDrill());
    // Closed for a reason no reply can change (law, hours, switched off, an event):
    // everything but leaving is locked. Closed for want of staff: only staffing helps.
    const why = a?.closedReason ?? null;
    const locked = !!why && why !== 'noStaff' && why !== 'closedDown';
    const onlyStaff = why === 'noStaff';
    const groupHidden = !a || a.closedDown || this.servicesOpen;
    setAttr(this.staffGroupBtn, 'aria-disabled', String(locked));
    if (this.staffGroupBtn.disabled !== locked) this.staffGroupBtn.disabled = locked;
    if (locked && this.staffOpen) this.staffOpen = false;
    if (this.staffGroupOpt.hidden !== groupHidden) this.staffGroupOpt.hidden = groupHidden;
    if (a) setText(this.staffGroupLong, t('Staffing ({n} wanted)', { n: a.wanted }));
    // Labels stay short; the detail (times, rates, why) is in the tooltip.
    const show = (action: PlaceAction, visible: boolean, text: string, enabled = true, hint = '') => {
      const o = this.actionOpts[action];
      if (o.button.title !== hint) o.button.title = hint;
      const hidden = !visible || this.servicesOpen || (STAFF_ACTIONS.includes(action) && !this.staffOpen);
      if (o.li.hidden !== hidden) o.li.hidden = hidden;
      setText(o.label, text);
      if (o.button.disabled === enabled) o.button.disabled = !enabled;
    };
    if (!a) {
      for (const action of ACTIONS) show(action, false, '');
      return;
    }
    const afford = (cost: number) => a.budget >= cost;
    const staffRoom = a.wanted < a.staffMax;
    const waitRoom = a.waiting < a.waitingMax;
    show('moreStaff', !a.closedDown && !locked, staffRoom ? t('One more on shift ({n})', { n: a.wanted }) : t('{n} on shift, the most', { n: a.wanted }), staffRoom, t('Ask for one more staff member on shift here.'));
    show('moreWaiting', !a.closedDown, waitRoom ? t('More waiting places ({n})', { n: a.waiting }) : plural(a.waiting, ['{n} waiting place, the most', '{n} waiting places, the most'], ['{n} miejsce oczekiwania, więcej się nie da', '{n} miejsca oczekiwania, więcej się nie da', '{n} miejsc oczekiwania, więcej się nie da']), waitRoom && !locked && !onlyStaff, t('Set out more places for people to wait.'));
    show('hire', !a.closedDown && staffRoom, t('Hire paid {price}', { price: price(ACTION_COST.hire) }), afford(ACTION_COST.hire), t('Hire a paid worker for here: about 2 hours to find one.'));
    show('volunteer', !a.closedDown && staffRoom, t('Find a volunteer {price}', { price: price(ACTION_COST.volunteer) }), afford(ACTION_COST.volunteer), t('About an hour and a half to find one.'));
    const c = a.campers;
    const canSend = !!c && c.out < c.max && afford(c.cost);
    show('camper', !!c && !a.closedDown, c ? (c.out < c.max ? t('Another camper {price}', { price: price(c.cost) }) : plural(c.out, ['{n} camper out, all there are', '{n} campers out, all there are'], ['{n} kamper w trasie, więcej nie ma', '{n} kampery w trasie, więcej nie ma', '{n} kamperów w trasie, więcej nie ma'])) : '', canSend, c ? t('Send another camper out: {price}, then {perHour} an hour.', { price: price(c.cost), perHour: price(c.perHour) }) : '');
    if (!canSend) this.camperOpen = false;
    setAttr(this.actionOpts.camper.button, 'aria-expanded', String(this.camperOpen));
    this.spotOpts.forEach((o, i) => {
      const spot = c?.spots[i];
      const hidden = !spot || !this.camperOpen || !this.staffOpen || this.servicesOpen;
      if (o.li.hidden !== hidden) o.li.hidden = hidden;
      if (!spot) return;
      const busy = spot.taken || spot.here;
      setText(o.long, spot.taken || spot.here ? t('{name} (a camper is there).', { name: spot.name }) : `${spot.name}.`);
      setText(o.short, spot.name.split(',')[0] + '.');
      if (o.button.disabled !== busy) o.button.disabled = busy;
    });
    // Moving the first camper: picked on the map; it closes while it drives, then opens at the new spot.
    // The camper's specialisation: a reply that opens the three paths.
    const path = a.path;
    show('path', !!path && !a.closedDown, path?.current ? t('Specialised: {path}', { path: CAMPER_PATH[path.current].label }) : t('Specialise the camper'), true, t('Pick what the camper is best at; changing later costs again.'));
    setAttr(this.actionOpts.path.button, 'aria-expanded', String(this.pathOpen));
    for (const o of this.pathOpts) {
      const hidden = !path || !this.pathOpen || this.servicesOpen || a.closedDown;
      if (o.li.hidden !== hidden) o.li.hidden = hidden;
      if (!path) continue;
      const now = path.current === o.id;
      setText(o.long, now ? t('{path} (now)', { path: CAMPER_PATH[o.id].label }) : t('{path} ({price})', { path: CAMPER_PATH[o.id].label, price: price(CAMPER_PATH[o.id].cost) }));
      const off = now || a.budget < CAMPER_PATH[o.id].cost;
      if (o.button.disabled !== off) o.button.disabled = off;
    }
    show('move', !!c && !a.closedDown, c ? (c.moving ? t('Camper on the move') : t('Move the camper')) : '', !!c && !c.moving, t('Pick a free kerb spot on the map; it reopens there once parked.'));
    const inv = a.invest;
    const full = inv.level >= inv.max && inv.progress >= 1;
    // Building work goes on whether or not the place is open tonight.
    show('invest', !a.closedDown, full ? t('Fully upgraded') : t('Invest {price}', { price: price(inv.cost) }), !full && afford(inv.cost), t('Build on: more places here once the work is done.'));
    const don = a.donations;
    const rate = t('{each}/h × {staff} staff on shift = +{total}/h', { each: price(don.each), staff: don.staff, total: price(don.each * don.staff) });
    show('hustle', !!a.hustle && !a.closedDown, a.hustle?.label ?? '', true, a.hustle?.hint ?? '');
    // Budget mix: what visits here are spent on.
    show('mix', !a.closedDown, t('Budget mix ({price} a visit)', { price: price(a.mix.visitCost) }), true, a.mix.items.filter((m) => m.share > 0).map((m) => `${ACTIVITY[m.id].short} ${Math.round(m.share * 100)}%`).join(', ') || t('Nothing on offer'));
    setAttr(this.actionOpts.mix.button, 'aria-expanded', String(this.mixOpen));
    const now = performance.now();
    this.mixRows.forEach((r, i) => {
      const m = a.mix.items[i];
      const hidden = !m || !this.mixOpen || this.servicesOpen || a.closedDown;
      if (r.li.hidden !== hidden) r.li.hidden = hidden;
      if (!m) { r.id = null; return; }
      r.id = m.id;
      setText(r.label, m.label);
      r.input.title = m.does;
      r.input.disabled = m.lock !== null;
      if (now > r.editingUntil && r.input.value !== String(m.weight)) r.input.value = String(m.weight);
      setText(r.out, m.lock ? '' : `${Math.round(m.share * 100)}%`);
      setText(r.note, m.lock === 'law' ? t('Not allowed by law here.') : m.lock === 'setup' ? t('Needs equipment first ({price}).', { price: price(m.setupCost) }) : m.does);
      r.note.dataset.alert = m.lock === 'law' ? 'law' : '';
      const showSetup = m.lock === 'setup';
      if (r.setup.hidden === showSetup) r.setup.hidden = !showSetup;
      if (showSetup) {
        setText(r.setup, t('Set it up ({price}).', { price: price(m.setupCost) }));
        r.setup.disabled = !afford(m.setupCost);
      }
    });
    // A switch: the short label (all a phone shows) says whether the box is out.
    setText(this.actionOpts.donations.short, don.on ? t('Donation box: out.') : t('Donation box: in.'));
    setAttr(this.actionOpts.donations.button, 'aria-pressed', String(don.on));
    show('donations', !a.closedDown, don.on ? t('Donation box +{price}/h', { price: price(don.each * don.staff) }) : t('Put out a donation box'), true, don.on ? t('{rate}. Click to take it in.', { rate }) : t('{price} an hour per staff member on shift.', { price: price(don.each) }));
    show('relaunch', a.closedDown, a.reopening ? t('Relaunching…') : t('Relaunch {price}', { price: price(ACTION_COST.relaunch) }), !a.reopening && afford(ACTION_COST.relaunch), t('Back in about 2 hours.'));
  }

  /** Shows the parts of the column that belong to the current mode. */
  /**
   * Phones: an open group (staffing, the budget mix, a favour) takes the list
   * over: the other replies step aside and the group's own reply, marked ‹,
   * leads back. On wider screens the list stays as it is.
   */
  private syncDrill(): void {
    const head = this.staffOpen && !this.staffGroupOpt.hidden ? this.staffGroupOpt
      : this.mixOpen && !this.actionOpts.mix.li.hidden ? this.actionOpts.mix.li
        : this.favourOpen && !this.favourOpt.hidden ? this.favourOpt
          : null;
    for (const li of this.options.querySelectorAll(':scope > li.drill-head')) if (li !== head) li.classList.remove('drill-head');
    if (head) {
      head.classList.add('drill-head');
      this.options.dataset.drill = 'true';
    } else if (this.options.dataset.drill) delete this.options.dataset.drill;
  }

  private render(): void {
    queueMicrotask(() => this.syncDrill());
    const m = this.mode;
    // Picking something on the map opens a folded sheet to show it.
    if (m) this.setFolded(false);
    this.column.dataset.mode = m ? m.kind : 'idle';
    if (m?.kind !== 'person') delete this.column.dataset.role;
    if (m?.kind !== 'location') delete this.column.dataset.status;
    this.idle.hidden = m !== null;
    (this.speaker.parentElement as HTMLElement).hidden = m === null;
    this.aside.hidden = m?.kind !== 'person';
    this.buildingView.hidden = m?.kind !== 'building';
    this.locationView.hidden = m?.kind !== 'location';
    this.personNote.hidden = m?.kind !== 'person';
    if (m?.kind !== 'person') this.profileView.hidden = true;
    else this.profileView.hidden = !this.profileView.dataset.key;
    const open = this.servicesOpen;
    this.focusOpt.hidden = m === null || open || m.kind !== 'person';
    if (m?.kind !== 'building') for (const o of this.buildingOpts) o.li.hidden = true;
    if (m?.kind !== 'location') {
      for (const action of ACTIONS) this.actionOpts[action].li.hidden = true;
      for (const o of this.spotOpts) o.li.hidden = true;
      for (const o of this.pathOpts) o.li.hidden = true;
      for (const r of this.mixRows) r.li.hidden = true;
      this.staffGroupOpt.hidden = true;
    }
    else this.renderActions(this.lastSnapshot?.locations[m.id].actions);
    // Back to the overview: also a click elsewhere or Escape.
    this.leaveOpt.hidden = open || m === null;
    this.renameBtn.hidden = !m || (m.kind === 'building' && !this.renamable);
    // The services review is for when nothing is selected.
    this.reviewOpt.hidden = open || m !== null;
    this.aidOpt.hidden = open || m !== null || !this.lastSnapshot?.aid;
    this.driveOpt.hidden = open || m !== null || !this.lastSnapshot?.drive;
    this.configureOpt.hidden = open || m !== null;
    this.favourOpt.hidden = open || m !== null || !this.lastSnapshot?.favours;
    this.backOpt.hidden = !open;
    const own = m?.kind === 'location' ? serviceAt(m.id) : null;
    for (const id of SERVICE_IDS) this.switchOpts[id].hidden = !(open || id === own);
  }

  /** Opens or closes the services list; focus moves into or back out of it. */
  private setServicesOpen(open: boolean): void {
    this.servicesOpen = open;
    this.render();
    const target = open ? this.switches[SERVICE_IDS[0]] : this.reviewOpt.querySelector('button');
    target?.focus({ preventScroll: true });
  }

  private renderLocation(loc: LocationSnapshot, trend: MetricTrend): void {
    const chipKeys = loc.chips.map((c) => c.icon).join('|');
    if (chipKeys !== this.chipKeys) {
      this.chipKeys = chipKeys;
      this.chips.replaceChildren(...loc.chips.map((c) => {
        const li = el('li', 'chip');
        li.dataset.icon = c.icon;
        const icon = el('span', 'chip-icon');
        icon.innerHTML = CHIP_ICONS[c.icon];
        li.append(icon, el('span', 'chip-value'));
        return li;
      }));
    }
    loc.chips.forEach((c, i) => {
      const li = this.chips.children[i] as HTMLElement;
      setText(li.lastElementChild as HTMLElement, c.value);
      if (li.title !== c.label) li.title = c.label;
      setAttr(li, 'aria-label', c.label);
    });
    // Rebuild the fact rows only when their set changes; otherwise update text in place.
    const keys = loc.facts.map(([k]) => k).join('|');
    if (keys !== this.factKeys) {
      this.factKeys = keys;
      this.facts.replaceChildren(...loc.facts.map(([k]) => {
        const row = el('div', 'fact');
        row.append(el('dt', undefined, k), el('dd'));
        return row;
      }));
    }
    loc.facts.forEach(([k, v], i) => {
      const dd = this.facts.children[i].lastElementChild as HTMLElement;
      setText(dd, v);
      // The reason a place is shut by law stands out in red.
      const alert = String(!!loc.blockedByLaw && k === t('Closed'));
      if (dd.dataset.alert !== alert) dd.dataset.alert = alert;
    });
    setText(this.metricsLabel, loc.metricsLabel);
    let peak = 1;
    for (const k of METRIC_KEYS) for (const v of trend.values(k)) peak = Math.max(peak, v);
    for (const k of METRIC_KEYS) {
      const row = this.metrics[k];
      setText(row.value, String(loc.metrics[k]));
      setAttr(row.line, 'points', sparkPoints(trend.values(k), SPARK_W, SPARK_H, peak));
    }
  }
}

const ACTIONS: readonly PlaceAction[] = ['moreStaff', 'hire', 'volunteer', 'camper', 'moreWaiting', 'move', 'path', 'mix', 'hustle', 'invest', 'donations', 'relaunch'];
/** Most camper spots the replies offer. */
const MAX_SPOTS = 6;
/** The most activities any place offers. */
const MIX_SLOTS = 5;
/** Actions nested under the Staffing reply. */
const STAFF_ACTIONS: readonly PlaceAction[] = ['moreStaff', 'hire', 'volunteer', 'camper'];
const ACTION_SHORT: Record<PlaceAction, string> = { moreStaff: t('More staff.'), moreWaiting: t('More places.'), hire: t('Hire.'), volunteer: t('Volunteer.'), camper: t('Another camper.'), move: t('Move it.'), path: t('Specialise.'), mix: t('Budget mix.'), hustle: t('Side income.'), invest: t('Invest.'), donations: t('Donations.'), relaunch: t('Relaunch.') };
/** Costs shown on the replies; the organisation charges the same (config/organisation.ts). */
const ACTION_COST = { hire: RECRUIT.hirePaid.cost, volunteer: RECRUIT.volunteerDrive.cost, relaunch: ORG.reopen.cost };
