/**
 * Installed on an iPhone's Home Screen, the page is first laid out one status bar short and given
 * the whole screen a moment after launch. Showing the game in between made its first frames jump:
 * the scene and the sheet were drawn for the short page, then stretched and re-framed.
 *
 * `whenViewportSettled` resolves once `target` (the full-screen canvas) is as tall as the screen,
 * and a few frames later, so the resize observer has re-laid out and the main loop has drawn the
 * final framing behind the loading screen. Anywhere else (a browser tab, a desktop) it resolves at
 * once. It never holds a launch back for longer than `timeoutMs`.
 */
export function whenViewportSettled(target: HTMLElement, timeoutMs = 1500): Promise<void> {
  const installed = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  if (!installed) return Promise.resolve();

  const screenHeight = () => {
    const portrait = window.matchMedia('(orientation: portrait)').matches;
    return portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  };
  const full = () => target.clientHeight >= screenHeight() - 1;
  if (full()) return Promise.resolve();

  return new Promise((resolve) => {
    const start = performance.now();
    // Resize observer, then the layout it schedules, then a frame of the main loop.
    let after = -1;
    const tick = () => {
      if (after < 0 && (full() || performance.now() - start > timeoutMs)) after = 3;
      if (after === 0) { resolve(); return; }
      if (after > 0) after--;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
