/** Walk-in services in the new district blocks: people queue at a door, go inside, come out served. */
export type WalkInServiceId = 'pharmacy' | 'drugChecking' | 'shelter' | 'clinic';
export type ServiceId = 'dropIn' | 'outreach' | 'clubHr' | WalkInServiceId;
export type LocationId = 'dropIn' | 'outreach' | 'club' | WalkInServiceId;

export const WALK_IN_SERVICE_IDS: readonly WalkInServiceId[] = ['pharmacy', 'drugChecking', 'shelter', 'clinic'];
export const SERVICE_IDS: readonly ServiceId[] = ['dropIn', 'outreach', 'clubHr', ...WALK_IN_SERVICE_IDS];
export const LOCATION_IDS: readonly LocationId[] = ['dropIn', 'outreach', 'club', ...WALK_IN_SERVICE_IDS];

/** The service a location offers; the club's is its harm reduction stand. */
export function serviceAt(id: LocationId): ServiceId {
  return id === 'club' ? 'clubHr' : id;
}

/** Derived from whether the service is switched on and whether staff are at their posts. */
export type ServiceStatus = 'open' | 'opening' | 'closing' | 'closed';
