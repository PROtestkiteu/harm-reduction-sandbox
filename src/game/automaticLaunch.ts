import { menuLinkedSave } from './menuSave';
import { setLaunchConfiguration } from './launch';
import { RESUME_KEY } from './updates';
import { menuSave } from './menuSave';

/** Resolve saved layout metadata before importing the world or allocating a renderer. */
export async function prepareAutomaticLaunch(): Promise<void> {
  const url = new URL(location.href);
  const q = url.searchParams;
  let resume: unknown;
  try { resume = JSON.parse(sessionStorage.getItem(RESUME_KEY) ?? 'null'); } catch { /* No valid update snapshot. */ }
  const resumed = menuSave(resume);
  if (resumed) {
    if (resumed.tutorial) q.set('scenario', 'tutorial');
    history.replaceState(history.state, '', url);
    setLaunchConfiguration({ kind: 'resume', scenarioId: q.get('scenario'), settings: {}, custom: !!resumed.sandboxed, save: resumed });
    return;
  }
  const gid = q.get('g');
  const hash = url.hash.startsWith('#g=') ? url.hash.slice(3) : null;
  if (gid || hash !== null) {
    let save = null;
    if (gid && /^[0-9a-f]{24}$/.test(gid)) {
      const api = new URL('api/board.php', document.baseURI);
      api.searchParams.set('game', gid);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(api, { cache: 'no-store', signal: controller.signal });
        if (response.ok) {
          const body = await response.json() as { data?: unknown };
          if (typeof body.data === 'string') save = await menuLinkedSave(body.data, false);
        }
      } finally { clearTimeout(timer); }
    } else if (hash !== null) save = await menuLinkedSave(hash, true);
    if (!save) throw new Error('Saved game unavailable');
    if (save.tutorial) q.set('scenario', 'tutorial');
    else if (q.get('scenario') === 'tutorial') q.delete('scenario');
    history.replaceState(history.state, '', url);
    setLaunchConfiguration({ kind: 'link', scenarioId: q.get('scenario'), settings: {}, custom: !!save.sandboxed, save });
    return;
  }
  setLaunchConfiguration({ kind: 'new', scenarioId: q.get('scenario'), settings: {}, custom: q.get('scenario') === 'sandbox' || q.get('scenario') === 'tutorial' });
}
