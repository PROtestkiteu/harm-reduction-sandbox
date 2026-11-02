import type { BoardRow } from '../game/leaderboard';
import { plural, t } from '../i18n';
import { sandboxedReason } from '../game/sandboxed';

const helpedText = (n: number) => plural(n, ['{n} helped', '{n} helped'], ['{n} osoba z pomocą', '{n} osoby z pomocą', '{n} osób z pomocą']);
const nightsText = (n: number) => plural(n, ['{n} night', '{n} nights'], ['{n} noc', '{n} noce', '{n} nocy']);

export interface SavePanelCallbacks {
  saveHere(): void;
  loadHere(): void;
  hasSaved(): boolean;
  /** Sends the score; resolves to a line to show. */
  submit(): Promise<string>;
  /** The score as it stands, for the submit button. */
  score(): { name: string; helped: number; nights: number };
  /** The run used the Sandbox's free levers: it cannot be submitted. */
  sandboxed?(): boolean;
  top(signal: AbortSignal): Promise<BoardRow[]>;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * Sandbox topic: the game's address is its link (it saves itself as it is
 * played), one save kept in this browser, and the public leaderboard under
 * the organisation's name.
 */
export class SavePanel {
  readonly section: HTMLFieldSetElement;
  private readonly status: HTMLElement;
  private readonly loadBtn: HTMLButtonElement;
  private readonly submitBtn: HTMLButtonElement;
  private readonly list: HTMLOListElement;
  private readonly boardStatus: HTMLElement;
  private readonly offBoard: HTMLElement;
  private sending = false;
  private fetching: AbortController | null = null;

  constructor(private readonly cb: SavePanelCallbacks) {
    this.section = el('fieldset', 'sandbox-group save-panel');
    this.section.id = 'save-section';
    this.section.append(el('legend', undefined, t('Save or load game')));

    const live = el('p', 'note', t("The game saves itself as you play, and this page's address is its link: share the address to show someone your city as it is now."));
    const actions = el('div', 'save-actions');
    const save = el('button', 'btn save-btn', t('Save here'));
    save.type = 'button';
    save.title = t('Keep this game in this browser');
    save.addEventListener('click', () => {
      cb.saveHere();
      this.say(t('Saved in this browser.'));
      this.sync();
    });
    this.loadBtn = el('button', 'btn save-btn', t('Load saved'));
    this.loadBtn.type = 'button';
    this.loadBtn.addEventListener('click', () => {
      cb.loadHere();
      this.say(t('Loaded your saved game.'));
    });
    actions.append(save, this.loadBtn);
    this.status = el('p', 'save-status');
    this.status.setAttribute('role', 'status');

    // The leaderboard, fetched when opened.
    const board = el('details', 'sandbox-sub');
    board.append(el('summary', undefined, t('Leaderboard')));
    this.submitBtn = el('button', 'btn save-btn save-submit');
    this.submitBtn.type = 'button';
    this.submitBtn.addEventListener('click', () => void this.submit());
    this.boardStatus = el('p', 'save-status');
    this.boardStatus.setAttribute('role', 'status');
    // Why the button is off, right under it, for a sandboxed run.
    this.offBoard = el('p', 'note', sandboxedReason());
    this.offBoard.hidden = true;
    this.offBoard.id = 'save-off-board';
    this.submitBtn.setAttribute('aria-describedby', this.offBoard.id);
    this.list = el('ol', 'board-list');
    board.append(this.submitBtn, this.offBoard, this.boardStatus, this.list, el('p', 'note', t('Ranked by people helped. A shared link starts a fresh run, so scores count only what you played yourself.')));
    board.addEventListener('toggle', () => { if (board.open) void this.refresh(); });

    this.section.append(live, actions, this.status, board);
    this.sync();
  }

  /** Per-refresh: button labels follow the score and the save slot. */
  sync(): void {
    this.loadBtn.disabled = !this.cb.hasSaved();
    const s = this.cb.score();
    const label = t('Submit as {name}: {helped}, {nights}', { name: s.name, helped: helpedText(s.helped), nights: nightsText(s.nights) });
    if (this.submitBtn.textContent !== label) this.submitBtn.textContent = label;
    const off = this.cb.sandboxed?.() ?? false;
    if (this.offBoard.hidden === off) this.offBoard.hidden = !off;
    const disabled = off || this.sending;
    if (this.submitBtn.disabled !== disabled) this.submitBtn.disabled = disabled;
  }

  private say(text: string): void {
    this.status.textContent = text;
  }

  private async submit(): Promise<void> {
    if (this.cb.sandboxed?.()) return this.sync();
    this.sending = true;
    this.submitBtn.disabled = true;
    this.boardStatus.textContent = t('Sending…');
    try {
      this.boardStatus.textContent = await this.cb.submit();
      await this.refresh();
    } catch (e) {
      this.boardStatus.textContent = t('Not sent: {reason}.', { reason: e instanceof Error ? e.message : t('try again later') });
    } finally {
      this.sending = false;
      this.sync();
    }
  }

  /** Loads the top runs; a newer request cancels an older one, so stale lists never land. */
  private async refresh(): Promise<void> {
    this.fetching?.abort();
    const ctrl = new AbortController();
    this.fetching = ctrl;
    if (!this.list.children.length) this.list.replaceChildren(...Array.from({ length: 5 }, () => el('li', 'board-skeleton')));
    try {
      const rows = await this.cb.top(ctrl.signal);
      if (ctrl.signal.aborted) return;
      this.list.replaceChildren(...(rows.length ? rows.map((r) => {
        const li = el('li');
        li.append(el('span', 'board-name', r.name), el('span', 'board-score', `${helpedText(r.helped)} · ${nightsText(r.nights)}`));
        return li;
      }) : [el('li', 'board-empty', t('No scores yet. Be the first.'))]));
    } catch {
      if (!ctrl.signal.aborted) this.list.replaceChildren(el('li', 'board-empty', t('The leaderboard is not reachable right now.')));
    }
  }
}
