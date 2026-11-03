import { LinearFilter, NearestFilter, type DirectionalLight, type Mesh, type Object3D, type Texture } from 'three';
import { QUALITY } from './quality';

/**
 * Adaptive render quality: four tiers of the same look, picked per zoom band
 * from what the device does with them.
 *
 * High is the full look as designed. Ultra, for devices with room to spare,
 * adds detail on top: supersampling on low-density screens (up to 1.5x the
 * screen's density, 2 at most), denser crease shading, a light sharpening of the scene,
 * a shadow map at twice the resolution redrawn every frame. Below High,
 * detail is cut where it shows least, in this order: the finishing pass's
 * extra taps (crease shading, wet reflections, glow), how often the sun's
 * shadows are redrawn, multisampling, and only last (on phones) the pixel density. The
 * canvas is never drawn smaller than its tier's density and stretched by the
 * browser, which is what made the old dynamic resolution look blurry.
 *
 * Each zoom band (far, mid, near) keeps its own tier, because a zoomed-out
 * city costs several times the draw calls of a close-up: zooming in can bring
 * back detail the wide view could not afford. Switching tiers swaps shaders
 * compiled at start (no recompile mid-play) and, rarely, resizes buffers.
 */
export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';
export type QualityMode = 'auto' | QualityTier;
export const QUALITY_TIERS: readonly QualityTier[] = ['low', 'medium', 'high', 'ultra'];
export const QUALITY_MODES: readonly QualityMode[] = ['auto', ...QUALITY_TIERS];

export interface TierSettings {
  /** Highest pixel ratio rendered. */
  maxDpr: number;
  /** Render density relative to the device's own (above 1: supersampled, then scaled down by the browser). */
  scale: number;
  /** Sun shadow map size in texels per side (0: the size set at start). */
  shadowMap: number;
  /** Multisample count of the scene target. */
  samples: number;
  /** The sun's shadow map is redrawn every this many frames (and at once on any view or light change). */
  shadowEvery: number;
}

export const TIER_SETTINGS: Record<QualityTier, TierSettings> = {
  // 1.5x the density of a 1x or 1.25x monitor, 2 at most: past that (a Retina laptop, a phone)
  // supersampling costs far more than it shows, and the other extras carry the detail.
  ultra: { maxDpr: 2, scale: 1.5, shadowMap: 4096, samples: 4, shadowEvery: 1 },
  high: { maxDpr: QUALITY.maxDpr, scale: 1, shadowMap: 0, samples: 4, shadowEvery: 2 },
  medium: { maxDpr: QUALITY.maxDpr, scale: 1, shadowMap: 0, samples: 2, shadowEvery: 3 },
  // Density is the last thing to go, and only on touch devices (to 1.5, below which signs and
  // faces soften visibly): a computer keeps its full density, since a soft picture on a big
  // screen is what players notice first. A device that renders less already (QUALITY.low) keeps its cap.
  low: { maxDpr: matchMedia('(pointer: coarse)').matches ? Math.min(QUALITY.maxDpr, 1.5) : QUALITY.maxDpr, scale: 1, shadowMap: 0, samples: 2, shadowEvery: 4 },
};

const STORE_KEY = 'hrp-graphics';

/** The mode picked in Settings (Auto unless changed); `?quality=low|medium|high` wins for a session. */
export function savedMode(): QualityMode {
  const forced = new URLSearchParams(location.search).get('quality');
  if (forced && (QUALITY_MODES as readonly string[]).includes(forced)) return forced as QualityMode;
  try {
    const kept = localStorage.getItem(STORE_KEY);
    if (kept && (QUALITY_MODES as readonly string[]).includes(kept)) return kept as QualityMode;
  } catch { /* storage blocked */ }
  return 'auto';
}

function keepMode(mode: QualityMode): void {
  try { localStorage.setItem(STORE_KEY, mode); } catch { /* storage blocked: this session only */ }
}

/**
 * Where Auto starts, from what the device says about itself: weak phones and
 * software or old mobile GPUs start low, other phones and tablets medium,
 * computers high. The controller then moves from there on measured cost.
 */
