import { needsFor } from './needIcons';
import type { Choice, MajorEvent } from '../game/majorEvents';
import { price } from './money';
import { t } from '../i18n';

/**
 * A big event as a modal box that stops the clock: what is happening, the
 * choices with their costs, then what came of the choice and Continue.
 */
export class EventPopup {
  private readonly dialog: HTMLDialogElement;
  private readonly title: HTMLElement;
  private readonly body: HTMLElement;
  private readonly choices: HTMLElement;

  constructor(parent: HTMLElement, private readonly onChange: (open: boolean) => void) {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'welcome event-popup';
    this.dialog.setAttribute('aria-labelledby', 'event-title');
    this.title = document.createElement('h2');
    this.title.id = 'event-title';
    this.body = document.createElement('div');
    this.choices = document.createElement('div');
    this.choices.className = 'event-choices';
    this.dialog.append(this.title, this.body, this.choices);
    // A decision is needed: Escape does not dismiss it.
    this.dialog.addEventListener('cancel', (e) => e.preventDefault());
    parent.append(this.dialog);
  }

  get open(): boolean {
    return this.dialog.open;
  }

  show(event: MajorEvent, budget: number, choose: (c: Choice) => string | void): void {
    this.title.textContent = event.title;
    this.body.replaceChildren(...event.lines.map((line, i) => Object.assign(document.createElement('p'), { className: i === 0 ? 'welcome-lead' : 'welcome-controls', textContent: line })));
    this.choices.replaceChildren(...event.choices.map((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'welcome-start event-choice';
      b.append(c.cost ? t('{choice} ({price})', { choice: c.label, price: price(c.cost) }) : c.label, needsFor(c.helps));
      b.disabled = (c.cost ?? 0) > budget;
      b.addEventListener('click', () => this.result(choose(c) ?? ''));
      return b;
    }));
    this.dialog.showModal();
    this.onChange(true);
    (this.choices.querySelector('button:not(:disabled)') as HTMLButtonElement | null)?.focus();
  }

  private result(text: string): void {
    const outcome = Object.assign(document.createElement('p'), { className: 'welcome-lead', textContent: text });
    outcome.setAttribute('role', 'status');
    this.body.replaceChildren(outcome);
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'welcome-start';
    go.textContent = t('Continue');
    go.addEventListener('click', () => {
      this.dialog.close();
      this.onChange(false);
    });
    this.choices.replaceChildren(go);
    go.focus();
  }
}
