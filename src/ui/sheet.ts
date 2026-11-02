import { t } from '../i18n';

export interface SheetOptions {
  /** Accessible name of the sheet and of its close button. */
  label: string;
  /** Fires when the sheet opens, so other panels in the same place can close. */
  onOpen?(): void;
}

/**
 * A panel in the settings' place and style (a column on the left, a bottom
 * sheet on phones) for one section opened from elsewhere, such as the
 * organisation from the money in the top bar. It has no toggle of its own:
 * the caller opens it, and the close button or Escape shuts it.
 */
export class Sheet {
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly close: HTMLButtonElement;
  private readonly opts: SheetOptions;
  /** Where focus was before opening, to return it on close. */
  private returnTo: HTMLElement | null = null;

  constructor(parent: HTMLElement, content: HTMLElement, opts: SheetOptions) {
    this.opts = opts;
    this.root = document.createElement('section');
    this.root.className = 'sandbox sheet';
    this.root.setAttribute('aria-label', opts.label);
    this.body = document.createElement('div');
    this.body.className = 'sandbox-body';
    this.body.hidden = true;
    const head = document.createElement('div');
    head.className = 'sandbox-head sheet-head';
    this.close = document.createElement('button');
    this.close.className = 'btn close';
    this.close.type = 'button';
    this.close.textContent = '×';
    this.close.setAttribute('aria-label', t('Close {name}', { name: opts.label }));
    this.close.addEventListener('click', () => this.setOpen(false, true));
    head.append(this.close);
    this.body.append(head, content);
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
    if (open === this.isOpen) return;
    if (open) {
      this.returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.opts.onOpen?.();
    }
    this.body.hidden = !open;
    this.root.dataset.open = String(open);
    if (open) this.close.focus({ preventScroll: true });
    else if (returnFocus) this.returnTo?.focus({ preventScroll: true });
  }
}
