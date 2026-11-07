import type { Simulation } from '../sim/simulation';
import type { ServiceId } from '../sim/types';

/** Existing and legacy home services remain established; a new tutorial site needs confirmation. */
export function servicePlaced(sim: Simulation, id: ServiceId): boolean {
  return sim.hasServiceSite(id);
}
