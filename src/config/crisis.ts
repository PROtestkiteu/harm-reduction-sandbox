/**
 * Crisis mode: when many people leave without being served over a day, the
 * street gets worse on its own. ILLUSTRATIVE: the thresholds and effects are
 * placeholders for play.
 */
export const CRISIS = {
  /** Unmet need over 24 clock hours below which there is no crisis. */
  calm: 30,
  /** Unmet need over 24 clock hours at which the crisis is at its worst. */
  full: 85,
  /**
   * A city service pushed near its limit brings a crisis on its own: from this pressure (0 to 1)
   * on the busiest of police, medics and the sobering-up centre, full at `stressFull`.
   */
  stressFrom: 0.85,
  stressFull: 1,
  /** Random events come this much more often at the worst. */
  eventBoost: 1.6,
  /** Grant chances drop by this share at the worst. */
  grantCut: 0.6,
  /** Harm to people outdoors rises by this share at the worst. */
  harmBoost: 1.2,
  /**
   * Neglect comes back as clients: in a crisis, and while the city's services are stretched, more
   * people in trouble come to the harm reduction services (this much more at the worst, and up to
   * `stressSurge` more as the busiest city service goes from `surgeFrom` to its limit), and they
   * come in a worse state, so a visit costs up to `visitCostBoost` more.
   */
  demandSurge: 0.8,
  stressSurge: 0.4,
  surgeFrom: 0.55,
  visitCostBoost: 1.5,
  /**
   * In a crisis, people turned away come back worse off and the team gives first aid at the door:
   * supplies and staff time, up to this much per person at the worst.
   */
  doorstepCost: 6,
} as const;

