import { BUSINESS_GROUPS } from '../../config/flavour/business';
import type { Pack, PackDeps } from './index';
import { walkingGroups } from './tourists';

/**
 * Business people at the rush hours (config/flavour/business.ts): suits with
 * briefcases and coffee, start-up people with lanyards, walking briskly; the
 * tourists' walk (world/flavour/tourists.ts) with its own groups and hours.
 */
export function buildBusiness(deps: PackDeps): Pack {
  // 07:30 to 09:30 and 17:00 to 19:30, as the clock runs from 18:00 (1080) to 42:00.
  return walkingGroups(deps, BUSINESS_GROUPS, { gap: [15, 45], hours: [[1080, 1170], [2250, 2370], [2460, 2520]], spacing: 1.0, side: 0.55 });
}
