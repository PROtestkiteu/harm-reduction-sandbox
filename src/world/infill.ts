import { Group, type MeshLambertMaterial, type Object3D } from 'three';
import { PALETTE } from '../config/palette';
import type { Random } from '../sim/random';
import { WindowBank } from './animated';
import { acUnit, antenna, drainpipe, roofVent, waterTank, windowTrim } from './details';
import { awning, balcony, graffiti, laundryLine, lightPool, poster, rubbish, shopSign, shutters } from './dressing';
import { askew, bladeSign, boardedWindow, neonSign, roofClutter, scaffolding, wallClutter } from './grit';
import { add, bench, box, gableRoof, mansard, tree } from './kit';
import { BLOCKS, HALF, VENUE_RECTS, type Rect } from './layout';
import { glowMat, mat } from './materials';
import { mergeStatic } from './mergeStatic';
import { registerBuilding } from './cityBuildings';

/**
 * Ordinary city fabric for the new blocks: rows of flats and shops on a grid
 * of lots with alleys between them. Lots that overlap a service building are
 * left as yards, and anything standing in front of a service (towards the
 * camera, +x/+z) is kept low so entrances and queues stay visible.
 */

const WALLS = [0x8c5a4e, 0xa48a6c, 0x7a6a5c, 0x6e5a52, 0xb09a78, 0x6a6a5c, 0x8a7a62];
const STONE = [0x6c665c, 0x5c5850, 0x7a7266];
const ROOF_TILE = [0x6a3a30, 0x5a3a34, 0x4a4440];
/** Patch colours for replastered or bricked-in bits of facade. */
const PATCH = [0x7a6a5a, 0x5e5248, 0x8a7a66, 0x4e4a46, 0x6a5240];
const DOORS = [0x3a2a22, 0x2f4a3a, 0x4a2a2a, 0x2a3442];
const LOT = 9.5;
const ALLEY = 1.6;

/** The footpath from the centre square to the east street: people walk it, so nothing is built on it. */
const PATH_EAST: Rect = { x0: HALF, x1: 22, z0: -6, z1: -2 };
const overlaps = (a: Rect, b: Rect, pad = 0) => a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.z0 < b.z1 + pad && a.z1 > b.z0 - pad;

/** True when `q` stands between the camera and a service building or its entrance. */
function inFrontOfService(q: Rect): boolean {
  return VENUE_RECTS.some((r) => {
    const ahead = { x0: r.x0 - 2, x1: r.x1 + 16, z0: r.z0 - 2, z1: r.z1 + 16 };
    return overlaps(q, ahead) && (q.x0 >= r.x1 - 0.5 || q.z0 >= r.z1 - 0.5);
  });
}

