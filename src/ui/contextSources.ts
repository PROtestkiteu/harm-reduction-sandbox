import { citationReference } from './citationReference';
import type { Citation } from '../config/contextFactors';
import { t } from '../i18n';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

const TYPE_LABELS: Record<Citation['type'], string> = {
  SR: t('review'), ScR: t('scoping review'), RCT: t('trial'), cohort: t('cohort'), survey: t('survey'), qualitative: t('qualitative'),
  evaluation: t('evaluation'), monitoring: t('monitoring'), guideline: t('guideline'), opinion: t('opinion'), statistics: t('statistics'), profile: t('library profile'), none: t('gap'),
};

/** Renders a citation list into a disclosure. Called only when the selected option changes. */
export function renderSources(details: HTMLDetailsElement, cites: readonly Citation[]): void {
  const summary = el('summary', undefined, t('Sources ({n})', { n: cites.filter((c) => c.type !== 'none').length }));
  const list = el('ul', 'cites');
  for (const c of cites) {
    const li = el('li');
    li.dataset.type = c.type;
    li.append(el('strong', undefined, c.ref), el('span', 'cite-type', ` ${TYPE_LABELS[c.type]}. `), el('span', undefined, c.note));
    li.append(citationReference(c));
    list.append(li);
  }
  details.replaceChildren(summary, list);
}
