import { draggableWindow } from './draggableWindow';
import { t } from '../i18n';
import type { Decision } from '../game/decisions';
import { price } from './money';

/**
 * Confirm before money is spent: the decision's detail, its chance when it may
 * fail, and the price, with Go ahead and Not now. Stops the clock while open
 * (through `onChange`); Escape and Not now cancel.
 */
export class ConfirmPopup {
  private readonly dialog: HTMLDialogElement;
  private readonly title: HTMLElement;
  private readonly body: HTMLElement;
  private readonly yes: HTMLButtonElement;
  private run: (() => void) | null = null;

  constructor(parent: HTMLElement, private readonly onChange: (open: boolean) => void) {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'welcome event-popup confirm-popup';
    this.dialog.setAttribute('aria-labelledby', 'confirm-title');
    draggableWindow(this.dialog);
    this.title = document.createElement('h2');
    this.title.id = 'confirm-title';
    this.body = document.createElement('div');
    const choices = document.createElement('div');
    choices.className = 'event-choices';
    this.yes = document.createElement('button');
    this.yes.type = 'button';
    this.yes.className = 'welcome-start event-choice';
    this.yes.addEventListener('click', () => {
      const run = this.run;
      this.close();
      run?.();
    });
    const no = document.createElement('button');
    no.type = 'button';
    no.className = 'welcome-start event-choice confirm-no';
    no.textContent = t('Not now');
    no.addEventListener('click', () => this.close());
    choices.append(this.yes, no);
    this.dialog.append(this.title, this.body, choices);
    this.dialog.addEventListener('cancel', (e) => { e.preventDefault(); this.close(); });
    parent.append(this.dialog);
  }

  get open(): boolean {
    return this.dialog.open;
  }

  /** Shows `d`; `run` is called only on Go ahead. Short of money, Go ahead is greyed out. */
  ask(d: Decision, budget: number, run: () => void): void {
    this.run = run;
    this.title.textContent = d.title;
    const lines = [...d.lines];
    if (d.chance !== undefined) lines.push(t('Chance it works: {pct}%.', { pct: Math.round(d.chance * 100) }));
    this.body.replaceChildren(...lines.map((line, i) => Object.assign(document.createElement('p'), { className: i === 0 ? 'welcome-lead' : 'welcome-controls', textContent: line })));
    this.yes.textContent = t('Go ahead ({price})', { price: price(d.cost) });
    this.yes.disabled = d.cost > budget;
    if (!this.dialog.open) {
      this.dialog.showModal();
      this.onChange(true);
    }
    (this.yes.disabled ? this.dialog.querySelector('.confirm-no') as HTMLButtonElement : this.yes).focus();
  }

  private close(): void {
    this.run = null;
    if (!this.dialog.open) return;
    this.dialog.close();
    this.onChange(false);
  }
}
