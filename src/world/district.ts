import { Group, type Object3D } from 'three';
import { PALETTE } from '../config/palette';
import type { Random } from '../sim/random';
import { WindowBank } from './animated';
import { add, box, streetLight, tree } from './kit';
import { drainGrate, manhole } from './details';
import { lightPool } from './dressing';
import { addPuddle, nearestLamp, type LampHead } from './puddles';
import { QUALITY } from '../render/quality';
import { groundLitter } from './grit';
import { BLOCKS, DISTRICT, HALF, INNER, MAIN_CROSSINGS, ROAD, STREETS, type Rect } from './layout';
import { glowMat, mat } from './materials';
import { mergeStatic } from './mergeStatic';
import { RIVER_X } from './bridges';

/**
 * District ground: the street network around the original centre block, the
 * ground of the eight new blocks, and the dark outskirts that let the city
 * carry on past the district edge instead of ending at a cut base.
 */

/** Splits a strip running along `along` around the spans other roads cross it. */
function cutStrip(strip: Rect, along: 'x' | 'z', holes: Rect[]): Rect[] {
  const spans = holes
    .map((h) => (along === 'z' ? [h.z0, h.z1] : [h.x0, h.x1]))
    .sort((a, b) => a[0] - b[0]);
  const out: Rect[] = [];
  let start = along === 'z' ? strip.z0 : strip.x0;
  const end = along === 'z' ? strip.z1 : strip.x1;
  for (const [h0, h1] of spans) {
    if (h1 <= start || h0 >= end) continue;
    if (h0 > start) out.push(along === 'z' ? { ...strip, z0: start, z1: h0 } : { ...strip, x0: start, x1: h0 });
    start = Math.max(start, h1);
  }
  if (start < end) out.push(along === 'z' ? { ...strip, z0: start, z1: end } : { ...strip, x0: start, x1: end });
  return out;
}

const rectBox = (q: Rect, h: number, color: number, y = 0) =>
  box(q.x1 - q.x0, h, q.z1 - q.z0, mat(color), (q.x0 + q.x1) / 2, y, (q.z0 + q.z1) / 2);

/** Zebra stripes across a road: `across` is the axis people walk along. */
function zebra(g: Group, across: 'x' | 'z', from: number, to: number, at: number, width = 2): void {
  const line = mat(PALETTE.asphaltLine);
  for (let v = from + 0.45; v < to - 0.2; v += 0.85) {
    if (across === 'x') add(g, box(0.45, 0.008, width, line, v, 0.02, at));
    else add(g, box(width, 0.008, 0.45, line, at, 0.02, v));
  }
}

/** The ring road's bike lane, metres wide: the gap between the cars parked at its two kerbs. */
export const BIKE_LANE = 1.2;

/** A bicycle painted on the lane, along local z: two wheels (rings) and a frame. */
function bikeGlyph(g: Group, paint: ReturnType<typeof mat>, x: number, z: number, rot: number): void {
  const b = add(g, new Group());
  b.position.set(x, 0.024, z);
  b.rotation.y = rot;
  for (const wz of [-0.28, 0.28]) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      add(b, box(0.05, 0.01, 0.1, paint, Math.cos(a) * 0.15, 0, wz + Math.sin(a) * 0.15)).rotation.y = -a;
    }
  }
  add(b, box(0.05, 0.01, 0.5, paint, 0, 0, 0));
  add(b, box(0.22, 0.01, 0.05, paint, 0, 0, 0.3));
}

