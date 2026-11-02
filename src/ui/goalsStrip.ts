import { GOAL_SHORT } from '../config/goals';
import type { GoalResult } from '../sim/goals';
import { t } from '../i18n';

/**
 * Tonight's three goals with live progress, above the event feed: a star
 * fills when a goal is met so far. Updated with the HUD (four times a second),
 * and only the lines whose text changed are touched.
 */
export class GoalsStrip {
  readonly root: HTMLElement;
  private readonly rows: HTMLLIElement[] = [];
  private readonly scenario: HTMLParagraphElement;

  constructor() {
    this.root = document.createElement('section');
    this.root.className = 'goals-strip';
    this.root.setAttribute('aria-label', t('Tonight\'s goals'));
    const head = Object.assign(document.createElement('p'), { className: 'goals-head', textContent: t('Tonight\'s goals') });
    const list = document.createElement('ul');
    for (let i = 0; i < 3; i++) {
      const li = document.createElement('li');
      this.rows.push(li);
      list.append(li);
    }
    this.scenario = Object.assign(document.createElement('p'), { className: 'goals-scenario', hidden: true });
    this.root.append(head, list, this.scenario);
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
    this.scenario.hidden = !scenario;
    if (scenario && this.scenario.textContent !== scenario) this.scenario.textContent = scenario;
  }
}
