import { t } from '../i18n';

/**
 * Petty theft on the district's streets: pickpockets in the evening crowd and
 * shoplifters at the corner shops. ILLUSTRATIVE placeholders throughout: the
 * library has no evidence on street theft rates. Like the rest of the city's
 * crime, none of it is attributed to people who use drugs; a rougher street
 * (more people with nowhere to go, fewer people about who look out for each
 * other) gives it more room, and more eyes on the street give it less.
 */
export const PETTY = {
  /** Expected incidents per clock hour on a typical evening, in the hours each happens ([from, to) clock minutes, 18:00 = 1080). */
  pickpocket: { perHour: 0.45, hours: [1140, 1680] as const },
  shoplifting: { perHour: 0.55, hours: [1080, 1410] as const },
  /** A rough street scene (0 to 1) adds this share on top. */
  streetBoost: 1.2,
  /** Police on patrol divide the rate by 1 + this per officer level. */
  policeDamp: 0.5,
  /** The harm reduction foot patrol on the street: fewer chances taken where people are looked after. */
  footPatrolCut: 0.3,
  /** The corner shops the shoplifters work. */
  shops: 3,
  /** A shop hit this many times (fading over a day) hires a security guard for this long, which cuts its thefts. */
  guardAfter: 3,
  guardHours: 48,
  guardCut: 0.75,
  /** A guard catches this share of those who still try. */
  guardCatches: 0.5,
  /** Hit this often, the shop pulls its shutters down early for a night. */
  shutAfter: 5,
  shutHours: 20,
  /** Each theft adds this much to the police meter (a caught one, half again: they come to take the report). */
  stress: 0.012,
  /** And this to how unsafe the street feels. */
  pressure: 0.05,
} as const;


/** The shops, in the order the world places them (config/flavour/thieves.ts). */
export const SHOP_NAMES: readonly string[] = [t('the corner shop'), t('the off-licence'), t('the late-night grocer')];
