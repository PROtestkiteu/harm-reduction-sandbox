import { serviceNeeds, type Need } from '../config/needs';
import { METER_ORDER, NEED_ICONS, meterState, needsFor } from './needIcons';
import { GRANT_IDS, GRANTS, ORG, RECRUIT, recruitChance, type ApplicationContext, type GrantId, type RecruitId } from '../config/organisation';
import { price } from './money';
import type { DriveView } from './snapshot';
import type { FavourId } from '../config/favours';
import { LOCALE, plural, t } from '../i18n';
import type { Organisation } from '../sim/organisation';
import type { ServiceModel } from '../sim/simulation';
import { SERVICE_IDS, type ServiceId } from '../sim/types';
import { Team, TRAITS, TIRED, type Assignment } from '../sim/team';
import { formatClock } from '../sim/clock';
import { displayName, NAME_MAX, rename } from './names';

export interface OrgPanelCallbacks {
  /** Queued by the app and applied between simulation steps. */
  onRecruit(id: RecruitId): void;
  onLetGo(): void;
  onApply(id: GrantId): void;
  onReopen(id: ServiceId): void;
  /** Send a named worker somewhere, to rest, or back to automatic placement. */
  onAssign(member: number, to: Assignment): void;
  /** Open the organisation's sheet. */
  onOpen(): void;
  /** Starts a donation drive. */
  onDrive(): void;
  /** Uses a favour with city hall. */
  onFavour(id: FavourId): void;
}

export interface OrgView {
  org: Organisation;
  /** The four city meters, 0 to 1 (police, medics, sobering: pressure; district: how it is doing). */
  stress: Record<Need, number>;
  services: Record<ServiceId, ServiceModel>;
  clock: number;
  incomePerHour: number;
  /** Running costs now: the base for every place plus the strain of a busy street on open ones. */
  runningPerHour: number;
  /** Paid staff drawing a wage now. */
  payroll: number;
  applicationContext: ApplicationContext;
  team: Team;
  drive: DriveView;
  /** City hall favours: how many held, whether one is owed, and what can be asked. */
  favours: { held: number; owed: boolean; items: { id: FavourId; label: string }[] };
}

