export interface ViewportMetrics {
  width: number; height: number; screenHeight: number; installed: boolean;
  visual: { left: number; top: number; width: number; height: number; scale: number };
  safe: { top: number; right: number; bottom: number; left: number };
}

/** Recover only a missing safe-area band, never a keyboard-sized viewport reduction. */
export function viewportGeometry(m: ViewportMetrics) {
  const missing = m.screenHeight - m.height;
  const extension = m.installed && missing > 0 && Math.abs(missing - m.safe.top) <= 1 ? missing : 0;
  const sceneHeight = m.height + extension;
  const visualHeight = m.visual.height + (m.visual.scale === 1 && Math.abs(m.visual.height - m.height) <= 1 ? extension : 0);
  const top = Math.max(m.visual.top, m.safe.top);
  const left = Math.max(m.visual.left, m.safe.left);
  const right = Math.min(m.visual.left + m.visual.width, m.width - m.safe.right);
  const bottom = Math.min(m.visual.top + visualHeight, sceneHeight - m.safe.bottom);
  return { sceneHeight, top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}
