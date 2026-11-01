import { Group, type Material } from 'three';
import { PALETTE } from '../config/palette';
import type { Random } from '../sim/random';
import { add, box, cylinder } from './kit';
import { glowMat, mat } from './materials';
import { solid } from './solids';

/**
 * Small-scale detail kit: rooftop equipment, facade trim and street furniture.
 * Every piece is static, built facing +z with its pivot at ground centre, and
 * meant to be merged with `mergeStatic`, so detail adds vertices, not draw calls.
 * Rotate by +PI/2 to face +x.
 */

/** Frame, cross mullion, sill and lintel laid over an existing window pane. */
export function windowTrim(w: number, h: number, frame: Material = mat(PALETTE.frame), sill: Material = mat(PALETTE.concrete)): Group {
  const g = new Group();
  add(g, box(w + 0.1, 0.06, 0.1, frame, 0, -0.03, 0.04));
  add(g, box(w + 0.1, 0.06, 0.1, frame, 0, h - 0.03, 0.04));
  add(g, box(0.06, h, 0.1, frame, -w / 2, 0, 0.04));
  add(g, box(0.06, h, 0.1, frame, w / 2, 0, 0.04));
  add(g, box(0.05, h, 0.08, frame, 0, 0, 0.04));
  add(g, box(w, 0.05, 0.08, frame, 0, h * 0.62, 0.04));
  add(g, box(w + 0.3, 0.08, 0.22, sill, 0, -0.1, 0.1));
  add(g, box(w + 0.2, 0.1, 0.12, sill, 0, h + 0.02, 0.06));
  return g;
}

export function drainpipe(height: number): Group {
  const g = new Group();
  const metal = mat(PALETTE.metal);
  add(g, box(0.1, height, 0.1, metal));
  for (let y = 0.8; y < height - 0.3; y += 1.6) add(g, box(0.16, 0.06, 0.14, metal, 0, y, -0.02));
  add(g, box(0.16, 0.08, 0.3, metal, 0, 0, 0.1));
  return g;
}

export function acUnit(): Group {
  const g = new Group();
  add(g, box(0.9, 0.08, 0.5, mat(PALETTE.metal)));
  add(g, box(0.86, 0.56, 0.46, mat(PALETTE.concrete), 0, 0.08, 0));
  add(g, cylinder(0.18, 0.02, mat(PALETTE.frame), 8, -0.12, 0.66, 0));
  add(g, box(0.32, 0.36, 0.02, mat(PALETTE.frame), 0.2, 0.18, 0.23));
  return g;
}

export function roofVent(): Group {
  const g = new Group();
  add(g, cylinder(0.14, 0.55, mat(PALETTE.metal), 6));
  add(g, cylinder(0.24, 0.06, mat(PALETTE.concrete), 6, 0, 0.6, 0));
  return g;
}

export function satelliteDish(): Group {
  const g = new Group();
  const metal = mat(PALETTE.metal);
  add(g, box(0.08, 0.6, 0.08, metal));
  const dish = add(g, cylinder(0.36, 0.06, mat(PALETTE.kerb), 8, 0, 0.62, 0.05));
  dish.rotation.x = 1.0;
  add(g, box(0.04, 0.04, 0.4, metal, 0, 0.72, 0.25));
  return g;
}

export function antenna(height = 1.8): Group {
  const g = new Group();
  const metal = mat(PALETTE.frame);
  add(g, box(0.05, height, 0.05, metal));
  for (const [y, w] of [[height - 0.2, 0.9], [height - 0.5, 0.7], [height - 0.8, 0.5]] as const) add(g, box(w, 0.04, 0.04, metal, 0, y, 0));
  return g;
}

export function waterTank(): Group {
  const g = new Group();
  const timber = mat(PALETTE.timber);
  for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) add(g, box(0.08, 0.7, 0.08, mat(PALETTE.metal), x, 0, z));
  add(g, cylinder(0.65, 1.2, timber, 8, 0, 0.7, 0));
  for (const y of [0.95, 1.5]) add(g, cylinder(0.67, 0.05, mat(PALETTE.frame), 8, 0, y, 0));
  add(g, cylinder(0.7, 0.1, mat(PALETTE.roofTrim), 8, 0, 1.9, 0));
  return g;
}

/** Tilted solar panel on a low rack. */
export function solarPanel(): Group {
  const g = new Group();
  add(g, box(0.06, 0.45, 0.06, mat(PALETTE.metal), 0, 0, -0.5));
  const panel = add(g, box(1.0, 0.05, 1.4, glowMat(0x2c3c62, 0x6a88c0, 0.08), 0, 0.22, 0));
  panel.rotation.x = 0.35;
  add(panel, box(0.04, 0.06, 1.4, mat(PALETTE.kerb), 0, 0, 0));
  return g;
}

