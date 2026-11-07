/** One non-interactive arrow and focus ring follow the next normal tutorial control. */
export class TutorialCue {
  private target: HTMLElement | null = null;
  private visible = true;
  private readonly arrow = document.createElement('div');
  private readonly movement = new MutationObserver(() => this.set(this.target));
  constructor(private readonly host: HTMLElement, onActivate: (target: HTMLElement) => void) {
    this.arrow.className = 'tutorial-pointer';
    this.arrow.setAttribute('aria-hidden', 'true');
    this.arrow.hidden = true;
    host.append(this.arrow);
    host.addEventListener('click', event => {
      if (event.target instanceof Node && this.target?.contains(event.target)) onActivate(this.target);
    }, true);
    host.addEventListener('scroll', () => this.set(this.target), { capture: true, passive: true });
  }
  /** Reveal after inspector content and dock geometry have settled, using the current target. */
  reveal(): void {
    const target = this.target;
    const panel = target?.closest<HTMLElement>('.services-window, #selection-details, .sandbox-body, .site-picker');
    if (!this.visible || !target || !panel) return;
    const control = target.getBoundingClientRect(), bounds = panel.getBoundingClientRect();
    if (control.top < bounds.top || control.bottom > bounds.bottom || control.left < bounds.left || control.right > bounds.right) target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    this.set(target);
  }
  set(target: HTMLElement | null, visible = this.visible): void {
    if (target && (target.matches(':disabled') || !target.getClientRects().length)) target = null;
    if (this.target !== target || this.visible !== visible) {
      this.visible = visible;
      this.movement.disconnect();
      const window = target?.closest('.draggable-window');
      if (window) this.movement.observe(window, { attributes: true, attributeFilter: ['style'] });
      this.target?.classList.remove('tutorial-ui-target');
      this.target = target;
      if (visible && target?.closest('.services-window, #selection-details, .sandbox-body, .site-picker')) target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      if (visible) target?.classList.add('tutorial-ui-target');
    }
    this.arrow.hidden = !target || !visible;
    if (!target || !visible) return;
    const box = target.getBoundingClientRect(), host = this.host.getBoundingClientRect();
    const below = box.top - host.top < 22;
    this.arrow.style.left = `${Math.max(12, Math.min(host.width - 12, (box.left + box.right) / 2 - host.left))}px`;
    this.arrow.style.top = `${below ? box.bottom - host.top + 6 : box.top - host.top - 18}px`;
    this.arrow.dataset.below = String(below);
  }
}
