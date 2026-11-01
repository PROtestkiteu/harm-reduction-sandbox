import { BufferAttribute, BufferGeometry, CanvasTexture, Color, Points, SRGBColorSpace, ShaderMaterial, Vector2, type Object3D } from 'three';
import type { SeasonProfile } from '../config/seasons';

type Drift = SeasonProfile['look']['drift'];
type Kind = Exclude<Drift, 'none'>;

/**
 * How each kind of drift looks and moves. Sizes are in metres, so flakes
 * shrink when zoomed out and grow when zoomed in, within a pixel range that
 * keeps them from turning into dust or blobs.
 */
const KINDS: Record<Kind, { count: number; colours: number[]; size: [number, number]; px: [number, number]; fall: number; sway: number; spin: number }> = {
  snow: { count: 2200, colours: [0xf4f6fa, 0xe6ebf4, 0xdde4f0], size: [0.16, 0.42], px: [1.5, 8], fall: 1.0, sway: 0.45, spin: 0 },
  leaves: { count: 140, colours: [0xc0622a, 0xa8481e, 0xd8a03a, 0x8a5a2a, 0xb83a22], size: [0.4, 0.65], px: [4, 16], fall: 0.55, sway: 1.5, spin: 2.2 },
  petals: { count: 150, colours: [0xf6d2dc, 0xfbe8ee, 0xf0b8c8], size: [0.09, 0.16], px: [2, 8], fall: 0.4, sway: 1.1, spin: 1.4 },
};

/** The shape of one particle, white so each gets its own colour: a soft flake, a leaf with a stem, a petal. */
function sprite(kind: Kind): CanvasTexture {
  const n = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const c = canvas.getContext('2d')!;
  c.translate(n / 2, n / 2);
  if (kind === 'snow') {
    // A bright core in a soft halo: reads as a flake, not a dot, at any size.
    const g = c.createRadialGradient(0, 0, 0, 0, 0, n / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(-n / 2, -n / 2, n, n);
  } else if (kind === 'leaves') {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(0, -26);
    c.bezierCurveTo(18, -16, 16, 12, 0, 22);
    c.bezierCurveTo(-16, 12, -18, -16, 0, -26);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.3)';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -22); c.lineTo(0, 29); c.stroke();
    c.lineWidth = 1.2;
    for (const y of [-10, 0, 10]) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(9, y - 7); c.stroke();
      c.beginPath(); c.moveTo(0, y); c.lineTo(-9, y - 7); c.stroke();
    }
  } else {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(0, 2, 15, 22, 0, 0, Math.PI * 2);
    c.fill();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.arc(0, -24, 8, 0, Math.PI * 2);
    c.fill();
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

const SPAN = 70;
const TOP = 26;

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aSeed;
  attribute vec3 aColor;
  uniform float uViewH;
  uniform vec2 uPx;
  uniform float uTime;
  uniform float uSpin;
  uniform vec2 uCenter;
  uniform float uFall;
  uniform float uSway;
  uniform vec2 uBox;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vAngle;
  void main() {
    // Each particle falls at its own pace and sways on its own rhythm, wrapping
    // round the view: worked out here from the time, so the CPU moves nothing.
    float s = aSeed * 100.0;
    float pace = 0.7 + fract(s) * 0.6;
    vec3 p = position;
    p.y = mod(p.y - uFall * pace * uTime, uBox.y);
    p.x += sin(uTime * 0.9 + s) * uSway * 1.1;
    p.z += cos(uTime * 0.7 + s * 1.3) * uSway * 0.85;
    p.x = uCenter.x + mod(p.x - uCenter.x + uBox.x * 0.5, uBox.x) - uBox.x * 0.5;
    p.z = uCenter.y + mod(p.z - uCenter.y + uBox.x * 0.5, uBox.x) - uBox.x * 0.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // Orthographic: projectionMatrix[1][1] is 2 / view height in metres.
    float px = aSize * projectionMatrix[1][1] * uViewH * 0.5;
    gl_PointSize = clamp(px, uPx.x, uPx.y);
    // Below its smallest size a flake fades rather than staying a fixed dot.
    vAlpha = aAlpha * clamp(px / uPx.x, 0.6, 1.0);
    vColor = aColor;
    vAngle = aSeed * 6.2832 + uTime * uSpin * (fract(aSeed * 7.3) - 0.5) * 2.0;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uSpin;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vAngle;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vAngle);
    float s = sin(vAngle);
    // Tumbling: turned, and squashed across as it flips.
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    if (uSpin > 0.0) p.x /= max(0.25, abs(cos(vAngle * 0.7)));
    vec4 t = texture2D(uMap, p + 0.5);
    float a = t.a * vAlpha;
    if (a < 0.04 || abs(p.x) > 0.5) discard;
    gl_FragColor = vec4(vColor * t.rgb, a);
    #include <colorspace_fragment>
  }
