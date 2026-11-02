import { Group, type Object3D } from 'three';
import type { Random } from '../sim/random';
import { add, box, cylinder } from './kit';
import { mat } from './materials';

/**
 * What people put on their roofs, built with the building (world/infill.ts)
 * in its own frame, the front facing +z, and merged with it: on a flat roof
 * one of a terrace with a parasol and lights, a washing line, a pigeon loft,
 * a small pool, or a tall radio mast; on a pitched roof chimney pots, a TV
 * aerial on the ridge and pigeons along it; dishes and aerials on mansards.
 * ILLUSTRATIVE shares; static, so it costs nothing per frame.
 */
export type RoofFeature = 'terrace' | 'laundry' | 'loft' | 'pool' | 'mast' | null;

/** Picks a flat roof's feature, or none (the usual tanks, ducts and vents). */
export function pickFeature(random: Random, w: number, d: number, h: number): RoofFeature {
  const r = random();
  // About a quarter of flat roofs: the rest keep their tanks, ducts, vents and chairs (grit.ts roofClutter).
  if (w >= 6.5 && d >= 6 && r < 0.04) return 'pool';
  if (r < 0.12) return 'terrace';
  if (r < 0.19) return 'laundry';
  if (r < 0.23) return 'loft';
  if (h > 9 && r < 0.27) return 'mast';
  return null;
}

const WOOD = 0x7a5a3a;
/**
 * Bulbs, pool water and the mast's light are plain bright colours, not glowing
 * materials: a glow is a draw of its own in every merged block of the city,
 * while plain colours merge into the block's one mesh for free.
 */
const BRIGHT = { bulb: 0xffe6a8, pool: 0x3aaed8, mast: 0xff3a2a };
const PARASOL = [0xc8382a, 0x2a6a8a, 0xe0b040, 0x3a7a4a];
const CLOTHES = [0xe8e2d6, 0x3a5a9a, 0xc84a3a, 0xe0c040, 0x4a8a5a, 0xd88aa8, 0x2a2a2e];

/** A pigeon sitting, its back to +z: grey body, a darker head. */
function pigeon(g: Object3D, x: number, y: number, z: number, turn: number): void {
  const p = add(g, new Group());
  p.position.set(x, y, z);
  p.rotation.y = turn;
  add(p, box(0.14, 0.12, 0.24, mat(0x7a7c84), 0, 0, 0));
  add(p, box(0.09, 0.09, 0.09, mat(0x5a5e6a), 0, 0.1, 0.11));
  add(p, box(0.04, 0.03, 0.05, mat(0xc89a4a), 0, 0.1, 0.17));
}

