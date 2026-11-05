import { CARE, CARE_SITES, RECIPIENT_BALANCE as B, RECIPIENT_NEEDS, RECIPIENT_NEED_IDS, isTest, maximumSupport, type CareAction, type RecipientNeedId } from '../config/recipientNeeds';
import type { Member } from './team';
import type { ServiceId } from './types';
import type { SupplyId } from '../config/supplies';

export type CareRating = 'none' | 'bronze' | 'silver' | 'gold';
export interface StateSupport { id: RecipientNeedId; completed: Partial<Record<CareAction, number>> }
export interface CareTask { state: number; action: CareAction; worker: number; remaining: number; points: number }
export interface RecipientVisit {
  visitor: number; states: StateSupport[]; site: ServiceId; phase: 'queued' | 'active' | 'transfer';
  waited: number; visited: ServiceId[]; task?: CareTask; preferred?: number; nextWorker?: number;
  destination?: ServiceId; nextDestination?: ServiceId; referralLeft?: number; referralWorker?: number; escalated?: boolean; timeFactor?: number;
}
export interface CareSummary { none: number; bronze: number; silver: number; gold: number; points: number }
export interface CareSave { version: 1; visits: RecipientVisit[]; pending: CareSummary; lastNight: number }
export interface CareEnvironment {
  workers: readonly Member[]; open(site: ServiceId): boolean; equipment: boolean; machine?: boolean; checking: boolean;
  has(supply: SupplyId): boolean; use(supply: SupplyId): boolean; timeFactor(site: ServiceId): number; completed?(visitor: number, action: CareAction): void; canPerform?(action: CareAction): boolean; commit?(visitor: number, action: CareAction): boolean;
}
export const emptyCareSummary = (): CareSummary => ({ none: 0, bronze: 0, silver: 0, gold: 0, points: 0 });
export function supportScore(state: StateSupport): number {
  const entries = Object.entries(state.completed) as [CareAction, number][];
  return Math.min(maximumSupport(state.id), entries.filter(([a]) => !isTest(a)).reduce((n, [, p]) => n + p, 0)
    + Math.max(0, ...entries.filter(([a]) => isTest(a)).map(([, p]) => p)));
}
export function visitScore(visit: Pick<RecipientVisit, 'states'>): number {
  return visit.states.reduce((n, state) => n + supportScore(state), 0) / visit.states.length;
}
export function careRating(score: number): CareRating { return score <= 5 ? 'none' : score <= 40 ? 'bronze' : score <= 80 ? 'silver' : 'gold'; }
export function careUrgency(v: RecipientVisit): number { return Math.max(...v.states.map(s => RECIPIENT_NEEDS[s.id].urgency)) + (v.escalated ? 1 : 0); }
export function patience(v: RecipientVisit): number { return Math.max(B.minimumWait, B.waitMinutes - (v.states.length - 1) * B.waitPerExtraState); }
const supplyFor = (a: CareAction): SupplyId | undefined => a === 'leaflet' ? 'leaflets' : a === 'kit' || a === 'strip' ? 'kits' : undefined;

/** Single, synchronous owner of visit progress. No rendering, timers or asynchronous mutations. */
export class RecipientCare {
  readonly visits = new Map<number, RecipientVisit>();
  pending = emptyCareSummary();
  lastNight = -1;
  revision = 0;

