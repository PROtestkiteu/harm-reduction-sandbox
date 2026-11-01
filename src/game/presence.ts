/**
 * The player gate: every 45 s the game says hello to the server, which keeps
 * its free memory above 2 GB. Usually the answer is "play". When the server
 * is short, newcomers wait in a queue and players already in get 30 minutes.
 * If the server cannot be reached, the game plays on: the gate never locks
 * anyone out by failing.
 */
export type Gate =
  | { state: 'play'; until: number | null }
  | { state: 'queue'; position: number };

const API = () => new URL('api/board.php', document.baseURI).toString();
const EVERY = 45_000;

function sessionId(): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Starts saying hello; `onGate` hears every change. Returns a stop function. */
export function startPresence(onGate: (g: Gate) => void): () => void {
  const sid = sessionId();
  let timer = 0;
  let stopped = false;
  let inflight: AbortController | null = null;
  // Server and browser clocks differ: `until` is turned into this browser's time.
  const hello = async () => {
    inflight?.abort();
    const ctrl = new AbortController();
    inflight = ctrl;
    try {
      const res = await fetch(API(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hello', sid }),
        signal: ctrl.signal,
      });
      const data = (await res.json()) as { admit?: boolean; until?: number | null; position?: number; now?: number };
      if (stopped || ctrl.signal.aborted) return;
      if (data.admit === false) onGate({ state: 'queue', position: Math.max(1, Number(data.position) || 1) });
      else {
        const skew = typeof data.now === 'number' ? Date.now() - data.now * 1000 : 0;
        onGate({ state: 'play', until: typeof data.until === 'number' ? data.until * 1000 + skew : null });
      }
    } catch {
      // Unreachable or refused: play on.
      if (!stopped && !ctrl.signal.aborted) onGate({ state: 'play', until: null });
    } finally {
      if (!stopped) timer = window.setTimeout(hello, EVERY);
    }
  };
  void hello();
  return () => {
    stopped = true;
    clearTimeout(timer);
    inflight?.abort();
  };
}
