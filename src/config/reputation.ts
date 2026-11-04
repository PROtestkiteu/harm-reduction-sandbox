import { t } from '../i18n';
/** Illustrative progression balance; no scientific or clinical meaning. */
export const REPUTATION_NODES = [
  { id: 'credibility', threshold: 20, parents: [], label: t('Local credibility'), benefit: t('Emergency funding +300') },
  { id: 'community', threshold: 35, parents: ['credibility'], label: t('Community mandate'), benefit: t('Camp protection: 48 hours') },
  { id: 'relationship', threshold: 35, parents: ['credibility'], label: t('Working relationship'), benefit: t('Police distance: 12 hours') },
  { id: 'coalition', threshold: 55, parents: ['community'], label: t('Outreach coalition'), benefit: t('Camp protection: 72 hours') },
  { id: 'protocol', threshold: 55, parents: ['relationship'], label: t('Municipal protocol'), benefit: t('Police distance: 18 hours') },
  { id: 'mandate', threshold: 75, parents: ['coalition', 'protocol'], label: t('Public mandate'), benefit: t('Favour capacity: 3') },
  { id: 'partnership', threshold: 90, parents: ['mandate'], label: t('Lasting partnership'), benefit: t('Emergency funding +450') },
] as const;
export type ReputationNodeId = typeof REPUTATION_NODES[number]['id'];
export interface ReputationSave { score: number; progress: number; earned: ReputationNodeId[] }
export const reputationRate = (score: number): number => score < 20 ? 0 : score < 40 ? 0.25 : score < 70 ? 0.5 : 0.75;
