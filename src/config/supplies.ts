import { t } from '../i18n';

/**
 * Supplies as stock: bought ahead in batches, used up per visit. With a
 * standing order a batch is reordered when stock runs low, but only one
 * delivery is on the way at a time, so a sudden rush can still empty the
 * shelf. Empty means people go without. ILLUSTRATIVE prices and sizes; the
 * per-use price is a little below the old one-at-a-time cost, the reward for
 * buying ahead.
 */
export type SupplyId = 'naloxone' | 'kits' | 'leaflets' | 'blankets';

export interface SupplyInfo {
  label: string;
  /** What one unit does, for the panel. */
  does: string;
  /** Units in one order, its price, and clock minutes until it arrives. */
  batch: number;
  price: number;
  deliveryMinutes: number;
  /** Units on the shelf at the start of a new game. */
  start: number;
  /** A standing order reorders a batch below this many. */
  reorderAt: number;
  /** Whether the standing order is on at the start. */
  standing: boolean;
}

export const SUPPLIES: Record<SupplyId, SupplyInfo> = {
  naloxone: { label: t('Naloxone'), does: t('One dose reverses one overdose staff reach in time.'), batch: 10, price: 150, deliveryMinutes: 120, start: 6, reorderAt: 3, standing: true },
  kits: { label: t('Sterile and test kits'), does: t('Clean needles and syringes, test strips and reagents: one per person who needs them.'), batch: 50, price: 80, deliveryMinutes: 90, start: 40, reorderAt: 12, standing: true },
  leaflets: { label: t('Leaflets'), does: t('Handed out on the street and at the stand; needed to warn the street before a crisis.'), batch: 100, price: 40, deliveryMinutes: 60, start: 60, reorderAt: 20, standing: false },
  blankets: { label: t('Blankets and warm kit'), does: t('Outreach hands them to people sleeping out on a freezing night; each one can keep someone alive.'), batch: 20, price: 100, deliveryMinutes: 120, start: 6, reorderAt: 4, standing: false },
};

export const SUPPLY_IDS = Object.keys(SUPPLIES) as SupplyId[];
