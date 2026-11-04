/** Follow browser chrome and keyboards without resizing the scene or polling the render loop. */
export function trackUiViewport(): void {
  const viewport = window.visualViewport;
  let scheduled = 0;
  const update = () => {
    scheduled = 0;
    const style = document.documentElement.style;
    style.setProperty('--ui-top', `${viewport?.offsetTop ?? 0}px`);
    style.setProperty('--ui-height', `${viewport?.height ?? window.innerHeight}px`);
  };
  const schedule = () => {
    if (!scheduled) scheduled = requestAnimationFrame(update);
  };
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', schedule);
  document.addEventListener('fullscreenchange', schedule);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
  update();
}
