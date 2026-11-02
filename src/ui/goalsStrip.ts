import { GOAL_SHORT } from '../config/goals';
import type { GoalResult } from '../sim/goals';
import { t } from '../i18n';

/**
 * Tonight's three goals with live progress, above the event feed: a star
 * fills when a goal is met so far. The heading folds the list away, leaving
 * the stars as a summary (folded from the start on small screens); `onToggle`
 * hears each fold. Updated with the HUD (four times a second), and only the
 * lines whose text changed are touched.
 */
export class GoalsStrip {
  readonly root: HTMLElement;
  private readonly rows: HTMLLIElement[] = [];
  private readonly scenario: HTMLParagraphElement;
  private readonly head: HTMLButtonElement;
  private readonly stars: HTMLSpanElement;

  constructor(open: boolean, private readonly onToggle: (open: boolean) => void) {
    this.root = document.createElement('section');
    this.root.className = 'goals-strip';
    this.root.setAttribute('aria-label', t('Tonight\'s goals'));
    this.head = Object.assign(document.createElement('button'), { type: 'button', className: 'goals-head', textContent: t('Tonight\'s goals') });
    this.stars = Object.assign(document.createElement('span'), { className: 'goals-stars' });
    this.head.append(this.stars);
    this.head.addEventListener('click', () => {
      this.setOpen(this.root.dataset.open !== 'true');
      this.onToggle(this.root.dataset.open === 'true');
    });
    const head = this.head;
    const list = document.createElement('ul');
    for (let i = 0; i < 3; i++) {
      const li = document.createElement('li');
      this.rows.push(li);
      list.append(li);
    }
    this.scenario = Object.assign(document.createElement('p'), { className: 'goals-scenario', hidden: true });
    this.root.append(head, list, this.scenario);
    this.setOpen(open);
  }

  /** Opens or folds the list; says nothing to `onToggle`. */
  setOpen(open: boolean): void {
    if (this.root.dataset.open === String(open)) return;
    this.root.dataset.open = String(open);
    this.head.setAttribute('aria-expanded', String(open));
  }

  set(goals: readonly GoalResult[], scenario: string | null): void {
    goals.forEach((g, i) => {
      const li = this.rows[i];
      const text = `${g.met ? '★' : '☆'} ${GOAL_SHORT[g.id](g.target, g.value)}`;
      if (li.textContent !== text) {
        li.textContent = text;
        li.dataset.met = String(g.met);
      }
    });
    const stars = goals.map((g) => (g.met ? '★' : '☆')).join('');
    if (this.stars.textContent !== stars) {
      this.stars.textContent = stars;
      this.stars.setAttribute('aria-label', t('{n} of {all} met so far', { n: goals.filter((g) => g.met).length, all: goals.length }));
    }
    this.scenario.hidden = !scenario;
    if (scenario && this.scenario.textContent !== scenario) this.scenario.textContent = scenario;
  }
}
