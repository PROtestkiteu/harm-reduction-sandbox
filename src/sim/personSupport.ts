import type { Profile, Substance } from '../config/randomEvents';
import { NEEDS, type NeedId } from '../config/matching';
import type { SkillId } from '../config/employeeSkills';
import { Team, type Member } from './team';

/** A person's disclosed support priorities in this illustrative simulation. */
export interface PersonSupport {
  readonly substance: Substance;
  readonly injects: boolean;
  readonly needs: readonly NeedId[];
  readonly skills: readonly SkillId[];
}

export const NEED_SKILLS: Readonly<Record<NeedId, readonly SkillId[]>> = {
  language: ['outreach'], housing: ['coordination'], wound: ['care'], trust: ['outreach'], crisis: ['care', 'coordination'],
};

/** Work priorities are soft recommendations, never clinical credentials or eligibility gates. */
const PROFILE_SKILLS: Readonly<Record<Substance, readonly SkillId[]>> = {
  opioid: ['care', 'outreach'], stimulant: ['outreach', 'care'], mdma: ['analysis', 'outreach'],
  cocaine: ['analysis', 'outreach'], cannabis: ['analysis', 'outreach'], alcohol: ['care', 'outreach'], none: [],
};
const PERSONAL_NEEDS: readonly NeedId[] = ['language', 'housing', 'wound', 'trust', 'crisis'];

/** Social circumstances vary independently of substance, injecting status and appearance. No RNG draws. */
export function personSupport(visitor: number, profile: Profile): PersonSupport {
  let hash = Math.imul((visitor >>> 0) ^ 0x51ed270b, 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
  const needs: NeedId[] = [];
  if (hash % 100 < 55) needs.push(PERSONAL_NEEDS[(hash >>> 8) % PERSONAL_NEEDS.length]);
  if ((hash >>> 16) % 100 < 15) {
    const next = PERSONAL_NEEDS[(hash >>> 20) % PERSONAL_NEEDS.length];
    if (!needs.includes(next)) needs.push(next);
  }
  const skills = [...PROFILE_SKILLS[profile.substance]];
  if (profile.injects && !skills.includes('care')) skills.push('care');
  for (const need of needs) for (const skill of NEED_SKILLS[need]) if (!skills.includes(skill)) skills.push(skill);
  return Object.freeze({ substance: profile.substance, injects: profile.injects, needs: Object.freeze(needs), skills: Object.freeze(skills) });
}

/** Shared by admission, automatic placement and person cards, on a bounded 0 to 1 scale. */
export function supportFit(member: Member, support: PersonSupport): number {
  const skillFit = support.skills.length
    ? support.skills.reduce((sum, skill) => sum + Team.skill(member, skill) / 20, 0) / support.skills.length : .5;
  const needFit = support.needs.length ? support.needs.reduce((sum, need) => {
    const trained = NEEDS[need].traits.some((trait) => member.traits.includes(trait));
    const skills = NEED_SKILLS[need];
    return sum + (trained ? 1 : skills.reduce((n, skill) => n + Team.skill(member, skill) / 20, 0) / skills.length);
  }, 0) / support.needs.length : skillFit;
  const readiness = (member.energy < .35 ? .1 : 0) + (Team.shaken(member) ? .1 : 0);
  return Math.max(0, Math.min(1, (skillFit + needFit) / 2 - readiness));
}
