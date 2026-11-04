import './reputation.css';
import { REPUTATION_NODES } from '../config/reputation';
import type { FavourView } from '../sim/favourView';
import { t } from '../i18n';
/** Built once. Collapsed content is updated only when opened. */
export class ReputationDisclosure {
  readonly element = document.createElement('details');
  private readonly status = document.createElement('p');
  private readonly nodes = new Map<string, HTMLElement>();
  private view?: FavourView;
  constructor() {
    this.element.className = 'reputation-disclosure';
    const heading = document.createElement('summary'); heading.textContent = t('Reputation & unlocks');
    const tree = document.createElement('div'); tree.className = 'reputation-tree';
    for (const node of REPUTATION_NODES) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      const text = document.createElement('p');
      const parents = node.parents.map(id => REPUTATION_NODES.find(n => n.id === id)!.label).join(t(' or '));
      text.textContent = [node.benefit, t('Requires reputation {n}.', { n: node.threshold }), parents ? t('Requires {node}.', { node: parents }) : ''].filter(Boolean).join(' ');
      details.append(summary, text); tree.append(details); this.nodes.set(node.id, summary);
    }
    this.element.append(heading, this.status, tree);
    this.element.addEventListener('toggle', () => { if (this.element.open && this.view) this.render(this.view); });
  }
  update(view: FavourView): void { this.view = view; if (this.element.open) this.render(view); }
  private render(v: FavourView): void {
    const standing = v.score < 20 ? t('Unproven') : v.score < 40 ? t('Known') : v.score < 70 ? t('Trusted') : t('Established');
    const line = t('Reputation {n}/100: {standing}. Favours {held}/{cap}. Next favour: {p}%.', { n: v.score, standing, held: v.held, cap: v.capacity, p: v.progress });
    if (this.status.textContent !== line) this.status.textContent = line;
    for (const node of REPUTATION_NODES) {
      const text = t('{node}: {state}', { node: node.label, state: v.earned.includes(node.id) ? t('Earned') : t('Locked') });
      const summary = this.nodes.get(node.id)!; if (summary.textContent !== text) summary.textContent = text;
    }
  }
}
