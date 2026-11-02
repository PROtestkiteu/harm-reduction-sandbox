import { NEED_IDS, NEEDS } from '../config/matching';
import { MORALE } from '../config/morale';
import { PATROL, PATROL_SPOTS, type PatrolSpot } from '../config/patrol';
import { ORG } from '../config/organisation';
import { STANDING, TIER_NAMES, UNLOCK_NAMES, UNLOCK_TIER, type Unlock } from '../config/standing';
import { STORM, STORM_TEXT, type StormPrep } from '../config/storm';
import { SUPPLIES, SUPPLY_IDS, type SupplyId } from '../config/supplies';
import { t } from '../i18n';
import { formatClock } from '../sim/clock';
import type { Stakes } from '../sim/stakes';
import type { Team } from '../sim/team';
import { price } from './money';

export interface StakesCallbacks {
  /** Queued by the app and applied between simulation steps. */
  onOrder(id: SupplyId): void;
  onStandingOrder(id: SupplyId, on: boolean): void;
  onPrepare(p: StormPrep): void;
  /** Sends the foot patrol from its table to a spot. */
  onPatrol(spot: PatrolSpot): void;
}

export interface StakesView {
  stakes: Stakes;
  team: Team;
  budget: number;
  /** `org.now` and the clock, to show deadlines as clock times. */
  now: number;
  clock: number;
  /** Nights survived: the storm is tonight on its own night, tomorrow before it. */
  nights: number;
  /** The foot patrol: whether it runs at all, can go now, where it can go, and where it is. */
  patrol: { running: boolean; ready: boolean; spots: readonly PatrolSpot[]; out: PatrolSpot | null; until: number; reached: number };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function setText(e: HTMLElement, text: string): void {
  if (e.textContent !== text) e.textContent = text;
}

function setDisabled(b: HTMLButtonElement, off: boolean): void {
  if (b.disabled !== off) b.disabled = off;
}

const PREP_LABEL: Record<StormPrep, () => string> = {
  beds: () => t('Emergency beds at the drop-in ({price}): {n} more places, fewer deaths', { price: price(STORM.prepare.beds.cost), n: STORM.prepare.beds.places }),
  warn: () => t('Warn the street ({n} leaflets): fewer deaths', { n: STORM.prepare.warn.leaflets }),
  standby: () => t('Volunteers on call ({price}): {n} more hands for the night', { price: price(STORM.prepare.standby.cost), n: STORM.prepare.standby.volunteers }),
};

/**
 * What is at stake, in the organisation sheet: the coming storm and what is
 * ready for it, the project's standing and what it opens, the team's morale
 * and the skills missing tonight, and supplies on the shelf. Built once;
 * each refresh writes text and button states only when they change.
 */
export class StakesSection {
  readonly root: HTMLElement;
  private readonly stormBox: HTMLElement;
  private readonly stormHead: HTMLElement;
  private readonly stormLine: HTMLElement;
  private readonly prep = {} as Record<StormPrep, HTMLButtonElement>;
  private readonly standingLine: HTMLElement;
  private readonly unlockLine: HTMLElement;
  private readonly moraleLine: HTMLElement;
  private readonly needsLine: HTMLElement;
  private readonly hardcoreLine: HTMLElement;
  private readonly patrolBox: HTMLElement;
  private readonly patrolLine: HTMLElement;
  private readonly patrolBtns = {} as Record<PatrolSpot, HTMLButtonElement>;
  private readonly standingBox: HTMLElement;
  private readonly standingSummary: HTMLElement;
  private readonly suppliesSummary: HTMLElement;
  private readonly suppliesBox: HTMLElement;
  private readonly rows = {} as Record<SupplyId, { stock: HTMLElement; order: HTMLButtonElement; standing: HTMLInputElement }>;

