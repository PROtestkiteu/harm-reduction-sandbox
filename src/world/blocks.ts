import { Group, type MeshLambertMaterial } from 'three';
import { PALETTE } from '../config/palette';
import type { Random } from '../sim/random';
import { WindowBank } from './animated';
import { acUnit, antenna, bike, drainpipe, flowerBox, flowerPot, railing, roofVent, satelliteDish, waterTank, windowTrim } from './details';
import { add, box, cylinder, signBoard } from './kit';
import { glowMat, mat } from './materials';
import { mergeStatic } from './mergeStatic';

/**
 * Infill blocks that make the neighbourhood read as a dense city street.
 * They sit where the camera's view lines never cross a service entrance or
 * queue: the corner block left of everything on screen, the cafe block kept
 * low enough that the drop-in waiting area stays visible above it.
 */

export interface Block {
  readonly root: Group;
  update(dt: number): void;
}

type Face = '+x' | '-x' | '+z' | '-z';
const FACE_ROT: Record<Face, number> = { '+z': 0, '+x': Math.PI / 2, '-z': Math.PI, '-x': -Math.PI / 2 };

/** One trimmed window per position on a wall plane; materials rotate through `mats`. */
function windows(
  g: Group,
  face: Face,
  plane: number,
  along: number[],
  ys: number[],
  mats: MeshLambertMaterial[],
  size: [number, number] = [0.9, 1.4],
): void {
  let k = Math.floor(plane * 7) & 7;
  for (const y of ys) {
    for (const a of along) {
      const [w, h] = size;
      const out = face[0] === '+' ? 0.02 : -0.02;
      const pane = face[1] === 'x' ? box(0.08, h, w, mats[k++ % mats.length], plane + out, y, a) : box(w, h, 0.08, mats[k++ % mats.length], a, y, plane + out);
      add(g, pane);
      const trim = add(g, windowTrim(w, h), FACE_ROT[face]);
      if (face[1] === 'x') trim.position.set(plane + out, y, a);
      else trim.position.set(a, y, plane + out);
    }
  }
}

function windowMats(count: number, warmShare = 0.8): MeshLambertMaterial[] {
  return Array.from({ length: count }, (_, i) =>
    glowMat(PALETTE.glassDark, i / count < warmShare ? PALETTE.warmWindow : PALETTE.coolWindow, 0.2));
}

// Corner block, front-left lot: shop on the ground floor, two floors of flats.

