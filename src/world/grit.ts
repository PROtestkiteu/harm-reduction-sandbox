import {
  CanvasTexture,
  Group,
  LinearFilter,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  type MeshLambertMaterial,
  type Object3D,
} from 'three';
import { PALETTE } from '../config/palette';
import type { Random } from '../sim/random';
import { add, box, cylinder, signBoard } from './kit';
import { glowMat, mat } from './materials';
import { solid } from './solids';

/**
 * The worn, neon-lit side of the city: neon shop signs and projecting blade
 * signs, boarded windows, scaffolding, sagging cable bundles and steam from
 * manholes. Nothing here is set square: signs hang a little askew, poles lean,
 * cables sag unevenly, so the street reads as lived-in rather than built from
 * a catalogue.
 */

/** Nudges an object off true: a small tilt and lean, as things settle over years. */
export function askew<T extends Object3D>(o: T, random: Random, amount = 1): T {
  o.rotation.z += (random() - 0.5) * 0.08 * amount;
  o.rotation.x += (random() - 0.5) * 0.04 * amount;
  o.rotation.y += (random() - 0.5) * 0.06 * amount;
  return o;
}

// Neon. A handful of shared flicker groups so every sign does not cost its own
// material, each with its own rhythm of dropouts.

interface Flicker { mat: MeshLambertMaterial; base: number; seed: number; faulty: boolean }
const flickers: Flicker[] = [];
const NEON = ['#ff4fa8', '#4ff0ff', '#ffb03a', '#9aff6a', '#c47bff'] as const;
const NEON_HEX = [0xff4fa8, 0x4ff0ff, 0xffb03a, 0x9aff6a, 0xc47bff] as const;
const NEON_WORDS = ['BAR', 'OPEN', 'HOTEL', '24H', 'PAWN', 'GAMES', 'LIQUOR', 'NOODLES', 'ROOMS', 'CASH', 'KEYS', 'VIDEO'];

const stillMotion = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

/** Tube frames share one material per colour, so they merge and cost one draw each. */
const tubes: MeshLambertMaterial[] = [];
function tubeMat(k: number, random: Random): MeshLambertMaterial {
  if (!tubes[k]) {
    tubes[k] = glowMat(0x22161c, NEON_HEX[k], 1.4);
    flickers.push({ mat: tubes[k], base: 1.4, seed: random() * 100, faulty: false });
  }
  return tubes[k];
}

/** A leaning timber utility pole with a crossarm, the anchor for overhead cables. */
export function utilityPole(random: Random): Group {
  const g = new Group();
  add(g, cylinder(0.11, 7.2, mat(0x4a3a2c), 6));
  add(g, box(1.4, 0.1, 0.1, mat(0x4a3a2c), 0, 6.6, 0));
  add(g, box(0.25, 0.35, 0.2, mat(0x5a5a52), 0.25, 5.6, 0.08));
  g.rotation.z = (random() - 0.5) * 0.07;
  g.rotation.x = (random() - 0.5) * 0.05;
  return solid(g, 0.32);
}

/** A neon word on a dark backing board with a tube frame, facing +z in local space. */
export function neonSign(random: Random): Group {
  const g = new Group();
  const word = NEON_WORDS[Math.floor(random() * NEON_WORDS.length)];
  const k = Math.floor(random() * NEON.length);
  const sign = signBoard(word, Math.max(1.0, word.length * 0.32), 0.55, NEON[k], '#0e0a12', 1.6);
  add(g, sign.mesh);
  const tube = tubeMat((k + 2) % NEON_HEX.length, random);
  const w = Math.max(1.0, word.length * 0.32) + 0.16;
  for (const [x, y, bw, bh] of [[0, -0.06, w, 0.04], [0, 0.6, w, 0.04], [-w / 2, -0.06, 0.04, 0.7], [w / 2, -0.06, 0.04, 0.7]] as const) {
    add(g, box(bw, bh, 0.04, tube, x, y, 0.08));
  }
  flickers.push({ mat: sign.material, base: 1.6, seed: random() * 100, faulty: random() < 0.3 });
  return askew(g, random, 1.2);
}

/** A tall projecting sign on a bracket, sticking out from the wall along local +z. */
export function bladeSign(random: Random): Group {
  const g = new Group();
  const word = NEON_WORDS[Math.floor(random() * NEON_WORDS.length)];
  const k = Math.floor(random() * NEON.length);
  const len = Math.max(1.2, word.length * 0.34);
  const sign = signBoard(word, len, 0.5, NEON[k], '#120c10', 1.5);
  // Text runs down the sign: the board is turned on its side and faces the street.
  sign.mesh.rotation.set(0, Math.PI / 2, Math.PI / 2);
  sign.mesh.position.set(0, 0, 0.55);
  add(g, sign.mesh);
  add(g, box(0.06, 0.06, 0.7, mat(PALETTE.metal), 0, len * 0.85, 0.3));
  add(g, box(0.06, 0.06, 0.7, mat(PALETTE.metal), 0, len * 0.15, 0.3));
  flickers.push({ mat: sign.material, base: 1.5, seed: random() * 100, faulty: random() < 0.35 });
  return askew(g, random, 0.8);
}