  ensure(visitor: number, site: ServiceId, ids?: readonly RecipientNeedId[]): RecipientVisit {
    const existing = this.visits.get(visitor);
    if (existing) return existing;
    // Stable, non-diagnostic fictional support priorities, independent of appearance/substance.
    let hash = Math.imul(visitor ^ 0x452719, 0x45d9f3b) >>> 0;
    const requested = ids ? [...new Set(ids)].filter(id => Object.hasOwn(RECIPIENT_NEEDS, id)).slice(0, B.maxStates) : [];
    const states: StateSupport[] = requested.map(id => ({ id, completed: {} }));
    let roll = hash % 100;
    const generatedCount = 1 + B.stateCountWeights.findIndex(weight => { roll -= weight; return roll < 0; });
    const count = requested.length || generatedCount;
    while (states.length < count) {
      const id = RECIPIENT_NEED_IDS[hash % RECIPIENT_NEED_IDS.length];
      if (!states.some(s => s.id === id)) states.push({ id, completed: {} });
      hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
    }
    const v: RecipientVisit = { visitor, states, site, phase: 'queued', waited: 0, visited: [site] };
    this.visits.set(visitor, v); this.revision++;
    return v;
  }
  arrive(visitor: number, site: ServiceId): RecipientVisit {
    const v = this.ensure(visitor, site); v.site = site; v.phase = 'queued'; v.waited = 0;
    delete v.destination; delete v.referralLeft; delete v.referralWorker;
    if (!v.visited.includes(site)) v.visited.push(site);
    this.revision++; return v;
  }
  activate(visitor: number): void { const v = this.visits.get(visitor); if (v) { v.phase = 'active'; v.waited = 0; this.revision++; } }
  assign(visitor: number, worker: number | undefined, interrupt = false): void {
    const v = this.visits.get(visitor); if (!v) return;
    if (v.task && !interrupt) { v.nextWorker = worker ?? -1; }
    else { delete v.task; delete v.nextDestination; v.preferred = worker; delete v.nextWorker; }
    this.revision++;
  }
  private blocked(v: RecipientVisit, state: StateSupport, action: CareAction, m: Member, env: CareEnvironment): string | undefined {
    if (env.canPerform && !env.canPerform(action)) return 'funds';
    if (!CARE_SITES[action].includes(v.site)) return 'site';
    if (action === 'bed' && !m.traits.includes('social')) return 'specialist';
    if ((action === 'tlc' || action === 'machine') && !m.traits.includes('chemist')) return 'specialist';
    if ((action === 'tlc' || action === 'machine') && !env.equipment) return 'equipment';
    if (action === 'machine' && env.machine === false) return 'equipment';
    if (isTest(action) && !env.checking && action !== 'strip') return 'permission';
    const supply = supplyFor(action); if (supply && !env.has(supply)) return 'stock';
    if (!RECIPIENT_NEEDS[state.id].actions.includes(action as never)) return 'irrelevant';
    return undefined;
  }
  options(v: RecipientVisit, workers: readonly Member[], env: CareEnvironment): CareTask[] {
    const options: CareTask[] = [];
    for (let state = 0; state < v.states.length; state++) {
      const s = v.states[state];
      for (const action of RECIPIENT_NEEDS[s.id].actions) for (const worker of workers) {
        if (this.blocked(v, s, action, worker, env)) continue;
        const specialist = worker.traits.includes(RECIPIENT_NEEDS[s.id].specialist);
        const points = action === 'talk' ? specialist ? 30 : worker.paid ? 10 : 5 : CARE[action].points;
        const previous = isTest(action) ? Math.max(0, ...Object.entries(s.completed).filter(([a]) => isTest(a as CareAction)).map(([, p]) => p ?? 0)) : s.completed[action] ?? 0;
        if (points <= previous || supportScore(s) >= maximumSupport(s.id)) continue;
        const factor = Math.max(B.minimumTimeFactor, (v.timeFactor ?? 1) * env.timeFactor(v.site) * (specialist ? B.specialistTime : 1) * (action === 'talk' && s.completed.leaflet ? B.leafletTime : 1));
        options.push({ state, action, worker: worker.id, points, remaining: CARE[action].minutes * factor });
      }
    }
    return options.sort((a, b) => RECIPIENT_NEEDS[v.states[b.state].id].urgency - RECIPIENT_NEEDS[v.states[a.state].id].urgency
      || (b.points - (v.states[b.state].completed[b.action] ?? 0)) - (a.points - (v.states[a.state].completed[a.action] ?? 0))
      || a.remaining - b.remaining || a.worker - b.worker);
  }
  /** Advance one site once per fixed tick. A finished list is handed to existing simulation outcomes. */
  tick(site: ServiceId, minutes: number, env: CareEnvironment): number[] {
    if (!(minutes > 0)) return [];
    const finished: number[] = [];
    const workers = env.workers.filter(m => m.workingAt === site && m.energy > 0);
    const busy = new Set([...this.visits.values()].flatMap(v => v.task ? [v.task.worker] : v.referralWorker !== undefined ? [v.referralWorker] : []));
    const active = [...this.visits.values()].filter(v => v.site === site && v.phase === 'active')
      .sort((a, b) => careUrgency(b) - careUrgency(a) || b.waited - a.waited || a.visitor - b.visitor);
    for (const v of active) {
      if (v.nextDestination && !v.task) {
        const target = v.nextDestination;
        if (!env.open(target)) { delete v.nextDestination; this.revision++; }
        else {
          const coordinator = workers.find(m => !busy.has(m.id));
          if (coordinator) {
            v.destination = target; delete v.nextDestination;
            v.referralLeft = B.referralMinutes; v.referralWorker = coordinator.id;
            busy.add(coordinator.id); this.revision++;
          } else { v.waited += minutes; if (v.waited >= patience(v)) finished.push(v.visitor); continue; }
        }
      }
      if (v.referralLeft !== undefined) {
        if (!workers.some(m => m.id === v.referralWorker)) {
          if (v.referralWorker !== undefined) busy.delete(v.referralWorker);
          delete v.referralLeft; delete v.referralWorker; delete v.destination;
          this.revision++; continue;
        }
        v.referralLeft -= minutes;
        if (v.referralLeft <= 0) { if (v.referralWorker !== undefined) busy.delete(v.referralWorker); delete v.referralWorker; v.phase = 'transfer'; v.waited = 0; finished.push(v.visitor); this.revision++; }
        continue;
      }
      if (v.task) {
        const task = v.task;
        const assigned = workers.find(m => m.id === task.worker);
        if (!assigned || this.blocked(v, v.states[task.state], task.action, assigned, env)) { busy.delete(task.worker); delete v.task;
          if (v.nextWorker !== undefined) { v.preferred = v.nextWorker < 0 ? undefined : v.nextWorker; delete v.nextWorker; }
          this.revision++; }
        else {
          task.remaining -= minutes;
          if (task.remaining > 0) continue;
          const supply = supplyFor(task.action);
          if ((!env.commit || env.commit(v.visitor, task.action)) && (!supply || env.use(supply))) { v.states[task.state].completed[task.action] = task.points; if (isTest(task.action)) {
              for (const state of v.states) if (RECIPIENT_NEEDS[state.id].actions.includes(task.action as never)) state.completed[task.action] = task.points;
            } else if (task.action === 'leaflet' || task.action === 'kit') {
              const group = RECIPIENT_NEEDS[v.states[task.state].id].group;
              for (const state of v.states) if (RECIPIENT_NEEDS[state.id].group === group && RECIPIENT_NEEDS[state.id].actions.includes(task.action as never)) state.completed[task.action] = task.points;
            }
            env.completed?.(v.visitor, task.action); }
          busy.delete(task.worker); delete v.task;
          if (v.nextWorker !== undefined) { v.preferred = v.nextWorker < 0 ? undefined : v.nextWorker; delete v.nextWorker; }
          this.revision++;
          // Don't spend the same tick on another action or consume more than once.
          continue;
        }
      }
      if (!env.open(site)) { finished.push(v.visitor); continue; }
      const available = workers.filter(m => !busy.has(m.id) && (v.preferred === undefined || v.preferred === m.id));
      const equipmentBusy = [...this.visits.values()].some(other => other.site === site && other.task && (other.task.action === 'tlc' || other.task.action === 'machine'));
      const options = this.options(v, available, env).filter(o => !equipmentBusy || (o.action !== 'tlc' && o.action !== 'machine'));
      const next = options[0];
      if (next) { v.task = next; busy.add(next.worker); v.waited = 0; this.revision++; continue; }
      if (this.options(v, workers, env).length) {
        v.waited += minutes;
        if (v.waited < patience(v)) continue;
      }
      // Seek a real, open destination that has appropriate staff/resources. Never bounce back.
      const destination = this.findDestination(v, env);
      if (destination) {
        const coordinator = workers.find(m => !busy.has(m.id));
        if (coordinator) { v.destination = destination; v.referralLeft = B.referralMinutes; v.referralWorker = coordinator.id; busy.add(coordinator.id); this.revision++; }
        else { v.waited += minutes; if (v.waited >= patience(v)) finished.push(v.visitor); }
      }
      else finished.push(v.visitor);
    }
    return finished;
  }
  findDestination(v: RecipientVisit, env: CareEnvironment): ServiceId | undefined {
    for (const site of CARE_SITES.talk) {
      if (v.visited.includes(site) || !env.open(site)) continue;
      if (this.options({ ...v, site }, env.workers.filter(m => m.workingAt === site && m.energy > 0), env).length) return site;
    }
    return undefined;
  }
  canRefer(visitor: number, site: ServiceId, env: CareEnvironment): boolean {
    const v = this.visits.get(visitor);
    return !!v && v.phase === 'active' && v.site !== site && env.open(site)
      && this.options({ ...v, site }, env.workers.filter(m => m.workingAt === site && m.energy > 0), env).length > 0;
  }
  refer(visitor: number, site: ServiceId, env: CareEnvironment): boolean {
    if (!this.canRefer(visitor, site, env)) return false;
    const v = this.visits.get(visitor)!;
    v.nextDestination = site; this.revision++; return true;
  }
  finish(visitor: number): CareRating | undefined {
    const v = this.visits.get(visitor); if (!v) return;
    const rating = careRating(visitScore(v)); this.pending[rating]++;
    this.pending.points += rating === 'gold' ? 3 : rating === 'silver' ? 2 : rating === 'bronze' ? 1 : 0;
    this.visits.delete(visitor); this.revision++; return rating;
  }
  settle(night: number): CareSummary {
    if (night <= this.lastNight) return emptyCareSummary();
    const result = { ...this.pending }; this.pending = emptyCareSummary(); this.lastNight = night; this.revision++; return result;
  }
  snapshot(): CareSave { return structuredClone({ version: 1, visits: [...this.visits.values()], pending: this.pending, lastNight: this.lastNight }); }
  restore(raw: unknown): void {
    this.visits.clear(); this.pending = emptyCareSummary(); this.lastNight = -1;
    if (!raw || typeof raw !== 'object') return;
    const s = raw as Partial<CareSave>; if (s.version !== 1) return;
    const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
    const siteValid = (s: unknown): s is ServiceId => CARE_SITES.talk.includes(s as ServiceId);
    for (const rawVisit of (Array.isArray(s.visits) ? s.visits : []).slice(0, 1000)) {
      if (!rawVisit || !finite(rawVisit.visitor) || !Number.isInteger(rawVisit.visitor) || !siteValid(rawVisit.site) || !Array.isArray(rawVisit.states)) continue;
      const v = structuredClone(rawVisit);
      v.states = v.states.slice(0, 5).filter((state, i, all) => state && Object.hasOwn(RECIPIENT_NEEDS, state.id) && all.findIndex(s => s.id === state.id) === i).map(state => {
        const completed: StateSupport['completed'] = {};
        for (const action of RECIPIENT_NEEDS[state.id].actions) {
          const points = state.completed?.[action];
          if (finite(points) && (action === 'talk' ? [5, 10, 30].includes(points) : points === CARE[action].points)) completed[action] = points;
        }
        return { id: state.id, completed };
      });
      if (!v.states.length) continue;
      if (!finite(v.timeFactor) || v.timeFactor === 0) delete v.timeFactor;
      v.waited = finite(v.waited) ? v.waited : 0;
      v.visited = Array.isArray(v.visited) ? [...new Set([...v.visited.filter(siteValid), v.site])] : [v.site];
      if (!['queued', 'active', 'transfer'].includes(v.phase)) v.phase = 'queued';
      if (v.task && (!Number.isInteger(v.task.state) || !v.states[v.task.state] || !Object.hasOwn(CARE, v.task.action)
        || !RECIPIENT_NEEDS[v.states[v.task.state].id].actions.includes(v.task.action as never) || !finite(v.task.remaining) || !finite(v.task.worker)
        || (v.task.action === 'talk' ? ![5, 10, 30].includes(v.task.points) : v.task.points !== CARE[v.task.action].points))) delete v.task;
      if (!siteValid(v.nextDestination)) delete v.nextDestination;
      if (!siteValid(v.destination)) { delete v.destination; delete v.referralLeft; delete v.referralWorker; if (v.phase === 'transfer') v.phase = 'active'; }
      else if (!finite(v.referralLeft)) v.referralLeft = B.referralMinutes;
      if (!finite(v.referralWorker)) delete v.referralWorker;
      if (!finite(v.preferred)) delete v.preferred;
      if (v.nextWorker !== -1 && !finite(v.nextWorker)) delete v.nextWorker;
      this.visits.set(v.visitor, v);
    }
    for (const key of ['none', 'bronze', 'silver', 'gold'] as const) if (finite(s.pending?.[key])) this.pending[key] = Math.floor(s.pending[key]);
    this.pending.points = this.pending.bronze + 2 * this.pending.silver + 3 * this.pending.gold;
    if (finite(s.lastNight)) this.lastNight = Math.floor(s.lastNight);
    const assigned = new Set<number>();
    for (const v of this.visits.values()) {
      const worker = v.task?.worker ?? v.referralWorker;
      if (worker === undefined) continue;
      if (assigned.has(worker)) { delete v.task; delete v.referralWorker; delete v.referralLeft; delete v.destination; }
      else assigned.add(worker);
    }
    this.revision++;
  }
}