function building(g: Object3D, q: Rect, h: number, wall: number, windows: MeshLambertMaterial[], random: Random): void {
  const w = q.x1 - q.x0;
  const d = q.z1 - q.z0;
  const cx = (q.x0 + q.x1) / 2;
  const cz = (q.z0 + q.z1) / 2;
  add(g, box(w + 0.1, 0.5, d + 0.1, mat(PALETTE.brickDark), cx, 0.12, cz));
  add(g, box(w, h, d, mat(wall), cx, 0.12, cz));
  // Stone ground floor, a little proud of the wall above.
  add(g, box(w + 0.06, 3.0, d + 0.06, mat(STONE[Math.floor(random() * STONE.length)]), cx, 0.12, cz));
  const roof = h > 12 ? (random() < 0.6 ? 'flat' : 'mansard') : (['flat', 'pitched', 'pitched', 'mansard'] as const)[Math.floor(random() * 4)];
  if (roof === 'flat') {
    // Parapet with a coping course.
    add(g, box(w + 0.22, 0.32, d + 0.22, mat(PALETTE.roofTrim), cx, h + 0.12, cz));
    add(g, box(w + 0.1, 0.55, d + 0.1, mat(wall), cx, h + 0.44, cz));
  }
  // A cornice at every floor line and a heavier one under the roof.
  for (let y = 3.2; y < h - 1; y += 3) add(g, box(w + 0.12, 0.12, d + 0.12, mat(PALETTE.plasterShade), cx, y + 0.12, cz));
  add(g, box(w + 0.3, 0.18, d + 0.3, mat(PALETTE.plasterShade), cx, h - 0.06, cz));
  let k = Math.floor(random() * windows.length);
  // Ground floor on the camera-facing sides: lit shops with awnings, signs and
  // a pool of light on the pavement; shuttered ones collect posters and tags.
  for (const [face, len] of [['+z', w], ['+x', d]] as const) {
    const rot = face === '+z' ? 0 : Math.PI / 2;
    const at = (a: number, out: number): [number, number] => (face === '+z' ? [cx + a, q.z1 + out] : [q.x1 + out, cz - a]);
    for (let a = -len / 2 + 1.2; a < len / 2 - 1; a += 3.2) {
      const mid = a + 1;
      const lit = random() < 0.45;
      const m = lit ? windows[k++ % windows.length] : mat(PALETTE.concrete);
      const [px, pz] = at(mid, 0.02);
      add(g, face === '+z' ? box(2.4, 1.9, 0.08, m, px, 0.75, pz) : box(0.08, 1.9, 2.4, m, px, 0.75, pz));
      if (lit) {
        const [ax, az] = at(mid, 0.05);
        if (random() < 0.6) add(g, askew(awning(2.6, random), random, 0.7), rot).position.set(ax, 2.75, az);
        else if (random() < 0.45) add(g, neonSign(random), rot).position.set(ax, 2.55, az + (face === '+z' ? 0.08 : 0));
        else add(g, shopSign(random), rot).position.set(ax, 2.72, az + (face === '+z' ? 0.06 : 0));
        const [lx, lz] = at(mid, 1.3);
        lightPool(g, lx, lz, face === '+z' ? 3.2 : 2.2, face === '+z' ? 2.2 : 3.2, 'window');
      } else {
        const [wx, wz] = at(mid + (random() - 0.5), 0.07);
        if (random() < 0.55) poster(g, wx, 1.5 + random() * 0.4, wz, rot, random);
        if (random() < 0.3) {
          const [gx, gz] = at(mid, 0.1);
          graffiti(g, gx, 0.9, gz, rot, random);
        }
      }
    }
  }
  // Upper floors: windows on all four sides, so the block reads from any angle.
  const shutterColour = [0x4a6a5a, 0x7a4a3a, 0x4a5a7a, 0x8a7a5a][Math.floor(random() * 4)];
  const balconyAt = random() < 0.4 ? Math.floor(random() * Math.max(1, (w - 2) / 1.9)) : -1;
  for (let y = 3.4; y + 1.3 < h; y += 3) {
    let col = 0;
    for (let a = -w / 2 + 1.1; a <= w / 2 - 0.9; a += 1.9, col++) {
      // Windows never quite line up: each sits a little off the grid, some are
      // narrower, a few are boarded or bricked in.
      const wx = cx + a + (random() - 0.5) * 0.16;
      const wy = y + (random() - 0.5) * 0.14;
      const ww = random() < 0.15 ? 0.7 : 0.9;
      const fate = random();
      if (fate < 0.06) {
        add(g, boardedWindow(ww, 1.3, random)).position.set(wx, wy, q.z1 + 0.01);
        continue;
      }
      if (fate < 0.1) {
        add(g, box(ww + 0.05, 1.3, 0.06, mat(PATCH[Math.floor(random() * PATCH.length)]), wx, wy, q.z1 + 0.02));
        continue;
      }
      add(g, box(ww, 1.3, 0.08, windows[k++ % windows.length], wx, wy, q.z1 + 0.02));
      add(g, windowTrim(ww, 1.3)).position.set(wx, wy, q.z1 + 0.02);
      add(g, box(0.9, 1.3, 0.08, windows[k++ % windows.length], cx + a, y, q.z0 - 0.02));
      if (col === balconyAt) add(g, balcony(1.5)).position.set(cx + a, y - 0.25, q.z1);
      else if (random() < 0.22) add(g, shutters(0.9, 1.3, shutterColour)).position.set(cx + a, y, q.z1);
    }
    for (let a = -d / 2 + 1.1; a <= d / 2 - 0.9; a += 1.9) {
      add(g, box(0.08, 1.3, 0.9, windows[k++ % windows.length], q.x1 + 0.02, y, cz + a));
      add(g, box(0.08, 1.3, 0.9, windows[k++ % windows.length], q.x0 - 0.02, y, cz + a));
    }
  }
  add(g, drainpipe(h)).position.set(q.x1 - 0.12, 0.12, q.z1 + 0.08);
  const top = h + 0.12;
  if (roof === 'pitched') {
    // Gable roof with the ridge along the longer side, chimneys through it.
    const alongX = w >= d;
    add(g, gableRoof(alongX ? d + 0.5 : w + 0.5, alongX ? w + 0.4 : d + 0.4, Math.min(alongX ? d : w, 9) * 0.32, mat(ROOF_TILE[Math.floor(random() * ROOF_TILE.length)])), alongX ? Math.PI / 2 : 0).position.set(cx, top, cz);
    for (let i = 0; i < 2; i++) add(g, box(0.6, 2.2, 0.6, mat(PALETTE.brickDark), cx + (alongX ? (i ? 1 : -1) * w * 0.3 : 0.6), top, cz + (alongX ? 0.6 : (i ? 1 : -1) * d * 0.3)));
  } else if (roof === 'mansard') {
    // Mansard: steep slate sides with dormer windows, a flat top.
    add(g, mansard(w + 0.3, d + 0.3, 2.4, mat(0x3c4048)), 0).position.set(cx, top, cz);
    for (let a = -w / 2 + 1.4; a < w / 2 - 1; a += 2.2) {
      add(g, box(0.9, 1.1, 0.7, mat(wall), cx + a, top + 0.5, q.z1 - 0.2));
      add(g, box(0.6, 0.7, 0.06, windows[k++ % windows.length], cx + a, top + 0.7, q.z1 + 0.16));
    }
    add(g, box(0.6, 1.4, 0.6, mat(PALETTE.brickDark), cx - w / 4, top + 2.2, cz));
  } else {
    const roll = random();
    const flatTop = top + 0.32;
    if (roll < 0.35) add(g, waterTank()).position.set(cx - w / 5, flatTop, cz);
    else if (roll < 0.7) add(g, acUnit()).position.set(cx + w / 6, flatTop, cz - d / 6);
    else add(g, roofVent()).position.set(cx, flatTop, cz + d / 5);
    if (random() < 0.4) add(g, antenna(1.4 + random())).position.set(cx + w / 4, flatTop, cz + d / 4);
    roofClutter(g, cx, cz, w, d, flatTop, random, windows[k++ % windows.length]);
  }
  // Street door with a step and a lamp beside it, on the camera-facing side.
  const doorX = cx + w / 2 - 1.0;
  add(g, box(1.1, 0.12, 0.5, mat(PALETTE.concrete), doorX, 0.12, q.z1 + 0.25));
  add(g, box(0.95, 2.2, 0.08, mat(DOORS[Math.floor(random() * DOORS.length)]), doorX, 0.24, q.z1 + 0.03));
  add(g, box(1.15, 0.12, 0.1, mat(PALETTE.frame), doorX, 2.44, q.z1 + 0.06));
  add(g, box(0.16, 0.24, 0.16, windows[k++ % windows.length], doorX + 0.75, 2.2, q.z1 + 0.1));
  // Stepped skyline: one end rises a storey higher, flush with the front,
  // with its own cornice and a row of windows (never on a pitched roof).
  if (roof !== 'pitched' && h > 5 && random() < 0.45) {
    const sw = w * (0.3 + random() * 0.25);
    const left = random() < 0.5;
    const sx = left ? cx - w / 2 + sw / 2 : cx + w / 2 - sw / 2;
    const rise = 2.6 + random() * 0.8;
    add(g, box(sw, rise, d, mat(wall), sx, h + 0.12, cz));
    add(g, box(sw + 0.22, 0.25, d + 0.22, mat(PALETTE.roofTrim), sx, h + 0.12 + rise, cz));
    for (let a = -sw / 2 + 0.7; a < sw / 2 - 0.5; a += 1.6) {
      add(g, box(0.8, 1.2, 0.07, windows[k++ % windows.length], sx + a + (random() - 0.5) * 0.12, h + 0.8, q.z1 + 0.02));
      add(g, windowTrim(0.8, 1.2)).position.set(sx + a, h + 0.8, q.z1 + 0.02);
    }
    roofClutter(g, sx, cz, sw, d, h + 0.12 + rise + 0.25, random);
  }
  // L-shaped: a lower wing pushes out at the back on one side.
  if (h > 5 && random() < 0.4) {
    const ww = w * (0.35 + random() * 0.2);
    // Shallow enough to stay inside the 1.6 m alley behind.
    const wd = 0.8 + random() * 0.5;
    const wx = random() < 0.5 ? cx - w / 2 + ww / 2 : cx + w / 2 - ww / 2;
    const wh = Math.max(3.2, h * (0.4 + random() * 0.3));
    add(g, box(ww, wh, wd, mat(WALLS[Math.floor(random() * WALLS.length)]), wx, 0.12, q.z0 - wd / 2 + 0.05));
    add(g, box(ww + 0.18, 0.22, wd + 0.18, mat(PALETTE.roofTrim), wx, wh + 0.12, q.z0 - wd / 2 + 0.05));
    add(g, box(0.9, 1.2, 0.07, windows[k++ % windows.length], wx, Math.min(wh - 1.6, 3.7), q.z0 - wd + 0.02));
  }
  // Massing: break the box. A set-back top floor, bay windows jutting from
  // the facade, a rooftop shed under a tarp.
  if (h > 6 && random() < 0.4) {
    const sw = w * (0.45 + random() * 0.25);
    const sx = cx + (random() - 0.5) * (w - sw);
    add(g, box(sw, 2.7, d * 0.6, mat(wall), sx, h + 0.12, cz - d * 0.15));
    add(g, box(sw + 0.2, 0.2, d * 0.6 + 0.2, mat(PALETTE.roofTrim), sx, h + 2.82, cz - d * 0.15));
    for (let a = -sw / 2 + 0.8; a < sw / 2 - 0.5; a += 1.7) add(g, box(0.8, 1.2, 0.06, windows[k++ % windows.length], sx + a, h + 0.9, cz - d * 0.15 + d * 0.3 + 0.03));
  }
  if (h > 6 && random() < 0.35) {
    const bayX = cx + (random() - 0.5) * (w - 2.4);
    const bayH = Math.min(h - 3.8, 3 * (1 + Math.floor(random() * 2)));
    add(g, box(1.7, bayH, 0.6, mat(wall), bayX, 3.3, q.z1 + 0.3));
    add(g, box(1.9, 0.14, 0.75, mat(PALETTE.plasterShade), bayX, 3.3 + bayH, q.z1 + 0.32));
    for (let y = 3.7; y < 3.3 + bayH - 1; y += 3) {
      add(g, box(1.2, 1.25, 0.06, windows[k++ % windows.length], bayX, y, q.z1 + 0.62));
      add(g, box(0.06, 1.25, 0.4, windows[k++ % windows.length], bayX + 0.86, y, q.z1 + 0.3));
    }
  }
  if (roof === 'flat' && random() < 0.35) {
    const shx = cx + (random() - 0.5) * (w - 3);
    const shz = cz + (random() - 0.5) * (d - 3);
    add(g, box(2.2, 1.6, 1.6, mat(0x5a5048), shx, h + 0.12, shz));
    const tarp = add(g, box(2.5, 0.08, 1.9, mat(random() < 0.5 ? 0x3a5a8a : 0x6a6a3a), shx, h + 1.72, shz));
    tarp.rotation.z = (random() - 0.5) * 0.25;
    tarp.rotation.x = (random() - 0.5) * 0.2;
  }
  // Pipes, plant, ivy and wiring on the two faces the camera sees.
  add(g, wallClutter(w, h, random)).position.set(cx, 0.12, q.z1);
  add(g, wallClutter(d, h, random), Math.PI / 2).position.set(q.x1, 0.12, cz);
  // Patched plaster and stains break up the facade.
  for (let i = 0; i < 2 + Math.floor(random() * 3); i++) {
    const pw = 0.8 + random() * 2.2;
    const ph = 0.6 + random() * 1.6;
    add(g, box(pw, ph, 0.03, mat(PATCH[Math.floor(random() * PATCH.length)]), cx + (random() - 0.5) * (w - pw), 3.4 + random() * Math.max(0.5, h - 5), q.z1 + 0.015));
  }
  // A projecting sign on some buildings, scaffolding on a few.
  if (random() < 0.3 && h > 6) add(g, bladeSign(random)).position.set(cx + w / 2 - 0.6, 3.6 + random() * 1.5, q.z1);
  if (random() < 0.08 && h > 6) add(g, scaffolding(w * 0.7, h - 1, random)).position.set(cx - w * 0.1, 0.12, q.z1);
  // Rubbish waiting for collection in the alley beside the building.
  if (random() < 0.45) rubbish(g, q.x0 - 0.8, cz + (random() - 0.5) * d * 0.6, random);
}

