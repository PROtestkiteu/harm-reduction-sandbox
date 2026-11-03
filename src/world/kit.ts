import type { Season } from '../config/seasons';
import {
  AdditiveBlending,
  BoxGeometry,
  LatheGeometry,
  MeshBasicMaterial,
  QuadraticBezierCurve3,
  TubeGeometry,
  Vector2,
  Vector3,
  ExtrudeGeometry,
  Shape,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  Material,
  Mesh,
  MeshLambertMaterial,
  NearestFilter,
  Object3D,
  PlaneGeometry,
  PointLight,
  SRGBColorSpace,
} from 'three';
import { PALETTE } from '../config/palette';
import { glowMat, mat } from './materials';
import { solid } from './solids';

/**
 * Modular asset kit. One world unit is one metre, every piece has its pivot at
 * ground level (y = 0 at its base) and geometries are cached by dimensions.
 */
const geometryCache = new Map<string, BufferGeometry>();

function cachedGeometry(key: string, make: () => BufferGeometry): BufferGeometry {
  let g = geometryCache.get(key);
  if (!g) {
    g = make();
    geometryCache.set(key, g);
  }
  return g;
}

/** Box with its pivot at the centre of its base. */
export function box(w: number, h: number, d: number, material: Material, x = 0, y = 0, z = 0): Mesh {
  // Centimetre steps keep the geometry cache small when sizes are randomised.
  w = Math.round(w * 100) / 100;
  h = Math.round(h * 100) / 100;
  d = Math.round(d * 100) / 100;
  // Large faces get a few segments so roof edges can sag gently under the
  // material's bend; small parts stay at one segment.
  const seg = (v: number) => (v > 4 ? Math.min(4, Math.round(v / 3)) : 1);
  const geo = cachedGeometry(`b${w}|${h}|${d}`, () => new BoxGeometry(w, h, d, seg(w), seg(h), seg(d)).translate(0, h / 2, 0));
  const m = new Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function cylinder(r: number, h: number, material: Material, segments = 6, x = 0, y = 0, z = 0): Mesh {
  const geo = cachedGeometry(`c${r}|${h}|${segments}`, () =>
    new CylinderGeometry(r, r, h, segments).translate(0, h / 2, 0),
  );
  const m = new Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function add<T extends Object3D>(parent: Object3D, child: T, rotY = 0): T {
  child.rotation.y = rotY;
  parent.add(child);
  return child;
}

// Ground-level props

// Trees: a tapering trunk and branches carrying many small cards of leaves
// with ragged, alpha-tested edges, so crowns have a broken silhouette and
// cast dappled shadows. Three leaf colours shared by every tree.

/** Leaf colours per season: three tints for the broadleaf card materials. */
const FOLIAGE: Record<Season, string[][]> = {
  spring: [['#6f9a48', '#8db85a', '#557a3a'], ['#7aa650', '#9cc468', '#5e8a40'], ['#e8b8c8', '#f4d0dc', '#c890a8']],
  summer: [['#3f5e30', '#56763c', '#2e4826'], ['#4a6a36', '#62824a', '#38522c'], ['#56662e', '#6e7a3e', '#424e28']],
  autumn: [['#4f6e3c', '#6e8a4c', '#3a5430'], ['#a8702c', '#c48a3a', '#7e4e22'], ['#b8542a', '#d0743a', '#8a3a1e']],
  winter: [['#4f6e3c', '#6e8a4c', '#3a5430'], ['#5e7e44', '#7e9a56', '#46603a'], ['#6a7238', '#8a8a4a', '#4c5630']],
};
const EVERGREEN = [['#2e4a34', '#3e5e40', '#24402c']];

function leafCanvas(colours: string[], seedBase: number, canvas = document.createElement('canvas')): HTMLCanvasElement {
  const size = 64;
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  let seed = seedBase;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 60; i++) {
    // Leaves cluster towards the middle of the card and thin out at the edge.
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * size * 0.42;
    ctx.fillStyle = colours[i % colours.length];
    ctx.beginPath();
    ctx.ellipse(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r, 3 + rnd() * 3, 1.6 + rnd() * 1.6, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

function cardMaterial(colours: string[], seedBase: number): MeshLambertMaterial {
  const tex = new CanvasTexture(leafCanvas(colours, seedBase));
  tex.colorSpace = SRGBColorSpace;
  return new MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: DoubleSide });
}

let leafMats: MeshLambertMaterial[] | null = null;
let evergreenMats: MeshLambertMaterial[] | null = null;
function leafMaterials(): MeshLambertMaterial[] {
  return (leafMats ??= FOLIAGE.autumn.map((c, t) => cardMaterial(c, 17 + t * 31)));
}
function evergreenMaterials(): MeshLambertMaterial[] {
  return (evergreenMats ??= EVERGREEN.map((c, t) => cardMaterial(c, 101 + t * 31)));
}

/**
 * Repaints the broadleaf trees for a season: blossom and fresh green in
 * spring, deep green in summer, turning colours in autumn, bare branches in
 * winter. Conifers keep their own evergreen cards. Cheap: three small canvases.
 */
export function setFoliageSeason(season: Season): void {
  leafMaterials().forEach((m, t) => {
    m.visible = season !== 'winter';
    if (!m.visible) return;
    leafCanvas(FOLIAGE[season][t], 17 + t * 31, m.map!.image as HTMLCanvasElement);
    m.map!.needsUpdate = true;
  });
}

const leafCard = new PlaneGeometry(1.1, 1.1);

/** variant 0: full broadleaf, 1: tall and narrow, 2: conifer, 3: sparse and half-bare. */
export function tree(variant: 0 | 1 | 2 | 3 = 0, scale = 1): Group {
  const g = new Group();
  const bark = mat(PALETTE.trunk);
  const trunkH = (variant === 1 ? 2.6 : 2.0) * scale;
  const trunk = add(g, new Mesh(cachedGeometry(`trunk${trunkH}|${scale}`, () => new CylinderGeometry(0.08 * scale, 0.15 * scale, trunkH, 8).translate(0, trunkH / 2, 0)), bark));
  trunk.castShadow = true;
  // Seeded per call from position-independent counters so trees differ.
  let seed = (treeCount++ * 9301 + 49297) % 233280;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const leaves = variant === 2 ? evergreenMaterials() : leafMaterials();
  const crownY = trunkH * 0.85;
  const radius = (variant === 1 ? 1.0 : variant === 2 ? 1.2 : 1.5) * scale;
  const height = (variant === 1 ? 3.2 : variant === 2 ? 3.6 : 2.4) * scale;
  // Branches reaching up and out from the top of the trunk.
  const branches = variant === 2 ? 0 : variant === 3 ? 6 : 4;
  for (let i = 0; i < branches; i++) {
    const a = (i / branches) * Math.PI * 2 + rnd();
    const len = (0.9 + rnd() * 0.7) * scale;
    const b = add(g, new Mesh(cachedGeometry(`branch${len}`, () => new CylinderGeometry(0.025 * scale, 0.06 * scale, len, 5).translate(0, len / 2, 0)), bark));
    b.position.set(0, crownY - 0.3 * scale, 0);
    b.rotation.set(0.7 + rnd() * 0.4, a, 0, 'YXZ');
    b.castShadow = true;
  }
  const cards = variant === 3 ? 18 : variant === 2 ? 44 : 64;
  for (let i = 0; i < cards; i++) {
    const u = rnd();
    const a = rnd() * Math.PI * 2;
    let x: number, y: number, z: number;
    if (variant === 2) {
      // Conifer: cards on a cone, wide at the bottom.
      const t = rnd();
      const r = radius * (1 - t) * (0.6 + 0.4 * rnd());
      x = Math.cos(a) * r; z = Math.sin(a) * r; y = trunkH * 0.4 + t * height;
    } else {
      // Broadleaf: an uneven ellipsoid, denser near the surface.
      const r = Math.sqrt(0.35 + 0.65 * u);
      const phi = Math.acos(2 * rnd() - 1);
      x = Math.sin(phi) * Math.cos(a) * radius * r;
      z = Math.sin(phi) * Math.sin(a) * radius * r;
      y = crownY + height * 0.5 + Math.cos(phi) * height * 0.5 * r;
    }
    const card = new Mesh(leafCard, leaves[Math.floor(rnd() * leaves.length)]);
    const s = (0.8 + rnd() * 0.7) * scale * (variant === 3 ? 0.8 : 1);
    card.scale.set(s, s, s);
    card.position.set(x, y, z);
    card.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
    card.castShadow = true;
    card.receiveShadow = true;
    g.add(card);
  }
  return solid(g, 0.45 * scale + 0.1);
}
let treeCount = 0;

export function bench(): Group {
  const g = new Group();
  const wood = mat(PALETTE.bench);
  const metal = mat(PALETTE.metal);
  add(g, box(1.6, 0.08, 0.42, wood, 0, 0.42, 0));
  add(g, box(1.6, 0.36, 0.07, wood, 0, 0.5, -0.2));
  add(g, box(0.07, 0.42, 0.4, metal, -0.7, 0, 0));
  add(g, box(0.07, 0.42, 0.4, metal, 0.7, 0, 0));
  return solid(g, 1.65, 0.5);
}

export function bin(): Group {
  const g = new Group();
  add(g, cylinder(0.26, 0.85, mat(PALETTE.bin), 6));
  add(g, cylinder(0.29, 0.08, mat(PALETTE.metal), 6, 0, 0.85, 0));
  return solid(g, 0.6);
}

export function planter(w = 1.6, d = 0.6): Group {
  const g = new Group();
  add(g, box(w, 0.5, d, mat(PALETTE.concrete)));
  // Evergreen shrubs: loose clusters of leaf cards along the planter.
  const leaves = evergreenMaterials();
  const n = Math.round(w / 0.25);
  for (let i = 0; i < n; i++) {
    const card = new Mesh(leafCard, leaves[i % leaves.length]);
    card.position.set(-w / 2 + 0.15 + (i / n) * (w - 0.3), 0.6 + (i % 3) * 0.12, ((i * 7) % 5) / 5 * d * 0.5 - d * 0.25);
    card.rotation.set(i * 1.3, i * 2.1, i * 0.7);
    card.scale.setScalar(0.55);
    card.castShadow = true;
    g.add(card);
  }
  return solid(g, w, d);
}

export function bollard(): Group {
  const g = new Group();
  g.add(cylinder(0.08, 0.75, mat(PALETTE.metal), 5));
  return solid(g, 0.2);
}

export interface StreetLight {
  group: Group;
  light: PointLight;
}

const lampGlows = new Map<number, MeshLambertMaterial>();
let coneMat: MeshBasicMaterial | null = null;

/** The faint cone of light under every lamp, brighter as the night deepens. */
function lampCone(): MeshBasicMaterial {
  if (coneMat) return coneMat;
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(255,214,150,0.35)');
  grad.addColorStop(0.35, 'rgba(255,196,130,0.08)');
  grad.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 64);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  coneMat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, forceSinglePass: true, opacity: 0.15 });
  return coneMat;
}