export function buildStreets(scene: Object3D, random: Random): void {
  const g = add(scene, new Group());
  const roads = Object.values(STREETS).map((s) => s.road);
  for (const [name, s] of Object.entries(STREETS)) {
    // Roads overlap at junctions; that is fine, they share one height.
    add(g, rectBox(s.road, 0.02, PALETTE.asphalt));
    const crossing = roads.filter((q) => q !== s.road);
    for (const pave of s.pavements) {
      for (const [i, part] of cutStrip(pave, s.along, crossing).entries()) {
        // The main street's centre-block pavements keep their slab rows (built by the scene).
        if (name === 'main' && part.z0 < HALF && part.z1 > -HALF && part.z0 >= -HALF - 0.01 && part.z1 <= HALF + 0.01) continue;
        add(g, rectBox(part, 0.12, i % 2 ? PALETTE.pavement : PALETTE.pavementAlt));
      }
    }
    // Centre line dashes, skipping junctions and crossings. The ring road has a bike lane down its middle instead.
    if (name.startsWith('ring')) continue;
    const line = mat(PALETTE.asphaltLine);
    const mid = s.along === 'z' ? (s.road.x0 + s.road.x1) / 2 + (name === 'main' ? 0.25 : 0) : (s.road.z0 + s.road.z1) / 2;
    const [a0, a1] = s.along === 'z' ? [s.road.z0, s.road.z1] : [s.road.x0, s.road.x1];
    for (let v = a0 + 0.5; v < a1; v += 2.2) {
      const blocked = crossing.some((q) => (s.along === 'z' ? v > q.z0 - 1.5 && v < q.z1 + 1.5 : v > q.x0 - 1.5 && v < q.x1 + 1.5));
      const onZebra = name === 'main' && MAIN_CROSSINGS.some((c) => v > c.z0 - 1.2 && v < c.z1 + 0.6);
      if (blocked || onZebra) continue;
      if (s.along === 'z') add(g, box(0.1, 0.006, 1.1, line, mid, 0.02, v));
      else add(g, box(1.1, 0.006, 0.1, line, v, 0.02, mid));
    }
  }

  // Lanes: a solid line between the parked cars and the moving lane, on every
  // street with a parking lane (the cross streets and the east street park at
  // their far kerb, the main street in its own lane).
  // Only roads running the other way cross a line (cutStrip spans every hole along the strip).
  const crossers = (along: 'x' | 'z') => Object.values(STREETS).filter((o) => o.along !== along).map((o) => o.road);
  const laneLine = (q: Rect, along: 'x' | 'z') => {
    for (const part of cutStrip(q, along, crossers(along))) add(g, rectBox(part, 0.01, PALETTE.asphaltLine, 0.021));
  };
  for (const s of [STREETS.north, STREETS.south]) laneLine({ x0: s.road.x0, x1: s.road.x1, z0: s.road.z1 - 2.15, z1: s.road.z1 - 2.07 }, 'x');
  laneLine({ x0: STREETS.east.road.x1 - 2.15, x1: STREETS.east.road.x1 - 2.07, z0: STREETS.east.road.z0, z1: STREETS.east.road.z1 }, 'z');
  laneLine({ x0: ROAD.parkX - 1.15, x1: ROAD.parkX - 1.07, z0: STREETS.main.road.z0, z1: STREETS.main.road.z1 }, 'z');

  // Cycling: the ring road carries no through-traffic, so its middle, between
  // the cars parked at both kerbs, is a two-way bike lane: red surface, dashed
  // white edges, a bicycle painted on it every so often (the flavour packs'
  // cyclists ride it).
  const white = mat(0xe8e4da);
  for (const s of [STREETS.ringNorth, STREETS.ringSouth, STREETS.ringWest, STREETS.ringEast]) {
    const holes = crossers(s.along);
    const mid = s.along === 'z' ? (s.road.x0 + s.road.x1) / 2 : (s.road.z0 + s.road.z1) / 2;
    const half = BIKE_LANE / 2;
    const lane: Rect = s.along === 'z' ? { x0: mid - half, x1: mid + half, z0: s.road.z0, z1: s.road.z1 } : { x0: s.road.x0, x1: s.road.x1, z0: mid - half, z1: mid + half };
    for (const part of cutStrip(lane, s.along, holes)) {
      add(g, rectBox(part, 0.01, PALETTE.bikeLane, 0.02));
      const [a0, a1] = s.along === 'z' ? [part.z0, part.z1] : [part.x0, part.x1];
      for (let v = a0 + 0.4; v < a1 - 0.8; v += 1.6) {
        for (const side of [-half, half]) {
          if (s.along === 'z') add(g, box(0.06, 0.01, 0.8, white, mid + side, 0.023, v + 0.4));
          else add(g, box(0.8, 0.01, 0.06, white, v + 0.4, 0.023, mid + side));
        }
      }
      for (let v = a0 + 6; v < a1 - 3; v += 18) bikeGlyph(g, white, s.along === 'z' ? mid : v, s.along === 'z' ? v : mid, s.along === 'z' ? 0 : Math.PI / 2);
    }
  }

  // Kerbstones along every road edge, cut at junctions, a little uneven in
  // height, pale enough to read against the road and the paving; litter and
  // leaves along every pavement.
  const kerbMat = mat(0xb2ada2);
  for (const [name, s] of Object.entries(STREETS)) {
    const crossing = roads.filter((q) => q !== s.road);
    for (const pave of s.pavements) {
      for (const part of cutStrip(pave, s.along, crossing)) {
        const centre = name === 'main' && part.z0 >= -HALF - 0.01 && part.z1 <= HALF + 0.01;
        if (s.along === 'z') {
          const x = pave.x1 <= s.road.x0 + 0.01 ? pave.x1 - 0.1 : pave.x0 + 0.1;
          for (let z = part.z0; z < part.z1 - 0.1; z += 1.0) add(g, box(0.18, 0.15 + random() * 0.02, Math.min(0.98, part.z1 - z), kerbMat, x, 0, z + 0.49));
        } else {
          const z = pave.z1 <= s.road.z0 + 0.01 ? pave.z1 - 0.1 : pave.z0 + 0.1;
          for (let x = part.x0; x < part.x1 - 0.1; x += 1.0) add(g, box(Math.min(0.98, part.x1 - x), 0.15 + random() * 0.02, 0.18, kerbMat, x + 0.49, 0, z));
        }
        if (!centre) groundLitter(g, part.x0 + 0.3, part.x1 - 0.3, part.z0 + 0.3, part.z1 - 0.3, 0.12, Math.round(((part.x1 - part.x0) * (part.z1 - part.z0)) / 9), random);
      }
    }
  }

  // Zebras: across the main street at the junctions, and across each cross
  // street where the main and east street pavements meet it.
  for (const c of MAIN_CROSSINGS.slice(1)) zebra(g, 'x', ROAD.x0, ROAD.x1, (c.z0 + c.z1) / 2);
  for (const s of [STREETS.north, STREETS.south]) {
    for (const x of [-7.25, 1.75, 22.75]) zebra(g, 'z', s.road.z0, s.road.z1, x);
  }
  // And across the ring road wherever a street's pavement meets it.
  for (const s of [STREETS.ringNorth, STREETS.ringSouth]) {
    for (const x of [-7.25, 1.75, 22.75, 30.75]) zebra(g, 'z', s.road.z0, s.road.z1, x);
  }
  for (const s of [STREETS.ringWest, STREETS.ringEast]) {
    for (const z of [-22.75, -15.75, 15.75, 22.75]) zebra(g, 'x', s.road.x0, s.road.x1, z);
  }

  // Road furniture along the new streets.
  for (let i = 0; i < 14; i++) {
    const s = [STREETS.north, STREETS.south, STREETS.east][i % 3];
    const t = random();
    const x = s.along === 'z' ? s.road.x0 + 0.3 : -DISTRICT + 4 + t * (DISTRICT * 2 - 8);
    const z = s.along === 'z' ? -DISTRICT + 4 + t * (DISTRICT * 2 - 8) : s.road.z0 + 0.3;
    add(g, drainGrate(), s.along === 'z' ? Math.PI / 2 : 0).position.set(x, 0.02, z);
    if (i % 3 === 0) add(g, manhole()).position.set(x + (s.along === 'z' ? 2.2 : 0), 0.02, z + (s.along === 'z' ? 0 : 2.2));
  }

  // Street lights along the new pavements. Lamps glow but carry no light
  // source of their own: every extra light would cost every pixel of the scene.
  // [x, z, arm direction, rotation]: arms reach over the road.
  const lamps: [number, number, number, number][] = [];
  // Out through the outer ring too, never standing on the ring road.
  const offRing = (v: number) => Math.abs(v) < INNER - 1 || Math.abs(v) > INNER + 11;
  for (let v = -(DISTRICT - 5); v <= DISTRICT - 5; v += 13) {
    if (!offRing(v)) continue;
    if (Math.abs(v) >= HALF + 2) lamps.push([-8.2, v, 1, 0], [2.2, v, -1, 0]);
    lamps.push([21.8, v, 1, 0], [31.7, v, -1, 0]);
  }
  for (let v = -(DISTRICT - 5); v <= DISTRICT - 5; v += 14) {
    if ((v > -10 && v < 4) || !offRing(v)) continue;
    // Rotated a quarter turn, the arm's local +x points to world -z.
    lamps.push([v, -23.7, -1, Math.PI / 2], [v, 23.7, 1, Math.PI / 2]);
  }
  // The ring road, lit from its outer pavement; clear of the streets that cross it.
  const ringLamp = INNER + 9.7;
  const clear = (v: number) => Object.values(STREETS).every((q) => q.along === 'z' ? v < q.road.x0 - 2.5 || v > q.road.x1 + 2.5 : v < q.road.z0 - 2.5 || v > q.road.z1 + 2.5);
  for (let v = -(INNER + 5); v <= INNER + 5; v += 14) {
    if (clear(v)) lamps.push([v, -ringLamp, -1, Math.PI / 2], [v, ringLamp, 1, Math.PI / 2]);
    if (clear(v)) lamps.push([-ringLamp, v, 1, 0], [ringLamp, v, -1, 0]);
  }
  const heads: LampHead[] = [];
  for (const [x, z, dir, rot] of lamps) {
    const lamp = streetLight(dir);
    lamp.group.remove(lamp.light);
    add(g, lamp.group, rot).position.set(x, 0.12, z);
    // The lamp head hangs 0.82 m along its arm; its pool of light lands below it.
    const hx = rot === 0 ? x + dir * 0.82 : x;
    const hz = rot === 0 ? z : z - dir * 0.82;
    lightPool(g, hx, hz, 10, 10);
    // The bulb hangs 4.07 m above the lamp's base.
    heads.push({ x: hx, y: 0.12 + 4.07, z: hz });
  }

  // Puddles after rain, on roads and pavements alike; each mirrors its nearest lamp.
  const strips = Object.values(STREETS).flatMap((s) => [{ q: s.road, y: 0.02 }, ...s.pavements.map((q) => ({ q, y: 0.12 }))]);
  const stripAt = (x: number, z: number) => strips.find(({ q }) => x > q.x0 + 0.5 && x < q.x1 - 0.5 && z > q.z0 + 0.5 && z < q.z1 - 0.5);
  // Every other lamp gets a puddle where its image lands in the default view (camera to +x +z, 35 degrees up).
  const toViewer = 1 / Math.tan(Math.atan(1 / Math.SQRT2)) / Math.SQRT2;
  heads.forEach((l, i) => {
    if (i % 2) return;
    const x = l.x + (l.y - 0.1) * toViewer + (random() - 0.5) * 0.6;
    const z = l.z + (l.y - 0.1) * toViewer + (random() - 0.5) * 0.6;
    const at = stripAt(x, z);
    if (at) addPuddle(g, x, z, at.y, random, l);
  });
  for (let i = 0; i < (QUALITY.low ? 20 : 40); i++) {
    const s = Object.values(STREETS)[i % 4];
    const parts = [s.road, ...s.pavements];
    const q = parts[Math.floor(random() * parts.length)];
    const x = q.x0 + 0.6 + random() * (q.x1 - q.x0 - 1.2);
    const z = q.z0 + 0.6 + random() * (q.z1 - q.z0 - 1.2);
    addPuddle(g, x, z, q === s.road ? 0.02 : 0.12, random, nearestLamp(heads, x, z));
  }
  mergeStatic(g);
}

