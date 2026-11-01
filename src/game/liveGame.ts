import { decodeSave, encodeSave, type SaveData } from './saveGame';

/**
 * The page's address is the game's own link. The game saves to the server as
 * it is played (`?g=<id>` names it), so whoever opens the address gets the
 * city as it is now. This browser keeps the key that lets it write to its own
 * games; anyone else who opens one plays on their own copy, under a new id.
 *
 * One save in flight at a time: a save asked for meanwhile waits, then sends
 * the state as it is by then, so an older state never lands after a newer one.
 */
const API = () => new URL('api/board.php', document.baseURI).toString();
const KEYS = 'hrp-games';
/** Games this browser owns, newest last; only so many keys are kept. */
const MAX_KEYS = 20;
const ID = /^[0-9a-f]{24}$/;

type Keys = Record<string, string>;

function keys(): Keys {
  try {
    const k = JSON.parse(localStorage.getItem(KEYS) ?? '{}') as unknown;
    return k && typeof k === 'object' ? (k as Keys) : {};
  } catch {
    return {};
  }
}

function keep(gid: string, key: string): void {
  try {
    const k = keys();
    delete k[gid];
    k[gid] = key;
    const ids = Object.keys(k);
    for (const old of ids.slice(0, Math.max(0, ids.length - MAX_KEYS))) delete k[old];
    localStorage.setItem(KEYS, JSON.stringify(k));
  } catch { /* storage blocked: this page can still write while it is open */ }
}

/** The game id in the address, if any. */
export function linkedGame(): string | null {
  const g = new URLSearchParams(location.search).get('g');
  return g && ID.test(g) ? g : null;
}

/** The address with `g` set (or removed), other parameters and the hash kept. */
function addressWith(gid: string | null): string {
  const q = new URLSearchParams(location.search);
  if (gid) q.set('g', gid);
  else q.delete('g');
  // Settings after `set=` stay readable (unescaped), as the page writes them.
  const search = q.toString().replace(/%3A/gi, ':').replace(/%2C/gi, ',');
  return `${location.pathname}${search ? `?${search}` : ''}${location.hash}`;
}

/** Where a new game starts: this page's address without the old game's id (or a save in the hash). */
export function newGameAddress(): string {
  return addressWith(null).replace(/#.*$/, '');
}

/** Fetches a game's latest state; null when it is gone, unreadable or the server is not reachable. */
export async function fetchGame(gid: string): Promise<SaveData | null> {
  try {
    const res = await fetch(`${API()}?game=${gid}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: unknown };
    return typeof body.data === 'string' ? decodeSave(body.data) : null;
  } catch {
    return null;
  }
}

export class LiveGame {
  private gid: string | null;
  private key: string | null;
  private last = '';
  private sending = false;
  private again = false;

  /** `gid`: the game to carry on (this browser's own), or null for a new one. */
  constructor(gid: string | null, private readonly capture: () => SaveData) {
    this.key = gid ? keys()[gid] ?? null : null;
    this.gid = this.key ? gid : null;
    // Not ours (or a new game): the address must not point at someone else's game.
    if (!this.gid && linkedGame()) history.replaceState(history.state, '', addressWith(null));
  }

  /** True when the address's game is this browser's own. */
  static owns(gid: string): boolean {
    return !!keys()[gid];
  }

  /** Saves the game as it is now, unless it has not changed since the last save. */
  save(): void {
    if (this.sending) { this.again = true; return; }
    void this.send();
  }

  /** On leaving the page: the latest state, sent at once so it still goes out as the page closes. */
  flush(): void {
    if (!this.gid || !this.key) return;
    const data = encodeSave(this.capture());
    if (data === this.last) return;
    this.last = data;
    void fetch(API(), { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', gid: this.gid, key: this.key, data }) })
      .catch(() => { /* offline: the next visit carries on from the last save */ });
  }

  private async send(): Promise<void> {
    this.sending = true;
    try {
      const data = encodeSave(this.capture());
      if (data !== this.last) {
        const body = this.gid && this.key ? { action: 'save', gid: this.gid, key: this.key, data } : { action: 'save', data };
        const res = await fetch(API(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const out = (await res.json().catch(() => ({}))) as { gid?: unknown; key?: unknown };
        if (res.ok) {
          this.last = data;
          if (typeof out.gid === 'string' && ID.test(out.gid) && typeof out.key === 'string') {
            this.gid = out.gid;
            this.key = out.key;
            keep(out.gid, out.key);
            history.replaceState(history.state, '', addressWith(out.gid));
          }
        } else if (res.status === 403 || res.status === 404) {
          // Gone or not ours after all: the next save starts a new game under a new address.
          this.gid = this.key = null;
          this.last = '';
        }
      }
    } catch { /* offline or the server is busy: the next save tries again */ }
    this.sending = false;
    if (this.again) {
      this.again = false;
      void this.send();
    }
  }
}
