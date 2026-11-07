import { draggableWindow } from './draggableWindow';
import { citationReference } from './citationReference';
import { EVENT_IDS, EVENTS, KIND_LABELS, type EventId, type EventKind, type Hint } from '../config/randomEvents';
import type { ActiveEvent } from '../sim/eventEngine';
import { formatClock } from '../sim/clock';
import { plural, t } from '../i18n';

export interface EventFeedCallbacks {
  onTrigger(id: EventId): void;
  /** Open the sandbox panel at the slider or option a hint names. */
  onHint(hint: Hint): void;
  /** An event's card was opened: bring where it happens into view. */
  onFocus(id: EventId): void;
  /** The event's details box opened or closed (the clock waits while it is open). */
  onDetail?(open: boolean): void;
  /** The heading opened or folded the feed. */
  onToggle?(open: boolean): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Panel rows a hint can mark: a slider row, a funding application, or the recruiting actions. */
export const HINT_ROW = '.param, .org-grant, .org-actions, .org-closed';

/** DOM id of the control a hint points at, matching the panel's ids. */
export function hintInputId(hint: Hint): string {
  if ('param' in hint) return `param-${hint.param.replace('.', '-')}`;
  if ('factor' in hint) return `factor-${hint.factor}`;
  return `org-${hint.org}`;
}

/** A row in the feed: the event's kind and title, and one short line of how it stands. */
interface Card {
  root: HTMLButtonElement;
  line: HTMLElement;
  lineText: string;
}

/**
 * Random events, live: what is happening, whether checking has caught it,
 * how many people collapsed and whether staff reached them, and which
 * sliders help. Cards are built when an event starts; per-refresh updates
 * only touch two text nodes per card.
 */
export class EventFeed {
  private readonly root: HTMLElement;
  private readonly list: HTMLElement;
  private readonly recent: HTMLElement;
  private readonly heading: HTMLButtonElement;
  private readonly cards = new Map<ActiveEvent, Card>();
  private recentText = '';
  /** Which events belong to what is selected, or null to show them all. */
  private match: ((id: EventId) => boolean) | null = null;
  private active: readonly ActiveEvent[] = [];
  private readonly detail: EventDetail;
  /** The clock at the last refresh, for a box opened between refreshes. */
  private clock = 0;

  constructor(parent: HTMLElement, private readonly cb: EventFeedCallbacks) {
    this.detail = new EventDetail(cb);
    this.root = el('section', 'events');
    this.root.setAttribute('aria-label', t('Events tonight'));
    // The heading folds the feed away; folded by default so the scene stays clear.
    this.heading = el('button', 'events-heading', t('Tonight: no events'));
    this.heading.type = 'button';
    this.heading.setAttribute('aria-expanded', 'false');
    this.heading.addEventListener('click', () => {
      const open = this.heading.getAttribute('aria-expanded') !== 'true';
      this.setOpen(open);
      cb.onToggle?.(open);
    });
    this.root.dataset.open = 'false';
    this.list = el('div', 'events-list');
    this.list.setAttribute('aria-live', 'polite');
    this.recent = el('p', 'events-recent');
    this.recent.hidden = true;
    const trigger = el('details', 'events-trigger');
    trigger.append(el('summary', undefined, t('Trigger an event')));
    const byKind = new Map<EventKind, EventId[]>();
    for (const id of EVENT_IDS) byKind.set(EVENTS[id].kind, [...(byKind.get(EVENTS[id].kind) ?? []), id]);
    for (const [kind, ids] of byKind) {
      const group = el('div', 'trigger-group');
      group.append(el('p', 'trigger-kind', KIND_LABELS[kind]));
      for (const id of ids) {
        const b = el('button', 'btn trigger', EVENTS[id].label);
        b.type = 'button';
        b.addEventListener('click', () => cb.onTrigger(id));
        group.append(b);
      }
      trigger.append(group);
    }
    this.root.append(this.heading, this.list, this.recent, trigger);
    parent.append(this.root);
  }

  /** Opens or folds the feed; says nothing to `onToggle`. */
  setOpen(open: boolean): void {
    this.heading.setAttribute('aria-expanded', String(open));
    this.root.dataset.open = String(open);
  }

  /** Puts an element (the organisation bar) above the event heading. */
  prependBar(bar: HTMLElement): void {
    this.root.prepend(bar);
  }

