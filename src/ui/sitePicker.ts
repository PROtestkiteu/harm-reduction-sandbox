import { draggableWindow } from './draggableWindow';
import { t } from '../i18n';
import type { ServiceSite } from '../sim/serviceSites';
export interface SiteChoice { site: ServiceSite; name: string; detail: string }
/** Non-modal placement controls leave the map available to mouse, touch and camera gestures. */
export class SitePicker {
  readonly root = document.createElement('section');
  private readonly dragging: ReturnType<typeof draggableWindow>;
  private readonly title = document.createElement('strong');
  private readonly hint = document.createElement('p');
  private readonly selected = document.createElement('p');
  private readonly place = document.createElement('button');
  private step: (by: number) => void = () => {};
  private confirm: () => void = () => {};
  private cancel: () => void = () => {};
  private previousFocus: HTMLElement | null = null;
  constructor(parent: HTMLElement, private readonly onChange: (open: boolean) => void) {
    this.root.className = 'site-picker'; this.root.hidden = true;
    this.title.className = 'window-drag-handle';
    this.dragging = draggableWindow(this.root, '.window-drag-handle');
    this.root.setAttribute('role', 'region'); this.root.setAttribute('aria-labelledby', 'site-picker-title');
    this.title.id = 'site-picker-title';
    this.hint.textContent = t('Click or tap a highlighted building or curb on the map. Drag to look around.');
    this.selected.setAttribute('role', 'status'); this.selected.setAttribute('aria-live', 'polite');
    const controls = document.createElement('div'); controls.className = 'site-picker-controls';
    const button = (text: string, action: string, run: () => void) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.placementAction = action; b.textContent = text; b.addEventListener('click', run); return b;
    };
    this.place.type = 'button'; this.place.dataset.placementAction = 'open'; this.place.textContent = t('Open here'); this.place.addEventListener('click', () => this.confirm());
    controls.append(button(t('Previous site'), 'previous', () => this.step(-1)), button(t('Next site'), 'next', () => this.step(1)), this.place, button(t('Cancel placement'), 'cancel', () => this.cancel()));
    this.root.append(this.title, this.hint, this.selected, controls);
    this.root.addEventListener('keydown', e => {
      if (e.defaultPrevented) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); this.step(e.key === 'ArrowLeft' ? -1 : 1); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.cancel(); }
    });
    parent.append(this.root);
  }
  show(name: string, step: (by: number) => void, confirm: () => void, cancel: () => void, previousFocus?: HTMLElement | null): void {
    this.dragging.reset();
    this.step = step; this.confirm = confirm; this.cancel = cancel;
    this.previousFocus = previousFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    this.title.textContent = t('Choose a location for {name}', { name });
    this.setChoice(null); this.root.hidden = false; this.onChange(true);
    this.root.querySelector('button')?.focus({ preventScroll: true });
  }
  setChoice(choice: SiteChoice | null): void {
    this.selected.textContent = choice ? `${choice.name} · ${choice.detail}` : t('Green sites are available. Blue marks your selection. Escape cancels placement.');
    this.place.disabled = !choice;
  }
  hide(): void {
    if (this.root.hidden) return;
    const restoreFocus = this.root.contains(document.activeElement);
    this.dragging.reset();
    this.root.hidden = true; this.step = () => {}; this.confirm = () => {}; this.cancel = () => {};
    this.onChange(false);
    if (restoreFocus && this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
    this.previousFocus = null;
  }
}
