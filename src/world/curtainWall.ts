import { CanvasTexture, Color, MeshLambertMaterial, RepeatWrapping, SRGBColorSpace } from 'three';
import type { Random } from '../sim/random';

/** One texture tile: 8 panes across, 16 floors up; a pane is 1.6 m wide, a floor 3.4 m high. */
const COLS = 8;
const ROWS = 16;
export const TILE_W = COLS * 1.6;
export const TILE_H = ROWS * 3.4;
const PX_W = 256;
const PX_H = 512;

let glassCanvas: HTMLCanvasElement | null = null;
const officeCanvases: HTMLCanvasElement[] = [];

/**
 * The glass: each pane a gradient of reflected sky (light at the top, deeper
 * below), dark mullions between panes, an opaque spandrel band at each floor
 * slab. White, so each tower's tint colours it.
 */
function glass(): HTMLCanvasElement {
  if (glassCanvas) return glassCanvas;
  const c = document.createElement('canvas');
  c.width = PX_W;
  c.height = PX_H;
  const g = c.getContext('2d')!;
  const pw = PX_W / COLS;
  const ph = PX_H / ROWS;
  g.fillStyle = '#3a4048';
  g.fillRect(0, 0, PX_W, PX_H);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * pw + 1.5;
      const y = row * ph + ph * 0.18;
      const grad = g.createLinearGradient(0, y, 0, y + ph * 0.8);
      // Neighbouring panes catch the sky a little differently.
      const lift = ((col * 7 + row * 3) % 5) * 6;
      grad.addColorStop(0, `rgb(${200 + lift},${215 + lift / 2},${235})`);
      grad.addColorStop(0.55, `rgb(${120 + lift},${140 + lift},${168})`);
      grad.addColorStop(1, `rgb(${70 + lift},${84 + lift},${104})`);
      g.fillStyle = grad;
      g.fillRect(x, y, pw - 3, ph * 0.8 - 1);
    }
    // Spandrel: the slab edge, a lighter band.
    g.fillStyle = '#8a9098';
    g.fillRect(0, row * ph, PX_W, ph * 0.16);
  }
  glassCanvas = c;
  return c;
}

/** Offices lit at night: some panes glow, whole runs of a floor more often than single panes. */
function offices(seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = PX_W;
  c.height = PX_H;
  const g = c.getContext('2d')!;
  const pw = PX_W / COLS;
  const ph = PX_H / ROWS;
  g.fillStyle = '#000';
  g.fillRect(0, 0, PX_W, PX_H);
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let row = 0; row < ROWS; row++) {
    const busy = rnd();
    for (let col = 0; col < COLS; col++) {
      if (rnd() > busy * 0.9) continue;
      const warm = rnd() < 0.3;
      g.fillStyle = warm ? '#ffe2a8' : '#e4f0ff';
      g.fillRect(col * pw + 1.5, row * ph + ph * 0.18, pw - 3, ph * 0.8 - 1);
    }
  }
  return c;
}

/**
 * A curtain wall material for a tower `w` metres wide and `h` high: the glass
 * tile repeated to scale, tinted, with its own pattern of lit offices.
 * Animate `emissiveIntensity` for night and day like other windows.
 */
export function curtainWall(tint: number, w: number, h: number, random: Random): MeshLambertMaterial {
  if (officeCanvases.length === 0) for (let i = 0; i < 4; i++) officeCanvases.push(offices(i + 1));
  const map = new CanvasTexture(glass());
  map.colorSpace = SRGBColorSpace;
  const lit = new CanvasTexture(officeCanvases[Math.floor(random() * officeCanvases.length)]);
  lit.colorSpace = SRGBColorSpace;
  for (const t of [map, lit]) {
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(w / TILE_W, h / TILE_H);
    t.offset.set(Math.floor(random() * COLS) / COLS, Math.floor(random() * ROWS) / ROWS);
  }
  return new MeshLambertMaterial({ color: new Color(tint), map, emissive: new Color(0xffffff), emissiveMap: lit, emissiveIntensity: 0.8 });
}
