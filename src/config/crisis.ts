/**
 * Crisis mode: when many people leave without being served over a day, the
 * street gets worse on its own. ILLUSTRATIVE: the thresholds and effects are
 * placeholders for play.
 */
export const CRISIS = {
  /** Unmet need over 24 clock hours below which there is no crisis. */
  calm: 20,
  /** Unmet need over 24 clock hours at which the crisis is at its worst. */
  full: 80,
  /** Random events come this much more often at the worst. */
  eventBoost: 1,
  /** Grant chances drop by this share at the worst. */
  grantCut: 0.4,
  /** Harm to people outdoors rises by this share at the worst. */
  harmBoost: 0.8,
} as const;
