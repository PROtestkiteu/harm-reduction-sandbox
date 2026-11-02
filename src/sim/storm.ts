import { STORM, type StormKind, type StormPrep } from '../config/storm';
import type { Season } from './calendar';
import { MORNING } from './clock';

/**
 * The big crisis's timetable and what the player did to prepare
 * (config/storm.ts). Rendering-free: the simulation asks it what phase the
 * night is in and how severe it is, and tells it about deaths and people
 * turned away, for the report afterwards.
 */
export type StormPhase = 'none' | 'warned' | 'peak';

export interface StormReport {
  kind: StormKind;
  /** Which storm of the run (0 is the first). */
  index: number;
  helped: number;
  turnedAway: number;
  deaths: number;
  saved: number;
}

export class Storm {
  /** Storms already over. */
  done = 0;
  kind: StormKind | null = null;
  phase: StormPhase = 'none';
  readonly prepared = new Set<StormPrep>();
  /** Counts for the storm under way. */
  private tally = { helped: 0, turnedAway: 0, deaths: 0, saved: 0 };

  /** The night the next storm falls on. */
  get nextNight(): number {
    return STORM.firstNight + this.done * STORM.every;
  }

  get severity(): number {
    return 1 + this.done * STORM.worsen;
  }

  /** Death risk left for someone in danger and not served, after the preparations. */
  get risk(): number {
    let r = STORM.risk;
    if (this.prepared.has('beds')) r *= STORM.prepare.beds.risk;
    if (this.prepared.has('warn')) r *= STORM.prepare.warn.risk;
    return Math.min(0.9, r);
  }

  /**
   * Moves the timetable on. Returns 'warn' when the warning should be given,
   * 'start' and 'end' at the peak's edges (with the report at the end).
   */
  tick(nights: number, clock: number, season: Season): { what: 'warn' | 'start' } | { what: 'end'; report: StormReport } | null {
    const night = this.nextNight;
    if (this.phase === 'none' && nights === night - 1 && clock >= STORM.warnAt && clock < MORNING) {
      this.phase = 'warned';
      this.kind = season === 'winter' || season === 'autumn' ? 'freeze' : 'badBatch';
      this.prepared.clear();
      return { what: 'warn' };
    }
    // A late load or a skipped evening: the peak still comes on its night.
    if ((this.phase === 'warned' || this.phase === 'none') && nights === night && clock >= STORM.from && clock < STORM.to) {
      this.kind ??= season === 'winter' || season === 'autumn' ? 'freeze' : 'badBatch';
      this.phase = 'peak';
      this.tally = { helped: 0, turnedAway: 0, deaths: 0, saved: 0 };
      return { what: 'start' };
    }
    if (this.phase === 'peak' && (nights > night || clock >= STORM.to)) {
      const report: StormReport = { kind: this.kind!, index: this.done, ...this.tally };
      this.phase = 'none';
      this.kind = null;
      this.done++;
      return { what: 'end', report };
    }
    // Missed it (the night passed while warned): drop the warning, count it as done.
    if (this.phase === 'warned' && nights > night) {
      this.phase = 'none';
      this.done++;
    }
    return null;
  }

  note(what: keyof Storm['tally']): void {
    if (this.phase === 'peak') this.tally[what]++;
  }

  snapshot(): { done: number; kind: StormKind | null; phase: StormPhase; prepared: StormPrep[]; tally: Storm['tally'] } {
    return { done: this.done, kind: this.kind, phase: this.phase, prepared: [...this.prepared], tally: { ...this.tally } };
  }

  restore(s: Partial<ReturnType<Storm['snapshot']>> | undefined): void {
    if (!s) return;
    if (typeof s.done === 'number' && Number.isFinite(s.done)) this.done = Math.max(0, Math.round(s.done));
    if (s.kind === 'freeze' || s.kind === 'badBatch') this.kind = s.kind;
    if (s.phase === 'warned' || s.phase === 'peak' || s.phase === 'none') this.phase = s.phase;
    this.prepared.clear();
    for (const p of s.prepared ?? []) if (p in STORM.prepare) this.prepared.add(p);
    if (s.tally) this.tally = { helped: s.tally.helped | 0, turnedAway: s.tally.turnedAway | 0, deaths: s.tally.deaths | 0, saved: s.tally.saved | 0 };
  }
}
