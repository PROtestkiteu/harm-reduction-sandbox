import { resetNames } from '../ui/names';
import type { SandboxSettings } from '../config/sandboxParams';
import type { SaveData } from './saveGame';
import { RESUME_KEY } from './updates';

export interface LaunchConfiguration {
  kind: 'new' | 'resume' | 'link';
  scenarioId: string | null;
  settings: Partial<SandboxSettings>;
  custom: boolean;
  save?: SaveData;
}

export let launchConfiguration: LaunchConfiguration | null = null;
export function setLaunchConfiguration(value: LaunchConfiguration): void {
  // Reset before scene/UI modules read names; Continue and linked saves keep their state.
  if (value.kind === 'new') resetNames();
  launchConfiguration = value;
  const seed = value.save?.worldSeed;
  if (typeof seed === 'number' && Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff) {
    (globalThis as { __launchSeed?: number }).__launchSeed = seed;
  }
}
export const CONTINUE_KEY = 'hrp-continue';
export const MENU_CONTEXT_KEY = 'hrp-menu-context';

/** Preserve the game and its authoritative settings before leaving its renderer. */
export function rememberMenuRun(save: SaveData): boolean {
  try {
    localStorage.setItem(CONTINUE_KEY, JSON.stringify(save));
    localStorage.setItem('hrp-continue-context', location.search);
  } catch { return false; }
  // Local snapshot and context are the durable pair. Session storage is optional.
  try {
    sessionStorage.setItem(MENU_CONTEXT_KEY, location.search);
    sessionStorage.removeItem(RESUME_KEY);
  } catch { /* Local Continue remains available. */ }
  const query = new URLSearchParams(location.search);
  const lang = query.get('lang');
  location.href = `${location.pathname}?menu=1${lang ? `&lang=${encodeURIComponent(lang)}` : ''}`;
  return true;
}

/** Explicit opt-in for development bots; public builds always show the menu. */
export function hasAutomaticLaunch(): boolean {
  const q = new URLSearchParams(location.search);
  if (q.has('menu')) return false;
  return q.has('play');
}
