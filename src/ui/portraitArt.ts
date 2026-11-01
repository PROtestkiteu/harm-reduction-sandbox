import type { Appearance } from '../agents/character';
import type { LocationId } from '../sim/types';

/**
 * Painted 2D portraits in the manner of Disco Elysium's: long, angular faces
 * built from flat planes, warm light on one side and cool teal or violet
 * shadow on the other, a coloured rim of light, deep-set eyes under a heavy
 * brow, thick strokes that follow the form, and a dark ground with smoky
 * colour behind. Generated from the person's description (never captured
 * from the 3D scene), seeded per person so the same person always gets the
 * same painting. Pure canvas 2D, a few milliseconds per portrait.
 */

export const PORTRAIT_W = 240;
export const PORTRAIT_H = 300;

type RGB = [number, number, number];
type Ctx = CanvasRenderingContext2D;

const rgb = (hex: number): RGB => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const css = ([r, g, b]: RGB, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scale = (a: RGB, k: number): RGB => [Math.min(255, a[0] * k), Math.min(255, a[1] * k), Math.min(255, a[2] * k)];

function seeded(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Light and shadow of the painting: warm key, cool shadow, a coloured rim. */
interface Light { warm: RGB; cool: RGB; rim: RGB; haze: RGB }
const LIGHTS: Light[] = [
  { warm: [255, 196, 140], cool: [60, 110, 120], rim: [255, 120, 60], haze: [40, 70, 72] },
  { warm: [250, 210, 160], cool: [80, 70, 130], rim: [90, 220, 210], haze: [52, 40, 70] },
  { warm: [255, 180, 120], cool: [50, 90, 80], rim: [240, 200, 90], haze: [36, 56, 44] },
  { warm: [245, 205, 170], cool: [110, 60, 70], rim: [120, 170, 255], haze: [64, 34, 40] },
];

/** Paints a region with directional strokes: an underpaint, then many short dabs of nearby tones. */
function paintRegion(c: Ctx, path: Path2D, base: RGB, rnd: () => number, o: { angle: number; spread?: number; len?: number; width?: number; count?: number; vary?: number; bounds: [number, number, number, number] }): void {
  const [x0, y0, x1, y1] = o.bounds;
  c.save();
  c.clip(path);
  c.fillStyle = css(base);
  c.fillRect(x0, y0, x1 - x0, y1 - y0);
  const count = o.count ?? 220;
  const len = o.len ?? 14;
  c.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = x0 + rnd() * (x1 - x0);
    const y = y0 + rnd() * (y1 - y0);
    const a = o.angle + (rnd() - 0.5) * (o.spread ?? 0.5);
    const l = len * (0.5 + rnd());
    const k = 1 + (rnd() - 0.5) * (o.vary ?? 0.28);
    c.strokeStyle = css(scale(base, k), 0.35 + rnd() * 0.45);
    c.lineWidth = (o.width ?? 4) * (0.6 + rnd() * 0.8);
    c.beginPath();
    c.moveTo(x - Math.cos(a) * l * 0.5, y - Math.sin(a) * l * 0.5);
    c.lineTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5);
    c.stroke();
  }
  c.restore();
}

/** Glazes a region from one side: cool shadow toward the far side, rim light at the very edge. */
function shadeSide(c: Ctx, path: Path2D, x0: number, x1: number, light: Light, depth = 0.6, rim = true): void {
  c.save();
  c.clip(path);
  const g = c.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, css(light.warm, 0.22));
  g.addColorStop(0.45, css(light.warm, 0));
  g.addColorStop(0.62, css(light.cool, depth * 0.55));
  g.addColorStop(rim ? 0.9 : 1, css(light.cool, depth));
  if (rim) g.addColorStop(1, css(light.rim, 0.7));
  c.fillStyle = g;
  c.fillRect(x0 - 2, 0, x1 - x0 + 4, PORTRAIT_H);
  c.restore();
}

/** An ink line that wobbles a little, drawn twice like a quick brush outline. */
function ink(c: Ctx, path: Path2D, width = 2.2, alpha = 0.75): void {
  c.save();
  c.strokeStyle = `rgba(14,10,10,${alpha})`;
  c.lineJoin = 'round';
  c.lineWidth = width;
  c.stroke(path);
  c.translate(0.6, -0.4);
  c.lineWidth = width * 0.5;
  c.globalAlpha = 0.5;
  c.stroke(path);
  c.restore();
}

