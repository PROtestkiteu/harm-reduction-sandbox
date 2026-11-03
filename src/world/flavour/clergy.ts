import { CLERGY_GROUPS } from '../../config/flavour/clergy';
import type { Pack, PackDeps } from './index';
import { walkingGroups } from './tourists';

/**
 * Clergy on the street (config/flavour/clergy.ts): now and then a procession
 * with a cross, candles, a canopy over the priest and a banner, walking slowly
 * and stopping to pray; or a priest, a rabbi and an imam walking together.
 * The tourists' walk (world/flavour/tourists.ts), with its own groups.
 */
export function buildClergy(deps: PackDeps): Pack {
  return walkingGroups(deps, CLERGY_GROUPS, { gap: [90, 200], hours: [[1080, 1260], [2100, 2400]], spacing: 1.2, side: 0.5 });
}
