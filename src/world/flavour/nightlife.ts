import { Group, Mesh, SphereGeometry, type MeshLambertMaterial } from 'three';
import { NIGHTLIFE, VENUE_COLOURS, VENUE_NAMES, type VenueKind } from '../../config/flavour/nightlife';
import { nearestNode, routeTo } from '../../agents/nav';
import { range } from '../../sim/random';
import { allBuildings, frontFrame, lookClaimed } from '../cityBuildings';
import { add, box, cylinder, signBoard } from '../kit';
import { DISTRICT, ENTRY_NODES, NODES, PAVEMENT_TOP, STREETS, clearOfWalks, groundY, type P2, type Rect } from '../layout';
import { car } from '../vehicles';
import { clothMat, glowMat, mat } from '../materials';
import { mergeStatic } from '../mergeStatic';
import { fade, walkTo, type Actor } from './actors';
import type { Pack, PackDeps } from './index';

/**
 * The district's ordinary nightlife, in ground floors nothing else dresses:
 * pubs with drinkers round barrel tables out front and a smoker by the door,
 * swaying more as the night goes on; restaurants with an awning, string
 * lights, a patio heater and tables on the pavement where diners sit and a
 * waiter goes between the tables and the door, busiest from seven to ten; a
 * kebab shop open till five with a queue after midnight; and, from eleven,
 * people walking home the worse for wear, weaving, stopping, sitting on the
 * kerb a while; and a taxi rank on a parking kerb near the pubs, three cabs
 * nose to tail under their sign, the drivers chatting, a fare getting in now
 * and then after eleven. The furniture stands only where it leaves the walking lines
 * and everything solid clear. Built once and merged; its people come and go
 * with the hours.
 */

interface Frame { x: number; z: number; rot: number; width: number }
interface Seat { at: P2; face: number; a: Actor }
interface Venue { kind: VenueKind; f: Frame; door: P2; seats: Seat[]; tables: P2[]; standing: Seat[] }
interface Walker { a: Actor; route: P2[]; leg: number; speed: number; pause: number; sat: number; on: boolean }

/** A point `lx` along the front (to its right, seen from the street) and `lz` out from it, in the world. */
const at = (f: Frame, lx: number, lz: number): P2 => ({
  x: f.x + lx * Math.cos(f.rot) + lz * Math.sin(f.rot),
  z: f.z - lx * Math.sin(f.rot) + lz * Math.cos(f.rot),
});

const bulbGeo = new SphereGeometry(0.06, 5, 4);
const leafGeo = new SphereGeometry(0.22, 6, 4);