/**
 * Animates the neon: steady glow with occasional dropouts, and a few faulty
 * signs that stutter. Held steady when the person prefers reduced motion.
 */
export function updateNeon(time: number, level = 1): void {
  const still = stillMotion?.matches ?? false;
  for (const f of flickers) {
    let on = 1;
    if (!still) {
      const t = time * (f.faulty ? 7 : 1.3) + f.seed;
      const n = Math.sin(t) * Math.sin(t * 2.31 + 1.7) * Math.sin(t * 0.53 + 4.1);
      if (f.faulty ? n > 0.18 : n > 0.82) on = f.faulty ? 0.08 : 0.4;
    }
    f.mat.emissiveIntensity = f.base * on * level;
  }
}

/** Boards nailed over a window opening, facing +z, never quite level. */
export function boardedWindow(w: number, h: number, random: Random): Group {
  const g = new Group();
  add(g, box(w, h, 0.05, mat(0x1c1a18), 0, 0, 0.02));
  const planks = [0x6a5a48, 0x5a4a3a, 0x7a6650];
  const n = 3 + Math.floor(random() * 2);
  for (let i = 0; i < n; i++) {
    const p = add(g, box(w + 0.2, 0.18, 0.04, mat(planks[i % 3]), 0, h * (0.15 + (i / n) * 0.75), 0.06));
    p.rotation.z = (random() - 0.5) * 0.35;
  }
  return g;
}

/** Scaffolding up a facade: poles, ledgers, boards and a sheet of netting. Facing +z. */
export function scaffolding(w: number, h: number, random: Random): Group {
  const g = new Group();
  const pipe = mat(0x6a6a62);
  const board = mat(0x8a7656);
  for (let x = -w / 2; x <= w / 2 + 0.01; x += 2) {
    const pole = add(g, cylinder(0.035, h, pipe, 5, x, 0, 1.1));
    pole.rotation.z = (random() - 0.5) * 0.03;
    add(g, cylinder(0.035, h, pipe, 5, x, 0, 0.15));
  }
  for (let y = 2; y < h; y += 2) {
    add(g, box(w, 0.05, 0.05, pipe, 0, y, 1.1));
    add(g, box(w, 0.06, 1.0, board, 0, y - 0.06, 0.62));
  }
  // Netting on part of it, sagging.
  const net = add(g, box(w * 0.5, h * 0.6, 0.02, mat(0x3a5a6a), -w / 4, h * 0.3, 1.16));
  net.rotation.x = 0.03;
  return g;
}

/**
 * A bundle of cables slung between two points, sagging in a catenary-ish curve
 * from segment boxes. A few strands, each with its own sag.
 */
export function cableBundle(parent: Object3D, a: [number, number, number], b: [number, number, number], random: Random, strands = 3): void {
  const g = add(parent, new Group());
  const black = mat(0x141416);
  for (let s = 0; s < strands; s++) {
    const sag = 0.6 + random() * 1.4;
    const off = (random() - 0.5) * 0.25;
    const segs = 10;
    let prev: [number, number, number] | null = null;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[2] + (b[2] - a[2]) * t + off;
      const y = a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag + off * 0.5;
      if (prev) {
        const dx = x - prev[0];
        const dy = y - prev[1];
        const dz = z - prev[2];
        const len = Math.hypot(dx, dy, dz);
        const seg = add(g, box(0.035, 0.035, len, black, (x + prev[0]) / 2, (y + prev[1]) / 2 - 0.0175, (z + prev[2]) / 2));
        seg.lookAt(x, y - 0.0175, z);
        seg.castShadow = false;
      }
      prev = [x, y, z];
    }
  }
}

// Steam from manholes and vents: a few soft sprites rising and fading in a loop.

