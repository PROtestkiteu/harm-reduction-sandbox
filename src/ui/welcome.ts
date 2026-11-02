import { t } from '../i18n';
import { playerBadge, type PlayerPicture } from './playerBadge';

const SEEN_KEY = 'hrp-welcome-seen';

const POINTS = [
  t('Every visit costs money and wears the place down.'),
  t('Invest to fill the bar under a name: full means upgrade, empty means downgrade.'),
  t('Run out of money and the game ends.'),
];

/**
 * The welcome box: what the game is, in a few lines. Shown on a first visit
 * and from the "How it works" button any time after. A native modal dialog,
 * so focus, Escape and the backdrop behave as the platform expects.
 */
export class Welcome {
  private readonly dialog: HTMLDialogElement;

  constructor(parent: HTMLElement, private readonly onChange: (open: boolean) => void, private readonly picture?: PlayerPicture) {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'welcome';
    this.dialog.setAttribute('aria-labelledby', 'welcome-title');
    const title = document.createElement('h2');
    title.id = 'welcome-title';
    title.textContent = t('A harm reduction non-profit simulator');
    const lead = document.createElement('p');
    lead.className = 'welcome-lead';
    lead.textContent = t('The challenge: more demand can easily mean less money, not more.');
    const list = document.createElement('ul');
    for (const text of POINTS) {
      const li = document.createElement('li');
      li.textContent = text;
      list.append(li);
    }
    const controls = document.createElement('p');
    controls.className = 'welcome-controls';
    controls.textContent = t('Tap a place or person. Long press or right-click for actions.');
    const luck = document.createElement('p');
    luck.className = 'welcome-luck';
    luck.textContent = t('Good luck!');
    const start = document.createElement('button');
    start.type = 'button';
    start.className = 'welcome-start';
    start.textContent = t('Start');
    start.addEventListener('click', () => this.dialog.close());
    this.dialog.append(title, lead, list, controls, luck, start);
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
    // You, introduced on the first page: the panel speaks for you whenever nothing is selected.
    if (this.picture && !this.dialog.querySelector('.player-badge')) {
      this.dialog.prepend(playerBadge(this.picture, t('I run this project. When nothing is selected, the side panel is us: it says what needs doing next.')));
    }
    this.dialog.showModal();
    this.onChange(true);
  }
}
