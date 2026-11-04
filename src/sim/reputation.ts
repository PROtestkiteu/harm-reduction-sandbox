import { FUNDERS } from '../config/funders';
import { REPUTATION_NODES, reputationRate, type ReputationNodeId, type ReputationSave } from '../config/reputation';
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export class Reputation {
  score = 20;
  revision = 0;
  progress = 0;
  readonly earned = new Set<ReputationNodeId>(['credibility']);
  get capacity(): number { return this.earned.has('mandate') ? 3 : 2; }
  get funding(): number { return this.earned.has('partnership') ? 450 : 300; }
  get policeHours(): number { return this.earned.has('protocol') ? 18 : 12; }
  get campHours(): number { return this.earned.has('coalition') ? 72 : 48; }
  static target(street: number, trust: number): number {
    return 100 * (0.7 * clamp(street, 0, 1) + 0.3 * clamp((trust - FUNDERS.min) / (FUNDERS.max - FUNDERS.min), 0, 1));
  }
  private unlock(): void {
    for (const n of REPUTATION_NODES) if (this.score >= n.threshold && (!n.parents.length || n.parents.some(p => this.earned.has(p)))) {
      if (!this.earned.has(n.id)) { this.earned.add(n.id); this.revision++; }
    }
  }
  /** Fixed simulation time only, with analytic integration across rate thresholds. */
  tick(minutes: number, street: number, trust: number, held: number): number {
    if (!(minutes > 0) || !Number.isFinite(minutes)) return held;
    const before = this.score;
    this.score += (Reputation.target(street, trust) - this.score) * -Math.expm1(-minutes / 1440);
    if (Math.floor(before) !== Math.floor(this.score)) this.unlock();
    if (held >= this.capacity) { this.progress = 0; return held; }
    // Integrate threshold crossings analytically under the same constant target.
    const target = Reputation.target(street, trust);
    if (reputationRate(before) === reputationRate(this.score)) {
      this.progress += reputationRate(this.score) * minutes / 1440;
    } else {
      const cuts = [0, minutes];
      for (const threshold of [20, 40, 70]) {
        const ratio = (threshold - target) / (before - target);
        if (ratio > 0 && ratio < 1) {
          const at = -1440 * Math.log(ratio);
          if (at > 0 && at < minutes) cuts.push(at);
        }
      }
      cuts.sort((a, b) => a - b);
      for (let i = 1; i < cuts.length; i++) {
        const midpoint = (cuts[i - 1] + cuts[i]) / 2;
        this.progress += reputationRate(target + (before - target)*Math.exp(-midpoint / 1440)) * (cuts[i] - cuts[i - 1]) / 1440;
      }
    }
    const gained = Math.floor(this.progress + 1e-12);
    held = Math.min(this.capacity, held + gained);
    this.progress = held >= this.capacity ? 0 : Math.max(0, this.progress - gained);
    return held;
  }
  snapshot(): ReputationSave { return { score: this.score, progress: this.progress, earned: [...this.earned] }; }
  restore(raw: unknown, street: number, trust: number): void {
    const s = raw && typeof raw === 'object' ? raw as Partial<ReputationSave> : undefined;
    this.score = typeof s?.score === 'number' && Number.isFinite(s.score) ? clamp(s.score, 0, 100) : Reputation.target(street, trust);
    this.progress = typeof s?.progress === 'number' && Number.isFinite(s.progress) ? clamp(s.progress, 0, 0.999999999) : 0;
    this.earned.clear();
    if (!s) for (const id of ['credibility','community','relationship'] as const) this.earned.add(id);
    else if (Array.isArray(s.earned)) for (const n of REPUTATION_NODES) if (s.earned.includes(n.id) && (!n.parents.length || n.parents.some(p => this.earned.has(p)))) this.earned.add(n.id);
    this.unlock();
    this.revision++;
  }
}