let steamTexture: CanvasTexture | null = null;
function steamTex(): CanvasTexture {
  if (steamTexture) return steamTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(170,175,180,0.4)');
  g.addColorStop(0.6, 'rgba(150,155,165,0.12)');
  g.addColorStop(1, 'rgba(200,200,210,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  steamTexture = new CanvasTexture(canvas);
  steamTexture.colorSpace = SRGBColorSpace;
  steamTexture.minFilter = LinearFilter;
  return steamTexture;
}

export interface Steam { update(dt: number): void }

/** Steam rising from a point on the ground. Static, half-risen puffs under reduced motion. */
export function steamVent(parent: Object3D, x: number, z: number, random: Random): Steam {
  const puffs: { sprite: Sprite; t: number; speed: number; drift: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const material = new SpriteMaterial({ map: steamTex(), transparent: true, depthWrite: false, opacity: 0.5 });
    const sprite = new Sprite(material);
    parent.add(sprite);
    puffs.push({ sprite, t: i / 4, speed: 0.12 + random() * 0.06, drift: (random() - 0.5) * 0.6 });
  }
  const place = () => {
    for (const p of puffs) {
      const s = 0.6 + p.t * 2.4;
      p.sprite.scale.set(s, s, 1);
      p.sprite.position.set(x + p.drift * p.t, 0.3 + p.t * 3.2, z + p.drift * p.t * 0.5);
      p.sprite.material.opacity = 0.26 * Math.sin(p.t * Math.PI);
    }
  };
  place();
  return {
    update(dt) {
      if (stillMotion?.matches) return;
      for (const p of puffs) p.t = (p.t + dt * p.speed) % 1;
      place();
    },
  };
}

// Roofs and walls are where a city accumulates: plant, pipes, things people
// put there and forgot. All local to a building group, merged with it.

/** Clutter on a flat roof at height `top` over a `w` by `d` footprint centred at (cx, cz). */
export function roofClutter(g: Object3D, cx: number, cz: number, w: number, d: number, top: number, random: Random, windowMat?: MeshLambertMaterial): void {
  const metal = mat(0x6a6660);
  const duct = mat(0x7a7a74);
  // A duct run along the roof with an elbow down into the building.
  if (random() < 0.7) {
    const len = w * (0.3 + random() * 0.4);
    const dz = (random() - 0.5) * d * 0.6;
    const x0 = cx - w / 2 + 0.8 + random() * (w - len - 1.6);
    add(g, box(len, 0.45, 0.45, duct, x0 + len / 2, top + 0.15, cz + dz));
    add(g, box(0.45, 0.6, 0.45, duct, x0, top, cz + dz));
    for (let x = x0 + 0.6; x < x0 + len; x += 1.4) add(g, box(0.08, 0.15, 0.6, metal, x, top, cz + dz));
  }
  // Vent stacks, each a different height.
  for (let i = 0; i < 2 + Math.floor(random() * 3); i++) {
    const r = 0.08 + random() * 0.08;
    add(g, cylinder(r, 0.5 + random() * 0.9, metal, 6, cx + (random() - 0.5) * (w - 1.2), top, cz + (random() - 0.5) * (d - 1.2)));
  }
  // A skylight, dimly lit from below.
  if (windowMat && random() < 0.4) {
    const sx = cx + (random() - 0.5) * (w - 2.5);
    const sz = cz + (random() - 0.5) * (d - 2.5);
    add(g, box(1.4, 0.3, 1.0, mat(0x4a4a48), sx, top, sz));
    add(g, box(1.2, 0.06, 0.8, windowMat, sx, top + 0.3, sz));
  }
  // Someone's corner of the roof: a couple of chairs and pots.
  if (random() < 0.25) {
    const px = cx + (random() - 0.5) * (w - 2);
    const pz = cz + (random() - 0.5) * (d - 2);
    for (let i = 0; i < 2; i++) {
      const chair = add(g, new Group());
      chair.position.set(px + i * 0.7, top, pz + (random() - 0.5) * 0.4);
      chair.rotation.y = random() * Math.PI;
      add(chair, box(0.45, 0.06, 0.45, mat(0x8a6a4a), 0, 0.42, 0));
      add(chair, box(0.45, 0.45, 0.05, mat(0x8a6a4a), 0, 0.45, -0.2));
      for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) add(chair, box(0.04, 0.42, 0.04, metal, lx, 0, lz));
    }
    for (let i = 0; i < 3; i++) {
      add(g, cylinder(0.16, 0.3, mat(0x7a4a32), 6, px - 0.6 + i * 0.35, top, pz + 0.8));
      add(g, box(0.28, 0.25, 0.28, mat(PALETTE.foliage), px - 0.6 + i * 0.35, top + 0.3, pz + 0.8));
    }
  }
}

/**
 * Clutter on a wall facing +z in local space, `w` wide and `h` tall, with its
 * base at y 0: a pipe run with brackets, air-con units, a meter box, ivy
 * climbing from the foot, slack wiring.
 */
