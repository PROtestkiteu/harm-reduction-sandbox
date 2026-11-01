/**
 * Scene clock helpers. The day runs from 18:00 round to 18:00 the next day,
 * counted on from the evening (so 02:00 is 26 * 60 and 10:00 is 34 * 60),
 * then loops. Keeping one running count avoids a jump at midnight for
 * anything timed across it.
 */

export const DAY_START = 18 * 60;
export const DAY_END = DAY_START + 24 * 60;
/** Morning, when things that closed overnight open again. */
export const MORNING = 32 * 60;
/** The club's door shuts at six and opens again for the evening. */
export const CLUB_CLOSES = 30 * 60;
export const CLUB_OPENS = 40 * 60;

export function formatClock(minutes: number): string {
  const m = Math.floor(minutes) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** True once the clock has passed midnight (the calendar date shown moves on). */
export function pastMidnight(minutes: number): boolean {
  return minutes >= 24 * 60;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Minutes after midnight for a running clock value. */
const ofDay = (minutes: number) => ((minutes % 1440) + 1440) % 1440;

/**
 * 0 by day and at dusk, 1 in deep night. Follows tonight's sunset (minutes
 * after midnight, from the calendar); sunrise mirrors it around 13:00.
 */
export function nightFactor(minutes: number, sunset = 19 * 60): number {
  const h = ofDay(minutes);
  const sunrise = 26 * 60 - sunset;
  if (h >= sunset) return smoothstep(sunset + 20, sunset + 200, h);
  if (h < sunrise) return 1 - smoothstep(sunrise - 120, sunrise, h);
  return 0;
}

/** 1 in full daylight, 0 at dusk and through the night. */
export function dayFactor(minutes: number, sunset = 19 * 60): number {
  const h = ofDay(minutes);
  const sunrise = 26 * 60 - sunset;
  return smoothstep(sunrise, sunrise + 100, h) * (1 - smoothstep(sunset - 120, sunset, h));
}
