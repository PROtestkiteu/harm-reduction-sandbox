import { FACTORS, LEVEL_LABELS, type Citation, type ContextSelection, type FactorId, type FactorLevel } from '../config/contextFactors';
import type { NationalModel } from '../config/nationalModels';
import type { NeighbourhoodState } from '../sim/neighbourhood';
import { CRIME_LABELS, type CrimeType } from '../sim/cityLife';
import { t } from '../i18n';

export interface ContextCallbacks {
  /** Fires on every input; the caller coalesces and applies between sim steps. */
  onFactor(id: FactorId, index: number): void;
  /** A national model preset was chosen (null: custom). */
  onModel(id: string | null): void;
}

/** Live counts the context drives, shown under the factors. */
export interface ContextStats {
  turnedBack: number;
  policeStops: number;
  arrests: number;
  hiddenUse: number;
  intoxicatedLeavers: number;
  acuteHarms: number;
  helped: number;
  alone: number;
  sterileKits: number;
  unsafeInjecting: number;
  street: NeighbourhoodState;
  city: { incidents: Record<CrimeType, number>; responded: number };
  outNow: string;
  samples: number;
  resultsReceived: number;
  unexpected: number;
  changedPlans: number;
  checkingAllowed: boolean;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const TYPE_LABELS: Record<Citation['type'], string> = {
  SR: t('review'), ScR: t('scoping review'), RCT: t('trial'), cohort: t('cohort'), survey: t('survey'), qualitative: t('qualitative'),
  evaluation: t('evaluation'), monitoring: t('monitoring'), guideline: t('guideline'), opinion: t('opinion'), statistics: t('statistics'), profile: t('library profile'), none: t('gap'),
};

/** Renders a citation list into a disclosure. Called only when the selected option changes. */
function renderSources(details: HTMLDetailsElement, cites: readonly Citation[]): void {
  const summary = el('summary', undefined, t('Sources ({n})', { n: cites.filter((c) => c.type !== 'none').length }));
  const list = el('ul', 'cites');
  for (const c of cites) {
    const li = el('li');
    li.dataset.type = c.type;
    li.append(el('strong', undefined, c.ref), el('span', 'cite-type', ` ${TYPE_LABELS[c.type]}. `), el('span', undefined, c.note));
    const src = el('span', 'cite-src', c.source);
    li.append(src);
    list.append(li);
  }
  details.replaceChildren(summary, list);
}

interface FactorRow {
  input: HTMLInputElement;
  output: HTMLOutputElement;
  summary: HTMLElement;
  sources: HTMLDetailsElement;
  shown: number;
}

/**
 * Context factors, top to bottom (national law to service design), plus
 * national drug checking models as presets. Every option shows what it changes
 * and the library sources behind its direction of effect.
 */
export class ContextSection {
  readonly root: HTMLFieldSetElement;
  private readonly rows = {} as Record<FactorId, FactorRow>;
  private readonly modelSelect: HTMLSelectElement;
  private readonly modelInfo: HTMLElement;
  private readonly modelSources: HTMLDetailsElement;
  private readonly stats: HTMLElement;
  private statsText = '';

  constructor(initial: ContextSelection, private readonly models: readonly NationalModel[], cb: ContextCallbacks) {
    this.root = el('fieldset', 'sandbox-group context');
    this.root.append(el('legend', undefined, t('Context, top to bottom')));
    this.root.append(el('p', 'note', t('Directions of effect follow the sources listed; sizes are illustrative.')));

    const modelRow = el('div', 'param model');
    const modelLabel = el('label', undefined, t('National drug checking model'));
    modelLabel.htmlFor = 'context-model';
    this.modelSelect = el('select');
    this.modelSelect.id = 'context-model';
    this.modelSelect.append(new Option(t('Custom'), ''));
    for (const m of models) this.modelSelect.append(new Option(m.label, m.id));
    this.modelSelect.addEventListener('change', () => cb.onModel(this.modelSelect.value || null));
    this.modelInfo = el('p', 'factor-summary');
    this.modelSources = el('details', 'sources');
    modelRow.append(modelLabel, this.modelSelect, this.modelInfo, this.modelSources);
    this.root.append(modelRow);

    // Grouped by level, top to bottom, whatever order the schema lists factors in.
    const levels = Object.keys(LEVEL_LABELS) as FactorLevel[];
    const ordered = [...FACTORS].sort((a, b) => levels.indexOf(a.level) - levels.indexOf(b.level));
    let level: FactorLevel | null = null;
    for (const f of ordered) {
      if (f.level !== level) {
        level = f.level;
        this.root.append(el('h3', 'level', LEVEL_LABELS[level]));
      }
      const inputId = `factor-${f.id}`;
      const row = el('div', 'param factor');
      const label = el('label', undefined, f.label);
      label.htmlFor = inputId;
      const output = el('output');
      output.htmlFor.add(inputId);
      const input = el('input');
      input.type = 'range';
      input.id = inputId;
      input.min = '0';
      input.max = String(f.options.length - 1);
      input.step = '1';
      const summary = el('p', 'factor-summary');
      const sources = el('details', 'sources');
      const r: FactorRow = { input, output, summary, sources, shown: -1 };
      input.addEventListener('input', () => {
        const index = Number(input.value);
        this.show(f.id, index);
        this.setModel(null);
        cb.onFactor(f.id, index);
      });
      this.rows[f.id] = r;
      row.append(label, output, input, summary, sources);
      this.root.append(row);
    }

    this.stats = el('p', 'context-stats');
    this.stats.setAttribute('aria-live', 'off');
    this.root.append(this.stats);
    this.setAll(initial, null);
  }

