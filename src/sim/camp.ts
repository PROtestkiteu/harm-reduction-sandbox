import type { Season } from './calendar';

/**
 * The tent camp in the big park: people with nowhere else to go. Outside
 * winter it grows when the shelter is shut or crowded (people turned away set
 * up tents) and in a crisis; in winter people look for somewhere indoors
 * instead. It shrinks while the shelter is open and outreach keeps in touch. `size` runs 0 (none) to 1 (the
 * park full of tents). ILLUSTRATIVE rates, placeholders for play.
 */
export const CAMP = {
  /** Growth per clock hour with the shelter shut. */
  shelterShut: 0.03,
  /** Extra growth per clock hour outside winter with the shelter full (scaled by how crowded it is). */
  crowded: 0.04,
  /** Extra growth per clock hour at the worst of a crisis. */
  crisis: 0.03,
  /** Shrinking per clock hour with the shelter open. */
  shelterOpen: 0.02,
  /** Extra shrinking per clock hour with outreach open. */
  outreachOpen: 0.015,
  /** At full size, outreach demand rises by this share. */
  outreachDemand: 0.6,
  /** At full size, harm outdoors rises by this share. */
  harm: 0.5,
  /** In winter: camp moving into the squat, and the squat filling, per clock hour. */
  toSquat: 0.02,
  squatFills: 0.03,
  /** Outside winter the squat empties this much per clock hour. */
  squatEmpties: 0.01,
  /** A camper by a full squat reaches this many more people (on top of the squat's usual pull). */
  squatDemand: 0.8,
  /** Above this size the council may order the camp cleared. */
  sweepAt: 0.6,
} as const;

export interface CampInput {
  season: Season;
  shelterOpen: boolean;
  outreachOpen: boolean;
  crisis: number;
  /** How crowded the shelter is: its queue over its waiting places, 0 to 1. */
  shelterCrowded: number;
}

export class Camp {
  size = 0.15;
  /** How full the squat is, 0 to 1: in winter people move in from the park and the street. */
  squat = 0.2;

  tick(dtMinutes: number, inp: CampInput): void {
    const hours = dtMinutes / 60;
    const warm = inp.season !== 'winter';
    const grow = (inp.shelterOpen ? 0 : CAMP.shelterShut) * (warm ? 1 : 0.4) + (warm ? CAMP.crowded * inp.shelterCrowded : 0) + CAMP.crisis * inp.crisis;
    const shrink = (inp.shelterOpen ? CAMP.shelterOpen : 0) + (inp.outreachOpen ? CAMP.outreachOpen : 0);
    // In winter the squat fills, partly from the camp; in the warm months it empties slowly.
    const moving = warm ? 0 : Math.min(this.size, CAMP.toSquat * hours);
    this.size = Math.min(1, Math.max(0, this.size + (grow - shrink) * hours - moving));
    this.squat = Math.min(1, Math.max(0, this.squat + (warm ? -CAMP.squatEmpties : CAMP.squatFills) * hours + moving));
  }

  /** People living in the camp, for the cards (about 2 per tent, up to 14 tents). */
  get people(): number {
    return Math.round(this.size * 14) * 2;
  }

  /** People living in the squat now (up to about 30). */
  get squatPeople(): number {
    return 4 + Math.round(this.squat * 26);
  }
}
