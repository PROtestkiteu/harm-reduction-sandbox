import { Vector3 } from 'three';
import { DEFAULT_VIEW, ELEVATION_LIMITS, isDefaultView, type ViewAngles } from './camera';

/** Zoom 1 shows the original street; below 1 shows more of the district. */
export const MIN_ZOOM = 0.35;
/** The furthest a phone zooms out: about the inner blocks. */
export const PHONE_MIN_ZOOM = 0.71;
export const MAX_ZOOM = 3.2;
/** Zoom steps for the wheel and keys, so each press lands on a familiar scale; the widest shows the outer ring. */
export const ZOOM_STEPS = [0.35, 0.5, 0.71, 1, 1.41, 2, 2.6, 3.2] as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Camera state above the framing maths: orbit angles plus a focus point and
 * zoom that ease towards a target. A new target simply replaces the old one,
 * so a transition is cancelled by starting another; there are no queued
 * animations or promises to go stale. With reduced motion every change lands
 * at once.
 *
 * The camera is either free (the person pans and zooms) or locked onto a
 * subject by `focusOn` (a location or a followed person). Any pan or zoom by
 * the person releases the lock.
 */
export class CameraRig {
  readonly view: ViewAngles = { ...DEFAULT_VIEW };
  /** Current focus point and zoom, fed to `frameCamera`. */
  readonly focus = new Vector3();
  private minZoom = MIN_ZOOM;
  zoom = 1;
  private readonly targetFocus = new Vector3();
  private targetZoom = 1;
  private locked = false;
  private changed = true;

  /**
   * `home` is the opening view's focus; `limit` is how far (in metres, on x
   * and z) the focus may travel from the origin.
   */
  constructor(private readonly home: Vector3, private readonly limit: number) {
    this.focus.copy(home);
    this.targetFocus.copy(home);
  }

  /** True while the camera is locked onto a selected subject. */
  get focused(): boolean {
    return this.locked;
  }

  get atDefault(): boolean {
    return isDefaultView(this.view) && !this.locked && this.targetFocus.distanceTo(this.home) < 0.01 && Math.abs(this.targetZoom - 1) < 0.001;
  }

  setView(next: ViewAngles): void {
    const az = ((next.azimuthDeg % 360) + 360) % 360;
    const el = clamp(next.elevationDeg, ELEVATION_LIMITS[0], ELEVATION_LIMITS[1]);
    if (az === this.view.azimuthDeg && el === this.view.elevationDeg) return;
    this.view.azimuthDeg = az;
    this.view.elevationDeg = el;
    this.changed = true;
  }

  /** Locks onto `point` at `zoom`, easing there. Calling again mid-way retargets smoothly. */
  focusOn(point: Vector3, zoom: number): void {
    this.locked = true;
    this.target(point.x, point.y, point.z, zoom);
  }

  /**
   * Eases over to `point` without locking onto it (an event somewhere in the
   * city): the person can pan away at once. Zooms in a little if far out.
   */
  lookAt(point: Vector3, zoom = Math.max(this.targetZoom, 1.3)): void {
    this.locked = false;
    this.target(point.x, point.y, point.z, zoom);
  }

  /** Lets go of a subject, keeping the place in view at the base scale. */
  release(): void {
    this.locked = false;
    this.target(this.targetFocus.x, this.targetFocus.y, this.targetFocus.z, Math.min(this.targetZoom, 1));
  }

  /** Back to the opening view: home focus, base scale, default angles. */
  reset(): void {
    this.locked = false;
    this.setView(DEFAULT_VIEW);
    this.target(this.home.x, this.home.y, this.home.z, 1);
  }

  /**
   * Moves the view by a ground-plane offset. `immediate` (drags) applies it to
   * the current position too, so the scene stays under the finger; otherwise
   * (keys) it eases.
   */
  pan(dx: number, dz: number, immediate: boolean): void {
    this.locked = false;
    const lim = this.reach(this.targetZoom);
    const x = clamp(this.targetFocus.x + dx, -lim, lim);
    const z = clamp(this.targetFocus.z + dz, -lim, lim);
    if (immediate) {
      this.focus.x = clamp(this.focus.x + dx, -lim, lim);
      this.focus.z = clamp(this.focus.z + dz, -lim, lim);
    }
    this.target(x, this.targetFocus.y, z, this.targetZoom);
  }

  /** One zoom step in (`+1`) or out (`-1`), from the current target. */
  zoomStep(direction: 1 | -1): void {
    this.locked = false;
    const z = this.targetZoom;
    const next = direction > 0 ? ZOOM_STEPS.find((s) => s > z * 1.01) ?? MAX_ZOOM : [...ZOOM_STEPS].reverse().find((s) => s < z / 1.01 && s >= this.minZoom) ?? this.minZoom;
    this.target(this.targetFocus.x, this.targetFocus.y, this.targetFocus.z, next);
  }

  /** Continuous zoom by a factor, for pinches; it stays where the fingers leave it. */
  zoomBy(factor: number, immediate: boolean): void {
    this.locked = false;
    const z = clamp(this.targetZoom * factor, this.minZoom, MAX_ZOOM);
    if (immediate) this.zoom = z;
    this.target(this.targetFocus.x, this.targetFocus.y, this.targetFocus.z, z);
  }

  /**
   * How far out the view may go. Phones stop closer in: the whole city on a small screen is
   * a clutter of tiny buildings (and more to draw than a weak phone wants).
   */
  setMinZoom(z: number): void {
    this.minZoom = Math.max(MIN_ZOOM, z);
    if (this.targetZoom < this.minZoom) this.target(this.targetFocus.x, this.targetFocus.y, this.targetFocus.z, this.minZoom);
  }

  /** Mark the framing stale, for example after a resize. */
  invalidate(): void {
    this.changed = true;
  }

  /**
   * How far the focus may travel at `zoom`: the full limit from the base
   * scale in, less as the view widens, so zoomed out the screen still shows
   * city and never the empty ground past its edge.
   */
  private reach(zoom: number): number {
    return this.limit * Math.min(1, zoom);
  }

  private target(x: number, y: number, z: number, zoom: number): void {
    const zz = clamp(zoom, this.minZoom, MAX_ZOOM);
    // Zooming out near the edge draws the view back towards the city.
    const lim = this.reach(zz);
    x = clamp(x, -lim, lim);
    z = clamp(z, -lim, lim);
    if (this.targetFocus.x === x && this.targetFocus.y === y && this.targetFocus.z === z && zz === this.targetZoom) return;
    this.targetFocus.set(x, y, z);
    this.targetZoom = zz;
    this.changed = true;
  }

  /** Advances the easing. Returns true when the camera needs re-aiming this frame. */
  step(dt: number, reducedMotion: boolean): boolean {
    const dist = this.focus.distanceTo(this.targetFocus);
    const dz = Math.abs(Math.log(this.zoom / this.targetZoom));
    if (dist > 1e-3 || dz > 1e-3) {
      // Critically damped feel without overshoot; about 0.4 s to settle.
      const k = reducedMotion ? 1 : 1 - Math.exp(-9 * dt);
      if (k >= 1 || (dist < 0.01 && dz < 0.002)) {
        this.focus.copy(this.targetFocus);
        this.zoom = this.targetZoom;
      } else {
        this.focus.lerp(this.targetFocus, k);
        this.zoom = Math.exp(Math.log(this.zoom) + (Math.log(this.targetZoom) - Math.log(this.zoom)) * k);
      }
      this.changed = true;
    }
    const was = this.changed;
    this.changed = false;
    return was;
  }
}
