import type { StressCause, StressMeter } from '../sim/cityStress';
import type { ServiceId } from '../sim/types';
import { t } from '../i18n';

/**
 * Why a meter is where it is, and what to do about it. Pointing at one of the
 * meters at the top shows a small card under it: what is pushing it up now,
 * largest first, and what helps. Pressing the meter (or Enter on it) opens it
 * as a panel instead, with the replies that work on that meter, so it can be
 * dealt with from here without hunting for the place on the map. It reads the
 * simulation only while open (twice a second), so it costs nothing otherwise.
 * Escape, the meter again, a press on the card outside its replies or a press
 * elsewhere closes it.
 */
export type MeterKey = StressMeter | 'district';

/** A reply in a meter's panel: what it does, a short note (a price, a count), whether it can be used now. */
export interface MeterAction {
  label: string;
  note?: string;
  disabled?: boolean;
  run(): void;
}

const SERVICE_NAME: Record<ServiceId, string> = {
  dropIn: t('the drop-in'), outreach: t('outreach'), clubHr: t('the club stand'), footPatrol: t('the foot patrol'),
  drugChecking: t('drug checking'), shelter: t('the shelter'), clinic: t('the clinic'),
};

const CAUSE: Record<Exclude<StressCause, `turnedAway:${string}`>, string> = {
  crime: t('Street crime the police answered'),
  theft: t('Pickpocketing and shoplifting reported'),
  scuffle: t('Scuffles at closing time'),
  daemon: t('Someone in acute crisis on the street'),
  festival: t('Festival weekend at the festival grounds'),
  match: t('Home match at the stadium'),
  uniWeekend: t('University weekend off'),
  policeStop: t('Police stops'),
  drunk: t('Drunk club leavers'),
  overdoseAlone: t('Overdoses nobody reached in time'),
  overdoseHelped: t('Overdoses your staff reached'),
  exposure: t('People harmed by cold or heat outdoors'),
  camp: t('The camp in the park'),
  crisis: t('The crisis on the street'),
};

const HELPS: Record<MeterKey, string> = {
  police: t('Helps: shelter beds and outreach for the camp, staff at the club stand at closing, the police quest.'),
  medics: t('Helps: more staff where people are turned away, the foot patrol and drug checking, naloxone in the mix.'),
  sobering: t('Helps: staff at the club stand, partner venues, the sobering-up centre quest.'),
  district: t('Rises while few people are turned away and the city services are calm; falls in a crisis. Open services and staff them.'),
};

export function causeLabel(c: StressCause): string {
  if (c.startsWith('turnedAway:')) return t('People turned away from {service}', { service: SERVICE_NAME[c.slice(11) as ServiceId] });
  return CAUSE[c as keyof typeof CAUSE];
}

export class MeterCauses {
  private readonly card: HTMLDivElement;
  private open: { key: MeterKey; anchor: HTMLElement; pinned: boolean } | null = null;
  private timer = 0;
  /** What the card shows now, so it is rebuilt only when that changes (a reply keeps its focus). */
  private shown = '';

