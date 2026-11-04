import { viewportGeometry } from './viewportGeometry';
/** Follow browser chrome and keyboards without resizing the scene or polling the render loop. */
export function trackUiViewport(): void {
  const viewport = window.visualViewport;
  const installed = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)');
  const probe = document.createElement('div');
  probe.className = 'viewport-safe-area';
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(probe);
  let scheduled = 0;
  const update = () => {
    scheduled = 0;
    const style = document.documentElement.style;
    const padding = getComputedStyle(probe);
    const portrait = window.matchMedia('(orientation: portrait)').matches;
    const bounds = viewportGeometry({ width: window.innerWidth, height: window.innerHeight,
      screenHeight: portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height), installed: installed.matches,
      visual: { top: viewport?.offsetTop ?? 0, left: viewport?.offsetLeft ?? 0,
        height: viewport?.height ?? window.innerHeight, width: viewport?.width ?? window.innerWidth, scale: viewport?.scale ?? 1 },
      safe: { top: parseFloat(padding.paddingTop) || 0, right: parseFloat(padding.paddingRight) || 0,
        bottom: parseFloat(padding.paddingBottom) || 0, left: parseFloat(padding.paddingLeft) || 0 } });
    for (const [key, value] of Object.entries(bounds)) {
      const name = key === 'sceneHeight' ? '--scene-height' : `--ui-${key}`, px = `${value}px`;
      if (style.getPropertyValue(name) !== px) style.setProperty(name, px);
    }
  };
  const schedule = () => {
    if (!scheduled) scheduled = requestAnimationFrame(update);
  };
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  installed.addEventListener('change', schedule);
  window.addEventListener('orientationchange', schedule);
  window.addEventListener('pageshow', schedule);
  document.addEventListener('fullscreenchange', schedule);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
  update();
}
