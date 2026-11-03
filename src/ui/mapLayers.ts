import { t } from '../i18n';
import type { ActionMenu } from './actionMenu';

/** The map overlays: off, or one of the views of the district's numbers. */
export type OverlayKind = 'off' | 'load' | 'staff' | 'people' | 'police' | 'crime' | 'street' | 'residents' | 'commerce' | 'shops' | 'city' | 'reach';

const LABEL: Record<OverlayKind, string> = {
  off: t('No overlay'),
  load: t('Services load'),
  staff: t('Staffing'),
  people: t('Who is where'),
  police: t('Police'),
  crime: t('Crime'),
  street: t('Street scene'),
  residents: t('Residents'),
  commerce: t('Commerce and nightlife'),
  shops: t('Shops and property'),
  city: t('City institutions'),
  reach: t('Reach'),
};

export interface LegendRow {
  /** Swatch colour, or none for a plain line. */
  color?: number;
  /** Drawn as a ring rather than a filled swatch. */
  ring?: boolean;
  /** A line of little weight (a closed service): left out on small screens. */
  minor?: boolean;
  text: string;
  /** Where on the map it is: the line becomes a button that takes the camera there. */
  at?: { x: number; z: number };
}

/** A line icon per overlay, for its menu entry (the inside of a 24 by 24 SVG). */
const ICON: Record<Exclude<OverlayKind, 'off'>, string> = {
  // A gauge.
  load: '<path d="M4 17a8 8 0 0 1 16 0"/><path d="M12 17l4.5-5"/><path d="M4 17h16"/>',
  // Two people side by side.
  staff: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3 3 0 0 1 0 5.6"/><path d="M18 14.5c1.8.8 3 2.9 3 5.5"/>',
  // Scattered dots.
  people: '<circle cx="6" cy="7" r="1.6"/><circle cx="13" cy="5" r="1.6"/><circle cx="18" cy="10" r="1.6"/><circle cx="8" cy="14" r="1.6"/><circle cx="15" cy="16" r="1.6"/><circle cx="10" cy="20" r="1.6"/>',
  // A badge shield.
  police: '<path d="M12 3l7 3v5c0 4.8-3.2 8.4-7 10-3.8-1.6-7-5.2-7-10V6l7-3z"/><path d="M12 8.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z"/>',
  // A warning triangle.
  crime: '<path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 10v4.5"/><path d="M12 17.2v.3"/>',
  // A dome tent.
  street: '<path d="M2.5 19a9.5 9.5 0 0 1 19 0z"/><path d="M9.5 19l2.5-5 2.5 5"/><path d="M12 9.5V14"/>',
  // A house.
  residents: '<path d="M3 11l9-7 9 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>',
  // A cocktail glass.
  commerce: '<path d="M4.5 4h15L12 12.5 4.5 4z"/><path d="M12 12.5V20"/><path d="M8 20h8"/><path d="M15.5 8.2l3-5.2"/>',
  // A shopfront with an awning.
  shops: '<path d="M3.5 9l1.8-5h13.4l1.8 5"/><path d="M3.5 9h17"/><path d="M3.5 9a2.8 2.8 0 0 0 5.7 0 2.8 2.8 0 0 0 5.6 0 2.8 2.8 0 0 0 5.7 0"/><path d="M5 11.5V20h14v-8.5"/><path d="M10 20v-4.5h4V20"/>',
  // A columned public building.
  city: '<path d="M3 9l9-5 9 5"/><path d="M3 9h18"/><path d="M6 9v9M10 9v9M14 9v9M18 9v9"/><path d="M3 20h18"/>',
  // Rings spreading out.
  reach: '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="9"/>',
};

const KEY = 'hrp-overlay';
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/**
 * The layers button floating over the map and the legend that goes with an
 * overlay. The button opens and closes a menu of the overlays (the one on is
 * marked, and choosing it again turns it off); the legend says what the colours
 * mean and the numbers behind them. A line naming a place takes the camera
 * there. The choice is remembered on this device.
 */
export class MapLayers {
  readonly button: HTMLButtonElement;
  private readonly legend: HTMLElement;
  private readonly title: HTMLElement;
  private readonly rows: HTMLUListElement;
  private rowsKey = '';
  kind: OverlayKind = 'off';

