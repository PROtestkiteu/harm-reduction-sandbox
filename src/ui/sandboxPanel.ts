import { t } from '../i18n';
import { PARAM_GROUPS, PARAMS, PARAM_BY_ID, normalize, type ParamId, type SandboxSettings } from '../config/sandboxParams';

export interface SandboxPanelCallbacks {
  /** Fires on every input event; the caller coalesces and applies on the next sim step. */
  onChange(id: ParamId, value: number): void;
  onReset(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

interface Row {
  input: HTMLInputElement;
  output: HTMLOutputElement;
  /** Set while the person is dragging or typing, so live values do not fight the input. */
  editingUntil: number;
}

/** One topic of the panel: a section shown on its own, reached from the menu. */
interface Page {
  section: HTMLElement;
  label: string;
  /** Pages under a submenu (the services) name it here. */
  parent?: string;
}

/** Topics in menu order; anything mounted that is not listed goes at the end. */
const ORDER = ['org-section', 'group-night', 'group-demand', 'services', 'context-section', 'random-section', 'save-section', 'about-section'];

/**
 * Sandbox controls laid out like the conversation column: a short numbered
 * menu of topics, one topic open at a time with a numbered "Back." reply at
 * its end, and a submenu for the services. Sliders are labelled native range
 * inputs built once from the parameter schema; readouts update immediately
 * and the simulation picks values up on its next fixed step.
 */
export class SandboxPanel {
  private readonly root: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private readonly body: HTMLElement;
  private readonly rows = {} as Record<ParamId, Row>;
  private readonly note: HTMLElement;
  private readonly menu: HTMLOListElement;
  private readonly pages = new Map<string, Page>();
  /** The open topic (or submenu), or null for the top menu. */
  private current: string | null = null;
  private readonly heading: HTMLElement;
  private readonly back: HTMLOListElement;

  constructor(parent: HTMLElement, initial: SandboxSettings, cb: SandboxPanelCallbacks) {
    this.root = el('section', 'sandbox');
    this.root.setAttribute('aria-label', t('Sandbox settings'));
    this.toggle = el('button', 'btn sandbox-toggle');
    // A small gear before the word, drawn inline so it follows the text colour.
    this.toggle.innerHTML = '<svg class="gear" viewBox="-1.5 -1.5 27 27" aria-hidden="true" focusable="false"><path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1l.4 2.6h4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg><span>' + t('Sandbox') + '</span>';
    this.toggle.type = 'button';
    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.setAttribute('aria-controls', 'sandbox-body');
    this.toggle.title = t('Change the night, the street and the services');
    this.toggle.addEventListener('click', () => this.setOpen(this.toggle.getAttribute('aria-expanded') !== 'true'));

    this.body = el('div', 'sandbox-body');
    this.body.id = 'sandbox-body';
    this.body.hidden = true;
    const head = el('div', 'sandbox-head');
    const title = el('h2', undefined, t('Sandbox settings'));
    const reset = el('button', 'btn sandbox-reset', t('Reset'));
    reset.type = 'button';
    reset.title = t('Return every setting to its default');
    reset.addEventListener('click', () => cb.onReset());
    const close = el('button', 'btn close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', t('Close sandbox settings'));
    close.addEventListener('click', () => this.setOpen(false, true));
    head.append(title, reset, close);
    this.note = el('p', 'note sandbox-note', t('Illustrative values, not evidence. Changes apply live.'));
    this.heading = el('p', 'sandbox-page-title');
    this.heading.hidden = true;
    this.menu = el('ol', 'sandbox-menu');
    this.back = el('ol', 'sandbox-menu sandbox-back');
    const backBtn = el('button', 'sandbox-backlink', `‹ ${t('Back')}`);
    backBtn.type = 'button';
    backBtn.addEventListener('click', () => this.goBack());
    const li = el('li');
    li.append(backBtn);
    this.back.append(li);
    this.back.hidden = true;
    this.body.append(head, this.note, this.back, this.heading, this.menu);

    const serviceGroups = new Set(['dropIn', 'outreach', 'clubHr']);
    for (const group of PARAM_GROUPS) {
      const fieldset = el('fieldset', 'sandbox-group');
      fieldset.id = `group-${group.id}`;
      fieldset.append(el('legend', undefined, group.label));
      for (const p of PARAMS) {
        if (p.group !== group.id) continue;
        const id = p.id as ParamId;
        const inputId = `param-${id.replace('.', '-')}`;
        const row = el('div', 'param');
        const label = el('label', undefined, p.label);
        label.htmlFor = inputId;
        const output = el('output');
        output.htmlFor.add(inputId);
        const input = el('input');
        input.type = 'range';
        input.id = inputId;
        input.min = String(p.min);
        input.max = String(p.max);
        input.step = String(p.step);
        input.title = p.hint;
        input.setAttribute('aria-description', p.hint);
        const r: Row = { input, output, editingUntil: 0 };
        input.addEventListener('input', () => {
          const value = normalize(id, Number(input.value));
          r.editingUntil = performance.now() + 1200;
          this.showValue(id, value);
          cb.onChange(id, value);
        });
        input.addEventListener('pointerdown', () => { r.editingUntil = Infinity; });
        const release = () => { r.editingUntil = performance.now() + 600; };
        input.addEventListener('pointerup', release);
        input.addEventListener('pointercancel', release);
        this.rows[id] = r;
        row.append(label, output, input);
        fieldset.append(row);
      }
      if (!fieldset.querySelector('.param')) continue;
      this.body.append(fieldset);
      this.addPage(fieldset, group.label, serviceGroups.has(group.id) ? 'services' : undefined);
    }
    // Escape steps back one level, then closes, without clearing the scene selection.
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.body.hidden) {
        e.stopPropagation();
        if (this.current) this.goBack();
        else this.setOpen(false, true);
      }
    });

