import type { Citation } from '../config/contextFactors';
import { SOURCE_REFERENCES } from '../config/publicationReferences';
import { t } from '../i18n';

/** Bibliographic references are visible; original library locators remain in the data. */
export function citationReference(citation: Citation): HTMLElement {
  const root = document.createElement('span');
  root.className = 'cite-src';
  const references = SOURCE_REFERENCES[citation.source];
  if (!references?.length) {
    root.textContent = citation.type === 'none' ? t('No supporting publication identified.') : citation.ref;
    return root;
  }
  for (const reference of references) {
    const row = document.createElement('span');
    row.className = 'cite-reference';
    if (reference.url) {
      const link = document.createElement('a');
      link.href = reference.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = reference.title;
      row.append(link);
    } else row.textContent = reference.title;
    if (reference.locator) row.append(document.createTextNode(` — ${reference.locator}`));
    root.append(row);
  }
  return root;
}