/** Fills one block. Returns the window bank that animates its lights. */
/**
 * A small pocket park on one lot: a lawn crossed by gravel paths, trees, benches facing the
 * middle and a low railing round it. The city's own little green, where a building would be.
 */
function pocketPark(g: Object3D, q: Rect, random: Random): void {
  const cx = (q.x0 + q.x1) / 2;
  const cz = (q.z0 + q.z1) / 2;
  const w = q.x1 - q.x0;
  const d = q.z1 - q.z0;
  add(g, box(w, 0.13, d, mat(PALETTE.grass), cx, 0, cz));
  const gravel = mat(PALETTE.gravel);
  add(g, box(w, 0.135, 1.3, gravel, cx, 0, cz));
  add(g, box(1.3, 0.135, d, gravel, cx, 0, cz));
  // A tree in each quarter, set in from the corners.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    if (random() < 0.2) continue;
    add(g, tree((Math.floor(random() * 3)) as 0 | 1 | 2, 0.85 + random() * 0.35)).position.set(cx + sx * w * 0.27, 0.13, cz + sz * d * 0.27);
  }
  // Benches either side of the paths' crossing, facing it.
  add(g, bench(), Math.PI / 2).position.set(cx - 1.6, 0.13, cz + 1.4);
  add(g, bench(), -Math.PI / 2).position.set(cx + 1.6, 0.13, cz - 1.4);
  // A low railing on the long sides, open where the paths come in.
  const rail = mat(PALETTE.metal);
  const half = w / 2 - 0.8;
  for (const z of [q.z0 + 0.1, q.z1 - 0.1]) {
    add(g, box(half, 0.5, 0.05, rail, q.x0 + half / 2, 0.13, z));
    add(g, box(half, 0.5, 0.05, rail, q.x1 - half / 2, 0.13, z));
  }
}

