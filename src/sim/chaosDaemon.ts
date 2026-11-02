import { createRandom, type Random } from './random';

/**
 * Someone in acute crisis on the street: high on stimulants, sleepless,
 * frightened and frightening, roaming the district. When the street scene is
 * bad or the city's services are in crisis, now and then such a person turns
 * up, and stays until the player acts. While they roam the police and the
 * medics are pulled in and the street feels less safe. Left alone, it ends
 * badly after a few hours: a collapse and an ambulance, or an arrest.
 *
 * The player answers with people and money, each with its odds: outreach
 * staff to talk them down, the mobile crisis team, or the police (free, but it
 * costs trust and loads the police). A failed attempt costs what it cost and
 * they move on, worked up.
 *
 * Rendering-free, on its own seeded stream so it never shifts the rest of the
 * simulation's luck. ILLUSTRATIVE rates.
 */
export const DAEMON = {
  /** Turns up only with the street scene this deep, or a crisis this bad (and never on the first night). */
  streetAt: 0.45,
  crisisAt: 0.5,
  /** Chance per clock hour while those hold, and the quiet clock hours after one is over. */
  chancePerHour: 0.3,
  cooldownHours: 8,
  /** Left alone this many clock hours, it ends badly. */
  hours: 3,
  /** Per clock hour while they roam. */
  perHour: { police: 0.05, medics: 0.035, safety: 0.02, reputation: 0.01 },
  /** Left alone to the end: a collapse or an arrest. */
  ending: { medics: 0.18, police: 0.12, reputation: 0.04 },
  /** The answers, with their price and odds; after a failed try the odds of the next one drop a little. */
  talk: { cost: 40, chance: 0.55 },
  crisisTeam: { cost: 150, chance: 0.85 },
  police: { cost: 0, chance: 0.9, load: 0.15, reputation: 0.05 },
  afterFail: 0.1,
} as const;

export type DaemonAnswer = 'talk' | 'crisisTeam' | 'police';

export interface DaemonInput {
  street: number;
  crisis: number;
  nights: number;
}

export type DaemonNews = { kind: 'arrived' } | { kind: 'endedAlone'; arrest: boolean };

export class ChaosDaemon {
  /** Organisation minutes they turned up at, or null when nobody is roaming. */
  since: number | null = null;
  /** Tries that failed this time, each making the next a little harder. */
  fails = 0;
  private quietUntil = 0;
  private readonly random: Random;

  constructor(seed = 90210) {
    this.random = createRandom(seed);
  }

  get active(): boolean {
    return this.since !== null;
  }

  /** Advances by `dtMinutes` at organisation minute `now`; says when someone turns up or it ends on its own. */
  tick(dtMinutes: number, now: number, inp: DaemonInput): DaemonNews | null {
    if (this.since !== null) {
      if (now - this.since < DAEMON.hours * 60) return null;
      this.end(now);
      return { kind: 'endedAlone', arrest: this.random() < 0.5 };
    }
    if (now < this.quietUntil || inp.nights < 1) return null;
    if (inp.street < DAEMON.streetAt && inp.crisis < DAEMON.crisisAt) return null;
    if (this.random() >= 1 - Math.pow(1 - DAEMON.chancePerHour, dtMinutes / 60)) return null;
    this.since = now;
    this.fails = 0;
    return { kind: 'arrived' };
  }

  /** The odds of an answer now. */
  chance(a: DaemonAnswer): number {
    return Math.max(0.1, DAEMON[a].chance - this.fails * DAEMON.afterFail);
  }

  /** Tries an answer; true when it worked (they are calm, or taken somewhere safe). */
  answer(a: DaemonAnswer, now: number): boolean {
    if (this.since === null) return false;
    const ok = this.random() < this.chance(a);
    if (ok) this.end(now);
    else this.fails++;
    return ok;
  }

  private end(now: number): void {
    this.since = null;
    this.fails = 0;
    this.quietUntil = now + DAEMON.cooldownHours * 60;
  }

  snapshot(): { since: number | null; fails: number; quietUntil: number } {
    return { since: this.since, fails: this.fails, quietUntil: this.quietUntil };
  }

  restore(s: { since?: unknown; fails?: unknown; quietUntil?: unknown } | undefined): void {
    if (!s) return;
    this.since = typeof s.since === 'number' && Number.isFinite(s.since) ? s.since : null;
    if (typeof s.fails === 'number' && Number.isFinite(s.fails)) this.fails = Math.max(0, Math.round(s.fails));
    if (typeof s.quietUntil === 'number' && Number.isFinite(s.quietUntil)) this.quietUntil = s.quietUntil;
  }
}
