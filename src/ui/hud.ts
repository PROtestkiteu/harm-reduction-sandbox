import { PersonSupportView, type StaffingAdvice } from './personSupport';
import { cameraArea } from './cameraArea';
import type { TutorialCapabilities } from '../game/tutorial';
import './tutorialGuide.css';
import type { GuideAct, GuideStep } from '../game/guide';
import { CAMPER_PATH, CAMPER_PATH_IDS, type CamperPath } from '../config/camperPaths';
import { MOOD_HUES } from '../agents/moodIcons';
import { ACTIVITY, type Activity } from '../config/serviceMix';
import './venueStatus.css';
import type { VenueStatus } from './venueStatus';
import { VENUE_ICONS } from './venueIndicators';
import type { FavourId } from '../config/favours';
import { ORG, RECRUIT, recruitChance } from '../config/organisation';
import { ACTIVITY_NEEDS, AID_NEEDS, PATH_NEEDS, serviceNeeds, type Need } from '../config/needs';
import { METER_ORDER, NEED_NAME, NEED_HINT, NEED_ICONS, meterState, needTag, needsFor, setNeeds } from './needIcons';
import { price } from './money';
import type { ServiceStage } from '../config/serviceStages';
import { SERVICE_TEXT } from '../config/places';
import type { Insets } from '../render/camera';
import { LOCATION_IDS, SERVICE_IDS, serviceAt, type LocationId, type ServiceId, type ServiceStatus } from '../sim/types';
import type { PersonCard } from './personInfo';
import { NAME_MAX } from './names';
import { METRIC_KEYS, MetricTrend, sparkPoints, TREND_BUCKET_MINUTES, TREND_BUCKETS, type MetricKey } from './trends';
import { LOCALE, plural, t } from '../i18n';

export interface HudCallbacks {
  onSpeed(speed: number): void;
  onService(id: ServiceId, on: boolean): void;
  /** A location label was activated; `null` closes the selection. */
  onSelect(id: LocationId | null): void;
  onResetView(): void;
  /** Zoom onto the selection, or back out; follow or unfollow a person. */
  onToggleFocus(): void;
  /** Go from a selected person to the place they belong to. */
  onPersonPlace(): void;
  /** Something to do at the selected place: applied between simulation steps. */
  onAction(service: ServiceId, action: PlaceAction): void;
  /** Open the welcome box again. */
  onHelp(): void;
  /** Give the selected place or building a new display name (empty: back to its own). */
  onRename(name: string): void;
  /** One of the selected building's own actions (rent it, give it back). */
  onBuildingAction(action: string): void;
  /** The game's title was pressed: open the settings. */
  onTitle(): void;
  /** The money figure was pressed: open the organisation and budget page. */
  onMoney(): void;
  onFavours(): void;
  /** Send a camper to the kerb nearest the selected person. */
  onPersonCamper(): void;
  onPersonTeam(): void;
  /** Changes how much a place spends on one activity. */
  /** One activity's share of the place's visits, in percent; the others keep their proportions. */
  onMix(service: ServiceId, activity: Activity, percent: number): void;
  /** Pays a place's one-off set-up for an activity. */
  onMixSetUp(service: ServiceId, activity: Activity): void;
  /** Specialise the outreach camper (or change its path). */
  onCamperPath(path: CamperPath): void;
  /** Start or stop this season's aid: the warming bus, or water and shade. */
  onAid(kind: 'cold' | 'heat'): void;
  /** The coordinator's next step was chosen (the services list opens here; the rest is the app's). */
  onGuide(act: GuideAct): void;
}

/** What can be done at a place, free or paid from the organisation's budget. */
export type PlaceAction = 'moreStaff' | 'hire' | 'volunteer' | 'relaunch' | 'camper' | 'move' | 'path' | 'mix' | 'hustle' | 'invest' | `camper:${number}`;

/** The selected place's levers, for its action replies. */
/** One activity in a place's budget mix. */
export interface MixItem {
  id: Activity;
  label: string;
  does: string;
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
  closedDown: boolean;
  reopening: boolean;
  budget: number;
  /** Why it is closed now, if it is: decides which replies can still help. */
  closedReason?: string | null;
  /** Investing: cost, level and progress. */
  invest: { cost: number; level: number; progress: number; max: number; stage: string; next: ServiceStage | null };
  /** A side income this place can bring in (the club's fee for the stand, sold checks), on or off. */
  /** Side income here: what it is now, in full and short (all a phone shows), and whether it can be pressed. */
  hustle?: { label: string; short: string; hint: string; on: boolean; enabled: boolean };
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
  venue?: VenueStatus;
  /** When closed: why, in two words, and whether it lasts until the player acts (switched off, shut down). */
  closed?: { text: string; lasting: boolean; ownChoice?: boolean };
  /** Counts as icon chips: `value` on screen, `label` the full sentence (tooltip and screen readers). */
  chips: { icon: ChipIcon; value: string; label: string }[];
  /** Things worth a sentence (why it is closed). */
  facts: [string, string][];
  metrics: { demand: number; attended: number; unmetNeed: number; adverse: number };
  metricsLabel: string;
  actions?: PlaceLevers;
  /** Closed by law, council or venue rules (not by anything the player runs): shown in red. */
  blockedByLaw?: boolean;
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
  favours?: { held: number; owed: boolean; items: { id: FavourId; label: string; short: string }[] };
  /** In winter (or on a cold night) the warming bus, in summer water and shade: on or off, and the running cost. */
  aid?: { kind: 'cold' | 'heat'; on: boolean; perHour: number };
}

/** A place's status in a word or two; closed says for now or for good. */
const statusText = (loc: LocationSnapshot) => loc.closed?.text ?? STATUS_TEXT[loc.status];

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
/** A meter change this big in one refresh (a quarter second) is shown as a jump; slower drift is not. */
const METER_JUMP = 0.015;
const SPARK_W = 56;
const SPARK_H = 14;
const SVG_NS = 'http://www.w3.org/2000/svg';
const NARROW = '(max-width: 760px)';
/** Phones either way up: narrow, or a short landscape screen. */
export const COMPACT = '(max-width: 760px), (max-height: 520px)';
/** Wide, tall screens: the column becomes framed windows over the map (see style.css). */
const WINDOWED = '(min-width: 761px) and (min-height: 521px)';