  constructor(cb: StakesCallbacks) {
    this.root = el('div', 'stakes');
    this.stormBox = el('div', 'stakes-storm');
    this.stormBox.hidden = true;
    this.stormBox.setAttribute('role', 'region');
    this.stormHead = el('h3', 'level');
    this.stormLine = el('p', 'factor-summary');
    const prepRow = el('div', 'org-actions');
    for (const p of Object.keys(STORM.prepare) as StormPrep[]) {
      const b = el('button', 'btn org-action', PREP_LABEL[p]());
      b.type = 'button';
      b.id = `stakes-prep-${p}`;
      b.addEventListener('click', () => cb.onPrepare(p));
      prepRow.append(b);
      this.prep[p] = b;
    }
    this.stormBox.append(this.stormHead, this.stormLine, prepRow);

    // The foot patrol: a reply per spot it can walk to; only the ones open now show.
    this.patrolBox = el('div', 'stakes-patrol');
    this.patrolBox.hidden = true;
    this.patrolBox.append(el('h3', 'level', t('Foot patrol')));
    this.patrolLine = el('p', 'factor-summary');
    const patrolRow = el('div', 'org-actions');
    for (const spot of PATROL_SPOTS) {
      const b = el('button', 'btn org-action', t('Send to {spot} ({price})', { spot: PATROL.spots[spot].label, price: price(PATROL.cost) }));
      b.type = 'button';
      b.id = `stakes-patrol-${spot}`;
      b.title = PATROL.spots[spot].does;
      b.hidden = true;
      b.addEventListener('click', () => cb.onPatrol(spot));
      patrolRow.append(b);
      this.patrolBtns[spot] = b;
    }
    this.patrolBox.append(this.patrolLine, patrolRow);

    // Standing and supplies fold behind one line each, so the sheet stays short.
    const standing = el('details', 'sandbox-sub stakes-standing');
    this.standingBox = standing;
    this.standingSummary = el('summary', undefined, t('Standing in the city'));
    standing.append(this.standingSummary);
    this.standingLine = el('p', 'org-summary');
    this.unlockLine = el('p', 'factor-summary');
    standing.append(this.standingLine, this.unlockLine);

    const morale = el('div', 'stakes-morale');
    morale.append(el('h3', 'level', t('Team morale')));
    this.moraleLine = el('p', 'org-summary');
    this.needsLine = el('p', 'factor-summary');
    this.hardcoreLine = el('p', 'factor-summary', t('Hardcore: if the whole team quits, or every place you started with stays shut for {hours} hours, the project folds and the game ends.', { hours: Math.round(ORG.foldAfterShut / 60) }));
    this.hardcoreLine.hidden = true;
    morale.append(this.moraleLine, this.needsLine, this.hardcoreLine);

    const supplies = el('details', 'sandbox-sub stakes-supplies');
    this.suppliesBox = supplies;
    this.suppliesSummary = el('summary', undefined, t('Supplies'));
    supplies.append(this.suppliesSummary);
    const list = el('ul', 'team-list');
    for (const id of SUPPLY_IDS) {
      const s = SUPPLIES[id];
      const li = el('li', 'team-member');
      const who = el('div', 'team-who');
      const name = el('p', 'team-name');
      name.append(el('strong', undefined, s.label));
      name.title = s.does;
      const stock = el('p', 'team-status');
      who.append(name, stock);
      const order = el('button', 'btn org-action', t('Order {n} ({price})', { n: s.batch, price: price(s.price) }));
      order.type = 'button';
      order.id = `stakes-order-${id}`;
      order.addEventListener('click', () => cb.onOrder(id));
      const label = el('label', 'stakes-standing-order');
      const box = el('input');
      box.type = 'checkbox';
      box.addEventListener('change', () => cb.onStandingOrder(id, box.checked));
      label.append(box, el('span', undefined, t('Reorder when low')));
      li.append(who, order, label);
      list.append(li);
      this.rows[id] = { stock, order, standing: box };
    }
    supplies.append(el('p', 'factor-summary', t('Bought ahead in batches and used up per visit. An empty shelf means people go without.')), list);
    this.root.append(this.stormBox, this.patrolBox, standing, morale, supplies);
  }

