import { t } from '../i18n';
import { playerBadge, type PlayerPicture } from './playerBadge';

/** Renamed with the three-page welcome, so players who closed the old box see this one once. */
const SEEN_KEY = 'hrp-welcome-seen-2';

interface Page {
  title: string;
  lead?: string;
  /** Said by you, beside your portrait, in place of a lead. */
  said?: string;
  points: string[];
}

/** Who you are, what the job is, and how to play it: one short page each. */
const PAGES: Page[] = [
  {
    title: t('Who you are'),
    lead: t('You coordinate a small harm reduction non-profit in a city district, working through the night.'),
    points: [
      t('Your team runs a drop-in centre, an outreach camper and a stand at the music club.'),
      t('People who use drugs come to you for clean kit, drug checking, first aid, a warm place and someone to talk to.'),
    ],
  },
  {
    title: t('Your job'),
    lead: t('Help as many people as you can each night without running out of money.'),
    points: [
      t('Every visit costs money. Funders and grants pay for results, so a busy night can still leave you short.'),
      t('People turned away do not vanish: they end up with the police and the medics. The meters at the top show that strain.'),
      t('Run out of money and the game ends.'),
    ],
  },
  {
    title: t('How to play'),
    said: t('When nothing is selected, the side panel is us: it names your next step. Tonight it walks you through the first ones.'),
    points: [
      t('Tap a place to see who waits and who is on shift: add staff, set what it spends on, invest to grow it.'),
      t('Tap a person on the street to see who they are and what they need.'),
      t('Tap the money for My organisation: your team, hiring, donations and grants.'),
      t('Each night has three goals, in gold. Meet them for stars.'),
    ],
  },
];

/**
 * The welcome: who you are, your job and how to play, over three short pages
 * with Back and Next. Shown on a first visit and from "How it works" any time
 * after, always from the first page. A native modal dialog, so focus, Escape
 * and the backdrop behave as the platform expects; it pauses the city (through
 * `onChange`) while open.
 */
export class Welcome {
  private readonly dialog: HTMLDialogElement;
  private readonly title: HTMLHeadingElement;
  private readonly lead: HTMLParagraphElement;
  private readonly list: HTMLUListElement;
  private readonly step: HTMLParagraphElement;
  private readonly back: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private page = 0;

  constructor(parent: HTMLElement, private readonly onChange: (open: boolean) => void, private readonly picture?: PlayerPicture) {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'welcome intro';
    this.dialog.setAttribute('aria-labelledby', 'welcome-title');
    this.step = Object.assign(document.createElement('p'), { className: 'intro-step' });
    this.title = Object.assign(document.createElement('h2'), { id: 'welcome-title' });
    this.lead = Object.assign(document.createElement('p'), { className: 'welcome-lead' });
    this.list = document.createElement('ul');
    const nav = Object.assign(document.createElement('div'), { className: 'intro-nav' });
    this.back = Object.assign(document.createElement('button'), { type: 'button', className: 'welcome-start intro-back', textContent: t('Back') });
    this.next = Object.assign(document.createElement('button'), { type: 'button', className: 'welcome-start' });
    this.back.addEventListener('click', () => this.go(this.page - 1));
    this.next.addEventListener('click', () => (this.page < PAGES.length - 1 ? this.go(this.page + 1) : this.dialog.close()));
    nav.append(this.back, this.next);
    this.dialog.append(this.step, this.title, this.lead, this.list, nav);
    this.dialog.addEventListener('close', () => {
      try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode: show again next time */ }
      this.onChange(false);
    });
    // A click on the backdrop (outside the box) closes it too.
    this.dialog.addEventListener('click', (e) => { if (e.target === this.dialog) this.dialog.close(); });
    parent.append(this.dialog);
  }

  /** Opens on a first visit only. */
  showIfNew(): void {
    let seen = false;
    try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch { /* no storage: treat as new */ }
    if (!seen) this.show();
  }

  show(): void {
    if (this.dialog.open) return;
    this.go(0);
    this.dialog.showModal();
    this.onChange(true);
  }

  private go(page: number): void {
    this.page = Math.max(0, Math.min(PAGES.length - 1, page));
    const p = PAGES[this.page];
    this.step.textContent = t('{n} of {all}', { n: this.page + 1, all: PAGES.length });
    this.title.textContent = p.title;
    this.lead.textContent = p.lead ?? '';
    this.lead.hidden = !p.lead;
    this.list.replaceChildren(...p.points.map((text) => Object.assign(document.createElement('li'), { textContent: text })));
    // You, beside the page you speak on, painted on first need.
    this.dialog.querySelector('.player-badge')?.remove();
    if (p.said && this.picture) this.title.after(playerBadge(this.picture, p.said));
    this.back.hidden = this.page === 0;
    const last = this.page === PAGES.length - 1;
    this.next.textContent = last ? t('Start the night') : t('Next');
    this.next.focus();
  }
}
