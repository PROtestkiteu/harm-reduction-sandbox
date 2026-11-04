import type { Insets } from '../render/camera';

export interface ScreenRect { left: number; top: number; right: number; bottom: number }

/** Largest clear rectangular map region. Evaluated on layout changes, never while panning. */
export function cameraArea(viewport: ScreenRect, width: number, height: number, panels: readonly ScreenRect[]): Insets {
  const obstacles = panels.map(p => ({ left: Math.max(viewport.left, p.left), top: Math.max(viewport.top, p.top),
    right: Math.min(viewport.right, p.right), bottom: Math.min(viewport.bottom, p.bottom) }))
    .filter(p => p.right > p.left && p.bottom > p.top);
  const xs = [...new Set([viewport.left, viewport.right, ...obstacles.flatMap(p => [p.left, p.right])])].sort((a, b) => a - b);
  const ys = [...new Set([viewport.top, viewport.bottom, ...obstacles.flatMap(p => [p.top, p.bottom])])].sort((a, b) => a - b);
  let best = viewport, area = 0;
  for (let x = 0; x < xs.length - 1; x++) for (let xx = x + 1; xx < xs.length; xx++) {
    for (let y = 0; y < ys.length - 1; y++) for (let yy = y + 1; yy < ys.length; yy++) {
      const candidate = { left: xs[x], right: xs[xx], top: ys[y], bottom: ys[yy] };
      const size = (candidate.right - candidate.left) * (candidate.bottom - candidate.top);
      if (size <= area || obstacles.some(p => p.left < candidate.right && p.right > candidate.left && p.top < candidate.bottom && p.bottom > candidate.top)) continue;
      best = candidate; area = size;
    }
  }
  return { left: best.left, top: best.top, right: Math.max(0, width - best.right), bottom: Math.max(0, height - best.bottom) };
}
