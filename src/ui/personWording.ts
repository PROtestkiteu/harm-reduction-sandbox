import { LANG } from '../i18n';
import { TRAITS, type Member, type TraitId } from '../sim/team';

import { memberWording } from '../sim/memberIdentity';

const POLISH_TRAITS: Partial<Record<TraitId, readonly [string, string, string]>> = {
  nurse: ['Pielęgniarz', 'Pielęgniarka', 'Osoba z kwalifikacjami pielęgniarskimi'],
  chemist: ['Chemik', 'Chemiczka', 'Osoba z kwalifikacjami chemicznymi'],
  social: ['Pracownik socjalny', 'Pracowniczka socjalna', 'Osoba zajmująca się pracą socjalną'],
};

export function memberTraitLabel(member: Pick<Member, 'name'>, trait: TraitId): string {
  const forms = LANG === 'pl' ? POLISH_TRAITS[trait] : undefined;
  if (!forms) return TRAITS[trait].label;
  const wording = memberWording(member.name);
  return forms[wording === 'masculine' ? 0 : wording === 'feminine' ? 1 : 2];
}
