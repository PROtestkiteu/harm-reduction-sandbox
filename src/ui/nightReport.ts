import { GOAL_TEXT } from '../config/goals';
import { scenarioProgress, type Scenario } from '../config/scenarios';
import type { NightReport } from '../sim/goals';
import { plural, t, LOCALE } from '../i18n';
import { price } from './money';
import { playerBadge, type PlayerPicture } from './playerBadge';

/**
 * The night report at 08:00: how the night went in a row of figures, then its
 * three goals (a star for each met), the scenario and the next night's goals,
 * each folded behind one line. A scenario's progress, or the
 * win, is shown with it. A modal box that stops the clock, like the big
 * events; Continue (or Escape) carries on.
 */
export class NightReportBox {
  private readonly dialog: HTMLDialogElement;

  constructor(parent: HTMLElement, private readonly onChange: (open: boolean) => void, private readonly picture?: PlayerPicture) {
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
    stars.dataset.iconHint = stars.getAttribute('aria-label')!;
    stars.tabIndex = 0;
    // The night in a few figures, each a tile: the number large, what it counts small under it.
    const money = r.moneyEnd - r.moneyStart;
    const tiles = document.createElement('div');
    tiles.className = 'night-tiles';
    const tile = (value: string, label: string, state: 'good' | 'bad' | '' = '', title = '') => {
      const d = document.createElement('div');
      d.className = 'night-tile';
      if (state) d.dataset.state = state;
      if (title) d.dataset.iconHint = title;
      d.append(Object.assign(document.createElement('strong'), { textContent: value }), Object.assign(document.createElement('span'), { textContent: label }));
      tiles.append(d);
    };
    if (r.care) {
      tile(`+${r.care.points}`, t('Reputation'), 'good');
      tile(String(r.care.bronze), t('Bronze support ratings'));
      tile(String(r.care.silver), t('Silver support ratings'));
      tile(String(r.care.gold), t('Gold support ratings'));
      tile(String(r.care.none), t('Unrated support visits'));
    }
    tile(String(r.helped), t('helped'), r.helped ? 'good' : '');
    tile(String(r.turnedAway), t('turned away'), r.turnedAway ? 'bad' : '');
    tile(`${money >= 0 ? '+' : '−'}${Math.abs(Math.round(money)).toLocaleString(LOCALE)}`, t('money'), money < 0 ? 'bad' : '', t('Money: {start} to {end}', { start: price(r.moneyStart), end: price(r.moneyEnd) }));
    tile(r.redHours.toLocaleString(LOCALE, { maximumFractionDigits: 1 }), t('hours in the red'), r.redHours > 4 ? 'bad' : '', t('Hours with a city service in the red'));
    if (r.district) tile(`${r.district.size.toLocaleString(LOCALE, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}×`, t('district, street {pct}%', { pct: Math.round(r.district.street * 100) }), '', t('The district: times the first night; the street scene in per cent.'));
    if (r.deaths) tile(String(r.deaths), t('died outdoors'), 'bad');

    // Tonight's goals, the scenario and the next night fold behind one line each.
    const fold = (summary: string, note: string, ...parts: HTMLElement[]) => {
      const d = document.createElement('details');
      d.className = 'sandbox-sub night-fold';
      const s = document.createElement('summary');
      s.append(Object.assign(document.createElement('span'), { className: 'fold-title', textContent: summary }), Object.assign(document.createElement('span'), { className: 'fold-note', textContent: note }));
      d.append(s, ...parts);
      return d;
    };
    const goals = document.createElement('ul');
    goals.className = 'night-goals';
    for (const g of r.goals) {
      const li = document.createElement('li');
      li.dataset.met = String(g.met);
      li.append(Object.assign(document.createElement('span'), { className: 'goal-mark', textContent: g.met ? '★' : '☆' }), document.createTextNode(GOAL_TEXT[g.id](g.target)));
      li.setAttribute('aria-label', `${g.met ? t('Met') : t('Missed')}: ${GOAL_TEXT[g.id](g.target)}`);
      li.dataset.iconHint = li.getAttribute('aria-label')!;
      goals.append(li);
    }
    // Your own read of the night, by the stars it earned.
    const verdict = r.won ? t('We did it. This city has a harm reduction service that works.')
      : [t('We lost the night. Before dusk, look at what to change.'), t('A hard night. Let us see what went wrong.'), t('Not bad. Tomorrow we fix what slipped.'), t('A good night. The funders will hear about this.')][r.stars];
    const head = document.createElement('div');
    head.className = 'night-head';
    head.append(title, stars);
    const body: HTMLElement[] = [...(this.picture ? [playerBadge(this.picture, verdict)] : []), head, tiles,
      fold(t('Tonight\'s goals'), t('{n} of 3 met', { n: r.stars }), goals)];
    if (scenario) {
      body.push(r.won
        ? p('welcome-lead night-won', t('Scenario won: {title}. The city carries on; play on as long as you like.', { title: scenario.title }))
        : fold(scenario.title, t('night {n} of {all}', { n: r.night, all: scenario.nights }), p('night-scenario', scenarioProgress(scenario, { nights: r.night, helped: totalHelped, stars: r.starsTotal, deaths: r.deathsTotal ?? 0, won: false, folded: r.folded ?? false }))));
    }
    const nextList = document.createElement('ul');
    nextList.className = 'night-goals next';
    for (const g of next) nextList.append(Object.assign(document.createElement('li'), { textContent: GOAL_TEXT[g.id](g.target) }));
    body.push(fold(t('Next night'), plural(next.length, ['{n} goal', '{n} goals'], ['{n} cel', '{n} cele', '{n} celów']), nextList));
    const go = Object.assign(document.createElement('button'), { type: 'button', className: 'welcome-start', textContent: t('Continue') });
    go.addEventListener('click', () => this.dialog.close());
    this.dialog.replaceChildren(...body, go);
    this.dialog.showModal();
    this.onChange(true);
    go.focus();
  }
}
