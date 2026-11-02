import { FUNDERS } from '../config/funders';

/**
 * How far the project's funders trust it, from the last day's results.
 * Rendering-free. The simulation multiplies its project funding, grant odds
 * and donation drives by `trust`, so helping people is how the project raises
 * money, and closing services or turning people away is how it loses it.
 */
export class Funders {
  trust: number = FUNDERS.start;
  /** People helped in each of the last 23 complete clock hours (the running hour is `bucket`). */
  private readonly hours: number[] = [];
  private bucket = 0;
  private bucketMinutes = 0;

  /** Someone was helped. */
  helped(): void {
    this.bucket++;
  }

  /** People helped over the last 24 clock hours (complete hours plus the one running). */
  get helpedDay(): number {
    let n = this.bucket;
    for (const h of this.hours) n += h;
    return n;
  }

  /** Clock hours the results cover so far (up to a day): a new project is judged on its first hours, not on an empty day. */
  private covered = 0;

  /**
   * What trust is heading for: helped per hour over the hours covered, against a good day's pace
   * (scaled by `expect`, the night's demand), plus reputation, minus services the player closed.
   */
  target(reputation: number, closedByPlayer: number, expect = 1): number {
    if (this.covered < FUNDERS.graceHours) return this.trust;
    const pace = this.helpedDay / Math.min(24, this.covered);
    const results = Math.min(1.4, pace / ((FUNDERS.goodDayHelped / 24) * expect));
    const t = FUNDERS.base + FUNDERS.resultsWeight * results + FUNDERS.reputationWeight * (reputation - 0.5) - FUNDERS.closedServiceCut * closedByPlayer;
    return Math.min(FUNDERS.max, Math.max(FUNDERS.min, t));
  }

  /** Advances by `dtMinutes` of clock time; returns the band crossed ('wary' | 'confident' | 'usual'), if any. */
  tick(dtMinutes: number, reputation: number, closedByPlayer: number, expect = 1): 'wary' | 'confident' | 'usual' | null {
    this.covered = Math.min(24, this.covered + dtMinutes / 60);
    this.bucketMinutes += dtMinutes;
    while (this.bucketMinutes >= 60) {
      this.bucketMinutes -= 60;
      this.hours.push(this.bucket);
      this.bucket = 0;
      if (this.hours.length > 23) this.hours.shift();
    }
    const before = this.band;
    const target = this.target(reputation, closedByPlayer, expect);
    const k = 1 - Math.exp(-FUNDERS.followPerHour * (dtMinutes / 60));
    this.trust += (target - this.trust) * k;
    const after = this.band;
    return after !== before ? after : null;
  }

  get band(): 'wary' | 'confident' | 'usual' {
    return this.trust < FUNDERS.wary ? 'wary' : this.trust > FUNDERS.confident ? 'confident' : 'usual';
  }

  /** For saves: trust and the last day's hourly counts. */
  snapshot(): { trust: number; hours: number[]; covered: number } {
    return { trust: Math.round(this.trust * 1000) / 1000, hours: [...this.hours, this.bucket], covered: Math.round(this.covered * 10) / 10 };
  }

  restore(s: { trust?: number; hours?: number[]; covered?: number } | undefined): void {
    if (!s) return;
    if (typeof s.covered === 'number' && Number.isFinite(s.covered)) this.covered = Math.min(24, Math.max(0, s.covered));
    if (typeof s.trust === 'number' && Number.isFinite(s.trust)) this.trust = Math.min(FUNDERS.max, Math.max(FUNDERS.min, s.trust));
    if (Array.isArray(s.hours)) {
      this.hours.length = 0;
      for (const h of s.hours.slice(-24, -1)) if (Number.isFinite(h)) this.hours.push(Math.max(0, Math.round(h)));
      this.bucket = Math.max(0, Math.round(s.hours.at(-1) ?? 0));
    }
  }
}