/** A flat roof's feature, on the roof surface `y`, inside the parapet (`w` by `d`, centred on cx, cz). */
export function flatRoofFeature(g: Object3D, f: Exclude<RoofFeature, null>, cx: number, cz: number, w: number, d: number, y: number, random: Random): void {
  const r = add(g, new Group());
  r.position.set(cx, y, cz);
  if (f === 'terrace') {
    // Decking over half the roof, a parasol over a table and chairs, potted plants and a string of bulbs.
    add(r, box(w * 0.6, 0.06, d * 0.6, mat(WOOD), w * 0.12, 0, 0));
    for (let i = 0; i < 6; i++) add(r, box(w * 0.6, 0.065, 0.03, mat(0x5a4028), w * 0.12, 0, -d * 0.3 + (i + 0.5) * (d * 0.6) / 6));
    const px = w * 0.15;
    add(r, cylinder(0.03, 2.1, mat(0x3a3a3a), 6, px, 0, 0));
    add(r, cylinder(1.2, 0.12, mat(PARASOL[Math.floor(random() * PARASOL.length)]), 8, px, 2.0, 0));
    add(r, cylinder(0.45, 0.05, mat(0xd8d2c4), 10, px, 0.72, 0));
    add(r, cylinder(0.05, 0.72, mat(0x3a3a3a), 6, px, 0, 0));
    for (const a of [0, 2.1, 4.2]) {
      const x = px + Math.cos(a) * 0.8, z = Math.sin(a) * 0.8;
      add(r, box(0.42, 0.06, 0.42, mat(0xe8e2d6), x, 0.42, z));
      add(r, box(0.42, 0.42, 0.05, mat(0xe8e2d6), x - Math.cos(a) * 0.2, 0.42, z - Math.sin(a) * 0.2)).rotation.y = -a + Math.PI / 2;
    }
    for (const [x, z] of [[-w * 0.15, -d * 0.25], [-w * 0.15, d * 0.25], [w * 0.4, d * 0.27]]) {
      add(r, cylinder(0.22, 0.4, mat(0x9a5a3a), 8, x, 0, z));
      add(r, cylinder(0.32, 0.5, mat(0x3a6a32), 7, x, 0.4, z));
    }
    // String lights along the parapet on the front: a row of warm glows.
    for (let i = 0; i < 9; i++) add(r, box(0.08, 0.08, 0.08, mat(BRIGHT.bulb), -w * 0.18 + (i / 8) * w * 0.6, 1.15 - Math.abs(i - 4) * 0.04, d / 2 - 0.15));
  } else if (f === 'laundry') {
    // Two T-posts and three lines of washing between them.
    const half = Math.min(w, 8) * 0.38;
    for (const x of [-half, half]) {
      add(r, box(0.06, 1.7, 0.06, mat(0x6a6a6a), x, 0, 0));
      add(r, box(0.06, 0.06, 1.2, mat(0x6a6a6a), x, 1.68, 0));
    }
    for (const z of [-0.5, 0, 0.5]) {
      add(r, box(half * 2, 0.015, 0.015, mat(0xd8d8d0), 0, 1.68, z));
      for (let x = -half + 0.3; x < half - 0.2; x += 0.45 + random() * 0.25) {
        const tall = 0.35 + random() * 0.4;
        add(r, box(0.32 + random() * 0.2, tall, 0.02, mat(CLOTHES[Math.floor(random() * CLOTHES.length)]), x, 1.67 - tall, z));
      }
    }
  } else if (f === 'loft') {
    // A pigeon loft: a wooden shed with a mesh front and a landing board, birds on top and around.
    add(r, box(2.2, 1.5, 1.4, mat(0x8a6a44), 0, 0, -d * 0.15));
    add(r, box(2.4, 0.08, 1.6, mat(0x4a3a2a), 0, 1.5, -d * 0.15)).rotation.x = 0.08;
    add(r, box(2.0, 1.0, 0.03, mat(0x2a2a2a), 0, 0.3, -d * 0.15 + 0.71));
    add(r, box(2.2, 0.04, 0.3, mat(WOOD), 0, 1.0, -d * 0.15 + 0.85));
    for (let i = 0; i < 6; i++) pigeon(r, -0.9 + i * 0.36, i % 2 ? 1.6 : 1.05, -d * 0.15 + (i % 2 ? 0 : 0.85), random() * 6.28);
    for (let i = 0; i < 4; i++) pigeon(r, (random() - 0.5) * (w - 2), 0.06, (random() - 0.2) * (d - 2) * 0.5, random() * 6.28);
  } else if (f === 'pool') {
    // A small rooftop pool: a white rim, blue water, two loungers and a potted palm.
    const pw = Math.min(w - 2.4, 4.4), pd = Math.min(d - 2.6, 2.6);
    add(r, box(pw + 0.4, 0.45, pd + 0.4, mat(0xe8e6e0), 0, 0, -d * 0.1));
    add(r, box(pw, 0.05, pd, mat(BRIGHT.pool), 0, 0.42, -d * 0.1));
    for (const x of [-0.8, 0.8]) {
      add(r, box(0.6, 0.25, 1.6, mat(0xf0f0ea), x, 0, -d * 0.1 + pd / 2 + 1.1));
      add(r, box(0.6, 0.45, 0.06, mat(0xf0f0ea), x, 0.25, -d * 0.1 + pd / 2 + 0.35)).rotation.x = -0.6;
    }
    add(r, cylinder(0.25, 0.4, mat(0x9a5a3a), 8, pw / 2 + 0.6, 0, d * 0.25));
    add(r, cylinder(0.05, 1.5, mat(0x7a5a3a), 5, pw / 2 + 0.6, 0.4, d * 0.25));
    for (let i = 0; i < 5; i++) add(r, box(0.9, 0.03, 0.18, mat(0x3a7a3a), pw / 2 + 0.6 + Math.cos(i * 1.26) * 0.4, 1.85, d * 0.25 + Math.sin(i * 1.26) * 0.4)).rotation.y = -i * 1.26;
  } else {
    // A radio mast: a lattice tower with a red light on top, guyed.
    add(r, box(0.5, 0.2, 0.5, mat(0x5a5a5a), 0, 0, 0));
    for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) add(r, box(0.04, 5.6, 0.04, mat(0xb83a2a), x, 0.2, z));
    for (let yy = 0.9; yy < 5.6; yy += 0.9) add(r, box(0.4, 0.04, 0.4, mat(0xe8e2d6), 0, yy, 0));
    add(r, box(0.14, 0.14, 0.14, mat(BRIGHT.mast), 0, 5.8, 0));
    for (const s of [-1, 1]) add(r, box(0.02, 0.02, 1.5, mat(0x9a9a9a), 0, 4.6, s * 0.6)).rotation.x = s * 0.9;
  }
}