export function startTier(gl: WebGL2RenderingContext): QualityTier {
  if (QUALITY.low || legacyGpu(gl)) return 'low';
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  if (/SwiftShader|llvmpipe|softpipe|Mali-[4T]|Adreno \(TM\) [3-5]\d\d|PowerVR|Intel.*HD Graphics [2-5]\d{2,3}\b/i.test(gpu)) return 'low';
  return matchMedia('(pointer: coarse)').matches ? 'medium' : 'high';
}

/**
 * Apple's first Metal GPUs (A7, A8, A8X: iPad Air 2, iPad mini 4, iPhone 6): the newest system they get is
 * iOS or iPadOS 15. Safari names every Apple GPU alike, but these report a largest texture of 8192
 * where every later one reports 16384. On them each point light is shaded on every lit pixel and
 * uploaded with every material, which measured at more than half the frame on an iPad Air 2, so
 * they go without point lights and the sun's shadow map (a capability, not a tier: Settings keeps both off).
 */
export function legacyGpu(gl: WebGL2RenderingContext): boolean {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  return /^Apple GPU$/.test(gpu) && (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) < 16384;
}

/** Zoom bands, each with its own tier: far out (the whole district), the default view, close up. */
const enum Band { Far = 0, Mid = 1, Near = 2 }
const bandOf = (zoom: number): Band => (zoom < 0.85 ? Band.Far : zoom < 1.7 ? Band.Mid : Band.Near);

/**
 * Quality only drops when frames are actually dropped (or the GPU is so busy they are about to
 * be): a device holding 60 frames a second keeps its detail, however much of the frame it spends.
 */
const GPU_SATURATED_MS = 20;
/** A step up needs the next tier's measured (or estimated) GPU cost under this, and steady frames. */
const GPU_ROOM_MS = 13;
/** Without GPU timers: a frame interval this long (smoothed) means frames are being dropped. */
const GAP_SLOW_MS = 21;
const GAP_STEADY_MS = 17.6;
/** How long a verdict must hold before acting: slow quickly, fast slowly, so it never hunts. */
const SLOW_HOLD_S = 1.5;
const FAST_HOLD_S = 8;
/** After a failed step up, that step waits this long, doubling each time it fails again. */
const RETRY_BASE_S = 30;
const RETRY_MAX_S = 480;
/** Rough cost of each tier relative to high, for a first guess before it is measured. */
const COST_SHARE: Record<QualityTier, number> = { ultra: 1.35, high: 1, medium: 0.6, low: 0.4 };

interface BandState {
  tier: QualityTier;
  /** Last smoothed GPU cost seen at each tier here, in ms (0: not yet measured). */
  cost: Float64Array;
  /** Earliest time (s) each tier may be tried again after it failed here. */
  retryAt: Float64Array;
  /** Current back-off (s) for each tier. */
  backoff: Float64Array;
}

const tierIndex = (t: QualityTier) => QUALITY_TIERS.indexOf(t);

/**
 * Decides the tier. Feed it each rendered frame's interval and, where the
 * browser has timer queries, each frame's GPU time; it calls `apply` when the
 * tier changes. No allocation per frame.
 */
export class QualityController {
  mode: QualityMode;
  private readonly bands: BandState[];
  private band: Band = Band.Mid;
  private current: QualityTier;
  private gpuEma = 0;
  private gapEma = 0;
  private slowFor = 0;
  private fastFor = 0;
  private clock = 0;
  /** Set while a step up is on trial: the tier to fall back to, and until when the trial runs. */
  private trialFrom: QualityTier | null = null;
  private trialUntil = 0;
  /** Samples are ignored until then (s): the frame or two after a change pay for its resize and buffers. */
  private settleUntil = 0;
  private gpuSeen = false;

