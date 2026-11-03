/**
 * The river east of the district, as data. ILLUSTRATIVE: a barge, a small
 * motor launch and a rowing boat working up and down it, passing under the
 * arched road bridges (world/bridges.ts); two people fishing from the
 * promenade wall at dawn and dusk. x is metres east of the city's middle.
 */
/**
 * `lane`: metres from the river's middle, on the right of the way a boat is
 * going (every boat keeps right, so those passing each other never share
 * water). Lanes far enough apart that a faster boat overtakes a slower one
 * going the same way side by side.
 */
export const BOATS = [
  { kind: 'barge', lane: 6.5, speed: 1.8, length: 11 },
  { kind: 'launch', lane: 3.5, speed: 4.2, length: 5 },
  { kind: 'rowing', lane: 1.2, speed: 1.1, length: 3 },
] as const;

export const RIVER_RUN = {
  /** Boats work between these z (metres), turning at each end: past the widest view, so never in sight. */
  z: [-330, 330] as const,
  /** Out of sight a boat makes up time: its speed is multiplied by this. */
  unseenHurry: 4,
  /** Metres either side of a bridge's middle that count as under its arch: a boat waits short of it while one comes the other way. */
  arch: 8,
  /** Water surface height. */
  y: -0.08,
};

export const FISHING = {
  /** Spots on the promenade wall, facing the water (+x), metres from the river's west edge and along z. */
  spots: [{ out: -1.0, z: 34 }, { out: -1.0, z: -8 }] as const,
  /** Out at dawn and from late afternoon to late evening (clock minutes, 18:00 = 1080). */
  hours: [[1080, 1380], [1740, 1920]] as const,
};
