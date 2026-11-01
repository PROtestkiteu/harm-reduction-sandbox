import type { BoardRow } from '../game/leaderboard';
import { plural, t } from '../i18n';

const helpedText = (n: number) => plural(n, ['{n} helped', '{n} helped'], ['{n} osoba z pomocą', '{n} osoby z pomocą', '{n} osób z pomocą']);
const nightsText = (n: number) => plural(n, ['{n} night', '{n} nights'], ['{n} noc', '{n} noce', '{n} nocy']);

export interface SavePanelCallbacks {
  /** A link that opens this game where it is now. */
  shareLink(): Promise<string>;
  saveHere(): void;
  loadHere(): void;
  hasSaved(): boolean;
  /** Sends the score; resolves to a line to show. */
  submit(): Promise<string>;
  /** The score as it stands, for the submit button. */
  score(): { name: string; helped: number; nights: number };
  top(signal: AbortSignal): Promise<BoardRow[]>;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * Sandbox topic: share this game as a link, keep one save in this browser,
 * and the public leaderboard under the organisation's name.
 */
export class SavePanel {
  readonly section: HTMLFieldSetElement;
  private readonly linkOut: HTMLInputElement;
  private readonly status: HTMLElement;
  private readonly loadBtn: HTMLButtonElement;
  private readonly submitBtn: HTMLButtonElement;
  private readonly list: HTMLOListElement;
  private readonly boardStatus: HTMLElement;
  private fetching: AbortController | null = null;

  constructor(private readonly cb: SavePanelCallbacks) {
    this.section = el('fieldset', 'sandbox-group save-panel');
    this.section.id = 'save-section';
    this.section.append(el('legend', undefined, t('Save, share and leaderboard')));

    const actions = el('div', 'save-actions');
    const share = el('button', 'btn save-btn', t('Copy a link to this game'));
    share.type = 'button';
    share.addEventListener('click', () => void this.share());
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
    actions.append(share, save, this.loadBtn);

    this.linkOut = el('input', 'save-link');
    this.linkOut.type = 'text';
    this.linkOut.readOnly = true;
    this.linkOut.hidden = true;
    this.linkOut.setAttribute('aria-label', t('Link to this game'));
    this.linkOut.addEventListener('focus', () => this.linkOut.select());
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
    this.list = el('ol', 'board-list');
    board.append(this.submitBtn, this.boardStatus, this.list, el('p', 'note', t('Ranked by people helped. A shared link starts a fresh run, so scores count only what you played yourself.')));
    board.addEventListener('toggle', () => { if (board.open) void this.refresh(); });

    this.section.append(actions, this.linkOut, this.status, board);
    this.sync();
  }

  /** Per-refresh: button labels follow the score and the save slot. */
  sync(): void {
    this.loadBtn.disabled = !this.cb.hasSaved();
    const s = this.cb.score();
    const label = t('Submit as {name}: {helped}, {nights}', { name: s.name, helped: helpedText(s.helped), nights: nightsText(s.nights) });
    if (this.submitBtn.textContent !== label) this.submitBtn.textContent = label;
  }

  private say(text: string): void {
    this.status.textContent = text;
  }

  private async share(): Promise<void> {
    try {
      const link = await this.cb.shareLink();
      this.linkOut.value = link;
      this.linkOut.hidden = false;
      let copied = false;
      try { await navigator.clipboard.writeText(link); copied = true; } catch { /* clipboard blocked: the link is shown to copy by hand */ }
      this.say(copied ? t('Link copied. Anyone opening it gets this city as it is now.') : t('Copy the link above to share this city.'));
      if (!copied) this.linkOut.select();
    } catch {
      this.say(t('Could not make a link in this browser.'));
    }
  }

  private async submit(): Promise<void> {
    this.submitBtn.disabled = true;
    this.boardStatus.textContent = t('Sending…');
    try {
      this.boardStatus.textContent = await this.cb.submit();
      await this.refresh();
    } catch (e) {
      this.boardStatus.textContent = t('Not sent: {reason}.', { reason: e instanceof Error ? e.message : t('try again later') });
    } finally {
      this.submitBtn.disabled = false;
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
