import { PARAM_BY_ID, type ParamId, type SandboxSettings } from '../config/sandboxParams';
import { t } from '../i18n';

/**
 * Whether this game used the Sandbox's free levers: a slider, the budget,
 * a clock or date jump, a context factor or a national model. Such a run
 * stays off the leaderboard. The mark only ever turns on for the page's game
 * (a new game is a new page); it travels in saves and on the run ticket, so
 * a reload, a resume or a loaded save keeps it.
 */
let marked = false;
const listeners = new Set<() => void>();

/** Staff wanted and waiting places are also set by in-game actions at each place, so they are not free levers. */
export function isFreeLever(id: ParamId): boolean {
  return !id.endsWith('.staff') && !id.endsWith('.waiting');
}

/**
 * Settings from the address at the start of a fresh run that change the game:
 * any free lever off its default, except the starting date and time (a new
 * game picks those at random).
 */
export function hasFreeSettings(s: Partial<SandboxSettings>): boolean {
  return (Object.keys(s) as ParamId[]).some((id) => isFreeLever(id) && id !== 'date' && id !== 'clock' && s[id] !== PARAM_BY_ID[id].default);
}

export function markSandboxed(): void {
  if (marked) return;
  marked = true;
  for (const f of listeners) f();
}

export function isSandboxed(): boolean {
  return marked;
}

/** Called once when the mark turns on (the run ticket in storage follows it). */
export function onSandboxed(f: () => void): void {
  listeners.add(f);
}

/** Why the run cannot be submitted, for the place where the submit button is. */
export const sandboxedReason = (): string => t('This run changed the world settings, so it cannot go on the leaderboard.');
