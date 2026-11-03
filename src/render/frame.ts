import { QUALITY } from './quality';
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
 * Picks the render resolution: device pixels times the quality tier's scale,
 * capped by the tier (2 at High, so 3x phones do not pay for detail nobody can
 * see; up to 1.5x on low-density screens at Ultra; lower on lower tiers). Multisampling handles edge aliasing.
 */
export function chooseFrame(cssW: number, cssH: number, deviceDpr: number, maxDpr = QUALITY.maxDpr, scale = 1): RenderFrame {
  // A scale above 1 supersamples: the browser scales the larger drawing down to the screen.
  const dpr = Math.min((deviceDpr || 1) * scale, maxDpr);
  return { cssW, cssH, dpr, factor: 1, lowW: Math.max(1, Math.floor(cssW * dpr)), lowH: Math.max(1, Math.floor(cssH * dpr)) };
}
