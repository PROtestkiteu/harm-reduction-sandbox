import { SERVICE_IDS, type ServiceId } from '../sim/types';

/** Authored learning progression. No rendering, storage or random draws live here. */
export const TUTORIAL_STAGES = ['meet', 'patrol', 'outreach', 'dropIn', 'nightlife', 'night', 'complete'] as const;
export type TutorialStage = typeof TUTORIAL_STAGES[number];
export type TutorialDistrict = 'park' | 'street' | 'residential' | 'nightlife' | 'city';
export interface TutorialCapabilities {
  readonly services: readonly ServiceId[];
  readonly district: TutorialDistrict;
  readonly dispatch: boolean;
  readonly budget: boolean;
  readonly staff: boolean;
  readonly maintenance: boolean;
  readonly stress: boolean;
  readonly organisation: boolean;
  readonly fullUi: boolean;
}
const capabilities = (services: readonly ServiceId[], district: TutorialDistrict, level: number): TutorialCapabilities => Object.freeze({
  services: Object.freeze([...services]), district, dispatch: level >= 1, budget: level >= 2, staff: level >= 2,
  maintenance: level >= 3, stress: level >= 4, organisation: level >= 5, fullUi: level >= 6,
});
export const FULL_TUTORIAL_CAPABILITIES = capabilities(SERVICE_IDS, 'city', 6);
const CAPABILITIES: Record<TutorialStage, TutorialCapabilities> = {
  meet: capabilities(['footPatrol'], 'park', 0),
  patrol: capabilities(['footPatrol'], 'park', 1),
  outreach: capabilities(['footPatrol', 'outreach'], 'street', 2),
  dropIn: capabilities(['footPatrol', 'outreach', 'dropIn'], 'residential', 3),
  nightlife: capabilities(['footPatrol', 'outreach', 'dropIn', 'clubHr'], 'nightlife', 4),
  night: capabilities(SERVICE_IDS, 'city', 5),
  complete: FULL_TUTORIAL_CAPABILITIES,
};
export interface TutorialSave {
  version: 1;
  stage: TutorialStage;
  inspectedCamp: boolean;
  reviewedSkills?: boolean;
  openedPatrol: boolean;
  patrolContacts: number;
  patrolReturned: boolean;
  visits: Partial<Record<ServiceId, number>>;
  rewards: TutorialStage[];
  recoveryAt: number;
  nightServices: ServiceId[];
}
const count = (v: unknown): number => typeof v === 'number' && Number.isFinite(v) ? Math.min(1e9, Math.max(0, Math.floor(v))) : 0;
export class TutorialProgress {
  private state: TutorialSave = {
    version: 1, stage: 'meet', inspectedCamp: false, reviewedSkills: false, openedPatrol: false, patrolContacts: 0, patrolReturned: false,
    visits: {}, rewards: [], recoveryAt: 0, nightServices: [],
  };
  get stage(): TutorialStage { return this.state.stage; }
  get active(): boolean { return this.stage !== 'complete'; }
  get capabilities(): TutorialCapabilities { return CAPABILITIES[this.stage]; }
  get patrolContacts(): number { return this.state.patrolContacts; }
  get reviewedSkills(): boolean { return this.state.reviewedSkills === true; }
  reviewSkills(): void { if (this.stage === 'outreach') { this.state.reviewedSkills = true; this.check(); } }
  get visits(): Readonly<Partial<Record<ServiceId, number>>> { return this.state.visits; }
  allowsService(id: ServiceId): boolean { return this.capabilities.services.includes(id); }
  inspectCamp(): void { if (this.stage === 'meet') { this.state.inspectedCamp = true; this.check(); } }
  openPatrol(): void { if (this.stage === 'meet') { this.state.openedPatrol = true; this.check(); } }
  patrol(contacts: number, returned: boolean): void {
    if (this.stage !== 'patrol') return;
    this.state.patrolContacts += count(contacts);
    if (contacts > 0) this.state.patrolReturned = false;
    this.state.patrolReturned ||= returned;
    this.check();
  }
  served(id: ServiceId): void {
    const target = this.stage === 'outreach' ? 'outreach' : this.stage === 'dropIn' ? 'dropIn' : this.stage === 'nightlife' ? 'clubHr' : null;
    if (target !== id) return;
    this.state.visits[id] = (this.state.visits[id] ?? 0) + 1;
    this.check();
  }
  observeOperational(services: readonly ServiceId[]): void {
    if (this.stage !== 'night') return;
    for (const id of services) if (!this.state.nightServices.includes(id)) this.state.nightServices.push(id);
  }
  get nightServices(): readonly ServiceId[] { return this.state.nightServices; }
  night(operational: boolean): void {
    if (this.stage !== 'night') return;
    if (operational) this.state.stage = 'complete';
    else this.state.nightServices = [];
  }
  /** A stage's reward is claimed once, including across reloads. */
  claimReward(): boolean {
    if (this.state.rewards.includes(this.stage)) return false;
    this.state.rewards.push(this.stage);
    return true;
  }
  recover(now: number): boolean {
    if (!this.active || now < this.state.recoveryAt) return false;
    this.state.recoveryAt = now + 60;
    return true;
  }
  private check(): void {
    if (this.stage === 'meet' && this.state.inspectedCamp) this.state.stage = 'patrol';
    else if (this.stage === 'patrol' && this.state.patrolContacts >= 3 && this.state.patrolReturned) this.state.stage = 'outreach';
    else if (this.stage === 'outreach' && this.reviewedSkills && (this.state.visits.outreach ?? 0) >= 5) this.state.stage = 'dropIn';
    else if (this.stage === 'dropIn' && (this.state.visits.dropIn ?? 0) >= 5) this.state.stage = 'nightlife';
    else if (this.stage === 'nightlife' && (this.state.visits.clubHr ?? 0) >= 5) this.state.stage = 'night';
  }
  snapshot(): TutorialSave { return { ...this.state, visits: { ...this.state.visits }, rewards: [...this.state.rewards], nightServices: [...this.state.nightServices] }; }
  static restore(raw: unknown): TutorialProgress | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (r.version !== 1 || !TUTORIAL_STAGES.includes(r.stage as TutorialStage)) return null;
    const progress = new TutorialProgress();
    const rewards = Array.isArray(r.rewards) ? r.rewards : [];
    const visits = r.visits && typeof r.visits === 'object' ? r.visits as Record<string, unknown> : {};
    progress.state = {
      version: 1, stage: r.stage as TutorialStage, reviewedSkills: r.reviewedSkills === true, inspectedCamp: r.inspectedCamp === true, openedPatrol: r.openedPatrol === true,
      patrolContacts: count(r.patrolContacts), patrolReturned: r.patrolReturned === true,
      visits: Object.fromEntries(SERVICE_IDS.map((id) => [id, count(visits[id])])),
      rewards: TUTORIAL_STAGES.filter((id) => rewards.includes(id)),
      recoveryAt: count(r.recoveryAt),
      nightServices: Array.isArray(r.nightServices) ? SERVICE_IDS.filter((id) => (r.nightServices as unknown[]).includes(id)) : [],
    };
    // Recover saves waiting behind the retired stand-selection gate.
    if (progress.stage === 'meet') progress.check();
    return progress;
  }
}
