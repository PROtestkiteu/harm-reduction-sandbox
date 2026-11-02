import { t } from '../i18n';

/**
 * What a player sees of the gate: a queue box while waiting for a place, a
 * small countdown while play is time-limited, and a box when time is up.
 */
export class QueueBox {
  private readonly dialog: HTMLDialogElement;
  private readonly title: HTMLElement;
  private readonly text: HTMLElement;
  private readonly again: HTMLButtonElement;
  private readonly clock: HTMLElement;
  private until: number | null = null;
  private timer = 0;

  constructor(parent: HTMLElement, private readonly onChange: (blocked: boolean) => void, onTimeUp: () => void) {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'welcome queue-box';
    this.dialog.setAttribute('aria-labelledby', 'queue-title');
    this.title = document.createElement('h2');
    this.title.id = 'queue-title';
    this.text = document.createElement('p');
    this.text.className = 'welcome-lead';
    this.text.setAttribute('role', 'status');
    this.again = document.createElement('button');
    this.again.type = 'button';
    this.again.className = 'welcome-start';
    this.again.textContent = t('Join the queue again');
    this.again.addEventListener('click', () => location.reload());
    this.dialog.append(this.title, this.text, this.again);
    // Waiting cannot be skipped with Escape.
    this.dialog.addEventListener('cancel', (e) => e.preventDefault());
    parent.append(this.dialog);

    this.clock = document.createElement('p');
    this.clock.className = 'time-left';
    this.clock.setAttribute('role', 'timer');
    this.clock.hidden = true;
    parent.append(this.clock);
    this.onTimeUp = onTimeUp;
  }

  private readonly onTimeUp: () => void;

  queued(position: number): void {
    this.title.textContent = t('The game is full right now');
    this.text.textContent = t('You are number {position} in the queue. You will be let in as soon as there is room; keep this page open.', { position });
    this.again.hidden = true;
    this.limit(null);
    if (!this.dialog.open) {
      this.dialog.showModal();
      this.onChange(true);
    }
  }

  playing(until: number | null): void {
    if (this.dialog.open && this.again.hidden) {
      this.dialog.close();
      this.onChange(false);
    }
    this.limit(until);
  }

  private limit(until: number | null): void {
    this.until = until;
    clearInterval(this.timer);
    this.clock.hidden = until === null;
    if (until === null) return;
    const tick = () => {
      const left = Math.max(0, (this.until ?? 0) - Date.now());
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      this.clock.textContent = t('Busy: {time} left', { time: `${m}:${String(s).padStart(2, '0')}` });
      if (left <= 0) {
        clearInterval(this.timer);
        this.timeUp();
      }
    };
    tick();
    this.timer = window.setInterval(tick, 1000);
  }

  private timeUp(): void {
    this.clock.hidden = true;
    this.title.textContent = t('Time is up for now');
    this.text.textContent = t('Others are waiting to play. Thanks for playing: you can put your score on the leaderboard from Settings, or join the queue again.');
    this.again.hidden = false;
    this.onTimeUp();
    if (!this.dialog.open) {
      this.dialog.showModal();
      this.onChange(true);
    }
  }
}
