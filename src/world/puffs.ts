import { BufferAttribute, BufferGeometry, Points, ShaderMaterial, type Object3D } from 'three';
import { dynamic } from './mergeStatic';

/**
 * Small puffs in the air: exhaust from the cars and buses, thicker on cold
 * nights, and grit kicked up when a vehicle brakes or pulls away on a dry
 * road. One point cloud for all of them (one draw call), a fixed ring of slots
 * reused oldest first, so nothing is allocated while the game runs and a busy
 * street can never pile up more than the ring holds. Nothing is emitted under
 * reduced motion.
 */

const CAPACITY = 360;

const VERTEX = /* glsl */ `
  attribute vec4 aLife;   // age, life, start size (m), growth (m per life)
  attribute vec4 aTint;   // rgb, peak alpha
  uniform float uPxPerMetre;
  varying vec4 vTint;
  varying float vFade;
  void main() {
    float k = clamp(aLife.x / max(aLife.y, 0.001), 0.0, 1.0);
    // In fast, out slow: a puff is thickest just after it leaves the pipe.
    vFade = aLife.y > 0.0 ? smoothstep(0.0, 0.1, k) * (1.0 - k) : 0.0;
    vTint = aTint;
    gl_PointSize = max(1.0, (aLife.z + aLife.w * k) * uPxPerMetre);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAGMENT = /* glsl */ `
  varying vec4 vTint;
  varying float vFade;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = dot(c, c) * 4.0;
    if (r > 1.0 || vFade <= 0.0) discard;
    // A soft falloff from the middle, so a puff reads as a wisp rather than a disc.
    float soft = (1.0 - r) * (1.0 - r) * (1.0 - r);
    gl_FragColor = vec4(vTint.rgb, vTint.a * vFade * soft);
  }