  constructor(private readonly row: HTMLElement, private readonly causes: (m: StressMeter) => { cause: StressCause; share: number }[], private readonly actions: (key: MeterKey) => MeterAction[] = () => []) {
    this.card = Object.assign(document.createElement('div'), { className: 'meter-causes', hidden: true });
    this.card.id = 'meter-causes';
    this.card.setAttribute('role', 'dialog');
    // A press on the card closes it, unless it is on one of its replies.
    this.card.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('button')) this.close(false); });
    document.body.append(this.card);
    for (const m of row.querySelectorAll<HTMLElement>('[data-key]')) {
      m.tabIndex = 0;
      m.setAttribute('role', 'button');
      m.setAttribute('aria-controls', this.card.id);
      m.setAttribute('aria-expanded', 'false');
    }
    row.addEventListener('click', (e) => {
      const m = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
      if (m) this.toggle(m);
    });
    // With a mouse, pointing at a meter previews its card; leaving it closes the preview (an opened panel stays).
    row.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse' || this.open?.pinned) return;
      const m = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
      if (m && this.open?.anchor !== m) this.openAt(m, false);
    });
    row.addEventListener('pointerout', (e) => {
      if (e.pointerType !== 'mouse' || !this.open || this.open.pinned) return;
      const to = e.relatedTarget as Node | null;
      if (!to || !this.open.anchor.contains(to)) this.close(false);
    });
    row.addEventListener('keydown', (e) => {
      const m = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
      if (m && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.toggle(m); }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.open) { e.stopPropagation(); this.close(true); } }, true);
    document.addEventListener('pointerdown', (e) => {
      if (this.open && !this.card.contains(e.target as Node) && !row.contains(e.target as Node)) this.close(false);
    });
  }

  /** Opens the card for one meter (the coordinator's guide points here). */
  show(key: MeterKey): void {
    const m = this.row.querySelector<HTMLElement>(`[data-key="${key}"]`);
    if (m && !(this.open?.key === key && this.open.pinned)) this.openAt(m, true);
    m?.focus({ preventScroll: true });
  }

  /** A press on a meter: opens its panel, or closes it when it is open already. */
  private toggle(m: HTMLElement): void {
    if (this.open?.anchor === m && this.open.pinned) { this.close(false); return; }
    this.openAt(m, true);
  }

  private openAt(m: HTMLElement, pinned: boolean): void {
    if (this.open && this.open.anchor !== m) this.open.anchor.setAttribute('aria-expanded', 'false');
    this.open = { key: m.dataset.key as MeterKey, anchor: m, pinned };
    m.setAttribute('aria-expanded', 'true');
    this.card.dataset.pinned = String(pinned);
    this.shown = '';
    this.render();
    this.card.hidden = false;
    this.place();
    if (pinned) this.card.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }

  private close(focus: boolean): void {
    if (!this.open) return;
    this.open.anchor.setAttribute('aria-expanded', 'false');
    if (focus) this.open.anchor.focus();
    this.open = null;
    this.card.hidden = true;
  }

  private render(): void {
    if (!this.open) return;
    const { key, anchor, pinned } = this.open;
    const name = anchor.getAttribute('aria-label') ?? key;
    const cs = key === 'district' ? [] : this.causes(key).slice(0, 5);
    const acts = pinned ? this.actions(key) : [];
    // Rebuilt only when what it shows changes, so a focused reply keeps its focus between refreshes.
    const sig = [key, pinned, ...cs.map((c) => `${c.cause}:${Math.round(c.share * 100)}`), ...acts.map((a) => `${a.label}|${a.note ?? ''}|${!!a.disabled}`)].join(';');
    if (sig === this.shown) return;
    this.shown = sig;
    const head = Object.assign(document.createElement('h3'), { textContent: key === 'district' ? name : t('{meter}: what is pushing it up now', { meter: name }) });
    const parts: HTMLElement[] = [head];
    if (key !== 'district') {
      const list = document.createElement('ul');
      if (!cs.length) list.append(Object.assign(document.createElement('li'), { textContent: t('Nothing much: it is calm.') }));
      for (const c of cs) {
        const li = document.createElement('li');
        li.append(Object.assign(document.createElement('span'), { className: 'cause-share', textContent: `${Math.round(c.share * 100)}%` }), document.createTextNode(causeLabel(c.cause)));
        list.append(li);
      }
      parts.push(list);
    }
    if (pinned && acts.length) {
      parts.push(Object.assign(document.createElement('p'), { className: 'cause-act-head', textContent: t('What you can do') }));
      const ul = Object.assign(document.createElement('ul'), { className: 'cause-acts' });
      for (const a of acts) {
        const b = Object.assign(document.createElement('button'), { type: 'button', className: 'cause-act', disabled: !!a.disabled });
        b.append(Object.assign(document.createElement('span'), { textContent: a.label }));
        if (a.note) b.append(Object.assign(document.createElement('span'), { className: 'cause-act-note', textContent: a.note }));
        b.addEventListener('click', () => { this.close(false); a.run(); });
        const li = document.createElement('li');
        li.append(b);
        ul.append(li);
      }
      parts.push(ul);
    } else {
      parts.push(Object.assign(document.createElement('p'), { className: 'cause-help', textContent: HELPS[key] }));
      if (!pinned) parts.push(Object.assign(document.createElement('p'), { className: 'cause-hint', textContent: t('Press the meter for what you can do.') }));
    }
    this.card.replaceChildren(...parts);
  }

  /** Under its meter, kept on screen. */
  private place(): void {
    if (!this.open) return;
    const r = this.open.anchor.getBoundingClientRect();
    const w = Math.min(this.open.pinned ? 360 : 300, window.innerWidth - 16);
    this.card.style.width = `${w}px`;
    this.card.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left))}px`;
    this.card.style.top = `${Math.round(r.bottom + 6)}px`;
    // Short screens (a phone on its side): the card scrolls within what is left below its meter.
    this.card.style.maxHeight = `${Math.max(120, window.innerHeight - r.bottom - 14)}px`;
  }

  /** Keeps an open card current (twice a second at most); free while closed. */
  update(dt: number): void {
    if (!this.open) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.5;
    this.render();
    this.place();
  }
}
