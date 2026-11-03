/**
 * What crosses the sky, as data. ILLUSTRATIVE and sparse: now and then a
 * small flock of birds, a light aircraft (its lights blinking after dark), a
 * hot-air balloon or a glider drifting over on fine days. Each crossing goes
 * past the middle of the view, at a height the camera still frames.
 */
export const SKY = {
  /** Seconds between crossings of each kind, and how long one takes (they leave the view and stop). */
  birds: { every: [25, 70] as const, flock: [4, 8] as const, height: [14, 26] as const, speed: 7 },
  plane: { every: [90, 200] as const, height: 60, speed: 16 },
  balloon: { every: [160, 320] as const, height: 42, speed: 1.6, day: true },
  glider: { every: [140, 280] as const, height: 50, speed: 7, day: true },
  /** How far either side of the view's middle a crossing runs (metres), at least: further when the view is wider, so it starts and ends unseen. */
  reach: 110,
  /** Out of sight a crossing makes up time: its speed is multiplied by this. */
  unseenHurry: 5,
  /** The balloon drifts with the wind, which veers by up to this much (radians) between one balloon and the next. */
  windVeer: 0.5,
  /** Flocks fly to their roost in the big park at dusk and out from it at dawn (clock minutes), and anywhere between. */
  roost: { x: 2, z: 110, dusk: [1080, 1230] as const, dawn: [1740, 1860] as const },
};
