import { GOALS, type GoalId } from '../config/goals';
import type { Scenario } from '../config/scenarios';

/**
 * The night's goals and the report at 08:00, and a scenario's goal if one is
 * being played. Rendering-free: the simulation feeds it what happened and asks
 * for the report when a night ends.
 */
export interface GoalResult { id: GoalId; target: number; value: number; met: boolean }

export interface NightReport {
  care?: import('./recipientCare').CareSummary;
  /** Nights survived including this one. */
  night: number;
  helped: number;
  turnedAway: number;
  deaths: number;
  moneyStart: number;
  moneyEnd: number;
  redHours: number;
  goals: GoalResult[];
  stars: number;
  starsTotal: number;
  /** The scenario was won with this night. */
  won: boolean;
  /** Deaths over the whole run, and whether the project has folded (for a scenario's progress). */
  deathsTotal?: number;
  folded?: boolean;
  /** The district at the night's end (sim/growth.ts): its size against the first evening, and its street scene, 0 to 1. */
  district?: { size: number; street: number };
}

export class Goals {
  /** Stars over the whole run. */
  stars = 0;
  scenario: Scenario | null = null;
  /** The district's size against the first evening (sim/growth.ts): tonight's helped goal grows with it. */
  size = 1;
  won = false;
  private start = { helped: 0, turnedAway: 0, deaths: 0, money: 0 };
  private redMinutes = 0;

  /** Tonight's targets, for a district of `size`. */
  targets(): Record<GoalId, number> {
    return {
      helped: Math.round(GOALS.helped * this.size),
      calm: GOALS.redHours,
      money: GOALS.moneyDrop,
    };
  }

  /** A night begins: remember where things stood. */
  begin(helped: number, turnedAway: number, deaths: number, money: number): void {
    this.start = { helped, turnedAway, deaths, money };
    this.redMinutes = 0;
  }

  /** Clock minutes with a meter red, counted as they pass. */
  tick(dtMinutes: number, red: boolean): void {
    if (red) this.redMinutes += dtMinutes;
  }

  /** What the night so far looks like against its goals (for the HUD). */
  progress(helped: number, money: number): GoalResult[] {
    const target = this.targets();
    const tonight = helped - this.start.helped;
    const red = this.redMinutes / 60;
    const drop = this.start.money - money;
    return [
      { id: 'helped', target: target.helped, value: tonight, met: tonight >= target.helped },
      { id: 'calm', target: target.calm, value: Math.round(red * 10) / 10, met: red <= target.calm },
      { id: 'money', target: target.money, value: Math.round(drop), met: drop <= target.money },
    ];
  }

  /** 08:00: scores the night that just ended (`nights` survived before it) and starts the next one. */
  end(nights: number, helped: number, turnedAway: number, deaths: number, money: number, totalHelped: number, folded = false): NightReport {
    const goals = this.progress(helped, money);
    const stars = goals.filter((g) => g.met).length;
    this.stars += stars;
    const s = this.scenario;
    // Won on the night its goal is met: enough nights, people helped and stars, deaths within the cap, the project standing.
    const won = !!s && !this.won && !folded && nights + 1 >= s.nights && totalHelped >= s.helped && this.stars >= s.stars && deaths <= s.deaths;
    if (won) this.won = true;
    const report: NightReport = {
      night: nights + 1, helped: helped - this.start.helped, turnedAway: turnedAway - this.start.turnedAway, deaths: deaths - this.start.deaths,
      moneyStart: Math.round(this.start.money), moneyEnd: Math.round(money), redHours: Math.round(this.redMinutes / 6) / 10,
      goals, stars, starsTotal: this.stars, won, deathsTotal: deaths, folded,
    };
    this.begin(helped, turnedAway, deaths, money);
    return report;
  }

  snapshot(): { stars: number; won: boolean; scenario: string | null; start: Goals['start']; redMinutes: number } {
    return { stars: this.stars, won: this.won, scenario: this.scenario?.id ?? null, start: { ...this.start }, redMinutes: Math.round(this.redMinutes) };
  }

  restore(s: Partial<ReturnType<Goals['snapshot']>> | undefined, find: (id: string) => Scenario | undefined): void {
    if (!s) return;
    const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    // Only what the save carries: an older save leaves a scenario from the address in place.
    if (typeof s.stars === 'number') this.stars = Math.max(0, Math.round(n(s.stars, 0)));
    if (typeof s.won === 'boolean') this.won = s.won;
    if ('scenario' in s) this.scenario = s.scenario ? find(s.scenario) ?? null : null;
    if (s.start) this.start = { helped: n(s.start.helped, 0), turnedAway: n(s.start.turnedAway, 0), deaths: n(s.start.deaths, 0), money: n(s.start.money, 0) };
    this.redMinutes = Math.max(0, n(s.redMinutes, 0));
  }
}