/** A TV aerial: a mast with a boom and cross elements, pointing along x. */
export function tvAerial(g: Object3D, x: number, y: number, z: number, random: Random): void {
  const a = add(g, new Group());
  a.position.set(x, y, z);
  a.rotation.y = random() * Math.PI;
  const steel = mat(0x8a8a8a);
  add(a, box(0.04, 1.4, 0.04, steel, 0, 0, 0));
  add(a, box(1.1, 0.03, 0.03, steel, 0, 1.3, 0));
  for (let i = 0; i < 6; i++) add(a, box(0.02, 0.02, 0.34 - i * 0.03, steel, -0.5 + i * 0.2, 1.3, 0));
}

/** A satellite dish on a short bracket, facing south (+z). */
export function dish(g: Object3D, x: number, y: number, z: number): void {
  const d = add(g, new Group());
  d.position.set(x, y, z);
  add(d, box(0.05, 0.5, 0.05, mat(0x5a5a5a), 0, 0, 0));
  const plate = add(d, cylinder(0.32, 0.05, mat(0xd8d6d0), 12, 0, 0.55, 0.05));
  plate.rotation.x = 1.15;
}

/**
 * A pitched roof's dressing: clay pots on its two chimneys, a TV aerial on
 * the ridge and a few pigeons along it. `ridge` is the ridge's height, and
 * the ridge runs along x when `alongX`.
 */
export function pitchedRoofDressing(g: Object3D, cx: number, cz: number, w: number, d: number, ridge: number, chimneyTop: number, chimneys: [number, number][], alongX: boolean, random: Random): void {
  for (const [x, z] of chimneys) {
    for (const o of [-0.13, 0.13]) add(g, cylinder(0.09, 0.32, mat(0xa85a3a), 8, x + o, chimneyTop, z));
  }
  if (random() < 0.7) tvAerial(g, cx + (alongX ? (random() - 0.5) * w * 0.4 : 0), ridge, cz + (alongX ? 0 : (random() - 0.5) * d * 0.4), random);
  const n = Math.floor(random() * 4);
  const len = alongX ? w : d;
  for (let i = 0; i < n; i++) {
    const t = (random() - 0.5) * len * 0.8;
    pigeon(g, cx + (alongX ? t : 0), ridge - 0.02, cz + (alongX ? 0 : t), alongX ? Math.PI / 2 : 0);
  }
}