  /** Rebuilds the card set when events start or end; keeps existing cards (and their open state). */
  setEvents(active: readonly ActiveEvent[], recent: readonly ActiveEvent[], clock: number): void {
    for (const [e, card] of this.cards) {
      if (!active.includes(e)) {
        card.root.remove();
        this.cards.delete(e);
      }
    }
    for (const e of active) if (!this.cards.has(e)) this.list.prepend(this.buildCard(e));
    this.active = active;
    this.detail.ended(active);
    this.applyFilter();
    const ended = recent.slice(0, 2).map((e) => e.acuteHarms
      ? t('{event} ({collapsed} collapsed, {helped} reached by staff)', { event: EVENTS[e.id].label, collapsed: e.acuteHarms, helped: e.helped })
      : EVENTS[e.id].label);
    const text = recent.length ? t('Ended: {events}', { events: ended.join('; ') }) : '';
    if (text !== this.recentText) {
      this.recentText = text;
      this.recent.textContent = text;
      this.recent.hidden = !text;
    }
    this.refresh(clock);
  }

  /**
   * Narrows tonight's events to what is selected (a place, a person), or shows them all (null).
   * Touches the DOM only when which cards show, or the heading, changes.
   */
  setFilter(match: ((id: EventId) => boolean) | null): void {
    this.match = match;
    this.applyFilter();
  }

  private applyFilter(): void {
    const match = this.match;
    let shown = 0;
    for (const [e, card] of this.cards) {
      const show = !match || match(e.id);
      if (card.root.hidden === show) card.root.hidden = !show;
      if (show) shown++;
    }
    const all = this.active.length;
    const events = (n: number) => plural(n, ['{n} active event', '{n} active events'], ['{n} aktywne zdarzenie', '{n} aktywne zdarzenia', '{n} aktywnych zdarzeń']);
    const text = !all
      ? t('Tonight: no events')
      : match
        ? t('Tonight here: {events} of {all}', { events: events(shown), all })
        : t('Tonight: {events}', { events: events(all) });
    if (this.heading.textContent !== text) this.heading.textContent = text;
  }

  /** Cheap per-refresh update: each row's short line, and the open box's status and counts. */
  refresh(clock: number): void {
    this.clock = clock;
    for (const [e, card] of this.cards) {
      const line = shortLine(e, clock);
      if (line !== card.lineText) {
        card.lineText = line;
        card.line.textContent = line;
      }
    }
    this.detail.refresh(clock);
  }

  private buildCard(e: ActiveEvent): HTMLButtonElement {
    const def = EVENTS[e.id];
    // One tap target: the kind, the title and how it stands; the story and what helps open in a box.
    const root = el('button', 'event-card');
    root.type = 'button';
    root.dataset.kind = def.kind;
    root.setAttribute('aria-haspopup', 'dialog');
    const head = el('span', 'event-head');
    head.append(el('span', 'event-kind', KIND_LABELS[def.kind]), el('span', 'event-title', def.label));
    const line = el('span', 'event-line');
    root.append(head, line);
    root.addEventListener('click', () => {
      this.cb.onFocus(e.id);
      this.detail.show(e, this.clock);
    });
    this.cards.set(e, { root, line, lineText: '' });
    return root;
  }
}

/** The row's line: minutes left, then who collapsed and was reached, then whether checking caught it. */
function shortLine(e: ActiveEvent, clock: number): string {
  const def = EVENTS[e.id];
  const parts = [t('{left} min left', { left: Math.max(0, Math.round(e.endsAt - clock)) })];
  if (def.affects.length) {
    if (e.acuteHarms) parts.push(t('{collapsed} collapsed, {helped} reached', { collapsed: e.acuteHarms, helped: e.helped }));
    parts.push(e.alerted ? t('alert out') : e.detectedAt !== null ? t('detected') : t('not detected'));
  }
  return parts.join(' · ');
}

/** Full status, as the details box says it. */
function fullStatus(e: ActiveEvent, clock: number): { status: string; counts: string } {
  const def = EVENTS[e.id];
  const left = Math.max(0, Math.round(e.endsAt - clock));
  let status = t('Since {time}, about {left} min left', { time: formatClock(e.startedAt), left });
  if (def.affects.length) {
    status = e.alerted
      ? t('Public alert out. {status}', { status })
      : e.detectedAt !== null
        ? t('Detected by checking at {time}, no public alert. {status}', { time: formatClock(e.detectedAt), status })
        : t('Not detected yet. {status}', { status });
  }
  const counts = def.affects.length ? t('{collapsed} collapsed: {helped} reached by staff, {alone} alone', { collapsed: e.acuteHarms, helped: e.helped, alone: e.alone }) : '';
  return { status, counts };
}

/**
 * An event's details, as a box over the game, after the event windows of
 * management games: what is happening, how it stands, what helps (each opens
 * its setting), and the sources behind it. Status and counts stay live while
 * it is open; the clock waits (through `onDetail`).
 */
class EventDetail {
  private readonly dialog: HTMLDialogElement;
  private readonly kind: HTMLElement;
  private readonly title: HTMLElement;
  private readonly status: HTMLElement;
  private readonly counts: HTMLElement;
  private readonly body: HTMLElement;
  private event: ActiveEvent | null = null;