function fillBlock(scene: Object3D, block: Rect, windows: MeshLambertMaterial[], random: Random, park = false): void {
  const g = add(scene, new Group());
  const centre: Rect = { x0: -HALF, x1: HALF, z0: -HALF, z1: HALF };
  // Lot widths differ per block and per launch, so the same block is cut into
  // two wide buildings one time and four narrow ones the next.
  const lotX = LOT * (0.7 + random() * 0.65);
  const lotZ = LOT * (0.7 + random() * 0.65);
  const span = (a: number, b: number, lot: number) => Math.max(1, Math.floor((b - a + ALLEY) / (lot + ALLEY)));
  const nx = span(block.x0, block.x1, lotX);
  const nz = span(block.z0, block.z1, lotZ);
  const cw = (block.x1 - block.x0 - ALLEY * (nx + 1)) / nx;
  const cd = (block.z1 - block.z0 - ALLEY * (nz + 1)) / nz;
  // In a block chosen for a pocket park, one of its lots (if it is big enough) becomes the park.
  let parkLot = park ? Math.floor(random() * nx * nz) : -1;
  let lot = -1;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const q: Rect = {
        x0: block.x0 + ALLEY + i * (cw + ALLEY),
        x1: block.x0 + ALLEY + i * (cw + ALLEY) + cw,
        z0: block.z0 + ALLEY + j * (cd + ALLEY),
        z1: block.z0 + ALLEY + j * (cd + ALLEY) + cd,
      };
      // A lot that touches a service's plot (or the centre square) is trimmed to
      // its largest free part rather than dropped, so no block is left bare.
      let r: Rect | null = q;
      for (const taken of [centre, PATH_EAST, ...VENUE_RECTS]) {
        if (!r || !overlaps(r, taken, 0.8)) continue;
        const parts: Rect[] = [
          { ...r, x1: Math.min(r.x1, taken.x0 - 0.8) },
          { ...r, x0: Math.max(r.x0, taken.x1 + 0.8) },
          { ...r, z1: Math.min(r.z1, taken.z0 - 0.8) },
          { ...r, z0: Math.max(r.z0, taken.z1 + 0.8) },
        ].filter((p) => p.x1 - p.x0 >= 4.5 && p.z1 - p.z0 >= 4.5);
        r = parts.sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0] ?? null;
      }
      lot++;
      if (!r) { if (lot === parkLot) parkLot++; continue; }
      q.x0 = r.x0; q.x1 = r.x1; q.z0 = r.z0; q.z1 = r.z1;
      if (lot === parkLot) {
        if (q.x1 - q.x0 >= 7 && q.z1 - q.z0 >= 7) { pocketPark(g, q, random); continue; }
        parkLot++;
      }
      if (random() < 0.07) {
        // Now and then a yard with a tree instead of a building.
        add(g, box(q.x1 - q.x0, 0.13, q.z1 - q.z0, mat(PALETTE.grassDark), (q.x0 + q.x1) / 2, 0, (q.z0 + q.z1) / 2));
        add(g, tree((Math.floor(random() * 3)) as 0 | 1 | 2, 0.9 + random() * 0.3)).position.set((q.x0 + q.x1) / 2, 0.13, (q.z0 + q.z1) / 2);
        continue;
      }
      const low = inFrontOfService(q);
      // Rooflines are ragged: storeys plus a little, never a neat grid of heights.
      const h = low ? 3.2 + random() * 1.4 : 6.2 + Math.floor(random() * 3) * 3 + (random() - 0.3) * 0.8;
      // Each building sits in its own frame, turned a fraction of a degree off
      // the street grid, the way blocks get rebuilt piecemeal.
      const bx = (q.x0 + q.x1) / 2;
      const bz = (q.z0 + q.z1) / 2;
      const frame = add(g, new Group());
      frame.position.set(bx, 0, bz);
      frame.rotation.y = (random() - 0.5) * 0.03;
      const local: Rect = { x0: q.x0 - bx, x1: q.x1 - bx, z0: q.z0 - bz, z1: q.z1 - bz };
      building(frame, local, h, WALLS[Math.floor(random() * WALLS.length)], windows, random);
      registerBuilding(q.x0, q.x1, q.z0, q.z1, h);
      // Washing strung across the alley to the next building along.
      if (!low && h > 6 && i < nx - 1 && random() < 0.35) {
        const z = q.z0 + 1 + random() * (cd - 2);
        laundryLine(g, q.x1, z, q.x1 + ALLEY, z, 4.6 + Math.floor(random() * 2) * 3, random);
      }
    }
  }
  mergeStatic(g);
}