`;

/**
 * Whatever drifts through the air this season: snow in winter, turning
 * leaves in autumn, blossom petals in spring. One points cloud (one draw
 * call) that follows the view and wraps around it, so its cost does not grow
 * with the district. Each particle has its own size, brightness and colour;
 * leaves and petals tumble. All motion is worked out on the GPU from the time.
 * Paused when reduced motion is preferred.
 */
export class Weather {
  private readonly geometry = new BufferGeometry();
  private readonly material = new ShaderMaterial({
    uniforms: {
      uMap: { value: null },
      uViewH: { value: 600 },
      uPx: { value: new Vector2(1, 6) },
      uTime: { value: 0 },
      uSpin: { value: 0 },
      uCenter: { value: new Vector2() },
      uFall: { value: 1 },
      uSway: { value: 0 },
      uBox: { value: new Vector2(SPAN, TOP) },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  private readonly points = new Points(this.geometry, this.material);
  private readonly size = new Vector2();
  private kind: Drift = 'none';
  private time = 0;

  constructor(parent: Object3D) {
    this.points.visible = false;
    this.points.frustumCulled = false;
    this.points.raycast = () => {};
    // Sizes are in metres: the shader needs the drawing buffer's height to turn them into pixels.
    this.points.onBeforeRender = (renderer) => {
      this.material.uniforms.uViewH.value = renderer.getDrawingBufferSize(this.size).y;
    };
    parent.add(this.points);
  }

  set(kind: Drift): void {
    if (kind === this.kind) return;
    this.kind = kind;
    this.points.visible = kind !== 'none';
    if (kind === 'none') return;
    const k = KINDS[kind];
    const pos = new Float32Array(k.count * 3);
    const size = new Float32Array(k.count);
    const alpha = new Float32Array(k.count);
    const colour = new Float32Array(k.count * 3);
    const seeds = new Float32Array(k.count);
    const palette = k.colours.map((c) => new Color(c));
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < k.count; i++) {
      pos[i * 3] = (rnd() - 0.5) * SPAN;
      pos[i * 3 + 1] = rnd() * TOP;
      pos[i * 3 + 2] = (rnd() - 0.5) * SPAN;
      // Mostly small, a few large: skewed towards the low end.
      size[i] = k.size[0] + (k.size[1] - k.size[0]) * rnd() ** 2;
      alpha[i] = 0.55 + rnd() * 0.4;
      palette[Math.floor(rnd() * palette.length)].toArray(colour, i * 3);
      seeds[i] = rnd();
    }
    this.geometry.setAttribute('position', new BufferAttribute(pos, 3));
    this.geometry.setAttribute('aSize', new BufferAttribute(size, 1));
    this.geometry.setAttribute('aAlpha', new BufferAttribute(alpha, 1));
    this.geometry.setAttribute('aColor', new BufferAttribute(colour, 3));
    this.geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    const u = this.material.uniforms;
    (u.uMap.value as CanvasTexture | null)?.dispose();
    u.uMap.value = sprite(kind);
    u.uPx.value.set(k.px[0], k.px[1]);
    u.uSpin.value = k.spin;
    u.uFall.value = k.fall;
    u.uSway.value = k.sway;
  }

  /** Centre of the area in view, so the drift always fills the screen. */
  follow(x: number, z: number): void {
    (this.material.uniforms.uCenter.value as Vector2).set(x, z);
  }

  update(dt: number, still: boolean): void {
    if (this.kind === 'none' || still) return;
    this.time += dt;
    this.material.uniforms.uTime.value = this.time;
  }
}
