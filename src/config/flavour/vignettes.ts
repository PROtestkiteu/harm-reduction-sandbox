/**
 * Small scenes of street life, as data. ILLUSTRATIVE placements, kept off the
 * crowd's walking lines (checked against the pavement graph in the dev page).
 */
import type { P } from './street';

/** The busker on the centre park's open north-west lawn, a case open at their feet and a few listeners. */
export const BUSKER = {
  at: { x: 3.6, z: 5.3 } as P,
  face: 1.9,
  listeners: [{ x: 5.3, z: 4.6 }, { x: 5.7, z: 5.9 }, { x: 4.7, z: 3.9 }] as readonly P[],
  /** Listeners come and go: seconds each stays, and seconds before someone new. */
  stay: [20, 50] as const,
  gap: [6, 18] as const,
  /** Plays until about 23:00 (clock minutes). */
  until: 1380,
};

/** Smokers by the club, beside the door on the side away from the queue (metres along the wall, out from it). */
export const SMOKERS = [
  { along: -2.6, out: 0.22 },
  { along: -3.4, out: 0.3 },
  { along: -4.4, out: 0.22 },
] as const;

/** Delivery riders wait with their bikes on the ring's east pavement by the takeaway corner, then ride off. */
export const DELIVERY = {
  wait: [{ x: 46.4, z: -14.0 }, { x: 46.4, z: -15.4 }] as readonly P[],
  ride: [{ x: 46.4, z: -14.6 }, { x: 46.4, z: 46 }] as readonly [P, P],
  waitFor: [40, 110] as const,
  speed: 5,
  /** Food orders: busiest from 19:00 to 01:00. */
  hours: [1140, 1500] as const,
};

/** A bench of the pack's own on the centre park's north lawn: someone feeding pigeons by day, a couple sharing chips after dark. */
export const BENCH = {
  at: { x: 7.4, z: -0.6 } as P,
  face: 0,
  pigeons: 9,
};

/**
 * A hot dog cart: the vendor pushes it along the inner ring's pavements (no
 * crowd walks them, and the camera sees them) from pitch to pitch, a few
 * minutes at each, with customers stopping by.
 */
export const HOTDOG = {
  /** The loop it moves along; pitches lie on it. */
  loop: [{ x: 46.4, z: -46.4 }, { x: 46.4, z: 46.4 }, { x: -46.4, z: 46.4 }] as readonly P[],
  pitches: [{ x: 46.4, z: -30 }, { x: 46.4, z: 18 }, { x: 12, z: 46.4 }, { x: -30, z: 46.4 }] as readonly P[],
  /** Seconds at a pitch, and pushing speed. */
  stay: [140, 280] as const,
  speed: 0.9,
  customers: 2,
  /** Seconds a customer stays, and between customers. */
  serve: [6, 10] as const,
  gap: [8, 25] as const,
};

/**
 * Bus stops where the bus routes leave the playable area: shelters with a
 * sign, and a few people waiting who get on when a bus comes by. Against the
 * buildings, on the side of the street the camera sees (the far side hides them).
 */
export const BUS_STOPS = {
  stops: [
    { at: { x: 21.85, z: -62 }, face: Math.PI / 2 },
    { at: { x: 21.85, z: 62 }, face: Math.PI / 2 },
    { at: { x: -62, z: -23.7 }, face: 0 },
    { at: { x: 62, z: -23.7 }, face: 0 },
  ] as readonly { at: P; face: number }[],
  /** People waiting at a stop, at most; they get on when a bus passes within this many metres. */
  waiting: 2,
  board: 7,
  /** Seconds before someone new turns up at an empty place. */
  arrive: [15, 60] as const,
};