/**
 * A block of the same detailed fabric anywhere in the city beyond the
 * district: lots, alleys and buildings between `minH` and `maxH` tall. No
 * service lots to avoid out there. Buildings register for picking.
 */
export function fillCityBlock(scene: Object3D, block: Rect, windows: MeshLambertMaterial[], random: Random, minH: number, maxH: number, merge = true): void {
  const g = add(scene, new Group());
  // Lot widths differ per block and per launch, so the same block is cut into
  // two wide buildings one time and four narrow ones the next.
  const lotX = LOT * (0.7 + random() * 0.65);
  const lotZ = LOT * (0.7 + random() * 0.65);
  const span = (a: number, b: number, lot: number) => Math.max(1, Math.floor((b - a + ALLEY) / (lot + ALLEY)));
  const nx = span(block.x0, block.x1, lotX);
  const nz = span(block.z0, block.z1, lotZ);
  const cw = (block.x1 - block.x0 - ALLEY * (nx + 1)) / nx;
  const cd = (block.z1 - block.z0 - ALLEY * (nz + 1)) / nz;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const q: Rect = {
        x0: block.x0 + ALLEY + i * (cw + ALLEY),
        x1: block.x0 + ALLEY + i * (cw + ALLEY) + cw,
        z0: block.z0 + ALLEY + j * (cd + ALLEY),
        z1: block.z0 + ALLEY + j * (cd + ALLEY) + cd,
      };
      if (random() < 0.1) {
        add(g, box(q.x1 - q.x0, 0.13, q.z1 - q.z0, mat(PALETTE.grassDark), (q.x0 + q.x1) / 2, 0, (q.z0 + q.z1) / 2));
        add(g, tree((Math.floor(random() * 3)) as 0 | 1 | 2, 0.9 + random() * 0.3)).position.set((q.x0 + q.x1) / 2, 0.13, (q.z0 + q.z1) / 2);
        continue;
      }
      const storeys = Math.max(1, Math.round((minH + random() * (maxH - minH)) / 3));
      const h = 3.2 + (storeys - 1) * 3 + (random() - 0.3) * 0.6;
      const bx = (q.x0 + q.x1) / 2;
      const bz = (q.z0 + q.z1) / 2;
      const frame = add(g, new Group());
      // Out in the city buildings sit a little off the grid and a degree or two askew.
      frame.position.set(bx + (random() - 0.5) * 0.8, 0, bz + (random() - 0.5) * 0.8);
      frame.rotation.y = (random() - 0.5) * 0.06;
      building(frame, { x0: q.x0 - bx, x1: q.x1 - bx, z0: q.z0 - bz, z1: q.z1 - bz }, h, WALLS[Math.floor(random() * WALLS.length)], windows, random);
      registerBuilding(q.x0, q.x1, q.z0, q.z1, h);
    }
  }
  // The caller may merge many blocks together instead.
  if (merge) mergeStatic(g);
}

/**
 * Infill for the eight new blocks. All of them share one bank of window
 * lights, so the whole district's ordinary windows cost a dozen materials.
 */
export function buildInfill(scene: Object3D, random: Random): WindowBank[] {
  const windows = Array.from({ length: 12 }, (_, i) => glowMat(PALETTE.glassDark, i % 5 === 4 ? PALETTE.coolWindow : PALETTE.warmWindow, 0.2));
  // One or two more pocket parks besides the centre one, in different blocks each launch.
  const names = Object.keys(BLOCKS).filter((n) => n !== 'cm');
  const parks = new Set<string>();
  const want = random() < 0.5 ? 1 : 2;
  while (parks.size < want) parks.add(names[Math.floor(random() * names.length)]);
  for (const [name, block] of Object.entries(BLOCKS)) fillBlock(scene, block, windows, random, parks.has(name));
  return [new WindowBank(windows, 1.0, 0.05, random)];
}
