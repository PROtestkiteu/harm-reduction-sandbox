/**
 * Animation level of detail, shared by every animated figure: how often a
 * skeleton is worth updating this frame. A person off screen moves on at a
 * quarter of the rate (still roughly in step for when they walk into view);
 * a person too small on screen to see their limbs at half; everyone else
 * every frame. Figures are spread over the frames by a phase of their own,
 * so the work is even, and the time skipped is added to the next update.
 *
 * `beginFrame` is called once per drawn frame by the main loop, before the
 * world updates. Nothing here allocates.
 */
export const ANIMATION_LOD = {
  /** Drawn frames so far. */
  frame: 0,
  /** Render pixels per metre at the current zoom. */
  pxPerMetre: 100,
};

/** Below this height on screen (render pixels) a figure's limbs are a few pixels each. */
const SMALL_PX = 40;

export function beginAnimationFrame(worldPerPixel: number): void {
  ANIMATION_LOD.frame++;
  ANIMATION_LOD.pxPerMetre = 1 / Math.max(worldPerPixel, 1e-4);
}

let nextPhase = 0;
/** A phase for a new figure, so figures on the same rate take turns. */
export const animationPhase = (): number => nextPhase++ & 3;

/**
 * Whether a figure `heightM` tall, last drawn on frame `drawnFrame` and with
 * phase `phase`, updates its skeleton this frame.
 */
export function animateThisFrame(drawnFrame: number, heightM: number, phase: number): boolean {
  const f = ANIMATION_LOD.frame;
  // Drawn this frame or the one before counts as on screen (the stamp is set while drawing).
  const every = f - drawnFrame > 1 ? 4 : heightM * ANIMATION_LOD.pxPerMetre < SMALL_PX ? 2 : 1;
  return every === 1 || (f + phase) % every === 0;
}