export function buildCornerBlock(random: Random): Block {
  const root = new Group();
  const x0 = -14.8;
  const x1 = -10.6;
  const z0 = 10.0;
  const z1 = 14.8;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const shopH = 3.4;
  const h = 9.4;
  add(root, box(x1 - x0 + 0.1, 0.4, z1 - z0 + 0.1, mat(PALETTE.plasterShade), cx, 0.1, cz));
  add(root, box(x1 - x0, h, z1 - z0, mat(0x8a7a9a), cx, 0.1, cz));
  add(root, box(x1 - x0 + 0.16, 0.22, z1 - z0 + 0.16, mat(0x6e6280), cx, shopH, cz));
  add(root, box(x1 - x0 + 0.08, 0.12, z1 - z0 + 0.08, mat(0x6e6280), cx, 6.4, cz));
  add(root, box(x1 - x0 + 0.2, 0.3, z1 - z0 + 0.2, mat(PALETTE.roofTrim), cx, h + 0.1, cz));

  // Shopfront facing the street.
  const glass = glowMat(PALETTE.glassDark, 0xfff0d0, 1.0);
  const fridge = glowMat(0x9fb8d0, 0xd8ecff, 1.0);
  add(root, box(0.08, 2.0, 3.0, glass, x1 + 0.02, 0.55, cz + 0.4));
  add(root, box(0.06, 1.6, 1.0, fridge, x1 - 0.2, 0.7, cz - 0.4));
  add(root, box(0.06, 1.6, 1.0, fridge, x1 - 0.2, 0.7, cz + 1.2));
  for (const z of [cz - 1.1, cz + 0.4, cz + 1.9]) add(root, box(0.12, 2.1, 0.1, mat(PALETTE.frame), x1 + 0.05, 0.5, z));
  add(root, box(0.12, 2.2, 0.9, mat(PALETTE.glassDark), x1 + 0.03, 0.5, cz - 1.75));
  const awn = add(root, new Group());
  awn.position.set(x1 + 0.05, 2.7, cz);
  for (let i = 0; i < 8; i++) {
    const piece = add(awn, box(1.0, 0.08, 0.55, mat(i % 2 ? 0xe0d2b4 : 0x5f8f7f), 0.5, 0, -2.0 + i * 0.57));
    piece.rotation.z = -0.35;
  }
  const sign = signBoard('SHOP', 1.8, 0.5, '#fff4dc', '#3a3448', 0.8);
  add(root, sign.mesh, Math.PI / 2).position.set(x1 + 0.08, 2.95, cz);
  for (let i = 0; i < 3; i++) {
    add(root, box(0.5, 0.5, 0.6, mat(PALETTE.timber), x1 + 0.4, 0.12, cz - 0.5 + i * 0.7));
    add(root, box(0.44, 0.1, 0.54, mat([0x9ab04a, 0xd06a4a, 0xe0b040][i]), x1 + 0.4, 0.62, cz - 0.5 + i * 0.7));
  }
  add(root, box(0.4, 1.0, 0.5, mat(PALETTE.metal), x1 + 0.35, 0.12, cz - 2.1));
  add(root, bike(0x5a7a5a)).position.set(x1 + 0.4, 0.12, z0 - 0.5);

  // Flats above: windows on every face, small balconies on the street side.
  const flats = windowMats(9);
  const along = [cz - 1.6, cz, cz + 1.6];
  const ys = [4.2, 7.1];
  windows(root, '+x', x1, along, ys, flats);
  windows(root, '-x', x0, along, ys, flats);
  windows(root, '+z', z1, [cx - 1.2, cx + 1.2], [1.2, ...ys], flats);
  windows(root, '-z', z0, [cx - 1.2, cx + 1.2], ys, flats);
  for (const y of ys) {
    add(root, box(0.7, 0.1, 1.4, mat(PALETTE.concrete), x1 + 0.35, y - 0.3, cz));
    add(root, railing(1.4, 0.55), Math.PI / 2).position.set(x1 + 0.68, y - 0.2, cz);
    add(root, flowerBox(0.8, random), Math.PI / 2).position.set(x1 + 0.18, y - 0.12, cz + 1.6);
  }
  add(root, drainpipe(h + 0.2)).position.set(x1 - 0.12, 0, z1 + 0.06);
  add(root, satelliteDish(), Math.PI / 2).position.set(x1 + 0.12, 8.6, cz + 0.8);

  // Roof: tank, aerial, vents, a small roof garden.
  const top = h + 0.4;
  add(root, waterTank()).position.set(cx - 0.8, top, cz - 1.2);
  add(root, antenna(1.8)).position.set(cx + 1.2, top, cz - 1.6);
  add(root, roofVent()).position.set(cx + 1.0, top, cz + 1.4);
  add(root, acUnit()).position.set(cx - 0.4, top, cz + 1.4);
  for (const [x, z, c] of [[cx + 1.4, cz + 0.2, 0xe0a0b8], [cx + 1.4, cz - 0.4, 0xf0d070]] as const) add(root, flowerPot(c)).position.set(x, top, z);
  mergeStatic(root);

  // The shop stays lit all evening; the flats switch on and off.
  const shop = new WindowBank([glass], 1.15, 0.35, () => 0.05);
  const homes = new WindowBank(flats, 1.1, 0.06, random);
  return {
    root,
    update(dt) {
      shop.update(dt, 0.6);
      homes.update(dt, 0.55);
    },
  };
}

// Cafe block, right edge of the park: corner cafe below, one floor of flats.