export function buildNightlife({ pool, board, random, scene }: PackDeps): Pack {
  const root = new Group();
  scene.add(root);
  // One warm glow per kind of venue (windows, lamps, candles, bulbs), dimmed when it shuts.
  const warm: Record<VenueKind, MeshLambertMaterial> = {
    pub: glowMat(0x4a3418, 0xffb060, 0.6),
    restaurant: glowMat(0x4a3418, 0xffd090, 0.6),
    kebab: glowMat(0x5a4a28, 0xfff0c0, 0.8),
  };

  // Where there is room in front of a shopfront: clear of the walking lines and of anything solid.
  // On the pavement too: no corner out on the road (a 0.3 m margin from the kerb).
  const fits = (f: Frame, lx: number, lz: number, w: number, d: number) => {
    const p = at(f, lx, lz);
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const c = at(f, lx + (cx * w) / 2, lz + (cz * (d + 0.6)) / 2);
      if (groundY(c.x, c.z) < PAVEMENT_TOP) return false;
    }
    return clearOfWalks(p.x, p.z, f.rot, w, d) && !pool.blocked(p.x, p.z, Math.max(w, d) / 2 + 0.05);
  };

  // Candidates: ordinary buildings in the district (their ground floor let to a venue) whose front the camera sees (south or east), nothing else's.
  const candidates = allBuildings()
    .filter((b) => !lookClaimed(b.id) && Math.max(Math.abs((b.x0 + b.x1) / 2), Math.abs((b.z0 + b.z1) / 2)) < DISTRICT - 6)
    .map((b) => frontFrame(b))
    .filter((f) => Math.sin(f.rot) > 0.5 || Math.cos(f.rot) > 0.5)
    .map((f) => ({ f, k: random() }))
    .sort((a, b) => a.k - b.k)
    .map((c) => c.f);

  const venues: Venue[] = [];
  const looks = { pub: 0, restaurant: 0, kebab: 0 };
  // The widest fronts go to the restaurants, then the kebab shop takes one, then the pubs.
  for (const kind of ['restaurant', 'kebab', 'pub'] as const) {
    let left = NIGHTLIFE.count[kind];
    for (const f of candidates) {
      if (!left) break;
      if (f.width < NIGHTLIFE.width[kind] || venues.some((v) => Math.hypot(v.f.x - f.x, v.f.z - f.z) < NIGHTLIFE.apart)) continue;
      const v = buildVenue(kind, f, looks[kind]++);
      if (!v) { looks[kind]--; continue; }
      venues.push(v);
      left--;
    }
  }
  mergeStatic(root);

  /** One venue's front and furniture; null when its pavement has no room for what it needs. */
  function buildVenue(kind: VenueKind, f: Frame, n: number): Venue | null {
    const W = f.width;
    const [bg, fg, awningColour] = VENUE_COLOURS[kind][n % VENUE_COLOURS[kind].length];
    const name = VENUE_NAMES[kind][n % VENUE_NAMES[kind].length];
    const doorX = W * 0.28;
    // Lay out what fits before building anything.
    const tables: P2[] = [];
    const barrels: P2[] = [];
    if (kind === 'restaurant') {
      for (const lz of [1.0, 2.15]) for (let lx = -W / 2 + 1.0; lx <= W / 2 - 1.0 && tables.length < 4; lx += 1.75) if (Math.abs(lx - doorX) > 0.7 && fits(f, lx, lz, 1.6, 0.9)) tables.push({ x: lx, z: lz });
      if (tables.length < 2) return null;
    } else if (kind === 'pub') {
      for (const lx of [-W * 0.3, -W * 0.05 - 0.4]) if (fits(f, lx, 0.8, 1.5, 1.2)) barrels.push({ x: lx, z: 0.8 });
      if (!barrels.length) return null;
    } else if (!fits(f, 0, 1.2, 2.2, 1.6)) return null;

    const g = add(root, new Group(), f.rot);
    g.position.set(f.x, 0.1, f.z);
    const glow = warm[kind];
    const dark = mat(0x1e1c1a);
    // The shopfront: lit windows in their frames, the door, the fascia with the name.
    {
      const ww = W * (kind === 'restaurant' ? 0.78 : 0.62);
      const wh = kind === 'kebab' ? 1.5 : 1.35;
      const wx = kind === 'kebab' ? -W * 0.12 : -W * 0.1;
      add(g, box(ww, wh, 0.04, glow, wx, 0.75, 0.05));
      const bar = mat(0x2a2622);
      const panes = Math.max(2, Math.round(ww / 0.9));
      for (let k = 0; k <= panes; k++) add(g, box(0.07, wh, 0.05, bar, wx - ww / 2 + (k * ww) / panes, 0.75, 0.08));
      add(g, box(ww, 0.07, 0.05, bar, wx, 0.75 + wh * 0.68, 0.08));
      add(g, box(ww + 0.12, 0.08, 0.16, mat(0x8a857a), wx, 0.68, 0.1));
    }
    add(g, box(1.0, 2.15, 0.06, dark, doorX, 0, 0.05));
    add(g, box(0.9, 0.12, 0.08, glow, doorX, 2.2, 0.07));
    const sign = signBoard(name, Math.min(W - 0.6, kind === 'kebab' ? 3.2 : 3.8), 0.55, fg, bg, kind === 'kebab' ? 1.0 : 0.6);
    add(g, sign.mesh).position.set(0, 2.95, 0.1);
    const seats: Seat[] = [];
    const standing: Seat[] = [];
    const door = at(f, doorX, 0.55);

    if (kind === 'pub') {
      // A lantern over the door, hanging baskets, a chalkboard, barrels to stand round with pints on them.
      add(g, box(0.06, 0.06, 0.4, dark, doorX, 2.55, 0.25));
      add(g, box(0.18, 0.26, 0.18, glow, doorX, 2.25, 0.42));
      for (const sx of [-W * 0.38, W * 0.05]) {
        add(g, cylinder(0.2, 0.18, mat(0x3a2a1a), 8, sx, 2.25, 0.3));
        for (let k = 0; k < 4; k++) add(g, new Mesh(leafGeo, mat(k % 2 ? 0x3a6a2a : 0xc83a5a))).position.set(sx + (k - 1.5) * 0.12, 2.4, 0.3 + (k % 2) * 0.1);
      }
      const board = add(g, box(0.55, 0.85, 0.05, mat(0x1a1a1a), -W / 2 + 0.5, 0, 0.6));
      board.rotation.x = -0.2;
      const wood = mat(0x6a4426);
      const hoop = mat(0x3a3a3a);
      for (const b of barrels) {
        add(g, cylinder(0.32, 0.95, wood, 10, b.x, 0, b.z));
        for (const y of [0.15, 0.78]) add(g, cylinder(0.335, 0.05, hoop, 10, b.x, y, b.z));
        add(g, cylinder(0.36, 0.04, mat(0x4a3018), 10, b.x, 0.95, b.z));
        // Pints, one half drunk, and an ashtray.
        for (const [dx, dz, full] of [[-0.12, 0.05, 1], [0.1, -0.08, 0.55]] as const) add(g, cylinder(0.04, 0.15 * full, mat(0xc8902a), 6, b.x + dx, 0.99, b.z + dz));
        add(g, cylinder(0.06, 0.02, mat(0x8a8a88), 6, b.x + 0.05, 0.99, b.z + 0.14));
        for (const side of [-1, 1]) standing.push({ at: at(f, b.x + side * 0.55, b.z + 0.05), face: f.rot + (side < 0 ? Math.PI / 2 : -Math.PI / 2), a: null as unknown as Actor });
      }
      // A smoker by the door, back to the wall, where there is room.
      if (fits(f, doorX - 0.8, 0.45, 0.5, 0.5)) standing.push({ at: at(f, doorX - 0.8, 0.45), face: f.rot, a: null as unknown as Actor });
    } else if (kind === 'restaurant') {
      const depth = Math.max(...tables.map((t) => t.z)) + 0.8;
      // The awning over the terrace, its valance and a row of bulbs along it.
      const awning = mat(awningColour);
      const a = add(g, box(W - 0.3, 0.05, depth, awning, 0, 2.55, depth / 2));
      a.rotation.x = 0.16;
      add(g, box(W - 0.3, 0.25, 0.04, awning, 0, 2.15 - depth * 0.16 + 0.12, depth));
      for (let k = 0; k < 9; k++) add(g, new Mesh(bulbGeo, glow)).position.set(-W / 2 + 0.3 + (k * (W - 0.6)) / 8, 2.18 - depth * 0.16, depth + 0.04);
      // Planters at the terrace's ends, a menu stand by the door.
      for (const sx of [-W / 2 + 0.25, W / 2 - 0.25]) {
        if (!fits(f, sx, depth / 2, 0.4, depth)) continue;
        add(g, box(0.35, 0.45, depth - 0.3, mat(0x5a4a3a), sx, 0, depth / 2));
        for (let k = 0; k < Math.floor(depth / 0.45); k++) add(g, new Mesh(leafGeo, mat(0x3a5a2a))).position.set(sx, 0.55, 0.35 + k * 0.45);
      }
      add(g, box(0.4, 1.1, 0.06, mat(0x1a1a1a), doorX + 0.75, 0, 0.35));
      // A patio heater where there is room.
      if (fits(f, W / 2 - 0.6, depth - 0.3, 0.6, 0.6)) {
        add(g, cylinder(0.05, 2.1, mat(0x8a8c8e), 6, W / 2 - 0.6, 0, depth - 0.3));
        add(g, cylinder(0.32, 0.12, mat(0x8a8c8e), 10, W / 2 - 0.6, 2.1, depth - 0.3));
        add(g, cylinder(0.12, 0.25, glowMat(0x6a2a10, 0xff6020, 0.9), 8, W / 2 - 0.6, 1.85, depth - 0.3));
      }
      const cloth = clothMat(n % 2 ? 0xe8e2d4 : 0xb03a32);
      const chair = mat(0x2a2a2c);
      for (const t of tables) {
        add(g, cylinder(0.05, 0.72, chair, 6, t.x, 0, t.z));
        add(g, cylinder(0.25, 0.03, chair, 8, t.x, 0, t.z));
        add(g, cylinder(0.4, 0.04, cloth, 12, t.x, 0.72, t.z));
        add(g, cylinder(0.03, 0.08, glow, 6, t.x, 0.76, t.z));
        add(g, cylinder(0.035, 0.28, mat(0x1e3a22), 6, t.x + 0.16, 0.76, t.z - 0.1));
        for (const side of [-1, 1]) {
          const cx = t.x + side * 0.58;
          add(g, box(0.4, 0.04, 0.4, chair, cx, 0.44, t.z));
          add(g, box(0.04, 0.45, 0.4, chair, cx + side * 0.2, 0.46, t.z));
          for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]] as const) add(g, box(0.03, 0.44, 0.03, chair, cx + lx, 0, t.z + lz));
          add(g, cylinder(0.035, 0.1, mat(0xd8d0b8), 6, t.x + side * 0.18, 0.76, t.z + 0.12));
          seats.push({ at: at(f, cx, t.z), face: f.rot + (side < 0 ? Math.PI / 2 : -Math.PI / 2), a: null as unknown as Actor });
        }
      }
    } else {
      // The kebab shop: a lit menu over the counter, the spit turning in the window, a bin and a stool.
      add(g, box(W * 0.5, 0.5, 0.04, glowMat(0x3a2a10, 0xffe0a0, 0.8), -W * 0.12, 2.1, 0.07));
      add(g, cylinder(0.16, 0.7, mat(0x8a4a22), 8, -W * 0.3, 0.95, -0.2));
      add(g, box(0.9, 0.08, 0.35, mat(0x8a8c8e), -W * 0.12, 1.05, 0.2));
      add(g, cylinder(0.25, 0.9, mat(0x3a3a3a), 8, -W / 2 + 0.4, 0, 0.45));
      // The queue along the front from the counter, each place on the pavement and clear (facing the counter).
      for (let k = 0; standing.length < NIGHTLIFE.queue && k < 8; k++) {
        const lx = -W * 0.12 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.7;
        if (fits(f, lx, 0.75, 0.5, 0.5)) standing.push({ at: at(f, lx, 0.75), face: f.rot + Math.PI + (lx > -W * 0.12 ? 0.5 : -0.5), a: null as unknown as Actor });
      }
    }
    // Their people, hidden until the venue's hours.
    for (const s of [...seats, ...standing]) {
      const style = kind === 'restaurant' ? (random() < 0.4 ? 'office' : random() < 0.5 ? 'older' : 'everyday') : random() < 0.3 ? 'student' : 'everyday';
      s.a = pool.add({ style }, s.at.x, s.at.z);
      s.a.heading = s.face;
      s.a.voice = kind === 'restaurant' ? 'diner' : kind === 'pub' ? 'pub' : 'kebab';
    }
    return { kind, f, door, seats, tables: tables.map((t) => at(f, t.x, t.z + 0.55)), standing };
  }

  // The waiters, one per restaurant, in white shirts and black aprons.
  const waiters = venues.filter((v) => v.kind === 'restaurant').map((v) => {
    const a = pool.add({ style: 'worker', dress: { top: 0xf2f0ea, bottom: 0x161618 } }, v.door.x, v.door.z);
    a.voice = 'waiter';
    return { v, a, to: v.door, stay: 0 };
  });

  // People walking home from the pubs, weaving.
  const pubs = venues.filter((v) => v.kind === 'pub');
  const walkers: Walker[] = Array.from({ length: pubs.length ? NIGHTLIFE.homeward.most : 0 }, () => {
    const a = pool.add({ style: random() < 0.3 ? 'student' : 'everyday' });
    a.voice = 'drunk';
    return { a, route: [], leg: 0, speed: 0.7, pause: 0, sat: 0, on: false };
  });
  // The taxi rank: three cabs nose to tail at the clear parking kerb (with the flow) nearest a pub or the kebab shop.
  const rank = buildRank();
  function buildRank(): { front: P2; drivers: Actor[]; fares: { a: Actor; on: boolean; to: P2 }[] } | null {
    const near = venues.filter((v) => v.kind !== 'restaurant');
    if (!near.length) return null;
    // The parking kerbs, as a line along each one-way street: where it runs, which way traffic flows.
    const kerbs: { along: 'x' | 'z'; at: number; flow: number; road: Rect }[] = [
      { along: 'x', at: STREETS.north.road.z1 - 1.0, flow: 1, road: STREETS.north.road },
      { along: 'x', at: STREETS.south.road.z1 - 1.0, flow: -1, road: STREETS.south.road },
      { along: 'z', at: STREETS.east.road.x1 - 1.0, flow: 1, road: STREETS.east.road },
    ];
    const others = Object.values(STREETS).map((s) => s.road as Rect);
    const LEN = 4.6;
    const blocks = allBuildings();
    let best: { k: (typeof kerbs)[number]; t: number; d: number } | null = null;
    for (const k of kerbs) {
      for (let t = -DISTRICT + 10; t < DISTRICT - 10; t += 2) {
        // Three lengths of clear kerb, off every other street's road (no cab in a junction) and every zebra's walking line.
        let ok = true;
        for (let i = -0.5; i <= 3.5 && ok; i += 0.5) {
          const u = t - k.flow * i * LEN * 0.9;
          const p = k.along === 'x' ? { x: u, z: k.at } : { x: k.at, z: u };
          if (pool.blocked(p.x, p.z, 1.1) || !clearOfWalks(p.x, p.z, k.along === 'x' ? Math.PI / 2 : 0, 1.9, 2.4) || others.some((r) => r !== k.road && p.x > r.x0 - 2 && p.x < r.x1 + 2 && p.z > r.z0 - 2 && p.z < r.z1 + 2)) ok = false;
        }
        if (!ok) continue;
        const p = k.along === 'x' ? { x: t, z: k.at } : { x: k.at, z: t };
        // Nearest a venue, and seen: the camera looks from the south-east, so a tall building just south or east hides the kerb.
        const hidden = blocks.some((b) => b.height > 7 && b.x1 > p.x - 3 && b.x0 < p.x + 9 && b.z1 > p.z - 3 && b.z0 < p.z + 9 && (b.x0 > p.x || b.z0 > p.z));
        const d = Math.min(...near.map((v) => Math.hypot(v.door.x - p.x, v.door.z - p.z))) + (hidden ? 60 : 0);
        if (d < 140 && (!best || d < best.d)) best = { k, t, d };
      }
    }
    if (!best) return null;
    const { k, t } = best;
    const rot = k.along === 'x' ? (k.flow > 0 ? Math.PI / 2 : -Math.PI / 2) : 0;
    const g = add(root, new Group());
    let front: P2 = { x: 0, z: 0 };
    for (let i = 0; i < 3; i++) {
      const u = t - k.flow * i * LEN;
      const p = k.along === 'x' ? { x: u, z: k.at } : { x: k.at, z: u };
      if (i === 0) front = p;
      const c = add(g, car(0, false, 'taxi'), rot);
      c.position.set(p.x, 0.02, p.z);
      pool.addSolid(p.x, p.z, rot, 1.9, 4.4);
    }
    // The rank's sign on the pavement by the front cab.
    const side = k.along === 'x' ? { x: 0, z: 1.6 } : { x: 1.6, z: 0 };
    const sp = { x: front.x + side.x, z: front.z + side.z };
    if (groundY(sp.x, sp.z) >= PAVEMENT_TOP && clearOfWalks(sp.x, sp.z, 0, 0.12, 0.12)) {
      const post = add(g, new Group());
      post.position.set(sp.x, PAVEMENT_TOP, sp.z);
      add(post, cylinder(0.035, 2.6, mat(0x8a8c8e), 6, 0, 0, 0));
      const sign = signBoard('TAXI', 0.9, 0.32, '#101010', '#f0c020', 0.7);
      add(post, sign.mesh, rot + Math.PI / 2).position.set(0, 2.45, 0);
    }
    mergeStatic(g);
    // Two drivers by the front cab, one smoking; fares who come and get in.
    const by = (dx: number, dz: number): P2 => ({ x: front.x + side.x * 0.6 + dx, z: front.z + side.z * 0.6 + dz });
    const drivers = [by(k.along === 'x' ? 0.6 : 0, k.along === 'z' ? 0.6 : 0), by(k.along === 'x' ? -0.5 : 0, k.along === 'z' ? -0.5 : 0)].map((p, i) => {
      const a = pool.add({ style: i ? 'older' : 'everyday', extra: 'jacket' }, p.x, p.z);
      a.heading = Math.atan2(front.x - p.x, front.z - p.z) + (i ? 2.4 : -2.4);
      a.voice = 'cabbie';
      a.smokes = i === 0;
      a.glow = i === 0 ? 'ember' : 'none';
      return a;
    });
    const fares = Array.from({ length: 2 }, () => ({ a: pool.add({ style: 'everyday' }), on: false, to: by(0, 0) }));
    return { front, drivers, fares };
  }
  let fareIn = 20;

  let nextWalker = 5;
  let sayIn = 3;
  let time = 0;
  const lit: Record<VenueKind, number> = { pub: -1, restaurant: -1, kebab: -1 };

  const openAt = (kind: VenueKind, clock: number) => clock >= NIGHTLIFE.hours[kind][0] && clock < NIGHTLIFE.hours[kind][1];
  const dining = (clock: number) => {
    const d = NIGHTLIFE.dining;
    if (clock <= d[0][0]) return d[0][1];
    for (let i = 1; i < d.length; i++) if (clock < d[i][0]) return d[i - 1][1] + ((d[i][1] - d[i - 1][1]) * (clock - d[i - 1][0])) / (d[i][0] - d[i - 1][0]);
    return d[d.length - 1][1];
  };

  return {
    setEnabled(on) {
      root.visible = on;
      if (!on) {
        for (const v of venues) for (const s of [...v.seats, ...v.standing]) s.a.shown = 0;
        for (const w of waiters) w.a.shown = 0;
        for (const w of walkers) { w.a.shown = 0; w.on = false; }
        if (rank) for (const x of [...rank.drivers, ...rank.fares.map((f) => f.a)]) x.shown = 0;
      }
    },
    update(dt, ctx) {
      time += dt;
      const clock = ctx.clock;
      for (const kind of ['pub', 'restaurant', 'kebab'] as const) {
        const level = openAt(kind, clock) ? 1 : 0.08;
        if (lit[kind] !== level) { warm[kind].emissiveIntensity = (kind === 'kebab' ? 0.8 : 0.6) * level; lit[kind] = level; }
      }
      const share = dining(clock);
      for (const v of venues) {
        const open = openAt(v.kind, clock);
        if (v.kind === 'restaurant') {
          // Tables fill from the door outwards; both seats at a table go together.
          const taken = Math.round(share * v.tables.length);
          v.seats.forEach((s, i) => {
            fade(s.a, open && Math.floor(i / 2) < taken, dt, 0.4);
            s.a.pose = 'sit';
            s.a.heading = s.face;
          });
        } else if (v.kind === 'pub') {
          v.standing.forEach((s, i) => {
            const there = open && i < NIGHTLIFE.drinkers && (clock < 1500 || i % 2 === 0);
            fade(s.a, there, dt, 0.4);
            s.a.pose = i % 3 === 1 ? 'stand' : 'talk';
            s.a.heading = s.face + Math.sin(time * 0.3 + i) * 0.2;
            // Later in the night some sway; the one by the door smokes.
            s.a.body = clock > NIGHTLIFE.tipsyFrom && i % 2 === 0 ? 'drunk' : 'normal';
            const smoker = i === v.standing.length - 1;
            s.a.smokes = smoker;
            s.a.glow = smoker ? 'ember' : 'none';
          });
        } else {
          // The kebab queue: after midnight, mostly.
          const want = !open ? 0 : clock > 1440 ? NIGHTLIFE.queue : 1;
          v.standing.forEach((s, i) => {
            fade(s.a, i < want, dt, 0.4);
            s.a.pose = 'stand';
            s.a.body = clock > 1450 && i % 2 ? 'drunk' : 'normal';
            s.a.heading = s.face;
          });
        }
      }
      // Waiters: to a taken table, a moment there, back to the door.
      for (const w of waiters) {
        const open = openAt('restaurant', clock) && share > 0.05;
        fade(w.a, open, dt, 0.5);
        if (!open) continue;
        if (w.stay > 0) { w.stay -= dt; w.a.pose = 'stand'; continue; }
        if (walkTo(w.a, w.to.x, w.to.z, NIGHTLIFE.waiter.pace, dt)) {
          w.stay = range(random, NIGHTLIFE.waiter.stay);
          const taken = w.v.tables.filter((_, i) => i < Math.round(share * w.v.tables.length));
          w.to = w.to === w.v.door && taken.length ? taken[Math.floor(random() * taken.length)] : w.v.door;
        }
      }
      // Homeward: from a pub's door to the district's edge, weaving, now and then stopping or sitting on the kerb.
      const [from, until] = NIGHTLIFE.homeward.hours;
      if (pubs.length && clock >= from && clock < until && (nextWalker -= dt) <= 0) {
        nextWalker = range(random, NIGHTLIFE.homeward.every);
        const w = walkers.find((x) => !x.on && x.a.shown <= 0.01);
        if (w) {
          const pub = pubs[Math.floor(random() * pubs.length)];
          const end = NODES[ENTRY_NODES[Math.floor(random() * ENTRY_NODES.length)]];
          const off = { x: (random() - 0.5) * 0.6, z: (random() - 0.5) * 0.6 };
          Object.assign(w, { on: true, route: [pub.door, ...routeTo(pub.door, nearestNode(end), off)], leg: 1, speed: range(random, NIGHTLIFE.homeward.pace), pause: 0, sat: 0 });
          w.a.x = pub.door.x;
          w.a.z = pub.door.z;
          w.a.body = 'drunk';
        }
      }
      for (const w of walkers) {
        if (!w.on) { fade(w.a, false, dt); continue; }
        const done = w.leg >= w.route.length;
        fade(w.a, !done, dt, 0.6);
        if (done) { if (w.a.shown <= 0.01) w.on = false; continue; }
        if (w.sat > 0) { w.sat -= dt; w.a.pose = 'sit'; continue; }
        if (w.pause > 0) { w.pause -= dt; w.a.pose = 'stand'; continue; }
        const p = w.route[w.leg];
        if (walkTo(w.a, p.x, p.z, w.speed, dt)) w.leg++;
        // A weave across the walk, and the odd stop to get their bearings or a sit on the kerb.
        const sway = Math.sin(time * 1.7 + w.speed * 9) * 0.35 * dt;
        w.a.x += Math.cos(w.a.heading) * sway;
        w.a.z -= Math.sin(w.a.heading) * sway;
        if (random() < dt * 0.04) w.pause = 1.5 + random() * 2.5;
        else if (random() < dt * 0.01) w.sat = 6 + random() * 8;
      }
      // The rank: drivers out from the evening till four; after eleven a fare walks up now and then and gets in.
      if (rank) {
        const open = clock >= 1080 && clock < 1680;
        for (const d of rank.drivers) { fade(d, open, dt, 0.5); d.pose = 'talk'; }
        if (open && clock > 1380 && (fareIn -= dt) <= 0) {
          fareIn = 25 + random() * 40;
          const f = rank.fares.find((x) => !x.on && x.a.shown <= 0.01);
          const from = pubs.length ? pubs[Math.floor(random() * pubs.length)].door : null;
          if (f && from && Math.hypot(from.x - rank.front.x, from.z - rank.front.z) < 80) {
            Object.assign(f, { on: true });
            f.a.x = from.x;
            f.a.z = from.z;
            f.a.body = random() < 0.6 ? 'drunk' : 'normal';
          }
        }
        for (const f of rank.fares) {
          if (!f.on) { fade(f.a, false, dt); continue; }
          // Straight over to the cab; in at the door (fading out).
          const there = walkTo(f.a, f.to.x, f.to.z, 0.9, dt);
          fade(f.a, !there, dt, there ? 1.5 : 0.8);
          if (there && f.a.shown <= 0.01) f.on = false;
        }
      }
      // Something said now and then, by someone in view.
      if ((sayIn -= dt) <= 0) {
        sayIn = 4 + random() * 5;
        const all = [...venues.flatMap((v) => [...v.seats, ...v.standing].map((s) => s.a)), ...waiters.map((w) => w.a), ...walkers.map((w) => w.a), ...(rank?.drivers ?? [])];
        const near = all.filter((a) => a.detailed && a.shown > 0.9);
        const a = near[Math.floor(random() * near.length)];
        if (a?.voice) board.speak(a.x, a.z, a.voice);
      }
    },
  };
}
