import './recipientCare.css';
import { t, LOCALE } from '../i18n';
import { CARE, CARE_SITES, RECIPIENT_NEEDS, maximumSupport, type CareAction } from '../config/recipientNeeds';
import { TRAITS } from '../sim/team';
import { careUrgency, patience, supportScore, visitScore, type RecipientVisit } from '../sim/recipientCare';
import type { ServiceId } from '../sim/types';
import { SERVICE_TEXT } from '../config/places';

export interface RecipientCareView {
  visits: readonly RecipientVisit[];
  workers: readonly { id: number; name: string }[];
  destinations: readonly ServiceId[];
  stock: { leaflets: boolean; kits: boolean }; equipment: boolean; machine: boolean;
  assign(visitor: number, worker: number | undefined, interrupt: boolean): void;
  refer(visitor: number, site: ServiceId): void;
  canRefer(visitor: number, site: ServiceId): boolean;
}
interface Row { root: HTMLElement; title: HTMLElement; states: HTMLElement; status: HTMLElement; blockers: HTMLElement; worker: HTMLSelectElement; destination: HTMLSelectElement; refer: HTMLButtonElement; interrupt: HTMLButtonElement }
const text = (el: HTMLElement, value: string) => { if (el.textContent !== value) el.textContent = value; };
const make = <K extends keyof HTMLElementTagNameMap>(tag: K, value?: string): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag); if (value) el.textContent = value; return el;
};
const options = (select: HTMLSelectElement, items: readonly { value: string; label: string }[]) => {
  const key = JSON.stringify(items); if (select.dataset.options === key) return;
  select.dataset.options = key;
  select.replaceChildren(...items.map(i => { const option = make('option', i.label); option.value = i.value; return option; }));
};
/** Retains controls/focus across live updates; all mutations are explicit simulation commands. */
export class RecipientCarePanel {
  readonly root = make('details');
  private summary = make('summary');
  private list = make('div');
  private rows = new Map<number, Row>();
  private view?: RecipientCareView;
  constructor() {
    this.root.className = 'recipient-care';
    this.root.append(this.summary, this.list);
    this.list.className = 'recipient-care-list';
    this.root.addEventListener('toggle', () => { if (this.root.open && this.view) this.render(this.view); });
  }
  update(view?: RecipientCareView): void {
    this.view = view; this.root.hidden = !view;
    if (!view) return;
    text(this.summary, t('Recipients: {n}', { n: view.visits.length }));
    if (this.root.open) this.render(view);
  }
  private create(visitor: number): Row {
    const root = make('article'); root.className = 'recipient-care-row';
    const title = make('h4'), states = make('ul'), status = make('p'), blockers = make('p');
    const worker = make('select'), destination = make('select');
    const workerLabel = make('label', t('Assigned worker')); workerLabel.append(worker);
    const destinationLabel = make('label', t('Referral destination')); destinationLabel.append(destination);
    worker.setAttribute('aria-label', t('Worker for recipient {n}', { n: visitor }));
    destination.setAttribute('aria-label', t('Referral for recipient {n}', { n: visitor }));
    const interrupt = make('button', t('Interrupt and change assignment'));
    const refer = make('button', t('Refer after current activity'));
    interrupt.type = refer.type = 'button';
    worker.addEventListener('change', () => { this.view?.assign(visitor, worker.value ? Number(worker.value) : undefined, false); if (this.view) this.render(this.view); });
    interrupt.addEventListener('click', () => { this.view?.assign(visitor, worker.value ? Number(worker.value) : undefined, true); if (this.view) this.render(this.view); });
    refer.addEventListener('click', () => { if (destination.value) this.view?.refer(visitor, destination.value as ServiceId); if (this.view) this.render(this.view); });
    root.append(title, states, status, blockers, workerLabel, interrupt, destinationLabel, refer);
    return { root, title, states, status, blockers, worker, destination, refer, interrupt };
  }
  private render(view: RecipientCareView): void {
    const present = new Set(view.visits.map(v => v.visitor));
    for (const [id, row] of this.rows) if (!present.has(id)) { row.root.remove(); this.rows.delete(id); }
    if (!view.visits.length) { this.list.dataset.empty = t('No recipients here now.'); }
    else delete this.list.dataset.empty;
    for (const v of view.visits) {
      let row = this.rows.get(v.visitor);
      if (!row) { row = this.create(v.visitor); this.rows.set(v.visitor, row); this.list.append(row.root); }
      text(row.title, t('Recipient {n} · support {score}/100 · urgency {urgency}', { n: v.visitor, score: visitScore(v).toLocaleString(LOCALE, { maximumFractionDigits: 1 }), urgency: careUrgency(v) }));
      const stateKey = JSON.stringify(v.states);
      if (row.states.dataset.key !== stateKey) {
        row.states.dataset.key = stateKey;
        row.states.replaceChildren(...v.states.map(s => {
          const info = RECIPIENT_NEEDS[s.id], li = make('li'); li.dataset.group = info.group;
          const badge = make('span', info.icon); badge.className = 'recipient-trait'; badge.setAttribute('aria-hidden', 'true');
          li.title = `${info.label}: ${info.description}`;
          li.append(badge, make('span', `${info.label} · ${supportScore(s)}/${maximumSupport(s.id)}`));
          const progress = make('progress'); progress.max = 100; progress.value = supportScore(s); progress.setAttribute('aria-label', info.label); li.append(progress);
          return li;
        }));
      }
      const assigned = view.workers.find(w => w.id === v.task?.worker);
      const pending = v.nextWorker === -1 ? t('Automatic assignment') : view.workers.find(w => w.id === v.nextWorker)?.name;
      const state = v.phase === 'queued' ? t('Waiting {n}/{max} min', { n: Math.floor(v.waited), max: patience(v) })
        : v.phase === 'transfer' ? t('Travelling to {place}', { place: v.destination ? SERVICE_TEXT[v.destination].label : '' })
        : v.referralLeft !== undefined ? t('Arranging referral: {n} min', { n: Math.ceil(v.referralLeft) })
        : v.task ? t('{action} · {worker} · {n} min', { action: CARE[v.task.action].label, worker: assigned?.name ?? t('Worker unavailable'), n: Math.ceil(v.task.remaining) })
        : t('Waiting for a suitable free worker');
      text(row.status, (pending ? `${state} · ${t('Next worker')}: ${pending}` : state) + (v.nextDestination ? ` · ${t('Referral destination')}: ${SERVICE_TEXT[v.nextDestination].label}` : ''));
      row.root.dataset.warning = String(v.waited >= patience(v) * 0.75);
      const needs = new Set<string>();
      for (const s of v.states) for (const a of RECIPIENT_NEEDS[s.id].actions as readonly CareAction[]) {
        if (s.completed[a] && (a !== 'talk' || (s.completed.talk ?? 0) >= 30)) continue;
        if (!CARE_SITES[a].includes(v.site)) needs.add(`${CARE[a].label}: ${CARE_SITES[a].map(id => SERVICE_TEXT[id].label).join(', ')}`);
        if (a === 'talk' && (s.completed.talk ?? 0) < 30) needs.add(`${t('Specialist')}: ${TRAITS[RECIPIENT_NEEDS[s.id].specialist].label}`);
        if ((a === 'machine' || a === 'tlc') && (!view.equipment || (a === 'machine' && !view.machine))) needs.add(t('Analysis equipment required'));
        if (a === 'leaflet' && !view.stock.leaflets) needs.add(t('No leaflets in stock'));
        if ((a === 'kit' || a === 'strip') && !view.stock.kits) needs.add(t('No kits in stock'));
      }
      text(row.blockers, [...needs].join(' · '));
      options(row.worker, [{ value: '', label: t('Automatic assignment') }, ...view.workers.map(w => ({ value: String(w.id), label: w.name }))]);
      if (document.activeElement !== row.worker) row.worker.value = String(v.nextWorker !== undefined ? v.nextWorker < 0 ? '' : v.nextWorker : v.preferred ?? '');
      options(row.destination, [{ value: '', label: t('Choose an available destination') }, ...view.destinations.filter(s => view.canRefer(v.visitor, s)).map(s => ({ value: s, label: SERVICE_TEXT[s].label }))]);
      row.worker.disabled = v.phase !== 'active' || v.referralLeft !== undefined;
      row.interrupt.disabled = !v.task;
      row.refer.disabled = v.phase !== 'active' || v.referralLeft !== undefined || !view.destinations.some(s => view.canRefer(v.visitor, s));
      row.destination.disabled = row.refer.disabled;
    }
  }
}
