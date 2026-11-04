import { LANG } from '../i18n';
import { TRAITS, type Member, type TraitId } from '../sim/team';

// Authored roster wording; unknown names remain neutral. No simulation draws.
const MASCULINE = new Set(['Jonas', 'Emre', 'Kofi', 'Dmytro', 'Yusuf', 'Piotr', 'Felix', 'Tobias', 'Olek', 'Jakob', 'Bilal', 'Mateusz', 'Nils', 'Samir', 'Malik', 'Arash', 'Tomasz', 'Luca', 'Kwame']);
const FEMININE = new Set(['Mia', 'Aleksandra', 'Lena', 'Sara', 'Hanna', 'Amira', 'Marta', 'Zeynep', 'Chiara', 'Ines', 'Lea', 'Kasia', 'Fatima', 'Rosa', 'Ida', 'Greta', 'Vera', 'Ayla', 'Johanna', 'Nadia']);
const POLISH_TRAITS: Partial<Record<TraitId, readonly [string, string, string]>> = {
  nurse: ['Pielęgniarz', 'Pielęgniarka', 'Osoba z kwalifikacjami pielęgniarskimi'],
  chemist: ['Chemik', 'Chemiczka', 'Osoba z kwalifikacjami chemicznymi'],
  social: ['Pracownik socjalny', 'Pracowniczka socjalna', 'Osoba zajmująca się pracą socjalną'],
};

export function memberTraitLabel(member: Pick<Member, 'name'>, trait: TraitId): string {
  const forms = LANG === 'pl' ? POLISH_TRAITS[trait] : undefined;
  if (!forms) return TRAITS[trait].label;
  const name = member.name.replace(/ \d+$/, '');
  return forms[MASCULINE.has(name) ? 0 : FEMININE.has(name) ? 1 : 2];
}
