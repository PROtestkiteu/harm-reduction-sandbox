/**
 * A vehicle's way through the streets: straight runs joined by rounded
 * corners, so a car turning at a junction swings round instead of snapping
 * to its new heading. Built once per route; asking where a car is walks a
 * handful of segments from where it was last time.
 */
export interface RoutePoint { x: number; z: number; dx: number; dz: number }

export class Route {
  private readonly xs: number[] = [];
  private readonly zs: number[] = [];
  /** Distance along the route at each point. */
  private readonly at: number[] = [];
  readonly length: number;
  /** Where it starts and ends, and the heading at each end. */
  readonly start: RoutePoint;
  readonly end: RoutePoint;

  /** `corners`: the lane's corner points in order; each inner corner is rounded with `radius` metres. */
  constructor(corners: readonly (readonly [number, number])[], radius = 4) {
    const push = (x: number, z: number) => {
      const n = this.xs.length;
      const d = n ? Math.hypot(x - this.xs[n - 1], z - this.zs[n - 1]) : 0;
      if (n && d < 1e-6) return;
      this.xs.push(x);
      this.zs.push(z);
      this.at.push(n ? this.at[n - 1] + d : 0);
    };
    push(corners[0][0], corners[0][1]);
    for (let i = 1; i < corners.length - 1; i++) {
      const [px, pz] = corners[i - 1];
      const [cx, cz] = corners[i];
      const [nx, nz] = corners[i + 1];
      const a = Math.hypot(cx - px, cz - pz);
      const b = Math.hypot(nx - cx, nz - cz);
      const r = Math.min(radius, a / 2, b / 2);
      // A quadratic curve from `r` before the corner to `r` after it, the corner its control point.
      const ax = cx + ((px - cx) / a) * r;
      const az = cz + ((pz - cz) / a) * r;
      const bx = cx + ((nx - cx) / b) * r;
      const bz = cz + ((nz - cz) / b) * r;
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        const u = 1 - t;
        push(u * u * ax + 2 * u * t * cx + t * t * bx, u * u * az + 2 * u * t * cz + t * t * bz);
      }
    }
    const last = corners[corners.length - 1];
    push(last[0], last[1]);
    this.length = this.at[this.at.length - 1];
    this.start = this.point(0, { x: 0, z: 0, dx: 0, dz: 1 });
    this.end = this.point(this.length, { x: 0, z: 0, dx: 0, dz: 1 });
  }

  /** Writes the position and heading `s` metres along into `out`; `hint` is the segment it was on last. */
  point(s: number, out: RoutePoint, hint = { seg: 0 }): RoutePoint {
    const n = this.xs.length;
    let i = Math.min(Math.max(hint.seg, 0), n - 2);
    while (i > 0 && this.at[i] > s) i--;
    while (i < n - 2 && this.at[i + 1] < s) i++;
    hint.seg = i;
    const len = this.at[i + 1] - this.at[i];
    const t = Math.min(1, Math.max(0, (s - this.at[i]) / len));
    out.dx = (this.xs[i + 1] - this.xs[i]) / len;
    out.dz = (this.zs[i + 1] - this.zs[i]) / len;
    out.x = this.xs[i] + (this.xs[i + 1] - this.xs[i]) * t;
    out.z = this.zs[i] + (this.zs[i + 1] - this.zs[i]) * t;
    return out;
  }
}