export function buildCafeBlock(random: Random): Block {
  const root = new Group();
  const x0 = 12.6;
  const x1 = 14.95;
  const z0 = -1.2;
  const z1 = 6.6;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const h = 5.8;
  add(root, box(x1 - x0 + 0.1, 0.35, z1 - z0 + 0.1, mat(PALETTE.brickDark), cx, 0.1, cz));
  add(root, box(x1 - x0, h, z1 - z0, mat(0xa07a5e), cx, 0.1, cz));
  add(root, box(x1 - x0 + 0.14, 0.2, z1 - z0 + 0.14, mat(PALETTE.brickDark), cx, 3.0, cz));
  add(root, box(x1 - x0 + 0.2, 0.3, z1 - z0 + 0.2, mat(PALETTE.roofTrim), cx, h + 0.1, cz));

  // Cafe glazing wraps the park-facing corner.
  const cafe = glowMat(PALETTE.glassDark, 0xffd29a, 1.0);
  add(root, box(1.8, 1.9, 0.08, cafe, cx, 0.6, z1 + 0.02));
  add(root, box(0.08, 1.9, 3.4, cafe, x0 - 0.02, 0.6, z1 - 2.0));
  for (const z of [z1 - 3.7, z1 - 2.0, z1 - 0.3]) add(root, box(0.1, 2.0, 0.1, mat(PALETTE.frame), x0 - 0.04, 0.55, z));
  add(root, box(0.1, 2.2, 0.9, mat(PALETTE.glassDark), x0 - 0.03, 0.45, z0 + 1.6));
  const awn = add(root, new Group());
  awn.position.set(cx, 2.65, z1 + 0.05);
  for (let i = 0; i < 4; i++) {
    const piece = add(awn, box(0.55, 0.08, 0.9, mat(i % 2 ? 0xe8dcc4 : 0xa04a48), -0.85 + i * 0.57, 0, 0.45));
    piece.rotation.x = 0.35;
  }
  const sign = signBoard('CAFE', 1.4, 0.45, '#fff4dc', '#5a3a30', 0.8);
  add(root, sign.mesh).position.set(cx, 2.95, z1 + 0.06);

  // Two small tables outside, kept clear of the park path.
  for (const x of [13.1, 14.4]) {
    add(root, cylinder(0.3, 0.05, mat(PALETTE.metal), 8, x, 0.72, 7.25));
    add(root, cylinder(0.04, 0.72, mat(PALETTE.metal), 4, x, 0.1, 7.25));
    for (const dx of [-0.45, 0.45]) add(root, box(0.3, 0.45, 0.3, mat(PALETTE.timber), x + dx, 0.1, 7.25));
  }
  add(root, flowerPot(0xe0a0b8)).position.set(x0 - 0.3, 0.1, z0 + 0.3);

  // Flats above.
  const flats = windowMats(6);
  windows(root, '+z', z1, [cx - 0.6, cx + 0.6], [3.7], flats);
  windows(root, '-x', x0, [z0 + 1.2, cz, z1 - 1.2], [3.7], flats);
  windows(root, '+x', x1, [z0 + 1.2, cz, z1 - 1.2], [1.0, 3.7], flats);
  add(root, drainpipe(h + 0.2), -Math.PI / 2).position.set(x0 - 0.08, 0, z0 + 0.25);

  const top = h + 0.4;
  add(root, acUnit()).position.set(cx, top, cz - 1.8);
  add(root, roofVent()).position.set(cx - 0.6, top, cz + 1.2);
  add(root, railing(z1 - z0 - 0.3, 0.7), Math.PI / 2).position.set(x0 + 0.15, top, cz);
  mergeStatic(root);

  const lit = new WindowBank([cafe], 1.2, 0.3, () => 0.05);
  const homes = new WindowBank(flats, 1.1, 0.06, random);
  return {
    root,
    update(dt) {
      lit.update(dt, 0.6);
      homes.update(dt, 0.5);
    },
  };
}
