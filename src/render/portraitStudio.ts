import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderTarget,
  type Material,
  type Object3D,
  type WebGLRenderer,
} from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const PORTRAIT_W = 240;
export const PORTRAIT_H = 300;

/**
 * Painted portraits of the people in the scene, made apart from the city: the
 * person's own sculpted model is cloned into a small lit studio, rendered head
 * and shoulders, then painted over in one shader pass, in the loose, muted
 * oil style of Disco Elysium's character art. Nothing of the city is captured.
 *
 * A portrait costs one small render and one read-back, once per person; the
 * caller keeps the result.
 */
export class PortraitStudio {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(20, PORTRAIT_W / PORTRAIT_H, 0.1, 20);
  /** The sitter at twice the portrait's size: the brush has detail to follow and to lose. */
  private readonly raw = new WebGLRenderTarget(PORTRAIT_W * 2, PORTRAIT_H * 2, { samples: 4 });
  private readonly painted = new WebGLRenderTarget(PORTRAIT_W, PORTRAIT_H);
  private readonly quadScene = new Scene();
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly paint: ShaderMaterial;
  private readonly pixels = new Uint8Array(PORTRAIT_W * PORTRAIT_H * 4);
  private readonly clear = new Color();

  constructor(private readonly renderer: WebGLRenderer) {
    // Warm key from the front left, cold rim from behind: the street at night.
    const key = new DirectionalLight(0xffd2a0, 4.2);
    key.position.set(-1.6, 1.4, 1.6);
    const rim = new DirectionalLight(0x6aa8d8, 3.0);
    rim.position.set(1.8, 1.0, -1.2);
    const fill = new AmbientLight(0x7a7080, 0.85);
    this.scene.add(key, rim, fill);

    this.paint = new ShaderMaterial({
      uniforms: {
        tSrc: { value: this.raw.texture },
        texel: { value: [1 / (PORTRAIT_W * 2), 1 / (PORTRAIT_H * 2)] },
        seed: { value: 0 },
        bgA: { value: new Color() },
        bgB: { value: new Color() },
        accent: { value: new Color() },
      },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc;
        uniform vec2 texel;
        uniform float seed;
        uniform vec3 bgA;
        uniform vec3 bgB;
        uniform vec3 accent;
        varying vec2 vUv;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + seed * 17.0) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) { return noise(p) * 0.55 + noise(p * 2.1) * 0.3 + noise(p * 4.3) * 0.15; }
        vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
        float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

        // The way the form runs here (across the light's gradient), so strokes follow the face.
        vec2 flowAt(vec2 uv) {
          float gx = luma(texture2D(tSrc, uv + vec2(texel.x * 3.0, 0.0)).rgb) - luma(texture2D(tSrc, uv - vec2(texel.x * 3.0, 0.0)).rgb);
          float gy = luma(texture2D(tSrc, uv + vec2(0.0, texel.y * 3.0)).rgb) - luma(texture2D(tSrc, uv - vec2(0.0, texel.y * 3.0)).rgb);
          vec2 g = vec2(gx, gy);
          return length(g) > 1e-4 ? normalize(vec2(-g.y, g.x)) : vec2(0.7071, 0.7071);
        }

        // Eight-sector Kuwahara along the flow: each pixel takes the calmest wedge round it, which
        // lays skin and cloth down in broad, directional dabs, like a loaded oil brush.
        vec4 paintAt(vec2 uv, vec2 flow) {
          vec2 side = vec2(-flow.y, flow.x);
          vec4 best = vec4(0.0);
          float bestVar = 1e9;
          for (int k = 0; k < 8; k++) {
            float a = float(k) * 0.7854;
            vec2 dir = flow * cos(a) + side * sin(a);
            vec2 dir2 = flow * cos(a + 0.7854) + side * sin(a + 0.7854);
            vec4 sum = vec4(0.0);
            vec3 sq = vec3(0.0);
            for (int i = 1; i <= 5; i++) for (int j = 0; j <= 2; j++) {
              vec2 o = mix(dir, dir2, float(j) * 0.5) * float(i) * 1.8;
              // Longer along the flow than across it: strokes, not blobs.
              o = flow * dot(o, flow) * 1.6 + side * dot(o, side) * 0.6;
              vec4 c = texture2D(tSrc, uv + o * texel);
              sum += c;
              sq += c.rgb * c.rgb;
            }
            vec4 m = sum / 15.0;
            vec3 v = sq / 15.0 - m.rgb * m.rgb;
            float vs = v.r + v.g + v.b;
            if (vs < bestVar) { bestVar = vs; best = m; }
          }
          return best;
        }

        void main() {
          vec2 p = vUv * vec2(${PORTRAIT_W.toFixed(1)}, ${PORTRAIT_H.toFixed(1)});
          vec2 flow = flowAt(vUv);
          // The brush wanders a little off true, so edges break up into strokes.
          vec2 wobble = flow * (fbm(p * 0.08) - 0.5) * 9.0 * texel + vec2(-flow.y, flow.x) * (fbm(p * 0.05 + 3.0) - 0.5) * 4.0 * texel;
          vec4 c = paintAt(vUv + wobble, flow);
          // People fading in or out render part-transparent: undo the blend so they read solid.
          vec3 col = toSRGB(clamp(c.rgb / max(c.a, 0.02), 0.0, 1.0));
          float l = luma(col);

          // Planes of light, not gradients: the face is laid in as a few flat values, edges a touch soft.
          float steps = 5.0;
          float lb = floor(l * steps + 0.5 + (fbm(p * 0.06) - 0.5) * 0.6) / steps;
          col *= mix(1.0, lb / max(l, 0.02), 0.7);
          l = luma(col);

          // Expressionist light: shadows cool (violet, teal), lights warm (ochre, peach),
          // and the sitter's own accent bleeding into the half-tones.
          // Lift the dark first: the street at night renders people dim, a portrait needs a face.
          col = pow(col, vec3(0.7)) * 1.1;
          l = luma(col);
          vec3 shadow = vec3(0.7, 0.68, 0.9);
          vec3 light = vec3(1.1, 1.0, 0.82);
          col *= mix(shadow, light, smoothstep(0.15, 0.75, l));
          float half_ = 1.0 - abs(l - 0.45) * 2.4;
          col = mix(col, col * 0.6 + accent * 0.5, clamp(half_, 0.0, 1.0) * 0.28);
          // Richer colour than the muted street, but never neon.
          float lc = luma(col);
          col = mix(vec3(lc), col, 1.25);

          // Bristle marks along the stroke, and the odd heavier dab.
          vec2 q = vec2(dot(p, flow), dot(p, vec2(-flow.y, flow.x)));
          col *= 0.86 + 0.26 * noise(vec2(q.x * 0.06, q.y * 1.1));
          col *= 0.94 + 0.12 * step(0.72, noise(p * 0.11));

          // A dark dry-brush contour where the form turns, broken by the canvas.
          vec2 e = texel * 2.0;
          float lx = luma(texture2D(tSrc, vUv + vec2(e.x, 0.0)).rgb) - luma(texture2D(tSrc, vUv - vec2(e.x, 0.0)).rgb);
          float ly = luma(texture2D(tSrc, vUv + vec2(0.0, e.y)).rgb) - luma(texture2D(tSrc, vUv - vec2(0.0, e.y)).rgb);
          float edge = smoothstep(0.05, 0.2, length(vec2(lx, ly))) * step(0.35, noise(p * 0.5));
          col = mix(col, col * vec3(0.32, 0.26, 0.36), edge * 0.75);

          // Background: big streaky strokes in two colours, the sitter's edge dissolving into them.
          vec2 bq = vec2(p.x * 0.018 + p.y * 0.01, p.y * 0.05 - p.x * 0.012);
          float strokes = fbm(bq) + 0.25 * noise(vec2(bq.x * 9.0, bq.y * 0.6));
          vec3 bg = mix(bgA, bgB, smoothstep(0.3, 0.9, strokes + vUv.y * 0.3));
          bg = mix(bg, accent * 0.45, step(0.82, fbm(bq * 1.7 + 5.0)) * 0.35);
          float cover = smoothstep(0.1, 0.45, c.a + (fbm(p * 0.09) - 0.5) * 0.45);
          col = mix(bg, col, cover);

          // Canvas weave and a dark, uneven vignette.
          col *= 0.96 + 0.08 * (noise(vec2(p.x * 1.4, p.y * 0.2)) * noise(vec2(p.x * 0.2, p.y * 1.4)));
          vec2 d = vUv - 0.5;
          col *= 1.0 - dot(d, d) * (0.8 + 0.4 * fbm(p * 0.02));
          gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.quadScene.add(new Mesh(new PlaneGeometry(2, 2), this.paint));
  }

  /**
   * Paints `figure` (a person's model root) into `out`. `height` is the
   * person's height in metres, which frames the head; `seed` varies the brush.
   */
  portrait(figure: Object3D, height: number, seed: number, out: CanvasRenderingContext2D): void {
    const sitter = cloneSkinned(figure);
    sitter.position.set(0, 0, 0);
    // A three-quarter view, turned a little toward the key light.
    sitter.rotation.set(0, -0.45 + ((seed % 7) - 3) * 0.04, 0);
    sitter.visible = true;
    // Sit them fully opaque, even if they were fading in or out on the street;
    // materials are the person's own, so their state is put back after.
    const restore: (() => void)[] = [];
    sitter.traverse((o) => {
      o.visible = true;
      o.frustumCulled = false;
      (o as Mesh).castShadow = false;
      const m = (o as Mesh).material as Material | Material[] | undefined;
      for (const mat of m ? (Array.isArray(m) ? m : [m]) : []) {
        const { opacity, transparent } = mat;
        if (opacity === 1 && !transparent) continue;
        mat.opacity = 1;
        mat.transparent = false;
        restore.push(() => { mat.opacity = opacity; mat.transparent = transparent; });
      }
    });
    this.scene.add(sitter);
    this.scene.updateMatrixWorld(true);
    // Frame on the head bone, so sitting, crouching and walking people all land in frame.
    let head: Object3D | undefined;
    sitter.traverse((o) => { if (!head && (o as { isBone?: boolean }).isBone && /head/i.test(o.name) && !/end|top/i.test(o.name)) head = o; });
    const at = new Vector3(0, height * 0.9, 0);
    if (head) head.getWorldPosition(at);
    // The head bone sits at the base of the skull: the face is a little above it.
    const face = at.y + 0.09;
    this.camera.position.set(at.x + 0.1, face + 0.03, at.z + 1.2);
    this.camera.lookAt(at.x, face - 0.08, at.z);

    const r = this.renderer;
    const target = r.getRenderTarget();
    const alpha = r.getClearAlpha();
    r.getClearColor(this.clear);
    const shadows = r.shadowMap.enabled;
    r.shadowMap.enabled = false;
    r.setRenderTarget(this.raw);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(this.scene, this.camera);

    // Each sitter's own dark ground and accent: a hue, its neighbour, and its complement.
    const hue = (seed % 360) / 360;
    (this.paint.uniforms.bgA.value as Color).setHSL(hue, 0.22, 0.1);
    (this.paint.uniforms.bgB.value as Color).setHSL((hue + 0.08) % 1, 0.3, 0.26);
    (this.paint.uniforms.accent.value as Color).setHSL((hue + 0.5) % 1, 0.55, 0.5);
    this.paint.uniforms.seed.value = (seed % 1000) / 97;
    r.setRenderTarget(this.painted);
    r.render(this.quadScene, this.quadCamera);
    r.readRenderTargetPixels(this.painted, 0, 0, PORTRAIT_W, PORTRAIT_H, this.pixels);

    r.setRenderTarget(target);
    r.setClearColor(this.clear, alpha);
    r.shadowMap.enabled = shadows;
    this.scene.remove(sitter);
    for (const undo of restore) undo();

    // Read-back rows run bottom to top.
    const image = out.createImageData(PORTRAIT_W, PORTRAIT_H);
    const row = PORTRAIT_W * 4;
    for (let y = 0; y < PORTRAIT_H; y++) image.data.set(this.pixels.subarray((PORTRAIT_H - 1 - y) * row, (PORTRAIT_H - y) * row), y * row);
    out.putImageData(image, 0, 0);
  }
}