/** Dark ground with smoky colour and a few big rough strokes. */
function ground(c: Ctx, rnd: () => number, light: Light, tint?: RGB): void {
  const base = mix([16, 13, 12], tint ?? light.haze, 0.35);
  c.fillStyle = css(base);
  c.fillRect(0, 0, PORTRAIT_W, PORTRAIT_H);
  for (let i = 0; i < 14; i++) {
    const x = rnd() * PORTRAIT_W;
    const y = rnd() * PORTRAIT_H;
    const r = 40 + rnd() * 90;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, css(mix(light.haze, tint ?? light.haze, rnd()), 0.35));
    g.addColorStop(1, css(light.haze, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, PORTRAIT_W, PORTRAIT_H);
  }
  c.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    c.strokeStyle = css(scale(base, 0.7 + rnd() * 1.1), 0.25);
    c.lineWidth = 8 + rnd() * 18;
    const x = rnd() * PORTRAIT_W;
    const y = rnd() * PORTRAIT_H;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (rnd() - 0.5) * 120, y + (rnd() - 0.5) * 60);
    c.stroke();
  }
}

/** Paper grain and a vignette over everything. */
function finish(c: Ctx, rnd: () => number): void {
  const v = c.createRadialGradient(PORTRAIT_W / 2, PORTRAIT_H * 0.42, PORTRAIT_H * 0.28, PORTRAIT_W / 2, PORTRAIT_H / 2, PORTRAIT_H * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.6)');
  c.fillStyle = v;
  c.fillRect(0, 0, PORTRAIT_W, PORTRAIT_H);
  for (let i = 0; i < 2400; i++) {
    c.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,240,220,0.05)';
    c.fillRect(rnd() * PORTRAIT_W, rnd() * PORTRAIT_H, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
}

/**
 * A closed path through points. `round` 0 keeps hard corners (angular
 * planes); higher values ease each corner along its edges.
 */
function shape(points: [number, number][], round = 0.35): Path2D {
  const p = new Path2D();
  const n = points.length;
  const lerp = (a: [number, number], b: [number, number], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const t = Math.min(0.5, round);
  const start = lerp(points[0], points[1], t);
  p.moveTo(start[0], start[1]);
  for (let i = 1; i <= n; i++) {
    const cur = points[i % n];
    const prev = points[i - 1];
    const next = points[(i + 1) % n];
    const a = lerp(cur, prev, t);
    const b = lerp(cur, next, t);
    p.lineTo(a[0], a[1]);
    p.quadraticCurveTo(cur[0], cur[1], b[0], b[1]);
  }
  p.closePath();
  return p;
}

// People

/**
 * A person, head and shoulders, three-quarter view turned to the viewer's
 * left, lit from the left. Everything comes from their description.
 */
export function paintPerson(c: Ctx, look: Appearance, seed: number): void {
  const rnd = seeded(seed);
  const light = LIGHTS[seed % LIGHTS.length];
  const k = look.kit ?? {};
  const older = look.style === 'older';
  const masc = !!look.beard || (!look.skirt && look.hairStyle !== 1 && look.hairStyle !== 2 && look.hairStyle !== 6 && seed % 3 !== 0);
  const W = PORTRAIT_W;
  ground(c, rnd, light);

  // Head geometry: long, angular, slightly turned. Proportions vary per person.
  const cx = W * 0.5 + (rnd() - 0.5) * 8;
  const cy = 132;
  const hw = (masc ? 58 : 52) + (rnd() - 0.5) * 8 + (look.girth ?? 0) * 8;
  const hh = 84 + (rnd() - 0.5) * 10;
  /** Feature scale: eyes, nose and mouth grow with the head. */
  const f = hw / 36;
  const jaw = masc ? 0.8 + rnd() * 0.12 : 0.66 + rnd() * 0.1;
  const turn = -0.22;
  const fx = cx + turn * hw; // face centre line
  const skin = rgb(look.skin);
  const hair = rgb(look.hair);
  const vest = look.police ? 0x22304a : look.staff ? look.vestColour ?? 0x2e7d6b : k.hiVis ? 0xe07a20 : null;
  const top = rgb(vest ?? (look.extra === 'jacket' || k.longCoat ? look.accent : look.top));
  const under = rgb(look.top);

  // Long hair and hoods fall behind the shoulders.
  if (look.hairStyle === 1 && !k.hood && !look.police) {
    const back = shape([[cx - hw * 1.1, cy - hh * 0.6], [cx + hw * 1.15, cy - hh * 0.55], [cx + hw * 1.3, cy + hh * 1.3], [cx - hw * 1.25, cy + hh * 1.35]]);
    paintRegion(c, back, scale(hair, 0.8), rnd, { angle: Math.PI / 2, len: 26, width: 4, count: 260, bounds: [0, 40, W, 230] });
    shadeSide(c, back, cx - hw * 1.3, cx + hw * 1.3, light, 0.55);
  }
  if (k.hood === 'up') {
    const hood = shape([[cx - hw * 1.45, cy + hh * 1.2], [cx - hw * 1.5, cy - hh * 0.5], [cx, cy - hh * 1.35], [cx + hw * 1.45, cy - hh * 0.45], [cx + hw * 1.5, cy + hh * 1.2]]);
    paintRegion(c, hood, scale(rgb(look.top), 0.85), rnd, { angle: 1.2, len: 20, width: 6, count: 260, bounds: [0, 0, W, 260] });
    shadeSide(c, hood, cx - hw * 1.5, cx + hw * 1.5, light, 0.7);
    ink(c, hood, 2.4);
  }

  // Shoulders and clothes, to the bottom edge.
  const sh = shape([[cx - hw * 0.45, cy + hh * 0.8], [cx + hw * 0.5, cy + hh * 0.8], [cx + hw * 2.6, cy + hh * 1.55], [W + 20, 320], [-20, 320], [cx - hw * 2.5, cy + hh * 1.5]]);
  paintRegion(c, sh, top, rnd, { angle: 1.1, spread: 0.9, len: 22, width: 7, count: 320, bounds: [0, cy + hh * 0.6, W, 300] });
  shadeSide(c, sh, 0, W, light, 0.6);
  // Collar, lapels or an open coat show the layer underneath.
  if (look.extra === 'jacket' || k.longCoat) {
    const v = shape([[fx - 16, cy + hh * 0.95], [fx + 18, cy + hh * 0.95], [fx + 4, cy + hh * 2.0]]);
    paintRegion(c, v, under, rnd, { angle: 1.4, len: 12, width: 4, count: 80, bounds: [fx - 30, cy + hh * 0.9, fx + 30, 300] });
    ink(c, v, 1.8, 0.6);
  }
  if (vest !== null) {
    // Reflective bands across the chest.
    c.save();
    c.clip(sh);
    c.fillStyle = css(look.police ? [210, 210, 150] : [230, 232, 220], 0.85);
    c.fillRect(0, cy + hh * 1.9, W, 9);
    c.restore();
  }
  if (k.hood === 'down') {
    const bunch = shape([[cx - hw * 1.2, cy + hh * 1.05], [cx, cy + hh * 0.85], [cx + hw * 1.25, cy + hh * 1.05], [cx + hw, cy + hh * 1.35], [cx - hw, cy + hh * 1.35]]);
    paintRegion(c, bunch, scale(rgb(look.top), 1.05), rnd, { angle: 0.2, len: 14, width: 5, count: 90, bounds: [0, cy + hh * 0.7, W, cy + hh * 1.5] });
    ink(c, bunch, 1.8, 0.55);
  }
  if (look.extra === 'scarf') {
    const scarf = shape([[cx - hw * 0.95, cy + hh * 0.9], [cx + hw * 0.95, cy + hh * 0.9], [cx + hw * 0.8, cy + hh * 1.25], [cx - hw * 0.8, cy + hh * 1.25]]);
    paintRegion(c, scarf, rgb(look.accent), rnd, { angle: 0.1, len: 12, width: 5, count: 90, bounds: [0, cy + hh * 0.8, W, cy + hh * 1.3] });
    ink(c, scarf, 1.6, 0.5);
  }
  ink(c, sh, 2.6);

  // Neck, in the shadow under the jaw.
  const neck = shape([[fx - hw * 0.42, cy + hh * 0.55], [fx + hw * 0.4, cy + hh * 0.55], [fx + hw * 0.5, cy + hh * 1.05], [fx - hw * 0.52, cy + hh * 1.05]], 0.2);
  paintRegion(c, neck, scale(skin, 0.75), rnd, { angle: Math.PI / 2, len: 10, width: 4, count: 70, bounds: [fx - hw, cy + hh * 0.4, fx + hw, cy + hh * 1.1] });
  shadeSide(c, neck, fx - hw * 0.6, fx + hw * 0.6, light, 0.7, false);
  if (k.glow) {
    c.strokeStyle = css(rgb(k.glow), 0.95);
    c.lineWidth = 3;
    c.shadowColor = css(rgb(k.glow));
    c.shadowBlur = 10;
    c.beginPath();
    c.ellipse(fx, cy + hh * 1.0, hw * 0.55, 7, 0, 0, Math.PI);
    c.stroke();
    c.shadowBlur = 0;
  }

  // The head: angular planes of brow, cheekbone, jaw and chin.
  const sag = older ? 4 : 0;
  const head = shape([
    [cx - hw * 0.95, cy - hh * 0.35],
    [cx - hw * 0.55, cy - hh * 0.95],
    [cx + hw * 0.35, cy - hh * 1.0],
    [cx + hw * 0.98, cy - hh * 0.5],
    [cx + hw * 1.0, cy + hh * 0.05],
    [cx + hw * jaw, cy + hh * 0.55 + sag],
    [fx + hw * 0.22, cy + hh * 0.88 + sag],
    [fx - hw * 0.28, cy + hh * 0.86 + sag],
    [cx - hw * jaw * 0.92, cy + hh * 0.5 + sag],
    [cx - hw * 0.98, cy + hh * 0.02],
  ], 0.3);
  const bounds: [number, number, number, number] = [cx - hw * 1.2, cy - hh * 1.1, cx + hw * 1.2, cy + hh * 1.0];
  paintRegion(c, head, skin, rnd, { angle: 1.25, spread: 0.7, len: 16, width: 6, count: 760, vary: 0.3, bounds });
  // Warm key light on the near cheek and brow.
  c.save();
  c.clip(head);
  const key = c.createRadialGradient(cx - hw * 0.45, cy - hh * 0.2, 4, cx - hw * 0.45, cy - hh * 0.2, hw * 1.2);
  key.addColorStop(0, css(light.warm, 0.35));
  key.addColorStop(1, css(light.warm, 0));
  c.fillStyle = key;
  c.fillRect(bounds[0], bounds[1], bounds[2] - bounds[0], bounds[3] - bounds[1]);
  c.restore();
  shadeSide(c, head, cx - hw * 1.0, cx + hw * 1.05, light, 0.78);
  // Planes: cheekbone shadow, temple, the shadow side of the jaw.
  c.save();
  c.clip(head);
  c.fillStyle = css(light.cool, 0.32);
  c.beginPath();
  c.moveTo(fx + hw * 0.25, cy + hh * 0.05);
  c.lineTo(cx + hw * 0.9, cy - hh * 0.05);
  c.lineTo(cx + hw * jaw * 0.95, cy + hh * 0.5);
  c.lineTo(fx + hw * 0.35, cy + hh * 0.4);
  c.fill();
  c.fillStyle = css(light.cool, 0.25);
  c.beginPath();
  c.moveTo(fx - hw * 0.3, cy + hh * 0.62);
  c.lineTo(fx + hw * 0.25, cy + hh * 0.62);
  c.lineTo(fx + hw * 0.15, cy + hh * 0.86);
  c.lineTo(fx - hw * 0.25, cy + hh * 0.84);
  c.fill();
  c.restore();

  // Faceted planes, painted in their own tones: lit forehead and near cheek,
  // the cool shadow side of the nose bridge, a dark band under the brow.
  const plane = (pts: [number, number][], tone: RGB, angle: number, alpha = 1) => {
    const pl = shape(pts, 0.05);
    c.save();
    c.globalAlpha = alpha;
    paintRegion(c, pl, tone, rnd, { angle, spread: 0.5, len: 14, width: 5, count: 160, vary: 0.25, bounds });
    c.restore();
  };
  const lit = mix(skin, light.warm, 0.38);
  const coolSkin = mix(skin, light.cool, 0.5);
  plane([[cx - hw * 0.7, cy - hh * 0.72], [cx + hw * 0.2, cy - hh * 0.8], [fx + hw * 0.05, cy - hh * 0.35], [cx - hw * 0.75, cy - hh * 0.3]], lit, 0.2, 0.75);
  plane([[cx - hw * 0.92, cy - hh * 0.05], [fx - hw * 0.22, cy - hh * 0.02], [fx - hw * 0.2, cy + hh * 0.38], [cx - hw * 0.8, cy + hh * 0.42]], mix(lit, skin, 0.3), 1.3, 0.8);
  plane([[fx + hw * 0.05, cy - hh * 0.2], [fx + hw * 0.3, cy - hh * 0.18], [fx + hw * 0.32, cy + hh * 0.35], [fx + hw * 0.06, cy + hh * 0.3]], coolSkin, 1.5, 0.7);
  plane([[cx + hw * 0.4, cy - hh * 0.05], [cx + hw * 0.98, cy - hh * 0.1], [cx + hw * jaw * 0.96, cy + hh * 0.52], [fx + hw * 0.36, cy + hh * 0.45]], mix(coolSkin, [20, 20, 30], 0.25), 1.2, 0.85);
  plane([[cx - hw * 0.9, cy - hh * 0.3], [cx + hw * 0.95, cy - hh * 0.34], [cx + hw * 0.92, cy - hh * 0.16], [cx - hw * 0.88, cy - hh * 0.12]], mix(skin, [24, 18, 22], 0.55), 0.05, 0.75);

  // Ear on the far side.
  const ear = shape([[cx + hw * 0.92, cy - hh * 0.18], [cx + hw * 1.14, cy - hh * 0.12], [cx + hw * 1.1, cy + hh * 0.16], [cx + hw * 0.95, cy + hh * 0.2]]);
  paintRegion(c, ear, scale(skin, 0.8), rnd, { angle: 1.5, len: 6, width: 3, count: 30, bounds: [cx + hw * 0.85, cy - hh * 0.25, cx + hw * 1.2, cy + hh * 0.25] });
  shadeSide(c, ear, cx + hw * 0.9, cx + hw * 1.15, light, 0.5);

  // Brow ridge and deep-set eyes.
  const eyeY = cy - hh * 0.12;
  const eyes: [number, number][] = [[fx - hw * 0.42, eyeY], [fx + hw * 0.33, eyeY + 1]];
  for (const [ex, ey] of eyes) {
    const far = ex > fx;
    const s = far ? 0.8 : 1;
    // Socket shadow, cool.
    // Deep socket in cool shadow.
    c.fillStyle = css(mix(light.cool, [14, 10, 12], 0.55), 0.7);
    c.beginPath();
    c.ellipse(ex, ey - 1 * f, 11 * s * f, 6 * f, -0.08, 0, Math.PI * 2);
    c.fill();
    // The eye: a narrow dark slit, barely any white, one glint, a heavy lid.
    c.fillStyle = css(mix([200, 186, 168], light.cool, 0.4), 0.55);
    c.beginPath();
    c.ellipse(ex, ey + 0.5 * f, 6 * s * f, 1.8 * f, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(18,12,12,0.95)';
    c.beginPath();
    c.ellipse(ex - 1 * s * f, ey + 0.4 * f, 2.2 * f, 1.9 * f, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = css(light.warm, 0.9);
    c.fillRect(ex - 2 * s * f, ey - 0.6 * f, 1.3 * f, 1.1 * f);
    c.strokeStyle = 'rgba(12,8,8,0.95)';
    c.lineWidth = 2.2 * f;
    c.beginPath();
    c.moveTo(ex - 7 * s * f, ey + 0.8 * f);
    c.quadraticCurveTo(ex, ey - 2.6 * f, ex + 6.5 * s * f, ey);
    c.stroke();
    if (older) {
      c.lineWidth = 1;
      c.strokeStyle = 'rgba(20,12,12,0.45)';
      c.beginPath();
      c.moveTo(ex - 6 * s * f, ey + 4 * f);
      c.quadraticCurveTo(ex, ey + 6.5 * f, ex + 6 * s * f, ey + 4 * f);
      c.stroke();
    }
    // Brow: thick strokes in the hair colour, a little low and tired.
    c.strokeStyle = css(scale(hair, 0.7), 0.95);
    c.lineWidth = 3.4 * s * f;
    c.lineCap = 'round';
    c.beginPath();
    const tilt = (rnd() - 0.3) * 3 * f;
    c.moveTo(ex - 9 * s * f, ey - 6.5 * f + tilt);
    c.quadraticCurveTo(ex, ey - 9 * f, ex + 9 * s * f, ey - 6.5 * f - tilt * 0.5);
    c.stroke();
  }

  // Nose: a strong plane down the shadow side, a lit ridge and a dark nostril.
  const nose = new Path2D();
  nose.moveTo(fx - 2 * f, eyeY + 2 * f);
  nose.lineTo(fx - 9 * f, cy + hh * 0.28);
  nose.lineTo(fx + 4 * f, cy + hh * 0.32);
  nose.lineTo(fx + 3 * f, eyeY + 4 * f);
  nose.closePath();
  c.fillStyle = css(light.cool, 0.45);
  c.fill(nose);
  c.strokeStyle = css(mix(skin, light.warm, 0.55), 0.85);
  c.lineWidth = 2.6 * f;
  c.beginPath();
  c.moveTo(fx - 3 * f, eyeY + 4 * f);
  c.lineTo(fx - 8 * f, cy + hh * 0.25);
  c.stroke();
  c.fillStyle = 'rgba(30,18,16,0.85)';
  c.beginPath();
  c.ellipse(fx - 3 * f, cy + hh * 0.31, 3.2 * f, 1.6 * f, 0.2, 0, Math.PI * 2);
  c.fill();
  ink(c, (() => { const p = new Path2D(); p.moveTo(fx - 9 * f, cy + hh * 0.28); p.lineTo(fx - 2 * f, cy + hh * 0.33); return p; })(), 1.6 * f, 0.7);

  // Mouth: a dark line, a lighter lower lip, the shadow under it.
  const my = cy + hh * 0.5 + sag * 0.5;
  c.strokeStyle = 'rgba(40,20,20,0.85)';
  c.lineWidth = 2.4 * f;
  c.beginPath();
  c.moveTo(fx - 12 * f, my);
  c.quadraticCurveTo(fx - 1 * f, my + (older ? 2 : 0.5) * f, fx + 10 * f, my - 1 * f);
  c.stroke();
  c.fillStyle = css(mix(skin, [200, 110, 100], 0.25), 0.6);
  c.beginPath();
  c.ellipse(fx - 1 * f, my + 3.5 * f, 8 * f, 2.4 * f, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = css(light.cool, 0.3);
  c.fillRect(fx - 7 * f, my + 6.5 * f, 13 * f, 3 * f);
  if (older || rnd() < 0.3) {
    // Lines from nose to mouth.
    c.strokeStyle = 'rgba(30,16,16,0.4)';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(fx - 12 * f, cy + hh * 0.3);
    c.quadraticCurveTo(fx - 17 * f, my - 4 * f, fx - 15 * f, my + 4 * f);
    c.stroke();
  }

  // Beard or stubble.
  if (look.beard) {
    const beard = shape([[cx - hw * jaw * 0.95, cy + hh * 0.3], [fx - 14, my - 5], [fx + 12, my - 6], [cx + hw * jaw, cy + hh * 0.32], [cx + hw * jaw * 0.9, cy + hh * 0.6 + sag], [fx + hw * 0.2, cy + hh * 0.95 + sag], [fx - hw * 0.3, cy + hh * 0.93 + sag], [cx - hw * jaw * 0.92, cy + hh * 0.56 + sag]]);
    paintRegion(c, beard, scale(hair, 0.85), rnd, { angle: Math.PI / 2, len: 7, width: 2.5, count: 220, bounds });
    shadeSide(c, beard, cx - hw, cx + hw, light, 0.45, false);
    c.strokeStyle = 'rgba(40,20,20,0.8)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(fx - 10, my);
    c.lineTo(fx + 8, my - 1);
    c.stroke();
  } else if (masc && rnd() < 0.45) {
    c.save();
    c.clip(head);
    for (let i = 0; i < 260; i++) {
      const x = cx - hw + rnd() * hw * 2;
      const y = cy + hh * 0.35 + rnd() * hh * 0.55;
      c.fillStyle = css(scale(hair, 0.6), 0.25);
      c.fillRect(x, y, 1.2, 1.2);
    }
    c.restore();
  }
  ink(c, head, 2.4);

  // Hair and hats over the head.
  const crownY = cy - hh * 0.98;
  // Hair hugs the skull: from the hairline over the crown and down to the temples.
  const hairCap = (depth: number) => shape([[cx - hw * 1.03, cy - hh * 0.15], [cx - hw * 0.92, cy - hh * 0.75], [cx - hw * 0.4, crownY - hh * 0.06], [cx + hw * 0.45, crownY - hh * 0.04], [cx + hw * 0.98, cy - hh * 0.7], [cx + hw * 1.05, cy - hh * 0.2], [cx + hw * 0.75, cy - hh * depth], [cx - hw * 0.1, cy - hh * (depth + 0.06)], [cx - hw * 0.8, cy - hh * (depth - 0.05)]], 0.4);
  const paintHair = (p: Path2D) => {
    paintRegion(c, p, hair, rnd, { angle: 0.35, spread: 0.6, len: 16, width: 3.5, count: 240, vary: 0.4, bounds: [cx - hw * 1.3, crownY - 30, cx + hw * 1.3, cy + hh * 0.2] });
    shadeSide(c, p, cx - hw * 1.1, cx + hw * 1.1, light, 0.55);
    ink(c, p, 2.2, 0.7);
  };
  if (look.police) {
    const cap = shape([[cx - hw * 1.08, cy - hh * 0.55], [cx - hw * 0.95, crownY - hh * 0.1], [cx + hw * 0.95, crownY - hh * 0.08], [cx + hw * 1.08, cy - hh * 0.55]], 0.35);
    paintRegion(c, cap, [30, 40, 66], rnd, { angle: 0, len: 14, width: 5, count: 120, bounds: [0, 0, W, cy] });
    c.fillStyle = 'rgba(220,220,200,0.85)';
    c.fillRect(cx - hw * 1.05, cy - hh * 0.72, hw * 2.1, 6);
    ink(c, cap);
  } else if (k.bucketHat) {
    const crown = shape([[cx - hw * 0.95, cy - hh * 0.62], [cx - hw * 0.8, crownY - hh * 0.16], [cx + hw * 0.8, crownY - hh * 0.14], [cx + hw * 0.98, cy - hh * 0.62]], 0.4);
    const brim = shape([[cx - hw * 1.45, cy - hh * 0.5], [cx + hw * 1.5, cy - hh * 0.52], [cx + hw * 1.2, cy - hh * 0.72], [cx - hw * 1.2, cy - hh * 0.7]]);
    for (const p of [crown, brim]) {
      paintRegion(c, p, rgb(look.accent), rnd, { angle: 0.1, len: 12, width: 4, count: 120, bounds: [0, 0, W, cy] });
      shadeSide(c, p, cx - hw * 1.4, cx + hw * 1.4, light, 0.5);
      ink(c, p);
    }
  } else if (look.hairStyle === 4) {
    const beanie = shape([[cx - hw * 1.06, cy - hh * 0.42], [cx - hw * 0.95, cy - hh * 0.85], [cx, crownY - hh * 0.12], [cx + hw * 0.95, cy - hh * 0.85], [cx + hw * 1.06, cy - hh * 0.45]], 0.45);
    paintRegion(c, beanie, rgb(look.accent), rnd, { angle: Math.PI / 2, len: 8, width: 3, count: 220, bounds: [0, 0, W, cy] });
    c.fillStyle = css(scale(rgb(look.accent), 0.75));
    c.fillRect(cx - hw * 1.06, cy - hh * 0.6, hw * 2.12, hh * 0.16);
    shadeSide(c, beanie, cx - hw * 1.1, cx + hw * 1.1, light, 0.55);
    ink(c, beanie);
  } else if (look.hairStyle === 7) {
    const cap = shape([[cx - hw * 1.05, cy - hh * 0.5], [cx - hw * 0.85, crownY - hh * 0.06], [cx + hw * 0.9, crownY - hh * 0.04], [cx + hw * 1.05, cy - hh * 0.55], [cx - hw * 0.2, cy - hh * 0.42], [cx - hw * 1.5, cy - hh * 0.42]], 0.35);
    paintRegion(c, cap, scale(rgb(look.bottom), 1.3), rnd, { angle: 0.15, len: 12, width: 4, count: 140, bounds: [0, 0, W, cy] });
    shadeSide(c, cap, cx - hw * 1.5, cx + hw * 1.1, light, 0.5);
    ink(c, cap);
  } else if (k.hood !== 'up') {
    switch (look.hairStyle) {
      case 5: {
        // Shaved: a shadow of stubble over the scalp.
        c.save();
        c.clip(head);
        for (let i = 0; i < 600; i++) {
          const x = cx - hw + rnd() * hw * 2;
          const y = crownY - 10 + rnd() * hh * 0.7;
          c.fillStyle = css(scale(hair, 0.6), 0.22);
          c.fillRect(x, y, 1.3, 1.3);
        }
        c.restore();
        break;
      }
      case 3:
        paintHair(hairCap(0.62));
        break;
      case 2: {
        paintHair(hairCap(0.55));
        const bun = new Path2D();
        bun.ellipse(cx + hw * 0.1, crownY - hh * 0.18, hw * 0.34, hh * 0.2, 0, 0, Math.PI * 2);
        paintHair(bun);
        break;
      }
      case 6: {
        const tail = shape([[cx + hw * 0.9, cy - hh * 0.5], [cx + hw * 1.35, cy - hh * 0.1], [cx + hw * 1.3, cy + hh * 0.7], [cx + hw * 1.05, cy + hh * 0.5]]);
        paintHair(tail);
        paintHair(hairCap(0.5));
        break;
      }
      default:
        paintHair(hairCap(look.hairStyle === 1 ? 0.45 : 0.55));
    }
  }

  finish(c, rnd);
}

// Places

const PLACE_STYLE: Record<LocationId, { wall: number; sign: number; light: number; storeys: number }> = {
  dropIn: { wall: 0xb8a27e, sign: 0x2e7d6b, light: 0xffd89a, storeys: 3 },
  outreach: { wall: 0xd8d2c0, sign: 0x2e7d6b, light: 0xffe0a8, storeys: 1 },
  club: { wall: 0x3a2e48, sign: 0xff4fa8, light: 0xb06aff, storeys: 2 },
  pharmacy: { wall: 0xa8b4a0, sign: 0x3aa860, light: 0xd8ffd0, storeys: 3 },
  drugChecking: { wall: 0x8a9aa8, sign: 0x3a6ea8, light: 0xcfe4ff, storeys: 2 },
  shelter: { wall: 0x9a7a62, sign: 0xc8823a, light: 0xffc890, storeys: 4 },
  clinic: { wall: 0xcfd2d2, sign: 0xc83a3a, light: 0xe8f4ff, storeys: 4 },
};

/** A place: its front at night, lit windows, a glowing sign, the street in front. */
export function paintPlace(c: Ctx, id: LocationId, seed: number): void {
  const rnd = seeded(seed);
  const light = LIGHTS[seed % LIGHTS.length];
  const st = PLACE_STYLE[id];
  const W = PORTRAIT_W;
  ground(c, rnd, light, rgb(st.light));
  const wall = rgb(st.wall);
  const top = 300 - 70 - st.storeys * 52;
  const left = 34;
  const right = W - 30;
  const front = shape([[left, top], [right, top + 6], [right, 236], [left, 238]], 0.05);
  paintRegion(c, front, scale(wall, 0.6), rnd, { angle: Math.PI / 2, len: 22, width: 6, count: 360, bounds: [left, top, right, 240] });
  shadeSide(c, front, left, right, light, 0.55);
  // Lit windows, a few dark.
  for (let s = 0; s < st.storeys; s++) {
    for (let i = 0; i < 3; i++) {
      const x = left + 18 + i * ((right - left - 36) / 3);
      const y = top + 16 + s * 52;
      const lit = rnd() < 0.7;
      const win = shape([[x, y], [x + 36, y + 1], [x + 36, y + 32], [x, y + 33]], 0.05);
      paintRegion(c, win, lit ? rgb(st.light) : [30, 34, 40], rnd, { angle: Math.PI / 2, len: 10, width: 3, count: 40, bounds: [x, y, x + 36, y + 34] });
      if (lit) {
        c.save();
        c.shadowColor = css(rgb(st.light));
        c.shadowBlur = 16;
        c.fillStyle = css(rgb(st.light), 0.25);
        c.fill(win);
        c.restore();
      }
      ink(c, win, 1.8, 0.7);
    }
  }
  // Sign over the door, glowing.
  c.save();
  c.shadowColor = css(rgb(st.sign));
  c.shadowBlur = 18;
  c.fillStyle = css(rgb(st.sign), 0.9);
  c.fillRect(left + 22, 196, right - left - 44, 14);
  c.restore();
  // Door, open and warm.
  const door = shape([[W / 2 - 16, 212], [W / 2 + 16, 212], [W / 2 + 16, 238], [W / 2 - 16, 238]], 0.05);
  paintRegion(c, door, rgb(st.light), rnd, { angle: Math.PI / 2, len: 8, width: 3, count: 40, bounds: [W / 2 - 16, 212, W / 2 + 16, 238] });
  ink(c, front, 2.6);
  // Wet street, with the light spilling out.
  const street = shape([[0, 238], [W, 236], [W, 300], [0, 300]], 0.05);
  paintRegion(c, street, [30, 30, 34], rnd, { angle: 0.05, len: 30, width: 5, count: 160, bounds: [0, 236, W, 300] });
  const spill = c.createRadialGradient(W / 2, 244, 4, W / 2, 252, 90);
  spill.addColorStop(0, css(rgb(st.light), 0.45));
  spill.addColorStop(1, css(rgb(st.light), 0));
  c.fillStyle = spill;
  c.fillRect(0, 236, W, 64);
  finish(c, rnd);
}
