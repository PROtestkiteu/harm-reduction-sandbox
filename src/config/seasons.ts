/**
 * Seasons: what changes in the district across the year. Every number here
 * is an illustrative placeholder, like the rest of the sandbox. The
 * directions follow well-known patterns (more people outdoors and at venues
 * in summer; more demand for shelter and warmth in winter, when councils run
 * severe-weather emergency provision), but the sizes are not measured. The
 * season itself comes from tonight's date (sim/calendar.ts); how often events
 * start by season lives with the events.
 */
import type { Season } from '../sim/calendar';

export type { Season };

export interface SeasonProfile {
  label: string;
  /** Multipliers on arrival rates (illustrative). */
  demand: { passerby: number; club: number; dropIn: number; outreach: number; shelter: number };
  /** Share of tourists among passers-by, relative to the year's average. */
  tourists: number;
  /** World look. */
  look: {
    /** 0 dry to about 3 rain-soaked; drives street reflections. */
    wetness: number;
    /** 0 none to 1 settled snow on roofs, ledges and kerbs. */
    snow: number;
    /** Light tint and strength at dusk. */
    light: number;
    lightStrength: number;
    /** What drifts through the air. */
    drift: 'none' | 'snow' | 'leaves' | 'petals';
  };
  /** Clothing: chances added to or taken from the everyday wardrobe. */
  clothes: { coat: number; hat: number; hoodUp: number; shortSleeves: number };
}

export const SEASON_PROFILES: Record<Season, SeasonProfile> = {
  spring: {
    label: 'Spring',
    demand: { passerby: 1.0, club: 1.0, dropIn: 1.0, outreach: 1.0, shelter: 0.9 },
    tourists: 1.0,
    look: { wetness: 2.6, snow: 0, light: 0xf0f0ff, lightStrength: 1.0, drift: 'petals' },
    clothes: { coat: 0, hat: 0, hoodUp: 0.05, shortSleeves: 0.1 },
  },
  summer: {
    label: 'Summer',
    demand: { passerby: 1.35, club: 1.25, dropIn: 0.9, outreach: 1.1, shelter: 0.7 },
    tourists: 1.8,
    look: { wetness: 0.8, snow: 0, light: 0xfff0d8, lightStrength: 1.15, drift: 'none' },
    clothes: { coat: -1, hat: -0.2, hoodUp: -1, shortSleeves: 0.65 },
  },
  autumn: {
    label: 'Autumn',
    demand: { passerby: 1.0, club: 1.0, dropIn: 1.0, outreach: 1.0, shelter: 1.0 },
    tourists: 0.8,
    look: { wetness: 2.4, snow: 0, light: 0xffffff, lightStrength: 1.0, drift: 'leaves' },
    clothes: { coat: 0, hat: 0, hoodUp: 0, shortSleeves: 0 },
  },
  winter: {
    label: 'Winter',
    demand: { passerby: 0.65, club: 0.85, dropIn: 1.25, outreach: 1.2, shelter: 1.6 },
    tourists: 0.5,
    look: { wetness: 1.4, snow: 1, light: 0xd8e4ff, lightStrength: 0.85, drift: 'snow' },
    clothes: { coat: 0.4, hat: 0.4, hoodUp: 0.25, shortSleeves: -1 },
  },
};
