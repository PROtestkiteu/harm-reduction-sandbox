import { registerTransient } from './transientSurfaces';
import './iconHints.css';

const ACTION = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[role="button"]:not([aria-disabled="true"]),[data-hint-action]';
interface Hint { anchor: HTMLElement; text: string; action: boolean }

/** Delegate across dynamic UI: informational indicators explain themselves; actions keep their taps. */
export function installIconHints(): void {
  if (document.getElementById('icon-hint')) return;
  const box = Object.assign(document.createElement('div'), { id: 'icon-hint', className: 'icon-hint', hidden: true });
  box.setAttribute('role', 'tooltip');
  document.body.append(box);
  let active: Hint | null = null;
  let mode: 'hover' | 'tap' | 'focus' = 'hover';
  let dismissed = false;
  let keyboardFocus = false;
  let press: { id: number; x: number; y: number; hint: Hint | null; dismissed: boolean } | null = null;

  const resolve = (target: EventTarget | null): Hint | null => {
    if (!(target instanceof Element)) return null;
    // These clickable meters already own a richer hover preview and action panel.
    if (target.closest('[aria-controls="meter-causes"]')) return null;
    for (let node: Element | null = target; node && node !== document.body; node = node.parentElement) {
      if (!(node instanceof HTMLElement)) continue;
      let text = node.dataset.iconHint;
      if (text === undefined && node.matches('.money,.team-energy')) text = node.getAttribute('aria-label') ?? '';
      if (text === undefined && node.matches('button,[role="button"],a[href]') && (node.querySelector('svg') || node.hasAttribute('aria-label') || node.matches('.speed-toggle'))) {
        text = node.getAttribute('aria-label') ?? node.textContent ?? '';
      }
      if (text?.trim()) {
        const label = node.closest('label');
        return { anchor: node, text: text.trim(), action: !!node.closest(ACTION) || !!label?.control };
      }
    }
    return null;
  };
  const hide = () => {
    if (active) {
      const ids = (active.anchor.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(id => id && id !== box.id);
      if (ids.length) active.anchor.setAttribute('aria-describedby', ids.join(' '));
      else active.anchor.removeAttribute('aria-describedby');
    }
    active = null;
    box.hidden = true;
    changes.disconnect();
    size.disconnect();
  };
  const place = () => {
    if (!active) return;
    if (!active.anchor.isConnected || !active.anchor.getClientRects().length) { hide(); return; }
    const r = active.anchor.getBoundingClientRect();
    const v = window.visualViewport;
    const left = v?.offsetLeft ?? 0, top = v?.offsetTop ?? 0;
    const width = v?.width ?? innerWidth, height = v?.height ?? innerHeight;
    box.style.maxWidth = `${Math.max(0, Math.min(320, width - 16))}px`;
    box.style.maxHeight = `${Math.max(0, height - 16)}px`;
    const x = Math.max(left + 8, Math.min(r.left, left + width - box.offsetWidth - 8));
    const below = r.bottom + 7;
    const y = below + box.offsetHeight <= top + height - 8 ? below : Math.max(top + 8, r.top - box.offsetHeight - 7);
    box.style.left = `${Math.round(x)}px`;
    box.style.top = `${Math.round(y)}px`;
  };
  const changes = new MutationObserver(() => {
    const next = active && resolve(active.anchor);
    if (!next) { hide(); return; }
    active = next;
    if (box.textContent !== next.text) box.textContent = next.text;
    place();
  });
  const size = new ResizeObserver(place);
  const show = (hint: Hint, nextMode: typeof mode) => {
    if (!hint.anchor.isConnected) return;
    if (active?.anchor !== hint.anchor) hide();
    active = hint;
    mode = nextMode;
    const parent = hint.anchor.closest('dialog[open]') ?? document.body;
    if (box.parentElement !== parent) parent.append(box);
    box.textContent = hint.text;
    box.hidden = false;
    const ids = new Set((hint.anchor.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
    ids.add(box.id);
    hint.anchor.setAttribute('aria-describedby', [...ids].join(' '));
    changes.observe(hint.anchor, { attributes: true, attributeFilter: ['data-icon-hint', 'aria-label', 'hidden'] });
    size.observe(hint.anchor);
    place();
  };
  registerTransient({
    contains: () => false,
    dismiss: (event) => {
      if (event?.type === 'pointerdown') dismissed = !box.hidden;
      else press = null;
      hide();
    },
  });
  document.addEventListener('pointerdown', e => {
    keyboardFocus = false;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, hint: resolve(e.target), dismissed };
  }, true);
  document.addEventListener('pointerup', e => {
    const p = press;
    press = null;
    if (!p || p.id !== e.pointerId || p.dismissed || !p.hint || p.hint.action || e.button !== 0) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) return;
    const hint = resolve(e.target);
    if (hint?.anchor === p.hint.anchor && !hint.action) show(hint, 'tap');
  }, true);
  // Assistive technologies can activate an element without a pointer sequence.
  document.addEventListener('click', e => {
    if (e.detail !== 0) return;
    if (active) { hide(); return; }
    const hint = resolve(e.target);
    if (hint && !hint.action) show(hint, 'tap');
  }, true);
  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse' || e.buttons || press) return;
    const hint = resolve(e.target);
    if (hint) show(hint, 'hover');
  });
  document.addEventListener('pointerout', e => {
    if (mode === 'hover' && active && !(e.relatedTarget instanceof Node && active.anchor.contains(e.relatedTarget))) hide();
  });
  document.addEventListener('focusin', e => {
    const hint = resolve(e.target);
    if (keyboardFocus && hint?.anchor.matches(':focus-visible')) show(hint, 'focus');
  });
  document.addEventListener('focusout', () => { if (mode === 'focus') hide(); });
  document.addEventListener('keydown', e => {
    keyboardFocus = true;
    if (e.key === 'Escape') { hide(); return; }
    const hint = resolve(e.target);
    if (!hint || hint.action || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    if (active) hide(); else show(hint, 'focus');
  });
  document.addEventListener('scroll', () => { press = null; hide(); }, { capture: true, passive: true });
}