export function wallClutter(w: number, h: number, random: Random): Group {
  const g = new Group();
  const pipe = mat(0x4a4642);
  const px = (random() - 0.5) * (w - 1);
  add(g, box(0.1, h - 0.4, 0.1, pipe, px, 0.2, 0.08));
  for (let y = 1.2; y < h - 0.6; y += 1.8) add(g, box(0.18, 0.06, 0.14, pipe, px, y, 0.06));
  // An offset where the pipe jogs round a window.
  if (random() < 0.5) add(g, box(0.5, 0.1, 0.1, pipe, px + 0.2, h * 0.5, 0.08));
  for (let i = 0; i < Math.floor(random() * 3); i++) {
    const ac = add(g, new Group());
    ac.position.set((random() - 0.5) * (w - 1.2), 3.6 + Math.floor(random() * Math.max(1, (h - 4.5) / 3)) * 3, 0.02);
    add(ac, box(0.8, 0.55, 0.45, mat(0xb8b4a8), 0, 0, 0.24));
    add(ac, box(0.6, 0.4, 0.02, mat(0x3a3a38), 0, 0.08, 0.47));
    add(ac, box(0.04, 0.6, 0.04, pipe, 0.36, -0.6, 0.1));
  }
  if (random() < 0.6) {
    const mx = (random() - 0.5) * (w - 1);
    add(g, box(0.45, 0.6, 0.18, mat(0x8a8a80), mx, 1.2, 0.09));
    add(g, box(0.04, 1.2, 0.04, mat(0x1a1a1a), mx + 0.1, 0, 0.12));
  }
  if (random() < 0.35) {
    // Ivy climbing from the foot of the wall, thinning upward.
    const ix = (random() - 0.5) * (w - 2);
    const leaf = [PALETTE.foliageDark, PALETTE.foliage, 0x3a4a30];
    for (let i = 0; i < 14; i++) {
      const y = random() * random() * Math.min(h, 6);
      const s = 0.25 + random() * 0.35;
      add(g, box(s, s, 0.08, mat(leaf[i % 3]), ix + (random() - 0.5) * (1.6 - y * 0.15), y + 0.1, 0.06));
    }
  }
  // Slack wiring along the wall between fixtures.
  if (random() < 0.5) {
    const wire = add(g, box(w * 0.6, 0.025, 0.025, mat(0x141416), (random() - 0.5) * w * 0.3, 2.9 + random() * 0.3, 0.1));
    wire.rotation.z = (random() - 0.5) * 0.06;
  }
  return g;
}

/**
 * Litter and weeds over a ground rect: paper scraps, cans, drifts of leaves,
 * and tufts of weeds pushing through, denser towards the rect's `edge` side.
 * Nothing that marks drug use: the street is untidy, not a stereotype.
 */
export function groundLitter(g: Object3D, x0: number, x1: number, z0: number, z1: number, y: number, count: number, random: Random): void {
  const paper = [0xd8d0c0, 0xc8c0a8, 0xb8c0c8, 0xe0d8b0];
  const leaf = [0x7a5a2a, 0x8a6a30, 0x5a4a24, 0x6a6a2a];
  const weed = [PALETTE.foliageDark, 0x4a5a2a, PALETTE.foliage];
  for (let i = 0; i < count; i++) {
    const x = x0 + random() * (x1 - x0);
    const z = z0 + random() * (z1 - z0);
    const roll = random();
    if (roll < 0.35) {
      const p = add(g, box(0.18 + random() * 0.15, 0.012, 0.12 + random() * 0.12, mat(paper[Math.floor(random() * paper.length)]), x, y, z));
      p.rotation.y = random() * Math.PI;
      p.castShadow = false;
    } else if (roll < 0.45) {
      const c = add(g, cylinder(0.035, 0.12, mat(random() < 0.5 ? 0xa03a2a : 0x8a8a90), 6, x, y + 0.035, z));
      c.rotation.z = Math.PI / 2;
      c.rotation.y = random() * Math.PI;
      c.castShadow = false;
    } else if (roll < 0.8) {
      for (let k = 0; k < 4; k++) {
        const l = add(g, box(0.09, 0.01, 0.06, mat(leaf[(k + i) % leaf.length]), x + (random() - 0.5) * 0.5, y, z + (random() - 0.5) * 0.5));
        l.rotation.y = random() * Math.PI;
        l.castShadow = false;
      }
    } else {
      for (let k = 0; k < 3; k++) {
        const t = add(g, box(0.06, 0.12 + random() * 0.14, 0.06, mat(weed[k % weed.length]), x + (random() - 0.5) * 0.18, y, z + (random() - 0.5) * 0.18));
        t.rotation.set((random() - 0.5) * 0.6, random() * Math.PI, (random() - 0.5) * 0.6);
        t.castShadow = false;
      }
    }
  }
}
