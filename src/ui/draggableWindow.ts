import './draggableWindow.css';

interface Point { x: number; y: number }
const moved = new Set<(cancelDrag?: boolean) => void>();
const resize = () => { for (const clamp of moved) clamp(true); };
const sizes = new ResizeObserver(() => { for (const clamp of moved) clamp(); });
function track(clamp: () => void, root: HTMLElement): void {
  if (!moved.size) {
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
  }
  moved.add(clamp);
  sizes.observe(root);
}
function untrack(clamp: () => void, root: HTMLElement): void {
  moved.delete(clamp);
  sizes.unobserve(root);
  if (!moved.size) {
    window.removeEventListener('resize', resize);
    window.visualViewport?.removeEventListener('resize', resize);
  }
}
function viewport() {
  const v = window.visualViewport;
  return { left: (v?.offsetLeft ?? 0) + 8, top: (v?.offsetTop ?? 0) + 8,
    right: (v ? v.offsetLeft + v.width : innerWidth) - 8, bottom: (v ? v.offsetTop + v.height : innerHeight) - 8 };
}

/** Event-driven positioning shared by floating panels; content keeps its normal scrolling. */
export function draggableWindow(root: HTMLElement, handles = 'h2', enabled = () => true): { reset(): void; refresh(): void } {
  root.classList.add('draggable-window');
  // Real edge targets reserve touch dragging without disabling content scrolling.
  const refresh = () => {
    for (const edge of ['top', 'right', 'bottom', 'left']) {
      if (root.querySelector(`:scope > .window-drag-margin[data-edge="${edge}"]`)) continue;
      const margin = document.createElement('span');
      margin.className = 'window-drag-margin';
      margin.dataset.edge = edge;
      margin.setAttribute('aria-hidden', 'true');
      root.append(margin);
    }
  };
  refresh();
  let offset: Point = { x: 0, y: 0 };
  let drag: { id: number; start: Point; origin: Point; rect: DOMRect; bounds: ReturnType<typeof viewport>; moved: boolean } | null = null;
  let suppressClick = false;
  const write = () => {
    root.style.setProperty('--window-drag-x', `${offset.x}px`);
    root.style.setProperty('--window-drag-y', `${offset.y}px`);
  };
  const limit = (value: number, min: number, max: number) => Math.max(min, Math.min(Math.max(min, max), value));
  const constrain = (x: number, y: number, rect: DOMRect, bounds: ReturnType<typeof viewport>) => ({
    x: limit(x, bounds.left - rect.left, bounds.right - rect.right),
    y: limit(y, bounds.top - rect.top, bounds.bottom - rect.bottom),
  });
  const clamp = (cancelDrag = false) => {
    if (!root.getClientRects().length || (drag && !cancelDrag)) return;
    finish();
    const delta = constrain(0, 0, root.getBoundingClientRect(), viewport());
    offset = { x: offset.x + delta.x, y: offset.y + delta.y };
    write();
  };
  const finish = () => {
    if (!drag) return;
    const id = drag.id;
    suppressClick = drag.moved;
    drag = null;
    delete root.dataset.dragging;
    document.removeEventListener('pointermove', move, true);
    document.removeEventListener('pointerup', end, true);
    document.removeEventListener('pointercancel', end, true);
    if (root.hasPointerCapture(id)) root.releasePointerCapture(id);
  };
  const reset = () => {
    finish();
    offset = { x: 0, y: 0 };
    root.style.removeProperty('--window-drag-x');
    root.style.removeProperty('--window-drag-y');
    untrack(clamp, root);
  };
  root.addEventListener('pointerdown', event => {
    suppressClick = false;
    if (!enabled() || drag || !event.isPrimary || event.button !== 0 || !(event.target instanceof Element)) return;
    const handle = event.target.closest(`${handles}, .window-drag-margin`);
    const background = event.target === root || event.target.matches('.sandbox-body, .panel-dismiss-slot, .tutorial-actions, .event-choices, .site-picker-controls');
    if ((!handle || !root.contains(handle)) && !background) return;
    const control = event.target.closest('button, input, select, textarea, a');
    if (control && control !== handle) return;
    // The tutorial's trailing fold control remains a direct tap target.
    if (handle?.classList.contains('tutorial-toggle') && event.clientX > handle.getBoundingClientRect().right - 32) return;
    const rect = root.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    event.stopPropagation();
    drag = { id: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: { ...offset }, rect, bounds: viewport(), moved: false };
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', end, true);
  });
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const x = event.clientX - drag.start.x, y = event.clientY - drag.start.y;
    if (!drag.moved && Math.hypot(x, y) < 6) return;
    if (!drag.moved) { drag.moved = true; root.setPointerCapture(event.pointerId); track(clamp, root); }
    event.preventDefault();
    event.stopPropagation();
    root.dataset.dragging = 'true';
    const delta = constrain(x, y, drag.rect, drag.bounds);
    offset = { x: drag.origin.x + delta.x, y: drag.origin.y + delta.y };
    write();
  };
  const end = (event: PointerEvent) => {
    if (drag?.id === event.pointerId) finish();
  };
  root.addEventListener('lostpointercapture', end);
  root.addEventListener('click', event => {
    if (!suppressClick || !event.detail) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  root.addEventListener('keydown', event => {
    if (!enabled() || !event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = constrain(event.key === 'ArrowLeft' ? -16 : event.key === 'ArrowRight' ? 16 : 0, event.key === 'ArrowUp' ? -16 : event.key === 'ArrowDown' ? 16 : 0, root.getBoundingClientRect(), viewport());
    if (!moved.has(clamp)) track(clamp, root);
    offset = { x: offset.x + delta.x, y: offset.y + delta.y };
    write();
  });
  root.addEventListener('close', reset);
  return { reset, refresh };
}
