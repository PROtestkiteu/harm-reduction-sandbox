import type { StressCause, StressMeter } from '../sim/cityStress';
import type { ServiceId } from '../sim/types';
import { t } from '../i18n';

/**
 * Why a meter is where it is: tapping (or Enter on) one of the meters at the
 * top opens a small card under it listing what is pushing it up now, largest
 * first, and one thing that helps. It reads the simulation only when opened
 * and while open (twice a second), so it costs nothing otherwise. Escape, a
 * second tap or a tap elsewhere closes it.
 */
type MeterKey = StressMeter | 'district';

const SERVICE_NAME: Record<ServiceId, string> = {
  dropIn: t('the drop-in'), outreach: t('outreach'), clubHr: t('the club stand'), footPatrol: t('the foot patrol'),
  drugChecking: t('drug checking'), shelter: t('the shelter'), clinic: t('the clinic'),
};

const CAUSE: Record<Exclude<StressCause, `turnedAway:${string}`>, string> = {
  crime: t('Street crime the police answered'),
  scuffle: t('Scuffles at closing time'),
  daemon: t('Someone in acute crisis on the street'),
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
  private open: { key: MeterKey; anchor: HTMLElement } | null = null;
  private timer = 0;

  constructor(private readonly row: HTMLElement, private readonly causes: (m: StressMeter) => { cause: StressCause; share: number }[]) {
    this.card = Object.assign(document.createElement('div'), { className: 'meter-causes', hidden: true });
    this.card.id = 'meter-causes';
    this.card.setAttribute('role', 'dialog');
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
    if (m && this.open?.key !== key) this.toggle(m);
    m?.focus({ preventScroll: true });
  }

  private toggle(m: HTMLElement): void {
    const key = m.dataset.key as MeterKey;
    if (this.open?.key === key) { this.close(false); return; }
    this.open?.anchor.setAttribute('aria-expanded', 'false');
    this.open = { key, anchor: m };
    m.setAttribute('aria-expanded', 'true');
    this.render();
    this.card.hidden = false;
    this.place();
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
    const { key, anchor } = this.open;
    const name = anchor.getAttribute('aria-label') ?? key;
    const head = Object.assign(document.createElement('h3'), { textContent: key === 'district' ? name : t('{meter}: what is pushing it up now', { meter: name }) });
    const list = document.createElement('ul');
    if (key !== 'district') {
      const cs = this.causes(key);
      if (!cs.length) list.append(Object.assign(document.createElement('li'), { textContent: t('Nothing much: it is calm.') }));
      for (const c of cs.slice(0, 5)) {
        const li = document.createElement('li');
        li.append(Object.assign(document.createElement('span'), { className: 'cause-share', textContent: `${Math.round(c.share * 100)}%` }), document.createTextNode(causeLabel(c.cause)));
        list.append(li);
      }
    }
    const help = Object.assign(document.createElement('p'), { className: 'cause-help', textContent: HELPS[key] });
    this.card.replaceChildren(head, list, help);
  }

  /** Under its meter, kept on screen. */
  private place(): void {
    if (!this.open) return;
    const r = this.open.anchor.getBoundingClientRect();
    const w = Math.min(300, window.innerWidth - 16);
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
