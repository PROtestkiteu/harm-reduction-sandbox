/**
 * Noticing a new version while someone plays. The build writes version.json
 * beside the page; a running game asks for it now and then (every few
 * minutes, and when the tab comes back into view) and compares it with its
 * own build id. One request at a time, cancelled when a newer one starts;
 * offline or in development nothing happens.
 *
 * The reload itself is lossless: the run is saved to this tab's session
 * storage first and restored on start (see main.ts), and the settings ride
 * in the address bar as always.
 */
const EVERY_MS = 5 * 60_000;
export const RESUME_KEY = 'hrp-resume';

export function watchForUpdates(onNewer: () => void): void {
  if (import.meta.env.DEV) return;
  let pending: AbortController | null = null;
  let found = false;
  const check = async () => {
    if (found || !navigator.onLine) return;
    pending?.abort();
    const ctrl = new AbortController();
    pending = ctrl;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store', signal: ctrl.signal });
      if (!res.ok) return;
      const { build } = (await res.json()) as { build?: unknown };
      if (ctrl.signal.aborted || found) return;
      if (typeof build === 'string' && build !== __APP_BUILD__) {
        found = true;
        onNewer();
      }
    } catch {
      // Offline or cancelled: try again later.
    } finally {
      if (pending === ctrl) pending = null;
    }
  };
  window.setInterval(check, EVERY_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
}
