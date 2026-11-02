/**
 * The street drug scene, as data: where dealing happens, the ways buyers come
 * and go, and where people use. ILLUSTRATIVE: the places are picked so the
 * scene reads on screen, away from the crowd's walking lines, not from any
 * survey of a real open drug scene.
 *
 * What it shows follows what open-scene studies describe: selling at fixed
 * spots with lookouts, quick hand-to-hand exchanges, use nearby (often in
 * shelter: a squat doorway, a park bench), and dealers moving away from police
 * but not from wardens or outreach workers.
 */

export interface P { x: number; z: number }

/** A dealing spot: the seller, their lookout, and the line buyers walk along to reach it (fading in and out at its ends). */
export interface DealSpot {
  at: P;
  /** Faces this way (radians, as Object3D.rotation.y). */
  face: number;
  lookout?: P;
  /** Buyers come in from one end of this line and leave by either. */
  approach: readonly [P, P];
  /** Use spots buyers may go on to (by index in USE_SPOTS); the rest leave. */
  uses: readonly number[];
  /** Kept on even under heavy policing (they move, the scene does not end). */
  stubborn?: boolean;
}

export type UsePose = 'sit' | 'crouch' | 'stand';

/** Where people use, sheltered a little from view. `glow`: a lighter (smoking) or none. */
export interface UseSpot { at: P; face: number; pose: UsePose; group: string }

/**
 * The inner ring's east pavement: no crowd walks it, and its buildings stand
 * west of it, behind it from the camera (the east street's free side is hidden
 * behind its own buildings).
 */
const EAST = 46.2;
const WALL = 45.4;

export const DEAL_SPOTS: readonly DealSpot[] = [
  { at: { x: WALL, z: -6 }, face: Math.PI / 2, lookout: { x: WALL, z: -12.5 }, approach: [{ x: EAST, z: -44 }, { x: EAST, z: 13 }], uses: [0, 1], stubborn: true },
  { at: { x: WALL, z: 31 }, face: Math.PI / 2, lookout: { x: WALL, z: 38 }, approach: [{ x: EAST, z: 26 }, { x: EAST, z: 44 }], uses: [2] },
  // The big park, west lawn.
  { at: { x: -48, z: 88 }, face: Math.PI / 4, lookout: { x: -52, z: 80 }, approach: [{ x: -69, z: 96 }, { x: -40, z: 78 }], uses: [3, 4, 5] },
];

export const USE_SPOTS: readonly UseSpot[] = [
  // Doorways on the ring's east pavement, out of the light.
  { at: { x: 45.35, z: 3.5 }, face: Math.PI / 2, pose: 'sit', group: 'east' },
  { at: { x: 45.6, z: 4.6 }, face: Math.PI / 2, pose: 'crouch', group: 'east' },
  { at: { x: 45.35, z: 41.0 }, face: Math.PI / 2, pose: 'sit', group: 'east' },
  // The big park, west lawn, a little in from the path.
  { at: { x: -44, z: 86.5 }, face: Math.PI / 2, pose: 'sit', group: 'park' },
  { at: { x: -42.8, z: 87.6 }, face: -Math.PI / 2, pose: 'crouch', group: 'park' },
  { at: { x: -43.5, z: 84.6 }, face: 0.4, pose: 'sit', group: 'park' },
];

/** Extra spots that are always occupied while the scene runs: people who stay put, unconnected to the flow. */
export const RESIDENT_USERS: readonly UseSpot[] = [
  { at: { x: 49.5, z: 84 }, face: Math.PI, pose: 'sit', group: 'park' },
];

/**
 * The pocket parks move from launch to launch (world/infill.ts builds one or
 * two in different blocks), so their scene is laid out on whichever park
 * stands: a seller inside the railing by the path, a lookout outside it, and
 * people using on the two benches (which face the paths' crossing) and crouched
 * by one. `cx, cz` is the park's middle and `hw, hd` its half sizes.
 */
export function pocketScene(cx: number, cz: number, hw: number, hd: number, group: string): { deal: DealSpot; uses: UseSpot[] } {
  return {
    deal: {
      at: { x: cx + hw - 1.0, z: cz + Math.min(1.1, hd - 0.8) },
      face: -Math.PI / 2,
      lookout: { x: cx + hw + 0.5, z: cz - 1.0 },
      approach: [{ x: cx - hw - 0.6, z: cz }, { x: cx + hw + 0.6, z: cz }],
      uses: [],
    },
    uses: [
      // The benches sit 1.6 m either side of the crossing and 1.4 m along; the first faces +x, the second -x.
      { at: { x: cx - 1.6, z: cz + 1.4 }, face: Math.PI / 2, pose: 'sit', group },
      { at: { x: cx - 0.9, z: cz + 2.5 }, face: Math.PI * 0.8, pose: 'crouch', group },
      { at: { x: cx + 1.6, z: cz - 1.4 }, face: -Math.PI / 2, pose: 'sit', group },
    ],
  };
}

/** At a squat's door: people sit either side of it, against the wall. Metres along the wall, and out from it. */
export const SQUAT_SEATS: readonly { along: number; out: number; pose: UsePose }[] = [
  { along: -1.3, out: 0.35, pose: 'sit' },
  { along: 1.4, out: 0.35, pose: 'sit' },
  { along: 2.4, out: 0.5, pose: 'crouch' },
];

export const STREET = {
  /** Buyers out at once, at most; scaled by the street market the simulation tracks. */
  buyers: 8,
  /** Seconds an exchange takes, and how long a buyer is gone between visits. */
  exchange: [2.5, 4.5] as const,
  away: [8, 22] as const,
  /** Chance a buyer goes on to use nearby rather than leaving. */
  staysToUse: 0.45,
  /** Seconds someone stays at a use spot. */
  useFor: [25, 60] as const,
  /** Chance per minute that someone using nods off flat; a friend crouches by them. */
  slumpPerMinute: 0.08,
  /** Police level at which all but the stubborn spots go quiet. */
  scatterAt: 2,
  /** The runner's speed on the bike and how long they stop at each spot. */
  runnerSpeed: 4.2,
  runnerStop: 6,
} as const;
