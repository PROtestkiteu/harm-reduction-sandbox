import { Group } from 'three';
import { CROWD_KINDS, type HappeningId } from '../../config/flavour/crowds';
import { HANGOUTS } from '../../config/flavour/campus';
import { nearestNode, routeTo } from '../../agents/nav';
import { range } from '../../sim/random';
import { FESTIVAL_GATE, STADIUM_GATE, type P2 } from '../layout';
import { BRIDGE_SPAN, bridgeY } from '../bridges';
import { fade, walkTo, type Actor } from './actors';
import type { Pack, PackDeps } from './index';

/**
 * Crowds for the big days (config/flavour/crowds.ts), driven by the
 * simulation's happenings (FlavourContext.happenings: what is on, whether
 * people are arriving, it is on, or they are leaving, and how big): fans
 * come out of the open bars and walk over the north bridge to the stadium gate
 * before a match, then back to the bars after it, chanting, squaring up now
 * and then;
 * festival-goers stream between the festival gate and the district; students
 * walk from the campus to the bars and stand outside them. Walkers are a
 * fixed pool per kind, reused; with nothing on the pack does no work.
 */
/** `last`: the route ends where they go in (the stadium, a pub), so they leave the street there. */
interface Walker { a: Actor; on: boolean; route: P2[]; leg: number; speed: number; linger: number; last: boolean; at?: { face: number } }

/** Where each kind comes from, before the district's streets take over. */
const ORIGIN: Record<HappeningId, P2[]> = {
  // The stadium gate, over the north bridge along the north street's north pavement (its walking line, clear of the benches at the back).
  match: [STADIUM_GATE, { x: STADIUM_GATE.x - 18, z: -22.75 }, { x: 46, z: -22.75 }],
  festival: [FESTIVAL_GATE, { x: FESTIVAL_GATE.x, z: FESTIVAL_GATE.z - 6 }],
  uniWeekend: [HANGOUTS[0].at, { x: -60, z: 66 }],
};

/** Where people gather when no bar is open yet: the ring road's outer north pavement, which faces the camera. */
const NO_BARS: readonly { at: P2; face: number }[] = [
  { at: { x: -28, z: -54.2 }, face: Math.PI }, { at: { x: 12, z: -54.2 }, face: Math.PI }, { at: { x: 38, z: -54.2 }, face: Math.PI },
];

