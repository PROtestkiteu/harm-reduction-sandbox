/**
 * The university just past the district's west edge, by its south-west corner
 * where the big park begins, in reach of the camera's pan. ILLUSTRATIVE layout. It stands outside the district, so it
 * changes nothing the simulation tracks; with the pack off, ordinary housing
 * stands on the site instead.
 */
import type { Rect } from '../../world/layout';
import type { P } from './street';

/** The whole site, kept clear of the city's other blocks. */
export const CAMPUS: Rect = { x0: -106, x1: -74, z0: 54, z1: 88 };

/** The main hall faces east across a plaza towards the district and the park. */
export const HALL: Rect = { x0: -104, x1: -86, z0: 58, z1: 78 };
export const LIBRARY: Rect = { x0: -104, x1: -92, z0: 81, z1: 88 };
export const STUDENT_BAR: Rect = { x0: -84, x1: -78, z0: 82, z1: 88 };
export const PLAZA: Rect = { x0: -86, x1: -74, z0: 55, z1: 81 };
/** How far the plaza's furniture (drawn for the first layout) moved with the campus. */
export const SHIFT = { x: 2, z: -22 };

/** Where students sit and stand about, in groups. */
export const HANGOUTS: readonly { at: P; pose: 'sit' | 'talk' | 'stand'; face: number }[] = [
  // On the hall's steps.
  { at: { x: -84.6, z: 66.6 }, pose: 'sit', face: Math.PI / 2 },
  { at: { x: -84.6, z: 68.2 }, pose: 'sit', face: Math.PI / 2 },
  { at: { x: -84, z: 70.4 }, pose: 'sit', face: Math.PI / 2 },
  // A group by the fountain.
  { at: { x: -78.4, z: 63.2 }, pose: 'talk', face: -Math.PI / 2 },
  { at: { x: -80, z: 62.4 }, pose: 'talk', face: Math.PI / 3 },
  { at: { x: -79.6, z: 64.6 }, pose: 'stand', face: Math.PI },
  // The bar's terrace.
  { at: { x: -80.8, z: 80.4 }, pose: 'sit', face: Math.PI },
  { at: { x: -79.2, z: 80.2 }, pose: 'sit', face: Math.PI },
  { at: { x: -77.6, z: 81 }, pose: 'talk', face: -Math.PI / 2 },
  // On the park's lawn just past the corner.
  { at: { x: -66.0, z: 81.0 }, pose: 'sit', face: 0.6 },
  { at: { x: -64.6, z: 80.4 }, pose: 'sit', face: -0.6 },
  { at: { x: -65.2, z: 82.4 }, pose: 'sit', face: Math.PI },
];

/** Students walking between the campus and the district, along the park's edge. */
export const WALKS: readonly (readonly [P, P])[] = [
  [{ x: -76, z: 76.5 }, { x: -50, z: 76.8 }],
  [{ x: -74.8, z: 58 }, { x: -74.8, z: 76 }],
];

/** Fewer students out late: share of the hangouts used, by clock minutes. */
export const STUDENTS_OUT: readonly { from: number; share: number }[] = [
  { from: 1080, share: 0.7 }, { from: 1260, share: 1 }, { from: 1500, share: 0.5 }, { from: 1620, share: 0.15 },
];