/** Railing along local x, `length` metres long. */
export function railing(length: number, height = 0.85, material: Material = mat(PALETTE.metal)): Group {
  const g = new Group();
  const n = Math.max(1, Math.round(length / 0.7));
  for (let i = 0; i <= n; i++) add(g, box(0.05, height, 0.05, material, -length / 2 + (i * length) / n, 0, 0));
  add(g, box(length, 0.05, 0.06, material, 0, height, 0));
  add(g, box(length, 0.04, 0.04, material, 0, height * 0.5, 0));
  return g;
}

/** Fire escape ladder with landing, against a wall facing +z. */
export function fireEscape(height: number): Group {
  const g = new Group();
  const metal = mat(PALETTE.frame);
  add(g, box(0.05, height - 2.4, 0.05, metal, -0.25, 2.4, 0.2));
  add(g, box(0.05, height - 2.4, 0.05, metal, 0.25, 2.4, 0.2));
  for (let y = 2.6; y < height; y += 0.3) add(g, box(0.5, 0.04, 0.04, metal, 0, y, 0.2));
  add(g, box(1.4, 0.06, 0.7, metal, 0.45, height - 1.4, 0.35));
  add(g, railing(1.4, 0.7, metal)).position.set(0.45, height - 1.34, 0.68);
  return g;
}

export function flowerPot(bloom: number, scale = 1): Group {
  const g = new Group();
  add(g, cylinder(0.18 * scale, 0.32 * scale, mat(PALETTE.brickDark), 6));
  add(g, cylinder(0.22 * scale, 0.28 * scale, mat(PALETTE.foliage), 6, 0, 0.32 * scale, 0));
  for (const [x, z] of [[0.08, 0.06], [-0.1, 0.02], [0.02, -0.1]]) add(g, box(0.09 * scale, 0.07 * scale, 0.09 * scale, mat(bloom), x * scale, 0.58 * scale, z * scale));
  return g;
}

/** Window box of flowers for a sill or balcony rail. */
export function flowerBox(length: number, random: Random): Group {
  const g = new Group();
  add(g, box(length, 0.18, 0.22, mat(PALETTE.timber)));
  add(g, box(length - 0.06, 0.12, 0.2, mat(PALETTE.foliage), 0, 0.18, 0));
  for (let x = -length / 2 + 0.1; x < length / 2 - 0.05; x += 0.16) {
    add(g, box(0.07, 0.07, 0.07, mat(pickBloom(random)), x, 0.28 + random() * 0.06, (random() - 0.5) * 0.12));
  }
  return g;
}

const BLOOMS = [0xe0a0b8, 0xf0d070, 0xe8e0f0, 0xd06a6a, 0xa890e0];
function pickBloom(random: Random): number {
  return BLOOMS[Math.floor(random() * BLOOMS.length)];
}

/** Raised bed edged in timber with scattered flowers. */
export function flowerBed(w: number, d: number, random: Random): Group {
  const g = new Group();
  add(g, box(w, 0.12, d, mat(PALETTE.timber)));
  add(g, box(w - 0.12, 0.14, d - 0.12, mat(PALETTE.foliageDark)));
  // Leafy mounds first, blooms on top, so the bed reads as planting, not soil.
  for (let x = -w / 2 + 0.25; x < w / 2 - 0.1; x += 0.4) {
    for (let z = -d / 2 + 0.25; z < d / 2 - 0.1; z += 0.4) {
      add(g, box(0.34, 0.1 + random() * 0.08, 0.34, mat(random() < 0.5 ? PALETTE.foliage : PALETTE.foliageLight), x, 0.14, z));
    }
  }
  const count = Math.round(w * d * 14);
  for (let i = 0; i < count; i++) {
    const x = (random() - 0.5) * (w - 0.25);
    const z = (random() - 0.5) * (d - 0.25);
    add(g, box(0.13, 0.09, 0.13, mat(pickBloom(random)), x, 0.24 + random() * 0.1, z));
  }
  return g;
}

/** Clipped hedge along local x with an uneven top. */
export function hedge(length: number, random: Random): Group {
  const g = new Group();
  add(g, box(length, 0.7, 0.6, mat(PALETTE.foliageDark)));
  for (let x = -length / 2 + 0.3; x < length / 2 - 0.2; x += 0.55) {
    add(g, box(0.5, 0.12 + random() * 0.1, 0.5, mat(random() < 0.5 ? PALETTE.foliage : PALETTE.foliageDark), x, 0.7, (random() - 0.5) * 0.08));
  }
  return g;
}

