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
  private readonly raw = new WebGLRenderTarget(PORTRAIT_W, PORTRAIT_H, { samples: 4 });
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
        texel: { value: [1 / PORTRAIT_W, 1 / PORTRAIT_H] },
        seed: { value: 0 },
        bgA: { value: new Color() },
        bgB: { value: new Color() },
      },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc;
        uniform vec2 texel;
        uniform float seed;
        uniform vec3 bgA;
        uniform vec3 bgB;
        varying vec2 vUv;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + seed * 17.0) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) { return noise(p) * 0.55 + noise(p * 2.1) * 0.3 + noise(p * 4.3) * 0.15; }
        vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

        // Kuwahara: each pixel takes the calmest of four neighbouring patches,
        // which flattens skin and cloth into the broad dabs of an oil sketch.
        vec4 kuwahara(vec2 uv) {
          const int R = 5;
          vec4 best = vec4(0.0);
          float bestVar = 1e9;
          for (int q = 0; q < 4; q++) {
            vec2 dir = vec2(q == 1 || q == 3 ? 1.0 : -1.0, q >= 2 ? 1.0 : -1.0);
            vec4 sum = vec4(0.0);
            vec3 sq = vec3(0.0);
            for (int x = 0; x <= R; x++) for (int y = 0; y <= R; y++) {
              vec4 c = texture2D(tSrc, uv + dir * vec2(float(x), float(y)) * texel);
              sum += c;
              sq += c.rgb * c.rgb;
            }
            float n = float((R + 1) * (R + 1));
            vec4 m = sum / n;
            vec3 v = sq / n - m.rgb * m.rgb;
            float vs = v.r + v.g + v.b;
            if (vs < bestVar) { bestVar = vs; best = m; }
          }
          return best;
        }

        void main() {
          // Brush direction wobbles the lookup, so edges break up like strokes.
          vec2 p = vUv * vec2(${PORTRAIT_W.toFixed(1)}, ${PORTRAIT_H.toFixed(1)});
          float a = fbm(p * 0.035) * 6.2831;
          vec2 dirv = vec2(cos(a), sin(a));
          vec2 stroke = dirv * (fbm(p * 0.09) - 0.5) * 7.0 * texel;
          vec4 c = kuwahara(vUv + stroke);
          // People fading in or out render part-transparent: undo the blend so they read solid.
          vec3 col = toSRGB(clamp(c.rgb / max(c.a, 0.02), 0.0, 1.0));
          col = col * 0.88 + 0.07;

          // Muted palette: pull saturation down, split shadows to teal and lights to ochre.
          float l = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(l), col, 0.62);
          col = mix(col * vec3(0.78, 0.92, 0.98), col * vec3(1.08, 0.98, 0.84), smoothstep(0.15, 0.75, l));
          // Band the light, not each channel, so hues never jump.
          float lb = dot(col, vec3(0.299, 0.587, 0.114));
          col *= mix(1.0, (floor(lb * 6.0 + 0.5) / 6.0) / max(lb, 0.02), 0.6);
          // Bristle streaks along the stroke direction.
          vec2 q = vec2(dot(p, dirv), dot(p, vec2(-dirv.y, dirv.x)));
          col *= 0.9 + 0.2 * noise(vec2(q.x * 0.08, q.y * 0.9));

          // Dark contour where light changes fast: the drawn line under the paint.
          float lx = dot(texture2D(tSrc, vUv + vec2(texel.x, 0.0)).rgb - texture2D(tSrc, vUv - vec2(texel.x, 0.0)).rgb, vec3(0.33));
          float ly = dot(texture2D(tSrc, vUv + vec2(0.0, texel.y)).rgb - texture2D(tSrc, vUv - vec2(0.0, texel.y)).rgb, vec3(0.33));
          col *= 1.0 - smoothstep(0.04, 0.18, length(vec2(lx, ly))) * 0.6;

          // Background: loose diagonal strokes between two colours, rough around the figure.
          float strokes = fbm(vec2(p.x * 0.02 + p.y * 0.012, p.y * 0.06 - p.x * 0.01));
          vec3 bg = mix(bgA, bgB, smoothstep(0.25, 0.85, strokes + vUv.y * 0.35));
          float cover = smoothstep(0.05, 0.35, c.a + (fbm(p * 0.12) - 0.5) * 0.3);
          col = mix(bg, col, cover);

          // Canvas grain and a soft vignette.
          col += (noise(p * 0.7) - 0.5) * 0.035;
          vec2 d = vUv - 0.5;
          col *= 1.0 - dot(d, d) * 0.7;
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

    const hue = (seed % 360) / 360;
    (this.paint.uniforms.bgA.value as Color).setHSL(hue, 0.14, 0.13);
    (this.paint.uniforms.bgB.value as Color).setHSL((hue + 0.1) % 1, 0.2, 0.3);
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
