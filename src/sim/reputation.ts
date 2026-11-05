import { REPUTATION_NODES, reputationRate, type ReputationNodeId, type ReputationSave } from '../config/reputation';
/** Cumulative support quality points; street indicators no longer overwrite reputation. */
export class Reputation {
  score = 0;
  revision = 0;
  progress = 0;
  readonly earned = new Set<ReputationNodeId>(['credibility']);
  get capacity(): number { return this.earned.has('mandate') ? 3 : 2; }
  get funding(): number { return this.earned.has('partnership') ? 450 : 300; }
  get policeHours(): number { return this.earned.has('protocol') ? 18 : 12; }
  get campHours(): number { return this.earned.has('coalition') ? 72 : 48; }
  private unlock(): void {
    for (const n of REPUTATION_NODES) if (this.score >= n.threshold && (!n.parents.length || n.parents.some(p => this.earned.has(p)))) {
      if (!this.earned.has(n.id)) { this.earned.add(n.id); this.revision++; }
    }
  }
  award(points: number): void {
    if (!Number.isFinite(points) || points <= 0) return;
    this.score += Math.floor(points); this.unlock(); this.revision++;
  }
  tick(minutes: number, _street: number, _trust: number, held: number): number {
    if (!(minutes > 0) || !Number.isFinite(minutes)) return held;
    if (held >= this.capacity) { this.progress = 0; return held; }
    this.progress += reputationRate(this.score) * minutes / 1440;
    const gained = Math.floor(this.progress + 1e-12);
    held = Math.min(this.capacity, held + gained);
    this.progress = held >= this.capacity ? 0 : Math.max(0, this.progress - gained);
    return held;
  }
  snapshot(): ReputationSave { return { version: 2, score: this.score, progress: this.progress, earned: REPUTATION_NODES.filter(n => this.earned.has(n.id)).map(n => n.id) }; }
  restore(raw: unknown, _street: number, _trust: number): void {
    const s = raw && typeof raw === 'object' ? raw as Partial<ReputationSave> : undefined;
    const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
    this.score = valid(s?.score) ? s.version === 2 ? s.score : Math.min(100, s.score) * 0.7 : 0;
    this.progress = valid(s?.progress) ? Math.min(s.progress, 0.999999999) : 0;
    this.earned.clear(); this.earned.add('credibility');
    // Before explicit reputation saves, loading a run granted these two baseline relationships.
    if (!s) {
      this.earned.add('community'); this.earned.add('relationship');
      this.score = 15;
    }
    // Keep all legitimate previously earned nodes, even if the old point scale was lower.
    if (Array.isArray(s?.earned)) for (const n of REPUTATION_NODES) if (s.earned.includes(n.id)) {
      this.earned.add(n.id); this.score = Math.max(this.score, n.threshold);
    }
    this.unlock(); this.revision++;
  }
}
