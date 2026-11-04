import { t } from '../i18n';
import type { ClosedReason } from '../sim/simulation';
import type { ServiceStatus } from '../sim/types';

export type VenueIndicator = 'queue' | 'staff' | 'clock' | 'pause' | 'lock' | 'work' | 'maintenance' | 'route';
export interface VenueStatus {
  tone: 'muted' | 'normal' | 'green' | 'yellow' | 'orange' | 'red';
  faded: boolean;
  crossed: boolean;
  indicator: VenueIndicator | null;
  count?: number;
  message: string;
}
export interface VenueStatusInput {
  status: ServiceStatus;
  reason?: ClosedReason | null;
  queue: number;
  waitingRoom: number;
  atCapacity?: boolean;
  staff: number;
  requested: number;
  assigned: number;
  permitted?: boolean;
  reopening?: boolean;
  moving?: boolean;
  maintenanceRisk?: boolean;
}
function state(tone: VenueStatus['tone'], indicator: VenueIndicator | null, message: string, faded = false, crossed = false, count?: number): VenueStatus {
  return { tone, indicator, message, faded, crossed, count };
}

/** One dominant actionable cue. Never interpret attendance or adverse outcomes as danger. */
export function venueStatus(s: VenueStatusInput): VenueStatus {
  if (s.permitted === false || s.reason === 'notPermitted') return state('red', 'lock', t('Not permitted'), true);
  if (s.reopening) return state('yellow', 'work', t('Reopening work is underway.'), true);
  if (s.reason === 'closedDown') return state('muted', 'pause', t('Shut down'), true, true);
  if (s.reason === 'switchedOff') return state('muted', 'pause', t('Available, not in use.'), true);
  if (s.reason === 'onPatrol') return state('normal', 'route', t('Out on patrol'));
  if (s.reason === 'hours') return state('muted', 'clock', t('Outside opening hours.'), true);
  if (s.moving) return state('normal', 'route', t('Camper on the move'), true);
  if (s.reason === 'outOfService') return state('red', 'maintenance', t('Temporarily unavailable.'), true);
  if (s.status === 'closing') return state('orange', 'clock', t('Closing: staff leaving'), true);
  if (s.reason === 'noStaff' || (s.status === 'opening' && s.assigned === 0)) return state('orange', 'staff', t('No staff assigned. Review staffing.'), true);
  if (s.status === 'opening') return state('yellow', 'staff', t('Opening: staff on the way'), true);
  if (s.status === 'closed') return state('muted', 'clock', t('Closed'), true);
  if (s.maintenanceRisk) return state('orange', 'maintenance', t('Investment reserve is low. Invest to prevent a downgrade.'));
  if (s.queue > 0 && s.atCapacity) return state('orange', 'queue', t('At capacity: {n} waiting.', { n: s.queue }), false, false, s.queue);
  if (s.queue > 0 && s.queue >= s.waitingRoom) return state('orange', 'queue', t('Waiting area full: {n} waiting.', { n: s.queue }), false, false, s.queue);
  if (s.staff < s.requested) return state('yellow', 'staff', t('Staff on site: {n} of {max}', { n: s.staff, max: s.requested }));
  if (s.queue > 0) return state('yellow', 'queue', t('{n} people waiting.', { n: s.queue }), false, false, s.queue);
  return state('green', null, t('Open'));
}
