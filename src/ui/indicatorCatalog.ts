import { t } from '../i18n';
import { SKILLS, SKILL_IDS, type SkillId } from '../config/employeeSkills';
import { NEEDS, type NeedId } from '../config/matching';
import { SERVICE_TEXT } from '../config/places';
import { Team, TRAITS, type Member, type TraitId } from '../sim/team';
import type { PersonSupport } from '../sim/personSupport';
import { memberTraitLabel } from './personWording';

export type SupportId = NeedId | 'equipment';
export type IndicatorKey = `trait:${TraitId}` | `skill:${SkillId}` | `support:${SupportId}`;
export type IndicatorCategory = 'expertise' | 'personal' | 'learning' | 'skill' | 'support';
export interface IndicatorMetadata { readonly key: IndicatorKey; readonly category: IndicatorCategory; readonly label: string; readonly description: string; readonly asset: string }
const categories: Readonly<Record<TraitId, IndicatorCategory>> = { peer:'expertise', nurse:'expertise', chemist:'expertise', social:'expertise', psychologist:'expertise', languages:'expertise', calm:'personal', nightOwl:'personal', new:'learning' };
export function indicatorMetadata(key: IndicatorKey, member?: Pick<Member, 'name'>): IndicatorMetadata {
  const [kind, id] = key.split(':');
  let label: string, description: string, category: IndicatorCategory;
  if (kind === 'trait') {
    const trait = id as TraitId, info = TRAITS[trait];
    label = member ? memberTraitLabel(member, trait) : info.label;
    category = categories[trait];
    const effects = Object.entries(info.bonus).map(([service, value]) => `${SERVICE_TEXT[service as keyof typeof SERVICE_TEXT].short}: ${value! >= 0 ? '+' : '−'}${Math.round(Math.abs(value!) * 100)}%`);
    if (info.everywhere) effects.push(`${t('All services')}: ${info.everywhere >= 0 ? '+' : '−'}${Math.round(Math.abs(info.everywhere) * 100)}%`);
    description = [info.detail, ...effects].join('\n');
  } else if (kind === 'skill') {
    const info = SKILLS[id as SkillId]; label = info.label; description = info.detail; category = 'skill';
  } else {
    label = id === 'equipment' ? t('sterile injecting equipment') : NEEDS[id as NeedId].label;
    description = t('Requested support: {needs}', { needs: label }); category = 'support';
  }
  return { key, category, label, description, asset: `${import.meta.env.BASE_URL}indicators/v1/${kind}-${id}` };
}
export interface WorkerSummary {
  readonly id: number; readonly name: string; readonly traits: readonly TraitId[];
  readonly skills: Readonly<Record<SkillId, number>>; readonly energy: number; readonly morale: number;
}
export function workerSummary(member: Member): WorkerSummary {
  return { id: member.id, name: member.name, traits: member.traits, skills: Object.fromEntries(SKILL_IDS.map(id => [id, Math.round(Team.skill(member, id))])) as Record<SkillId, number>, energy: Math.round(member.energy * 100), morale: Math.round(member.morale * 100) };
}
export interface PersonSummary { readonly support: readonly SupportId[]; readonly helpfulSkills: readonly SkillId[] }
export function personSummary(support: PersonSupport): PersonSummary {
  return { support: [...support.needs, ...(support.injects ? ['equipment' as const] : [])], helpfulSkills: support.skills };
}