  update(v: StakesView): void {
    const { stakes, team } = v;
    const storm = stakes.storm;
    const on = storm.phase !== 'none' && storm.kind !== null;
    if (this.stormBox.hidden === on) this.stormBox.hidden = !on;
    if (on) {
      const name = STORM_TEXT[storm.kind!].name;
      setText(this.stormHead, storm.phase === 'peak'
        ? t('Now: {name}, until {time}', { name: name[0].toUpperCase() + name.slice(1), time: formatClock(STORM.to) })
        : v.nights === storm.nextNight
          ? t('Coming: {name}, tonight {from} to {to}', { name, from: formatClock(STORM.from), to: formatClock(STORM.to) })
          : t('Coming: {name}, tomorrow night {from} to {to}', { name, from: formatClock(STORM.from), to: formatClock(STORM.to) }));
      const stock = STORM_TEXT[storm.kind!].stock;
      setText(this.stormLine, t('Have staff rested, the shelf stocked ({item}: {n}) and the low-threshold places open and staffed. Each person turned away tonight may not survive it.', { item: SUPPLIES[stock].label.toLowerCase(), n: stakes.supplies.stock[stock] }));
      for (const p of Object.keys(this.prep) as StormPrep[]) {
        const done = storm.prepared.has(p);
        const b = this.prep[p];
        setText(b, done ? t('Ready: {what}', { what: PREP_LABEL[p]().replace(/ \(.*$/, '') }) : PREP_LABEL[p]());
        setDisabled(b, done || (p === 'warn' ? !stakes.supplies.has('leaflets', STORM.prepare.warn.leaflets) : v.budget < STORM.prepare[p].cost));
      }
    }

    const p = v.patrol;
    if (this.patrolBox.hidden === p.running) this.patrolBox.hidden = !p.running;
    if (p.running) {
      setText(this.patrolLine, p.out
        ? t('Out at {spot} until {time}: {n} reached so far. The table is shut meanwhile.', { spot: PATROL.spots[p.out].label, time: formatClock(v.clock + p.until - v.now), n: p.reached })
        : p.ready
          ? t('At its table. Send it out for {hours} hours to reach people where they are, or right-click anywhere on the map; the table shuts meanwhile.', { hours: PATROL.hours })
          : t('Needs its table open and someone on shift there before it can go out.'));
      for (const spot of PATROL_SPOTS) {
        const b = this.patrolBtns[spot];
        // Anywhere else on the street is a right-click on the map ("Send the foot patrol here"), not a reply here.
        const show = spot !== 'street' && !p.out && p.ready && p.spots.includes(spot);
        if (b.hidden === show) b.hidden = !show;
        setDisabled(b, v.budget < PATROL.cost);
      }
    }

    // Each part shows from the night its system comes into play (config/intro.ts).
    const showStanding = stakes.introduced('standing');
    const showSupplies = stakes.introduced('supplies');
    const showNeeds = stakes.introduced('matching');
    if (this.standingBox.hidden === showStanding) this.standingBox.hidden = !showStanding;
    if (this.suppliesBox.hidden === showSupplies) this.suppliesBox.hidden = !showSupplies;
    if (this.needsLine.hidden === showNeeds) this.needsLine.hidden = !showNeeds;
    if (this.hardcoreLine.hidden === stakes.hardcore) this.hardcoreLine.hidden = !stakes.hardcore;
    const st = stakes.standing;
    const next = st.toNext;
    setText(this.standingLine, next === null
      ? t('{tier}: {points} points, the top. Donations bring in {pct}% of the usual.', { tier: TIER_NAMES[st.tier], points: Math.round(st.points), pct: Math.round(st.giving * 100) })
      : t('{tier}: {points} points, {next} more to {nextTier}. Donations bring in {pct}% of the usual.', { tier: TIER_NAMES[st.tier], points: Math.round(st.points), next, nextTier: TIER_NAMES[st.tier + 1], pct: Math.round(st.giving * 100) }));
    setText(this.standingSummary, t('Standing: {tier}', { tier: TIER_NAMES[st.tier] }));
    const empty = SUPPLY_IDS.filter((id) => stakes.supplies.stock[id] === 0).map((id) => SUPPLIES[id].label.toLowerCase());
    setText(this.suppliesSummary, empty.length ? t('Supplies: out of {list}', { list: empty.join(', ') }) : t('Supplies: naloxone {n}, kits {k}', { n: stakes.supplies.stock.naloxone, k: stakes.supplies.stock.kits }));
    this.suppliesSummary.dataset.state = empty.length ? 'broke' : 'ok';
    const locked = (Object.keys(UNLOCK_TIER) as Unlock[]).filter((u) => !st.allows(u));
    setText(this.unlockLine, (locked.length
      ? t('Still closed: {list}.', { list: locked.map((u) => t('{what} ({tier})', { what: UNLOCK_NAMES[u], tier: TIER_NAMES[UNLOCK_TIER[u]] })).join(', ') })
      : t('Everything is open to you.')) + ' ' + t('Each person helped adds a point; each turned away takes {away}, a death {death}.', { away: STANDING.turnedAway, death: STANDING.death }));

    const shaken = team.members.filter((m) => m.morale < MORALE.shakenBelow).length;
    setText(this.moraleLine, team.members.length
      ? t('{pct}% on average. {shaken} shaken. Helping people lifts it; people turned away and deaths drag it down; below {quit}% a worker quits.', { pct: Math.round(team.morale * 100), shaken, quit: Math.round(MORALE.leaveBelow * 100) })
      : t('Nobody is left in the team.'));
    const missing = NEED_IDS.filter((id) => stakes.unmatched[id] > 0).sort((a, b) => stakes.unmatched[b] - stakes.unmatched[a]);
    setText(this.needsLine, missing.length
      ? t('Tonight, without the right worker on shift: {list}. Pin someone with that skill there.', { list: missing.map((id) => `${NEEDS[id].label} ${stakes.unmatched[id]}`).join(', ') })
      : t('Tonight everyone who needed a particular skill found it ({n} matched).', { n: stakes.matchedTonight }));

    for (const id of SUPPLY_IDS) {
      const r = this.rows[id];
      const at = stakes.supplies.arriving[id];
      const n = stakes.supplies.stock[id];
      setText(r.stock, at !== undefined ? t('{n} on the shelf · {batch} arriving {time}', { n, batch: SUPPLIES[id].batch, time: formatClock(v.clock + at - v.now) }) : t('{n} on the shelf', { n }));
      r.stock.dataset.state = n === 0 ? 'broke' : n < SUPPLIES[id].reorderAt ? 'short' : 'ok';
      setDisabled(r.order, at !== undefined || v.budget < SUPPLIES[id].price);
      if (document.activeElement !== r.standing && r.standing.checked !== stakes.supplies.standing[id]) r.standing.checked = stakes.supplies.standing[id];
    }
  }
}