`;

export type PuffKind = 'exhaust' | 'dust';
/** A vehicle's own puff timer and its speed last frame. */
export interface Tailpipe { t: number; v: number }
const TINT: Record<PuffKind, [number, number, number]> = { exhaust: [0.72, 0.74, 0.76], dust: [0.52, 0.45, 0.36] };

export class Puffs {
  readonly points: Points;
  private readonly pos = new Float32Array(CAPACITY * 3);
  private readonly vel = new Float32Array(CAPACITY * 3);
  private readonly life = new Float32Array(CAPACITY * 4);
  private readonly tint = new Float32Array(CAPACITY * 4);
  private readonly material: ShaderMaterial;
  private next = 0;
  private alive = 0;
  /** How thick exhaust shows: cold air makes it visible (0.3 summer to 1 deep winter). */
  cold = 0.6;
  /** Wet roads raise no grit. */
  wet = 0;
  /** Reduced motion: nothing new is emitted. */
  still = false;

  constructor(parent: Object3D) {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    geo.setAttribute('aLife', new BufferAttribute(this.life, 4));
    geo.setAttribute('aTint', new BufferAttribute(this.tint, 4));
    this.material = new ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms: { uPxPerMetre: { value: 20 } }, transparent: true, depthWrite: false });
    this.points = new Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    this.points.raycast = () => {};
    parent.add(dynamic(this.points));
  }

  /** Only what is near the view is worth a slot: centre and radius in world metres. */
  private view = { x: 0, z: 0, r2: 1e9 };
  setView(x: number, z: number, radius: number): void {
    this.view.x = x;
    this.view.z = z;
    this.view.r2 = radius * radius;
  }

  /**
   * A vehicle at (x, z) heading (hx, hz) at `v` m/s: exhaust now and then (more
   * often while it idles), and grit as it pulls away from a stop or pulls up at one.
   */
  vehicle(pipe: Tailpipe, x: number, z: number, hx: number, hz: number, v: number, dt: number, big = false): void {
    const was = pipe.v;
    pipe.v = v;
    if ((x - this.view.x) ** 2 + (z - this.view.z) ** 2 > this.view.r2) return;
    if ((was < 1 && v >= 1) || (was >= 1 && v < 1)) this.dust(x, z, hx, hz, big);
    pipe.t -= dt;
    if (pipe.t > 0) return;
    pipe.t = (v < 0.5 ? 0.5 : 0.3) * (0.8 + Math.random() * 0.4);
    this.exhaust(x, z, hx, hz, v, big);
  }

  /** Screen pixels per world metre at the current zoom. */
  setPixelSize(worldPerPixel: number, dpr: number): void {
    this.material.uniforms.uPxPerMetre.value = dpr / Math.max(1e-4, worldPerPixel);
  }

  /** One puff at (x, y, z), drifting at (vx, vy, vz) m/s, for `life` seconds, `size` m growing by `grow`. */
  emit(kind: PuffKind, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, grow: number, alpha: number): void {
    if (this.still) return;
    const i = this.next;
    this.next = (this.next + 1) % CAPACITY;
    if (this.life[i * 4 + 1] <= 0) this.alive++;
    const p = i * 3;
    const l = i * 4;
    this.pos[p] = x; this.pos[p + 1] = y; this.pos[p + 2] = z;
    this.vel[p] = vx; this.vel[p + 1] = vy; this.vel[p + 2] = vz;
    this.life[l] = 0; this.life[l + 1] = life; this.life[l + 2] = size; this.life[l + 3] = grow;
    const t = TINT[kind];
    this.tint[l] = t[0]; this.tint[l + 1] = t[1]; this.tint[l + 2] = t[2]; this.tint[l + 3] = alpha;
  }

  /** Exhaust from a vehicle's tail at (x, z), its heading (hx, hz), at `speed` m/s; `big` for a bus. */
  exhaust(x: number, z: number, hx: number, hz: number, speed: number, big = false): void {
    const back = big ? 4.6 : 2.3;
    const side = big ? 0.8 : 0.45;
    const a = (0.16 + 0.3 * this.cold) * (speed < 0.5 ? 1.2 : 1);
    this.emit('exhaust', x - hx * back + hz * side, 0.32, z - hz * back - hx * side,
      -hx * (0.3 + speed * 0.08) + (Math.random() - 0.5) * 0.2, 0.1 + Math.random() * 0.08, -hz * (0.3 + speed * 0.08) + (Math.random() - 0.5) * 0.2,
      1.0 + this.cold * 0.7, big ? 0.28 : 0.18, big ? 0.6 : 0.38, a);
  }

  /** Grit from the wheels of a vehicle braking or pulling away at (x, z) with heading (hx, hz). */
  dust(x: number, z: number, hx: number, hz: number, big = false): void {
    if (this.wet > 0.5) return;
    const a = 0.4 * (1 - this.wet);
    for (let s = -1; s <= 1; s += 2) {
      const wx = x + hz * s * (big ? 1.1 : 0.8) - hx * (big ? 3 : 1.3);
      const wz = z - hx * s * (big ? 1.1 : 0.8) - hz * (big ? 3 : 1.3);
      this.emit('dust', wx, 0.12, wz, hz * s * 0.5 + (Math.random() - 0.5) * 0.3, 0.15, -hx * s * 0.5 + (Math.random() - 0.5) * 0.3, 1.0, 0.25, 0.7, a);
    }
  }

  update(dt: number): void {
    if (this.alive === 0) return;
    let alive = 0;
    for (let i = 0; i < CAPACITY; i++) {
      const l = i * 4;
      const life = this.life[l + 1];
      if (life <= 0) continue;
      const age = this.life[l] + dt;
      if (age >= life) { this.life[l + 1] = 0; continue; }
      this.life[l] = age;
      alive++;
      const p = i * 3;
      // Drift, slowing as the puff mixes into the air; rising stays on longest.
      const drag = Math.exp(-dt * 1.6);
      this.vel[p] *= drag;
      this.vel[p + 2] *= drag;
      this.vel[p + 1] *= Math.exp(-dt * 0.6);
      this.pos[p] += this.vel[p] * dt;
      this.pos[p + 1] += this.vel[p + 1] * dt;
      this.pos[p + 2] += this.vel[p + 2] * dt;
    }
    this.alive = alive;
    const geo = this.points.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aLife.needsUpdate = true;
    geo.attributes.aTint.needsUpdate = true;
  }
}
