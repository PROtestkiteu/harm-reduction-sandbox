import { plural, t } from '../i18n';
import { sandboxedReason } from '../game/sandboxed';

export interface GameOverCallbacks {
  /** Sends the score; resolves to a line to show. */
  submit(): Promise<string>;
  restart(): void;
  /** The run used the Sandbox's free levers: it cannot be submitted. */
  sandboxed?(): boolean;
}

/**
 * The end of a run: the money is gone. A native modal dialog with the run's
 * numbers, a button to put them on the leaderboard and one to start again.
 */
export class GameOver {
  private readonly dialog: HTMLDialogElement;
  private readonly summary: HTMLElement;
  private readonly status: HTMLElement;
  private readonly submitBtn: HTMLButtonElement;

  constructor(parent: HTMLElement, private readonly cb: GameOverCallbacks) {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'welcome game-over';
    this.dialog.setAttribute('aria-labelledby', 'game-over-title');
    const title = document.createElement('h2');
    title.id = 'game-over-title';
    title.textContent = t('Out of money');
    this.summary = document.createElement('p');
    this.summary.className = 'welcome-lead';
    const why = document.createElement('p');
    why.className = 'welcome-controls';
    why.textContent = t('Busy services cost more than they bring in. Funding, grants, investment and staffing decide how long a project lasts.');
    this.status = document.createElement('p');
    this.status.className = 'welcome-controls';
    this.status.setAttribute('role', 'status');
    this.submitBtn = document.createElement('button');
    this.submitBtn.type = 'button';
    this.submitBtn.className = 'welcome-start';
    this.submitBtn.textContent = t('Put it on the leaderboard');
    this.submitBtn.addEventListener('click', async () => {
      this.submitBtn.disabled = true;
      this.status.textContent = t('Sending…');
      try {
        this.status.textContent = await cb.submit();
      } catch (e) {
        this.status.textContent = t('Not sent: {reason}.', { reason: e instanceof Error ? e.message : t('try again later') });
        this.submitBtn.disabled = false;
      }
    });
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'welcome-start game-over-again';
    again.textContent = t('Start again');
    again.addEventListener('click', () => cb.restart());
    this.dialog.append(title, this.summary, why, this.submitBtn, this.status, again);
    // The run is over: Escape does not just close it and carry on.
    this.dialog.addEventListener('cancel', (e) => e.preventDefault());
    parent.append(this.dialog);
  }

  get open(): boolean {
    return this.dialog.open;
  }

  show(name: string, nights: number, helped: number): void {
    if (this.dialog.open) return;
    // The night under way counts: a run that ends on its first night lasted one.
    const lasted = Math.max(1, nights);
    this.summary.textContent = t('{name} closed after {nights}, having helped {people}.', {
      name,
      nights: plural(lasted, ['{n} night', '{n} nights'], ['{n} nocy', '{n} nocach', '{n} nocach']),
      people: plural(helped, ['{n} person', '{n} people'], ['{n} osobie', '{n} osobom', '{n} osobom']),
    });
    // A sandboxed run cannot go on the board: say why where the button is.
    const off = this.cb.sandboxed?.() ?? false;
    this.status.textContent = off ? sandboxedReason() : '';
    this.submitBtn.disabled = off;
    this.dialog.showModal();
  }
}