  constructor(private readonly cb: EventFeedCallbacks) {
    this.dialog = el('dialog', 'welcome event-popup event-detail');
    this.dialog.setAttribute('aria-labelledby', 'event-detail-title');
    draggableWindow(this.dialog);
    this.kind = el('p', 'intro-step');
    this.title = el('h2');
    this.title.id = 'event-detail-title';
    this.status = el('p', 'event-status');
    this.counts = el('p', 'event-counts');
    this.body = el('div', 'event-body');
    const close = el('button', 'welcome-start', t('Close'));
    close.type = 'button';
    close.addEventListener('click', () => this.dialog.close());
    this.dialog.append(this.kind, this.title, this.status, this.counts, this.body, close);
    this.dialog.addEventListener('close', () => {
      if (this.dialog.open) return;
      this.event = null;
      this.cb.onDetail?.(false);
    });
    this.dialog.addEventListener('click', (ev) => { if (ev.target === this.dialog) this.dialog.close(); });
    document.body.append(this.dialog);
  }

  show(e: ActiveEvent, clock: number): void {
    const def = EVENTS[e.id];
    this.event = e;
    this.dialog.dataset.kind = def.kind;
    this.kind.textContent = KIND_LABELS[def.kind];
    this.title.textContent = def.label;
    const hints = el('div', 'event-hints');
    hints.append(el('span', 'hints-label', t('Helps:')));
    for (const h of def.hints) {
      const b = el('button', 'btn hint', `${h.label}${'param' in h ? (h.direction === 'up' ? ' ↑' : ' ↓') : ''}`);
      if ('org' in h) b.dataset.org = 'true';
      b.type = 'button';
      b.dataset.iconHint = t('Open this setting');
      // The box steps aside for the setting it opens.
      b.addEventListener('click', () => { this.dialog.close(); this.cb.onHint(h); });
      hints.append(b);
    }
    const sources = el('details', 'sources');
    sources.append(el('summary', undefined, t('Sources ({n})', { n: def.evidence.filter((c) => c.type !== 'none').length })));
    const list = el('ul', 'cites');
    for (const c of def.evidence) {
      const li = el('li');
      li.dataset.type = c.type;
      li.append(el('strong', undefined, c.ref), el('span', undefined, ` ${c.note} `), citationReference(c));
      list.append(li);
    }
    sources.append(list);
    this.body.replaceChildren(el('p', undefined, def.happens), el('p', 'event-mitigation', def.mitigation), hints, sources);
    this.refresh(clock);
    if (!this.dialog.open) {
      this.dialog.showModal();
      this.cb.onDetail?.(true);
    }
  }

  refresh(clock: number): void {
    const e = this.event;
    if (!e) return;
    const { status, counts } = fullStatus(e, clock);
    if (this.status.textContent !== status) this.status.textContent = status;
    if (this.counts.textContent !== counts) this.counts.textContent = counts;
    this.counts.hidden = !counts;
  }

  /** The event ended while its box was open: the box closes. */
  ended(active: readonly ActiveEvent[]): void {
    if (this.event && !active.includes(this.event)) this.dialog.close();
  }
}

/**
 * Marks panel rows whose setting helps with an active event ("Helps with: ...").
 * Runs only when events start or end.
 */
export function markHintedRows(active: readonly ActiveEvent[]): void {
  // Grouped by row, so two hints into one row (hire and volunteers) give one chip.
  const rows = new Map<HTMLElement, Set<string>>();
  for (const e of active) {
    for (const h of EVENTS[e.id].hints) {
      const row = document.getElementById(hintInputId(h))?.closest(HINT_ROW) as HTMLElement | null;
      if (!row) continue;
      rows.set(row, (rows.get(row) ?? new Set()).add(EVENTS[e.id].label));
    }
  }
  for (const chip of document.querySelectorAll('.hint-chip')) chip.remove();
  for (const row of document.querySelectorAll('[data-hinted]')) delete (row as HTMLElement).dataset.hinted;
  for (const [row, names] of rows) {
    row.dataset.hinted = 'true';
    row.append(el('span', 'hint-chip', t('Helps with: {events}', { events: [...names].join(', ') })));
  }
}
