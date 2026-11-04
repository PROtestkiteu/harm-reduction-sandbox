interface TransientSurface {
  contains(target: Node): boolean;
  dismiss(event?: Event): void;
}

/** One set of input listeners for small hints and menus. Persistent panels do not register. */
const surfaces = new Set<TransientSurface>();
let listening = false;
export function registerTransient(surface: TransientSurface): void {
  surfaces.add(surface);
  if (listening) return;
  listening = true;
  const outside = (e: Event) => {
    if (!(e.target instanceof Node)) return;
    for (const s of surfaces) if (!s.contains(e.target)) s.dismiss(e);
  };
  const clear = () => { for (const s of surfaces) s.dismiss(); };
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('wheel', outside, { capture: true, passive: true });
  document.addEventListener('pointercancel', clear, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  window.addEventListener('blur', clear);
  window.addEventListener('resize', clear);
}