/** Scales the lamp light cones with the night (0 dusk, 1 deep night). */
export function setLampNight(night: number, day = 0): void {
  // A faint haze, never a spotlight; street lights are off in daylight.
  lampCone().opacity = (0.12 + 0.2 * night) * (1 - day);
  for (const m of lampGlows.values()) m.emissiveIntensity = 1.8 * (1 - 0.9 * day);
}

/**
 * Street light with a curved arm reaching towards `armDir` (+1 or -1 along
 * local x): a cast base, tapering pole with a collar, a moulded hood with a
 * glowing bulb, and a soft cone of light beneath it.
 */
export function streetLight(armDir = 1, color: number = PALETTE.lampGlow): StreetLight {
  const g = new Group();
  const metal = mat(0x2e302e);
  const base = add(g, new Mesh(cachedGeometry('lampBase', () => lathe([[0.001, 0], [0.21, 0], [0.21, 0.28], [0.14, 0.38], [0.11, 0.62], [0.001, 0.62]])), metal));
  base.castShadow = true;
  add(g, new Mesh(cachedGeometry('lampPole', () => new CylinderGeometry(0.055, 0.085, 3.8, 10).translate(0, 0.6 + 1.9, 0)), metal)).castShadow = true;
  add(g, new Mesh(cachedGeometry('lampCollar', () => new CylinderGeometry(0.1, 0.1, 0.1, 10).translate(0, 2.55, 0)), metal));
  const arm = add(g, new Mesh(cachedGeometry(`lampArm${armDir}`, () => new TubeGeometry(new QuadraticBezierCurve3(new Vector3(0, 4.3, 0), new Vector3(armDir * 0.1, 4.8, 0), new Vector3(armDir * 0.85, 4.32, 0)), 12, 0.035, 6)), metal));
  arm.castShadow = true;
  const hood = add(g, new Mesh(cachedGeometry('lampHood', () => lathe([[0.001, 0.22], [0.08, 0.2], [0.2, 0.1], [0.25, 0.0], [0.23, -0.02], [0.001, -0.02]])), metal));
  hood.position.set(armDir * 0.85, 4.1, 0);
  hood.castShadow = true;
  let lamp = lampGlows.get(color);
  if (!lamp) { lamp = glowMat(0xfff3d6, color, 1.8); lampGlows.set(color, lamp); }
  add(g, new Mesh(cachedGeometry('lampBulb', () => new CylinderGeometry(0.17, 0.17, 0.04, 12)), lamp)).position.set(armDir * 0.85, 4.07, 0);
  const cone = new Mesh(cachedGeometry('lampCone', () => new CylinderGeometry(0.16, 1.7, 3.95, 16, 1, true).translate(0, 4.05 - 3.95 / 2, 0)), lampCone());
  cone.position.x = armDir * 0.85;
  cone.renderOrder = 2;
  g.add(cone);
  const light = new PointLight(color, 9, 9, 1.6);
  light.position.set(armDir * 0.85, 3.7, 0);
  g.add(light);
  return { group: solid(g, 0.3), light };
}

