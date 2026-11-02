import { t } from '../i18n';
import type { MenuItem } from './actionMenu';

/** The map overlays: off, or one of the views of the district's numbers. */
export type OverlayKind = 'off' | 'load' | 'staff' | 'people' | 'police' | 'street' | 'shops' | 'city' | 'reach';

const LABEL: Record<OverlayKind, string> = {
  off: t('No overlay'),
  load: t('Services load'),
  staff: t('Staffing'),
  people: t('Who is where'),
  police: t('Police'),
  street: t('Street scene'),
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

const KEY = 'hrp-overlay';
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/**
 * The layers button floating over the map and the legend that goes with an
 * overlay. The button opens a menu of the overlays (the one on is marked);
 * the legend says what the colours mean and the numbers behind them; pressing
 * the button again turns the overlay off. A line naming a place takes the camera
 * there. The choice is remembered on this device.
 */
export class MapLayers {
  readonly button: HTMLButtonElement;
  private readonly legend: HTMLElement;
  private readonly title: HTMLElement;
  private readonly rows: HTMLUListElement;
  private rowsKey = '';
  kind: OverlayKind = 'off';

  constructor(parent: HTMLElement, private readonly onChange: (kind: OverlayKind) => void, openMenu: (x: number, y: number, title: string, items: MenuItem[]) => void, private readonly focus: (x: number, z: number) => void) {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'layers-toggle';
    this.button.setAttribute('aria-haspopup', 'menu');
    this.button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 3 2 8.5 12 14l10-5.5L12 3zM2 13l10 5.5L22 13M2 17.5 12 23l10-5.5"/></svg>';
    // A tap opens the menu of overlays; with one on, a tap turns it off. Right-click or a long press
    // always opens the menu, to switch straight to another.
    const menu = () => {
      const r = this.button.getBoundingClientRect();
      openMenu(r.left, r.bottom + 4, t('Map overlay'), (Object.keys(LABEL) as OverlayKind[]).filter((k) => k !== 'off').map((k) => ({
        label: `${k === this.kind ? '✓ ' : ''}${LABEL[k]}`,
        disabled: false,
        run: () => this.set(k),
      })));
    };
    let press = 0;
    let pressed = false;
    this.button.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      pressed = false;
      press = window.setTimeout(() => { pressed = true; menu(); }, 500);
    });
    const cancel = () => clearTimeout(press);
    this.button.addEventListener('pointerup', cancel);
    this.button.addEventListener('pointercancel', cancel);
    this.button.addEventListener('pointerleave', cancel);
    this.button.addEventListener('contextmenu', (e) => { e.preventDefault(); cancel(); menu(); });
    this.button.addEventListener('click', () => {
      if (pressed) { pressed = false; return; }
      if (this.kind !== 'off') this.set('off');
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
    this.button.setAttribute('aria-label', this.kind === 'off' ? t('Map overlay: off. Press to choose one.') : t('Map overlay: {name}. Press to turn it off.', { name: LABEL[this.kind] }));
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
