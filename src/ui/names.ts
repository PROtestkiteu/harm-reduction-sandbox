/**
 * Display names the player gave places and buildings, kept in this browser.
 * Storage can be missing (private mode, blocked site data): names then last
 * for the session only, and nothing else changes.
 */
const KEY = 'hrp-names';
const MAX = 40;

/**
 * People come and go, and the ordinary city buildings are laid out afresh each
 * launch, so their numbers mean something else next visit: those names last
 * this session only. Places and the organisation keep theirs.
 */
const kept = (all: Record<string, string>) =>
  Object.fromEntries(Object.entries(all).filter(([k]) => !k.startsWith('person:') && !k.startsWith('building:')));

let names: Record<string, string> = {};
try {
  names = kept(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>);
} catch { /* no storage: start empty */ }

/** What can be named: places, buildings and the organisation itself. */
export type Named = 'location' | 'building' | 'org' | 'person';

const key = (kind: Named, id: string | number) => `${kind}:${id}`;

export function displayName(kind: Named, id: string | number, fallback: string): string {
  return names[key(kind, id)] ?? fallback;
}

/** Sets a name; an empty one goes back to the default. */
export function rename(kind: Named, id: string | number, name: string): void {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, MAX);
  if (clean) names[key(kind, id)] = clean;
  else delete names[key(kind, id)];
  try { localStorage.setItem(KEY, JSON.stringify(kept(names))); } catch { /* session only */ }
}

export const NAME_MAX = MAX;