/** A place's counts as icons: people being helped, people waiting, staff, people who turned back, the venue's crowd, the door. */
export type ChipIcon = 'inside' | 'queue' | 'staff' | 'back' | 'venue' | 'door' | 'safety' | 'litter' | 'seen' | 'shops' | 'reputation' | 'rough';
/** How a chip's value reads: coloured as the meters at the top colour good, middling and bad. */
export type ChipState = 'good' | 'mid' | 'bad';
const CHIP_ICONS: Record<ChipIcon, string> = {
  inside: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5.5 2.5a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zm5.5 1a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM1 13.5c0-2.9 2-4.8 4.5-4.8S10 10.6 10 13.5zm10-.1c0-1.4-.4-2.6-1.1-3.6.4-.1.7-.2 1.1-.2 2.2 0 4 1.6 4 3.8z"/></svg>',
  queue: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 1.5h8v1.5h-1v1.6c0 1.4-.8 2.5-2 3.4 1.2.9 2 2 2 3.4V13h1v1.5H4V13h1v-1.6c0-1.4.8-2.5 2-3.4-1.2-.9-2-2-2-3.4V3H4zm2.5 1.5v1.6c0 .9.6 1.7 1.5 2.4.9-.7 1.5-1.5 1.5-2.4V3z"/></svg>',
  staff: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.5a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2zM2.5 14.5c0-3.2 2.4-5.6 5.5-5.6s5.5 2.4 5.5 5.6zm4.8-4v1.3H6v1.4h1.3v1.3h1.4v-1.3H10v-1.4H8.7v-1.3z"/></svg>',
  back: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M6 2L1.5 6 6 10V7.5h4a2.5 2.5 0 0 1 0 5H6V14h4a4 4 0 0 0 0-8H6z"/></svg>',
  venue: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M13.5 1.5v9.2a2.3 2.3 0 1 1-1.5-2.1V4.6L6.5 5.9v6.8a2.3 2.3 0 1 1-1.5-2.1V3.3z"/></svg>',
  door: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M3 1.5h8.5V14.5H13V16H1.5v-1.5H3zm6.2 6a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z"/></svg>',
  // The neighbourhood around a block: safe at home, discarded kit, use in view, shops, the services' name, sleeping rough.
  safety: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1 1.5 6.5V15H6v-4h4v4h4.5V6.5z"/></svg>',
  litter: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M12.6 1.3l2.1 2.1-1 1-.7-.7-1.4 1.4 1.4 1.4-1 1-.7-.7-5.6 5.6H3.6l-1.9 1.9-.7-.7 1.9-1.9v-2.1l5.6-5.6-.7-.7 1-1 1.4 1.4 1.4-1.4-.7-.7z"/></svg>',
  seen: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 3C4.4 3 1.7 5.4.5 8c1.2 2.6 3.9 5 7.5 5s6.3-2.4 7.5-5C14.3 5.4 11.6 3 8 3zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zM8 6.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"/></svg>',
  shops: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 1.5h12l1.5 4c0 1.2-.9 2-2 2s-2-.8-2-2c0 1.2-.9 2-2 2s-2-.8-2-2c0 1.2-.9 2-2 2s-2-.8-2-2c0 1.2-.9 2-2 2s-1.5-.8-1.5-2zM2.5 8.6c.8.3 1.6.2 2.3-.2.6.4 1.3.6 2 .6V14.5H2.5zm5.8.4c.7 0 1.4-.2 2-.6.6.4 1.4.6 2.2.6.4 0 .7 0 1-.1v5.6H8.3z"/></svg>',
  reputation: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.2l2.1 4.3 4.7.7-3.4 3.3.8 4.7L8 12l-4.2 2.2.8-4.7L1.2 6.2l4.7-.7z"/></svg>',
  rough: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M1 9.5c0-1.4 1.1-2.5 2.5-2.5h9C13.9 7 15 8.1 15 9.5V13H1zM4 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM1 13.5h14V15H1z"/></svg>',
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

/** Sending a camper to a selected person: what the reply says, whether it can be pressed, and why. */
export interface PersonCamperOffer { label: string; hint: string; enabled: boolean }

/** An ordinary building's card: what it is, and figures for it and the neighbourhood. */
export interface BuildingCard {
  title: string;
  said: string;
  facts: [string, string][];
  /** The neighbourhood's measures as icon chips: `value` on screen, `label` the full sentence. */
  chips?: { icon: ChipIcon; value: string; label: string; state?: ChipState }[];
  /** Things to do here (rent a closed shop, give it back). */
  /** `cost` and `detail` (when it costs money) feed the confirm box. */
  actions?: { id: string; label: string; short: string; enabled: boolean; helps?: readonly Need[]; cost?: number; detail?: string }[];
  /** False for things with no name of their own to change (a passing police car). */
  renamable?: boolean;
}

const BUILDING_SLOTS = 6;

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
  /** With nothing selected the organisation speaks: its name and your next step. */
  private guide: { who: string; step: GuideStep } | null = null;
  private readonly guideOpt: HTMLElement;
  private readonly guideLong: HTMLElement;
  private readonly guideShort: HTMLElement;
  private readonly orgOpt: HTMLElement;
  private readonly speaker: HTMLElement;
  private readonly said: HTMLElement;
  private readonly aside: HTMLElement;
  private readonly locationView: HTMLElement;
  private readonly buildingView: HTMLElement;
  private readonly buildingChips: HTMLElement;
  private readonly facts: HTMLElement;
  private readonly investment = el('div', 'venue-investment');
  private readonly investmentText = el('p');
  private readonly investmentProgress = el('progress');
  private readonly chips: HTMLElement;
  private chipKeys = '';
  private readonly metricsLabel: HTMLElement;
  private readonly metrics = {} as Record<MetricKey, MetricRow>;
  private readonly personNote: HTMLElement;
  private readonly profileView: HTMLElement;
  private readonly personSupportView: PersonSupportView;
  private readonly selectionWindow: HTMLElement;
  private folded = false;
  private headerBottom = 0;
  /** Building work under way: a slim strip at the foot of the panel (no bar to press; pausing is on the speed toggle). */
  private readonly works: HTMLElement;
  private paused = false;
  /** One row per thing under way: text and a bar each, reused as the list changes. */
  private readonly workRows: { root: HTMLElement; text: HTMLElement; fill: HTMLElement }[] = [];
  private readonly speedBtn: HTMLButtonElement;
  private readonly money: HTMLElement;
  private readonly moneyButton: HTMLButtonElement;
  /** City hall favours held, beside the money: a small icon and the count. */
  private readonly favourCount: HTMLButtonElement;
  private readonly favourNum: HTMLElement;
  private readonly unmet: HTMLElement;
  private readonly crisisLine: HTMLElement;
  private readonly stressRow: HTMLElement;
  private readonly stressFill = {} as Record<'police' | 'medics' | 'sobering' | 'district', HTMLElement>;
  private readonly stressMeters = {} as Record<'police' | 'medics' | 'sobering' | 'district', HTMLElement>;
  /** Each meter's value at the last refresh, and its floating change figure (made on the first jump). */
  private readonly lastStress: Partial<Record<'police' | 'medics' | 'sobering' | 'district', number>> = {};
  private readonly stressDelta: Partial<Record<'police' | 'medics' | 'sobering' | 'district', { el: HTMLElement; sum: number; at: number }>> = {};
  private speed: number = SPEEDS[0];
  private readonly switches = {} as Record<ServiceId, HTMLButtonElement>;
  private readonly switchState = {} as Record<ServiceId, HTMLElement>;
  /** On a place's own card the row is one reply: Close down or Open up. */
  private readonly ownAct = {} as Record<ServiceId, HTMLElement>;
  private readonly switchOpts = {} as Record<ServiceId, HTMLElement>;
  private readonly reviewOpt: HTMLElement;
  private readonly aidOpt: HTMLElement;
  private readonly aidBtn: HTMLButtonElement;
  private readonly staffGroupNeeds: HTMLElement;
  private readonly aidLong: HTMLElement;
  private readonly aidShort: HTMLElement;
  private readonly reviewName: HTMLElement;
  private readonly reviewShort: HTMLElement;
  private readonly backOpt: HTMLElement;
  private servicesOpen = false;
  private readonly focusOpt: HTMLElement;
  private readonly personCamperOpt: HTMLElement;
  private readonly personCamperBtn: HTMLButtonElement;
  private readonly personCamperLong: HTMLElement;
  /** The camper offer for the selected person, kept so the reply can show while their card does. */
  private personCamper: PersonCamperOffer | null = null;
  /** The selected person's place, for the Go to reply; null when they have none. */
  private personPlace: string | null = null;
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
  private readonly mixRows: { li: HTMLLIElement; label: HTMLLabelElement; labelText: HTMLElement; labelNeeds: HTMLElement; input: HTMLInputElement; out: HTMLOutputElement; note: HTMLElement; setup: HTMLButtonElement; setupLabel: HTMLElement; setupNeeds: HTMLElement; id: Activity | null; editingUntil: number }[] = [];
  private readonly spotOpts: { li: HTMLLIElement; button: HTMLButtonElement; long: HTMLElement; short: HTMLElement }[] = [];
  private readonly actionOpts = {} as Record<PlaceAction, { li: HTMLLIElement; button: HTMLButtonElement; label: HTMLElement; short: HTMLElement; needs: HTMLElement }>;
  private readonly focusBtn: HTMLButtonElement;
  private readonly focusLong: HTMLElement;
  private readonly focusShort: HTMLElement;
  private readonly leaveOpt: HTMLElement;
  private readonly renameAction: () => void;
  /** Whether the open building card's subject can be renamed. */
  private renamable = true;
  private renameInput: HTMLInputElement | null = null;
  private readonly buildingOpts: { li: HTMLLIElement; button: HTMLButtonElement; long: HTMLElement; short: HTMLElement; needs: HTMLElement; id: string }[] = [];
  private readonly resetOpt: HTMLElement;
  private readonly labels = {} as Record<LocationId, HTMLButtonElement>;
  private readonly labelWidths = {} as Record<LocationId, number>;
  private readonly trends = {} as Record<LocationId, MetricTrend>;
  private labelPoints: Record<LocationId, { x: number; y: number; below?: boolean }> | null = null;
  private mode: Mode = null;
  private lastSnapshot: HudSnapshot | null = null;
  private factKeys = '';

  constructor(root: HTMLElement, cb: HudCallbacks) {
    this.root = root;
    this.renameAction = () => { if (this.canRename()) this.startRename(cb); };
    for (const id of LOCATION_IDS) this.trends[id] = new MetricTrend();

    this.header = el('header', 'hud-header');
    // "How it works" lives in the Settings menu.
    const subtitle = el('p', 'subtitle', t('Help people stay alive without going bankrupt.'));
    // The title opens the settings, like the Settings link under it.
    const titleBtn = button('hud-title', t('Harm reduction project'));
    titleBtn.dataset.iconHint = t('Change the night, the street and the services');
    titleBtn.addEventListener('click', () => cb.onTitle());
    const h1 = el('h1');
    h1.append(titleBtn);
    this.header.append(h1, subtitle);

    this.column = el('aside', 'column');
    this.column.setAttribute('aria-label', t('Details and controls'));
    const top = el('div', 'column-top');
    this.clock = el('span', 'clock', '19:40');
    this.clock.setAttribute('aria-label', t('Scene clock'));
    // One toggle beside the clock steps through the speeds.
    // One toggle steps 1x, 4x, 16x, then pause (0), then 1x again; Space pauses too.
    this.speedBtn = button('speed-toggle', '1x');
    this.speedBtn.addEventListener('click', () => cb.onSpeed(this.paused ? SPEEDS[0] : this.speed === SPEEDS[SPEEDS.length - 1] ? 0 : SPEEDS[SPEEDS.indexOf(this.speed as (typeof SPEEDS)[number]) + 1]));
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
    // Pressing the money opens the organisation and budget page; the figure inside stays a live status.
    const moneyBtn = this.moneyButton = button('money-btn');
    moneyBtn.dataset.iconHint = t('Organisation: money and staff.');
    moneyBtn.addEventListener('click', () => cb.onMoney());
    moneyBtn.append(this.money);
    // Favours with city hall beside the money: pressing it opens the favours on offer.
    this.favourCount = button('favour-count');
    const hall = el('span', 'favour-icon');
    hall.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 1 1 4.5V6h14V4.5zM2.5 7h2v5.5h-2zm4.5 0h2v5.5H7zm4.5 0h2v5.5h-2zM1 13.5h14V15H1z"/></svg>';
    this.favourNum = el('span', 'favour-num', '0');
    this.favourCount.append(hall, this.favourNum);
    // The favours are listed in the organisation sheet: pressing the count opens it there.
    this.favourCount.addEventListener('click', () => cb.onFavours());
    right.append(moneyBtn, this.favourCount);
    top.append(time, right);
    this.eventsSlot = el('div', 'column-events');

    // The conversation: who or what is selected, speaking in plain sentences.
    this.log = el('div', 'log');
    this.log.setAttribute('aria-live', 'polite');
    this.idle = el('p', 'idle', t('Or pick a place or a person on the map.'));
    const line = el('p', 'line');
    this.speaker = button('speaker selection-heading');
    this.speaker.setAttribute('aria-expanded', 'true');
    this.speaker.dataset.iconHint = t('Fold the panel away');
    this.speaker.addEventListener('click', () => this.setFolded(!this.folded));
    this.said = el('span', 'said');
    line.append(this.speaker, this.said);
    this.aside = el('p', 'aside');
    this.locationView = el('div', 'location-view');
    this.chips = el('ul', 'chips');
    this.chips.setAttribute('role', 'list');
    this.facts = el('dl', 'facts place-facts');
    this.investmentProgress.max = 1;
    this.investment.append(this.investmentText, this.investmentProgress);
    this.investment.hidden = true;
    this.metricsLabel = el('p', 'check');
    const metrics = el('dl', 'metrics');
    metrics.dataset.tutorialFeature = 'maintenance';
    this.metricsLabel.dataset.tutorialFeature = 'maintenance';
    for (const key of METRIC_KEYS) {
      const row = el('div', `metric metric-${key}`);
      row.dataset.iconHint = METRIC_LABELS[key].hint;
      row.tabIndex = 0;
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
      this.investment,
      this.metricsLabel,
      metrics,
      el('p', 'note metrics-note', t('Lines: last {min} min. Illustrative counts.', { min: TREND_BUCKET_MINUTES * TREND_BUCKETS })),
    );
    this.locationView.querySelector<HTMLElement>('.metrics-note')!.dataset.tutorialFeature = 'maintenance';
    this.personSupportView = new PersonSupportView(() => cb.onPersonTeam());
    this.profileView = el('div', 'profile');
    this.personNote = el('p', 'note', t('People here are archetypes drawn from research on people who use drugs. Each figure is illustrative, not a real person.'));
    this.buildingView = el('dl', 'facts building-facts');
    this.buildingChips = el('ul', 'chips building-chips');
    this.buildingChips.setAttribute('role', 'list');
    this.log.append(line, this.idle, this.aside, this.locationView, this.buildingChips, this.buildingView, this.personSupportView.root, this.profileView, this.personNote);

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
    // On a person's card: go to their place (a selected person is always followed).
    this.focusBtn.addEventListener('click', () => cb.onPersonPlace());
    this.focusOpt = opt(this.focusBtn);
    // For someone a camper could help: send one to the kerb nearest them.
    this.personCamperBtn = button('opt');
    this.personCamperLong = el('span', 'long');
    const camperShort = el('span', 'short', t('Send camper.'));
    camperShort.setAttribute('aria-hidden', 'true');
    this.personCamperBtn.append(this.personCamperLong, camperShort);
    this.personCamperBtn.addEventListener('click', () => cb.onPersonCamper());
    this.personCamperOpt = opt(this.personCamperBtn);
    this.personCamperOpt.hidden = true;
    // Staffing actions fold under one reply, so the list stays short.
    this.staffGroupBtn = button('opt group');
    this.staffGroupLong = el('span', 'long');
    const groupShort = el('span', 'short', t('Staff and hiring.'));
    groupShort.setAttribute('aria-hidden', 'true');
    this.staffGroupNeeds = needTag();
    this.staffGroupBtn.append(this.staffGroupLong, groupShort, this.staffGroupNeeds);
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
      const needs = needTag();
      b.append(long, short, needs);
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
      this.actionOpts[action] = { li: opt(b), button: b, label: long, short, needs };
      this.actionOpts[action].li.dataset.tutorialFeature = STAFF_ACTIONS.includes(action) ? 'staff' : action === 'invest' || action === 'relaunch' ? 'maintenance' : action === 'mix' ? 'stress' : 'organisation';
      if (STAFF_ACTIONS.includes(action)) this.actionOpts[action].li.classList.add('nested');
    }
    // The selected building's own actions, filled per card.
    for (let i = 0; i < BUILDING_SLOTS; i++) {
      const b = button('opt');
      const long = el('span', 'long');
      const short = el('span', 'short');
      short.setAttribute('aria-hidden', 'true');
      const needs = needTag();
      b.append(long, short, needs);
      const slot = { li: opt(b), button: b, long, short, needs, id: '' };
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
      b.append(long, short, needsFor(PATH_NEEDS[id]));
      b.dataset.iconHint = CAMPER_PATH[id].does;
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
      // The activity's name, then the needs it eases.
      const labelText = el('span');
      const labelNeeds = needTag();
      label.append(labelText, labelNeeds);
      const out = el('output');
      out.htmlFor.add(inputId);
      const input = el('input');
      input.type = 'range';
      input.id = inputId;
      input.min = '0';
      // Percent of the visits: moving one share moves the others, so the mix stays at 100%.
      input.max = '100';
      input.step = '5';
      const note = el('span', 'mix-note');
      const setup = button('opt mix-setup');
      setup.hidden = true;
      const setupLabel = el('span');
      const setupNeeds = needTag();
      setup.append(setupLabel, setupNeeds);
      const row = { li, label, labelText, labelNeeds, input, out, note, setup, setupLabel, setupNeeds, id: null as Activity | null, editingUntil: 0 };
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
    // Services sit behind one reply so the list stays short; the selected
    // place's own switch is offered directly.
    // Nothing selected: the coordinator's next step leads the replies, then the organisation itself.
    const guideBtn = button('opt guide-opt');
    this.guideLong = el('span', 'long');
    this.guideShort = el('span', 'short');
    this.guideShort.setAttribute('aria-hidden', 'true');
    guideBtn.append(this.guideLong, this.guideShort);
    guideBtn.addEventListener('click', () => {
      const act = this.guide?.step.act;
      if (!act) return;
      if (act.kind === 'services') this.setServicesOpen(true);
      else cb.onGuide(act);
    });
    this.guideOpt = opt(guideBtn);
    const orgBtn = button('opt');
    const orgShort = el('span', 'short', t('My organisation.'));
    orgShort.setAttribute('aria-hidden', 'true');
    orgBtn.append(el('span', 'long', t('My organisation: team, money and grants.')), orgShort);
    orgBtn.addEventListener('click', () => cb.onMoney());
    this.orgOpt = opt(orgBtn);
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
    this.aidShort = el('span', 'short');
    this.aidShort.setAttribute('aria-hidden', 'true');
    this.aidBtn.append(this.aidLong, this.aidShort, needsFor(AID_NEEDS));
    this.aidBtn.addEventListener('click', () => { const k = this.lastSnapshot?.aid?.kind; if (k) cb.onAid(k); });
    this.aidOpt = opt(this.aidBtn);

    const back = button('opt', t('Back.'));
    back.addEventListener('click', () => this.setServicesOpen(false));
    this.backOpt = opt(back);
    this.backOpt.classList.add('zero');
    for (const id of SERVICE_IDS) {
      // In the services list the name picks the place (the camera goes there). On the place's own card,
      // where it is already picked, the name switches the service on or off like the ON/OFF button.
      const b = button('opt switch');
      b.dataset.service = id;
      const name = el('span', 'name');
      const short = el('span', 'short', SERVICE_TEXT[id].short);
      short.setAttribute('aria-hidden', 'true');
      name.append(el('span', 'long', SERVICE_TEXT[id].label), short);
      const own = el('span', 'own-act');
      this.ownAct[id] = own;
      b.append(name, own);
      b.addEventListener('click', () => {
        if (!this.servicesOpen && this.mode?.kind === 'location' && serviceAt(this.mode.id) === id) {
          cb.onService(id, this.switches[id].getAttribute('aria-checked') !== 'true');
          return;
        }
        this.servicesOpen = false;
        cb.onSelect(id === 'clubHr' ? 'club' : id);
      });
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
    const resetShort = el('span', 'short', t('Back to the overview.'));
    resetShort.setAttribute('aria-hidden', 'true');
    reset.append(el('span', 'long', t('Back to the overview.')), resetShort);
    reset.setAttribute('aria-label', t('Back to the overview'));
    reset.dataset.iconHint = t('R. Right-drag or two-finger drag to orbit.');
    reset.addEventListener('click', () => cb.onResetView());
    this.resetOpt = opt(reset);
    this.resetOpt.hidden = true;

    this.works = el('div', 'works-bar');
    this.works.setAttribute('role', 'status');
    this.works.hidden = true;


    // City services under pressure: three small meters under the top line.
    // The meters sit in their own size container, so their grid follows the room they have.
    this.stressRow = el('div', 'stress-wrap');
    const meters = el('div', 'stress-row');
    meters.setAttribute('role', 'group');
    meters.setAttribute('aria-label', t('City services under pressure'));
    this.stressRow.append(meters);
    for (const key of METER_ORDER) {
      const name = NEED_NAME[key], hint = NEED_HINT[key];
      const m = el('span', 'stress');
      m.dataset.key = key;
      m.dataset.iconHint = `${name}: ${hint}`;
      m.setAttribute('aria-label', name);
      const bar = el('span', 'stress-bar');
      const fill = el('span', 'stress-fill');
      bar.append(fill);
      // An icon per service, coloured by how stretched it is; the name is in the tooltip.
      const icon = el('span', 'stress-icon');
      icon.innerHTML = NEED_ICONS[key];
      m.append(icon, el('span', 'stress-name', name), bar);
      this.stressMeters[key] = m;
      meters.append(m);
      this.stressFill[key] = fill;
    }
    // Two groups that wide screens frame as windows of their own (elsewhere they lay out as before):
    // the overview (tonight's goals, the news, the event feed) and the selection with its replies.
    const outliner = el('div', 'outliner');
    outliner.dataset.tutorialFeature = 'organisation';
    outliner.append(this.eventsSlot);
    const selection = this.selectionWindow = el('div', 'window');
    selection.id = 'selection-details';
    selection.append(this.log, this.options, this.works);
    this.column.append(top, this.stressRow, this.unmet, outliner, selection);
    // Phones and wide screens: the clock, money and meters live in a block at the top of the screen
    // (wide screens add the crisis line to it); the column keeps the rest. Phones on their side keep
    // everything in the side column.
    this.topBar = el('div', 'top-bar');
    const placeIndicators = () => {
      if (window.matchMedia(NARROW).matches) {
        if (top.parentElement !== this.topBar) this.topBar.append(top, this.stressRow);
        if (this.unmet.parentElement !== this.column) outliner.before(this.unmet);
      } else if (window.matchMedia(WINDOWED).matches) {
        if (this.unmet.parentElement !== this.topBar) this.topBar.append(top, this.stressRow, this.unmet);
      } else if (top.parentElement !== this.column) {
        this.column.prepend(top, this.stressRow, this.unmet);
      }
      this.invalidateLayout();
    };
    placeIndicators();
    window.matchMedia(NARROW).addEventListener('change', placeIndicators);
    window.matchMedia(WINDOWED).addEventListener('change', placeIndicators);
    // The top block's height, so the windows below it start just under it.
    new ResizeObserver(() => {
      const h = `${Math.round(this.topBar.offsetHeight)}px`;
      if (this.root.style.getPropertyValue('--topbar-h') !== h) this.root.style.setProperty('--topbar-h', h);
    }).observe(this.topBar);
    // The sheet's height, for what sits just above it on phones (the portrait): measured as it folds and opens.
    new ResizeObserver(() => {
      const h = `${Math.round(this.column.offsetHeight)}px`;
      if (this.root.style.getPropertyValue('--sheet-h') !== h) this.root.style.setProperty('--sheet-h', h);
    }).observe(this.column);

    const labelLayer = el('div', 'labels');
    for (const id of LOCATION_IDS) {
      const b = button('loc-label');
      b.dataset.location = id;
      const cue = el('span', 'venue-cue');
      cue.setAttribute('aria-hidden', 'true');
      cue.hidden = true;
      cue.append(el('span', 'venue-cue-icon'), el('span', 'venue-cue-count'));
      b.append(cue, el('span', 'loc-name'));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        cb.onSelect(this.mode?.kind === 'location' && this.mode.id === id ? null : id);
      });
      this.labels[id] = b;
      this.labelWidths[id] = 0;
      labelLayer.append(b);
    }

    this.staffGroupOpt.dataset.tutorialFeature = 'staff';
    this.personCamperOpt.dataset.tutorialFeature = 'organisation';
    for (const option of this.buildingOpts) option.li.dataset.tutorialFeature = 'organisation';
    this.orgOpt.dataset.tutorialFeature = 'organisation';
    this.aidOpt.dataset.tutorialFeature = 'organisation';
    this.favourCount.dataset.tutorialFeature = 'organisation';
    this.unmet.dataset.tutorialFeature = 'maintenance';
    this.stressRow.dataset.tutorialFeature = 'stress';
    this.eventsSlot.dataset.tutorialFeature = 'organisation';
    moneyBtn.dataset.tutorialFeature = 'budget';
    this.guideOpt.dataset.tutorialFeature = 'fullUi';
    this.facts.dataset.tutorialFeature = 'maintenance';
    this.chips.dataset.tutorialFeature = 'maintenance';
    for (const id of SERVICE_IDS) this.switchOpts[id].dataset.tutorialService = id;
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
    const visible = [...this.options.children].filter((li) => !(li as HTMLElement).hidden && (li as HTMLElement).getClientRects().length > 0);
    // 0 is Back; the numbers count the other replies.
    const li = e.key === '0' ? visible.find((v) => v.classList.contains('zero')) : visible.filter((v) => !v.classList.contains('zero'))[Number(e.key) - 1];
    const target = li?.querySelector<HTMLButtonElement>('button.opt') ?? null;
    if (!target) return;
    e.preventDefault();
    target.click();
  }

  /**
   * Floats "+4%" or "−3%" over a meter that jumped, green when it is good news
   * (the district up, a service's pressure down) and red when not, and flashes
   * its bar. Jumps close together add up in one figure. Reduced motion: the
   * figure fades in place.
   */
  private meterJump(key: 'police' | 'medics' | 'sobering' | 'district', d: number): void {
    const now = performance.now();
    let f = this.stressDelta[key];
    if (!f) {
      f = { el: el('span', 'meter-delta'), sum: 0, at: 0 };
      f.el.setAttribute('aria-hidden', 'true');
      this.stressMeters[key].append(f.el);
      this.stressDelta[key] = f;
    }
    f.sum = now - f.at < 1500 ? f.sum + d : d;
    f.at = now;
    const pct = Math.round(Math.abs(f.sum) * 100);
    if (pct < 1) return;
    f.el.textContent = `${f.sum > 0 ? '+' : '\u2212'}${pct}%`;
    f.el.dataset.good = String(key === 'district' ? f.sum > 0 : f.sum < 0);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    f.el.animate(still
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }]
      : [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)', offset: 0.12 }, { opacity: 1, offset: 0.6 }, { opacity: 0, transform: 'translateY(-10px)' }],
    { duration: 1800, easing: 'ease-out', fill: 'forwards' });
    this.stressFill[key].animate([{ filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }], { duration: still ? 1 : 700, easing: 'ease-out' });
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.setSpeed(this.speed);
  }

  /** Building work under way, shown as a fill across the Pause bar. Empty hides it. */
  /**
   * What is under way, one row each with a bar: building works, people being
   * hired (until they start) and the foot patrol out on its round. Rows are
   * kept and reused; only text and bar width are written, and only on change.
   */
  setWorks(works: readonly { text: string; progress: number }[]): void {
    const on = works.length > 0;
    if (this.works.hidden === on) this.works.hidden = !on;
    while (this.workRows.length < works.length) {
      const root = el('div', 'works-row');
      const text = el('span', 'works-text');
      const track = el('span', 'works-track');
      const fill = el('span', 'works-fill');
      track.append(fill);
      root.append(text, track);
      this.works.append(root);
      this.workRows.push({ root, text, fill });
    }
    this.workRows.forEach((r, i) => {
      const w = works[i];
      if (r.root.hidden === !!w) r.root.hidden = !w;
      if (!w) return;
      setText(r.text, w.text);
      const tx = `scaleX(${Math.round(100 * Math.min(1, Math.max(0, w.progress))) / 100})`;
      if (r.fill.style.transform !== tx) r.fill.style.transform = tx;
    });
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    const p = this.paused;
    // Paused, the button draws two bars itself (style.css), centred in it whatever the font; the label says it.
    setText(this.speedBtn, p ? '' : `${speed}x`);
    const last = speed === SPEEDS[SPEEDS.length - 1];
    setAttr(this.speedBtn, 'aria-label', p
      ? t('Paused. Press to play at 1x (Space)')
      : last ? t('Speed {speed}x. Press to pause (Space)', { speed }) : t('Speed {speed}x. Switch to {next}x', { speed, next: SPEEDS[SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1] }));
    setAttr(this.speedBtn, 'aria-pressed', String(p));
    this.speedBtn.dataset.fast = String(!p && speed > 1);
    if (this.speedBtn.dataset.paused !== String(p)) this.speedBtn.dataset.paused = String(p);
  }

  /** Offers the overview option only while the camera is away from it. */
  setViewChanged(changed: boolean): void {
    // Zooming back out is the wheel, a pinch or Escape: no reply needed for it.
    void changed;
  }


  /** Shared domain capabilities govern presentation without fighting render-time hidden flags. */
  private tutorialCapabilities: TutorialCapabilities | null = null;

  setTutorialCapabilities(capabilities: TutorialCapabilities): void {
    if (this.tutorialCapabilities === capabilities) return;
    this.tutorialCapabilities = capabilities;
    this.root.dataset.tutorialRestricted = String(!capabilities.fullUi);
    if (this.moneyButton.disabled === capabilities.organisation) this.moneyButton.disabled = !capabilities.organisation;
    for (const feature of ['budget', 'staff', 'maintenance', 'stress', 'organisation', 'fullUi'] as const) {
      const value = String(capabilities[feature]);
      const key = `tutorial${feature[0].toUpperCase()}${feature.slice(1)}`;
      if (this.root.dataset[key] !== value) this.root.dataset[key] = value;
    }
    for (const id of LOCATION_IDS) {
      const available = capabilities.services.includes(serviceAt(id));
      this.labels[id].dataset.tutorialLocked = String(!available);
      this.switchOpts[serviceAt(id)].dataset.tutorialLocked = String(!available);
    }
  }

  /** Label button for a location, for keyboard focus moves. */
  labelFor(id: LocationId): HTMLButtonElement {
    return this.labels[id];
  }

  /**
   * The organisation, as the default selection: `who` speaks `step` whenever
   * nothing else is selected. Cheap to call every refresh: text is written only
   * when it changed.
   */
  setGuide(who: string, step: GuideStep): void {
    const before = this.guide?.step;
    this.guide = { who, step };
    if (this.mode !== null) return;
    if (!before || before.id !== step.id || !!before.act !== !!step.act) this.render();
    else this.showGuide();
  }

  private showGuide(): void {
    const g = this.guide;
    if (!g) return;
    const tut = g.step.tutorial;
    setText(this.speaker, tut ? t('{who}: first steps, {n} of {all}', { who: g.who, n: tut.n, all: tut.of }) : g.who);
    setText(this.said, g.step.said);
    const tutorial = String(!!tut);
    if (this.column.dataset.tutorial !== tutorial) this.column.dataset.tutorial = tutorial;
    // The control a walk-through step names is lit up (the money, the speed toggle).
    if (this.root.dataset.guide !== g.step.id) this.root.dataset.guide = g.step.id;
    const alert = String(!!g.step.urgent);
    if (this.said.dataset.alert !== alert) this.said.dataset.alert = alert;
    if (g.step.act) {
      setText(this.guideLong, g.step.act.label);
      setText(this.guideShort, g.step.act.short);
    }
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
      setNeeds(o.needs, a.helps);
      if (o.button.disabled === a.enabled) o.button.disabled = !a.enabled;
    });
    // Chips are rebuilt only when their set changes; values and colours update in place.
    const chips = card.chips ?? [];
    const chipKeys = chips.map((c) => c.icon).join('|');
    if (this.buildingChips.dataset.keys !== chipKeys) {
      this.buildingChips.dataset.keys = chipKeys;
      this.buildingChips.replaceChildren(...chips.map((c) => {
        const li = el('li', 'chip');
        li.dataset.icon = c.icon;
        li.tabIndex = 0;
        const icon = el('span', 'chip-icon');
        icon.innerHTML = CHIP_ICONS[c.icon];
        li.append(icon, el('span', 'chip-value'));
        return li;
      }));
    }
    if (this.buildingChips.hidden !== !chips.length) this.buildingChips.hidden = !chips.length;
    chips.forEach((c, i) => {
      const li = this.buildingChips.children[i] as HTMLElement;
      setText(li.lastElementChild as HTMLElement, c.value);
      if (li.dataset.iconHint !== c.label) li.dataset.iconHint = c.label;
      setAttr(li, 'aria-label', c.label);
      const state = c.state ?? '';
      if ((li.dataset.state ?? '') !== state) li.dataset.state = state;
    });
    const text = card.facts.map(([k, v]) => `${k}:${v}`).join('|');
    if (this.buildingView.dataset.text !== text) {
      this.buildingView.dataset.text = text;
      this.buildingView.replaceChildren(...card.facts.flatMap(([k, v]) => [el('dt', undefined, k), el('dd', undefined, v)]));
    }
  }

  /** Shows the person. `card` null means they have left the scene. */
  showPerson(card: PersonCard | null, following: boolean, lastTitle?: string, camper: PersonCamperOffer | null = null, place: string | null = null, staffing: StaffingAdvice | null = null): void {
    this.personCamper = card ? camper : null;
    if (this.personCamper) {
      setText(this.personCamperLong, this.personCamper.label);
      if (this.personCamperBtn.dataset.iconHint !== this.personCamper.hint) this.personCamperBtn.dataset.iconHint = this.personCamper.hint;
      if (this.personCamperBtn.disabled === this.personCamper.enabled) this.personCamperBtn.disabled = !this.personCamper.enabled;
    }
    if (this.mode?.kind !== 'person') {
      this.mode = { kind: 'person' };
      for (const l of LOCATION_IDS) setAttr(this.labels[l], 'aria-pressed', 'false');
      this.render();
    }
    const role = card ? card.role : 'left';
    if (this.column.dataset.role !== role) this.column.dataset.role = role;
    // Their name takes the hue of the glow around them on the map, while it shows.
    const mood = card?.mood ? `rgb(${MOOD_HUES[card.mood]})` : '';
    if (this.column.style.getPropertyValue('--mood') !== mood) {
      if (mood) this.column.style.setProperty('--mood', mood);
      else this.column.style.removeProperty('--mood');
    }
    if ((this.column.dataset.mood !== undefined) !== !!mood) {
      if (mood) this.column.dataset.mood = '';
      else delete this.column.dataset.mood;
    }
    setText(this.speaker, card?.title ?? lastTitle ?? t('Person'));
    setText(this.said, card ? `${card.activity}.` : t('Walked out of the scene.'));
    if (this.said.dataset.alert) delete this.said.dataset.alert;
    // The camera always follows a selected person; only say so when they are out of sight.
    const camera = card && following && !card.inView ? ' ' + t('Out of view inside; the camera waits.') : '';
    setText(this.aside, card ? `${card.subtitle}.${camera}` : t('The camera returns to the overview.'));
    this.personPlace = card ? place : null;
    if (place) {
      const text = t('Go to {place}.', { place });
      setText(this.focusLong, text);
      setText(this.focusShort, text);
      setAttr(this.focusBtn, 'aria-label', text);
    }
    this.focusOpt.hidden = !card || !place;
    this.personSupportView.set(card?.support, staffing, card?.worker);
    const pr = card?.profile;
    const key = pr?.name ?? '';
    if (this.profileView.dataset.key !== key) {
      this.profileView.dataset.key = key;
      this.profileView.hidden = !pr;
      if (pr) {
        const facts = el('dl', 'facts');
        facts.append(el('dt', undefined, t('Often uses')), el('dd', undefined, pr.uses), el('dt', undefined, t('Main risks')), el('dd', undefined, pr.risks));
        const reference = el('details', 'profile-reference');
        reference.append(el('summary', undefined, t('Research background')), el('p', 'note', t('An illustrative research pattern, not a diagnosis or this person’s biography.')), el('h3', 'profile-name', pr.name), el('p', 'profile-blurb', pr.blurb), facts, el('p', 'note', pr.source), this.personNote);
        this.profileView.replaceChildren(reference);
      } else this.profileView.replaceChildren();
    }
  }

  tooltipFor(id: LocationId, part?: 'stand'): { title: string; body: string; status: ServiceStatus } | null {
    const loc = this.lastSnapshot?.locations[id];
    if (!loc) return null;
    const status = statusText(loc);
    if (part === 'stand') return { title: loc.service, body: status, status: loc.status };
    return { title: loc.name, body: loc.venue?.message ?? status, status: loc.status };
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
      .filter((li): li is HTMLLIElement => li instanceof HTMLLIElement && !li.hidden && li.getClientRects().length > 0)
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
    if (this.canRename()) items.push({ label: t('Rename'), disabled: false, run: this.renameAction });
    if (opened) { this.staffOpen = false; this.renderActions(loc); }
    return { title: this.mode ? this.speaker.textContent ?? '' : t('The neighbourhood'), items };
  }

  private canRename(): boolean {
    return !!this.mode && this.tutorialCapabilities?.fullUi !== false && (this.mode.kind !== 'building' || this.renamable);
  }

  /** Swaps the speaker's name for a text field; Enter or leaving it saves, Escape cancels. */
  private startRename(cb: HudCallbacks): void {
    if (this.renameInput) return this.renameInput.focus();
    const input = el('input', 'rename');
    input.spellcheck = false;
    input.setAttribute('autocorrect', 'off');
    input.type = 'text';
    input.maxLength = NAME_MAX;
    input.value = this.speaker.textContent ?? '';
    input.setAttribute('aria-label', t('New name (leave empty for the original)'));
    this.renameInput = input;
    this.speaker.hidden = true;
    this.speaker.after(input);
    let done = false;
    const finish = (save: boolean) => {
      if (done) return;
      done = true;
      if (save) cb.onRename(input.value);
      input.remove();
      this.renameInput = null;
      this.speaker.hidden = false;
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
    input.focus();
    input.select();
  }

  /** Fold only the selected module; its heading and other chosen modules remain available. */
  setFolded(folded: boolean): void {
    if (this.folded === folded) return;
    this.folded = folded;
    this.selectionWindow.dataset.collapsed = String(folded);
    setAttr(this.speaker, 'aria-expanded', String(!folded));
    this.speaker.dataset.iconHint = folded ? t('Open the panel') : t('Fold the panel away');
    this.root.dispatchEvent(new CustomEvent('selectionfold', { detail: folded }));
  }

  get isFolded(): boolean { return this.folded; }

  /** Tutorial actions use the same numbering and keyboard handling as ordinary replies. */
  setTutorialActions(buttons: HTMLButtonElement[]): void {
    for (const row of this.options.querySelectorAll(':scope > .tutorial-reply')) row.remove();
    for (const button of buttons) {
      const row = el('li', 'tutorial-reply');
      row.append(button);
      this.options.append(row);
    }
  }

  private cameraInsets: Insets | null = null;

  invalidateLayout(): void { this.cameraInsets = null; this.headerBottom = 0; }

  /** Reserve actual visible panels, keeping the largest contiguous map region available. */
  insets(): Insets {
    if (this.cameraInsets) return this.cameraInsets;
    const viewport = this.root.getBoundingClientRect();
    const panels = [...this.root.querySelectorAll<HTMLElement>('.hud-header, .top-bar, .column, .tutorial-guide:not([hidden])')]
      .filter(panel => panel.getClientRects().length > 0)
      .map(panel => panel.getBoundingClientRect());
    this.cameraInsets = cameraArea(viewport, window.innerWidth, window.innerHeight, panels);
    return this.cameraInsets;
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
        const prev = this.lastStress[key];
        this.lastStress[key] = v;
        // A jump in one refresh (an action, an event) floats its size over the meter; slow drift does not.
        if (prev !== undefined && Math.abs(v - prev) >= METER_JUMP) this.meterJump(key, v - prev);
        const state = meterState(key, v);
        if (f.dataset.state !== state) {
          f.dataset.state = state;
          this.stressMeters[key].dataset.state = state;
          // Need icons on priced replies take the meter's colour, so the pressing needs stand out.
          document.documentElement.dataset[`need${key[0].toUpperCase()}${key.slice(1)}`] = state;
        }
      }
    }
    const aid = s.aid;
    if (aid) {
      const perHour = price(aid.perHour);
      setText(this.aidLong, aid.kind === 'cold' ? (aid.on ? t('Warming bus out: stop') : t('Warming bus {price}/h', { price: perHour })) : (aid.on ? t('Water and shade out: stop') : t('Water and shade {price}/h', { price: perHour })));
      setText(this.aidShort, aid.kind === 'cold' ? (aid.on ? t('Stop the warming bus.') : t('Send the warming bus.')) : (aid.on ? t('Stop water and shade.') : t('Put out water and shade.')));
      this.aidBtn.dataset.iconHint = aid.kind === 'cold' ? t('A warming bus on cold nights: fewer people harmed outdoors.') : t('Water and shade on hot days: fewer people harmed outdoors.');
      setAttr(this.aidBtn, 'aria-pressed', String(aid.on));
    }
    const f = s.favours;
    if (f) {
      setText(this.favourNum, String(f.held));
      const label = f.held ? t('City hall favours: {n}. Press to use one.', { n: f.held }) : f.owed ? t('No favour now: city hall is owed one.') : t('Reputation earns your next favour.');
      if (this.favourCount.dataset.iconHint !== label) this.favourCount.dataset.iconHint = label;
      setAttr(this.favourCount, 'aria-label', label);
      const state = f.held ? 'held' : f.owed ? 'owed' : 'none';
      if (this.favourCount.dataset.state !== state) this.favourCount.dataset.state = state;
      this.favourCount.disabled = false;
    }
    const aidHidden = !aid || this.servicesOpen || this.mode !== null;
    if (this.aidOpt.hidden !== aidHidden) this.aidOpt.hidden = aidHidden;
    const on = SERVICE_IDS.filter((id) => s.enabled[id]).length;
    setText(this.reviewName, t('Services ({on}/{all}).', { on, all: SERVICE_IDS.length }));
    setText(this.reviewShort, t('Services ({on}/{all}).', { on, all: SERVICE_IDS.length }));
    for (const id of SERVICE_IDS) {
      setAttr(this.switches[id], 'aria-checked', String(s.enabled[id]));
      if (this.switchOpts[id].dataset.on !== String(s.enabled[id])) this.switchOpts[id].dataset.on = String(s.enabled[id]);
      setText(this.switchState[id], s.enabled[id] ? t('On') : t('Off'));
      setText(this.ownAct[id], s.enabled[id] ? t('Close down.') : t('Open up.'));
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
      const hint = this.tooltipFor(id);
      if (hint) {
        const text = `${hint.title}: ${hint.body}`;
        if (label.dataset.iconHint !== text) label.dataset.iconHint = text;
      }
      if (label.dataset.status !== loc.status) label.dataset.status = loc.status;
      const v = loc.venue;
      if (v) {
        setAttr(label, 'data-tone', v.tone);
        setAttr(label, 'data-faded', String(v.faded));
        setAttr(label, 'data-crossed', String(v.crossed));
        const cue = label.querySelector<HTMLElement>('.venue-cue')!;
        const kind = v.indicator ?? '';
        const count = v.count === undefined ? '' : String(v.count);
        if (label.dataset.indicator !== kind || cue.lastElementChild!.textContent !== count) {
          if (label.dataset.indicator !== kind) cue.firstElementChild!.innerHTML = v.indicator ? VENUE_ICONS[v.indicator] : '';
          label.dataset.indicator = kind;
          setText(cue.lastElementChild as HTMLElement, count);
          cue.hidden = !v.indicator;
          this.labelWidths[id] = 0;
          renamed = true;
        }
      }
      setAttr(label, 'aria-label', t('{name}: {status}. Show details', { name: loc.name, status: v?.message ?? statusText(loc) }));
    }
    // A new name changes the label width, so re-clamp it against the screen edge.
    if (renamed && this.labelPoints) this.placeLabels(this.labelPoints);
    if (this.mode?.kind !== 'location') return;
    const loc = s.locations[this.mode.id];
    setText(this.speaker, loc.name);
    // Open says nothing: the switch and the counts below already show it. Anything else is said once, here.
    // The place's name is right above: the line is the status alone.
    const venueMessage = loc.venue?.message ?? statusText(loc);
    setText(this.said, this.mode.id === 'club'
      ? t('Venue: {status}. {service}: {state}.', { status: venueMessage, service: loc.service, state: statusText(loc) })
      : loc.venue?.indicator ? venueMessage : (loc.status === 'open' || loc.closed?.ownChoice) && !loc.blockedByLaw ? '' : `${statusText(loc)}.`);
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
    const groupHidden = !a || a.closedDown || this.servicesOpen;
    setAttr(this.staffGroupBtn, 'aria-disabled', String(locked));
    if (this.staffGroupBtn.disabled !== locked) this.staffGroupBtn.disabled = locked;
    if (locked && this.staffOpen) this.staffOpen = false;
    if (this.staffGroupOpt.hidden !== groupHidden) this.staffGroupOpt.hidden = groupHidden;
    if (a) setText(this.staffGroupLong, t('Staffing ({n} wanted)', { n: a.wanted }));
    // Labels stay short; the detail (times, rates, why) is in the tooltip.
    const show = (action: PlaceAction, visible: boolean, text: string, enabled = true, hint = '') => {
      const o = this.actionOpts[action];
      if (o.button.dataset.iconHint !== hint) o.button.dataset.iconHint = hint;
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
    // Switched off: nothing is spent on or changed in a service that is not running; switching it on is the way back.
    const running = why !== 'switchedOff';
    const offHint = t('Switch the service on to use this.');
    // Every spend here eases what people turned away from this service would have needed.
    const helps = serviceNeeds(a.service);
    for (const action of SPEND_ACTIONS) setNeeds(this.actionOpts[action].needs, helps);
    setNeeds(this.staffGroupNeeds, helps);
    const staffRoom = a.wanted < a.staffMax;
    show('moreStaff', !a.closedDown && !locked, staffRoom ? t('One more on shift ({n})', { n: a.wanted }) : t('{n} on shift, the most', { n: a.wanted }), staffRoom, t('Ask for one more staff member on shift here.'));
    // Recruiting may find nobody: the chance stands in brackets on both labels.
    const hireChance = Math.round(recruitChance('hirePaid') * 100);
    const volChance = Math.round(recruitChance('volunteerDrive') * 100);
    show('hire', !a.closedDown && staffRoom, t('Hire paid {price} ({chance}%)', { price: price(ACTION_COST.hire), chance: hireChance }), afford(ACTION_COST.hire), t('Hire a paid worker for here: about 2 hours to find one.'));
    show('volunteer', !a.closedDown && staffRoom, t('Find a volunteer {price} ({chance}%)', { price: price(ACTION_COST.volunteer), chance: volChance }), afford(ACTION_COST.volunteer), t('About an hour and a half to find one.'));
    setText(this.actionOpts.hire.short, t('Hire a paid worker ({chance}%).', { chance: hireChance }));
    setText(this.actionOpts.volunteer.short, t('Find a volunteer ({chance}%).', { chance: volChance }));
    const c = a.campers;
    const canSend = !!c && running && c.out < c.max && afford(c.cost);
    show('camper', !!c && !a.closedDown, c ? (c.out < c.max ? t('Another camper {price}', { price: price(c.cost) }) : plural(c.out, ['{n} camper out, all there are', '{n} campers out, all there are'], ['{n} kamper w trasie, więcej nie ma', '{n} kampery w trasie, więcej nie ma', '{n} kamperów w trasie, więcej nie ma'])) : '', canSend, !c ? '' : running ? t('Send another camper out: {price}, then {perHour} an hour.', { price: price(c.cost), perHour: price(c.perHour) }) : offHint);
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
    show('path', !!path && !a.closedDown, path?.current ? t('Specialised: {path}', { path: CAMPER_PATH[path.current].label }) : t('Specialise the camper'), running, running ? t('Pick what the camper is best at; changing later costs again.') : offHint);
    if (!running) this.pathOpen = false;
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
    show('move', !!c && !a.closedDown, c ? (c.moving ? t('Camper on the move') : t('Move the camper')) : '', !!c && !c.moving && running, running ? t('Pick a free kerb spot on the map; it reopens there once parked.') : offHint);
    const inv = a.invest;
    const full = inv.level >= inv.max && inv.progress >= 1;
    // Building work goes on whether or not the place is open tonight, but not into a service switched off.
    // The label names the stage the money builds towards; the hint says what it is.
    const nextHint = inv.next ? t('Next: {stage}. {does}', { stage: inv.next.label, does: inv.next.does }) : t('This service is at its full size.');
    show('invest', !a.closedDown, full || !inv.next ? t('Full size: {stage}', { stage: inv.stage }) : t('Invest {price}: towards {stage}', { price: price(inv.cost), stage: inv.next.label }), !full && !!inv.next && running && afford(inv.cost), running ? nextHint : t('Switch the service on to invest in it.'));
    if (a.hustle) {
      setText(this.actionOpts.hustle.short, a.hustle.short);
      setAttr(this.actionOpts.hustle.button, 'aria-pressed', String(a.hustle.on));
    }
    // A running deal or fee can always be ended; a new one waits until the service is on.
    const hustleOk = (a.hustle?.enabled ?? true) && (running || !!a.hustle?.on);
    show('hustle', !!a.hustle && !a.closedDown, a.hustle?.label ?? '', hustleOk, hustleOk || !a.hustle?.enabled ? a.hustle?.hint ?? '' : offHint);
    // Budget mix: what visits here are spent on.
    if (!running) this.mixOpen = false;
    show('mix', !a.closedDown, t('Budget mix ({price} a visit)', { price: price(a.mix.visitCost) }), running, !running ? offHint : a.mix.items.filter((m) => m.share > 0).map((m) => `${ACTIVITY[m.id].short} ${Math.round(m.share * 100)}%`).join(', ') || t('Nothing on offer'));
    setAttr(this.actionOpts.mix.button, 'aria-expanded', String(this.mixOpen));
    const now = performance.now();
    const shown = wholePercents(a.mix.items.map((m) => (m.lock ? 0 : m.share)));
    this.mixRows.forEach((r, i) => {
      const m = a.mix.items[i];
      const hidden = !m || !this.mixOpen || this.servicesOpen || a.closedDown;
      if (r.li.hidden !== hidden) r.li.hidden = hidden;
      if (!m) { r.id = null; return; }
      r.id = m.id;
      setText(r.labelText, m.label);
      setNeeds(r.labelNeeds, ACTIVITY_NEEDS[m.id]);
      r.input.dataset.iconHint = m.does;
      r.input.disabled = m.lock !== null;
      const pct = String(shown[i]);
      if (now > r.editingUntil && r.input.value !== pct) r.input.value = pct;
      setText(r.out, m.lock ? '' : `${shown[i]}%`);
      setText(r.note, m.lock === 'law' ? t('Not allowed by law here.') : m.lock === 'setup' ? t('Needs equipment first ({price}).', { price: price(m.setupCost) }) : m.does);
      r.note.dataset.alert = m.lock === 'law' ? 'law' : '';
      const showSetup = m.lock === 'setup';
      if (r.setup.hidden === showSetup) r.setup.hidden = !showSetup;
      if (showSetup) {
        setText(r.setupLabel, t('Set it up ({price}).', { price: price(m.setupCost) }));
        setNeeds(r.setupNeeds, helps);
        r.setup.disabled = !afford(m.setupCost);
      }
    });
    show('relaunch', a.closedDown, a.reopening ? t('Relaunching…') : t('Relaunch {price}', { price: price(ACTION_COST.relaunch) }), !a.reopening && afford(ACTION_COST.relaunch), t('Back in about 2 hours.'));
  }

  /** Shows the parts of the column that belong to the current mode. */
  /**
   * Phones: an open group (staffing, the budget mix, a favour) takes the list
   * over: the other replies step aside and the group's own reply, marked ‹,
   * leads back. On wider screens the list stays as it is.
   */
  private syncDrill(): void {
    // The deepest open group leads: the camper's spots inside staffing, its paths, the mix, favours.
    const camper = this.actionOpts.camper.li;
    const path = this.actionOpts.path.li;
    const [head, members]: [HTMLElement | null, readonly HTMLElement[]] =
      this.camperOpen && this.staffOpen && !camper.hidden ? [camper, this.spotOpts.map((o) => o.li)]
        : this.pathOpen && !path.hidden ? [path, this.pathOpts.map((o) => o.li)]
          : this.staffOpen && !this.staffGroupOpt.hidden ? [this.staffGroupOpt, STAFF_ACTIONS.map((a) => this.actionOpts[a].li)]
            : this.mixOpen && !this.actionOpts.mix.li.hidden ? [this.actionOpts.mix.li, this.mixRows.map((r) => r.li)]
                : [null, []];
    // Everything that is not the group's own reply or one of its members steps aside.
    const keep = new Set<Element>(members);
    for (const li of this.options.children) {
      const out = !!head && li !== head && !keep.has(li);
      if (li.classList.contains('drill-out') !== out) li.classList.toggle('drill-out', out);
      if (li !== head && li.classList.contains('drill-head')) li.classList.remove('drill-head');
    }
    if (head) {
      head.classList.add('drill-head');
      this.options.dataset.drill = 'true';
    } else if (this.options.dataset.drill) delete this.options.dataset.drill;
  }

  private render(): void {
    queueMicrotask(() => this.syncDrill());
    const m = this.mode;
    // A new selection opens its own module; overview modules keep their chosen state.
    if (this.column.dataset.mode !== (m?.kind ?? 'idle')) this.setFolded(false);
    this.column.dataset.mode = m ? m.kind : 'idle';
    if (m?.kind !== 'person') { delete this.column.dataset.role; delete this.column.dataset.mood; this.column.style.removeProperty('--mood'); }
    if (m?.kind !== 'location') delete this.column.dataset.status;
    this.idle.hidden = m !== null;
    (this.speaker.parentElement as HTMLElement).hidden = m === null && !this.guide;
    if (m === null) this.showGuide();
    else delete this.root.dataset.guide;
    this.aside.hidden = m?.kind !== 'person';
    this.buildingView.hidden = m?.kind !== 'building';
    this.buildingChips.hidden = m?.kind !== 'building' || !this.buildingChips.childElementCount;
    this.locationView.hidden = m?.kind !== 'location';
    this.personNote.hidden = m?.kind !== 'person';
    if (m?.kind !== 'person') this.personSupportView.root.hidden = true;
    if (m?.kind !== 'person') this.profileView.hidden = true;
    else this.profileView.hidden = !this.profileView.dataset.key;
    const open = this.servicesOpen;
    this.focusOpt.hidden = m === null || open || m.kind !== 'person' || !this.personPlace;
    this.personCamperOpt.hidden = m?.kind !== 'person' || open || !this.personCamper;
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
    // The services review is for when nothing is selected. The guide's reply stands in for the
    // standing one it would repeat (My organisation, Services).
    const act = this.guide?.step.act?.kind;
    this.reviewOpt.hidden = open || m !== null || act === 'services';
    this.orgOpt.hidden = open || m !== null || act === 'org';
    this.guideOpt.hidden = open || m !== null || !this.guide?.step.act;
    this.aidOpt.hidden = open || m !== null || !this.lastSnapshot?.aid;
    this.backOpt.hidden = !open;
    const own = m?.kind === 'location' ? serviceAt(m.id) : null;
    for (const id of SERVICE_IDS) {
      this.switchOpts[id].hidden = !(open || id === own);
      // On its own card the row is the one action; in the services list, the name and the switch.
      const single = String(!open && id === own);
      if (this.switchOpts[id].dataset.own !== single) this.switchOpts[id].dataset.own = single;
    }
  }

  /** Opens or closes the services list; focus moves into or back out of it. */
  private setServicesOpen(open: boolean): void {
    this.servicesOpen = open;
    this.render();
    const first = SERVICE_IDS.find((id) => this.switchOpts[id].dataset.tutorialLocked !== 'true') ?? SERVICE_IDS[0];
    const target = open ? this.switches[first] : this.reviewOpt.querySelector('button');
    target?.focus({ preventScroll: true });
  }

  private renderLocation(loc: LocationSnapshot, trend: MetricTrend): void {
    const chipKeys = loc.chips.map((c) => c.icon).join('|');
    if (chipKeys !== this.chipKeys) {
      this.chipKeys = chipKeys;
      this.chips.replaceChildren(...loc.chips.map((c) => {
        const li = el('li', 'chip');
        li.dataset.icon = c.icon;
        li.tabIndex = 0;
        const icon = el('span', 'chip-icon');
        icon.innerHTML = CHIP_ICONS[c.icon];
        li.append(icon, el('span', 'chip-value'));
        return li;
      }));
    }
    loc.chips.forEach((c, i) => {
      const li = this.chips.children[i] as HTMLElement;
      setText(li.lastElementChild as HTMLElement, c.value);
      if (li.dataset.iconHint !== c.label) li.dataset.iconHint = c.label;
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
    const inv = loc.actions?.invest;
    this.investment.hidden = !inv;
    if (inv) {
      const pct = Math.round(Math.min(1, Math.max(0, inv.progress)) * 100);
      const text = inv.next
        ? t('Investment reserve: {p}%. Next: {stage}.', { p: pct, stage: inv.next.label })
        : t('Maintenance reserve: {p}%. This service is at full size.', { p: pct });
      setText(this.investmentText, text);
      const explanation = text + ' ' + t('Visits and unpaid upkeep use this reserve.')
        + (inv.next ? ' ' + inv.next.does : '');
      if (this.investment.dataset.iconHint !== explanation) this.investment.dataset.iconHint = explanation;
      if (this.investmentProgress.value !== inv.progress) this.investmentProgress.value = Math.min(1, Math.max(0, inv.progress));
      setAttr(this.investmentProgress, 'aria-label', explanation);
    }
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

/** Replies that spend money (now or by the hour) on the selected place. */
const SPEND_ACTIONS: readonly PlaceAction[] = ['moreStaff', 'hire', 'volunteer', 'camper', 'invest', 'relaunch'];
/** Shares (0 to 1) as whole percents that add up to exactly 100 (largest remainders get the leftover points). */
function wholePercents(shares: readonly number[]): number[] {
  const total = shares.reduce((n, v) => n + v, 0);
  if (total <= 0) return shares.map(() => 0);
  const exact = shares.map((v) => (v / total) * 100);
  const out = exact.map(Math.floor);
  let left = 100 - out.reduce((n, v) => n + v, 0);
  for (const i of exact.map((_, i) => i).sort((p, q) => (exact[q] - out[q]) - (exact[p] - out[p]))) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  return out;
}

const ACTIONS: readonly PlaceAction[] = ['moreStaff', 'hire', 'volunteer', 'camper', 'move', 'path', 'mix', 'hustle', 'invest', 'relaunch'];
/** Most camper spots the replies offer. */
const MAX_SPOTS = 6;
/** The most activities any place offers. */
const MIX_SLOTS = 5;
/** Actions nested under the Staffing reply. */
const STAFF_ACTIONS: readonly PlaceAction[] = ['moreStaff', 'hire', 'volunteer', 'camper'];
/** Phone labels: short, but each one says what it does without the rest of the menu. */
const ACTION_SHORT: Record<PlaceAction, string> = { moreStaff: t('One more on shift.'), hire: t('Hire a paid worker.'), volunteer: t('Find a volunteer.'), camper: t('Send another camper.'), move: t('Move the camper.'), path: t('Specialise the camper.'), mix: t('Budget mix.'), hustle: t('Side income.'), invest: t('Invest: more places.'), relaunch: t('Reopen the service.') };
/** Costs shown on the replies; the organisation charges the same (config/organisation.ts). */
const ACTION_COST = { hire: RECRUIT.hirePaid.cost, volunteer: RECRUIT.volunteerDrive.cost, relaunch: ORG.reopen.cost };
