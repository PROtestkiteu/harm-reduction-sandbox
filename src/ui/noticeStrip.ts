import { plural, t } from '../i18n';

/**
 * What the organisation was just told, where the player looks: the latest few
 * notices on top of the event feed, each for a couple of clock hours, and the
 * night's deaths outdoors once there is one. The same text again within a few
 * hours is not repeated, so a recurring notice (a volunteer leaving) is said
 * once and then stays quiet for a while. The full list stays in the
 * organisation sheet. Announced politely to screen readers.
 */
const KEEP = 3;
/** Clock minutes a notice stays up, and before the same text is shown again. */
const SHOW_FOR = 120;
const QUIET_FOR = 240;

const clockText = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
};

export class NoticeStrip {
  readonly root: HTMLElement;
  private readonly list: HTMLUListElement;
  private readonly deaths: HTMLParagraphElement;
  private readonly lastShown = new Map<string, number>();
  private items: { text: string; at: number; li: HTMLLIElement }[] = [];
  private deathCount = 0;

  constructor() {
    this.root = document.createElement('section');
    this.root.className = 'notice-strip';
    this.root.setAttribute('aria-label', t('Latest news for the project'));
    this.deaths = Object.assign(document.createElement('p'), { className: 'notice-deaths', hidden: true });
    this.list = document.createElement('ul');
    this.list.setAttribute('role', 'log');
    this.list.setAttribute('aria-live', 'polite');
    // Only the latest line shows; a press on the news shows the earlier ones too, and folds them again.
    this.root.dataset.open = 'false';
    this.list.tabIndex = 0;
    this.list.setAttribute('aria-expanded', 'false');
    this.list.dataset.hintAction = 'true';
    this.list.dataset.iconHint = t('Show the earlier news');
    const toggle = () => {
      const open = this.root.dataset.open !== 'true';
      this.root.dataset.open = String(open);
      this.list.setAttribute('aria-expanded', String(open));
    };
    this.list.addEventListener('click', toggle);
    this.list.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    this.root.append(this.deaths, this.list);
    this.root.hidden = true;
  }

  /** A notice from the organisation at `clock` (organisation minutes for the quiet period, clock minutes to show). */
  push(text: string, clock: number, now: number): void {
    const last = this.lastShown.get(text);
    if (last !== undefined && now - last < QUIET_FOR) return;
    this.lastShown.set(text, now);
    const li = document.createElement('li');
    const time = Object.assign(document.createElement('span'), { className: 'notice-time', textContent: clockText(clock) });
    li.append(time, document.createTextNode(text));
    this.list.prepend(li);
    this.items.unshift({ text, at: now, li });
    while (this.items.length > KEEP) this.items.pop()!.li.remove();
    this.root.hidden = false;
  }

  /** Drops notices older than a couple of hours, and shows the deaths count. */
  refresh(now: number, deaths: number): void {
    if (deaths !== this.deathCount) {
      this.deathCount = deaths;
      this.deaths.hidden = deaths === 0;
      this.deaths.textContent = plural(deaths, ['{n} person has died outdoors.', '{n} people have died outdoors.'], ['{n} osoba zmarła na ulicy.', '{n} osoby zmarły na ulicy.', '{n} osób zmarło na ulicy.']);
    }
    const keep = this.items.filter((i) => now - i.at < SHOW_FOR);
    for (const i of this.items) if (!keep.includes(i)) i.li.remove();
    this.items = keep;
    this.root.hidden = this.items.length === 0 && this.deathCount === 0;
  }

  /** After loading a save: start clean. */
  clear(): void {
    for (const i of this.items) i.li.remove();
    this.items = [];
    this.lastShown.clear();
  }
}
