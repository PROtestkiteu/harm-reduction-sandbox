import { t } from '../i18n';
import { FAVOURS, type FavourId } from '../config/favours';
import { REPUTATION_NODES } from '../config/reputation';
import type { Reputation } from './reputation';
export function favourView(r: Reputation, held: number, owed: boolean, tutorial: boolean) {
  const items = (Object.keys(FAVOURS) as FavourId[]).map(id => {
    const node = id === 'funding' ? 'credibility' : id === 'police' ? 'relationship' : 'community';
    const label = id === 'funding' ? t('Emergency funding (+{n} now)', { n: r.funding }) : id === 'police' ? t('Police keep their distance for {h} hours', { h: r.policeHours }) : t('No camp clearing for {h} hours', { h: r.campHours });
    const reason = tutorial ? t('Available after the tutorial.') : !r.earned.has(node) ? t('Requires {node}.', { node: REPUTATION_NODES.find(n => n.id === node)!.label }) : owed ? t('Resolve the pending city hall request first.') : held < 1 ? t('Reputation earns your next favour.') : '';
    return { id, label, short: label, reason, available: !reason };
  });
  return { held, owed, items, score: Math.floor(r.score), progress: Math.floor(r.progress * 100), capacity: r.capacity, earned: [...r.earned] };
}
export type FavourView = ReturnType<typeof favourView>;