/** Low park fence along local x. */
export function fence(length: number): Group {
  const g = new Group();
  const wood = mat(PALETTE.bench);
  for (let x = -length / 2; x <= length / 2 + 0.01; x += 0.5) add(g, box(0.07, 0.6, 0.07, wood, x, 0, 0));
  add(g, box(length, 0.06, 0.05, wood, 0, 0.45, 0));
  add(g, box(length, 0.06, 0.05, wood, 0, 0.2, 0));
  return g;
}

export function hydrant(): Group {
  const g = new Group();
  const red = mat(0xa04a48);
  add(g, cylinder(0.14, 0.55, red, 6));
  add(g, cylinder(0.17, 0.08, red, 6, 0, 0.55, 0));
  add(g, cylinder(0.08, 0.1, red, 6, 0, 0.63, 0));
  add(g, box(0.36, 0.1, 0.1, red, 0, 0.32, 0));
  return g;
}

export function postBox(): Group {
  const g = new Group();
  const red = mat(0xb04a42);
  add(g, cylinder(0.24, 1.0, red, 8));
  add(g, cylinder(0.27, 0.1, red, 8, 0, 1.0, 0));
  add(g, box(0.26, 0.04, 0.06, mat(PALETTE.frame), 0, 0.75, 0.22));
  return solid(g, 0.55);
}

/** Pole sign: `face` colours the plate. */
export function signPost(face: number, height = 2.3): Group {
  const g = new Group();
  add(g, box(0.06, height, 0.06, mat(PALETTE.metal)));
  add(g, box(0.5, 0.5, 0.04, mat(face), 0, height - 0.55, 0.04));
  add(g, box(0.34, 0.08, 0.05, mat(0xf0ead8), 0, height - 0.34, 0.06));
  return solid(g, 0.15);
}

/** Crossing beacon: striped pole with a glowing amber globe. */
export function beacon(globe: Material): Group {
  const g = new Group();
  for (let i = 0; i < 5; i++) add(g, cylinder(0.06, 0.45, mat(i % 2 ? 0xeae4d4 : PALETTE.frame), 6, 0, i * 0.45, 0));
  add(g, cylinder(0.17, 0.3, globe, 8, 0, 2.25, 0));
  return g;
}

export function manhole(): Group {
  const g = new Group();
  add(g, cylinder(0.36, 0.012, mat(PALETTE.metal), 10));
  add(g, cylinder(0.24, 0.016, mat(PALETTE.frame), 10));
  return g;
}

export function drainGrate(): Group {
  const g = new Group();
  add(g, box(0.5, 0.012, 0.3, mat(PALETTE.frame)));
  for (let x = -0.18; x <= 0.19; x += 0.12) add(g, box(0.04, 0.016, 0.26, mat(PALETTE.metal), x, 0, 0));
  return g;
}

/** Bicycle parked along local x. */
export function bike(frame: number): Group {
  const g = new Group();
  const tyre = mat(PALETTE.tyre);
  for (const x of [-0.42, 0.42]) {
    const w = add(g, cylinder(0.3, 0.05, tyre, 10, x, 0.3, 0));
    w.rotation.x = Math.PI / 2;
    w.position.y = 0.3;
  }
  const paint = mat(frame);
  add(g, box(0.8, 0.05, 0.05, paint, 0, 0.55, 0));
  add(g, box(0.05, 0.36, 0.05, paint, -0.12, 0.3, 0));
  add(g, box(0.05, 0.4, 0.05, paint, 0.38, 0.3, 0));
  add(g, box(0.22, 0.05, 0.1, mat(PALETTE.frame), -0.14, 0.7, 0));
  add(g, box(0.05, 0.05, 0.42, mat(PALETTE.frame), 0.38, 0.72, 0));
  return g;
}

export function picnicTable(): Group {
  const g = new Group();
  const wood = mat(PALETTE.bench);
  add(g, box(1.7, 0.07, 0.8, wood, 0, 0.72, 0));
  for (const z of [-0.65, 0.65]) add(g, box(1.7, 0.06, 0.3, wood, 0, 0.42, z));
  for (const x of [-0.7, 0.7]) {
    add(g, box(0.08, 0.72, 0.08, wood, x, 0, 0));
    add(g, box(0.08, 0.06, 1.6, wood, x, 0.36, 0));
  }
  return g;
}

export function crateStack(random: Random): Group {
  const g = new Group();
  const colours = [0x4f6a8a, 0x7a5a45, 0x5a7a5a];
  add(g, box(0.5, 0.36, 0.4, mat(colours[0]), 0, 0, 0));
  add(g, box(0.5, 0.36, 0.4, mat(colours[1]), 0.55, 0, 0.02));
  add(g, box(0.5, 0.36, 0.4, mat(colours[Math.floor(random() * 3)]), 0.25, 0.36, 0));
  add(g, cylinder(0.22, 0.5, mat(PALETTE.metal), 8, -0.5, 0, 0.1));
  return g;
}

