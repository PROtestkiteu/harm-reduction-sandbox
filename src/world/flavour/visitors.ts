import { Group } from 'three';
import { VISIT_DRESS, VISIT_LINES, VISIT_ROOM } from '../../config/flavour/streetPeople';
import type { P } from '../../config/flavour/street';
import type { VisitorKind } from '../../config/streetVisitors';
import { EDGES, NODES, VENUE_FRAME, VENUE_ROT, toWorld } from '../layout';
import { fade, type Actor } from './actors';
import type { Pack, PackDeps } from './index';
import { placard } from './props';

/**
 * Tonight's picket, priest or nun at the drop-in (sim/streetVisitors.ts), for
 * harm reduction or against it: placards or a candlelit vigil, preaching at
 * the queue or handing out tea and blankets. Three people for a picket, one
 * otherwise; each kind has its own figures, so a change of visitor is a fade.
 */
/** Gap from `p` to the crowd's nearest walking line (centrelines, less the walkers' side offset). */
function gap(p: P): number {
  let best = Infinity;
  for (const [a, b] of EDGES) {
    const A = NODES[a], B = NODES[b];
    const dx = B.x - A.x, dz = B.z - A.z;
    const k = Math.max(0, Math.min(1, ((p.x - A.x) * dx + (p.z - A.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(p.x - A.x - k * dx, p.z - A.z - k * dz) - 0.45);
  }
  return best;
}

/**
 * Where they stand this launch (the drop-in moves from launch to launch): the
 * row of three, a metre apart, nearest its door that keeps clear of the
 * crowd's walking lines.
 */
export function visitSpots(): P[] {
  const f = VENUE_FRAME.dropIn;
  let best: P[] = [];
  let bestGap = -Infinity;
  for (let x = VISIT_ROOM.along[0]; x <= VISIT_ROOM.along[1]; x += 0.5) {
    for (let z = VISIT_ROOM.out[0]; z >= VISIT_ROOM.out[1]; z -= 0.4) {
      const row = [-1.1, 0, 1.1].map((dx) => toWorld(f, { x: x + dx, z }));
      // Clear of the walkers by VISIT_ROOM.clear, then as near the door as can be (not out in the road).
      const g = Math.min(...row.map(gap));
      const score = g >= VISIT_ROOM.clear ? -(Math.abs(z) + Math.abs(x) * 0.3) : g - 100;
      if (score > bestGap) { bestGap = score; best = row; }
    }
  }
  return best;
}

export function buildVisitors({ pool, board, random, scene }: PackDeps): Pack {
  const root = new Group();
  scene.add(root);
  const spots = visitSpots();
  const face = Math.PI + VENUE_ROT.dropIn;
  // Figures per group: a picket against holds placards, a vigil for holds candles; clergy are one each.
  type Crew = 'protest' | 'vigil' | VisitorKind;
  const groupOf = (kind: VisitorKind, stance: 'support' | 'oppose'): Crew => (kind === 'picket' ? (stance === 'oppose' ? 'protest' : 'vigil') : kind);
  const people: Record<Crew, Actor[]> = { protest: [], vigil: [], picket: [], priest: [], nun: [] };
  const make = (g: Crew, kind: VisitorKind, n: number) => {
    for (let i = 0; i < n; i++) {
      const at = spots[n > 1 ? i : 1];
      const a = pool.add({ style: kind === 'picket' ? 'older' : 'everyday', dress: VISIT_DRESS[kind] }, at.x, at.z);
      a.heading = face + (n > 1 ? (i - 1) * 0.25 : 0);
      if (g === 'vigil') a.glow = 'flame';
      // The sculpted figures carry no placard of their own: a board on a stick goes where they go.
      if (g === 'protest') a.attach = placard(root, [0xf2ede0, 0xe8d060, 0xf2ede0][i % 3]);
      people[g].push(a);
    }
  };
  make('protest', 'picket', spots.length);
  make('vigil', 'picket', spots.length);
  make('priest', 'priest', 1);
  make('nun', 'nun', 1);
  let sayIn = 6;

  return {
    setEnabled(on) {
      root.visible = on;
      if (!on) for (const list of Object.values(people)) for (const a of list) a.shown = 0;
    },
    update(dt, ctx) {
      const v = ctx.visit;
      const here = v ? groupOf(v.kind, v.stance) : null;
      for (const g of Object.keys(people) as Crew[]) for (const a of people[g]) {
        fade(a, g === here, dt, 0.5);
        // Against: talking at the queue. For: clergy hold out a cup or a blanket (a small warm light).
        if (g === here && (g === 'priest' || g === 'nun')) { a.pose = v!.stance === 'oppose' ? 'talk' : 'stand'; a.glow = v!.stance === 'support' ? 'flame' : 'none'; }
        else if (g === 'protest') a.pose = 'talk';
      }
      if (v && (sayIn -= dt) <= 0) {
        sayIn = 10 + random() * 12;
        const lines = VISIT_LINES[v.stance][v.kind];
        const group = people[here!];
        const who = group[Math.floor(random() * group.length)];
        if (who.shown > 0.8) board.say(who.x, who.z, lines[Math.floor(random() * lines.length)]);
      }
    },
  };
}
