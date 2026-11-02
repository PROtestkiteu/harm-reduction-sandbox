/**
 * The river east of the district, as data. ILLUSTRATIVE: a barge, a small
 * motor launch and a rowing boat working up and down it, passing under the
 * arched road bridges (world/bridges.ts); two people fishing from the
 * promenade wall at dawn and dusk. x is metres east of the city's middle.
 */
export const BOATS = [
  { kind: 'barge', lane: 4.5, speed: 1.8, length: 11 },
  { kind: 'launch', lane: -4, speed: 4.2, length: 5 },
  { kind: 'rowing', lane: -1, speed: 1.1, length: 3 },
] as const;

export const RIVER_RUN = {
  /** Boats work between these z (metres), turning at each end. */
  z: [-150, 150] as const,
  /** Water surface height. */
  y: -0.08,
};

export const FISHING = {
  /** Spots on the promenade wall, facing the water (+x), metres from the river's west edge and along z. */
  spots: [{ out: -1.0, z: 34 }, { out: -1.0, z: -8 }] as const,
  /** Out at dawn and from late afternoon to late evening (clock minutes, 18:00 = 1080). */
  hours: [[1080, 1380], [1740, 1920]] as const,
};
