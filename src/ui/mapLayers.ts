import { t } from '../i18n';
import type { MenuItem } from './actionMenu';

/** The map overlays: off, or one of four views of the district's numbers. */
export type OverlayKind = 'off' | 'load' | 'people' | 'street' | 'reach';

const LABEL: Record<OverlayKind, string> = {
  off: t('No overlay'),
  load: t('Services load'),
  people: t('Who is where'),
  street: t('Street scene'),
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
}

const KEY = 'hrp-overlay';
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/**
 * The layers button beside the clock and the legend that goes with an
 * overlay. The button opens a menu of the overlays (the one on is marked);
 * the legend says what the colours mean and the numbers behind them, and its
 * close button turns the overlay off. The choice is remembered on this device.
 */
export class MapLayers {
  readonly button: HTMLButtonElement;
  private readonly legend: HTMLElement;
  private readonly title: HTMLElement;
  private readonly rows: HTMLUListElement;
  private rowsKey = '';
  kind: OverlayKind = 'off';

  constructor(parent: HTMLElement, private readonly onChange: (kind: OverlayKind) => void, openMenu: (x: number, y: number, title: string, items: MenuItem[]) => void) {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'layers-toggle';
    this.button.setAttribute('aria-haspopup', 'menu');
    this.button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 3 2 8.5 12 14l10-5.5L12 3zM2 13l10 5.5L22 13M2 17.5 12 23l10-5.5"/></svg>';
    this.button.addEventListener('click', () => {
      const r = this.button.getBoundingClientRect();
      openMenu(r.left, r.bottom + 4, t('Map overlay'), (Object.keys(LABEL) as OverlayKind[]).map((k) => ({
        label: `${k === this.kind ? '✓ ' : ''}${LABEL[k]}`,
        disabled: false,
        run: () => this.set(k),
      })));
    });

    this.legend = document.createElement('section');
    this.legend.className = 'map-legend';
    this.legend.hidden = true;
    this.legend.setAttribute('aria-live', 'polite');
    const head = document.createElement('div');
    head.className = 'map-legend-head';
    this.title = document.createElement('h3');
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'map-legend-close';
    close.textContent = '×';
    close.setAttribute('aria-label', t('Turn the overlay off'));
    close.addEventListener('click', () => this.set('off'));
    head.append(this.title, close);
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
    this.button.setAttribute('aria-label', this.kind === 'off' ? t('Map overlay: off') : t('Map overlay: {name}', { name: LABEL[this.kind] }));
    this.button.title = this.button.getAttribute('aria-label') ?? '';
  }

  /** The legend's lines; the DOM is touched only when they changed. */
  setLegend(rows: readonly LegendRow[]): void {
    const key = rows.map((r) => `${r.color ?? ''}|${r.ring ?? ''}|${r.minor ?? ''}|${r.text}`).join('\n');
    if (key === this.rowsKey) return;
    this.rowsKey = key;
    this.rows.replaceChildren(...rows.map((r) => {
      const li = document.createElement('li');
      if (r.minor) li.className = 'minor';
      if (r.color !== undefined) {
        const sw = document.createElement('span');
        sw.className = r.ring ? 'swatch ring' : 'swatch';
        sw.style.setProperty('--c', hex(r.color));
        li.append(sw);
      }
      li.append(document.createTextNode(r.text));
      return li;
    }));
  }
}
