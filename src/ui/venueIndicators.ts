import type { VenueIndicator } from './venueStatus';
// Crisp, monochrome SVGs; status colours belong to names, never to an unexplained dot.
const paths: Record<VenueIndicator, string> = {
  queue: '<circle cx="5" cy="4" r="2"/><path d="M2 14v-3a3 3 0 0 1 6 0v3M11 2v12M14 5v9"/>',
  staff: '<circle cx="8" cy="4" r="2.5"/><path d="M3 14v-2a5 5 0 0 1 10 0v2M6 11h4M8 9v4"/>',
  clock: '<circle cx="8" cy="8" r="6"/><path d="M8 4v4l3 2"/>',
  pause: '<path d="M5 3v10M11 3v10"/>',
  lock: '<rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2M8 10v1"/>',
  work: '<path d="M2 13h12M3 10V7a5 5 0 0 1 10 0v3M1 10h14M8 2v5"/>',
  maintenance: '<path d="m8 2 6 12H2zM8 6v3M8 11v.2"/>',
  route: '<circle cx="3" cy="12" r="1.5"/><circle cx="13" cy="4" r="1.5"/><path d="M3 10V6a3 3 0 0 1 6 0v4a2 2 0 0 0 4 0V6"/>',
};
export const VENUE_ICONS = Object.fromEntries(Object.entries(paths).map(([id, path]) => [id, `<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`])) as Record<VenueIndicator, string>;
