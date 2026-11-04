// Authored roster wording; unknown names remain neutral. No simulation draws.
const MASCULINE = new Set(['Jonas', 'Emre', 'Kofi', 'Dmytro', 'Yusuf', 'Piotr', 'Felix', 'Tobias', 'Olek', 'Jakob', 'Bilal', 'Mateusz', 'Nils', 'Samir', 'Malik', 'Arash', 'Tomasz', 'Luca', 'Kwame']);
const FEMININE = new Set(['Mia', 'Aleksandra', 'Lena', 'Sara', 'Hanna', 'Amira', 'Marta', 'Zeynep', 'Chiara', 'Ines', 'Lea', 'Kasia', 'Fatima', 'Rosa', 'Ida', 'Greta', 'Vera', 'Ayla', 'Johanna', 'Nadia']);
export function memberWording(name: string): 'masculine' | 'feminine' | 'neutral' {
  const base = name.replace(/ \d+$/, '');
  return MASCULINE.has(base) ? 'masculine' : FEMININE.has(base) ? 'feminine' : 'neutral';
}
