import { panelDismiss } from './panelDismiss';

export interface SheetOptions {
  /** Accessible name of the sheet. */
  label: string;
  /** An existing disclosure to focus when opening; folding it keeps the sheet open. */
  disclosure?(): HTMLDetailsElement | null;
  /** Fires when the sheet opens, so other panels in the same place can close. */
  onOpen?(): void;
  onChange?(open: boolean): void;
  fallbackFocus?(): HTMLElement | null;
}

/**
 * A panel centered in the full desktop viewport, and a bottom sheet on phones,
 * for a section opened from elsewhere, such as the
 * organisation from the money in the top bar. It has no toggle of its own:
 * the caller toggles it; Escape also shuts it.
 */
export class Sheet {
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private disclosure: HTMLDetailsElement | null = null;
  private readonly opts: SheetOptions;
  /** Where focus was before opening, to return it on close. */
  private returnTo: HTMLElement | null = null;
  private returnRegion: HTMLElement | null = null;
  private readonly outside = (event: PointerEvent) => {
    if (!(event.target instanceof Node) || this.body.contains(event.target) || this.returnTo?.contains(event.target)) return;
    this.setOpen(false);
  };

  constructor(parent: HTMLElement, content: HTMLElement, opts: SheetOptions) {
    this.opts = opts;
    this.root = document.createElement('section');
    this.root.className = 'sandbox sheet';
    this.root.setAttribute('aria-label', opts.label);
    this.body = document.createElement('div');
    this.body.className = 'sandbox-body';
    this.body.hidden = true;
    this.body.tabIndex = -1;
    const dismissal = document.createElement('div');
    dismissal.className = 'panel-dismiss-slot';
    dismissal.append(panelDismiss(() => this.setOpen(false, true)));
    this.body.append(dismissal, content);
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        e.stopPropagation();
        this.setOpen(false, true);
      }
    });
    this.root.append(this.body);
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return !this.body.hidden;
  }

  setOpen(open: boolean, returnFocus = false): void {
    const disclosure = open ? this.opts.disclosure?.() ?? null : null;
    this.disclosure = disclosure;
    if (open === this.isOpen) return;
    if (open) {
      this.returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.returnRegion = this.returnTo?.closest<HTMLElement>('section') ?? null;
      this.opts.onOpen?.();
    }
    this.body.hidden = !open;
    if (open) document.addEventListener('pointerdown', this.outside, true);
    else document.removeEventListener('pointerdown', this.outside, true);
    this.root.dataset.open = String(open);
    this.opts.onChange?.(open);
    if (open) (this.disclosure?.querySelector<HTMLElement>('summary') ?? this.body).focus({ preventScroll: true });
    else if (returnFocus) {
      const target = this.returnTo?.isConnected ? this.returnTo : this.opts.fallbackFocus?.() ?? this.returnRegion?.querySelector<HTMLElement>('button:not([disabled]), [tabindex="0"]');
      if (target?.getClientRects().length) target.focus({ preventScroll: true });
    }
  }
}
