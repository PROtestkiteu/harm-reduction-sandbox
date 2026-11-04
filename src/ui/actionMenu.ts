import { registerTransient } from './transientSurfaces';

/** One entry: its label, whether it can be used now, and what it does. */
export interface MenuItem {
  label: string;
  disabled: boolean;
  run(): void;
  /** A small line icon before the label: the inside of a 24 by 24 SVG (paths and circles), drawn in the text colour. */
  icon?: string;
  /** The one chosen now, of a set of choices: marked, and announced as checked. */
  current?: boolean;
  /** Choosing it leaves the menu open (the caller shows it again with the new state), to try one after another. */
  keepOpen?: boolean;
}

/**
 * A small action menu at the pointer: right-click with a mouse, long press on
 * touch. It lists the same actions as the numbered replies in the column, so
 * the two never drift apart. Keyboard: arrows move, Enter runs, Escape closes.
 */
export class ActionMenu {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLElement;
  private readonly list: HTMLUListElement;
  private returnFocus: HTMLElement | null = null;
  /** The button that opened the menu, if any: a press on it is the owner's to handle (it toggles the menu), not a press elsewhere. */
  private owner: HTMLElement | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'action-menu';
    this.root.hidden = true;
    this.title = document.createElement('p');
    this.title.className = 'action-menu-title';
    this.list = document.createElement('ul');
    this.list.setAttribute('role', 'menu');
    this.root.append(this.title, this.list);
    parent.append(this.root);

    this.root.addEventListener('keydown', (e) => {
      const items = [...this.list.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
      else if (e.key === 'Tab') this.close();
    });
    registerTransient({
      contains: (target) => this.root.contains(target) || !!this.owner?.contains(target),
      dismiss: () => this.close(false),
    });
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  /** True while the menu is open from `owner`. */
  openFor(owner: HTMLElement): boolean {
    return !this.root.hidden && this.owner === owner;
  }

  show(x: number, y: number, title: string, items: readonly MenuItem[], owner: HTMLElement | null = null): void {
    if (!items.length) return this.close();
    // Shown again in place (a choice that keeps it open): where focus returns to stays as it was.
    if (this.root.hidden || this.owner !== owner) this.returnFocus = document.activeElement as HTMLElement | null;
    if (this.owner !== owner) this.owner?.setAttribute('aria-expanded', 'false');
    this.owner = owner;
    owner?.setAttribute('aria-expanded', 'true');
    this.title.textContent = title;
    this.list.replaceChildren(...items.map((item) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'none');
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', item.current === undefined ? 'menuitem' : 'menuitemradio');
      if (item.current !== undefined) b.setAttribute('aria-checked', String(item.current));
      if (item.icon) {
        b.classList.add('has-icon');
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('aria-hidden', 'true');
        icon.setAttribute('class', 'menu-icon');
        icon.innerHTML = item.icon;
        b.append(icon, item.label);
      } else b.textContent = item.label;
      b.disabled = item.disabled;
      b.addEventListener('click', () => {
        if (!item.keepOpen) this.close();
        item.run();
      });
      li.append(b);
      return li;
    }));
    this.root.hidden = false;
    // Keep it on screen: flip left or up when it would run off an edge.
    const w = this.root.offsetWidth;
    const h = this.root.offsetHeight;
    const left = x + w + 8 > window.innerWidth ? Math.max(8, x - w) : x;
    const top = y + h + 8 > window.innerHeight ? Math.max(8, y - h) : y;
    this.root.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    (this.list.querySelector<HTMLButtonElement>('[aria-checked="true"]:not(:disabled)') ?? this.list.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus({ preventScroll: true });
  }

  close(returnFocus = true): void {
    if (this.root.hidden) return;
    this.root.hidden = true;
    this.owner?.setAttribute('aria-expanded', 'false');
    this.owner = null;
    const back = this.returnFocus;
    this.returnFocus = null;
    if (returnFocus && back && document.contains(back)) back.focus({ preventScroll: true });
  }
}
