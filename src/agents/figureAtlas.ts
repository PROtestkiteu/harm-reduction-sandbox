import { CanvasTexture, SRGBColorSpace } from 'three';

/**
 * One painted detail atlas shared by every person: faces, hair, knitwear,
 * sleeves, jackets, coats, trousers, shoes and skin, each on its own tile.
 * Tiles are near-white greyscale, so they multiply over each person's own
 * vertex colours: one texture and one draw call however varied the crowd.
 * Painted in code at start-up, so nothing is downloaded.
 *
 * UV conventions it relies on (three.js primitives): cylinders and lathes put
 * the front (+z) at u = 0 and 1 and the top at v = 1; spheres put the front at
 * u = 0.25, the sides at u = 0 and 0.5.
 */
export const TILE = {
  plain: 0,
  face: 1,
  hair: 2,
  top: 3,
  sleeve: 4,
  jacket: 5,
  coat: 6,
  trousers: 7,
  shoe: 8,
  skin: 9,
} as const;
export type Tile = (typeof TILE)[keyof typeof TILE];

export const ATLAS_GRID = 4;
const T = 256;

/** Maps a tile-local (u, v) into the atlas, inset so mipmaps do not bleed between tiles. */
export function atlasUv(tile: Tile, u: number, v: number): [number, number] {
  const col = tile % ATLAS_GRID;
  const row = Math.floor(tile / ATLAS_GRID);
  const uu = Math.min(1, Math.max(0, u));
  const vv = Math.min(1, Math.max(0, v));
  return [(col + 0.02 + uu * 0.96) / ATLAS_GRID, 1 - (row + 1) / ATLAS_GRID + (0.02 + vv * 0.96) / ATLAS_GRID];
}

type Ctx = CanvasRenderingContext2D;