    this.root.append(this.toggle, this.body);
    parent.append(this.root);
    this.setAll(initial);
    this.show(null);
  }

  /** Adds an extra section (the organisation, context factors) as its own topic. */
  mount(section: HTMLElement): void {
    if (!section.id) section.id = section.classList.contains('context') ? 'context-section' : `section-${this.pages.size}`;
    this.body.append(section);
    // The budget slider lives with the rest of the organisation.
    const orgGroup = this.pages.get('group-org');
    if (section.id === 'org-section' && orgGroup) {
      // The budget slider is a sandbox cheat: folded away under the actions.
      const cheat = el('details', 'sandbox-sub');
      cheat.append(el('summary', undefined, t('Set the budget (sandbox)')), ...orgGroup.section.querySelectorAll('.param'));
      (section.querySelector('.org-actions') ?? section.lastElementChild)?.after(cheat);
      orgGroup.section.remove();
      this.pages.delete('group-org');
    }
    // Long lists inside a topic fold behind a reply of their own.
    for (const [selector, label] of [['.org-grants', t('Funding applications')], ['.org-log', t('What has happened')]] as const) {
      const part = section.querySelector(selector);
      if (!part) continue;
      const sub = el('details', 'sandbox-sub');
      sub.append(el('summary', undefined, label));
      part.replaceWith(sub);
      sub.append(part);
    }
    const label = section.querySelector('legend')?.textContent ?? t('More');
    this.addPage(section, section.classList.contains('context') ? t('Context: law, city, police, services') : label);
    this.show(this.current);
  }

  /** Opens the topic holding `target` (a slider, an action), for hints and links. */
  reveal(target: Element): void {
    for (const [id, page] of this.pages) {
      if (page.section.contains(target)) {
        this.show(id);
        return;
      }
    }
  }

  private addPage(section: HTMLElement, label: string, parent?: string): void {
    this.pages.set(section.id, { section, label, parent });
    if (parent && !this.pages.has(parent)) this.pages.set(parent, { section: this.menu, label: t('Services') });
  }

  private goBack(): void {
    const page = this.current ? this.pages.get(this.current) : undefined;
    this.show(page?.parent ?? null);
    this.menu.querySelector('button')?.focus();
  }

  /** Shows the top menu (null), a submenu, or one topic. */
  private show(id: string | null): void {
    this.current = id;
    const page = id ? this.pages.get(id) : undefined;
    const isMenu = !id || page?.section === this.menu;
    for (const [pid, p] of this.pages) if (p.section !== this.menu) p.section.hidden = pid !== id;
    this.menu.hidden = !isMenu;
    this.back.hidden = !id;
    this.note.hidden = !!id;
    // The organisation's editable name is its own heading.
    this.heading.hidden = !id || id === 'org-section';
    this.heading.textContent = page?.label ?? '';
    if (isMenu) this.fillMenu(id);
  }

  /** Numbered replies for the topics at this level. */
  private fillMenu(level: string | null): void {
    const ids = [...this.pages.keys()].filter((pid) => (this.pages.get(pid)!.parent ?? null) === level && (level !== null || !this.pages.get(pid)!.parent));
    ids.sort((a, b) => rank(a) - rank(b));
    const items = ids.map((pid) => {
      const li = el('li');
      const b = el('button', 'sandbox-reply', `${this.pages.get(pid)!.label}.`);
      b.type = 'button';
      b.addEventListener('click', () => {
        this.show(pid);
        (this.pages.get(pid)!.section === this.menu ? this.menu : this.pages.get(pid)!.section).querySelector<HTMLElement>('button, input, select')?.focus();
      });
      li.append(b);
      return li;
    });
    this.menu.replaceChildren(...items);
  }

  setOpen(open: boolean, returnFocus = false): void {
    this.body.hidden = !open;
    this.toggle.setAttribute('aria-expanded', String(open));
    this.root.dataset.open = String(open);
    if (returnFocus) this.toggle.focus();
  }

  /** Replaces every value, for example after Reset. */
  setAll(settings: SandboxSettings): void {
    for (const p of PARAMS) {
      this.rows[p.id].editingUntil = 0;
      this.showValue(p.id, settings[p.id]);
    }
  }

  /** Mirrors values the simulation moves on its own (the clock) unless that slider is in use. */
  syncLive(id: ParamId, value: number): void {
    const r = this.rows[id];
    if (performance.now() < r.editingUntil) return;
    this.showValue(id, normalize(id, value));
  }

  private showValue(id: ParamId, value: number): void {
    const { input, output } = this.rows[id];
    const text = PARAM_BY_ID[id].format(value);
    const v = String(value);
    if (input.value !== v) input.value = v;
    if (output.textContent !== text) {
      output.textContent = text;
      input.setAttribute('aria-valuetext', text);
    }
  }
}

function rank(id: string): number {
  const i = ORDER.indexOf(id);
  return i < 0 ? ORDER.length : i;
}
