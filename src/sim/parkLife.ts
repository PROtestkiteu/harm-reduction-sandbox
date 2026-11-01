import { t } from '../i18n';
import type { Season } from './calendar';

/**
 * What goes on in the big park and what spoils it. Joggers run in the early
 * evening and before dawn; a yoga class meets 18:30 to 20:00 out of winter; a
 * family picnic, 18:00 to 20:30 in spring and summer. How uneasy the park
 * feels (the tent camp, dealing) thins the joggers and calls off the class and
 * the picnic; each call-off costs the district a little of its good name.
 * ILLUSTRATIVE thresholds and costs, placeholders for play.
 */
export const PARK = {
  /** Above this unease the class and the picnic do not come. */
  cancelAt: 0.45,
  /** What a call-off takes from the district's name and sense of safety. */
  reputationHit: 0.02,
  safetyHit: 0.015,
} as const;

export interface ParkInput {
  clock: number;
  season: Season;
  /** 0..1: the camp in the park. */
  camp: number;
  /** 0..1: dealing on the street and in the park. */
  market: number;
}

export interface ParkNow {
  joggers: number;
  yoga: boolean;
  picnic: boolean;
}

export class ParkLife {
  now: ParkNow = { joggers: 0, yoga: false, picnic: false };
  /** What was called off today, so each is noticed once a day. */
  private calledOff = new Set<string>();
  private day = -1;

  /** Updates what is on; returns notices for anything called off just now, and how much it cost. */
  tick(inp: ParkInput, dayOfYear: number): { notices: string[]; reputation: number; safety: number } {
    if (dayOfYear !== this.day) { this.day = dayOfYear; this.calledOff.clear(); }
    const unease = Math.min(1, Math.max(inp.camp, inp.market));
    const c = inp.clock % (24 * 60);
    const h = c / 60;
    const evening = h >= 18 && h < 22;
    const dawn = h >= 5 && h < 7;
    const yogaTime = inp.season !== 'winter' && c >= 18 * 60 + 30 && c < 20 * 60;
    const picnicTime = (inp.season === 'spring' || inp.season === 'summer') && c >= 18 * 60 && c < 20 * 60 + 30;
    const safe = unease < PARK.cancelAt;
    this.now = {
      joggers: evening || dawn ? Math.round(4 * (1 - unease)) : 0,
      yoga: yogaTime && safe,
      picnic: picnicTime && safe,
    };
    const notices: string[] = [];
    let reputation = 0;
    let safety = 0;
    const off = (id: string, text: string) => {
      if (this.calledOff.has(id)) return;
      this.calledOff.add(id);
      notices.push(text);
      reputation += PARK.reputationHit;
      safety += PARK.safetyHit;
    };
    const why = inp.camp >= inp.market ? t('the camp') : t('the dealing');
    if (yogaTime && !safe) off('yoga', t('The yoga class in the park is called off tonight: with {why} there, people stay away.', { why }));
    if (picnicTime && !safe) off('picnic', t('Families skip their picnic in the park: with {why} there, it does not feel safe.', { why }));
    return { notices, reputation, safety };
  }
}
