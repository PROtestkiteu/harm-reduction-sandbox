import { BufferAttribute, BufferGeometry, CanvasTexture, Points, PointsMaterial, SRGBColorSpace, type Object3D } from 'three';
import type { SeasonProfile } from '../config/seasons';

type Drift = SeasonProfile['look']['drift'];

/** How each kind of drift looks and moves: colour, size in pixels, fall speed, sway. */
const KINDS: Record<Exclude<Drift, 'none'>, { count: number; color: number; size: number; fall: number; sway: number }> = {
  snow: { count: 2600, color: 0xe8ecf4, size: 3.2, fall: 1.1, sway: 0.5 },
  leaves: { count: 90, color: 0x9a5426, size: 7, fall: 0.6, sway: 1.6 },
  petals: { count: 140, color: 0xf0c8d4, size: 5, fall: 0.45, sway: 1.2 },
};

/**
 * The shape of one particle: a soft round flake, or a small leaf or petal
 * outline. Square dots read as rain in lamplight.
 */
function sprite(kind: Exclude<Drift, 'none'>): CanvasTexture {
  const n = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const c = canvas.getContext('2d')!;
  if (kind === 'snow') {
    const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, n, n);
  } else {
    c.translate(n / 2, n / 2);
    c.rotate(kind === 'leaves' ? 0.7 : 0.3);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(0, 0, kind === 'leaves' ? 13 : 9, kind === 'leaves' ? 6 : 6, 0, 0, Math.PI * 2);
    c.fill();
    if (kind === 'leaves') {
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(-12, 0); c.lineTo(12, 0); c.stroke();
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

const SPAN = 70;
const TOP = 26;

/**
 * Whatever drifts through the air this season: snow in winter, a few turning
 * leaves in autumn, blossom petals in spring. One points cloud (one draw
 * call) that follows the view and wraps around it, so its cost does not grow
 * with the district. Paused when reduced motion is preferred.
 */
export class Weather {
  private readonly geometry = new BufferGeometry();
  private readonly material = new PointsMaterial({ sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false });
  private readonly points = new Points(this.geometry, this.material);
  private seeds = new Float32Array(0);
  private kind: Drift = 'none';
  private cx = 0;
  private cz = 0;
  private time = 0;

  constructor(parent: Object3D) {
    this.points.visible = false;
    this.points.frustumCulled = false;
    this.points.raycast = () => {};
    parent.add(this.points);
  }

  set(kind: Drift): void {
    if (kind === this.kind) return;
    this.kind = kind;
    this.points.visible = kind !== 'none';
    if (kind === 'none') return;
    const k = KINDS[kind];
    const pos = new Float32Array(k.count * 3);
    this.seeds = new Float32Array(k.count);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < k.count; i++) {
      pos[i * 3] = (rnd() - 0.5) * SPAN;
      pos[i * 3 + 1] = rnd() * TOP;
      pos[i * 3 + 2] = (rnd() - 0.5) * SPAN;
      this.seeds[i] = rnd() * 100;
    }
    this.geometry.setAttribute('position', new BufferAttribute(pos, 3));
    this.material.color.setHex(k.color);
    this.material.size = k.size;
    this.material.map?.dispose();
    this.material.map = sprite(kind);
    this.material.alphaTest = kind === 'snow' ? 0 : 0.5;
    this.material.needsUpdate = true;
  }

  /** Centre of the area in view, so the drift always fills the screen. */
  follow(x: number, z: number): void {
    this.cx = x;
    this.cz = z;
  }

  update(dt: number, still: boolean): void {
    if (this.kind === 'none' || still) return;
    this.time += dt;
    const k = KINDS[this.kind];
    const attr = this.geometry.getAttribute('position') as BufferAttribute;
    const p = attr.array as Float32Array;
    const half = SPAN / 2;
    for (let i = 0; i < k.count; i++) {
      const s = this.seeds[i];
      const j = i * 3;
      p[j + 1] -= k.fall * (0.7 + (s % 1) * 0.6) * dt;
      p[j] += Math.sin(this.time * 0.9 + s) * k.sway * dt;
      p[j + 2] += Math.cos(this.time * 0.7 + s * 1.3) * k.sway * 0.6 * dt;
      if (p[j + 1] < 0) p[j + 1] += TOP;
      // Wrap around the view centre.
      if (p[j] - this.cx > half) p[j] -= SPAN; else if (p[j] - this.cx < -half) p[j] += SPAN;
      if (p[j + 2] - this.cz > half) p[j + 2] -= SPAN; else if (p[j + 2] - this.cz < -half) p[j + 2] += SPAN;
    }
    attr.needsUpdate = true;
  }
}