export function buildCrowds({ pool, board, random, scene }: PackDeps): Pack {
  const root = new Group();
  scene.add(root);
  const kinds = Object.keys(CROWD_KINDS) as HappeningId[];
  const walkers = {} as Record<HappeningId, Walker[]>;
  const spawnIn = {} as Record<HappeningId, number>;
  for (const k of kinds) {
    const c = CROWD_KINDS[k];
    walkers[k] = Array.from({ length: c.most }, (_, i) => {
      const a = pool.add({ style: c.style, dress: c.dress[i % c.dress.length], extra: c.dress[i % c.dress.length].extra ?? 'none', kit: c.dress[i % c.dress.length].kit });
      a.voice = c.voice;
      return { a, on: false, route: [], leg: 0, speed: range(random, c.pace), linger: 0, last: false };
    });
    spawnIn[k] = 0;
  }
  let sayIn = 3;
  let busy = false;

  /** A route to the district: the kind's way in, then the streets to a bar spot (or a corner if no bar is open). */
  const inbound = (k: HappeningId, bars: readonly { at: P2; face: number }[]): { route: P2[]; face?: number } => {
    const o = ORIGIN[k];
    const list = bars.length ? bars : NO_BARS;
    const bar = list[Math.floor(random() * list.length)];
    const end = bar.at;
    const off = { x: (random() - 0.5) * 1.2, z: (random() - 0.5) * 1.2 };
    const streets = routeTo(o[o.length - 1], nearestNode(end), off);
    return { route: [...o, ...streets, { x: end.x + off.x * 0.5, z: end.z + off.z * 0.5 }], face: bar.face };
  };

  return {
    setEnabled(on) {
      root.visible = on;
      if (!on) for (const k of kinds) for (const w of walkers[k]) { w.a.shown = 0; w.on = false; }
    },
    update(dt, ctx) {
      const on = ctx.happenings;
      if (!on.length && !busy) return;
      busy = false;
      for (const k of kinds) {
        const c = CROWD_KINDS[k];
        const h = on.find((x) => x.id === k);
        const list = walkers[k];
        // New walkers while people arrive (or, for students and the festival, all the while it is on).
        const want = h ? Math.round(c.most * Math.min(1, Math.max(0, h.crowd))) : 0;
        // Fans walk to the stadium before kick-off and to the pubs after the final whistle; the others while it is on.
        const coming = h && (h.phase === 'arriving' || (h.phase === 'on' && k !== 'match') || (h.phase === 'leaving' && k === 'match'));
        const toGate = k === 'match' && h?.phase === 'arriving';
        if (coming && (spawnIn[k] -= dt) <= 0) {
          spawnIn[k] = c.every * (0.6 + random() * 0.8);
          const free = list.find((w) => !w.on && w.a.shown <= 0.01);
          if (free && list.filter((w) => w.on).length < want) {
            const r = inbound(k, ctx.bars);
            // Before the match the same way, from the pub out to the turnstiles.
            const route = toGate ? [...r.route].reverse() : r.route;
            Object.assign(free, {
              on: true, route, leg: 1, last: k === 'match',
              linger: toGate ? 0 : range(random, c.linger), at: toGate || r.face === undefined ? undefined : { face: r.face },
            });
            free.a.x = route[0].x;
            free.a.z = route[0].z;
          }
        }
        for (const w of list) {
          if (!w.on) { fade(w.a, false, dt); continue; }
          busy = true;
          fade(w.a, true, dt, 1.2);
          // Leaving: the way back, reversed, from wherever they are.
          // The festival or the weekend is ending: whoever is standing about heads home.
          if (h?.phase === 'leaving' && k !== 'match' && w.leg >= w.route.length && w.linger > 0) w.linger = 0;
          if (w.leg < w.route.length) {
            const p = w.route[w.leg];
            if (walkTo(w.a, p.x, p.z, w.speed, dt)) w.leg++;
            // Over the river on the arched north bridge.
            w.a.lift = w.a.x > BRIDGE_SPAN.x0 && w.a.x < BRIDGE_SPAN.x1 && Math.abs(w.a.z + 19) < 5 ? bridgeY(w.a.x) - 0.02 : 0;
            continue;
          }
          // At the bar: standing about, facing it, until it is time to go.
          w.a.pose = 'talk';
          if (w.at) w.a.heading = w.at.face;
          if ((w.linger -= dt) > 0) continue;
          if (w.last || !w.route.length) { w.on = false; continue; }
          Object.assign(w, { route: [...w.route].reverse(), leg: 1, at: undefined, last: true });
        }
        // A scuffle among the fans the simulation reported: two of them square up for a few seconds.
        if (k === 'match' && ctx.scuffles > 0) {
          const near = list.filter((w) => w.on && w.leg >= w.route.length && w.a.detailed);
          if (near.length >= 2) {
            const [p, q] = near;
            p.a.heading = Math.atan2(q.a.x - p.a.x, q.a.z - p.a.z);
            q.a.heading = p.a.heading + Math.PI;
            p.a.body = q.a.body = 'drunk';
            board.speak(p.a.x, p.a.z, 'fans');
          }
          ctx.scuffles = 0;
        }
      }
      // A chant or a shout now and then from someone in view.
      if ((sayIn -= dt) <= 0) {
        sayIn = 4 + random() * 5;
        for (const k of kinds) {
          const w = walkers[k].find((x) => x.on && x.a.detailed && x.a.shown > 0.9);
          if (w) { board.speak(w.a.x, w.a.z, CROWD_KINDS[k].voice); break; }
        }
      }
    },
  };
}