  constructor(start: QualityTier, mode: QualityMode, private readonly apply: (tier: QualityTier) => void) {
    this.mode = mode;
    const startAuto = start;
    const n = QUALITY_TIERS.length;
    this.bands = [0, 1, 2].map(() => ({ tier: startAuto, cost: new Float64Array(n), retryAt: new Float64Array(n), backoff: new Float64Array(n).fill(RETRY_BASE_S) }));
    this.current = mode === 'auto' ? start : mode;
  }

  get tier(): QualityTier { return this.current; }

  /** Settings: Auto, or a fixed tier. Kept for next time. */
  setMode(mode: QualityMode): void {
    this.mode = mode;
    keepMode(mode);
    this.trialFrom = null;
    this.reset();
    this.set(mode === 'auto' ? this.bands[this.band].tier : mode);
  }

  /** The camera's zoom; crossing into another band brings that band's tier. */
  setZoom(zoom: number): void {
    const band = bandOf(zoom);
    if (band === this.band) return;
    this.band = band;
    if (this.mode !== 'auto') return;
    this.trialFrom = null;
    this.reset();
    this.set(this.bands[band].tier);
  }

  /** GPU time of one rendered frame, in ms (from a timer query, a frame or two late). */
  sampleGpu(ms: number): void {
    this.gpuSeen = true;
    this.gpuEma = this.gpuEma === 0 ? ms : this.gpuEma + (ms - this.gpuEma) * 0.1;
  }

  /**
   * One frame was drawn, `gapMs` after the one before (both drawn, page
   * visible). Runs the verdict.
   */
  sampleFrame(gapMs: number): void {
    const dt = Math.min(gapMs, 500) / 1000;
    this.clock += dt;
    if (this.clock < this.settleUntil) return;
    this.gapEma = this.gapEma === 0 ? gapMs : this.gapEma + (gapMs - this.gapEma) * 0.1;
    if (this.mode !== 'auto') return;
    // Dropped frames decide (on a weak phone the CPU is often the limit, and a lower tier also
    // sends fewer draw calls); a saturated GPU counts too. A step up needs steady frames and,
    // with timer queries, GPU room for the next tier.
    const slow = this.gapEma > GAP_SLOW_MS || (this.gpuSeen && this.gpuEma > GPU_SATURATED_MS);
    const fast = this.gapEma < GAP_STEADY_MS;
    this.slowFor = slow ? this.slowFor + dt : 0;
    this.fastFor = fast ? this.fastFor + dt : 0;
    const state = this.bands[this.band];
    const i = tierIndex(this.current);
    if (this.gpuSeen && this.gpuEma > 0 && this.slowFor + this.fastFor > 1) state.cost[i] = this.gpuEma;

    if (this.slowFor > SLOW_HOLD_S) {
      if (this.trialFrom) {
        // The step up did not fit: back down, and wait longer before trying it again.
        state.backoff[i] = Math.min(RETRY_MAX_S, state.backoff[i] * 2);
        state.retryAt[i] = this.clock + state.backoff[i];
        const back = this.trialFrom;
        this.trialFrom = null;
        this.step(state, back);
      } else if (i > 0) {
        state.retryAt[i] = this.clock + state.backoff[i];
        this.step(state, QUALITY_TIERS[i - 1]);
      }
      return;
    }
    if (this.trialFrom && this.clock > this.trialUntil) {
      // Held up through the trial: this tier is fine here, its back-off resets.
      state.backoff[i] = RETRY_BASE_S;
      this.trialFrom = null;
    }
    if (this.fastFor > FAST_HOLD_S && i < QUALITY_TIERS.length - 1 && !this.trialFrom) {
      const up = QUALITY_TIERS[i + 1];
      const j = i + 1;
      if (this.clock < state.retryAt[j]) return;
      if (this.gpuSeen) {
        // Only when the next tier's measured cost left room, or (not measured yet here) its
        // estimate is short of saturating the GPU: an untried tier gets one trial.
        const guess = state.cost[j] || (this.gpuEma * COST_SHARE[up]) / COST_SHARE[this.current];
        if (guess > (state.cost[j] ? GPU_ROOM_MS : GPU_SATURATED_MS)) return;
      }
      this.trialFrom = this.current;
      this.trialUntil = this.clock + 6;
      this.step(state, up);
    }
  }

