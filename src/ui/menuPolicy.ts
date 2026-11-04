import { FACTORS, LEVEL_LABELS, defaultContext, encodeContext, type ContextSelection, type FactorId, type FactorLevel } from '../config/contextFactors';
import { NATIONAL_MODELS, selectionFor } from '../config/nationalModels';
import { t } from '../i18n';
import { renderSources } from './contextSources';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = cls;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** Pre-game policy editor uses the simulation's factor schema and URL contract. */
export class MenuPolicy {
  readonly root = node('details', 'menu-slider-group menu-policy');
  private selection: ContextSelection = defaultContext();
  private modelId: string | null = null;
  private baseline = '';
  private readonly model = node('select', 'menu-link');
  private readonly modelInfo = node('p', 'menu-note');
  private readonly modelSources = node('details', 'menu-policy-sources');
  private readonly rows = new Map<FactorId, { input: HTMLInputElement; output: HTMLOutputElement; description: HTMLElement; sources: HTMLDetailsElement; shown: number }>();

  constructor(modelId: string | null, onChange: () => void) {
    this.root.append(node('summary', '', t('Context: law, city, police, services')));
    const body = node('div', 'menu-policy-body');
    body.append(node('p', 'menu-note', t('Directions of effect follow the sources listed; sizes are illustrative.')));
    const label = node('label', 'menu-policy-model', t('National drug checking model'));
    this.model.append(new Option(t('Custom'), ''));
    for (const model of NATIONAL_MODELS) this.model.append(new Option(model.label, model.id));
    label.append(this.model);
    body.append(label, this.modelInfo, this.modelSources);
    this.model.addEventListener('change', () => {
      this.modelId = this.model.value || null;
      const model = NATIONAL_MODELS.find(m => m.id === this.modelId);
      // Choosing Custom preserves the current levers rather than discarding edits.
      if (model) this.selection = selectionFor(model);
      this.sync(); onChange();
    });
    for (const level of Object.keys(LEVEL_LABELS) as FactorLevel[]) {
      const group = node('section', 'menu-policy-level');
      group.append(node('h3', '', LEVEL_LABELS[level]));
      const fields = node('div', 'menu-policy-fields');
      for (const factor of FACTORS.filter(f => f.level === level)) {
        const row = node('article', 'menu-policy-factor');
        const label = node('label', 'menu-policy-label', factor.label);
        const input = node('input', '');
        input.id = `menu-policy-${factor.id}`; label.htmlFor = input.id;
        input.type = 'range'; input.min = '0'; input.max = String(factor.options.length - 1); input.step = '1';
        const output = node('output', ''); output.htmlFor.add(input.id);
        const description = node('p', 'menu-note'); description.id = `${input.id}-description`;
        input.setAttribute('aria-describedby', description.id);
        const sources = node('details', 'menu-policy-sources');
        input.addEventListener('input', () => {
          this.selection[factor.id] = Number(input.value); this.modelId = null;
          this.sync(); onChange();
        });
        this.rows.set(factor.id, { input, output, description, sources, shown: -1 });
        row.append(label, output, input, description, sources); fields.append(row);
      }
      group.append(fields); body.append(group);
    }
    this.root.append(body); this.reset(modelId);
  }

  reset(modelId: string | null): void {
    const model = NATIONAL_MODELS.find(m => m.id === modelId);
    this.modelId = model?.id ?? null;
    this.selection = model ? selectionFor(model) : defaultContext();
    this.baseline = this.signature(); this.sync();
  }

  get custom(): boolean { return this.signature() !== this.baseline; }

  apply(query: URLSearchParams): void {
    query.delete('model'); query.delete('ctx');
    if (this.modelId) query.set('model', this.modelId);
    else {
      const context = encodeContext(this.selection);
      if (context) query.set('ctx', context);
    }
  }

  private signature(): string { return `${this.modelId ?? ''}|${encodeContext(this.selection)}`; }

  private sync(): void {
    const model = NATIONAL_MODELS.find(m => m.id === this.modelId);
    this.model.value = this.modelId ?? '';
    this.modelInfo.textContent = model ? t('{summary} Evidence depth: {confidence}.', { summary: model.summary, confidence: model.confidence }) : t('Set each factor yourself, or pick a national model.');
    this.modelSources.hidden = !model;
    if (model) renderSources(this.modelSources, model.evidence);
    for (const factor of FACTORS) {
      const row = this.rows.get(factor.id)!;
      const index = this.selection[factor.id];
      row.input.value = String(index);
      if (row.shown === index) continue;
      row.shown = index;
      const option = factor.options[index];
      row.output.value = option.label;
      row.input.setAttribute('aria-valuetext', option.label);
      row.description.textContent = option.summary;
      renderSources(row.sources, option.evidence);
    }
  }
}
