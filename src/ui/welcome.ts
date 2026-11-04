import './welcome.css';
import { t } from '../i18n';
import { playerBadge, type PlayerPicture } from './playerBadge';
import { dontShowAgain, tutorialHidden } from './tutorials';


/** Who you are, set on the first page: your organisation's name and your look. */
export interface Identity {
  name(): string;
  rename(name: string): void;
  /** How many looks there are, which one is yours, and choosing another. */
  looks: number;
  look(): number;
  setLook(i: number): void;
  /** Your portrait now, as a data URL. */
  picture(): string;
}

interface Page {
  title: string;
  /** This page sets who you are (the name and the look). */
  identity?: true;
  lead?: string;
  /** Said by you, beside your portrait, in place of a lead. */
  said?: string;
  points: string[];
}

/** Who you are, what the job is, and how to play it: one short page each. */
const PAGES: Page[] = [
  {
    title: t('Who you are'),
    identity: true,
    lead: t('You coordinate a small harm reduction non-profit in a city district, working through the night.'),
    points: [
      t('Your team runs a drop-in centre, an outreach camper and a stand at the music club.'),
      t('People who use drugs come to you for clean kit, drug checking, first aid, a warm place and someone to talk to.'),
    ],
  },
  {
    title: t('Your job'),
    lead: t('The district grows every night. Good work grows its nightlife; neglect grows a street scene in crisis. Either way more people come.'),
    points: [
      t('Every visit costs money. Funders and grants pay for results, so a busy night can still leave you short.'),
      t('People turned away do not vanish: they end up with the police and the medics. The meters at the top show that strain.'),
      t('Your team has its own morale. People turned away and deaths wear it down; below a point, people quit.'),
      t('Now and then a big crisis comes, with a day of warning. Prepare for it, or the city spirals. In a Hardcore game or a scenario, it can end the project.'),
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

const TUTORIAL_PAGES: Page[] = [
  {
    title: t('Who you are'), identity: true,
    lead: t('Start with two streetworkers, a small neighbourhood and the park next door.'),
    points: [t('Meet people where they are. Your first round offers clean kit, naloxone, a warm drink and a conversation.'), t('Follow one goal at a time. New streets, services and controls appear as your team learns.')],
  },
  {
    title: t('How to play'),
    lead: t('Drag to move around, pinch or scroll to zoom, and tap a place to inspect it.'),
    points: [t('Begin by visiting the park encampment and opening the foot patrol controls.'), t('You can pause whenever you need. Setbacks are recoverable during the tutorial.')],
  },
];

/**
 * The welcome: who you are, your job and how to play, over three short pages
 * with Back and Next. Shown at the start of every new game unless the player
 * ticked "Don't show again" (ui/tutorials.ts; the panel's first-steps
 * walk-through starts over with it), and from "How it works" any
 * time, always from the first page. A native modal dialog, so focus, Escape
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
  private readonly identityBox: HTMLElement | null;
  private readonly pages: Page[];
  private readonly optOut = dontShowAgain('welcome');

  constructor(parent: HTMLElement, private readonly onChange: (open: boolean) => void, private readonly picture?: PlayerPicture, identity?: Identity, tutorial = false) {
    this.pages = tutorial ? TUTORIAL_PAGES : PAGES;
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
    this.next.addEventListener('click', () => (this.page < this.pages.length - 1 ? this.go(this.page + 1) : this.dialog.close()));
    nav.append(this.back, this.next);
    this.identityBox = identity ? identityBox(identity) : null;
    this.dialog.append(this.step, this.title, ...(this.identityBox ? [this.identityBox] : []), this.lead, this.list, nav, this.optOut);
    this.dialog.addEventListener('close', () => this.onChange(false));
    // A click on the backdrop (outside the box) closes it too.
    this.dialog.addEventListener('click', (e) => { if (e.target === this.dialog) this.dialog.close(); });
    parent.append(this.dialog);
  }

  /** A new game begins: opens unless the player ticked "Don't show again". */
  showForNewGame(): void {
    if (!tutorialHidden('welcome')) this.show();
  }

  show(): void {
    if (this.dialog.open) return;
    this.optOut.dispatchEvent(new Event('refresh'));
    this.go(0);
    this.dialog.showModal();
    this.onChange(true);
  }

  private go(page: number): void {
    this.page = Math.max(0, Math.min(this.pages.length - 1, page));
    const p = this.pages[this.page];
    this.step.textContent = t('{n} of {all}', { n: this.page + 1, all: this.pages.length });
    this.title.textContent = p.title;
    if (this.identityBox) {
      this.identityBox.hidden = !p.identity;
      if (p.identity) this.identityBox.dispatchEvent(new Event('refresh'));
    }
    this.lead.textContent = p.lead ?? '';
    this.lead.hidden = !p.lead;
    this.list.replaceChildren(...p.points.map((text) => Object.assign(document.createElement('li'), { textContent: text })));
    // You, beside the page you speak on, painted on first need.
    this.dialog.querySelector('.player-badge')?.remove();
    if (p.said && this.picture) this.title.after(playerBadge(this.picture, p.said));
    this.back.hidden = this.page === 0;
    const last = this.page === this.pages.length - 1;
    this.next.textContent = last ? t('Start the night') : t('Next');
    this.next.focus();
  }
}

/**
 * The name field and the look picker: a portrait with a previous and a next
 * look beside it. The portrait is painted only when this page is shown or the
 * look changes.
 */
function identityBox(id: Identity): HTMLElement {
  const box = Object.assign(document.createElement('div'), { className: 'welcome-identity' });
  const face = Object.assign(document.createElement('img'), { alt: '', width: 60, height: 75, className: 'player-face' });
  // Chevrons drawn as icons, so they sit centred and crisp in their square at any font.
  const chevron = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="${d}"/></svg>`;
  const prev = Object.assign(document.createElement('button'), { type: 'button', className: 'welcome-look', innerHTML: chevron('M15 5l-7 7 7 7') });
  const next = Object.assign(document.createElement('button'), { type: 'button', className: 'welcome-look', innerHTML: chevron('M9 5l7 7-7 7') });
  prev.setAttribute('aria-label', t('Previous look'));
  next.setAttribute('aria-label', t('Next look'));
  const look = Object.assign(document.createElement('div'), { className: 'welcome-look-row' });
  look.append(prev, face, next);
  const label = Object.assign(document.createElement('label'), { className: 'welcome-name' });
  const input = Object.assign(document.createElement('input'), { type: 'text', maxLength: 40, spellcheck: false, autocomplete: 'off' });
  label.append(Object.assign(document.createElement('span'), { textContent: t('Your organisation') }), input);
  const paint = () => { face.src = id.picture(); };
  const step = (by: number) => { id.setLook((id.look() + by + id.looks) % id.looks); paint(); };
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  input.addEventListener('change', () => { id.rename(input.value); input.value = id.name(); });
  // Enter keeps the name and leaves the field, without closing the box.
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  box.addEventListener('refresh', () => { input.value = id.name(); paint(); });
  // With a single look there is nothing to step through.
  prev.hidden = next.hidden = id.looks < 2;
  box.append(look, label);
  return box;
}
