import { ORG, RECRUIT } from '../config/organisation';
import { SERVICE_TEXT } from '../config/places';
import type { Insets } from '../render/camera';
import { LOCATION_IDS, SERVICE_IDS, serviceAt, type LocationId, type ServiceId, type ServiceStatus } from '../sim/types';
import type { PersonCard } from './personInfo';
import { METRIC_KEYS, MetricTrend, sparkPoints, TREND_BUCKET_MINUTES, TREND_BUCKETS, type MetricKey } from './trends';

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
}

/** What can be done at a place, free or paid from the organisation's budget. */
export type PlaceAction = 'moreStaff' | 'moreWaiting' | 'hire' | 'volunteer' | 'relaunch';

/** The selected place's levers, for its action replies. */
export interface PlaceLevers {
  service: ServiceId;
  wanted: number;
  staffMax: number;
  waiting: number;
  waitingMax: number;
  closedDown: boolean;
  reopening: boolean;
  budget: number;
}

export interface LocationSnapshot {
  name: string;
  service: string;
  status: ServiceStatus;
  facts: [string, string][];
  metrics: { demand: number; attended: number; unmetNeed: number; adverse: number };
  metricsLabel: string;
  actions?: PlaceLevers;
}

export interface HudSnapshot {
  clock: string;
  /** Scene clock in minutes, used to bucket the trend sparklines. */
  clockMinutes?: number;
  people: number;
  locations: Record<LocationId, LocationSnapshot>;
  enabled: Record<ServiceId, boolean>;
}

export const STATUS_TEXT: Record<ServiceStatus, string> = {
  open: 'Open',
  opening: 'Opening: staff on the way',
  closing: 'Closing: staff leaving',
  closed: 'Closed',
};

const METRIC_LABELS: Record<MetricKey, { name: string; hint: string }> = {
  demand: { name: 'Demand', hint: 'People who came looking for the service' },
  attended: { name: 'Attended', hint: 'People who were seen or served' },
  unmetNeed: { name: 'Unmet need', hint: 'People who left without being served, because it was full, closed or the wait ran long' },
  adverse: { name: 'Adverse outcomes', hint: 'Neutral placeholder count with no assumed effect of any service' },
};

