import { STANDING, UNLOCK_TIER, type Unlock } from '../config/standing';

/**
 * The project's standing in the city (config/standing.ts). Rendering-free.
 * Points come from people helped and go with people turned away and deaths;
 * the tier follows the points with some slack so it does not flap.
 */
export class Standing {
  points = 0;
  tier = 0;

  /** Adds (or takes) points; returns the new tier when it changed, else null. */
  add(amount: number): number | null {
    this.points = Math.max(0, this.points + amount);
    const tiers = STANDING.tiers;
    let tier = this.tier;
    while (tier + 1 < tiers.length && this.points >= tiers[tier + 1]) tier++;
    while (tier > 0 && this.points < tiers[tier] - STANDING.slack) tier--;
    if (tier === this.tier) return null;
    this.tier = tier;
    return tier;
  }

  /** Points still to go to the next tier, or null at the top. */
  get toNext(): number | null {
    const next = STANDING.tiers[this.tier + 1];
    return next === undefined ? null : Math.max(0, Math.ceil(next - this.points));
  }

  get giving(): number {
    return STANDING.giving[this.tier];
  }

  allows(u: Unlock): boolean {
    return this.tier >= UNLOCK_TIER[u];
  }

  snapshot(): { points: number; tier: number } {
    return { points: Math.round(this.points * 10) / 10, tier: this.tier };
  }

  restore(s: { points?: number; tier?: number } | undefined): void {
    if (!s) return;
    if (typeof s.points === 'number' && Number.isFinite(s.points)) this.points = Math.max(0, s.points);
    if (typeof s.tier === 'number' && Number.isFinite(s.tier)) this.tier = Math.min(STANDING.tiers.length - 1, Math.max(0, Math.round(s.tier)));
  }
}
