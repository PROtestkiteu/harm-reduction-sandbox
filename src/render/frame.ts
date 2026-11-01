/** Geometry of one rendered frame and how it maps onto the canvas. */
export interface RenderFrame {
  cssW: number;
  cssH: number;
  /** Device pixels per CSS pixel used for rendering (capped for cost). */
  dpr: number;
  /** Device pixels per render pixel. 1: the scene renders at device resolution. */
  factor: number;
  /** Render target size in render pixels. */
  lowW: number;
  lowH: number;
}

/**
 * Picks the render resolution: device pixels, capped at 2 so 3x phones do
 * not pay for detail nobody can see. Multisampling handles edge aliasing.
 */
export function chooseFrame(cssW: number, cssH: number, deviceDpr: number): RenderFrame {
  const dpr = Math.min(deviceDpr || 1, 2);
  return { cssW, cssH, dpr, factor: 1, lowW: Math.max(1, Math.floor(cssW * dpr)), lowH: Math.max(1, Math.floor(cssH * dpr)) };
}
