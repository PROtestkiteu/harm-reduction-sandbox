import type { Camera, Material, Object3D, PointLight, Scene, WebGLRenderer } from 'three';

/**
 * Lite lighting: no point lights (the lamps keep their glowing bulbs and light cones), no sun
 * shadows and no vertex bend on the painted surfaces. On a weak device those take most of a frame
 * (measured on an iPad Air 2: about 2 fps with them, about 8 without).
 *
 * It is a last step below the quality tiers, for any device, not a tier of its own: switching costs a
 * one-off shader recompile, so it happens at most once and is remembered for this device. It is on
 * from the start for the oldest GPUs (`legacy`) and for a device that needed it before; otherwise it
 * comes on when Auto already sits at its lowest tier and the game still draws too few frames. Settings
 * can turn it off again (not for the oldest GPUs).
 */
export type LiteReason = 'legacy' | 'slow';

const STORE_KEY = 'hrp-lite';
/** Drawn frames a second under which a window counts as slow. */
const SLOW_FPS = 20;
/** Length of one measuring window, in ms of drawing. */
const WINDOW_MS = 4000;
/** Slow windows in a row before switching: at the lowest tier, and (Auto not yet there) a longer wait. */
const WINDOWS_AT_FLOOR = 3;
const WINDOWS_ABOVE_FLOOR = 8;
/** A gap this long between drawn frames is a pause, a hidden tab or a stall, not a frame rate. */
const MAX_GAP_MS = 1000;
/** Rendering waits at most this long for the recompile before drawing anyway. */
const COMPILE_WAIT_MS = 6000;

function remembered(): boolean {
  try { return localStorage.getItem(STORE_KEY) === '1'; } catch { return false; }
}

function remember(on: boolean): void {
  try {
    if (on) localStorage.setItem(STORE_KEY, '1');
    else localStorage.removeItem(STORE_KEY);
  } catch { /* storage blocked: this session only */ }
}

export class LiteMode {
  reason: LiteReason | null = null;
  /** True while the shaders recompile after a switch: the caller holds its drawing. */
  busy = false;
  private readonly hidden = new Set<PointLight>();
  private lastDrawn = 0;
  private windowMs = 0;
  private windowFrames = 0;
  private slowWindows = 0;
  private version = 0;

  /**
   * Decides the start state before anything is compiled: on for `legacy`, or when this device
   * needed it before.
   */
  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly scene: Scene,
    private readonly camera: Camera,
    private readonly setBend: (on: boolean) => void,
    legacy: boolean,
    private readonly onChange: () => void,
  ) {
    const start: LiteReason | null = legacy ? 'legacy' : remembered() ? 'slow' : null;
    if (start) this.apply(start, false);
  }

  get on(): boolean {
    return this.reason !== null;
  }

  /**
   * A frame was drawn at `now` (ms). `atFloor`: Auto is on and already at its lowest tier; `auto`:
   * Auto is on at all (a fixed tier is the player's choice, and lite never overrides it).
   */
  drawn(now: number, auto: boolean, atFloor: boolean): void {
    const gap = now - this.lastDrawn;
    this.lastDrawn = now;
    if (this.on || this.busy || !auto || gap > MAX_GAP_MS) return;
    this.windowMs += gap;
    this.windowFrames++;
    if (this.windowMs < WINDOW_MS) return;
    const fps = (this.windowFrames * 1000) / this.windowMs;
    this.windowMs = this.windowFrames = 0;
    this.slowWindows = fps < SLOW_FPS ? this.slowWindows + 1 : 0;
    if (this.slowWindows >= (atFloor ? WINDOWS_AT_FLOOR : WINDOWS_ABOVE_FLOOR)) this.apply('slow', true);
  }

  /** Point lights added after start (the scenery kits) go dark too while lite is on. */
  refresh(root: Object3D): void {
    if (this.on) this.hideLights(root);
  }

  /** Settings: full lighting again, and forgotten for this device. The oldest GPUs keep lite. */
  reset(): void {
    if (this.reason !== 'slow') return;
    this.reason = null;
    this.slowWindows = this.windowMs = this.windowFrames = 0;
    remember(false);
    for (const light of this.hidden) light.visible = true;
    this.hidden.clear();
    this.renderer.shadowMap.enabled = true;
    this.setBend(true);
    this.recompile();
  }

  private apply(reason: LiteReason, live: boolean): void {
    this.reason = reason;
    if (reason === 'slow') remember(true);
    this.renderer.shadowMap.enabled = false;
    this.setBend(false);
    this.hideLights(this.scene);
    if (live) this.recompile();
  }

  private hideLights(root: Object3D): void {
    root.traverse((o) => {
      const light = o as PointLight;
      if (light.isPointLight && light.visible) {
        light.visible = false;
        this.hidden.add(light);
      }
    });
  }

  /**
   * Mid-game the new shaders compile in parallel where the browser can (KHR_parallel_shader_compile)
   * while drawing holds, so the page stays responsive; drawing resumes when they are ready or after
   * COMPILE_WAIT_MS at most. A later switch supersedes an earlier one still compiling.
   */
  private recompile(): void {
    const materials = new Set<Material>();
    this.scene.traverse((o) => {
      const m = (o as { material?: Material | Material[] }).material;
      if (m) for (const one of Array.isArray(m) ? m : [m]) materials.add(one);
    });
    for (const m of materials) m.needsUpdate = true;
    const version = ++this.version;
    this.busy = true;
    const done = () => {
      if (version !== this.version) return;
      this.busy = false;
      this.onChange();
    };
    void Promise.race([
      this.renderer.compileAsync(this.scene, this.camera).catch(() => { /* compiled on first draw instead */ }),
      new Promise((resolve) => setTimeout(resolve, COMPILE_WAIT_MS)),
    ]).then(done);
    this.onChange();
  }
}