  constructor(parent: HTMLElement, private readonly onChange: (kind: OverlayKind) => void, actions: Pick<ActionMenu, 'show' | 'close' | 'openFor'>, private readonly focus: (x: number, z: number) => void) {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'layers-toggle';
    this.button.setAttribute('aria-haspopup', 'menu');
    this.button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 3 2 8.5 12 14l10-5.5L12 3zM2 13l10 5.5L22 13M2 17.5 12 23l10-5.5"/></svg>';
    // The button opens and closes the menu of overlays; nothing else. In the menu a choice switches to that
    // overlay and the menu stays open, so they can be tried one after another; choosing the one that is on
    // turns it off. A press anywhere else, Escape or the button again closes the menu and keeps the overlay.
    const menu = () => {
      const r = this.button.getBoundingClientRect();
      actions.show(r.left, r.bottom + 4, t('Map overlay'), (Object.keys(ICON) as Exclude<OverlayKind, 'off'>[]).map((k) => ({
        label: LABEL[k],
        icon: ICON[k],
        current: k === this.kind,
        keepOpen: true,
        disabled: false,
        run: () => { this.set(k === this.kind ? 'off' : k); menu(); },
      })), this.button);
    };
    this.button.setAttribute('aria-expanded', 'false');
    this.button.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!actions.openFor(this.button)) menu(); });
    this.button.addEventListener('click', () => {
      if (actions.openFor(this.button)) actions.close();
      else menu();
    });

    this.legend = document.createElement('section');
    this.legend.className = 'map-legend';
    this.legend.hidden = true;
    this.legend.setAttribute('aria-live', 'polite');
    const head = document.createElement('div');
    head.className = 'map-legend-head';
    this.title = document.createElement('h3');
    head.append(this.title);
    this.rows = document.createElement('ul');
    this.legend.append(head, this.rows);
    parent.append(this.legend);

    let kept: string | null = null;
    try { kept = localStorage.getItem(KEY); } catch { /* storage blocked */ }
    // The kept choice is shown without calling back: the caller draws it on its first refresh.
    this.show(kept && kept in LABEL ? kept as OverlayKind : 'off');
  }

  set(kind: OverlayKind): void {
    try { localStorage.setItem(KEY, kind); } catch { /* storage blocked */ }
    this.show(kind);
    this.onChange(kind);
  }

  private show(kind: OverlayKind): void {
    this.kind = kind;
    this.legend.hidden = kind === 'off';
    this.title.textContent = LABEL[kind];
    this.rowsKey = '';
    this.label();
  }

  private label(): void {
    this.button.dataset.on = String(this.kind !== 'off');
    this.button.setAttribute('aria-label', this.kind === 'off' ? t('Map overlay: off. Press to choose one.') : t('Map overlay: {name}. Press to choose another or turn it off.', { name: LABEL[this.kind] }));
    this.button.title = this.button.getAttribute('aria-label') ?? '';
  }

  /** The legend's lines; the DOM is touched only when they changed. */
  setLegend(rows: readonly LegendRow[]): void {
    const key = rows.map((r) => `${r.color ?? ''}|${r.ring ?? ''}|${r.minor ?? ''}|${r.at ? `${r.at.x},${r.at.z}` : ''}|${r.text}`).join('\n');
    if (key === this.rowsKey) return;
    this.rowsKey = key;
    this.rows.replaceChildren(...rows.map((r) => {
      const li = document.createElement('li');
      if (r.minor) li.className = 'minor';
      // A line with a place becomes a button that shows it, as the place may be off screen.
      const box = r.at ? Object.assign(document.createElement('button'), { type: 'button', className: 'legend-go', title: t('Show on the map') }) : li;
      if (r.color !== undefined) {
        const sw = document.createElement('span');
        sw.className = r.ring ? 'swatch ring' : 'swatch';
        sw.style.setProperty('--c', hex(r.color));
        box.append(sw);
      }
      box.append(document.createTextNode(r.text));
      if (r.at) {
        const { x, z } = r.at;
        box.addEventListener('click', () => this.focus(x, z));
        li.append(box);
      }
      return li;
    }));
  }
}
