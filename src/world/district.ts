import { Group, type Object3D } from 'three';
import { PALETTE } from '../config/palette';
import type { Random } from '../sim/random';
import { WindowBank } from './animated';
import { add, box, streetLight, tree } from './kit';
import { drainGrate, manhole } from './details';
import { lightPool, puddle } from './dressing';
import { groundLitter } from './grit';
import { BLOCKS, DISTRICT, HALF, MAIN_CROSSINGS, ROAD, STREETS, type Rect } from './layout';
import { glowMat, mat } from './materials';
import { mergeStatic } from './mergeStatic';

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
    // Centre line dashes, skipping junctions and crossings.
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

  // Kerbstones along every road edge, cut at junctions, a little uneven in
  // height; litter and leaves along every pavement.
  const kerbMat = mat(0x8a867c);
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
  for (let v = -40; v <= 40; v += 13) {
    if (Math.abs(v) >= HALF + 2) lamps.push([-8.2, v, 1, 0], [2.2, v, -1, 0]);
    lamps.push([21.8, v, 1, 0], [31.7, v, -1, 0]);
  }
  for (let v = -40; v <= 40; v += 14) {
    if (v > -10 && v < 4) continue;
    // Rotated a quarter turn, the arm's local +x points to world -z.
    lamps.push([v, -23.7, -1, Math.PI / 2], [v, 23.7, 1, Math.PI / 2]);
  }
  for (const [x, z, dir, rot] of lamps) {
    const lamp = streetLight(dir);
    lamp.group.remove(lamp.light);
    add(g, lamp.group, rot).position.set(x, 0.12, z);
    // The lamp head hangs 0.82 m along its arm; its pool of light lands below it.
    const hx = rot === 0 ? x + dir * 0.82 : x;
    const hz = rot === 0 ? z : z - dir * 0.82;
    lightPool(g, hx, hz, 6, 6);
  }

  // Puddles after rain, on roads and pavements alike.
  for (let i = 0; i < 46; i++) {
    const s = Object.values(STREETS)[i % 4];
    const strips = [s.road, ...s.pavements];
    const q = strips[Math.floor(random() * strips.length)];
    const x = q.x0 + 0.6 + random() * (q.x1 - q.x0 - 1.2);
    const z = q.z0 + 0.6 + random() * (q.z1 - q.z0 - 1.2);
    puddle(g, x, z, q === s.road ? 0.02 : 0.12, random);
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
  add(g, box(1200, 0.4, 1200, mat(PALETTE.soilDark), 0, -0.4, 0));
  add(g, box(1200, 0.02, 1200, mat(0x2a2724), 0, -0.02, 0));
  // Streets carry on into the outskirts as dark roads.
  add(g, box(ROAD.x1 - ROAD.x0, 0.02, 320, mat(0x2e2f31), (ROAD.x0 + ROAD.x1) / 2, -0.01, 0));
  for (const s of [STREETS.north, STREETS.south]) add(g, box(320, 0.02, s.road.z1 - s.road.z0, mat(0x2e2f31), 0, -0.01, (s.road.z0 + s.road.z1) / 2));
  add(g, box(STREETS.east.road.x1 - STREETS.east.road.x0, 0.02, 320, mat(0x2e2f31), (STREETS.east.road.x0 + STREETS.east.road.x1) / 2, -0.01, 0));

  const lit = Array.from({ length: 6 }, () => glowMat(0x1e1c1a, PALETTE.warmWindow, 0.6));
  const wall = [mat(0x3a3430), mat(0x433a33), mat(0x34312e)];
  const trim = mat(0x2a2623);
  const dark = mat(0x1c1e22);
  const skipRoad = (x: number, z: number, w: number, d: number) =>
    Object.values(STREETS).some((s) => {
      const q = s.road;
      return x + w / 2 > q.x0 - 2.5 && x - w / 2 < q.x1 + 2.5 && z + d / 2 > q.z0 - 2.5 && z - d / 2 < q.z1 + 2.5;
    });
  let k = 0;
  for (let gx = -78; gx <= 78; gx += 12) {
    for (let gz = -78; gz <= 78; gz += 12) {
      const ring = Math.max(Math.abs(gx), Math.abs(gz));
      if (ring <= DISTRICT + 2) continue;
      const w = 7 + random() * 4;
      const d = 7 + random() * 4;
      if (skipRoad(gx, gz, w, d)) continue;
      // In front of the district (+x/+z, towards the camera) stay low.
      const front = gx > DISTRICT || gz > DISTRICT;
      const h = front ? 1.5 + random() * 2 : 7 + random() * (ring > 60 ? 20 : 13);
      add(g, box(w, h, d, wall[k++ % wall.length], gx, 0, gz));
      add(g, box(w + 0.25, 0.3, d + 0.25, trim, gx, h, gz));
      if (front) continue;
      // Floors of windows on the faces the camera can see, a share of them lit.
      for (let y = 3.2; y < h - 0.8; y += 3) add(g, box(w + 0.1, 0.1, d + 0.1, trim, gx, y - 0.5, gz));
      for (let y = 1.4; y < h - 1.2; y += 3) {
        for (let a = -w / 2 + 1; a < w / 2 - 0.6; a += 1.6) {
          add(g, box(0.7, 1.0, 0.06, random() < 0.3 ? lit[k++ % lit.length] : dark, gx + a, y, gz + d / 2 + 0.03));
        }
        for (let a = -d / 2 + 1; a < d / 2 - 0.6; a += 1.6) {
          add(g, box(0.06, 1.0, 0.7, random() < 0.3 ? lit[k++ % lit.length] : dark, gx + w / 2 + 0.03, y, gz + a));
        }
      }
      if (random() < 0.5) add(g, box(1.6, 1.0, 1.6, trim, gx + (random() - 0.5) * (w - 2), h + 0.3, gz + (random() - 0.5) * (d - 2)));
    }
  }
  mergeStatic(g);
  return new WindowBank(lit, 0.7, 0.05, random);
}
