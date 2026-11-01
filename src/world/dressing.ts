import {
  AdditiveBlending,
  CanvasTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Object3D,
} from 'three';
import { PALETTE } from '../config/palette';
import type { Random } from '../sim/random';
import { add, box, cylinder, signBoard } from './kit';
import { mat } from './materials';

/**
 * Set dressing that makes streets read as lived-in and drawn rather than
 * blocky: light pools on the ground, puddles, posters and graffiti, rubbish,
 * awnings, shop signs, balconies, laundry. Everything is cheap: shared
 * materials and textures, merged by the caller where static.
 */

// Light pools: soft radial glow decals instead of real lights, which would
// cost every pixel of the scene.

function radialTexture(inner: string, outer: string): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  return tex;
}

const poolGeo = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
let lampPoolMat: MeshBasicMaterial | null = null;
let windowPoolMat: MeshBasicMaterial | null = null;

function poolMaterial(kind: 'lamp' | 'window'): MeshBasicMaterial {
  const make = (inner: string, outer: string) =>
    new MeshBasicMaterial({ map: radialTexture(inner, outer), transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 1 });
  if (kind === 'lamp') return (lampPoolMat ??= make('rgba(255,196,120,0.55)', 'rgba(255,160,80,0.18)'));
  return (windowPoolMat ??= make('rgba(255,200,130,0.32)', 'rgba(255,170,100,0.1)'));
}

/** Pools of lamplight fade in daylight; window spill mostly goes too. */
export function setPoolDaylight(day: number): void {
  if (lampPoolMat) lampPoolMat.opacity = 1 - day;
  if (windowPoolMat) windowPoolMat.opacity = 1 - 0.85 * day;
}

/** A warm pool of light on the ground, as if cast by a lamp or a lit shopfront. */
export function lightPool(parent: Object3D, x: number, z: number, w: number, d: number, kind: 'lamp' | 'window' = 'lamp'): void {
  const m = new Mesh(poolGeo, poolMaterial(kind));
  m.scale.set(w, 1, d);
  m.position.set(x, 0.135, z);
  m.renderOrder = 1;
  parent.add(m);
}

// Puddles: dark, slightly blue, a touch glossy.

// Posters and graffiti: small canvas textures, a shared handful reused.

const posterTextures: CanvasTexture[] = [];
function posterTexture(random: Random): CanvasTexture {
  if (posterTextures.length < 8) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 44;
    const ctx = canvas.getContext('2d')!;
    const bgs = ['#d8c8a0', '#c85a3a', '#3a5a7a', '#e0b040', '#5a7a5a', '#e8e0d0', '#7a3a5a', '#2a2a30'];
    const fgs = ['#2a2420', '#f0e6d0', '#e0b040', '#c85a3a'];
    ctx.fillStyle = bgs[posterTextures.length % bgs.length];
    ctx.fillRect(0, 0, 32, 44);
    ctx.fillStyle = fgs[Math.floor(random() * fgs.length)];
    // A bold shape and lines of "text".
    if (random() < 0.5) ctx.fillRect(4, 4, 24, 16);
    else { ctx.beginPath(); ctx.arc(16, 13, 9, 0, Math.PI * 2); ctx.fill(); }
    for (let y = 24; y < 40; y += 4) ctx.fillRect(4, y, 10 + Math.floor(random() * 14), 2);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    posterTextures.push(tex);
  }
  return posterTextures[Math.floor(random() * posterTextures.length)];
}

const posterGeo = new PlaneGeometry(0.62, 0.86);
const posterMats = new Map<CanvasTexture, MeshLambertMaterial>();

/** A paper poster flat on a wall. `rot` turns it to face the wall's outward side. */
export function poster(parent: Object3D, x: number, y: number, z: number, rot: number, random: Random): void {
  const tex = posterTexture(random);
  let m = posterMats.get(tex);
  if (!m) { m = new MeshLambertMaterial({ map: tex }); posterMats.set(tex, m); }
  const mesh = new Mesh(posterGeo, m);
  mesh.position.set(x, y, z);
  mesh.rotation.set(0, rot, (random() - 0.5) * 0.08);
  mesh.receiveShadow = true;
  parent.add(mesh);
}

let graffitiTex: CanvasTexture[] | null = null;
function graffitiTextures(random: Random): CanvasTexture[] {
  if (graffitiTex) return graffitiTex;
  graffitiTex = ['#e0e0d8', '#e06a4a', '#5ab0c8', '#e0c050'].map((colour) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 48;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Looping tag strokes.
    for (let s = 0; s < 3; s++) {
      ctx.beginPath();
      let x = 8 + s * 38;
      ctx.moveTo(x, 34);
      for (let i = 0; i < 5; i++) {
        x += 6 + random() * 6;
        ctx.quadraticCurveTo(x - 4, 4 + random() * 10, x, 20 + random() * 18);
      }
      ctx.stroke();
    }
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  });
  return graffitiTex;
}

const graffitiGeo = new PlaneGeometry(2.2, 0.82);
const graffitiMats = new Map<CanvasTexture, MeshLambertMaterial>();