  private step(state: BandState, tier: QualityTier): void {
    state.tier = tier;
    this.reset();
    this.set(tier);
  }

  private reset(): void {
    this.slowFor = this.fastFor = 0;
    // The new tier's cost is measured afresh; the frame interval carries over.
    this.gpuEma = 0;
  }

  private set(tier: QualityTier): void {
    if (tier === this.current) return;
    this.current = tier;
    this.settleUntil = this.clock + 1;
    this.apply(tier);
  }
}

/**
 * GPU time per frame from EXT_disjoint_timer_query_webgl2 (desktop Chrome and
 * Edge; most phones and Safari have none, and the controller then goes by
 * frame intervals). A small ring of queries, reused; results are read when
 * ready, a frame or two later, so nothing waits on the GPU.
 */
export class GpuTimer {
  private readonly ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  private readonly queries: WebGLQuery[] = [];
  private readonly busy: boolean[] = [];
  private readonly order: number[] = [];
  private active = -1;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!this.ext) return;
    for (let i = 0; i < 4; i++) {
      const q = gl.createQuery();
      if (!q) { this.ext = null; return; }
      this.queries.push(q);
      this.busy.push(false);
    }
  }

  get available(): boolean { return this.ext !== null; }

  begin(): void {
    if (!this.ext || this.active >= 0) return;
    const free = this.busy.indexOf(false);
    if (free < 0) return; // all in flight: skip timing this frame
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.queries[free]);
    this.busy[free] = true;
    this.active = free;
  }

  end(): void {
    if (!this.ext || this.active < 0) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.order.push(this.active);
    this.active = -1;
  }

  /** Hands each finished query's time (ms) to `out`, oldest first. */
  poll(out: (ms: number) => void): void {
    if (!this.ext) return;
    const gl = this.gl;
    while (this.order.length) {
      const i = this.order[0];
      const q = this.queries[i];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean;
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
      this.order.shift();
      this.busy[i] = false;
      if (!disjoint) out(ns / 1e6);
    }
  }
}

/**
 * Anisotropic filtering for the scene's mipmapped textures (window strips,
 * posters, graffiti, signs), which the isometric camera sees at a slant: it
 * keeps them sharp when zoomed out instead of sliding to a blurry mip. Set once
 * before the first frame (changing it later would re-upload every texture), at
 * a level from the starting tier. Textures that already chose a level keep it.
 */
export function applyAnisotropy(root: Object3D, maxSupported: number, tier: QualityTier): void {
  const level = Math.min(maxSupported, tier === 'high' || tier === 'ultra' ? 16 : tier === 'medium' ? 4 : 1);
  if (level <= 1) return;
  root.traverse((o) => {
    const material = (o as Mesh).material;
    if (!material) return;
    for (const m of Array.isArray(material) ? material : [material]) {
      for (const key of TEXTURE_SLOTS) {
        const tex = (m as unknown as Record<string, Texture | null | undefined>)[key];
        if (tex && tex.isTexture && tex.version === 0 && tex.anisotropy === 1 && tex.generateMipmaps && tex.minFilter !== NearestFilter && tex.minFilter !== LinearFilter) tex.anisotropy = level;
      }
    }
  });
}

const TEXTURE_SLOTS = ['map', 'emissiveMap', 'alphaMap', 'normalMap', 'roughnessMap', 'bumpMap'] as const;

/**
 * The sun's shadow map at `size` texels a side (0: `base`, the size set at
 * start). The map is freed and made again at the next shadow pass; shaders do
 * not change (the size is a uniform), so nothing recompiles.
 */
export function setShadowMapSize(light: DirectionalLight, size: number, base: number, maxTexture: number): void {
  const n = Math.min(size || base, maxTexture);
  if (light.shadow.mapSize.x === n) return;
  light.shadow.mapSize.set(n, n);
  light.shadow.map?.dispose();
  light.shadow.map = null;
}
