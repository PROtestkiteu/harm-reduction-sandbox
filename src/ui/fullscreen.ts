/**
 * Full screen for the whole page, where the browser allows it: the standard
 * API, or the webkit-prefixed one older Safari on iPad still uses. iPhone
 * Safari has neither for pages, so there the game goes full screen only when
 * added to the home screen (the manifest asks for that).
 */
type Doc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type Root = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const doc = document as Doc;
const root = document.documentElement as Root;

export function canFullscreen(): boolean {
  return !!(root.requestFullscreen || root.webkitRequestFullscreen) && (document.fullscreenEnabled ?? true);
}

export function isFullscreen(): boolean {
  return !!(document.fullscreenElement ?? doc.webkitFullscreenElement);
}

/** Enters or leaves full screen; a refusal (no user gesture, a policy) is left as it is. */
export async function toggleFullscreen(): Promise<void> {
  try {
    if (isFullscreen()) await (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
    else if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
    else await root.webkitRequestFullscreen?.();
  } catch {
    // The browser said no; the page stays as it was.
  }
}

/** Calls `fn` whenever full screen starts or ends. */
export function onFullscreenChange(fn: () => void): void {
  document.addEventListener('fullscreenchange', fn);
  document.addEventListener('webkitfullscreenchange', fn);
}
