/** Scene minutes per trend bucket and how many buckets a sparkline shows. */
export const TREND_BUCKET_MINUTES = 2;
export const TREND_BUCKETS = 24;

export type MetricKey = 'demand' | 'attended' | 'unmetNeed' | 'adverse';
export const METRIC_KEYS: readonly MetricKey[] = ['demand', 'attended', 'unmetNeed', 'adverse'];
type Counts = Record<MetricKey, number>;

/**
 * New counts per bucket of scene time, derived from the simulation's running
 * totals. Fixed-size ring per metric, no allocation per sample. Buckets are
 * keyed on the scene clock, so pausing or changing speed never skews them.
 */
export class MetricTrend {
  private readonly series: Record<MetricKey, number[]> = { demand: [], attended: [], unmetNeed: [], adverse: [] };
  private bucket = -1;
  private base: Counts | null = null;
  private latest: Counts | null = null;

  /** Feed the running totals at the current scene clock (minutes). */
  sample(clockMinutes: number, totals: Counts): void {
    const bucket = Math.floor(clockMinutes / TREND_BUCKET_MINUTES);
    if (!this.base) {
      this.base = { ...totals };
      this.bucket = bucket;
    } else if (bucket !== this.bucket) {
      // Close the bucket that just ended (and any skipped ones as zero).
      const closed = this.latest ?? this.base;
      for (const k of METRIC_KEYS) push(this.series[k], Math.max(0, closed[k] - this.base[k]));
      for (let b = this.bucket + 1; b < bucket; b++) for (const k of METRIC_KEYS) push(this.series[k], 0);
      this.base = { ...closed };
      this.bucket = bucket;
    }
    this.latest = { ...totals };
  }

  values(key: MetricKey): readonly number[] {
    return this.series[key];
  }
}

function push(ring: number[], v: number): void {
  ring.push(v);
  if (ring.length > TREND_BUCKETS) ring.shift();
}

/** Polyline points for a small sparkline in a `w` by `h` box; empty when too little data. */
export function sparkPoints(values: readonly number[], w: number, h: number, peak: number): string {
  if (values.length < 2) return '';
  const max = Math.max(1, peak);
  const step = w / (TREND_BUCKETS - 1);
  const x0 = w - step * (values.length - 1);
  return values.map((v, i) => `${(x0 + i * step).toFixed(1)},${(h - 1 - (v / max) * (h - 2)).toFixed(1)}`).join(' ');
}