/** Ground slabs for the eight new blocks; the centre block keeps its own ground. */
export function buildBlockGround(scene: Object3D, random: Random): void {
  const g = add(scene, new Group());
  for (const [name, q] of Object.entries(BLOCKS)) {
    add(g, rectBox(q, 0.12, PALETTE.pavementAlt));
    groundLitter(g, q.x0 + 0.5, q.x1 - 0.5, q.z0 + 0.5, q.z1 - 0.5, 0.12, Math.round(((q.x1 - q.x0) * (q.z1 - q.z0)) / 14), random);
    // A planted strip along each block edge breaks up the paving.
    if (name === 'cm') {
      add(g, rectBox({ x0: q.x0, x1: q.x1, z0: -2.5, z1: 15 }, 0.13, PALETTE.grass));
      for (let i = 0; i < 4; i++) add(g, tree((i % 3) as 0 | 1 | 2, 0.9 + random() * 0.2)).position.set(17 + random() * 3, 0.13, 1 + i * 3.4);
      add(g, box(q.x1 - q.x0, 0.125, 1.6, mat(PALETTE.gravel), (q.x0 + q.x1) / 2, 0, -4));
      add(g, box(1.4, 0.125, 6.6, mat(PALETTE.gravel), 18.7, 0, 9.2));
      add(g, box(q.x1 - q.x0, 0.125, 1.4, mat(PALETTE.gravel), (q.x0 + q.x1) / 2, 0, 9.2));
    }
  }
  mergeStatic(g);
}