export const SPEEDS = [1, 2, 4] as const;
const SPARK_W = 56;
const SPARK_H = 14;
const SVG_NS = 'http://www.w3.org/2000/svg';
const NARROW = '(max-width: 760px)';

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
type Mode = { kind: 'location'; id: LocationId } | { kind: 'person' } | null;

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
  private readonly people: HTMLElement;
  private readonly log: HTMLElement;
  private readonly idle: HTMLElement;
  private readonly speaker: HTMLElement;
  private readonly said: HTMLElement;
  private readonly aside: HTMLElement;
  private readonly locationView: HTMLElement;
  private readonly facts: HTMLElement;
  private readonly metricsLabel: HTMLElement;
  private readonly metrics = {} as Record<MetricKey, MetricRow>;
  private readonly personNote: HTMLElement;
  private readonly continueBtn: HTMLButtonElement;
  private readonly speedBtns: HTMLButtonElement[] = [];
  private readonly switches = {} as Record<ServiceId, HTMLButtonElement>;
  private readonly switchState = {} as Record<ServiceId, HTMLElement>;
  private readonly switchOpts = {} as Record<ServiceId, HTMLElement>;
  private readonly reviewOpt: HTMLElement;
  private readonly reviewName: HTMLElement;
  private readonly reviewShort: HTMLElement;
  private readonly backOpt: HTMLElement;
  private servicesOpen = false;
  private readonly focusOpt: HTMLElement;
  private readonly actionOpts = {} as Record<PlaceAction, { li: HTMLLIElement; button: HTMLButtonElement; label: HTMLElement }>;
  private readonly focusBtn: HTMLButtonElement;
  private readonly focusLong: HTMLElement;
  private readonly focusShort: HTMLElement;
  private readonly leaveOpt: HTMLElement;
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
    this.header.append(el('h1', undefined, 'Harm reduction sandbox'), el('p', 'subtitle', 'A city neighbourhood, day and night. Every number is illustrative.'));

    this.column = el('aside', 'column');
    this.column.setAttribute('aria-label', 'Details and controls');
    const top = el('div', 'column-top');
    this.clock = el('span', 'clock', '19:40');
    this.clock.setAttribute('aria-label', 'Scene clock');
    this.people = el('span', 'people');
    top.append(this.clock, this.people);
    this.eventsSlot = el('div', 'column-events');

    // The conversation: who or what is selected, speaking in plain sentences.
    this.log = el('div', 'log');
    this.log.setAttribute('aria-live', 'polite');
    this.idle = el('p', 'idle', 'Nothing selected. Click or tap a place or a person.');
    const line = el('p', 'line');
    this.speaker = el('span', 'speaker');
    this.said = el('span', 'said');
    line.append(this.speaker, this.said);
    this.aside = el('p', 'aside');
    this.locationView = el('div', 'location-view');
    this.facts = el('dl', 'facts');
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
      row.append(el('dt', undefined, METRIC_LABELS[key].name), value, svg);
      metrics.append(row);
      this.metrics[key] = { value, line: polyline };
    }
    this.locationView.append(
      this.facts,
      this.metricsLabel,
      metrics,
      el('p', 'note', `Lines show new counts per ${TREND_BUCKET_MINUTES} scene minutes over the last ${TREND_BUCKET_MINUTES * TREND_BUCKETS}. Counts are kept apart and none is derived from another. More attendance can mean better access. Adverse outcomes are a neutral placeholder with no assumed service effect.`),
    );
    this.personNote = el('p', 'note', 'Everyone here is an anonymous, illustrative figure. The sandbox models roles and activities only, never personal details.');
    this.log.append(this.idle, line, this.aside, this.locationView, this.personNote);

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
    // Things to do at the selected place: free, or paid from the budget.
    for (const action of ACTIONS) {
      const b = button('opt');
      const long = el('span', 'long');
      const short = el('span', 'short', ACTION_SHORT[action]);
      short.setAttribute('aria-hidden', 'true');
      b.append(long, short);
      b.addEventListener('click', () => {
        const levers = this.mode?.kind === 'location' ? this.lastSnapshot?.locations[this.mode.id].actions : undefined;
        if (levers) cb.onAction(levers.service, action);
      });
      this.actionOpts[action] = { li: opt(b), button: b, label: long };
    }
    const leave = button('opt');
    const leaveShort = el('span', 'short', 'Leave.');
    leaveShort.setAttribute('aria-hidden', 'true');
    leave.append(el('span', 'long', 'Leave it.'), leaveShort);
    leave.setAttribute('aria-label', 'Close details (Escape)');
    leave.addEventListener('click', () => cb.onSelect(null));
    this.leaveOpt = opt(leave);
    // Services sit behind one reply so the list stays short; the selected
    // place's own switch is offered directly.
    const review = button('opt');
    this.reviewName = el('span', 'long');
    this.reviewShort = el('span', 'short');
    this.reviewShort.setAttribute('aria-hidden', 'true');
    review.append(this.reviewName, this.reviewShort);
    review.addEventListener('click', () => this.setServicesOpen(true));
    this.reviewOpt = opt(review);
    const back = button('opt', 'Back.');
    back.addEventListener('click', () => this.setServicesOpen(false));
    this.backOpt = opt(back);
    for (const id of SERVICE_IDS) {
      const b = button('opt switch');
      b.setAttribute('role', 'switch');
      b.setAttribute('aria-label', SERVICE_TEXT[id].label);
      b.dataset.service = id;
      const state = el('span', 'state');
      const name = el('span', 'name');
      const short = el('span', 'short', SERVICE_TEXT[id].short);
      short.setAttribute('aria-hidden', 'true');
      name.append(el('span', 'long', SERVICE_TEXT[id].label), short);
      b.append(name, state);
      b.addEventListener('click', () => cb.onService(id, b.getAttribute('aria-checked') !== 'true'));
      this.switches[id] = b;
      this.switchState[id] = state;
      this.switchOpts[id] = opt(b);
    }
    const speeds = el('div', 'opt speeds');
    speeds.setAttribute('role', 'group');
    speeds.setAttribute('aria-label', 'Simulation speed');
    speeds.append(el('span', 'speeds-label', 'Speed'));
    for (const s of SPEEDS) {
      const b = button('speed', `${s}x`);
      b.addEventListener('click', () => cb.onSpeed(s));
      this.speedBtns.push(b);
      speeds.append(b);
    }
    opt(speeds).classList.add('wide');
    const reset = button('opt');
    const resetShort = el('span', 'short', 'Overview.');
    resetShort.setAttribute('aria-hidden', 'true');
    reset.append(el('span', 'long', 'Back to the overview.'), resetShort);
    reset.setAttribute('aria-label', 'Back to the overview');
    reset.title = 'R. Right-drag or two-finger drag to orbit.';
    reset.addEventListener('click', () => cb.onResetView());
    this.resetOpt = opt(reset);
    this.resetOpt.hidden = true;

    this.continueBtn = button('continue', 'Pause');
    this.continueBtn.addEventListener('click', () => cb.onTogglePause());

    this.column.append(top, this.eventsSlot, this.log, this.options, this.continueBtn);

    const labelLayer = el('div', 'labels');
    for (const id of LOCATION_IDS) {
      const b = button('loc-label');
      b.dataset.location = id;
      b.append(el('span', 'dot'), el('span', 'loc-name'));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        cb.onSelect(this.mode?.kind === 'location' && this.mode.id === id ? null : id);
      });
      this.labels[id] = b;
      this.labelWidths[id] = 0;
      labelLayer.append(b);
    }

    root.append(labelLayer, this.header, this.column);
    // Label widths depend on the web fonts, which arrive after first layout.
    void document.fonts.ready.then(() => {
      for (const id of LOCATION_IDS) this.labelWidths[id] = 0;
      if (this.labelPoints) this.placeLabels(this.labelPoints);
    });
    this.render();
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  /** Number keys pick the visible numbered option, as in a conversation. */
  private onKey(e: KeyboardEvent): void {
    if (e.altKey || e.ctrlKey || e.metaKey || !/^[1-9]$/.test(e.key)) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
    const visible = [...this.options.children].filter((li) => !(li as HTMLElement).hidden);
    const li = visible[Number(e.key) - 1];
    // The speed option steps to the next speed; every other option is one button.
    const speeds = li?.querySelectorAll<HTMLButtonElement>('.speed');
    let target = li?.querySelector<HTMLButtonElement>('button.opt') ?? null;
    if (speeds?.length) {
      const current = [...speeds].findIndex((b) => b.getAttribute('aria-pressed') === 'true');
      target = speeds[(current + 1) % speeds.length];
    }
    if (!target) return;
    e.preventDefault();
    target.click();
  }

  setPaused(paused: boolean): void {
    setText(this.continueBtn, paused ? 'Continue' : 'Pause');
    setAttr(this.continueBtn, 'aria-pressed', String(paused));
    setAttr(this.continueBtn, 'aria-label', paused ? 'Continue the simulation (Space)' : 'Pause the simulation (Space)');
  }

  setSpeed(speed: number): void {
    this.speedBtns.forEach((b, i) => setAttr(b, 'aria-pressed', String(SPEEDS[i] === speed)));
  }

  /** Offers the overview option only while the camera is away from it. */
  setViewChanged(changed: boolean): void {
    if (this.resetOpt.hidden === changed) this.resetOpt.hidden = !changed;
  }

  /** Reflects whether the camera is zoomed onto (or following) the selection. */
  setFocused(focused: boolean, person = false): void {
    const text = person ? (focused ? 'Stop following.' : 'Follow them.') : focused ? 'Step back.' : 'Take a closer look.';
    const short = person ? (focused ? 'Unfollow.' : 'Follow.') : focused ? 'Step back.' : 'Look closer.';
    setText(this.focusLong, text);
    setText(this.focusShort, short);
    setAttr(this.focusBtn, 'aria-label', text);
    setAttr(this.focusBtn, 'aria-pressed', String(focused));
    setAttr(this.focusBtn, 'title', focused ? 'Back to the overview (F)' : person ? 'Keep the camera on this person (F)' : 'Zoom in here (F, or double-click)');
  }

  /** Label button for a location, for keyboard focus moves. */
  labelFor(id: LocationId): HTMLButtonElement {
    return this.labels[id];
  }

  showLocation(id: LocationId | null): void {
    this.mode = id ? { kind: 'location', id } : null;
    for (const l of LOCATION_IDS) setAttr(this.labels[l], 'aria-pressed', String(l === id));
    this.render();
    if (this.lastSnapshot) this.update(this.lastSnapshot);
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
    setText(this.speaker, card?.title ?? lastTitle ?? 'Person');
    setText(this.said, card ? `${card.activity}.` : 'Walked out of the scene.');
    const camera = !card ? '' : following ? (card.inView ? ' The camera follows.' : ' Out of view inside; the camera waits.') : '';
    setText(this.aside, card ? `${card.subtitle}.${camera}` : 'Gone. The camera returns to the overview.');
    this.focusOpt.hidden = !card;
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
    if (!this.headerBottom) this.headerBottom = this.header.getBoundingClientRect().bottom;
    const narrow = window.matchMedia(NARROW).matches;
    const rect = this.column.getBoundingClientRect();
    const columnLeft = narrow ? window.innerWidth : rect.left;
    // On phones the sheet covers the bottom; labels below its top would sit under it.
    const floor = narrow ? rect.top : window.innerHeight - 8;
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

  /** CSS-pixel areas the HUD covers; the camera frames the scene around them. */
  insets(): Insets {
    const vh = window.innerHeight;
    this.headerBottom = this.header.getBoundingClientRect().bottom;
    const top = this.headerBottom + 6;
    if (!window.matchMedia(NARROW).matches) {
      return { top: Math.min(top, 72), right: window.innerWidth - this.column.getBoundingClientRect().left, bottom: 8, left: 0 };
    }
    // Phones: the column is a bottom sheet. Reserve room for the conversation
    // and for the reply rows a selection adds, so the framing never has to
    // change (and the scene never jumps) when something is selected.
    const optionsTop = this.options.getBoundingClientRect().top;
    const rowsToCome = (this.focusOpt.hidden ? 44 : 0) + (this.resetOpt.hidden ? 44 : 0);
    return { top, right: 0, bottom: vh - optionsTop + 150 + rowsToCome, left: 0 };
  }

  update(s: HudSnapshot): void {
    if (!this.lastSnapshot) requestAnimationFrame(() => this.root.classList.add('hud-ready'));
    this.lastSnapshot = s;
    setText(this.clock, s.clock);
    setText(this.people, `${s.people} people out now`);
    const on = SERVICE_IDS.filter((id) => s.enabled[id]).length;
    setText(this.reviewName, `Review the services (${on} of ${SERVICE_IDS.length} on).`);
    setText(this.reviewShort, `Services (${on}/${SERVICE_IDS.length}).`);
    for (const id of SERVICE_IDS) {
      setAttr(this.switches[id], 'aria-checked', String(s.enabled[id]));
      setText(this.switchState[id], s.enabled[id] ? 'On' : 'Off');
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
      setAttr(label, 'aria-label', `${loc.name}, ${loc.service} ${STATUS_TEXT[loc.status].toLowerCase()}. Show details`);
    }
    // A new name changes the label width, so re-clamp it against the screen edge.
    if (renamed && this.labelPoints) this.placeLabels(this.labelPoints);
    if (this.mode?.kind !== 'location') return;
    const loc = s.locations[this.mode.id];
    setText(this.speaker, loc.name);
    setText(this.said, `${loc.service}: ${STATUS_TEXT[loc.status].toLowerCase()}.`);
    if (this.column.dataset.status !== loc.status) this.column.dataset.status = loc.status;
    this.renderLocation(loc, this.trends[this.mode.id]);
    this.renderActions(loc.actions);
  }

  /** Action replies for the selected place: labels carry the current numbers and costs. */
  private renderActions(a: PlaceLevers | undefined): void {
    const show = (action: PlaceAction, visible: boolean, text: string, enabled = true) => {
      const o = this.actionOpts[action];
      const hidden = !visible || this.servicesOpen;
      if (o.li.hidden !== hidden) o.li.hidden = hidden;
      setText(o.label, text);
      if (o.button.disabled === enabled) o.button.disabled = !enabled;
    };
    if (!a) {
      for (const action of ACTIONS) show(action, false, '');
      return;
    }
    const money = (n: number) => Math.round(n).toLocaleString('en-GB');
    const afford = (cost: number) => a.budget >= cost;
    const staffRoom = a.wanted < a.staffMax;
    const waitRoom = a.waiting < a.waitingMax;
    show('moreStaff', !a.closedDown, staffRoom ? `Ask for one more on shift here (now ${a.wanted}).` : `Staff wanted here: ${a.wanted}, the most it takes.`, staffRoom);
    show('moreWaiting', !a.closedDown, waitRoom ? `Set out more waiting places (now ${a.waiting}).` : `Waiting places: ${a.waiting}, all the room there is.`, waitRoom);
    show('hire', !a.closedDown && staffRoom, afford(ACTION_COST.hire) ? `Hire a paid worker for here (${ACTION_COST.hire}, about 2 h).` : `Hire a paid worker (${ACTION_COST.hire}; budget ${money(a.budget)}).`, afford(ACTION_COST.hire));
    show('volunteer', !a.closedDown && staffRoom, `Find a volunteer for here (${ACTION_COST.volunteer}, about 1.5 h).`, afford(ACTION_COST.volunteer));
    show('relaunch', a.closedDown, a.reopening ? 'Relaunching: back in about 2 h.' : `Relaunch it (${ACTION_COST.relaunch}, about 2 h).`, !a.reopening && afford(ACTION_COST.relaunch));
  }

  /** Shows the parts of the column that belong to the current mode. */
  private render(): void {
    const m = this.mode;
    this.column.dataset.mode = m ? m.kind : 'idle';
    if (m?.kind !== 'person') delete this.column.dataset.role;
    if (m?.kind !== 'location') delete this.column.dataset.status;
    this.idle.hidden = m !== null;
    (this.speaker.parentElement as HTMLElement).hidden = m === null;
    this.aside.hidden = m?.kind !== 'person';
    this.locationView.hidden = m?.kind !== 'location';
    this.personNote.hidden = m?.kind !== 'person';
    const open = this.servicesOpen;
    this.focusOpt.hidden = m === null || open;
    if (m?.kind !== 'location') for (const action of ACTIONS) this.actionOpts[action].li.hidden = true;
    else this.renderActions(this.lastSnapshot?.locations[m.id].actions);
    this.leaveOpt.hidden = m === null || open;
    this.reviewOpt.hidden = open;
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
    loc.facts.forEach(([, v], i) => setText(this.facts.children[i].lastElementChild as HTMLElement, v));
    setText(this.metricsLabel, `[${loc.metricsLabel}: illustrative]`);
    let peak = 1;
    for (const k of METRIC_KEYS) for (const v of trend.values(k)) peak = Math.max(peak, v);
    for (const k of METRIC_KEYS) {
      const row = this.metrics[k];
      setText(row.value, String(loc.metrics[k]));
      setAttr(row.line, 'points', sparkPoints(trend.values(k), SPARK_W, SPARK_H, peak));
    }
  }
}

const ACTIONS: readonly PlaceAction[] = ['moreStaff', 'moreWaiting', 'hire', 'volunteer', 'relaunch'];
const ACTION_SHORT: Record<PlaceAction, string> = { moreStaff: 'More staff.', moreWaiting: 'More places.', hire: 'Hire.', volunteer: 'Volunteer.', relaunch: 'Relaunch.' };
/** Costs shown on the replies; the organisation charges the same (config/organisation.ts). */
const ACTION_COST = { hire: RECRUIT.hirePaid.cost, volunteer: RECRUIT.volunteerDrive.cost, relaunch: ORG.reopen.cost };