/** A spray-painted tag low on a wall. */
export function graffiti(parent: Object3D, x: number, y: number, z: number, rot: number, random: Random): void {
  const list = graffitiTextures(random);
  const tex = list[Math.floor(random() * list.length)];
  let m = graffitiMats.get(tex);
  if (!m) { m = new MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false }); graffitiMats.set(tex, m); }
  const mesh = new Mesh(graffitiGeo, m);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rot;
  parent.add(mesh);
}

// Street clutter.

export function rubbish(parent: Object3D, x: number, z: number, random: Random): void {
  const g = add(parent, new Group());
  g.position.set(x, 0.12, z);
  const bag = mat(0x1e1e22);
  const n = 2 + Math.floor(random() * 3);
  for (let i = 0; i < n; i++) {
    const s = 0.32 + random() * 0.18;
    add(g, box(s, s * 0.85, s, bag, (random() - 0.5) * 0.8, 0, (random() - 0.5) * 0.6)).rotation.y = random() * Math.PI;
  }
  if (random() < 0.5) add(g, box(0.5, 0.36, 0.4, mat(0x7a5a45), 0.5, 0, 0.3)).rotation.y = random();
  if (random() < 0.4) add(g, cylinder(0.24, 0.85, mat(0x3f5e57), 8, -0.6, 0, -0.2));
}

const awningColours = [[0x9a3a34, 0xe8dcc8], [0x2f5f53, 0xe0d6c0], [0x3a4a6a, 0xd8cdb6], [0x8a6a2a, 0xece0c8]] as const;

/** A striped shop awning sloping out from a wall, facing +z in local space. */
export function awning(w: number, random: Random): Group {
  const g = new Group();
  const [a, b] = awningColours[Math.floor(random() * awningColours.length)];
  const stripes = Math.max(3, Math.round(w / 0.4));
  for (let i = 0; i < stripes; i++) {
    const s = add(g, box(w / stripes, 0.05, 1.2, mat(i % 2 ? a : b), -w / 2 + (i + 0.5) * (w / stripes), 0, 0.6));
    s.rotation.x = 0.32;
  }
  add(g, box(w, 0.22, 0.04, mat(a), 0, -0.2, 1.16));
  return g;
}

const SHOP_NAMES = ['BAR', 'KIOSK', 'BOOKS', 'TAILOR', 'LAUNDRY', 'BAKERY', 'PAWN', 'HARDWARE', 'CAFE', 'FLOWERS', 'RADIO', 'PRINTS'];
const SIGN_STYLES = [['#f0e6d0', '#5a2a24'], ['#1e1e22', '#d8c090'], ['#e8f0f0', '#2f4f5f'], ['#f6e8c8', '#3a5a3a']] as const;

/** A shop name board above a shopfront, facing +z in local space. */
export function shopSign(random: Random): Group {
  const g = new Group();
  const name = SHOP_NAMES[Math.floor(random() * SHOP_NAMES.length)];
  const [fg, bg] = SIGN_STYLES[Math.floor(random() * SIGN_STYLES.length)];
  const sign = signBoard(name, Math.max(1.4, name.length * 0.28), 0.5, fg, bg, 0.25);
  add(g, sign.mesh);
  return g;
}

/** A small balcony: slab and railing, facing +z in local space. */
export function balcony(w: number): Group {
  const g = new Group();
  add(g, box(w, 0.12, 0.8, mat(PALETTE.concrete), 0, 0, 0.4));
  const rail = mat(PALETTE.metal);
  add(g, box(w, 0.05, 0.05, rail, 0, 0.9, 0.78));
  for (let x = -w / 2; x <= w / 2 + 0.01; x += 0.2) add(g, box(0.03, 0.9, 0.03, rail, x, 0.12, 0.78));
  add(g, box(0.05, 0.05, 0.8, rail, -w / 2, 0.9, 0.4));
  add(g, box(0.05, 0.05, 0.8, rail, w / 2, 0.9, 0.4));
  return g;
}

/** Window shutters either side of a window, facing +z in local space. */
export function shutters(w: number, h: number, colour: number): Group {
  const g = new Group();
  for (const s of [-1, 1]) add(g, box(w * 0.5, h, 0.05, mat(colour), s * (w * 0.5 + 0.06 + w * 0.25), 0, 0.05));
  return g;
}

/** A sagging line of washing across a gap, between two points at height `y`. */
export function laundryLine(parent: Object3D, ax: number, az: number, bx: number, bz: number, y: number, random: Random): void {
  const g = add(parent, new Group());
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  g.position.set(ax, y, az);
  g.rotation.y = Math.atan2(dx, dz);
  add(g, box(0.02, 0.02, len, mat(0x2a2a2a), 0, 0, len / 2));
  const cloth = [0xe8e0d0, 0x9a4a4a, 0x4a6a8a, 0xd8c070, 0x6a8a6a];
  for (let t = 0.6; t < len - 0.4; t += 0.5 + random() * 0.4) {
    const sag = -Math.sin((t / len) * Math.PI) * 0.25;
    const piece = add(g, box(0.04, 0.35 + random() * 0.3, 0.35 + random() * 0.15, mat(cloth[Math.floor(random() * cloth.length)]), 0, sag - 0.5, t));
    piece.rotation.y = Math.PI / 2;
  }
}
