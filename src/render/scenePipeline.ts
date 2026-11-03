import {
  AdditiveBlending,
  DepthTexture,
  GLSL3,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  NoToneMapping,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  UnsignedIntType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import { PALETTE } from '../config/palette';
import { chooseFrame, type RenderFrame } from './frame';
import { HOVER_LAYER, SELECT_LAYER } from './highlight';
import { GpuTimer, TIER_SETTINGS, type QualityTier } from './renderQuality';

const srgb = (hex: number) => new Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);

const SKY = {
  top: srgb(PALETTE.skyTop), mid: srgb(PALETTE.skyMid), horizon: srgb(PALETTE.skyHorizon),
  topNight: srgb(PALETTE.skyTopNight), midNight: srgb(PALETTE.skyMidNight), horizonNight: srgb(PALETTE.skyHorizonNight),
  topDay: srgb(0x8aa2bc), midDay: srgb(0xb4c2cc), horizonDay: srgb(0xd4d2c8),
};

const FULLSCREEN = /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/**
 * The finishing pass per quality tier. High is the full look; Ultra adds to it; lower tiers take
 * fewer taps for crease shading, wet reflections and glow, with gains that
 * keep their overall strength (the sums of the dropped taps' weights).
 */
const COMPOSITE_DEFINES: Record<QualityTier, Record<string, string>> = {
  // Twice the crease-shading directions (smoother, finer creases) and a light sharpening of the scene.
  ultra: { AO_DIRS: '8', AO_STEPS: '2', REFL_STRIDE: '1', REFL_GAIN: '1.0', GLOW_STRIDE: '1', GLOW_RINGS: '2', GLOW_GAIN: '1.0', SHARPEN: '0.35' },
  high: { AO_DIRS: '4', AO_STEPS: '2', REFL_STRIDE: '1', REFL_GAIN: '1.0', GLOW_STRIDE: '1', GLOW_RINGS: '2', GLOW_GAIN: '1.0' },
  // 8 depth reads for creases (outer ring), 3 reflection and 8 glow taps.
  medium: { AO_DIRS: '4', AO_STEPS: '1', REFL_STRIDE: '2', REFL_GAIN: '2.3333', GLOW_STRIDE: '2', GLOW_RINGS: '2', GLOW_GAIN: '2.0' },
  // 8 depth reads, 2 reflection and 4 glow taps.
  low: { AO_DIRS: '4', AO_STEPS: '1', REFL_STRIDE: '3', REFL_GAIN: '4.2', GLOW_STRIDE: '2', GLOW_RINGS: '1', GLOW_GAIN: '3.2' },
};

/**
 * Clean, crisp scene rendering with a light finishing pass:
 *
 * 1. The scene renders at full resolution into a 4x multisampled linear HDR
 *    target with depth (plus, only while something is hovered or selected, a
 *    small mask pass).
 * 2. One composite pass adds crease shading from depth (ambient occlusion
 *    that grounds walls and props), tone mapping, a muted warm/cool grade and
 *    a light vignette, paints the dusk sky into empty pixels, and draws soft
 *    rims around hovered and selected things. No blur or filter over the image.
 */
