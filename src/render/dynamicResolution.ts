/**
 * Dynamic resolution, as games do it: when frames run long for a couple of
 * seconds the render scale steps down (to `min` at most); when there is room
 * again it steps back up. Steps are coarse and spaced out, so it never hunts.
 */
export class DynamicResolution {
  scale = 1;
  private slowFor = 0;
  private fastFor = 0;

  constructor(private readonly min: number, private readonly onChange: () => void) {}

  /** One frame took `frameMs`; `dt` is the same in seconds. */
  sample(frameMs: number, dt: number): void {
    if (frameMs > 24) { this.slowFor += dt; this.fastFor = 0; }
    else if (frameMs < 13) { this.fastFor += dt; this.slowFor = 0; }
    else { this.slowFor = 0; this.fastFor = 0; }
    const next = this.slowFor > 2 ? Math.max(this.min, this.scale - 0.15) : this.fastFor > 6 ? Math.min(1, this.scale + 0.15) : this.scale;
    if (next === this.scale) return;
    this.scale = Math.round(next * 100) / 100;
    this.slowFor = this.fastFor = 0;
    this.onChange();
  }
}
