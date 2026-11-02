import { GOAL_TEXT } from '../config/goals';
import type { Scenario } from '../config/scenarios';
import type { NightReport } from '../sim/goals';
import { plural, t } from '../i18n';
import { price } from './money';

/**
 * The night report at 08:00: how the night went, its three goals with a star
 * for each one met, and the next night's goals. A scenario's progress, or the
 * win, is shown with it. A modal box that stops the clock, like the big
 * events; Continue (or Escape) carries on.
 */
export class NightReportBox {
  private readonly dialog: HTMLDialogElement;

  constructor(parent: HTMLElement, private readonly onChange: (open: boolean) => void) {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'welcome event-popup night-report';
    this.dialog.setAttribute('aria-labelledby', 'night-report-title');
    this.dialog.addEventListener('close', () => this.onChange(false));
    parent.append(this.dialog);
  }

  get open(): boolean {
    return this.dialog.open;
  }

  show(r: NightReport, next: { id: keyof typeof GOAL_TEXT; target: number }[], scenario: Scenario | null, totalHelped: number): void {
    const p = (cls: string, text: string) => Object.assign(document.createElement('p'), { className: cls, textContent: text });
    const title = Object.assign(document.createElement('h2'), { id: 'night-report-title', textContent: t('Night {n}: morning report', { n: r.night }) });
    const stars = p('night-stars', `${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}`);
    stars.setAttribute('aria-label', plural(r.stars, ['{n} star of 3', '{n} stars of 3'], ['{n} gwiazdka z 3', '{n} gwiazdki z 3', '{n} gwiazdek z 3']));
    const facts = document.createElement('ul');
    facts.className = 'night-facts';
    const money = r.moneyEnd - r.moneyStart;
    for (const line of [
      plural(r.helped, ['{n} person helped', '{n} people helped'], ['Pomoc dla {n} osoby', 'Pomoc dla {n} osób', 'Pomoc dla {n} osób']),
      plural(r.turnedAway, ['{n} person turned away', '{n} people turned away'], ['{n} osoba odesłana', '{n} osoby odesłane', '{n} osób odesłanych']),
      t('Money: {start} to {end} ({change})', { start: price(r.moneyStart), end: price(r.moneyEnd), change: `${money >= 0 ? '+' : ''}${Math.round(money)}` }),
      t('Hours with a city service in the red: {h}', { h: r.redHours }),
      ...(r.deaths ? [plural(r.deaths, ['{n} person died outdoors', '{n} people died outdoors'], ['{n} osoba zmarła na ulicy', '{n} osoby zmarły na ulicy', '{n} osób zmarło na ulicy'])] : []),
    ]) facts.append(Object.assign(document.createElement('li'), { textContent: line }));
    const goals = document.createElement('ul');
    goals.className = 'night-goals';
    for (const g of r.goals) {
      const li = document.createElement('li');
      li.dataset.met = String(g.met);
      li.append(Object.assign(document.createElement('span'), { className: 'goal-mark', textContent: g.met ? '★' : '☆' }), document.createTextNode(GOAL_TEXT[g.id](g.target)));
      li.setAttribute('aria-label', `${g.met ? t('Met') : t('Missed')}: ${GOAL_TEXT[g.id](g.target)}`);
      goals.append(li);
    }
    const body: HTMLElement[] = [title, stars, facts, p('welcome-controls', t('Tonight\'s goals')), goals];
    if (scenario) {
      body.push(r.won
        ? p('welcome-lead night-won', t('Scenario won: {title}. The city carries on; play on as long as you like.', { title: scenario.title }))
        : p('welcome-controls', t('{title}: {nights} of {needNights} nights, {helped} of {needHelped} helped, {stars} of {needStars} stars.', {
          title: scenario.title, nights: r.night, needNights: scenario.nights, helped: totalHelped, needHelped: scenario.helped, stars: r.starsTotal, needStars: scenario.stars,
        })));
    }
    const nextList = document.createElement('ul');
    nextList.className = 'night-goals next';
    for (const g of next) nextList.append(Object.assign(document.createElement('li'), { textContent: GOAL_TEXT[g.id](g.target) }));
    body.push(p('welcome-controls', t('Next night')), nextList);
    const go = Object.assign(document.createElement('button'), { type: 'button', className: 'welcome-start', textContent: t('Continue') });
    go.addEventListener('click', () => this.dialog.close());
    this.dialog.replaceChildren(...body, go);
    this.dialog.showModal();
    this.onChange(true);
    go.focus();
  }
}
