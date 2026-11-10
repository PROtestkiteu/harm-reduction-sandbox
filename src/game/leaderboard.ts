import type { SaveData } from './saveGame';
import { isSandboxed, markSandboxed, onSandboxed, sandboxedReason } from './sandboxed';

/** The leaderboard endpoint, next to the page (works under /simulator/ and in development). */
const API = () => new URL('api/board.php', document.baseURI).toString();
const RUN_KEY = 'hrp-run';

export interface BoardRow { name: string; helped: number; nights: number }
export type Run = NonNullable<SaveData['run']>;

const post = async (body: unknown): Promise<Record<string, unknown>> => {
  const res = await fetch(API(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`);
  return data;
};

/** This browser's current run, if it has one. */
export function currentRun(): Run | undefined {
  try {
    const r = JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null') as Run | null;
    return r && typeof r.id === 'string' && typeof r.ts === 'number' && typeof r.token === 'string' ? r : undefined;
  } catch {
    return undefined;
  }
}

function store(run: Run | undefined): void {
  try {
    if (run) localStorage.setItem(RUN_KEY, JSON.stringify(run));
    else localStorage.removeItem(RUN_KEY);
  } catch { /* storage blocked: the run lasts for this page only */ }
}

/** Keeps `run` as this browser's run. A sandboxed run marks the game, and a sandboxed game marks its run. */
export function setRun(run: Run | undefined): void {
  if (run?.sandboxed) markSandboxed();
  store(run && isSandboxed() ? { ...run, sandboxed: true } : run);
}

// The Sandbox's free levers were used: the run in storage carries the mark from now on.
onSandboxed(() => {
  const run = currentRun();
  if (run && !run.sandboxed) store({ ...run, sandboxed: true });
});

/** The current run, or a fresh signed one from the server. */
export async function ensureRun(): Promise<Run> {
  const have = currentRun();
  if (have) {
    if (have.sandboxed) markSandboxed();
    return have;
  }
  const r = await post({ action: 'start' });
  const run: Run = { id: String(r.id), ts: Number(r.ts), token: String(r.token) };
  setRun(run);
  return currentRun() ?? run;
}

/** Puts the run on the board. A sandboxed run is never sent (and the server refuses one that says so). */
export async function submitScore(run: Run, name: string, helped: number, nights: number): Promise<number> {
  if (run.sandboxed || isSandboxed()) throw new Error(sandboxedReason());
  const r = await post({ action: 'submit', id: run.id, ts: run.ts, token: run.token, name, helped, nights });
  return Number(r.rank);
}

export async function topRuns(signal?: AbortSignal): Promise<BoardRow[]> {
  const res = await fetch(API(), { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { top?: BoardRow[] };
  return Array.isArray(data.top) ? data.top.slice(0, 50) : [];
}