function seeded(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const grey = (v: number, a = 1) => `rgba(${v},${v},${v},${a})`;

/** Fine speckle so no surface is a flat fill. */
function grain(c: Ctx, rnd: () => number, amount: number, dots = 1400): void {
  for (let i = 0; i < dots; i++) {
    const v = rnd() < 0.5 ? 0 : 255;
    c.fillStyle = grey(v, amount * rnd());
    c.fillRect(rnd() * T, rnd() * T, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

/** Soft vertical folds: cloth hanging under its own weight. */
function folds(c: Ctx, rnd: () => number, strength: number, count = 14): void {
  for (let i = 0; i < count; i++) {
    const x = rnd() * T;
    const w = 6 + rnd() * 18;
    const g = c.createLinearGradient(x - w, 0, x + w, 0);
    const dark = rnd() < 0.6;
    g.addColorStop(0, grey(dark ? 0 : 255, 0));
    g.addColorStop(0.5, grey(dark ? 0 : 255, strength * (0.5 + rnd() * 0.5)));
    g.addColorStop(1, grey(dark ? 0 : 255, 0));
    c.fillStyle = g;
    const y0 = rnd() * T * 0.4;
    c.fillRect(x - w, y0, w * 2, T - y0 - rnd() * T * 0.2);
  }
}

function seam(c: Ctx, x: number, alpha = 0.35): void {
  c.fillStyle = grey(0, alpha);
  c.fillRect(x - 1, 0, 2, T);
  c.fillStyle = grey(255, alpha * 0.4);
  c.fillRect(x + 1, 0, 1, T);
}

/** A horizontal band: hems, cuffs, waistbands. */
function band(c: Ctx, y: number, h: number, alpha: number): void {
  c.fillStyle = grey(0, alpha);
  c.fillRect(0, y, T, h);
  c.fillStyle = grey(0, alpha * 1.4);
  for (let x = 0; x < T; x += 5) c.fillRect(x, y + 2, 2, 1);
}

const PAINT: Record<Tile, (c: Ctx, rnd: () => number) => void> = {
  [TILE.plain]: () => {},

  [TILE.skin]: (c, rnd) => {
    grain(c, rnd, 0.05, 600);
    // Knuckle and crease shading toward the lower end.
    const g = c.createLinearGradient(0, T * 0.6, 0, T);
    g.addColorStop(0, grey(0, 0));
    g.addColorStop(1, grey(0, 0.18));
    c.fillStyle = g;
    c.fillRect(0, 0, T, T);
  },

  [TILE.face]: (c, rnd) => {
    grain(c, rnd, 0.04, 500);
    const fx = T * 0.25; // front of the head
    const eyeY = T * 0.44;
    // Soft modelling: cheek and jaw shadow, temples.
    const jaw = c.createLinearGradient(0, T * 0.55, 0, T * 0.8);
    jaw.addColorStop(0, grey(0, 0));
    jaw.addColorStop(1, grey(0, 0.28));
    c.fillStyle = jaw;
    c.fillRect(0, 0, T, T);
    for (const side of [-1, 1]) {
      // Eye socket shadow.
      const s = c.createRadialGradient(fx + side * 11, eyeY, 1, fx + side * 11, eyeY, 12);
      s.addColorStop(0, grey(0, 0.38));
      s.addColorStop(1, grey(0, 0));
      c.fillStyle = s;
      c.fillRect(fx + side * 11 - 14, eyeY - 14, 28, 28);
      // Eye: dark iris and lid line.
      c.fillStyle = grey(25, 0.9);
      c.beginPath();
      c.ellipse(fx + side * 10, eyeY + 1, 3.2, 2.2, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = grey(235, 0.7);
      c.fillRect(fx + side * 10 - 5, eyeY + 1, 2, 1);
      // Brow.
      c.strokeStyle = grey(30, 0.75);
      c.lineWidth = 2.6;
      c.beginPath();
      c.moveTo(fx + side * 4, eyeY - 7);
      c.quadraticCurveTo(fx + side * 10, eyeY - 10, fx + side * 17, eyeY - 6);
      c.stroke();
      // Ear on each side of the head (u = 0 and 0.5).
      const ex = side < 0 ? 4 : T * 0.5;
      c.fillStyle = grey(0, 0.25);
      c.beginPath();
      c.ellipse(ex, eyeY + 8, 5, 11, 0, 0, Math.PI * 2);
      c.fill();
    }
    // Nose: a shadow down one side and under the tip.
    c.fillStyle = grey(0, 0.22);
    c.fillRect(fx + 2, eyeY + 4, 3, 16);
    c.beginPath();
    c.ellipse(fx, eyeY + 21, 6, 2.5, 0, 0, Math.PI * 2);
    c.fill();
    // Mouth: dark line, lighter lower lip, shadow under it.
    c.strokeStyle = grey(40, 0.75);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(fx - 8, eyeY + 33);
    c.quadraticCurveTo(fx, eyeY + 35 + (rnd() - 0.5) * 3, fx + 8, eyeY + 33);
    c.stroke();
    c.fillStyle = grey(0, 0.16);
    c.fillRect(fx - 6, eyeY + 38, 12, 4);
  },

  [TILE.hair]: (c, rnd) => {
    // Strands falling from the crown: many thin light and dark strokes.
    for (let i = 0; i < 900; i++) {
      const x = rnd() * T;
      const y = rnd() * T * 0.3;
      const len = 30 + rnd() * 90;
      c.strokeStyle = grey(rnd() < 0.55 ? 0 : 255, 0.12 + rnd() * 0.22);
      c.lineWidth = 0.8 + rnd() * 1.4;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + (rnd() - 0.5) * 14, y + len * 0.5, x + (rnd() - 0.5) * 20, y + len);
      c.stroke();
    }
  },

  [TILE.top]: (c, rnd) => {
    grain(c, rnd, 0.08);
    folds(c, rnd, 0.14);
    seam(c, T * 0.25);
    seam(c, T * 0.75);
    // Neckline at the top, hem at the bottom (lathe: top of the torso is v = 1).
    band(c, 0, 10, 0.3);
    band(c, T - 12, 12, 0.22);
    // Chest pocket on the left front.
    c.strokeStyle = grey(0, 0.35);
    c.lineWidth = 1.5;
    c.strokeRect(T - 44, T * 0.28, 22, 24);
    // Armpit and under-chest shadow toward the sides.
    for (const x of [T * 0.25, T * 0.75]) {
      const g = c.createRadialGradient(x, T * 0.2, 2, x, T * 0.2, 40);
      g.addColorStop(0, grey(0, 0.3));
      g.addColorStop(1, grey(0, 0));
      c.fillStyle = g;
      c.fillRect(x - 40, 0, 80, 80);
    }
  },

  [TILE.sleeve]: (c, rnd) => {
    grain(c, rnd, 0.08);
    folds(c, rnd, 0.1, 8);
    seam(c, T * 0.5, 0.25);
    // Creases bunching around the elbow.
    for (let i = 0; i < 9; i++) {
      c.strokeStyle = grey(0, 0.18 + rnd() * 0.15);
      c.lineWidth = 1.5 + rnd() * 2;
      const y = T * (0.1 + rnd() * 0.25);
      c.beginPath();
      c.moveTo(rnd() * T * 0.3, y);
      c.quadraticCurveTo(T * 0.5, y + (rnd() - 0.5) * 20, T * (0.7 + rnd() * 0.3), y + (rnd() - 0.5) * 10);
      c.stroke();
    }
    band(c, T - 16, 16, 0.3);
  },

  [TILE.jacket]: (c, rnd) => {
    grain(c, rnd, 0.1);
    folds(c, rnd, 0.16, 10);
    seam(c, T * 0.25);
    seam(c, T * 0.75);
    // Zip down the front (u = 0 / 1).
    c.fillStyle = grey(40, 0.6);
    c.fillRect(0, 0, 3, T);
    c.fillRect(T - 3, 0, 3, T);
    for (let y = 4; y < T; y += 4) { c.fillStyle = grey(200, 0.4); c.fillRect(0, y, 3, 1); c.fillRect(T - 3, y, 3, 1); }
    // Collar and lapels: darker V at the top front.
    c.fillStyle = grey(0, 0.28);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(34, 0); c.lineTo(0, 60); c.fill();
    c.beginPath(); c.moveTo(T, 0); c.lineTo(T - 34, 0); c.lineTo(T, 60); c.fill();
    // Slash pockets low on the front.
    c.strokeStyle = grey(0, 0.5);
    c.lineWidth = 2;
    for (const x of [30, T - 30]) { c.beginPath(); c.moveTo(x - 10, T * 0.78); c.lineTo(x + 10, T * 0.7); c.stroke(); }
    band(c, T - 14, 14, 0.3);
  },

  [TILE.coat]: (c, rnd) => {
    grain(c, rnd, 0.12, 2400);
    folds(c, rnd, 0.2, 16);
    seam(c, T * 0.5, 0.3);
    // Front edge and a row of buttons.
    c.fillStyle = grey(0, 0.35);
    c.fillRect(0, 0, 2, T);
    c.fillRect(T - 2, 0, 2, T);
    for (let y = 30; y < T - 20; y += 44) {
      c.fillStyle = grey(30, 0.8);
      c.beginPath(); c.arc(9, y, 3.2, 0, Math.PI * 2); c.fill();
    }
    band(c, T - 10, 10, 0.3);
  },

  [TILE.trousers]: (c, rnd) => {
    // Twill: faint diagonal lines.
    c.strokeStyle = grey(0, 0.06);
    c.lineWidth = 1;
    for (let x = -T; x < T; x += 4) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + T, T); c.stroke(); }
    grain(c, rnd, 0.08);
    folds(c, rnd, 0.12, 10);
    // Outer seams at the sides, a pressed crease down the front.
    seam(c, T * 0.25, 0.3);
    seam(c, T * 0.75, 0.3);
    c.fillStyle = grey(255, 0.18);
    c.fillRect(0, 0, 2, T);
    c.fillRect(T - 2, 0, 2, T);
    // Worn, lighter knees (bottom of the thigh, top of the shin share this).
    const g = c.createRadialGradient(4, T * 0.1, 2, 4, T * 0.1, 40);
    g.addColorStop(0, grey(255, 0.22));
    g.addColorStop(1, grey(255, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, 50, 70);
    // Creases behind the knee.
    for (let i = 0; i < 5; i++) {
      c.strokeStyle = grey(0, 0.2);
      c.lineWidth = 1.5;
      const y = T * (0.05 + rnd() * 0.12);
      c.beginPath(); c.moveTo(T * 0.4, y); c.quadraticCurveTo(T * 0.5, y + 5, T * 0.6, y); c.stroke();
    }
    band(c, T - 10, 10, 0.25);
  },

  [TILE.shoe]: (c, rnd) => {
    grain(c, rnd, 0.1, 500);
    // Sole: a darker band; laces across the top.
    c.fillStyle = grey(0, 0.45);
    c.fillRect(0, T * 0.62, T, T * 0.38);
    c.fillStyle = grey(255, 0.25);
    for (let x = T * 0.15; x < T * 0.35; x += 7) c.fillRect(x, T * 0.18, 3, T * 0.18);
  },
};

let texture: CanvasTexture | null = null;

/** The shared atlas, painted once on first use. */
export function figureAtlas(): CanvasTexture {
  if (texture) return texture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = T * ATLAS_GRID;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const tile of Object.values(TILE)) {
    ctx.save();
    ctx.translate((tile % ATLAS_GRID) * T, Math.floor(tile / ATLAS_GRID) * T);
    ctx.beginPath();
    ctx.rect(0, 0, T, T);
    ctx.clip();
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(0, 0, T, T);
    PAINT[tile](ctx, seeded(31 + tile * 977));
    ctx.restore();
  }
  texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