  setAll(selection: ContextSelection, modelId: string | null): void {
    for (const f of FACTORS) this.show(f.id, selection[f.id]);
    this.setModel(modelId);
  }

  setModel(modelId: string | null): void {
    const m = this.models.find((x) => x.id === modelId);
    this.modelSelect.value = m ? m.id : '';
    const text = m ? t('{summary} Evidence depth: {confidence}.', { summary: m.summary, confidence: m.confidence }) : t('Set each factor yourself, or pick a national model.');
    if (this.modelInfo.textContent !== text) this.modelInfo.textContent = text;
    this.modelSources.hidden = !m;
    if (m) renderSources(this.modelSources, m.evidence);
  }

  /** Live counts; writes only when the text changes. */
  syncStats(s: ContextStats): void {
    const checks = s.checkingAllowed
      ? t('{samples} samples checked, {results} results received, {unexpected} unexpected, {changed} said they would change plans', { samples: s.samples, results: s.resultsReceived, unexpected: s.unexpected, changed: s.changedPlans })
      : t('stand gives information only, no checking');
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const st = s.street;
    const streetText = t(" Street: feels safe {safety}, shops trading {trade}, discarded equipment {litter}, street market {market}, services' name {name}, {rough} sleeping rough, {shop} shop incidents (placeholder).", { safety: pct(st.safety), trade: pct(st.shopTrade), litter: pct(st.litter), market: pct(st.streetMarket), name: pct(st.reputation), rough: st.roughSleepers, shop: st.shopIncidents });
    const crimes = (Object.keys(s.city.incidents) as CrimeType[]).filter((k) => s.city.incidents[k]).map((k) => t('{n} {label}', { n: s.city.incidents[k], label: CRIME_LABELS[k] }));
    const cityText = t(' City (not drug related, placeholder rates): {crimes}; police attended {responded}.', { crimes: crimes.length ? crimes.join(', ') : t('no incidents'), responded: s.city.responded });
    const text = t('Out now: {out}. Tonight: {turned} turned back before reaching a service, {hidden} used in a hidden spot after their need went unmet, {stops} police stops for possession ({arrests} arrests), {leavers} left the club visibly intoxicated. Events: {collapsed} collapsed ({helped} reached by staff, {alone} alone); {kits} sterile kits handed out, {unsafe} times injecting without them. Checking: {checks}.', {
      out: s.outNow, turned: s.turnedBack, hidden: s.hiddenUse, stops: s.policeStops, arrests: s.arrests, leavers: s.intoxicatedLeavers,
      collapsed: s.acuteHarms, helped: s.helped, alone: s.alone, kits: s.sterileKits, unsafe: s.unsafeInjecting, checks,
    }) + streetText + cityText;
    if (text !== this.statsText) {
      this.statsText = text;
      this.stats.textContent = text;
    }
  }

  private show(id: FactorId, index: number): void {
    const r = this.rows[id];
    const f = FACTORS.find((x) => x.id === id)!;
    const option = f.options[Math.min(index, f.options.length - 1)];
    if (r.input.value !== String(index)) r.input.value = String(index);
    if (r.shown === index) return;
    r.shown = index;
    r.output.textContent = option.label;
    r.input.setAttribute('aria-valuetext', option.label);
    r.summary.textContent = option.summary;
    renderSources(r.sources, option.evidence);
  }
}
