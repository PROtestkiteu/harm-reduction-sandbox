/** Small seeded PRNG (mulberry32) so a session replays the same evening. */
export type Random = () => number;

export function createRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(random: Random, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

export function range(random: Random, [min, max]: readonly [number, number]): number {
  return min + random() * (max - min);
}

/** Exponential inter-arrival time for a Poisson process with `perMinute` events. */
export function nextArrival(random: Random, perMinute: number): number {
  if (perMinute <= 0) return Infinity;
  return (-Math.log(1 - random()) * 60) / perMinute;
}
