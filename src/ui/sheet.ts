import { t } from '../i18n';

export interface SheetOptions {
  /** Accessible name of the sheet. */
  label: string;
  /** An existing content heading can close the sheet when collapsed, without a second icon. */
  disclosure?(): HTMLDetailsElement | null;
  /** Fires when the sheet opens, so other panels in the same place can close. */
  onOpen?(): void;
  onChange?(open: boolean): void;
}

/**
 * A panel in the settings' place and style (a column on the left, a bottom
 * sheet on phones) for one section opened from elsewhere, such as the
 * organisation from the money in the top bar. It has no toggle of its own:
 * the caller toggles it; an existing disclosure heading or Escape shuts it.
 */
export class Sheet {
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private disclosure: HTMLDetailsElement | null = null;
  private disclosureHint: string | undefined;
  private readonly collapsed = () => {
    if (this.disclosure && !this.disclosure.open) this.setOpen(false, true);
  };
  private readonly opts: SheetOptions;
  /** Where focus was before opening, to return it on close. */
  private returnTo: HTMLElement | null = null;
  private returnRegion: HTMLElement | null = null;

  constructor(parent: HTMLElement, content: HTMLElement, opts: SheetOptions) {
    this.opts = opts;
    this.root = document.createElement('section');
    this.root.className = 'sandbox sheet';
    this.root.setAttribute('aria-label', opts.label);
    this.body = document.createElement('div');
    this.body.className = 'sandbox-body';
    this.body.hidden = true;
    this.body.tabIndex = -1;
    this.body.append(content);
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
    if (disclosure !== this.disclosure) {
      const previous = this.disclosure?.querySelector<HTMLElement>('summary');
      if (previous) {
        if (this.disclosureHint === undefined) delete previous.dataset.iconHint;
        else previous.dataset.iconHint = this.disclosureHint;
      }
      this.disclosure?.removeEventListener('toggle', this.collapsed);
      this.disclosure = disclosure;
      disclosure?.addEventListener('toggle', this.collapsed);
      const summary = disclosure?.querySelector<HTMLElement>('summary');
      this.disclosureHint = summary?.dataset.iconHint;
      if (summary) summary.dataset.iconHint = t('Close {name}', { name: this.opts.label });
    }
    if (open === this.isOpen) return;
    if (open) {
      this.returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.returnRegion = this.returnTo?.closest<HTMLElement>('section') ?? null;
      this.opts.onOpen?.();
    }
    this.body.hidden = !open;
    this.root.dataset.open = String(open);
    this.opts.onChange?.(open);
    if (open) (this.disclosure?.querySelector<HTMLElement>('summary') ?? this.body).focus({ preventScroll: true });
    else if (returnFocus) {
      const target = this.returnTo?.isConnected ? this.returnTo : this.returnRegion?.querySelector<HTMLElement>('button:not([disabled]), [tabindex="0"]');
      if (target?.getClientRects().length) target.focus({ preventScroll: true });
    }
  }
}
