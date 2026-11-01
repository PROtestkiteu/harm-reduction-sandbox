import type { RaveTheme } from '../world/eventFx';
import { t } from '../i18n';

export type FxKind = 'rave' | 'raid' | 'sweep' | 'alert' | 'press' | 'threatPress' | 'threatRaid' | 'threatOfficer' | 'threatCar';

const TEXT = (kind: FxKind, theme: RaveTheme | null): string =>
  kind === 'rave' ? (theme === 'wixapol' ? t('Wixapol: flash rave') : theme === 'hazel' ? t('DJ Hazel in memoriam') : t('Pop-up party'))
    : kind === 'raid' ? t('Police raid')
      : kind === 'sweep' ? t('Camp being cleared')
        : kind === 'alert' ? t('Bad batch: warning out')
          : kind === 'press' ? t('Press at the door')
            : kind === 'threatPress' ? t('TV crew: visitors stay away')
              : kind === 'threatRaid' ? t('Raid: visitors stay away')
                : kind === 'threatOfficer' ? t('Police: people turn back')
                  : t('Police car: people turn back');

/**
 * Name tags over the big events on the street ("Police raid", "Wixapol"),
 * so the lights say what they are. Built when the set of events changes;
 * moving them only sets a transform.
 */
export class FxTags {
  private readonly layer: HTMLElement;
  private key = '';

  constructor(parent: HTMLElement) {
    this.layer = document.createElement('div');
    this.layer.className = 'fx-tags';
    this.layer.setAttribute('aria-live', 'polite');
    // Under the HUD column and header, like the place names.
    parent.prepend(this.layer);
  }

  /** Shows a tag per event at its screen point (`x`, `y` in CSS pixels). */
  set(items: readonly { kind: FxKind; theme: RaveTheme | null; x: number; y: number }[]): void {
    const key = items.map((i) => `${i.kind}:${i.theme}`).join('|');
    if (key !== this.key) {
      this.key = key;
      this.layer.replaceChildren(...items.map((i) => {
        const tag = document.createElement('span');
        tag.className = 'fx-tag';
        tag.dataset.kind = i.kind;
        tag.textContent = TEXT(i.kind, i.theme);
        return tag;
      }));
    }
    items.forEach((i, n) => {
      const tag = this.layer.children[n] as HTMLElement;
      tag.style.transform = `translate(${Math.round(i.x)}px, ${Math.round(i.y)}px) translate(-50%, -100%)`;
    });
  }
}
