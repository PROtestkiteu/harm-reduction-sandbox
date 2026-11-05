import { t } from '../i18n';
import './panelDismiss.css';

/** One compact dismissal control per floating window; disclosures retain their own meaning. */
export function panelDismiss(close: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'panel-dismiss';
  button.setAttribute('aria-label', t('Close'));
  button.dataset.iconHint = t('Close');
  button.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>';
  button.addEventListener('click', close);
  return button;
}
