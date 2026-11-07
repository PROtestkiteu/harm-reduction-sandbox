import { SERVICE_TEXT } from '../config/places';
import { SERVICE_IDS, type LocationId, type ServiceId } from '../sim/types';
import { locationOf } from '../game/guide';
import { t } from '../i18n';

/** Management has its own DOM and state; selecting a subject never replaces this list. */
export class ServicesPanel {
  readonly root = document.createElement('section');
  private readonly rows = new Map<ServiceId, { root: HTMLElement; toggle: HTMLButtonElement; state: HTMLElement }>();

  constructor(select: (id: LocationId) => void, toggle: (id: ServiceId, on: boolean) => void) {
    this.root.id = 'services-management';
    this.root.className = 'window services-window';
    this.root.hidden = true;
    this.root.setAttribute('aria-label', t('Services'));
    const list = document.createElement('ul');
    list.className = 'services-options';
    for (const id of SERVICE_IDS) {
      const row = document.createElement('li');
      row.className = 'svc-row';
      row.dataset.tutorialService = id;
      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'opt';
      name.textContent = SERVICE_TEXT[id].label;
      name.addEventListener('click', () => select(locationOf(id)));
      const control = document.createElement('button');
      control.type = 'button';
      control.className = 'svc-toggle';
      control.setAttribute('role', 'switch');
      control.setAttribute('aria-label', SERVICE_TEXT[id].label);
      const state = document.createElement('span');
      state.className = 'state';
      control.append(state);
      control.addEventListener('click', () => toggle(id, control.getAttribute('aria-checked') !== 'true'));
      row.append(name, control);
      list.append(row);
      this.rows.set(id, { root: row, toggle: control, state });
    }
    this.root.append(list);
  }

  update(enabled: Record<ServiceId, boolean>): void {
    for (const [id, row] of this.rows) {
      const on = String(enabled[id]);
      if (row.root.dataset.on === on) continue;
      row.root.dataset.on = on;
      row.toggle.setAttribute('aria-checked', on);
      row.state.textContent = enabled[id] ? t('On') : t('Off');
    }
  }

  setAvailable(services: readonly ServiceId[]): void {
    for (const [id, row] of this.rows) {
      const locked = !services.includes(id);
      row.root.dataset.tutorialLocked = String(locked);
      for (const button of row.root.querySelectorAll('button')) button.disabled = locked;
    }
  }

  focus(): void {
    this.root.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }
}
