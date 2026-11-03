import { Group, type Object3D } from 'three';
import { add, box, cylinder } from '../kit';
import { STREETS, type P2 } from '../layout';
import { mat } from '../materials';
import { fade, walkTo, type Actor } from './actors';
import type { Pack, PackDeps } from './index';

/**
 * Skateboarders on the ring road's inner pavements, south and east (no one
 * walks there in a line): a few ride the loop out and back in the evening and
 * late, pushing off, carving, popping an ollie now and then and the odd
 * kickflip, board and rider leaving the ground together; one stops to talk
 * now and then. Hidden outside their hours.
 */

const SKATERS = 3;
const HOURS: readonly [number, number] = [1100, 1560];
const SPEED: readonly [number, number] = [2.6, 3.6];
/** How high and how long an ollie is. */
const OLLIE = { height: 0.35, time: 0.55 };
const DECK = 0.1;

/** A board on its own group: `deck` rises with the rider, the outer group sits where the pool puts it. */
function board(root: Object3D, deckColour: number): { holder: Group; deck: Group } {
  const holder = new Group();
  root.add(holder);
  const deck = add(holder, new Group());
  add(deck, box(0.2, 0.025, 0.8, mat(deckColour), 0, 0.07, 0));
  add(deck, box(0.21, 0.004, 0.78, mat(0x1a1a1a), 0, 0.096, 0));
  for (const z of [-0.27, 0.27]) {
    add(deck, box(0.16, 0.03, 0.05, mat(0x8a8c8e), 0, 0.04, z));
    for (const x of [-0.09, 0.09]) add(deck, cylinder(0.03, 0.035, mat(0xe8e2d0), 6, x, 0.005, z)).rotation.z = Math.PI / 2;
  }
  return { holder, deck };
}

export function buildSkaters({ pool, board: lines, random, scene }: PackDeps): Pack {
  const root = new Group();
  scene.add(root);
  // The loop: west to east along the inner south pavement, round the corner, north along the inner east pavement.
  const south = STREETS.ringSouth.pavements[0];
  const east = STREETS.ringEast.pavements[0];
  const zS = (south.z0 + south.z1) / 2 - 0.3;
  const xE = (east.x0 + east.x1) / 2 - 0.3;
  const loop: P2[] = [{ x: -40, z: zS }, { x: xE, z: zS }, { x: xE, z: -40 }];
  const riders = Array.from({ length: SKATERS }, (_, i) => {
    const a: Actor = pool.add({ style: i === 1 ? 'raver' : 'student', kit: { hood: i === 2 ? 'up' : 'down' } });
    const b = board(root, [0xc83a2a, 0x2a6ab0, 0xd0a020][i]);
    a.attach = b.holder;
    a.voice = 'skater';
    return { a, b, leg: 1, dir: 1, speed: SPEED[0] + random() * (SPEED[1] - SPEED[0]), hop: 0, hopIn: 2 + random() * 4, flip: false, stop: 0, start: i * 9 + random() * 6 };
  });
  let sayIn = 6;

  return {
    setEnabled(on) {
      root.visible = on;
      if (!on) for (const r of riders) r.a.shown = 0;
    },
    update(dt, ctx) {
      const on = ctx.clock >= HOURS[0] && ctx.clock < HOURS[1];
      for (const r of riders) {
        const a = r.a;
        if ((r.start -= dt) > 0) { a.shown = 0; continue; }
        // Out of sight: back to the start of the loop before fading in.
        if (a.shown <= 0.01) { a.x = loop[0].x; a.z = loop[0].z; r.leg = 1; r.dir = 1; }
        fade(a, on, dt, 0.6);
        if (a.shown <= 0.01) continue;
        if (r.stop > 0) {
          // Off the board a moment, foot on the tail.
          r.stop -= dt;
          a.lift = DECK;
          a.pose = 'talk';
          r.b.deck.position.y = 0;
          continue;
        }
        const p = loop[r.leg];
        if (walkTo(a, p.x, p.z, r.speed, dt)) {
          // At an end of the loop, back the other way.
          if (r.leg + r.dir < 0 || r.leg + r.dir >= loop.length) r.dir = -r.dir;
          r.leg += r.dir;
          if (random() < 0.3) r.stop = 3 + random() * 4;
        }
        a.pose = 'stand';
        a.speed = 0;
        // An ollie now and then: up together, a kickflip on some (the deck turns over under the feet).
        if (r.hop > 0) {
          r.hop -= dt;
          const k = 1 - r.hop / OLLIE.time;
          const y = Math.sin(Math.max(0, k) * Math.PI) * OLLIE.height;
          a.lift = DECK + y;
          r.b.deck.position.y = y;
          r.b.deck.rotation.z = r.flip ? Math.min(1, k * 1.4) * Math.PI * 2 : 0;
          r.b.deck.rotation.x = r.flip ? 0 : -Math.sin(k * Math.PI) * 0.35;
        } else {
          a.lift = DECK;
          r.b.deck.position.y = 0;
          r.b.deck.rotation.set(0, 0, 0);
          if (!ctx.still && (r.hopIn -= dt) <= 0) {
            r.hop = OLLIE.time;
            r.flip = random() < 0.3;
            r.hopIn = 2.5 + random() * 5;
          }
        }
      }
      if ((sayIn -= dt) <= 0) {
        sayIn = 7 + random() * 6;
        const r = riders.find((x) => x.a.detailed && x.a.shown > 0.9);
        if (r) lines.speak(r.a.x, r.a.z, 'skater');
      }
    },
  };
}
