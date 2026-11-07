import { SERVICE_IDS, type ServiceId } from './types';

/** Stable city identifiers; geometry and UI stay outside the simulation. */
export type ServiceSite = { kind: 'building'; id: number } | { kind: 'curb'; id: number } | { kind: 'original' };
export type ServiceSites = Partial<Record<ServiceId, ServiceSite>>;
export function readServiceSites(value: unknown): ServiceSites {
  const out: ServiceSites = {};
  if (!value || typeof value !== 'object') return out;
  for (const service of SERVICE_IDS) {
    const site = (value as Record<string, unknown>)[service];
    if (!site || typeof site !== 'object') continue;
    const { kind, id } = site as Record<string, unknown>;
    if (kind === 'original') out[service] = { kind };
    else if (Number.isSafeInteger(id) && (id as number) >= 0 && (id as number) < 100000 &&
      ((kind === 'curb' && (service === 'outreach' || service === 'footPatrol')) || (kind === 'building' && service !== 'outreach' && service !== 'footPatrol'))) {
      if (!Object.values(out).some(s => s.kind === kind && s.id === id)) out[service] = { kind, id: id as number };
    }
  }
  return out;
}

/** Shared curb reservations for first placement, relocation and additional campers. */
export function curbReserved(sites: ServiceSites, index: number, except?: ServiceId): boolean {
  return Object.entries(sites).some(([id, site]) => id !== except && site?.kind === 'curb' && site.id === index);
}
