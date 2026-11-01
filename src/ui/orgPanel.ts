import { GRANT_IDS, GRANTS, ORG, RECRUIT, type ApplicationContext, type GrantId, type RecruitId } from '../config/organisation';
import type { Organisation } from '../sim/organisation';
import type { ServiceModel } from '../sim/simulation';
import type { ServiceId } from '../sim/types';
import { formatClock } from '../sim/clock';

export interface OrgPanelCallbacks {
  /** Queued by the app and applied between simulation steps. */
  onRecruit(id: RecruitId): void;
  onLetGo(): void;
  onApply(id: GrantId): void;
  onReopen(id: ServiceId): void;
  /** Open the Sandbox panel at this section. */
  onOpen(): void;
}

export interface OrgView {
  org: Organisation;
  services: Record<ServiceId, ServiceModel>;
  clock: number;
  incomePerHour: number;
  applicationContext: ApplicationContext;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const SERVICE_NAMES: Record<ServiceId, string> = { dropIn: 'drop-in centre', outreach: 'outreach camper', clubHr: 'club stand', pharmacy: 'pharmacy and needle exchange', drugChecking: 'drug checking service', shelter: 'shelter and day centre', clinic: 'clinic and A&E' };
const SHORT_NAMES: Record<ServiceId, string> = { dropIn: 'drop-in', outreach: 'camper', clubHr: 'stand', pharmacy: 'pharmacy', drugChecking: 'checking', shelter: 'shelter', clinic: 'clinic' };

const money = (v: number) => Math.round(v).toLocaleString('en-GB');
const signed = (v: number) => `${v >= 0 ? '+' : '-'}${money(Math.abs(v))}`;

/** Writes text only when it changed, so per-refresh updates cause no layout work. */
function setText(e: HTMLElement, text: string): void {
  if (e.textContent !== text) e.textContent = text;
}

interface GrantRow {
  status: HTMLElement;
  button: HTMLButtonElement;
}

/**
 * The organisation: an always-visible status bar (budget and staff) and a
 * Sandbox panel section to recruit, let staff go and apply for funding.
 */
export class OrgPanel {
  readonly bar: HTMLButtonElement;
  readonly section: HTMLFieldSetElement;
  private readonly summary: HTMLElement;
  private readonly staff: HTMLElement;
  private readonly recruiting: HTMLElement;
  private readonly log: HTMLElement;
  private readonly grants = {} as Record<GrantId, GrantRow>;
  private readonly closed: HTMLElement;
  private readonly reopen = {} as Record<ServiceId, HTMLButtonElement>;

