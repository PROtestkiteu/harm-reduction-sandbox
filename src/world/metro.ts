import { Group, MeshLambertMaterial } from 'three';
import { add, box, cylinder, pixelTextTexture } from './kit';
import { glowMat, mat } from './materials';

/**
 * A metro entrance: a stairwell going down between low stone walls with a
 * rail on top, open at one end, and a post with a lit M sign. Its stair axis
 * runs along local +z, the open top end at -z. The steps are drawn on a dark
 * pit flush with the ground, so someone walking down sinks below the pavement
 * and is hidden by it: people come and go through it without appearing or
 * vanishing in view (world/ambient.ts).
 */
export const METRO = {
  /** Inside width and length of the stairwell, metres. */
  width: 1.7,
  length: 4.6,
  /** How far below the ground the bottom of the stairs is. */
  depth: 2.6,
};

let shared: { stone: MeshLambertMaterial; rail: MeshLambertMaterial; pit: MeshLambertMaterial; step: MeshLambertMaterial; sign: MeshLambertMaterial; post: MeshLambertMaterial } | null = null;

export function metroEntrance(): Group {
  shared ??= {
    stone: mat(0x7a7670),
    rail: mat(0x3a4046),
    pit: mat(0x16181a),
    step: mat(0x34383c),
    sign: new MeshLambertMaterial({ map: pixelTextTexture('M', '#ffffff', '#c8202a'), emissive: 0xffffff, emissiveIntensity: 0.85, emissiveMap: pixelTextTexture('M', '#ffffff', '#c8202a') }),
    post: mat(0x2a2c2e),
  };
  const m = shared;
  const g = new Group();
  const { width: w, length: l } = METRO;
  const t = 0.16;
  const h = 0.95;
  // The pit, with step edges getting darker as they go down.
  add(g, box(w, 0.012, l, m.pit, 0, 0.005, 0));
  for (let i = 0, z = -l / 2 + 0.3; z < l / 2 - 0.2; z += 0.32, i++) add(g, box(w - 0.06, 0.006, 0.05, i < 4 ? m.step : m.pit, 0, 0.018, z));
  // Walls on both sides and across the bottom end, a rail on top of each.
  for (const x of [-(w + t) / 2, (w + t) / 2]) {
    add(g, box(t, h, l + t, m.stone, x, 0, t / 2));
    add(g, box(0.06, 0.06, l + t, m.rail, x, h + 0.03, t / 2));
  }
  add(g, box(w + 2 * t, h, t, m.stone, 0, 0, l / 2 + t / 2));
  add(g, box(w + 2 * t, 0.06, 0.06, m.rail, 0, h + 0.03, l / 2 + t / 2));
  // The sign post at the open end's corner: an M lit from inside, readable from above too.
  const px = (w + t) / 2 + 0.25;
  const pz = -l / 2 + 0.1;
  add(g, cylinder(0.06, 2.6, m.post, 6, px, 0, pz));
  add(g, box(0.62, 0.62, 0.62, m.sign, px, 2.6, pz));
  add(g, box(0.66, 0.06, 0.66, glowMat(0x3a0e0e, 0xff3a2a, 0.9), px, 3.24, pz));
  return g;
}