/** Lathe from radius/height pairs, for turned shapes such as lamp parts. */
function lathe(points: [number, number][]): BufferGeometry {
  return new LatheGeometry(points.map(([r, y]) => new Vector2(r, y)), 12);
}

export function stanchion(): Group {
  const g = new Group();
  add(g, cylinder(0.16, 0.05, mat(PALETTE.metal), 6));
  add(g, cylinder(0.04, 0.95, mat(PALETTE.asphaltLine), 4));
  return g;
}

// Pixel text for signs: a 3x5 bitmap font drawn into a nearest-filtered texture
// so labels stay crisp at the same pixel density as the rest of the world.

const GLYPHS: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', H: '101101111101101', I: '111010010010111', L: '100100100100111',
  N: '110101101101101', O: '010101101101010', P: '110101110100100', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', W: '101101101111101',
  G: '011100101101011', K: '101101110101101', M: '101111111101101', V: '101101101101010', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', Q: '010101101110011', J: '001001001101010',
  '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110', '4': '101101111001001',
  '5': '111100110001110', '6': '011100110101010', '7': '111001010010010', '8': '010101010101010', '9': '010101011001110',
  // A frog's face: two eyes on top, a wide mouth, legs. Signs write it as '@' (the Żabka frog).
  '@': '101111101111101',
  '-': '000000111000000', ' ': '000000000000000', '+': '000010111010000', '&': '010101010101011',
};