  constructor(cb: OrgPanelCallbacks) {
    this.bar = el('button', 'org-bar');
    this.bar.type = 'button';
    this.bar.title = 'Organisation: money and staff. Opens the Sandbox panel.';
    this.bar.addEventListener('click', () => cb.onOpen());

    this.section = el('fieldset', 'sandbox-group org');
    this.section.id = 'org-section';
    this.section.append(el('legend', undefined, 'Your organisation'));
    this.summary = el('p', 'org-summary');
    this.staff = el('p', 'org-staff');
    this.recruiting = el('p', 'org-recruiting');
    const actions = el('div', 'org-actions');
    for (const id of Object.keys(RECRUIT) as RecruitId[]) {
      const r = RECRUIT[id];
      const b = el('button', 'btn org-action', `${r.label} (${r.cost}, about ${Math.round(r.minutes / 60 * 10) / 10} h)`);
      b.type = 'button';
      b.id = `org-${id}`;
      b.title = r.summary;
      b.addEventListener('click', () => cb.onRecruit(id));
      actions.append(b);
    }
    const letGo = el('button', 'btn org-action', 'Let a paid worker go');
    letGo.type = 'button';
    letGo.title = `Saves ${ORG.wagePerHour} per hour while they would be on shift.`;
    letGo.id = 'org-letGo';
    letGo.addEventListener('click', () => cb.onLetGo());
    actions.append(letGo);

    // Services closed down when the money ran out: relaunch for a cost.
    this.closed = el('div', 'org-closed');
    this.closed.hidden = true;
    this.closed.append(el('h3', 'level', 'Closed down'));
    for (const id of ['clubHr', 'outreach', 'dropIn'] as ServiceId[]) {
      const b = el('button', 'btn org-action', `Relaunch the ${SERVICE_NAMES[id]} (${ORG.reopen.cost}, about ${Math.round(ORG.reopen.minutes / 60)} h)`);
      b.type = 'button';
      b.id = `org-reopen-${id}`;
      b.hidden = true;
      b.addEventListener('click', () => cb.onReopen(id));
      this.closed.append(b);
      this.reopen[id] = b;
    }

    const grants = el('div', 'org-grants');
    grants.append(el('h3', 'level', 'Funding applications (long term)'));
    for (const id of GRANT_IDS) {
      const g = GRANTS[id];
      const row = el('div', 'org-grant');
      const head = el('div', 'org-grant-head');
      head.append(el('strong', undefined, g.label));
      const button = el('button', 'btn org-apply', `Apply (${g.fee})`);
      button.type = 'button';
      button.id = `org-${id}`;
      button.addEventListener('click', () => cb.onApply(id));
      head.append(button);
      const detail = el('p', 'factor-summary', `Decision after about ${Math.round(g.minutes / 60)} h. ${g.odds} If approved: ${g.rewardText}.`);
      const status = el('p', 'org-grant-status');
      const sources = el('details', 'sources');
      sources.append(el('summary', undefined, `Sources (${g.evidence.length})`));
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
    const note = el('p', 'note', 'Money is in illustrative units. Funding levels follow the library only as a ratio (project about a third of stable public funding).');
    this.section.append(this.summary, this.staff, this.recruiting, actions, this.closed, grants, this.log, note);
  }

  /** Per-refresh update; text-only writes. */
  update(v: OrgView): void {
    const o = v.org;
    const assigned = Object.values(v.services).reduce((n, s) => n + s.assigned, 0);
    const paidOn = Object.values(v.services).reduce((n, s) => n + s.paidAssigned, 0);
    const wanted = Object.values(v.services).reduce((n, s) => n + (s.closedReason === null || s.closedReason === 'noStaff' ? s.requested : 0), 0);
    const short = Math.max(0, wanted - assigned);
    const budget = `${money(o.budget)} (${signed(o.netPerHour)}/h)`;
    const next = o.nextClosure(v.clock);
    const closedText = o.closedDown.size ? ` · ${o.closedDown.size} closed down` : '';
    setText(this.bar, `Budget ${budget} · Staff ${o.paid} paid + ${o.volunteers} volunteers${short ? ` · ${short} short` : ''}${o.broke ? ` · out of money${next ? `, ${SHORT_NAMES[next.service]} closes ${formatClock(next.at)}` : ''}` : ''}${closedText}`);
    this.bar.dataset.state = o.broke || o.closedDown.size ? 'broke' : short ? 'short' : 'ok';
    const anyClosed = o.closedDown.size > 0;
    if (this.closed.hidden === anyClosed) this.closed.hidden = !anyClosed;
    for (const id of Object.keys(this.reopen) as ServiceId[]) {
      const pending = o.reopening.find((r) => r.id === id);
      const show = o.closedDown.has(id);
      if (this.reopen[id].hidden === show) this.reopen[id].hidden = !show;
      const label = pending ? `Relaunching the ${SERVICE_NAMES[id]}: ready ${formatClock(o.clockAt(pending.readyAt, v.clock))}` : `Relaunch the ${SERVICE_NAMES[id]} (${ORG.reopen.cost}, about ${Math.round(ORG.reopen.minutes / 60)} h)`;
      setText(this.reopen[id], label);
      this.reopen[id].disabled = !!pending;
    }
    setText(this.summary, `Budget ${budget}. Income ${money(v.incomePerHour + o.grantIncome)}/h (national funding ${money(v.incomePerHour)}, grants ${money(o.grantIncome)}); wages ${money(paidOn * ORG.wagePerHour)}/h for ${paidOn} paid staff on shift.`);
    setText(this.staff, `Staff: ${o.paid} paid, ${o.volunteers} volunteers. On shift ${assigned} of ${wanted} wanted${short ? `, ${short} short` : ''}.`);
    setText(this.recruiting, o.recruiting.length ? `Recruiting: ${o.recruiting.map((r) => `${RECRUIT[r.id].label.toLowerCase()} until ${formatClock(o.clockAt(r.readyAt, v.clock))}`).join('; ')}.` : 'Recruiting: nothing under way.');
    for (const id of GRANT_IDS) {
      const state = o.applications[id];
      const chance = Math.round(GRANTS[id].chance(v.applicationContext) * 100);
      const text =
        state.status === 'pending' ? `Pending: decision at ${formatClock(o.clockAt(state.decidesAt, v.clock))}. Chance now about ${chance}%.`
        : state.status === 'approved' ? `Approved at ${formatClock(state.at)}.`
        : state.status === 'declined' ? `Declined at ${formatClock(state.at)}. Chance now about ${chance}%.`
        : `Chance now about ${chance}%.`;
      setText(this.grants[id].status, text);
      const blocked = state.status === 'pending' || state.status === 'approved';
      if (this.grants[id].button.hidden !== blocked) this.grants[id].button.hidden = blocked;
    }
    const logText = o.log.map((n) => `${formatClock(n.at)} ${n.text}`).join('\n');
    if (this.log.dataset.text !== logText) {
      this.log.dataset.text = logText;
      this.log.replaceChildren(...o.log.map((n) => el('li', undefined, `${formatClock(n.at)} ${n.text}`)));
    }
  }
}