export class ScenePipeline {
  private readonly colorTarget = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    generateMipmaps: false,
    depthBuffer: true,
    samples: 4,
  });
  /** Hover (red) and selection (green) silhouettes with their own depth. */
  private readonly maskTarget = new WebGLRenderTarget(1, 1, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    generateMipmaps: false,
    depthBuffer: true,
  });
  /**
   * The sun's shadow map is redrawn every other frame (every third or fourth
   * on lower quality tiers): people move a few centimetres a frame, which a
   * frame-old shadow does not show, and the pass costs about as many draw
   * calls again as the scene. It is redrawn at once
   * when the view or the light changes, so a pan or a new hour never lags.
   */
  private shadowFrame = 0;
  private shadowsStale = true;
  private readonly hoverMaterial = new MeshBasicMaterial({ color: 0xff0000 });
  private readonly selectMaterial = new MeshBasicMaterial({ color: 0x00ff00, blending: AdditiveBlending, transparent: true });
  private readonly quadScene = new Scene();
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  /** The finishing pass, one compiled variant per quality tier, sharing one set of uniforms. */
  private readonly composites: Record<QualityTier, ShaderMaterial>;
  private composite: ShaderMaterial;
  private readonly quad: Mesh;
  private tier: QualityTier = 'high';
  private readonly gpuTimer: GpuTimer;
  frame: RenderFrame = chooseFrame(1, 1, 1);

  constructor(private readonly renderer: WebGLRenderer) {
    renderer.toneMapping = NoToneMapping;
    renderer.shadowMap.autoUpdate = false;
    // Half floats need a colour-buffer extension (iOS 15.4+ exposes only the half-float one). Without
    // either the target would be incomplete and the city black: 8 bits instead, clamped highlights.
    if (!renderer.extensions.has('EXT_color_buffer_half_float') && !renderer.extensions.has('EXT_color_buffer_float')) {
      this.colorTarget.texture.type = UnsignedByteType;
    }
    const depth = new DepthTexture(1, 1);
    depth.type = UnsignedIntType;
    this.colorTarget.depthTexture = depth;
    const maskDepth = new DepthTexture(1, 1);
    maskDepth.type = UnsignedIntType;
    this.maskTarget.depthTexture = maskDepth;

    const uniforms = {
        tColor: { value: this.colorTarget.texture },
        tDepth: { value: depth },
        tMask: { value: this.maskTarget.texture },
        tMaskDepth: { value: maskDepth },
        maskOn: { value: 0 },
        res: { value: new Vector2(1, 1) },
        dpr: { value: 1 },
        near: { value: 1 },
        far: { value: 100 },
        worldPerPixel: { value: 0.05 },
        groundSlope: { value: 0.05 },
        wetness: { value: 2.4 },
        invViewProj: { value: new Matrix4() },
        exposure: { value: 1.25 },
        skyTop: { value: srgb(PALETTE.skyTop) },
        skyMid: { value: srgb(PALETTE.skyMid) },
        skyHorizon: { value: srgb(PALETTE.skyHorizon) },
        skyShift: { value: 0 },
        hoverColor: { value: srgb(0xfff2dc) },
        selectColor: { value: srgb(0xfff2dc) },
    };
    const fragmentShader = /* glsl */ `
        precision highp float;
        uniform sampler2D tColor;
        uniform sampler2D tDepth;
        uniform mat4 invViewProj;
        uniform sampler2D tMask;
        uniform sampler2D tMaskDepth;
        uniform float maskOn;
        uniform vec2 res;
        uniform float dpr;
        uniform float near;
        uniform float far;
        uniform float worldPerPixel;
        uniform float groundSlope;
        uniform float wetness;
        uniform float exposure;
        uniform vec3 skyTop;
        uniform vec3 skyMid;
        uniform vec3 skyHorizon;
        uniform float skyShift;
        uniform vec3 hoverColor;
        uniform vec3 selectColor;
        out vec4 outColor;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        // The scene is drawn into half floats: on some phone GPUs a hot emissive or a near-zero divide
        // leaves an infinite or not-a-number texel, which the tone curve then turns into a random
        // purple or green speck. Every read is held to a finite range (clamp sends NaN to a bound).
        vec3 sceneAt(vec2 uv) { return clamp(texture(tColor, uv).rgb, vec3(0.0), vec3(64.0)); }
        float rawDepth(vec2 uv) { return texture(tDepth, uv).r; }
        float depthAt(vec2 uv) { return near + rawDepth(uv) * (far - near); }
        vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

        // Highlight mask: x hovered, y selected, where that object is the nearest surface.
        vec2 maskAt(vec2 uv) {
          vec2 m = step(0.5, texture(tMask, uv).rg);
          float behind = (texture(tMaskDepth, uv).r - rawDepth(uv)) * (far - near);
          return m * step(behind, 0.02);
        }

        // Dusk gradient with a distant two-layer skyline that slides with the orbit.
        vec3 sky(vec2 uv) {
          float t = uv.y;
          vec3 c = t < 0.45 ? mix(skyHorizon, skyMid, smoothstep(0.0, 0.45, t)) : mix(skyMid, skyTop, smoothstep(0.45, 1.0, t));
          float shift = skyShift / 360.0;
          for (int layer = 0; layer < 2; layer++) {
            float L = float(layer);
            float x = uv.x * (14.0 + 10.0 * L) + shift * (6.0 + 6.0 * L);
            float col = floor(x);
            float h = (0.08 + 0.12 * hash(vec2(col, 3.0 + L)) + 0.1 * step(0.85, hash(vec2(col, 9.0 + L)))) * (1.0 - 0.35 * L);
            if (t < h) c = mix(c, vec3(0.12, 0.11, 0.12), 0.45 + 0.25 * L);
          }
          return c;
        }

        void main() {
          vec2 p = gl_FragCoord.xy;
          vec2 uv = p / res;
          vec2 texel = 1.0 / res;
          float raw = rawDepth(uv);
          float vignette = 1.0 - 0.26 * pow(length((uv - 0.5) * vec2(1.1, 1.0)) * 1.25, 2.4);

          if (raw >= 0.999999) {
            outColor = vec4(toSRGB(clamp(sky(uv) * vignette, 0.0, 1.0)), 1.0);
            return;
          }

          vec3 c = sceneAt(uv);
          #ifdef SHARPEN
          // Unsharp mask on the scene before tone mapping, damped where the local contrast is
          // already high so lamps and neon get no halo.
          vec3 nb = sceneAt(uv + vec2(texel.x, 0.0)) + sceneAt(uv - vec2(texel.x, 0.0)) + sceneAt(uv + vec2(0.0, texel.y)) + sceneAt(uv - vec2(0.0, texel.y));
          vec3 detail = c - 0.25 * nb;
          c = max(c + detail * (SHARPEN / (1.0 + 4.0 * dot(abs(detail), vec3(0.333)))), vec3(0.0));
          #endif

          // Crease shading: a pixel nearer than the average of opposite
          // neighbours sits in a concave corner (wall foot, under eaves).
          float d = depthAt(uv);
          float r = clamp(0.7 / worldPerPixel, 3.0 * dpr, 20.0 * dpr);
          #if AO_STEPS > 0
          float occ = 0.0;
          for (int k = 0; k < AO_DIRS; k++) {
            float a = float(k) * (3.14159265 / float(AO_DIRS)) + 0.3;
            vec2 o = vec2(cos(a), sin(a)) * r * texel;
            for (int s = 3 - AO_STEPS; s <= 2; s++) {
              vec2 oo = o * (float(s) * 0.5);
              float mid = 0.5 * (depthAt(uv + oo) + depthAt(uv - oo));
              float gap = mid - d;
              occ += clamp((gap - 0.04) / 0.6, 0.0, 1.0) * (1.0 - smoothstep(1.2, 3.0, gap));
            }
          }
          c *= 1.0 - 0.32 * (occ / float(AO_DIRS * AO_STEPS));
          #endif

          // Wet street: flat ground (depth rising up the screen at the ground
          // plane's rate) catches smeared reflections of the bright things above
          // it, lamps, windows and neon, the way rain-dark asphalt does.
          float rise = depthAt(uv + vec2(0.0, texel.y)) - d;
          float ground = 1.0 - smoothstep(0.12, 0.35, abs(rise - groundSlope) / max(groundSlope, 1e-4));
          // Only the street itself is wet: flat roofs, awnings and ledges also
          // pass the slope test, so keep surfaces near street level only.
          vec4 world = invViewProj * vec4(uv * 2.0 - 1.0, raw * 2.0 - 1.0, 1.0);
          ground *= 1.0 - smoothstep(0.2, 0.45, world.y / world.w);
          if (ground > 0.0 && wetness > 0.0) {
            vec3 refl = vec3(0.0);
            for (int k = REFL_STRIDE; k <= 6; k += REFL_STRIDE) {
              float fk = float(k);
              // Per-pixel jitter along the streak, so samples blend into a smear instead of dashes.
              vec2 o = vec2(sin(p.y * 0.37 + fk) * 0.6, (fk + hash(p + fk)) * 7.0) * dpr * texel;
              vec3 s = sceneAt(uv + o);
              // Threshold on brightness, not per channel, so warm light keeps its hue.
              float lum = dot(s, vec3(0.299, 0.587, 0.114));
              refl += s * (max(lum - 0.7, 0.0) / max(lum, 1e-3)) * (1.0 - fk / 7.0);
            }
            float puddle = 0.55 + 0.45 * hash(floor(p / (9.0 * dpr)));
            c += refl * (0.16 * REFL_GAIN) * wetness * ground * puddle;
          }

          // Glow: bright lamps, neon and lit windows bleed softly into the damp
          // air around them. Sixteen taps on two rings, bright parts only.
          vec3 glow = vec3(0.0);
          for (int k = 0; k < 8; k += GLOW_STRIDE) {
            float a = float(k) * 0.785398 + 0.2;
            for (int ring = 1; ring <= GLOW_RINGS; ring++) {
              vec2 o = vec2(cos(a), sin(a)) * float(ring) * 7.0 * dpr * texel;
              vec3 s = sceneAt(uv + o);
              float sl = dot(s, vec3(0.299, 0.587, 0.114));
              glow += s * (max(sl - 0.85, 0.0) / max(sl, 1e-3)) * (ring == 1 ? 1.0 : 0.6);
            }
          }
          c += glow * (0.07 * GLOW_GAIN);

          // Tone, then a muted grade: cool shadows, warm light.
          c = aces(c * exposure);
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(l), c, 0.86);
          // Grimy split: teal-green in the shadows, sodium and neon warmth in the light.
          c *= mix(vec3(0.84, 0.98, 1.0), vec3(1.08, 0.98, 0.9), smoothstep(0.1, 0.65, l));
          c = mix(c, c * c * (3.0 - 2.0 * c), 0.18);
          // The city past the district falls away into the night.
          float far01 = clamp((d - near) / (far - near), 0.0, 1.0);
          c *= mix(1.0, 0.5, smoothstep(0.5, 0.85, far01));

          // Hover and selection: soft rims around the visible silhouette.
          if (maskOn > 0.5) {
            vec2 self = maskAt(uv);
            vec2 ring = vec2(0.0);
            float rr = 2.0 * dpr;
            for (int k = 0; k < 8; k++) {
              float a = float(k) * 0.785398;
              ring = max(ring, maskAt(uv + vec2(cos(a), sin(a)) * rr * texel));
            }
            // Only outside the object's whole silhouette: wall clutter or cables
            // in front of it must not draw rims inside the building.
            vec2 cover = step(0.5, texture(tMask, uv).rg);
            ring *= 1.0 - max(self, cover);
            c = mix(c, hoverColor, ring.x * 0.85);
            c = mix(c, selectColor, ring.y * 0.95);
            c *= 1.0 + 0.1 * self.x;
          }

          outColor = vec4(toSRGB(clamp(c * vignette, 0.0, 1.0)), 1.0);
        }
      `;
    const variant = (tier: QualityTier) => new ShaderMaterial({ glslVersion: GLSL3, depthTest: false, depthWrite: false, uniforms, defines: COMPOSITE_DEFINES[tier], vertexShader: FULLSCREEN, fragmentShader });
    this.composites = { ultra: variant('ultra'), high: variant('high'), medium: variant('medium'), low: variant('low') };
    this.composite = this.composites.high;
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.composite);
    this.quadScene.add(this.quad);
    this.gpuTimer = new GpuTimer(renderer.getContext() as WebGL2RenderingContext);
  }

  /**
   * Compiles every tier's finishing pass now, so a later tier change never
   * stalls on a shader compile mid-play. Returns the time it took (ms).
   */
  precompile(): number {
    const t0 = performance.now();
    for (const tier of ['ultra', 'high', 'medium', 'low'] as const) {
      this.quad.material = this.composites[tier];
      this.renderer.compile(this.quadScene, this.quadCamera);
    }
    this.quad.material = this.composite;
    return performance.now() - t0;
  }

  /** The current quality tier's finishing pass and multisampling (the caller resizes for its density). */
  setTier(tier: QualityTier): void {
    if (tier === this.tier) return;
    this.tier = tier;
    this.composite = this.quad.material = this.composites[tier];
    const samples = TIER_SETTINGS[tier].samples;
    if (this.colorTarget.samples !== samples) {
      // Freed now and allocated at the new count on the next render (same size).
      this.colorTarget.dispose();
      this.colorTarget.samples = samples;
    }
    this.shadowsStale = true;
  }

  /** Whether GPU times are available (desktop Chrome, Edge; not Safari or most phones). */
  get timesGpu(): boolean {
    return this.gpuTimer.available;
  }

  /** Hands finished frames' GPU times (ms) to `out`. */
  pollGpu(out: (ms: number) => void): void {
    this.gpuTimer.poll(out);
  }

  resize(cssW: number, cssH: number, deviceDpr: number): RenderFrame {
    const tier = TIER_SETTINGS[this.tier];
    const frame = chooseFrame(cssW, cssH, deviceDpr, tier.maxDpr, tier.scale);
    this.frame = frame;
    this.renderer.setPixelRatio(frame.dpr);
    this.renderer.setSize(cssW, cssH, false);
    this.colorTarget.setSize(frame.lowW, frame.lowH);
    this.maskTarget.setSize(frame.lowW, frame.lowH);
    (this.composite.uniforms.res.value as Vector2).set(frame.lowW, frame.lowH);
    this.composite.uniforms.dpr.value = frame.dpr;
    return frame;
  }

  /** World units per render pixel at the current zoom (from the last `setCameraDepth`). */
  get worldPerPixel(): number {
    return this.composite.uniforms.worldPerPixel.value as number;
  }

  setCameraDepth(near: number, far: number, worldPerPixel: number, elevationDeg = 35.26): void {
    this.shadowsStale = true;
    const u = this.composite.uniforms;
    // One render pixel up the screen on flat ground moves this far deeper.
    u.groundSlope.value = worldPerPixel / Math.tan((elevationDeg * Math.PI) / 180);
    u.near.value = near;
    u.far.value = far;
    u.worldPerPixel.value = worldPerPixel;
  }

  /** How wet the streets are (0 dry, about 3 soaked): scales reflections and puddles. */
  setWetness(wetness: number): void {
    this.composite.uniforms.wetness.value = wetness;
  }

  /** Blends the sky from day (`day` 1) through dusk to deep night (`night` 1); exposure eases off in daylight and lifts at night. */
  setNight(night: number, day = 0): void {
    this.shadowsStale = true;
    const u = this.composite.uniforms;
    (u.skyTop.value as Vector3).lerpVectors(SKY.top, SKY.topDay, day).lerp(SKY.topNight, night);
    (u.skyMid.value as Vector3).lerpVectors(SKY.mid, SKY.midDay, day).lerp(SKY.midNight, night);
    (u.skyHorizon.value as Vector3).lerpVectors(SKY.horizon, SKY.horizonDay, day).lerp(SKY.horizonNight, night);
    // A little more exposure after dark, so night stays readable on dim screens and headsets.
    u.exposure.value = 1.25 - 0.1 * day + 0.25 * night;
  }

  /** Slides the distant skyline with the camera's orbit (azimuth in degrees). */
  setSkyShift(azimuthDeg: number): void {
    this.composite.uniforms.skyShift.value = azimuthDeg;
  }

  /** Renders the scene, the highlight mask (only when needed) and the composite. */
  render(scene: Scene, camera: OrthographicCamera, highlight: { hover: boolean; select: boolean } = { hover: false, select: false }): void {
    const r = this.renderer;
    r.shadowMap.needsUpdate = this.shadowsStale || this.shadowFrame++ % TIER_SETTINGS[this.tier].shadowEvery === 0;
    this.shadowsStale = false;
    this.gpuTimer.begin();
    r.setRenderTarget(this.colorTarget);
    r.render(scene, camera);
    (this.composite.uniforms.invViewProj.value as Matrix4).multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);

    const maskOn = highlight.hover || highlight.select;
    this.composite.uniforms.maskOn.value = maskOn ? 1 : 0;
    if (maskOn) {
      const background = scene.background;
      scene.background = null;
      const layers = camera.layers.mask;
      r.setRenderTarget(this.maskTarget);
      r.setClearColor(0x000000, 0);
      r.clear();
      if (highlight.hover) {
        camera.layers.set(HOVER_LAYER);
        scene.overrideMaterial = this.hoverMaterial;
        r.render(scene, camera);
      }
      if (highlight.select) {
        camera.layers.set(SELECT_LAYER);
        scene.overrideMaterial = this.selectMaterial;
        r.render(scene, camera);
      }
      camera.layers.mask = layers;
      scene.overrideMaterial = null;
      scene.background = background;
    }

    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCamera);
    this.gpuTimer.end();
  }
}