/**
 * The city past the district edge: a dark ground plane and a ring of
 * silhouette blocks with a few lit windows. Masses behind the district (from
 * the camera's view) stand tall to make a skyline; those in front stay low so
 * they never hide the district.
 */
export function buildOutskirts(scene: Object3D, random: Random): WindowBank {
  const g = add(scene, new Group());
  // Ground layers sit at least a centimetre apart, never level with each other,
  // so the depth test cannot flicker between them as the camera moves:
  // base -0.10; the city beyond -0.08 to -0.035 (see cityBeyond.ts); outskirts
  // roads -0.005; the district from 0.01 up.
  // City surface, not open ground: what shows between blocks reads as streets and yards.
  add(g, box(1200, 0.4, 1200, mat(0x5c5a55), 0, -0.5, 0));
  // Streets carry on into the outskirts as dark roads, out past the widest view (traffic runs to 340 m).
  const OUT = 345;
  add(g, box(ROAD.x1 - ROAD.x0, 0.02, 2 * OUT, mat(0x2e2f31), (ROAD.x0 + ROAD.x1) / 2, -0.025, 0));
  // The cross streets stop at the river's banks: the arched bridges carry them over (world/bridges.ts, cityBeyond.ts).
  const offRiver = (a: number, b: number) => [[a, RIVER_X.x0 - 0.5], [RIVER_X.x1 + 0.5, b]].map(([lo, hi]) => [Math.max(lo, a), Math.min(hi, b)]).filter(([lo, hi]) => hi > lo);
  for (const s of [STREETS.north, STREETS.south]) {
    for (const [x0, x1] of offRiver(-OUT, OUT)) add(g, box(x1 - x0, 0.02, s.road.z1 - s.road.z0, mat(0x2e2f31), (x0 + x1) / 2, -0.025, (s.road.z0 + s.road.z1) / 2));
  }
  add(g, box(STREETS.east.road.x1 - STREETS.east.road.x0, 0.02, 2 * OUT, mat(0x2e2f31), (STREETS.east.road.x0 + STREETS.east.road.x1) / 2, -0.025, 0));
  // Out of the district the roads keep their pavements (a kerb above the road)
  // and dashed centre lines, so they read as streets, not empty bands.
  const pave = mat(PALETTE.pavement);
  const line = mat(0xd8d0b8);
  const outside = (a: number, b: number) => [[-OUT, -DISTRICT - 2], [DISTRICT + 2, OUT]].map(([lo, hi]) => [Math.max(lo, a), Math.min(hi, b)]).filter(([lo, hi]) => hi > lo);
  for (const r of [ROAD, STREETS.east.road]) {
    const x0 = r.x0;
    const x1 = r.x1;
    for (const [z0, z1] of outside(-OUT, OUT)) {
      add(g, box(2.5, 0.16, z1 - z0, pave, x0 - 1.25, -0.1, (z0 + z1) / 2));
      add(g, box(2.5, 0.16, z1 - z0, pave, x1 + 1.25, -0.1, (z0 + z1) / 2));
      for (let z = z0 + 2; z < z1 - 2; z += 6) add(g, box(0.14, 0.004, 2.6, line, (x0 + x1) / 2, -0.007, z));
    }
  }
  for (const r of [STREETS.north.road, STREETS.south.road]) {
    for (const [x0, x1] of outside(-OUT, OUT).flatMap(([a, b]) => offRiver(a, b))) {
      add(g, box(x1 - x0, 0.16, 2.5, pave, (x0 + x1) / 2, -0.1, r.z0 - 1.25));
      add(g, box(x1 - x0, 0.16, 2.5, pave, (x0 + x1) / 2, -0.1, r.z1 + 1.25));
      for (let x = x0 + 2; x < x1 - 2; x += 6) add(g, box(2.6, 0.004, 0.14, line, x, -0.007, (r.z0 + r.z1) / 2));
    }
  }

  // The city beyond (river, park, towers, old town) is built in cityBeyond.ts.
  const lit = Array.from({ length: 1 }, () => glowMat(0x1e1c1a, PALETTE.warmWindow, 0.6));
  mergeStatic(g);
  return new WindowBank(lit, 0.7, 0.05, random);
}
