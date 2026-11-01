import { t } from '../i18n';

/** A slim bar at the top: a new version is out, and reloading keeps the game. */
export class UpdateBar {
  constructor(parent: HTMLElement, reload: () => void) {
    const bar = document.createElement('div');
    bar.className = 'update-bar';
    bar.setAttribute('role', 'status');
    const text = document.createElement('span');
    text.textContent = t('A new version is out. Reloading keeps your game.');
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'btn update-go';
    go.textContent = t('Reload now');
    go.addEventListener('click', reload);
    bar.append(text, go);
    parent.append(bar);
  }
}
