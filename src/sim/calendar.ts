/**
 * The date of tonight's night. Each loop of the night (06:00 back to 18:00)
 * moves the calendar on by `pace` days, so seasons can pass in a sitting.
 * Northern-hemisphere seasons; no leap years. Rendering-free.
 */
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface CalendarDate {
  /** 0 = 1 January. */
  dayOfYear: number;
  year: number;
  /** 0 = Monday. */
  weekday: number;
  /** 0 = January. */
  month: number;
  /** 1-based day of the month. */
  day: number;
  season: Season;
}

/** Day of year (0-based) for a month (0-based) and day (1-based). */
export function dayOf(month: number, day: number): number {
  let d = day - 1;
  for (let m = 0; m < month; m++) d += MONTH_DAYS[m];
  return d;
}

export class Calendar {
  dayOfYear: number;
  year = 2027;
  /** Days the calendar moves on each time the night loops. */
  pace = 1;
  /** Weekday of 1 January 2027 (a Friday). */
  private readonly jan1Weekday = 4;

  constructor(dayOfYear = dayOf(9, 15)) {
    this.dayOfYear = dayOfYear;
  }

  get date(): CalendarDate {
    let d = this.dayOfYear;
    let month = 0;
    while (d >= MONTH_DAYS[month]) d -= MONTH_DAYS[month++];
    const yearsSince = this.year - 2027;
    const weekday = (((this.jan1Weekday + yearsSince * 365 + this.dayOfYear) % 7) + 7) % 7;
    const season: Season = month === 11 || month <= 1 ? 'winter' : month <= 4 ? 'spring' : month <= 7 ? 'summer' : 'autumn';
    return { dayOfYear: this.dayOfYear, year: this.year, weekday, month, day: d + 1, season };
  }

  /** The date `days` from tonight's (for the clock past midnight). */
  dateAfter(days: number): CalendarDate {
    const next = new Calendar(this.dayOfYear);
    next.year = this.year;
    next.dayOfYear += days;
    while (next.dayOfYear >= 365) { next.dayOfYear -= 365; next.year++; }
    return next.date;
  }

  /** Moves on when the night loops. */
  nextNight(): void {
    this.dayOfYear += this.pace;
    while (this.dayOfYear >= 365) {
      this.dayOfYear -= 365;
      this.year++;
    }
  }

  /** Clock minutes of dusk tonight: about 16:15 at midwinter, 21:30 at midsummer. */
  get sunset(): number {
    const midsummer = 171;
    const t = Math.cos(((this.dayOfYear - midsummer) / 365) * 2 * Math.PI);
    return Math.round((18.85 + 2.6 * t) * 60);
  }
}

export function formatDate(d: CalendarDate): string {
  return `${WEEKDAYS[d.weekday]} ${d.day} ${MONTHS[d.month]}`;
}