interface MemberRow {
  row: HTMLElement;
  status: HTMLElement;
  energy: HTMLElement;
  select: HTMLSelectElement;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Services that can close down for lack of money, and how their relaunch reads. */
type Relaunchable = 'clubHr' | 'outreach' | 'dropIn';
const RELAUNCH: Record<Relaunchable, { offer: string; pending: string }> = {
  dropIn: { offer: t('Relaunch the drop-in centre ({price}, about {hours} h)'), pending: t('Relaunching the drop-in centre: ready {time}') },
  outreach: { offer: t('Relaunch the outreach camper ({price}, about {hours} h)'), pending: t('Relaunching the outreach camper: ready {time}') },
  clubHr: { offer: t('Relaunch the club stand ({price}, about {hours} h)'), pending: t('Relaunching the club stand: ready {time}') },
};
const SHORT_NAMES: Record<ServiceId, string> = { dropIn: t('drop-in'), outreach: t('camper'), clubHr: t('stand'), footPatrol: t('patrol'), drugChecking: t('checking'), shelter: t('shelter'), clinic: t('clinic') };
/** Where a worker is, as in "At the stand · energy 80%". */
/** Options in a worker's "where they work" picker. */
const PICK_NAMES: Record<ServiceId, string> = { dropIn: t('Drop-in'), outreach: t('Camper'), clubHr: t('Stand'), footPatrol: t('Patrol'), drugChecking: t('Checking'), shelter: t('Shelter'), clinic: t('Clinic') };

const money = (v: number) => price(v);
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.round(Math.abs(v)).toLocaleString(LOCALE)}`;

/** Writes text only when it changed, so per-refresh updates cause no layout work. */
function setText(e: HTMLElement, text: string): void {
  if (e.textContent !== text) e.textContent = text;
}

function setAttr(e: Element, name: string, value: string): void {
  if (e.getAttribute(name) !== value) e.setAttribute(name, value);
}

interface GrantRow {
  status: HTMLElement;
  button: HTMLButtonElement;
}

const WORKS_AT: [Assignment, string][] = [['auto', t('Automatic')], ...SERVICE_IDS.map((id) => [id, PICK_NAMES[id]] as [Assignment, string]), ['rest', t('Rest')]];

/**
 * The organisation: an always-visible status bar (budget and staff) and a
 * sheet of its own to recruit, let staff go and apply for funding.
 */
export class OrgPanel {
  readonly bar: HTMLButtonElement;
  readonly section: HTMLFieldSetElement;
  private readonly summary: HTMLElement;
  private readonly staff: HTMLElement;
  private readonly recruiting: HTMLElement;
  private readonly log: HTMLElement;
  private readonly grants = {} as Record<GrantId, GrantRow>;
  private readonly recruitBtns = {} as Record<RecruitId, HTMLButtonElement>;
  private readonly closed: HTMLElement;
  private readonly reopen = {} as Record<Relaunchable, { button: HTMLButtonElement; label: HTMLElement }>;
  private readonly teamList: HTMLElement;
  private readonly nameInput: HTMLInputElement;
  private readonly moneyStat: HTMLElement;
  private readonly staffStat: HTMLElement;
  private readonly shiftStat: HTMLElement;
  private readonly teamSummary: HTMLElement;
  private teamKey = '';
  private readonly memberRows = new Map<number, MemberRow>();
  private readonly cb: OrgPanelCallbacks;
  private readonly meters = {} as Record<Need, { root: HTMLElement; fill: HTMLElement }>;
  private readonly meterRow: HTMLElement;
  private readonly nameRow: HTMLElement;
  private readonly driveBtn: HTMLButtonElement;
  private readonly favourBox: HTMLElement;
  private readonly favourLine: HTMLElement;
  private readonly favourActions: HTMLElement;
  private favourKey = '';

  constructor(cb: OrgPanelCallbacks) {
    this.cb = cb;
    this.bar = el('button', 'org-bar');
    this.bar.type = 'button';
    this.bar.title = t('Organisation: money and staff.');
    this.bar.addEventListener('click', () => cb.onOpen());

    this.section = el('fieldset', 'sandbox-group org');
    this.section.id = 'org-section';
    this.section.append(el('legend', undefined, t('Organisation')));
    // The organisation's name is the heading, and it can be edited in place.
    this.nameInput = el('input', 'org-name');
    this.nameInput.type = 'text';
    this.nameInput.maxLength = NAME_MAX;
    this.nameInput.value = displayName('org', 'name', t('Your organisation'));
    this.nameInput.setAttribute('aria-label', t('Organisation name'));
    this.nameInput.title = t('Click to rename your organisation');
    const saveName = () => {
      rename('org', 'name', this.nameInput.value);
      this.nameInput.value = displayName('org', 'name', t('Your organisation'));
    };
    this.nameInput.addEventListener('change', saveName);
    this.nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.nameInput.blur(); });
    // A pencil beside the name, as for places and people: it puts the name up for editing.
    const pencil = el('button', 'rename-pencil');
    pencil.type = 'button';
    pencil.setAttribute('aria-label', t('Rename'));
    pencil.title = t('Click to rename your organisation');
    pencil.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm17.7-10.2a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
    pencil.addEventListener('click', () => { this.nameInput.focus(); this.nameInput.select(); });
    const nameRow = el('div', 'org-name-row');
    nameRow.append(this.nameInput, pencil);
    // The city's four meters, as at the top of the screen: what the organisation is up against.
    const meters = el('div', 'stress-row org-meters');
    meters.setAttribute('role', 'group');
    meters.setAttribute('aria-label', t('City services under pressure'));
    for (const key of METER_ORDER) {
      const m = el('span', 'stress');
      m.dataset.key = key;
      const icon = el('span', 'stress-icon');
      icon.innerHTML = NEED_ICONS[key];
      const bar = el('span', 'stress-bar');
      const fill = el('span', 'stress-fill');
      bar.append(fill);
      m.append(icon, bar);
      meters.append(m);
      this.meters[key] = { root: m, fill };
    }
    this.meterRow = meters;
    this.nameRow = nameRow;
    // Three figures at a glance, then one small line on where money goes.
    const stats = el('div', 'org-stats');
    const stat = (label: string) => {
      const tile = el('div', 'org-stat');
      const value = el('strong');
      tile.append(value, el('span', undefined, label));
      stats.append(tile);
      return value;
    };
    this.moneyStat = stat(t('money'));
    this.staffStat = stat(t('paid + volunteers'));
    this.shiftStat = stat(t('on shift / wanted'));
    this.summary = el('p', 'org-summary');
    this.staff = el('p', 'org-staff');
    this.staff.hidden = true;
    this.recruiting = el('p', 'org-recruiting');
    const actions = el('div', 'org-actions');
    for (const id of Object.keys(RECRUIT) as RecruitId[]) {
      const r = RECRUIT[id];
      const b = el('button', 'btn org-action', id === 'hirePaid'
        // What hiring costs now and what it adds to the outgoings every hour after.
        // The chance that someone comes, always in brackets before the money is spent.
        ? t('Hire paid: {price}, then {wage}/h ({chance}%)', { price: price(r.cost), wage: price(ORG.wagePerHour), chance: Math.round(recruitChance(id) * 100) })
        : t('Find volunteers: {price}, unpaid ({chance}%)', { price: price(r.cost), chance: Math.round(recruitChance(id) * 100) }));
      b.type = 'button';
      b.id = `org-${id}`;
      b.title = t('{label}: about {hours} h. {summary}', { label: r.label, hours: (Math.round(r.minutes / 60 * 10) / 10).toLocaleString(LOCALE), summary: r.summary });
      b.addEventListener('click', () => cb.onRecruit(id));
      this.recruitBtns[id] = b;
      actions.append(b);
    }
    const letGo = el('button', 'btn org-action', t('Let one go'));
    letGo.type = 'button';
    letGo.title = t('Saves {wage} per hour in wages.', { wage: price(ORG.wagePerHour) });
    letGo.id = 'org-letGo';
    letGo.addEventListener('click', () => cb.onLetGo());
    actions.append(letGo);
    // A donation drive: its price on the reply; the detail is in the confirm box.
    this.driveBtn = el('button', 'btn org-action org-drive');
    this.driveBtn.type = 'button';
    this.driveBtn.addEventListener('click', () => cb.onDrive());
    actions.append(this.driveBtn);
    // City hall favours: how many are held, and each one on offer as a reply.
    this.favourLine = el('p', 'org-favour-line');
    this.favourActions = el('div', 'org-actions org-favours');
    this.favourBox = el('div', 'org-favour-box');
    this.favourBox.append(this.favourLine, this.favourActions);

    // Services closed down when the money ran out: relaunch for a cost.
    this.closed = el('div', 'org-closed');
    this.closed.hidden = true;
    this.closed.append(el('h3', 'level', t('Closed down')));
    for (const id of Object.keys(RELAUNCH) as Relaunchable[]) {
      const b = el('button', 'btn org-action');
      const label = el('span', undefined, t(RELAUNCH[id].offer, { price: price(ORG.reopen.cost), hours: Math.round(ORG.reopen.minutes / 60) }));
      b.append(label, needsFor(serviceNeeds(id)));
      b.type = 'button';
      b.id = `org-reopen-${id}`;
      b.hidden = true;
      b.addEventListener('click', () => cb.onReopen(id));
      this.closed.append(b);
      this.reopen[id] = { button: b, label };
    }

    const grants = el('div', 'org-grants');
    grants.append(el('h3', 'level', t('Funding applications (long term)')));
    for (const id of GRANT_IDS) {
      const g = GRANTS[id];
      const row = el('div', 'org-grant');
      const head = el('div', 'org-grant-head');
      head.append(el('strong', undefined, g.label));
      const button = el('button', 'btn org-apply', t('Apply ({price})', { price: price(g.fee) }));
      button.type = 'button';
      button.id = `org-${id}`;
      button.addEventListener('click', () => cb.onApply(id));
      head.append(button);
      const detail = el('p', 'factor-summary', t('Decision after about {hours} h. {odds} If approved: {reward}.', { hours: Math.round(g.minutes / 60), odds: g.odds, reward: g.rewardText }));
      const status = el('p', 'org-grant-status');
      const sources = el('details', 'sources');
      sources.append(el('summary', undefined, t('Sources ({n})', { n: g.evidence.length })));
      const list = el('ul', 'cites');
      for (const c of g.evidence) {
        const li = el('li');
        li.append(el('strong', undefined, c.ref), el('span', undefined, ` ${c.note} `), el('span', 'cite-src', c.source));
        list.append(li);
      }
      sources.append(list);
      row.append(head, detail, status, sources);
      grants.append(row);
      this.grants[id] = { status, button };
    }
    this.log = el('ul', 'org-log');
    this.log.setAttribute('aria-live', 'polite');
    const note = el('p', 'note', t('Money is in illustrative units. Funding levels follow the library only as a ratio (project about a third of stable public funding).'));
    // The team by name: qualities, energy, and where each person works.
    const team = el('details', 'org-team');
    this.teamSummary = el('summary', undefined, t('Your team'));
    team.classList.add('sandbox-sub');
    team.append(this.teamSummary, el('p', 'factor-summary', t('Pin someone to a service or send them to rest. Automatic places people where they fit best, paid staff first; tired people go home until rested.')));
    this.teamList = el('ul', 'team-list');
    team.append(this.teamList);
    // The long lists fold behind a reply of their own.
    const fold = (label: string, part: HTMLElement) => {
      const sub = el('details', 'sandbox-sub');
      sub.append(el('summary', undefined, label), part);
      return sub;
    };
    this.section.append(this.nameRow, this.meterRow, stats, this.summary, this.recruiting, actions, this.favourBox, team, this.closed, fold(t('Funding applications'), grants), fold(t('What has happened'), this.log), note);
  }

  /** Per-refresh update; text-only writes. */
  update(v: OrgView): void {
    const o = v.org;
    const d = v.drive;
    setText(this.driveBtn, d.until ? t('Donation drive on till {time}', { time: d.until }) : d.again ? t('Next donation drive from {time}', { time: d.again }) : t('Donation drive ({price})', { price: price(d.cost) }));
    const driveOff = d.until !== null || d.again !== null || o.budget < d.cost;
    if (this.driveBtn.disabled !== driveOff) this.driveBtn.disabled = driveOff;
    const f = v.favours;
    setText(this.favourLine, f.held ? t('City hall favours: {n}. City hall asks something back later.', { n: f.held }) : f.owed ? t('No favour now: city hall is owed one.') : t("No favour now: agree to city hall's next request to earn one."));
    // The replies are built once per set of favours; only whether they can be used changes.
    const key = f.items.map((i) => i.id).join('|');
    if (key !== this.favourKey) {
      this.favourKey = key;
      this.favourActions.replaceChildren(...f.items.map((item) => {
        const b = el('button', 'btn org-action', item.label);
        b.type = 'button';
        b.dataset.favour = item.id;
        b.addEventListener('click', () => this.cb.onFavour(item.id));
        return b;
      }));
    }
    for (const b of this.favourActions.querySelectorAll('button')) if (b.disabled === !!f.held) b.disabled = !f.held;
    for (const key of METER_ORDER) {
      const { root, fill } = this.meters[key];
      const w = `${Math.round(v.stress[key] * 100)}%`;
      if (fill.style.width !== w) fill.style.width = w;
      const state = meterState(key, v.stress[key]);
      if (root.dataset.state !== state) { root.dataset.state = state; fill.dataset.state = state; }
    }
    const assigned = Object.values(v.services).reduce((n, s) => n + s.assigned, 0);
    const wanted = Object.values(v.services).reduce((n, s) => n + (s.closedReason === null || s.closedReason === 'noStaff' ? s.requested : 0), 0);
    const short = Math.max(0, wanted - assigned);
    const budget = `${money(o.budget)} (${signed(o.netPerHour)}/h)`;
    const next = o.nextClosure(v.clock);
    const closedText = o.closedDown.size ? ` · ${t('{n} closed down', { n: o.closedDown.size })}` : '';
    const shortText = short ? ` · ${plural(short, ['{n} short', '{n} short'], ['brakuje {n} osoby', 'brakuje {n} osób', 'brakuje {n} osób'])}` : '';
    const brokeText = o.broke ? ` · ${next ? t('out of money, {name} closes {time}', { name: SHORT_NAMES[next.service], time: formatClock(next.at) }) : t('out of money')}` : '';
    setText(this.bar, `${t('Budget {budget} · Staff {paid} paid + {volunteers} volunteers', { budget, paid: o.paid, volunteers: o.volunteers })}${shortText}${brokeText}${closedText}`);
    this.bar.dataset.state = o.broke || o.closedDown.size ? 'broke' : short ? 'short' : 'ok';
    const anyClosed = o.closedDown.size > 0;
    if (this.closed.hidden === anyClosed) this.closed.hidden = !anyClosed;
    for (const id of Object.keys(this.reopen) as Relaunchable[]) {
      const pending = o.reopening.find((r) => r.id === id);
      const show = o.closedDown.has(id);
      const r = this.reopen[id];
      if (r.button.hidden === show) r.button.hidden = !show;
      const label = pending ? t(RELAUNCH[id].pending, { time: formatClock(o.clockAt(pending.readyAt, v.clock)) }) : t(RELAUNCH[id].offer, { price: price(ORG.reopen.cost), hours: Math.round(ORG.reopen.minutes / 60) });
      setText(r.label, label);
      r.button.disabled = !!pending || o.budget < ORG.reopen.cost;
    }
    setText(this.moneyStat, `${money(o.budget)} ${signed(o.netPerHour)}/h`);
    this.moneyStat.dataset.state = o.broke ? 'broke' : o.netPerHour < 0 ? 'falling' : 'ok';
    setText(this.staffStat, `${o.paid} + ${o.volunteers}`);
    setText(this.shiftStat, `${assigned} / ${wanted}`);
    this.shiftStat.dataset.state = short ? 'short' : 'ok';
    setText(this.summary, t('In {total}/h (funding {funding}, grants {grants}) · wages {wages}/h · running costs {running}/h', { total: money(v.incomePerHour + o.grantIncome), funding: money(v.incomePerHour), grants: money(o.grantIncome), wages: money(v.payroll * ORG.wagePerHour), running: money(v.runningPerHour) }));
    const recruiting = o.recruiting.length ? t('Recruiting: {list}.', { list: o.recruiting.map((r) => t('{what} until {time}', { what: RECRUIT[r.id].label.toLowerCase(), time: formatClock(o.clockAt(r.readyAt, v.clock)) })).join('; ') }) : '';
    // A paid hire on the way: the wage bill once they start.
    const hires = o.recruiting.filter((r) => r.id === 'hirePaid').length;
    const after = hires ? ` ${t('Wages rise to {wages}/h when they start.', { wages: money((o.paid + hires) * ORG.wagePerHour) })}` : '';
    setText(this.recruiting, recruiting + after);
    if (this.recruiting.hidden !== !recruiting) this.recruiting.hidden = !recruiting;
    for (const id of GRANT_IDS) {
      const state = o.applications[id];
      // As the decision weighs it: the grant's own odds, lowered after a media attack.
      const chance = Math.round(GRANTS[id].chance(v.applicationContext) * (v.applicationContext.reputation ?? 1) * 100);
      setText(this.grants[id].button, t('Apply ({price}, {chance}%)', { price: price(GRANTS[id].fee), chance }));
      const text =
        state.status === 'pending' ? t('Pending: decision at {time}. Chance now about {chance}%.', { time: formatClock(o.clockAt(state.decidesAt, v.clock)), chance })
        : state.status === 'approved' ? t('Approved at {time}.', { time: formatClock(state.at) })
        : state.status === 'declined' ? t('Declined at {time}. Chance now about {chance}%.', { time: formatClock(state.at), chance })
        : t('Chance now about {chance}%.', { chance });
      setText(this.grants[id].status, text);
      const blocked = state.status === 'pending' || state.status === 'approved';
      // Greyed out while the fee is more than the money on hand.
      const tooDear = o.budget < GRANTS[id].fee;
      if (this.grants[id].button.disabled !== tooDear) this.grants[id].button.disabled = tooDear;
      if (this.grants[id].button.hidden !== blocked) this.grants[id].button.hidden = blocked;
    }
    for (const id of Object.keys(this.recruitBtns) as RecruitId[]) {
      const dear = o.budget < RECRUIT[id].cost;
      if (this.recruitBtns[id].disabled !== dear) this.recruitBtns[id].disabled = dear;
    }
    this.updateTeam(v.team);
    const logText = o.log.map((n) => `${formatClock(n.at)} ${n.text}`).join('\n');
    if (this.log.dataset.text !== logText) {
      this.log.dataset.text = logText;
      this.log.replaceChildren(...o.log.map((n) => el('li', undefined, `${formatClock(n.at)} ${n.text}`)));
    }
  }

  /** Rows are rebuilt only when people join or leave; otherwise only their text changes. */
  private updateTeam(team: Team): void {
    const key = team.members.map((m) => m.id).join(',');
    if (key !== this.teamKey) {
      this.teamKey = key;
      this.memberRows.clear();
      this.teamList.replaceChildren(...team.members.map((m) => {
        const row = el('li', 'team-member');
        const who = el('div', 'team-who');
        // Two short lines: who and what they are good at, then their contract and where they work.
        const name = el('p', 'team-name');
        name.append(el('strong', undefined, m.name), el('span', 'team-traits', ` · ${m.traits.map((x) => TRAITS[x].label).join(', ')}`));
        name.title = m.traits.map((x) => `${TRAITS[x].label}: ${TRAITS[x].detail}`).join('\n');
        const status = el('p', 'team-status');
        who.append(name, status);
        const energy = el('span', 'team-energy');
        energy.setAttribute('role', 'img');
        const select = el('select', 'team-assign');
        select.setAttribute('aria-label', t('Where {name} works', { name: m.name }));
        // Each service shows how well this person works there, so strengths and weak spots are visible.
        for (const [value, text] of WORKS_AT) {
          const svc = value === 'auto' || value === 'rest' ? null : value;
          const o = el('option', undefined, svc ? t('{place} ({pct}%)', { place: text, pct: Math.round(Team.traitFit(m, svc) * 100) }) : text);
          o.value = value;
          select.append(o);
        }
        select.addEventListener('change', () => this.cb.onAssign(m.id, select.value as Assignment));
        row.append(who, select, energy);
        this.memberRows.set(m.id, { row, status, energy, select });
        return row;
      }));
    }
    const working = team.members.filter((m) => m.workingAt).length;
    setText(this.teamSummary, t('Your team ({working} of {total} on shift)', { working, total: team.members.length }));
    for (const m of team.members) {
      const r = this.memberRows.get(m.id);
      if (!r) continue;
      const kind = m.paid ? t('paid') : t('volunteer');
      // Energy is the bar under the row; the line names the place and how well they work there.
      const where = m.workingAt
        ? t('{place} {fit}%', { place: PICK_NAMES[m.workingAt], fit: Math.round(Team.fit(m, m.workingAt) * 100) })
        : m.assignment === 'rest' ? t('resting') : m.worn ? t('gone home tired') : t('off shift');
      const pct = Math.round(m.energy * 100);
      setText(r.status, `${kind[0].toUpperCase()}${kind.slice(1)} · ${where}`);
      setAttr(r.energy, 'aria-label', t('Energy {pct}%', { pct }));
      r.energy.style.setProperty('--energy', String(m.energy));
      r.energy.dataset.low = String(m.energy < TIRED + 0.1);
      // Never fight a picker the user is using.
      if (document.activeElement !== r.select && r.select.value !== m.assignment) r.select.value = m.assignment;
    }
  }
}