export function pixelTextTexture(text: string, fg: string, bg: string, padding = 1): CanvasTexture {
  const w = text.length * 4 - 1 + padding * 2;
  const h = 5 + padding * 2;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  [...text].forEach((ch, i) => {
    const bits = GLYPHS[ch] ?? GLYPHS[' '];
    for (let b = 0; b < 15; b++) {
      if (bits[b] === '1') ctx.fillRect(padding + i * 4 + (b % 3), padding + Math.floor(b / 3), 1, 1);
    }
  });
  const tex = new CanvasTexture(canvas);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** Glowing sign board: a box whose front face carries pixel text. */
export function signBoard(text: string, width: number, height: number, fg: string, bg: string, glow: number): { mesh: Mesh; material: MeshLambertMaterial } {
  const tex = pixelTextTexture(text, fg, bg);
  const face = new MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: glow });
  const side = mat(PALETTE.frame);
  const geo = cachedGeometry(`sign${width}|${height}`, () => {
    const g = new BoxGeometry(width, height, 0.12).translate(0, height / 2, 0);
    // BoxGeometry faces run +x, -x, +y, -y, +z, -z, six indices each. Regroup
    // into sides / front / back so a sign costs three draws, not six.
    g.clearGroups();
    g.addGroup(0, 24, 0);
    g.addGroup(24, 6, 1);
    g.addGroup(30, 6, 0);
    return g;
  });
  const mesh = new Mesh(geo, [side, face]);
  mesh.castShadow = true;
  return { mesh, material: face };
}

/** Gable roof: a triangular prism `w` wide, `d` long, ridge `h` above its base, ridge along z. */
export function gableRoof(w: number, d: number, h: number, material: Material): Mesh {
  const geo = cachedGeometry(`gable${w}|${d}|${h}`, () => {
    const shape = new Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(0, h);
    shape.closePath();
    return new ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);
  });
  const m = new Mesh(geo, material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Mansard roof: a square frustum with steep sides, `w` by `d` at its base, `h` tall. */
export function mansard(w: number, d: number, h: number, material: Material): Mesh {
  const geo = cachedGeometry(`mansard${w}|${d}|${h}`, () =>
    new CylinderGeometry(Math.SQRT1_2 * 0.72, Math.SQRT1_2, h, 4, 1).rotateY(Math.PI / 4).scale(w, 1, d).translate(0, h / 2, 0),
  );
  const m = new Mesh(geo, material);
  m.castShadow = m.receiveShadow = true;
  return m;
}