/**
 * Festoon lights strung between anchor points (world-space, metres), each
 * span sagging into a gentle curve. Bulbs alternate through `bulbMats`.
 */
export function stringLights(spans: [number, number, number, number, number, number][], bulbMats: Material[]): Group {
  const g = new Group();
  const wire = mat(PALETTE.frame);
  let k = 0;
  for (const [x0, y0, z0, x1, y1, z1] of spans) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(4, Math.round(len / 0.45));
    const sag = 0.06 * len;
    let prev: [number, number, number] | null = null;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p: [number, number, number] = [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - sag * 4 * t * (1 - t), z0 + (z1 - z0) * t];
      if (prev) {
        const seg = add(g, box(0.06, 0.06, Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]), wire));
        seg.position.set((p[0] + prev[0]) / 2, (p[1] + prev[1]) / 2 - 0.03, (p[2] + prev[2]) / 2);
        seg.lookAt(p[0], p[1] - 0.03, p[2]);
        seg.castShadow = false;
      }
      if (bulbMats.length > 0 && i > 0 && i < steps) {
        const b = add(g, box(0.09, 0.11, 0.09, bulbMats[k++ % bulbMats.length], p[0], p[1] - 0.14, p[2]));
        b.castShadow = false;
      }
      prev = p;
    }
  }
  return g;
}

/** Pedestrian signal: pole, push-button box and a two-lamp head facing +z. */
export function pedestrianSignal(red: Material, green: Material): Group {
  const g = new Group();
  add(g, cylinder(0.06, 2.6, mat(PALETTE.frame), 6));
  add(g, box(0.16, 0.24, 0.12, mat(0xd8c84a), 0, 1.0, 0.08));
  add(g, box(0.34, 0.74, 0.24, mat(PALETTE.frame), 0, 2.0, 0.06));
  add(g, box(0.24, 0.24, 0.04, red, 0, 2.42, 0.19));
  add(g, box(0.24, 0.24, 0.04, green, 0, 2.08, 0.19));
  return g;
}

/** Parked e-scooter along local x. */
export function scooter(paint: number): Group {
  const g = new Group();
  const tyre = mat(PALETTE.tyre);
  add(g, box(0.16, 0.16, 0.08, tyre, -0.4, 0, 0));
  add(g, box(0.16, 0.16, 0.08, tyre, 0.4, 0, 0));
  add(g, box(0.8, 0.07, 0.16, mat(paint), 0, 0.1, 0));
  const stem = add(g, box(0.05, 1.0, 0.05, mat(paint), 0.42, 0.1, 0));
  stem.rotation.z = 0.15;
  add(g, box(0.05, 0.05, 0.46, mat(PALETTE.frame), 0.3, 1.08, 0));
  return g;
}

/** Round advertising pillar with a softly lit poster band and a domed cap. */
export function advertPillar(poster: Material): Group {
  const g = new Group();
  add(g, cylinder(0.46, 0.2, mat(PALETTE.frame), 10));
  add(g, cylinder(0.42, 2.0, poster, 10, 0, 0.2, 0));
  add(g, cylinder(0.5, 0.12, mat(0x4f6a5a), 10, 0, 2.2, 0));
  add(g, cylinder(0.32, 0.25, mat(0x4f6a5a), 10, 0, 2.32, 0));
  return solid(g, 0.95);
}

/** Glass bus shelter along local x, open towards +z, with a lit advert panel at one end. */
export function busShelter(advert: Material): Group {
  const g = new Group();
  const frame = mat(PALETTE.metal);
  const glass = glowMat(0x6a7a90, 0x9fb8d0, 0.08);
  for (const x of [-1.4, 1.4]) for (const z of [-0.22, 0.22]) add(g, box(0.07, 2.3, 0.07, frame, x, 0, z));
  add(g, box(2.9, 1.9, 0.04, glass, 0, 0.25, -0.22));
  add(g, box(0.04, 1.9, 0.44, advert, 1.4, 0.25, 0));
  add(g, box(0.04, 1.9, 0.44, glass, -1.4, 0.25, 0));
  add(g, box(3.1, 0.1, 0.7, frame, 0, 2.3, 0));
  add(g, box(1.6, 0.06, 0.3, mat(PALETTE.bench), -0.2, 0.48, -0.08));
  add(g, box(0.5, 0.3, 0.04, mat(0xf0ead8), -0.8, 1.6, -0.19));
  return solid(g, 3.0, 0.55);
}
