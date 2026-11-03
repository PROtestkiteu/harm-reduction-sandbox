/**
 * CanvasRenderingContext2D.roundRect for browsers without it (Safari before 16), loaded only there
 * (compat/index.ts). Adds a closed rounded rectangle to the current path, as the standard one does:
 * radii as one value or a list of one to four (numbers or {x, y}, whose x is taken), clamped so
 * neighbouring corners never overlap. Negative width or height mirror the rectangle.
 */
type Radius = number | DOMPointInit;

function radiusOf(r: Radius): number {
  const v = typeof r === 'number' ? r : r.x ?? 0;
  if (!(v >= 0)) throw new RangeError('roundRect: radii must not be negative');
  return v;
}

function roundRect(this: CanvasRenderingContext2D | Path2D, x: number, y: number, w: number, h: number, radii: Radius | Radius[] = 0): void {
  const list = (Array.isArray(radii) ? radii : [radii]).map(radiusOf);
  if (list.length < 1 || list.length > 4) throw new RangeError('roundRect: one to four radii');
  // Top-left, top-right, bottom-right, bottom-left, as the standard spreads a shorter list.
  const [tl, tr, br, bl] = list.length === 1 ? [list[0], list[0], list[0], list[0]]
    : list.length === 2 ? [list[0], list[1], list[0], list[1]]
      : list.length === 3 ? [list[0], list[1], list[2], list[1]]
        : list;
  const aw = Math.abs(w);
  const ah = Math.abs(h);
  const scale = Math.min(1, aw / (tl + tr || 1), aw / (bl + br || 1), ah / (tl + bl || 1), ah / (tr + br || 1));
  const [a, b, c, d] = [tl * scale, tr * scale, br * scale, bl * scale];
  const sx = Math.sign(w) || 1;
  const sy = Math.sign(h) || 1;
  const x1 = x + w;
  const y1 = y + h;
  this.moveTo(x + a * sx, y);
  this.lineTo(x1 - b * sx, y);
  this.arcTo(x1, y, x1, y + b * sy, b);
  this.lineTo(x1, y1 - c * sy);
  this.arcTo(x1, y1, x1 - c * sx, y1, c);
  this.lineTo(x + d * sx, y1);
  this.arcTo(x, y1, x, y1 - d * sy, d);
  this.lineTo(x, y + a * sy);
  this.arcTo(x, y, x + a * sx, y, a);
  this.closePath();
  this.moveTo(x, y);
}

CanvasRenderingContext2D.prototype.roundRect = roundRect;
if (typeof Path2D !== 'undefined' && !Path2D.prototype.roundRect) Path2D.prototype.roundRect = roundRect;

export {};
